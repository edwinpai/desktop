// Channel Configuration Storage (SPEC §9.8)
//
// Manages CRUD operations for channel configurations with JSON persistence.
// Config files are stored in ~/.edwinpai/channels/<channel_name>.json

use crate::channel_domain::encryption::{decrypt_credentials, encrypt_credentials};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Channel name enum matching SPEC §9.8
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChannelName {
    WhatsApp,
    Telegram,
    Matrix,
    Discord,
    Slack,
    Signal,
}

impl ChannelName {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChannelName::WhatsApp => "whatsapp",
            ChannelName::Telegram => "telegram",
            ChannelName::Matrix => "matrix",
            ChannelName::Discord => "discord",
            ChannelName::Slack => "slack",
            ChannelName::Signal => "signal",
        }
    }
}

impl std::str::FromStr for ChannelName {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "whatsapp" => Ok(ChannelName::WhatsApp),
            "telegram" => Ok(ChannelName::Telegram),
            "matrix" => Ok(ChannelName::Matrix),
            "discord" => Ok(ChannelName::Discord),
            "slack" => Ok(ChannelName::Slack),
            "signal" => Ok(ChannelName::Signal),
            _ => Err(format!("Unknown channel: {}", s)),
        }
    }
}

/// Per-channel settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelSettings {
    pub auto_reply: bool,
    pub allowed_chat_ids: Vec<String>,
}

impl Default for ChannelSettings {
    fn default() -> Self {
        Self {
            auto_reply: true,
            allowed_chat_ids: Vec::new(),
        }
    }
}

/// Channel configuration (persisted to disk)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelConfig {
    pub channel: ChannelName,
    pub enabled: bool,
    pub configured_at: String, // ISO 8601 timestamp
    pub configured_by: String, // Public key
    pub credentials: HashMap<String, String>, // Encrypted credentials (hex)
    pub settings: ChannelSettings,
}

/// Channel configuration with decrypted credentials (in-memory only)
#[derive(Debug, Clone)]
pub struct DecryptedChannelConfig {
    pub channel: ChannelName,
    pub enabled: bool,
    pub configured_at: String,
    pub configured_by: String,
    pub credentials: HashMap<String, String>, // Plaintext credentials
    pub settings: ChannelSettings,
}

/// Returns the channels directory path (~/.edwinpai/channels/)
pub fn get_channels_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home_dir.join(".edwinpai").join("channels"))
}

/// Ensures the channels directory exists
fn ensure_channels_dir() -> Result<PathBuf, String> {
    let channels_dir = get_channels_dir()?;
    fs::create_dir_all(&channels_dir)
        .map_err(|e| format!("Failed to create channels directory: {}", e))?;
    Ok(channels_dir)
}

/// Returns the config file path for a specific channel
fn get_config_path(channel: ChannelName) -> Result<PathBuf, String> {
    let channels_dir = ensure_channels_dir()?;
    Ok(channels_dir.join(format!("{}.json", channel.as_str())))
}

/// Creates a new channel configuration
///
/// # Arguments
/// * `channel` - Channel to configure
/// * `configured_by` - Public key of the user configuring this channel
/// * `plaintext_credentials` - Map of credential field names → plaintext values
/// * `settings` - Per-channel settings
///
/// # Returns
/// The created configuration (with encrypted credentials)
pub async fn create_channel(
    channel: ChannelName,
    configured_by: String,
    plaintext_credentials: HashMap<String, String>,
    settings: ChannelSettings,
) -> Result<ChannelConfig, String> {
    let config_path = get_config_path(channel)?;

    // Check if config already exists
    if config_path.exists() {
        return Err(format!("Channel {} is already configured", channel.as_str()));
    }

    // Encrypt credentials
    let encrypted_credentials =
        encrypt_credentials(channel.as_str(), plaintext_credentials, None).await?;

    // Create config
    let config = ChannelConfig {
        channel,
        enabled: true,
        configured_at: chrono::Utc::now().to_rfc3339(),
        configured_by,
        credentials: encrypted_credentials,
        settings,
    };

    // Write to disk (atomic write: tmp file + rename)
    write_config_atomic(&config_path, &config)?;

    Ok(config)
}

/// Reads a channel configuration from disk
pub fn read_channel(channel: ChannelName) -> Result<ChannelConfig, String> {
    let config_path = get_config_path(channel)?;

    if !config_path.exists() {
        return Err(format!("Channel {} is not configured", channel.as_str()));
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let config: ChannelConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(config)
}

/// Reads a channel configuration and decrypts its credentials
pub async fn read_channel_decrypted(
    channel: ChannelName,
) -> Result<DecryptedChannelConfig, String> {
    let config = read_channel(channel)?;

    // Decrypt credentials
    let plaintext_credentials =
        decrypt_credentials(channel.as_str(), config.credentials, None).await?;

    Ok(DecryptedChannelConfig {
        channel: config.channel,
        enabled: config.enabled,
        configured_at: config.configured_at,
        configured_by: config.configured_by,
        credentials: plaintext_credentials,
        settings: config.settings,
    })
}

/// Updates an existing channel configuration
pub async fn update_channel(
    channel: ChannelName,
    enabled: Option<bool>,
    plaintext_credentials: Option<HashMap<String, String>>,
    settings: Option<ChannelSettings>,
) -> Result<ChannelConfig, String> {
    let mut config = read_channel(channel)?;

    // Update fields
    if let Some(enabled) = enabled {
        config.enabled = enabled;
    }

    if let Some(creds) = plaintext_credentials {
        config.credentials = encrypt_credentials(channel.as_str(), creds, None).await?;
    }

    if let Some(settings) = settings {
        config.settings = settings;
    }

    // Write to disk
    let config_path = get_config_path(channel)?;
    write_config_atomic(&config_path, &config)?;

    Ok(config)
}

/// Deletes a channel configuration
pub fn delete_channel(channel: ChannelName) -> Result<(), String> {
    let config_path = get_config_path(channel)?;

    if !config_path.exists() {
        return Err(format!("Channel {} is not configured", channel.as_str()));
    }

    fs::remove_file(&config_path).map_err(|e| format!("Failed to delete config: {}", e))?;

    Ok(())
}

/// Lists all configured channels
pub fn list_channels() -> Result<Vec<ChannelConfig>, String> {
    let channels_dir = get_channels_dir()?;

    if !channels_dir.exists() {
        return Ok(Vec::new());
    }

    let mut configs = Vec::new();

    let entries = fs::read_dir(&channels_dir)
        .map_err(|e| format!("Failed to read channels directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read {:?}: {}", path, e))?;

            let config: ChannelConfig = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse {:?}: {}", path, e))?;

            configs.push(config);
        }
    }

    Ok(configs)
}

/// Atomic write: write to temp file, then rename
fn write_config_atomic(path: &PathBuf, config: &ChannelConfig) -> Result<(), String> {
    let tmp_path = path.with_extension("json.tmp");

    // Write to temp file
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&tmp_path, json).map_err(|e| format!("Failed to write temp file: {}", e))?;

    // Rename to final path (atomic on Unix/Windows)
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Once;

    static INIT: Once = Once::new();

    fn setup() {
        INIT.call_once(|| {
            // Create test channels directory if needed
            let _ = ensure_channels_dir();
        });
    }

    #[test]
    fn test_channel_name_as_str() {
        assert_eq!(ChannelName::WhatsApp.as_str(), "whatsapp");
        assert_eq!(ChannelName::Telegram.as_str(), "telegram");
        assert_eq!(ChannelName::Matrix.as_str(), "matrix");
        assert_eq!(ChannelName::Discord.as_str(), "discord");
        assert_eq!(ChannelName::Slack.as_str(), "slack");
        assert_eq!(ChannelName::Signal.as_str(), "signal");
    }

    #[test]
    fn test_channel_name_from_str() {
        use std::str::FromStr;

        assert_eq!(ChannelName::from_str("whatsapp").unwrap(), ChannelName::WhatsApp);
        assert_eq!(ChannelName::from_str("telegram").unwrap(), ChannelName::Telegram);
        assert_eq!(ChannelName::from_str("MATRIX").unwrap(), ChannelName::Matrix);
        assert!(ChannelName::from_str("unknown").is_err());
    }

    #[test]
    fn test_channel_settings_default() {
        let settings = ChannelSettings::default();
        assert_eq!(settings.auto_reply, true);
        assert_eq!(settings.allowed_chat_ids.len(), 0);
    }

    #[test]
    fn test_channel_config_serialization() {
        let config = ChannelConfig {
            channel: ChannelName::Telegram,
            enabled: true,
            configured_at: "2026-02-11T10:00:00Z".to_string(),
            configured_by: "02abc123".to_string(),
            credentials: HashMap::from([("botToken".to_string(), "encrypted_hex".to_string())]),
            settings: ChannelSettings::default(),
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("telegram"));
        assert!(json.contains("botToken"));

        let deserialized: ChannelConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.channel, ChannelName::Telegram);
        assert_eq!(deserialized.enabled, true);
    }

    #[test]
    fn test_get_channels_dir() {
        let channels_dir = get_channels_dir().unwrap();
        assert!(channels_dir.to_string_lossy().contains(".edwinpai"));
        assert!(channels_dir.to_string_lossy().contains("channels"));
    }

    #[test]
    fn test_ensure_channels_dir_creates_directory() {
        let channels_dir = ensure_channels_dir().unwrap();
        assert!(channels_dir.exists());
        assert!(channels_dir.is_dir());
    }

    #[tokio::test]
    #[ignore]
    async fn test_create_channel() {
        setup();

        let channel = ChannelName::Telegram;
        let configured_by = "02test123".to_string();
        let credentials = HashMap::from([("botToken".to_string(), "123456:ABC-DEF".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up any existing config
        let _ = delete_channel(channel);

        let config = create_channel(channel, configured_by.clone(), credentials, settings)
            .await
            .expect("Should create channel");

        assert_eq!(config.channel, channel);
        assert_eq!(config.enabled, true);
        assert_eq!(config.configured_by, configured_by);
        assert!(config.credentials.contains_key("botToken"));

        // Clean up
        let _ = delete_channel(channel);
    }

    #[tokio::test]
    #[ignore]
    async fn test_create_channel_duplicate_fails() {
        setup();

        let channel = ChannelName::WhatsApp;
        let configured_by = "02test456".to_string();
        let credentials = HashMap::from([("token".to_string(), "secret".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel(channel);

        // First creation should succeed
        create_channel(
            channel,
            configured_by.clone(),
            credentials.clone(),
            settings.clone(),
        )
        .await
        .expect("First creation should succeed");

        // Second creation should fail
        let result = create_channel(channel, configured_by, credentials, settings).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already configured"));

        // Clean up
        let _ = delete_channel(channel);
    }

    #[tokio::test]
    #[ignore]
    async fn test_read_channel() {
        setup();

        let channel = ChannelName::Matrix;
        let configured_by = "02test789".to_string();
        let credentials = HashMap::from([("accessToken".to_string(), "syt_abc".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel(channel);

        // Create channel
        create_channel(channel, configured_by.clone(), credentials, settings)
            .await
            .expect("Should create channel");

        // Read channel
        let config = read_channel(channel).expect("Should read channel");
        assert_eq!(config.channel, channel);
        assert_eq!(config.configured_by, configured_by);

        // Clean up
        let _ = delete_channel(channel);
    }

    #[tokio::test]
    #[ignore]
    async fn test_read_channel_decrypted() {
        setup();

        let channel = ChannelName::Discord;
        let configured_by = "02testABC".to_string();
        let original_credentials =
            HashMap::from([("botToken".to_string(), "my-discord-token".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel(channel);

        // Create channel
        create_channel(
            channel,
            configured_by.clone(),
            original_credentials.clone(),
            settings,
        )
        .await
        .expect("Should create channel");

        // Read decrypted
        let decrypted_config = read_channel_decrypted(channel)
            .await
            .expect("Should read and decrypt");

        assert_eq!(decrypted_config.credentials, original_credentials);

        // Clean up
        let _ = delete_channel(channel);
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_channel_enabled() {
        setup();

        let channel = ChannelName::Slack;
        let configured_by = "02testDEF".to_string();
        let credentials = HashMap::from([("apiKey".to_string(), "sk-123".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel(channel);

        // Create channel
        create_channel(channel, configured_by, credentials, settings)
            .await
            .expect("Should create channel");

        // Update enabled to false
        let updated = update_channel(channel, Some(false), None, None)
            .await
            .expect("Should update channel");

        assert_eq!(updated.enabled, false);

        // Clean up
        let _ = delete_channel(channel);
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_channel_credentials() {
        setup();

        let channel = ChannelName::Signal;
        let configured_by = "02testGHI".to_string();
        let old_credentials = HashMap::from([("oldToken".to_string(), "old".to_string())]);
        let new_credentials = HashMap::from([("newToken".to_string(), "new".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel(channel);

        // Create channel
        create_channel(channel, configured_by, old_credentials, settings)
            .await
            .expect("Should create channel");

        // Update credentials
        update_channel(channel, None, Some(new_credentials.clone()), None)
            .await
            .expect("Should update credentials");

        // Verify new credentials
        let decrypted = read_channel_decrypted(channel)
            .await
            .expect("Should read");
        assert_eq!(decrypted.credentials, new_credentials);

        // Clean up
        let _ = delete_channel(channel);
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_channel_settings() {
        setup();

        let channel = ChannelName::Telegram;
        let configured_by = "02testJKL".to_string();
        let credentials = HashMap::from([("botToken".to_string(), "token".to_string())]);
        let old_settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel(channel);

        // Create channel
        create_channel(channel, configured_by, credentials, old_settings)
            .await
            .expect("Should create channel");

        // Update settings
        let new_settings = ChannelSettings {
            auto_reply: false,
            allowed_chat_ids: vec!["123".to_string(), "456".to_string()],
        };

        update_channel(channel, None, None, Some(new_settings.clone()))
            .await
            .expect("Should update settings");

        // Verify new settings
        let config = read_channel(channel).expect("Should read");
        assert_eq!(config.settings.auto_reply, false);
        assert_eq!(config.settings.allowed_chat_ids.len(), 2);

        // Clean up
        let _ = delete_channel(channel);
    }

    #[tokio::test]
    #[ignore]
    async fn test_delete_channel() {
        setup();

        let channel = ChannelName::Matrix;
        let configured_by = "02testMNO".to_string();
        let credentials = HashMap::from([("token".to_string(), "test".to_string())]);
        let settings = ChannelSettings::default();

        // Clean up
        let _ = delete_channel(channel);

        // Create channel
        create_channel(channel, configured_by, credentials, settings)
            .await
            .expect("Should create channel");

        // Verify it exists
        assert!(read_channel(channel).is_ok());

        // Delete channel
        delete_channel(channel).expect("Should delete channel");

        // Verify it's gone
        assert!(read_channel(channel).is_err());
    }

    #[tokio::test]
    #[ignore]
    async fn test_list_channels() {
        setup();

        // Clean up all channels
        for channel in [
            ChannelName::WhatsApp,
            ChannelName::Telegram,
            ChannelName::Matrix,
        ] {
            let _ = delete_channel(channel);
        }

        // Create 3 channels
        for (i, channel) in [
            ChannelName::WhatsApp,
            ChannelName::Telegram,
            ChannelName::Matrix,
        ]
        .iter()
        .enumerate()
        {
            let configured_by = format!("02test{}", i);
            let credentials = HashMap::from([("token".to_string(), format!("token{}", i))]);
            let settings = ChannelSettings::default();

            create_channel(*channel, configured_by, credentials, settings)
                .await
                .expect("Should create channel");
        }

        // List channels
        let channels = list_channels().expect("Should list channels");
        assert!(channels.len() >= 3);

        // Clean up
        for channel in [
            ChannelName::WhatsApp,
            ChannelName::Telegram,
            ChannelName::Matrix,
        ] {
            let _ = delete_channel(channel);
        }
    }
}
