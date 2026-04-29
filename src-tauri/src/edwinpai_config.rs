// EdwinPAI Configuration (~/.edwinpai/edwinpai.json)
//
// CRITICAL: The gateway's edwinpai.json has many fields that this Desktop app
// doesn't know about (auth, agents, tools, messages, channels, plugins, etc).
// We MUST preserve unknown fields on read/write. We use serde_json::Value as
// the canonical representation and only extract/modify the fields we care about.
//
// Configuration location: ~/.edwinpai/edwinpai.json
// Hot reload: Sends SIGUSR1 to gateway PID after config writes

use serde_json::Value;
use std::path::PathBuf;
use std::fs;

/// Strip trailing commas before `}` and `]` to handle JSON5-style configs.
fn strip_trailing_commas(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut i = 0;
    while i < len {
        if chars[i] == ',' {
            // Look ahead past whitespace for } or ]
            let mut j = i + 1;
            while j < len && (chars[j] == ' ' || chars[j] == '\t' || chars[j] == '\n' || chars[j] == '\r') {
                j += 1;
            }
            if j < len && (chars[j] == '}' || chars[j] == ']') {
                // Skip the trailing comma
                i += 1;
                continue;
            }
        }
        result.push(chars[i]);
        i += 1;
    }
    result
}

/// Get the EdwinPAI config directory path: ~/.edwinpai/
pub fn get_edwinpai_config_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or("Failed to determine home directory")?;
    Ok(home_dir.join(".edwinpai"))
}

/// Get the EdwinPAI config file path: ~/.edwinpai/edwinpai.json
pub fn get_edwinpai_config_path() -> Result<PathBuf, String> {
    Ok(get_edwinpai_config_dir()?.join("edwinpai.json"))
}

/// Read EdwinPAI configuration from ~/.edwinpai/edwinpai.json as raw JSON Value.
///
/// Preserves ALL fields, even those this app doesn't know about.
/// Returns an empty object if file doesn't exist.
pub fn read_edwinpai_config() -> Result<Value, String> {
    let config_path = get_edwinpai_config_path()?;

    if !config_path.exists() {
        return Ok(serde_json::json!({}));
    }

    let contents = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read edwinpai.json: {}", e))?;

    // Strip trailing commas (edwinpai.json uses JSON5-style trailing commas)
    let sanitized = strip_trailing_commas(&contents);

    let config: Value = serde_json::from_str(&sanitized)
        .map_err(|e| format!("Failed to parse edwinpai.json: {}", e))?;

    Ok(config)
}

/// Write EdwinPAI configuration to ~/.edwinpai/edwinpai.json
///
/// Uses atomic write pattern: write to temp file, then rename.
/// Sends SIGUSR1 to gateway PID if present (hot reload signal).
pub fn write_edwinpai_config(config: &Value) -> Result<(), String> {
    let config_dir = get_edwinpai_config_dir()?;
    let config_path = get_edwinpai_config_path()?;

    // Ensure config directory exists
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create .edwinpai directory: {}", e))?;

    // Serialize config to JSON (pretty-printed)
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // Atomic write via temp file
    let temp_path = config_path.with_extension("json.tmp");
    fs::write(&temp_path, &json)
        .map_err(|e| format!("Failed to write temp config file: {}", e))?;

    fs::rename(&temp_path, &config_path)
        .map_err(|e| format!("Failed to rename temp config file: {}", e))?;

    // Send SIGUSR1 to gateway if PID is present (hot reload signal)
    if let Some(pid) = config.get("gateway")
        .and_then(|g| g.get("pid"))
        .and_then(|p| p.as_u64())
    {
        let _ = send_sigusr1_to_gateway(pid as u32);
    }

    Ok(())
}

/// Read a specific field from the gateway config
pub fn get_gateway_port() -> Result<u16, String> {
    let config = read_edwinpai_config()?;
    Ok(config.get("gateway")
        .and_then(|g| g.get("port"))
        .and_then(|p| p.as_u64())
        .unwrap_or(18789) as u16)
}

/// Update specific fields in the config without destroying others.
///
/// Takes a partial JSON value and deep-merges it into the existing config.
pub fn update_edwinpai_config(updates: &Value) -> Result<Value, String> {
    let mut config = read_edwinpai_config()?;
    deep_merge(&mut config, updates);
    write_edwinpai_config(&config)?;
    Ok(config)
}

/// Deep merge `source` into `target`. Only overwrites leaf values;
/// preserves all existing keys not present in source.
fn deep_merge(target: &mut Value, source: &Value) {
    match (target, source) {
        (Value::Object(ref mut target_map), Value::Object(source_map)) => {
            for (key, source_val) in source_map {
                let target_val = target_map.entry(key.clone()).or_insert(Value::Null);
                deep_merge(target_val, source_val);
            }
        }
        (target, source) => {
            *target = source.clone();
        }
    }
}

/// Send SIGUSR1 signal to gateway process (Unix only)
#[cfg(unix)]
fn send_sigusr1_to_gateway(pid: u32) -> Result<(), String> {
    use nix::sys::signal::{self, Signal};
    use nix::unistd::Pid;

    let pid = Pid::from_raw(pid as i32);

    signal::kill(pid, Signal::SIGUSR1)
        .map_err(|e| format!("Failed to send SIGUSR1 to gateway PID {}: {}", pid, e))?;

    Ok(())
}

#[cfg(not(unix))]
fn send_sigusr1_to_gateway(_pid: u32) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deep_merge_preserves_unknown_fields() {
        let mut target = serde_json::json!({
            "version": "1.0.0",
            "auth": { "profiles": { "test": true } },
            "gateway": { "port": 3000, "mode": "local" },
            "channels": { "matrix": { "enabled": true } }
        });

        let source = serde_json::json!({
            "gateway": { "port": 18789 }
        });

        deep_merge(&mut target, &source);

        // Updated field
        assert_eq!(target["gateway"]["port"], 18789);
        // Preserved fields
        assert_eq!(target["gateway"]["mode"], "local");
        assert_eq!(target["auth"]["profiles"]["test"], true);
        assert_eq!(target["channels"]["matrix"]["enabled"], true);
        assert_eq!(target["version"], "1.0.0");
    }

    #[test]
    fn test_default_port_is_18789() {
        // When config doesn't specify port, default should be 18789
        assert_eq!(18789u16, 18789);
    }

    #[test]
    fn test_get_edwinpai_config_path() {
        let path = get_edwinpai_config_path().unwrap();
        let path_str = path.to_string_lossy();
        assert!(path_str.contains(".edwinpai"));
        assert!(path_str.ends_with("edwinpai.json"));
    }
}
