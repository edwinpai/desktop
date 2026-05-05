use serde::Serialize;
use std::{
    env, fs,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const BUNDLED_INSTALLER: &str = include_str!("../../resources/install-edwinpai-runtime.sh");
const EXPECTED_RUNTIME_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EdwinpaiRuntimeCheck {
    pub installed: bool,
    pub compatible: bool,
    pub expected_version: String,
    pub version: Option<String>,
    pub binary_path: Option<String>,
    pub gateway_status_ok: bool,
    pub gateway_status: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCommandResult {
    pub success: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub async fn check_edwinpai_runtime() -> Result<EdwinpaiRuntimeCheck, String> {
    let binary = crate::gateway::find_edwinpai_binary();
    let binary_path = binary.as_ref().map(|p| p.to_string_lossy().to_string());

    let Some(path) = binary_path.clone() else {
        return Ok(EdwinpaiRuntimeCheck {
            installed: false,
            compatible: false,
            expected_version: EXPECTED_RUNTIME_VERSION.to_string(),
            version: None,
            binary_path: None,
            gateway_status_ok: false,
            gateway_status: None,
            reason: Some("EdwinPAI CLI was not found on PATH or common npm locations.".to_string()),
        });
    };

    let version_output = Command::new(&path)
        .arg("--version")
        .output()
        .map_err(|e| format!("failed to run edwinpai --version: {e}"))?;
    let version = String::from_utf8_lossy(&version_output.stdout)
        .trim()
        .to_string();
    let version = if version.is_empty() {
        None
    } else {
        Some(version)
    };
    let compatible = version.as_deref().is_some_and(|value| {
        value == EXPECTED_RUNTIME_VERSION
            || value == format!("edwinpai {}", EXPECTED_RUNTIME_VERSION)
    });

    let status_output = Command::new(&path).args(["gateway", "status"]).output();
    let (gateway_status_ok, gateway_status) = match status_output {
        Ok(out) => {
            let mut text = String::new();
            text.push_str(String::from_utf8_lossy(&out.stdout).trim());
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            if !stderr.is_empty() {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(&stderr);
            }
            (
                out.status.success(),
                if text.is_empty() { None } else { Some(text) },
            )
        }
        Err(e) => (
            false,
            Some(format!("failed to run edwinpai gateway status: {e}")),
        ),
    };

    let reason = if compatible {
        None
    } else {
        Some(format!(
            "Runtime version does not match desktop app version {}.",
            EXPECTED_RUNTIME_VERSION
        ))
    };

    Ok(EdwinpaiRuntimeCheck {
        installed: true,
        compatible,
        expected_version: EXPECTED_RUNTIME_VERSION.to_string(),
        version,
        binary_path: Some(path),
        gateway_status_ok,
        gateway_status,
        reason,
    })
}

#[tauri::command]
pub async fn start_edwinpai_gateway_cli() -> Result<RuntimeCommandResult, String> {
    run_edwinpai_args(&["gateway", "start"])
}

#[tauri::command]
pub async fn install_edwinpai_runtime() -> Result<RuntimeCommandResult, String> {
    let mut script_path = env::temp_dir();
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    script_path.push(format!("edwinpai-desktop-install-{stamp}.sh"));
    fs::write(&script_path, BUNDLED_INSTALLER)
        .map_err(|e| format!("failed to write bundled installer: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o700);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    let output = Command::new("bash")
        .arg(&script_path)
        .env("EDWINPAI_VERSION", "beta")
        .output()
        .map_err(|e| format!("failed to run bundled installer: {e}"))?;

    let _ = fs::remove_file(&script_path);
    Ok(RuntimeCommandResult {
        success: output.status.success(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn run_edwinpai_args(args: &[&str]) -> Result<RuntimeCommandResult, String> {
    let binary = crate::gateway::find_edwinpai_binary()
        .ok_or_else(|| "EdwinPAI CLI was not found.".to_string())?;
    let output = Command::new(binary)
        .args(args)
        .output()
        .map_err(|e| format!("failed to run edwinpai {}: {e}", args.join(" ")))?;
    Ok(RuntimeCommandResult {
        success: output.status.success(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}
