// Real EdwinPAI Configuration Commands
//
// Tauri commands for reading and writing the main EdwinPAI configuration file
// (~/.edwinpai/edwinpai.json) that is shared between Desktop and Gateway.
//
// CRITICAL: This file uses serde_json::Value to preserve ALL config fields,
// even those the Desktop app doesn't know about. The gateway config has
// dozens of fields (auth, agents, tools, messages, channels, plugins, etc).
// A typed struct that only knows 5 fields would destroy the rest on write.

use crate::edwinpai_config::{read_edwinpai_config, update_edwinpai_config as write_edwinpai_config};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Get EdwinPAI configuration from ~/.edwinpai/edwinpai.json
///
/// Returns the full config as a JSON value, preserving all fields.
#[tauri::command]
pub async fn get_edwinpai_config() -> Result<GetEdwinPAIConfigResult, String> {
    let config = read_edwinpai_config()?;
    Ok(GetEdwinPAIConfigResult { config })
}

/// Update EdwinPAI configuration in ~/.edwinpai/edwinpai.json
///
/// Deep-merges the provided updates into the existing config,
/// preserving all fields not included in the update.
/// Sends SIGUSR1 to gateway for hot reload.
#[tauri::command]
pub async fn update_edwinpai_config_cmd(updates: Value) -> Result<GetEdwinPAIConfigResult, String> {
    let config = write_edwinpai_config(&updates)?;
    Ok(GetEdwinPAIConfigResult { config })
}


/// Compatibility wrapper for older frontend callers.
///
/// Accepts a full config payload under the `config` argument name.
#[tauri::command]
pub async fn update_edwinpai_config(config: Value) -> Result<GetEdwinPAIConfigResult, String> {
    let config = write_edwinpai_config(&config)?;
    Ok(GetEdwinPAIConfigResult { config })
}

/// Validate EdwinPAI configuration
///
/// Checks for common issues in the config.
#[tauri::command]
pub async fn validate_edwinpai_config(config: Value) -> Result<ConfigValidationResult, String> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Validate gateway port
    if let Some(port) = config.get("gateway").and_then(|g| g.get("port")).and_then(|p| p.as_u64()) {
        if port < 1024 {
            warnings.push(format!(
                "gateway port {} is below 1024 (requires root privileges on Unix)",
                port
            ));
        }
        if port > 65535 {
            errors.push(format!("gateway port {} exceeds maximum (65535)", port));
        }
    }

    // Validate public key format (if present)
    if let Some(pubkey) = config.get("publicKey").and_then(|v| v.as_str()) {
        if pubkey.len() != 66 {
            errors.push(format!(
                "publicKey must be 66 characters (compressed secp256k1), got {}",
                pubkey.len()
            ));
        }
        if !pubkey.starts_with("02") && !pubkey.starts_with("03") {
            errors.push("publicKey must start with 02 or 03 (compressed format)".to_string());
        }
        if hex::decode(pubkey).is_err() {
            errors.push("publicKey must be valid hexadecimal".to_string());
        }
    }

    let valid = errors.is_empty();

    Ok(ConfigValidationResult {
        valid,
        errors,
        warnings,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetEdwinPAIConfigResult {
    pub config: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}
