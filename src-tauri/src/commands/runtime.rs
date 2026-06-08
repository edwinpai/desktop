use serde::Serialize;
use std::process::{Command, Stdio};

/// Runtime environment status
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    /// Whether Node.js is available on PATH
    pub node_available: bool,
    /// Node.js version string (e.g., "v24.11.1")
    pub node_version: Option<String>,
    /// Whether npm is available for installing the public gateway package
    pub npm_available: bool,
    /// npm version string
    pub npm_version: Option<String>,
    /// Whether the 'edwinpai' npm package is installed
    pub edwinpai_available: bool,
    /// EdwinPAI version string
    pub edwinpai_version: Option<String>,
    /// Path to the EdwinPAI binary (if found)
    pub edwinpai_path: Option<String>,
    /// Whether a bundled runtime exists at ~/.edwinpai/runtime/
    pub bundled_runtime: bool,
    /// Overall readiness (can we start a gateway?)
    pub ready: bool,
}

/// Check the EdwinPAI runtime environment
///
/// Detects Node.js, EdwinPAI installation, and bundled runtime.
#[tauri::command]
pub async fn check_runtime() -> Result<RuntimeStatus, String> {
    // Check Node.js
    let (node_available, node_version) = check_node();

    // Check npm
    let (npm_available, npm_version) = check_npm();

    // Check EdwinPAI binary
    let edwinpai_binary = crate::gateway::find_edwinpai_binary();
    let edwinpai_available = edwinpai_binary.is_some();
    let edwinpai_path = edwinpai_binary
        .as_ref()
        .map(|p| p.to_string_lossy().to_string());

    // Get EdwinPAI version if binary found
    let edwinpai_version = if let Some(ref path) = edwinpai_binary {
        get_edwinpai_version(path.to_str().unwrap_or("edwinpai"))
    } else {
        None
    };

    // Check for bundled runtime
    let bundled_runtime = if let Some(home) = dirs::home_dir() {
        let runtime_dir = home.join(".edwinpai").join("runtime");
        runtime_dir.exists() && runtime_dir.join("node").exists()
    } else {
        false
    };

    let ready = (node_available && edwinpai_available) || bundled_runtime;

    Ok(RuntimeStatus {
        node_available,
        node_version,
        npm_available,
        npm_version,
        edwinpai_available,
        edwinpai_version,
        edwinpai_path,
        bundled_runtime,
        ready,
    })
}

fn check_node() -> (bool, Option<String>) {
    command_version(node_command(), "--version")
}

fn check_npm() -> (bool, Option<String>) {
    command_version(npm_command(), "--version")
}

fn command_version(command: &str, arg: &str) -> (bool, Option<String>) {
    match Command::new(command).arg(arg).output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, Some(version))
        }
        _ => (false, None),
    }
}

fn npm_command() -> &'static str {
    if cfg!(windows) {
        "npm.cmd"
    } else {
        "npm"
    }
}

fn node_command() -> &'static str {
    if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    }
}

fn get_edwinpai_version(binary_path: &str) -> Option<String> {
    match Command::new(binary_path).arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Some(version)
        }
        _ => None,
    }
}

/// Result of a Desktop-managed Gateway npm install attempt.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallGatewayRuntimeResult {
    pub success: bool,
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub status_code: Option<i32>,
    pub runtime: RuntimeStatus,
}

/// Install or update the public EdwinPAI Gateway npm package for the current user.
///
/// This intentionally installs the public package, not the private monorepo package:
/// `npm install -g @edwinpai/edwinpai@beta`.
#[tauri::command]
pub async fn install_gateway_runtime() -> Result<InstallGatewayRuntimeResult, String> {
    let before = check_runtime().await?;
    if !before.node_available {
        return Err("Node.js is required before Desktop can install the EdwinPAI Gateway. Install Node.js 22+ from https://nodejs.org, then try again.".to_string());
    }
    if !before.npm_available {
        return Err("npm is required before Desktop can install the EdwinPAI Gateway. Install Node.js 22+ with npm enabled, then try again.".to_string());
    }

    let npm = npm_command();
    let args = ["install", "-g", "@edwinpai/edwinpai@beta"];
    let output = Command::new(npm)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("Failed to run npm install: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let status_code = output.status.code();
    let runtime = check_runtime().await?;
    let command = format!("{} {}", npm, args.join(" "));

    if !output.status.success() {
        let combined = format!("{}\n{}", stdout, stderr);
        let hint = if combined.contains("EACCES") || combined.contains("permission denied") {
            " npm reported a permissions problem. Configure a user-level npm prefix or retry from an account that can install global packages."
        } else if combined.contains("ENOTFOUND") || combined.contains("network") {
            " npm reported a network/registry problem. Check internet access and npm registry settings."
        } else {
            ""
        };
        return Err(format!(
            "Gateway install failed with status {:?}.{}\nCommand: {}\n{}",
            status_code, hint, command, combined
        ));
    }

    if !runtime.edwinpai_available {
        return Err(format!(
            "npm install completed, but Desktop still could not find the `edwinpai` binary. Command: {}\n{}\n{}",
            command, stdout, stderr
        ));
    }

    Ok(InstallGatewayRuntimeResult {
        success: true,
        command,
        stdout,
        stderr,
        status_code,
        runtime,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn npm_command_uses_platform_binary_name() {
        if cfg!(windows) {
            assert_eq!(npm_command(), "npm.cmd");
        } else {
            assert_eq!(npm_command(), "npm");
        }
    }
}
