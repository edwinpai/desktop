// Channel Commands (SPEC §9)
//
// Tauri commands for channel management.

use crate::channel_domain::{
    create_channel, delete_channel, list_channels, read_channel, read_channel_decrypted,
    update_channel, validate_credentials, ChannelConfig, ChannelName, ChannelSettings, ValidationResult,
};
use crate::edwinpai_config::get_gateway_port;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Create a new channel configuration
#[tauri::command]
pub async fn create_channel_cmd(
    channel: String,
    configured_by: String,
    credentials: HashMap<String, String>,
    settings: ChannelSettings,
) -> Result<ChannelConfig, String> {
    let channel_name: ChannelName = channel
        .parse()
        .map_err(|e: String| format!("Invalid channel name: {}", e))?;

    create_channel(channel_name, configured_by, credentials, settings).await
}

/// Read a channel configuration (with encrypted credentials)
#[tauri::command]
pub async fn read_channel_cmd(channel: String) -> Result<ChannelConfig, String> {
    let channel_name: ChannelName = channel
        .parse()
        .map_err(|e: String| format!("Invalid channel name: {}", e))?;

    read_channel(channel_name)
}

/// Read a channel configuration with decrypted credentials
#[tauri::command]
pub async fn read_channel_decrypted_cmd(channel: String) -> Result<DecryptedChannelConfigResponse, String> {
    let channel_name: ChannelName = channel
        .parse()
        .map_err(|e: String| format!("Invalid channel name: {}", e))?;

    let decrypted = read_channel_decrypted(channel_name).await?;

    Ok(DecryptedChannelConfigResponse {
        channel: decrypted.channel.as_str().to_string(),
        enabled: decrypted.enabled,
        configured_at: decrypted.configured_at,
        configured_by: decrypted.configured_by,
        credentials: decrypted.credentials,
        settings: decrypted.settings,
    })
}

/// Update a channel configuration
#[tauri::command]
pub async fn update_channel_cmd(
    channel: String,
    enabled: Option<bool>,
    credentials: Option<HashMap<String, String>>,
    settings: Option<ChannelSettings>,
) -> Result<ChannelConfig, String> {
    let channel_name: ChannelName = channel
        .parse()
        .map_err(|e: String| format!("Invalid channel name: {}", e))?;

    update_channel(channel_name, enabled, credentials, settings).await
}

/// Delete a channel configuration
#[tauri::command]
pub async fn delete_channel_cmd(channel: String) -> Result<(), String> {
    let channel_name: ChannelName = channel
        .parse()
        .map_err(|e: String| format!("Invalid channel name: {}", e))?;

    delete_channel(channel_name)
}

/// List all configured channels
#[tauri::command]
pub async fn list_channels_cmd() -> Result<Vec<ChannelConfig>, String> {
    list_channels()
}

/// Validate channel credentials without persisting
#[tauri::command]
pub async fn validate_channel_credentials_cmd(
    channel: String,
    credentials: HashMap<String, String>,
) -> Result<ValidationResult, String> {
    let channel_name: ChannelName = channel
        .parse()
        .map_err(|e: String| format!("Invalid channel name: {}", e))?;

    validate_credentials(channel_name, credentials).await
}

/// Enable or disable a channel
#[tauri::command]
pub async fn toggle_channel_cmd(channel: String, enabled: bool) -> Result<ChannelConfig, String> {
    let channel_name: ChannelName = channel
        .parse()
        .map_err(|e: String| format!("Invalid channel name: {}", e))?;

    update_channel(channel_name, Some(enabled), None, None).await
}

/// Response type for decrypted channel config (with channel as string)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecryptedChannelConfigResponse {
    pub channel: String,
    pub enabled: bool,
    pub configured_at: String,
    pub configured_by: String,
    pub credentials: HashMap<String, String>,
    pub settings: ChannelSettings,
}

/// QR code response for WhatsApp/Signal pairing
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QRCodeResponse {
    /// Base64-encoded QR code image data URI
    pub qr_data_uri: String,
    /// Session ID for tracking pairing status
    pub session_id: String,
    /// Timestamp when QR code was generated
    pub generated_at: String,
    /// Expiration time for QR code (typically 60 seconds)
    pub expires_at: String,
}

/// WhatsApp/Signal session status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusResponse {
    /// Session ID
    pub session_id: String,
    /// Connection status: "pending", "connected", "expired", "failed"
    pub status: String,
    /// Optional phone number (if connected)
    pub phone_number: Option<String>,
    /// Optional error message (if failed)
    pub error: Option<String>,
}

/// Request a WhatsApp QR code for pairing
///
/// This command initiates a WhatsApp Web session via the gateway and returns
/// a QR code for the user to scan with their phone.
///
/// # Returns
/// * `Ok(QRCodeResponse)` - QR code data and session info
/// * `Err("Gateway is not running")` - If gateway is offline
/// * `Err(message)` - Other gateway errors
#[tauri::command]
pub async fn request_whatsapp_qr_cmd() -> Result<QRCodeResponse, String> {
    let port = get_gateway_port()?;

    // Make HTTP request to the configured local gateway's WhatsApp QR endpoint
    let gateway_url = format!("http://127.0.0.1:{}/v1/edwinpai/channels/whatsapp/qr", port);

    let response = reqwest::Client::new()
        .post(&gateway_url)
        .send()
        .await
        .map_err(|e| format!("Gateway request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Gateway error: {}", error_text));
    }

    let qr_response: QRCodeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse gateway response: {}", e))?;

    Ok(qr_response)
}

/// Check WhatsApp/Signal session status
///
/// Polls the gateway to check if the QR code has been scanned and the session
/// is established.
///
/// # Arguments
/// * `session_id` - The session ID returned from request_whatsapp_qr_cmd
///
/// # Returns
/// * `Ok(SessionStatusResponse)` - Current session status
/// * `Err("Gateway is not running")` - If gateway is offline
/// * `Err(message)` - Other gateway errors
#[tauri::command]
pub async fn check_whatsapp_status_cmd(session_id: String) -> Result<SessionStatusResponse, String> {
    let port = get_gateway_port()?;

    // Make HTTP request to the configured local gateway's session status endpoint
    let gateway_url = format!("http://127.0.0.1:{}/v1/edwinpai/channels/whatsapp/status/{}", port, session_id);

    let response = reqwest::Client::new()
        .get(&gateway_url)
        .send()
        .await
        .map_err(|e| format!("Gateway request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Gateway error: {}", error_text));
    }

    let status_response: SessionStatusResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse gateway response: {}", e))?;

    Ok(status_response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_channel_cmd_invalid_channel_name() {
        let result = create_channel_cmd(
            "invalid_channel".to_string(),
            "02test".to_string(),
            HashMap::new(),
            ChannelSettings::default(),
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid channel name"));
    }

    #[tokio::test]
    #[ignore]
    async fn test_create_channel_cmd_valid() {
        let channel = "telegram".to_string();
        let configured_by = "02test123".to_string();
        let credentials = HashMap::from([("botToken".to_string(), "123456:ABC-DEF".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel_cmd(channel.clone()).await;

        let result = create_channel_cmd(channel.clone(), configured_by, credentials, settings).await;

        assert!(result.is_ok());

        // Clean up
        let _ = delete_channel_cmd(channel).await;
    }

    #[tokio::test]
    #[ignore]
    async fn test_read_channel_cmd() {
        let channel = "whatsapp".to_string();
        let configured_by = "02test456".to_string();
        let credentials = HashMap::from([("sessionData".to_string(), "{}".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel_cmd(channel.clone()).await;

        // Create channel
        create_channel_cmd(channel.clone(), configured_by, credentials, settings)
            .await
            .expect("Should create channel");

        // Read channel
        let result = read_channel_cmd(channel.clone()).await;
        assert!(result.is_ok());

        let config = result.unwrap();
        assert_eq!(config.channel.as_str(), "whatsapp");

        // Clean up
        let _ = delete_channel_cmd(channel).await;
    }

    #[tokio::test]
    #[ignore]
    async fn test_read_channel_decrypted_cmd() {
        let channel = "matrix".to_string();
        let configured_by = "02test789".to_string();
        let credentials = HashMap::from([
            ("homeserver".to_string(), "https://matrix.org".to_string()),
            ("accessToken".to_string(), "syt_abc".to_string()),
        ]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel_cmd(channel.clone()).await;

        // Create channel
        create_channel_cmd(
            channel.clone(),
            configured_by,
            credentials.clone(),
            settings,
        )
        .await
        .expect("Should create channel");

        // Read decrypted
        let result = read_channel_decrypted_cmd(channel.clone()).await;
        assert!(result.is_ok());

        let decrypted = result.unwrap();
        assert_eq!(decrypted.credentials.get("homeserver"), credentials.get("homeserver"));

        // Clean up
        let _ = delete_channel_cmd(channel).await;
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_channel_cmd() {
        let channel = "discord".to_string();
        let configured_by = "02testABC".to_string();
        let credentials = HashMap::from([("botToken".to_string(), "token123".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel_cmd(channel.clone()).await;

        // Create channel
        create_channel_cmd(channel.clone(), configured_by, credentials, settings)
            .await
            .expect("Should create channel");

        // Update enabled to false
        let result = update_channel_cmd(channel.clone(), Some(false), None, None).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().enabled, false);

        // Clean up
        let _ = delete_channel_cmd(channel).await;
    }

    #[tokio::test]
    #[ignore]
    async fn test_delete_channel_cmd() {
        let channel = "slack".to_string();
        let configured_by = "02testDEF".to_string();
        let credentials = HashMap::from([("accessToken".to_string(), "xoxb-token".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel_cmd(channel.clone()).await;

        // Create channel
        create_channel_cmd(channel.clone(), configured_by, credentials, settings)
            .await
            .expect("Should create channel");

        // Delete channel
        let result = delete_channel_cmd(channel.clone()).await;
        assert!(result.is_ok());

        // Verify it's deleted
        let read_result = read_channel_cmd(channel).await;
        assert!(read_result.is_err());
    }

    #[tokio::test]
    #[ignore]
    async fn test_list_channels_cmd() {
        // Clean up
        for ch in ["telegram", "whatsapp", "matrix"] {
            let _ = delete_channel_cmd(ch.to_string()).await;
        }

        // Create 2 channels
        for ch in ["telegram", "whatsapp"] {
            create_channel_cmd(
                ch.to_string(),
                "02test".to_string(),
                HashMap::from([("token".to_string(), "test".to_string())]),
                ChannelSettings::default(),
            )
            .await
            .expect("Should create channel");
        }

        // List channels
        let result = list_channels_cmd().await;
        assert!(result.is_ok());

        let channels = result.unwrap();
        assert!(channels.len() >= 2);

        // Clean up
        for ch in ["telegram", "whatsapp"] {
            let _ = delete_channel_cmd(ch.to_string()).await;
        }
    }

    #[tokio::test]
    async fn test_validate_channel_credentials_cmd() {
        let channel = "telegram".to_string();
        let credentials = HashMap::from([(
            "botToken".to_string(),
            "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string(),
        )]);

        let result = validate_channel_credentials_cmd(channel, credentials).await;
        assert!(result.is_ok());

        let validation = result.unwrap();
        assert!(validation.valid);
    }

    #[tokio::test]
    #[ignore]
    async fn test_toggle_channel_cmd() {
        let channel = "signal".to_string();
        let configured_by = "02testGHI".to_string();
        let credentials = HashMap::from([("deviceData".to_string(), "{}".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel_cmd(channel.clone()).await;

        // Create channel (enabled by default)
        create_channel_cmd(channel.clone(), configured_by, credentials, settings)
            .await
            .expect("Should create channel");

        // Toggle to disabled
        let result = toggle_channel_cmd(channel.clone(), false).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().enabled, false);

        // Toggle back to enabled
        let result = toggle_channel_cmd(channel.clone(), true).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().enabled, true);

        // Clean up
        let _ = delete_channel_cmd(channel).await;
    }

    #[tokio::test]
    #[ignore]
    async fn test_request_whatsapp_qr_cmd_gateway_offline() {
        // Test should fail with "Gateway is not running" when no gateway is initialized
        let result = request_whatsapp_qr_cmd().await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Gateway is not running"));
    }

    #[tokio::test]
    #[ignore]
    async fn test_check_whatsapp_status_cmd_gateway_offline() {
        let session_id = "test-session-123".to_string();

        // Test should fail with "Gateway is not running" when no gateway is initialized
        let result = check_whatsapp_status_cmd(session_id).await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Gateway is not running"));
    }
}
