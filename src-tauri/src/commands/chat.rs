// Chat proxy command — routes requests from webview to gateway,
// bypassing CORS restrictions. Reads auth token and gateway URL from ~/.edwinpai/edwinpai.json.
//
// SECURITY: The gateway URL is read from config, NOT accepted from the webview.
// This prevents SSRF attacks where a compromised webview could exfiltrate the
// auth token to an arbitrary URL (EDWINPAI-2026-510).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    /// Relative path appended to the gateway base URL (e.g., "/v1/chat/completions").
    /// Must start with "/" — absolute URLs are rejected.
    pub path: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub status: u16,
    pub body: String,
    pub error: Option<String>,
}

/// Gateway connection info from ~/.edwinpai/edwinpai.json
struct GatewayConfig {
    base_url: String,
    token: Option<String>,
}

/// Read gateway URL and auth token from ~/.edwinpai/edwinpai.json
fn read_gateway_config() -> Option<GatewayConfig> {
    let home = dirs::home_dir()?;
    let config_path: PathBuf = home.join(".edwinpai").join("edwinpai.json");
    let content = std::fs::read_to_string(config_path).ok()?;
    let config: serde_json::Value = serde_json::from_str(&content).ok()?;

    // Read port from config (default 18789)
    let port = config["gateway"]["port"]
        .as_u64()
        .or_else(|| config["gateway"]["bind"]["port"].as_u64())
        .unwrap_or(18789);

    // Read host from config (default 127.0.0.1)
    let host = config["gateway"]["bind"]["host"]
        .as_str()
        .unwrap_or("127.0.0.1");

    let base_url = format!("http://{}:{}", host, port);

    let token = config["gateway"]["auth"]["token"]
        .as_str()
        .map(|s| s.to_string());

    Some(GatewayConfig { base_url, token })
}

/// Proxy a chat completion request to the gateway.
/// The webview can't directly fetch localhost due to CORS.
/// This command makes the HTTP request from Rust (no CORS).
/// Automatically attaches the gateway auth token.
///
/// SECURITY: URL is constructed from config, not from webview input.
/// The webview only supplies a path (e.g., "/v1/chat/completions").
#[tauri::command]
pub async fn chat_proxy(request: ChatRequest) -> Result<ChatResponse, String> {
    // Validate path: must start with "/" and not contain authority/scheme
    if !request.path.starts_with('/') {
        return Err("Path must start with '/'".to_string());
    }
    if request.path.contains("://") || request.path.starts_with("//") {
        return Err("Path must not contain a URL scheme or authority".to_string());
    }

    let gw_config = read_gateway_config()
        .ok_or_else(|| "Failed to read gateway config from ~/.edwinpai/edwinpai.json".to_string())?;

    let url = format!("{}{}", gw_config.base_url, request.path);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json");

    // Attach auth token if available
    if let Some(token) = gw_config.token {
        req = req.header("Authorization", format!("Bearer {}", token));
    }

    let response = req
        .body(request.body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(ChatResponse {
        status,
        body,
        error: if status >= 400 { Some(format!("HTTP {}", status)) } else { None },
    })
}
