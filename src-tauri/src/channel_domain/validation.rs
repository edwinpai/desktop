// Platform-Specific Credential Validation (SPEC §9.2-9.7)
//
// Validates channel credentials without persisting them.
// Each platform has specific validation logic.

use crate::channel_domain::config::ChannelName;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub error_message: Option<String>,
    pub metadata: Option<HashMap<String, String>>, // Extra info (bot username, phone number, etc.)
}

impl ValidationResult {
    pub fn success(metadata: Option<HashMap<String, String>>) -> Self {
        Self {
            valid: true,
            error_message: None,
            metadata,
        }
    }

    pub fn failure(error: String) -> Self {
        Self {
            valid: false,
            error_message: Some(error),
            metadata: None,
        }
    }
}

/// Validates credentials for a specific channel
///
/// # Arguments
/// * `channel` - Channel to validate
/// * `credentials` - Map of credential field names → plaintext values
///
/// # Returns
/// Validation result with success/failure and optional metadata
pub async fn validate_credentials(
    channel: ChannelName,
    credentials: HashMap<String, String>,
) -> Result<ValidationResult, String> {
    match channel {
        ChannelName::WhatsApp => validate_whatsapp(credentials).await,
        ChannelName::Telegram => validate_telegram(credentials).await,
        ChannelName::Matrix => validate_matrix(credentials).await,
        ChannelName::Discord => validate_discord(credentials).await,
        ChannelName::Slack => validate_slack(credentials).await,
        ChannelName::Signal => validate_signal(credentials).await,
    }
}

/// Validates WhatsApp credentials (expects QR code session data)
async fn validate_whatsapp(credentials: HashMap<String, String>) -> Result<ValidationResult, String> {
    // WhatsApp uses QR code pairing, validation happens client-side during scan
    // Backend receives session data after successful pairing

    let session_data = credentials.get("sessionData").ok_or("Missing sessionData")?;

    // Basic validation: ensure session data is not empty and looks like JSON
    if session_data.trim().is_empty() {
        return Ok(ValidationResult::failure("Session data is empty".to_string()));
    }

    // Try to parse as JSON
    if serde_json::from_str::<serde_json::Value>(session_data).is_err() {
        return Ok(ValidationResult::failure(
            "Invalid session data format".to_string(),
        ));
    }

    // In a real implementation, we would verify the session with WhatsApp Web API
    // For now, we assume valid session data means successful pairing

    let mut metadata = HashMap::new();
    metadata.insert("status".to_string(), "paired".to_string());

    Ok(ValidationResult::success(Some(metadata)))
}

/// Validates Telegram credentials (bot token)
async fn validate_telegram(credentials: HashMap<String, String>) -> Result<ValidationResult, String> {
    let bot_token = credentials.get("botToken").ok_or("Missing botToken")?;

    // Telegram bot tokens have format: <bot_id>:<auth_token>
    // Example: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
    let parts: Vec<&str> = bot_token.split(':').collect();
    if parts.len() != 2 {
        return Ok(ValidationResult::failure(
            "Invalid bot token format (expected: BOT_ID:AUTH_TOKEN)".to_string(),
        ));
    }

    let bot_id = parts[0];
    let auth_token = parts[1];

    // Bot ID should be numeric
    if bot_id.parse::<u64>().is_err() {
        return Ok(ValidationResult::failure(
            "Bot ID must be numeric".to_string(),
        ));
    }

    // Auth token should be at least 30 characters
    if auth_token.len() < 30 {
        return Ok(ValidationResult::failure(
            "Auth token is too short".to_string(),
        ));
    }

    // In a real implementation, we would call Telegram's getMe API:
    // GET https://api.telegram.org/bot<token>/getMe
    // For now, we assume the token format is valid

    let mut metadata = HashMap::new();
    metadata.insert("botId".to_string(), bot_id.to_string());

    Ok(ValidationResult::success(Some(metadata)))
}

/// Validates Matrix credentials (homeserver + access token or username/password)
async fn validate_matrix(credentials: HashMap<String, String>) -> Result<ValidationResult, String> {
    let homeserver = credentials
        .get("homeserver")
        .ok_or("Missing homeserver")?;

    // Homeserver should be a valid URL
    if !homeserver.starts_with("https://") && !homeserver.starts_with("http://") {
        return Ok(ValidationResult::failure(
            "Homeserver must be a valid URL (https:// or http://)".to_string(),
        ));
    }

    // Check if access token is provided
    if let Some(access_token) = credentials.get("accessToken") {
        // Validate access token format (typically starts with "syt_" for synapse)
        if access_token.trim().is_empty() {
            return Ok(ValidationResult::failure("Access token is empty".to_string()));
        }

        // In a real implementation, we would validate the token with Matrix API:
        // GET /_matrix/client/v3/account/whoami with Authorization: Bearer <token>

        let mut metadata = HashMap::new();
        metadata.insert("homeserver".to_string(), homeserver.clone());
        metadata.insert("authMethod".to_string(), "accessToken".to_string());

        return Ok(ValidationResult::success(Some(metadata)));
    }

    // Check if username and password are provided
    if let (Some(username), Some(password)) = (credentials.get("username"), credentials.get("password")) {
        if username.trim().is_empty() {
            return Ok(ValidationResult::failure("Username is empty".to_string()));
        }

        if password.trim().is_empty() {
            return Ok(ValidationResult::failure("Password is empty".to_string()));
        }

        // In a real implementation, we would attempt login:
        // POST /_matrix/client/v3/login with username/password

        let mut metadata = HashMap::new();
        metadata.insert("homeserver".to_string(), homeserver.clone());
        metadata.insert("username".to_string(), username.clone());
        metadata.insert("authMethod".to_string(), "password".to_string());

        return Ok(ValidationResult::success(Some(metadata)));
    }

    Ok(ValidationResult::failure(
        "Must provide either accessToken or username+password".to_string(),
    ))
}

/// Validates Discord credentials (bot token or OAuth)
async fn validate_discord(credentials: HashMap<String, String>) -> Result<ValidationResult, String> {
    // Check if bot token is provided
    if let Some(bot_token) = credentials.get("botToken") {
        // Discord bot tokens are typically 59-70 characters
        if bot_token.len() < 50 {
            return Ok(ValidationResult::failure(
                "Bot token is too short (minimum 50 characters)".to_string(),
            ));
        }

        // In a real implementation, we would validate with Discord API:
        // GET /users/@me with Authorization: Bot <token>

        let mut metadata = HashMap::new();
        metadata.insert("authMethod".to_string(), "botToken".to_string());

        return Ok(ValidationResult::success(Some(metadata)));
    }

    // Check if OAuth tokens are provided
    if let Some(access_token) = credentials.get("accessToken") {
        if access_token.trim().is_empty() {
            return Ok(ValidationResult::failure(
                "Access token is empty".to_string(),
            ));
        }

        // In a real implementation, we would validate with Discord API:
        // GET /users/@me with Authorization: Bearer <token>

        let mut metadata = HashMap::new();
        metadata.insert("authMethod".to_string(), "oauth".to_string());

        return Ok(ValidationResult::success(Some(metadata)));
    }

    Ok(ValidationResult::failure(
        "Must provide either botToken or accessToken".to_string(),
    ))
}

/// Validates Slack credentials (OAuth tokens)
async fn validate_slack(credentials: HashMap<String, String>) -> Result<ValidationResult, String> {
    let access_token = credentials
        .get("accessToken")
        .ok_or("Missing accessToken")?;

    // Slack tokens start with "xoxb-" (bot token) or "xoxp-" (user token)
    if !access_token.starts_with("xoxb-") && !access_token.starts_with("xoxp-") {
        return Ok(ValidationResult::failure(
            "Invalid Slack token format (should start with xoxb- or xoxp-)".to_string(),
        ));
    }

    // Token should be at least 40 characters
    if access_token.len() < 40 {
        return Ok(ValidationResult::failure(
            "Slack token is too short".to_string(),
        ));
    }

    // In a real implementation, we would call Slack's auth.test API:
    // POST /api/auth.test with token=<access_token>

    let mut metadata = HashMap::new();
    metadata.insert(
        "tokenType".to_string(),
        if access_token.starts_with("xoxb-") {
            "bot".to_string()
        } else {
            "user".to_string()
        },
    );

    Ok(ValidationResult::success(Some(metadata)))
}

/// Validates Signal credentials (linked device data)
async fn validate_signal(credentials: HashMap<String, String>) -> Result<ValidationResult, String> {
    // Signal uses QR code pairing for linked devices
    // Similar to WhatsApp, validation happens during pairing

    let device_data = credentials.get("deviceData").ok_or("Missing deviceData")?;

    // Basic validation: ensure device data is not empty
    if device_data.trim().is_empty() {
        return Ok(ValidationResult::failure("Device data is empty".to_string()));
    }

    // Try to parse as JSON
    if serde_json::from_str::<serde_json::Value>(device_data).is_err() {
        return Ok(ValidationResult::failure(
            "Invalid device data format".to_string(),
        ));
    }

    // In a real implementation, we would verify the linked device with Signal API

    let mut metadata = HashMap::new();
    metadata.insert("status".to_string(), "linked".to_string());

    Ok(ValidationResult::success(Some(metadata)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_validate_telegram_valid_token() {
        let credentials = HashMap::from([(
            "botToken".to_string(),
            "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string(),
        )]);

        let result = validate_telegram(credentials).await.unwrap();
        assert!(result.valid);
        assert!(result.error_message.is_none());
        assert_eq!(
            result.metadata.as_ref().unwrap().get("botId"),
            Some(&"123456".to_string())
        );
    }

    #[tokio::test]
    async fn test_validate_telegram_invalid_format() {
        let credentials = HashMap::from([("botToken".to_string(), "invalid-token".to_string())]);

        let result = validate_telegram(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("Invalid bot token format"));
    }

    #[tokio::test]
    async fn test_validate_telegram_non_numeric_bot_id() {
        let credentials = HashMap::from([("botToken".to_string(), "abc:DEF123456".to_string())]);

        let result = validate_telegram(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("Bot ID must be numeric"));
    }

    #[tokio::test]
    async fn test_validate_telegram_short_auth_token() {
        let credentials = HashMap::from([("botToken".to_string(), "123456:short".to_string())]);

        let result = validate_telegram(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("too short"));
    }

    #[tokio::test]
    async fn test_validate_matrix_with_access_token() {
        let credentials = HashMap::from([
            ("homeserver".to_string(), "https://matrix.org".to_string()),
            ("accessToken".to_string(), "syt_abc123xyz".to_string()),
        ]);

        let result = validate_matrix(credentials).await.unwrap();
        assert!(result.valid);
        assert_eq!(
            result.metadata.as_ref().unwrap().get("authMethod"),
            Some(&"accessToken".to_string())
        );
    }

    #[tokio::test]
    async fn test_validate_matrix_with_password() {
        let credentials = HashMap::from([
            ("homeserver".to_string(), "https://matrix.example.com".to_string()),
            ("username".to_string(), "alice".to_string()),
            ("password".to_string(), "secret123".to_string()),
        ]);

        let result = validate_matrix(credentials).await.unwrap();
        assert!(result.valid);
        assert_eq!(
            result.metadata.as_ref().unwrap().get("authMethod"),
            Some(&"password".to_string())
        );
    }

    #[tokio::test]
    async fn test_validate_matrix_invalid_homeserver() {
        let credentials = HashMap::from([
            ("homeserver".to_string(), "not-a-url".to_string()),
            ("accessToken".to_string(), "token".to_string()),
        ]);

        let result = validate_matrix(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("valid URL"));
    }

    #[tokio::test]
    async fn test_validate_matrix_missing_credentials() {
        let credentials = HashMap::from([("homeserver".to_string(), "https://matrix.org".to_string())]);

        let result = validate_matrix(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result
            .error_message
            .unwrap()
            .contains("accessToken or username+password"));
    }

    #[tokio::test]
    async fn test_validate_discord_bot_token() {
        let credentials = HashMap::from([(
            "botToken".to_string(),
            "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKl.MnOpQrStUvWxYz123456789012345678901234".to_string(),
        )]);

        let result = validate_discord(credentials).await.unwrap();
        assert!(result.valid);
        assert_eq!(
            result.metadata.as_ref().unwrap().get("authMethod"),
            Some(&"botToken".to_string())
        );
    }

    #[tokio::test]
    async fn test_validate_discord_short_token() {
        let credentials = HashMap::from([("botToken".to_string(), "short".to_string())]);

        let result = validate_discord(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("too short"));
    }

    #[tokio::test]
    async fn test_validate_slack_bot_token() {
        let credentials =
            HashMap::from([("accessToken".to_string(), "xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz".to_string())]);

        let result = validate_slack(credentials).await.unwrap();
        assert!(result.valid);
        assert_eq!(
            result.metadata.as_ref().unwrap().get("tokenType"),
            Some(&"bot".to_string())
        );
    }

    #[tokio::test]
    async fn test_validate_slack_user_token() {
        let credentials =
            HashMap::from([("accessToken".to_string(), "xoxp-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz".to_string())]);

        let result = validate_slack(credentials).await.unwrap();
        assert!(result.valid);
        assert_eq!(
            result.metadata.as_ref().unwrap().get("tokenType"),
            Some(&"user".to_string())
        );
    }

    #[tokio::test]
    async fn test_validate_slack_invalid_prefix() {
        let credentials = HashMap::from([("accessToken".to_string(), "invalid-token-format".to_string())]);

        let result = validate_slack(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("xoxb- or xoxp-"));
    }

    #[tokio::test]
    async fn test_validate_whatsapp_valid_session() {
        let session_json = r#"{"clientId": "abc123", "serverToken": "xyz789"}"#;
        let credentials = HashMap::from([("sessionData".to_string(), session_json.to_string())]);

        let result = validate_whatsapp(credentials).await.unwrap();
        assert!(result.valid);
        assert_eq!(
            result.metadata.as_ref().unwrap().get("status"),
            Some(&"paired".to_string())
        );
    }

    #[tokio::test]
    async fn test_validate_whatsapp_invalid_json() {
        let credentials = HashMap::from([("sessionData".to_string(), "not-json".to_string())]);

        let result = validate_whatsapp(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("Invalid session data"));
    }

    #[tokio::test]
    async fn test_validate_signal_valid_device() {
        let device_json = r#"{"deviceId": 1, "registrationId": 12345}"#;
        let credentials = HashMap::from([("deviceData".to_string(), device_json.to_string())]);

        let result = validate_signal(credentials).await.unwrap();
        assert!(result.valid);
        assert_eq!(
            result.metadata.as_ref().unwrap().get("status"),
            Some(&"linked".to_string())
        );
    }

    #[tokio::test]
    async fn test_validate_signal_invalid_json() {
        let credentials = HashMap::from([("deviceData".to_string(), "invalid".to_string())]);

        let result = validate_signal(credentials).await.unwrap();
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("Invalid device data"));
    }
}
