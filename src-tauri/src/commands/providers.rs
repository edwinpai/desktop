// Provider/API Key Management Commands
//
// Manages API key configuration for AI providers (Anthropic, OpenAI, etc.)
// Keys are stored in the gateway's auth-profiles.json for the main agent.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;

fn auth_profiles_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let path = home.join(".edwinpai").join("agents").join("main").join("agent").join("auth-profiles.json");
    Ok(path)
}

fn read_auth_profiles() -> Result<Value, String> {
    let path = auth_profiles_path()?;
    if !path.exists() {
        // Return empty default
        return Ok(json!({
            "version": 1,
            "profiles": {},
            "lastGood": {}
        }));
    }
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read auth profiles: {}", e))?;
    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse auth profiles: {}", e))
}

fn write_auth_profiles(profiles: &Value) -> Result<(), String> {
    let path = auth_profiles_path()?;
    // Ensure parent directories exist
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create auth profiles directory: {}", e))?;
    }
    let contents = serde_json::to_string_pretty(profiles)
        .map_err(|e| format!("Failed to serialize auth profiles: {}", e))?;
    std::fs::write(&path, contents)
        .map_err(|e| format!("Failed to write auth profiles: {}", e))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub provider: String,
    pub api_key: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderListItem {
    pub id: String,
    pub provider: String,
    pub label: String,
    /// Masked key for display (e.g., "sk-ant-...QXAA")
    pub masked_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderListResult {
    pub providers: Vec<ProviderListItem>,
}

fn mask_key(key: &str) -> String {
    if key.len() <= 12 {
        return "***".to_string();
    }
    let prefix = &key[..8];
    let suffix = &key[key.len()-4..];
    format!("{}...{}", prefix, suffix)
}

/// List configured AI providers
#[tauri::command]
pub async fn list_providers() -> Result<ProviderListResult, String> {
    let profiles = read_auth_profiles()?;
    let mut providers = Vec::new();

    if let Some(profile_map) = profiles.get("profiles").and_then(|p| p.as_object()) {
        for (id, profile) in profile_map {
            let provider = profile.get("provider")
                .and_then(|p| p.as_str())
                .unwrap_or("unknown")
                .to_string();
            let token = profile.get("token")
                .and_then(|t| t.as_str())
                .unwrap_or("");
            let label = id.clone();

            providers.push(ProviderListItem {
                id: id.clone(),
                provider,
                label,
                masked_key: mask_key(token),
            });
        }
    }

    Ok(ProviderListResult { providers })
}

/// Add or update an AI provider API key
/// Deduplicates: if a profile for the same provider already exists, it is replaced.
#[tauri::command]
pub async fn add_provider(request: ProviderConfig) -> Result<ProviderListResult, String> {
    let mut profiles = read_auth_profiles()?;

    let label = request.label.unwrap_or_else(|| format!("{}:desktop", request.provider));

    // Add/update the profile
    let profile_entry = json!({
        "type": "token",
        "provider": request.provider,
        "token": request.api_key,
        "mode": "api_key"
    });

    if let Some(profile_map) = profiles.get_mut("profiles") {
        if let Some(obj) = profile_map.as_object_mut() {
            // Remove any existing profiles for the same provider (dedup)
            let existing_keys: Vec<String> = obj.iter()
                .filter(|(_, v)| {
                    v.get("provider")
                        .and_then(|p| p.as_str())
                        .map(|p| p == request.provider)
                        .unwrap_or(false)
                })
                .map(|(k, _)| k.clone())
                .collect();
            for key in existing_keys {
                obj.remove(&key);
            }
            obj.insert(label.clone(), profile_entry);
        }
    } else {
        profiles["profiles"] = json!({ label: profile_entry });
    }

    write_auth_profiles(&profiles)?;

    // Return updated list
    list_providers().await
}

/// Remove an AI provider
#[tauri::command]
pub async fn remove_provider(id: String) -> Result<ProviderListResult, String> {
    let mut profiles = read_auth_profiles()?;

    if let Some(profile_map) = profiles.get_mut("profiles") {
        if let Some(obj) = profile_map.as_object_mut() {
            obj.remove(&id);
        }
    }

    write_auth_profiles(&profiles)?;
    list_providers().await
}
