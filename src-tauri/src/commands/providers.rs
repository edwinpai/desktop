// Deprecated provider/auth-profile management commands.
//
// Desktop-owned provider secrets now belong in Desktop Vault / OS keychain.
// These compatibility commands remain registered for older UI/tests, but must not
// write provider secrets to the gateway auth-profiles.json secret store.

use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

fn auth_profiles_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let path = home
        .join(".edwinpai")
        .join("agents")
        .join("main")
        .join("agent")
        .join("auth-profiles.json");
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
    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse auth profiles: {}", e))
}

fn write_auth_profiles(profiles: &Value) -> Result<(), String> {
    let path = auth_profiles_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create auth profiles directory: {}", e))?;
    }
    let contents = serde_json::to_string_pretty(profiles)
        .map_err(|e| format!("Failed to serialize auth profiles: {}", e))?;
    std::fs::write(&path, contents).map_err(|e| format!("Failed to write auth profiles: {}", e))
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderVaultImportResult {
    pub imported: bool,
    pub credential_id: String,
    pub profile_id: String,
    pub removed_source: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAICodexOAuthResult {
    pub credential_id: String,
    pub account_id: String,
    pub expires: i64,
}

#[derive(Debug, Deserialize)]
struct OpenAITokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
}

const OPENAI_CODEX_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_CODEX_AUTHORIZE_URL: &str = "https://auth.openai.com/oauth/authorize";
const OPENAI_CODEX_TOKEN_URL: &str = "https://auth.openai.com/oauth/token";
const OPENAI_CODEX_REDIRECT_URI: &str = "http://localhost:1455/auth/callback";
const OPENAI_CODEX_SCOPE: &str = "openid profile email offline_access";
const OPENAI_CODEX_JWT_CLAIM_PATH: &str = "https://api.openai.com/auth";

fn random_urlsafe(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

fn random_hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    hex::encode(buf)
}

fn percent_decode(input: &str) -> String {
    let mut out = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                    if let Ok(v) = u8::from_str_radix(hex, 16) {
                        out.push(v);
                        i += 3;
                        continue;
                    }
                }
                out.push(bytes[i]);
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

fn query_param(path: &str, key: &str) -> Option<String> {
    let query = path
        .split_once('?')?
        .1
        .split_whitespace()
        .next()
        .unwrap_or("");
    for pair in query.split('&') {
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        if k == key {
            return Some(percent_decode(v));
        }
    }
    None
}

async fn wait_for_openai_codex_callback(expected_state: String) -> Result<String, String> {
    let listener = TcpListener::bind("127.0.0.1:1455").await.map_err(|e| {
        format!(
            "Failed to bind OAuth callback server on localhost:1455: {}",
            e
        )
    })?;
    let (mut socket, _) =
        tokio::time::timeout(std::time::Duration::from_secs(300), listener.accept())
            .await
            .map_err(|_| "Timed out waiting for OpenAI OAuth callback".to_string())?
            .map_err(|e| format!("Failed accepting OAuth callback: {}", e))?;
    let mut buf = vec![0u8; 8192];
    let n = socket
        .read(&mut buf)
        .await
        .map_err(|e| format!("Failed reading OAuth callback: {}", e))?;
    let request = String::from_utf8_lossy(&buf[..n]);
    let path = request
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("");
    let state =
        query_param(path, "state").ok_or_else(|| "OAuth callback missing state".to_string())?;
    let code =
        query_param(path, "code").ok_or_else(|| "OAuth callback missing code".to_string())?;
    let (status, body) = if state == expected_state {
        (
            "200 OK",
            "OpenAI authentication completed. You can close this window.",
        )
    } else {
        (
            "400 Bad Request",
            "OpenAI authentication failed: state mismatch.",
        )
    };
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><body>{body}</body></html>"
    );
    let _ = socket.write_all(response.as_bytes()).await;
    if state != expected_state {
        return Err("OAuth callback state mismatch".to_string());
    }
    Ok(code)
}

fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("cmd");
        c.arg("/C").arg("start");
        c
    };
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(url)
        .spawn()
        .map_err(|e| format!("Failed to open browser: {}", e))?;
    Ok(())
}

fn extract_openai_account_id(access_token: &str) -> Result<String, String> {
    let payload = access_token
        .split('.')
        .nth(1)
        .ok_or_else(|| "Access token is not a JWT".to_string())?;
    let bytes = general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|e| format!("Failed to decode access token payload: {}", e))?;
    let json: Value = serde_json::from_slice(&bytes)
        .map_err(|e| format!("Failed to parse access token payload: {}", e))?;
    json.get(OPENAI_CODEX_JWT_CLAIM_PATH)
        .and_then(|v| v.get("chatgpt_account_id"))
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| "Failed to extract ChatGPT account id from access token".to_string())
}

fn mask_key(key: &str) -> String {
    if key.len() <= 12 {
        return "***".to_string();
    }
    let prefix = &key[..8];
    let suffix = &key[key.len() - 4..];
    format!("{}...{}", prefix, suffix)
}

/// List configured AI providers
#[tauri::command]
pub async fn list_providers() -> Result<ProviderListResult, String> {
    let profiles = read_auth_profiles()?;
    let mut providers = Vec::new();

    if let Some(profile_map) = profiles.get("profiles").and_then(|p| p.as_object()) {
        for (id, profile) in profile_map {
            let provider = profile
                .get("provider")
                .and_then(|p| p.as_str())
                .unwrap_or("unknown")
                .to_string();
            let token = profile.get("token").and_then(|t| t.as_str()).unwrap_or("");
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

/// Run native Desktop-owned OpenAI Codex OAuth and store credentials directly in Vault.
#[tauri::command]
pub async fn login_openai_codex_oauth_to_vault(
    profile_id: String,
) -> Result<OpenAICodexOAuthResult, String> {
    let verifier = random_urlsafe(32);
    let challenge = general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state = random_hex(16);
    let auth_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&code_challenge={}&code_challenge_method=S256&state={}&id_token_add_organizations=true&codex_cli_simplified_flow=true&originator=edwinpai-desktop",
        OPENAI_CODEX_AUTHORIZE_URL,
        OPENAI_CODEX_CLIENT_ID,
        OPENAI_CODEX_REDIRECT_URI,
        OPENAI_CODEX_SCOPE.replace(' ', "+"),
        challenge,
        state,
    );

    open_browser(&auth_url)?;
    let code = wait_for_openai_codex_callback(state).await?;

    let client = reqwest::Client::new();
    let token: OpenAITokenResponse = client
        .post(OPENAI_CODEX_TOKEN_URL)
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", OPENAI_CODEX_CLIENT_ID),
            ("code", code.as_str()),
            ("code_verifier", verifier.as_str()),
            ("redirect_uri", OPENAI_CODEX_REDIRECT_URI),
        ])
        .send()
        .await
        .map_err(|e| format!("OpenAI token exchange failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("OpenAI token exchange was rejected: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI token response: {}", e))?;

    let account_id = extract_openai_account_id(&token.access_token)?;
    let expires = chrono::Utc::now().timestamp_millis() + token.expires_in * 1000;
    let credential = json!({
        "type": "oauth",
        "provider": "openai-codex",
        "access": token.access_token,
        "refresh": token.refresh_token,
        "expires": expires,
        "accountId": account_id,
    });

    super::vault::vault_store(
        profile_id,
        "openai-codex-oauth".to_string(),
        "OpenAI Codex OAuth".to_string(),
        "oauth".to_string(),
        "openai-codex".to_string(),
        serde_json::to_string(&credential)
            .map_err(|e| format!("Failed to serialize OAuth credential: {}", e))?,
        Some(std::collections::HashMap::from([
            ("source".to_string(), "provider-settings-oauth".to_string()),
            ("authMode".to_string(), "oauth".to_string()),
            ("accountId".to_string(), account_id.clone()),
        ])),
    )
    .await?;

    Ok(OpenAICodexOAuthResult {
        credential_id: "openai-codex-oauth".to_string(),
        account_id,
        expires,
    })
}

/// Import the legacy OpenAI Codex OAuth auth-profile into Desktop Vault.
///
/// This is a migration bridge for users who previously ran `edwinpai configure`
/// or `edwinpai models auth login --provider openai-codex`. It moves the
/// structured OAuth payload into the canonical Desktop Vault credential
/// `openai-codex-oauth` so runtime access can be Vault-first.
#[tauri::command]
pub async fn import_openai_codex_oauth_profile_to_vault(
    profile_id: String,
    remove_source: Option<bool>,
) -> Result<ProviderVaultImportResult, String> {
    let mut profiles = read_auth_profiles()?;
    let profile_map = profiles
        .get_mut("profiles")
        .and_then(|p| p.as_object_mut())
        .ok_or_else(|| "No auth profiles found".to_string())?;

    let selected_id = if profile_map.contains_key("openai-codex:default") {
        "openai-codex:default".to_string()
    } else {
        profile_map
            .iter()
            .find_map(|(id, profile)| {
                let provider = profile.get("provider").and_then(Value::as_str)?;
                let kind = profile.get("type").and_then(Value::as_str)?;
                if provider == "openai-codex" && kind == "oauth" {
                    Some(id.clone())
                } else {
                    None
                }
            })
            .ok_or_else(|| {
                "No OpenAI Codex OAuth profile found in auth-profiles.json".to_string()
            })?
    };

    let credential = profile_map
        .get(&selected_id)
        .cloned()
        .ok_or_else(|| "Selected OpenAI Codex OAuth profile disappeared".to_string())?;

    if credential.get("provider").and_then(Value::as_str) != Some("openai-codex")
        || credential.get("type").and_then(Value::as_str) != Some("oauth")
    {
        return Err("Selected profile is not an OpenAI Codex OAuth credential".to_string());
    }
    if credential
        .get("access")
        .and_then(Value::as_str)
        .unwrap_or("")
        .is_empty()
    {
        return Err("OpenAI Codex OAuth profile is missing an access token".to_string());
    }

    let raw_secret = serde_json::to_string(&credential)
        .map_err(|e| format!("Failed to serialize OAuth profile for Vault: {}", e))?;

    super::vault::vault_store(
        profile_id.clone(),
        "openai-codex-oauth".to_string(),
        "OpenAI Codex OAuth".to_string(),
        "oauth".to_string(),
        "openai-codex".to_string(),
        raw_secret,
        Some(std::collections::HashMap::from([
            ("source".to_string(), "auth-profiles-import".to_string()),
            ("sourceProfileId".to_string(), selected_id.clone()),
            ("authMode".to_string(), "oauth".to_string()),
        ])),
    )
    .await?;

    let mut removed_source = false;
    if remove_source.unwrap_or(false) {
        profile_map.remove(&selected_id);
        write_auth_profiles(&profiles)?;
        removed_source = true;
    }

    Ok(ProviderVaultImportResult {
        imported: true,
        credential_id: "openai-codex-oauth".to_string(),
        profile_id: selected_id,
        removed_source,
    })
}

/// Add or update an AI provider API key.
///
/// Deprecated: model provider secrets must be stored with `vault_store` and only
/// metadata may be patched into gateway config. This command intentionally
/// rejects writes so Desktop does not create a second secret source in
/// auth-profiles.json.
#[tauri::command]
pub async fn add_provider(_request: ProviderConfig) -> Result<ProviderListResult, String> {
    Err("Provider secrets must be stored in Desktop Vault; add_provider no longer writes auth-profiles.json".to_string())
}

/// Remove an AI provider.
///
/// Deprecated: provider removal should delete the Vault entry and patch gateway
/// metadata. This compatibility command intentionally avoids editing
/// auth-profiles.json.
#[tauri::command]
pub async fn remove_provider(_id: String) -> Result<ProviderListResult, String> {
    Err("Provider secrets are managed in Desktop Vault; remove_provider no longer edits auth-profiles.json".to_string())
}
