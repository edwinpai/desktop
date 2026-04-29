use serde::Serialize;
use std::process::Command;

/// Runtime environment status
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    /// Whether Node.js is available on PATH
    pub node_available: bool,
    /// Node.js version string (e.g., "v24.11.1")
    pub node_version: Option<String>,
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

    // Check EdwinPAI binary
    let edwinpai_binary = crate::gateway::find_edwinpai_binary();
    let edwinpai_available = edwinpai_binary.is_some();
    let edwinpai_path = edwinpai_binary.as_ref().map(|p| p.to_string_lossy().to_string());

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
        edwinpai_available,
        edwinpai_version,
        edwinpai_path,
        bundled_runtime,
        ready,
    })
}

fn check_node() -> (bool, Option<String>) {
    match Command::new("node").arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, Some(version))
        }
        _ => (false, None),
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
