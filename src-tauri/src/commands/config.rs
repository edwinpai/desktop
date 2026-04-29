// Desktop Configuration Management (Phase 3/4)
//
// Handles persistent configuration storage using Tauri fs API.
// Config location: ~/.edwinpai/desktop-config.json
//
// Configuration includes:
// - Gateway settings (port, auto-start)
// - mDNS settings (enabled, service name)
// - UI preferences (theme, window position)
// - Subscription cache settings

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Desktop application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopConfig {
    pub version: String,
    #[serde(default)]
    pub mode: OperatingMode,
    pub gateway: GatewayConfig,
    pub mdns: MdnsConfig,
    pub ui: UiConfig,
    pub subscription: SubscriptionConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_client_session: Option<ClientSessionConfig>,
}

/// Operating mode (gateway or client)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OperatingMode {
    /// Local EdwinPAI instance (default)
    Gateway,
    /// Connected to remote gateway
    Client,
}

impl Default for OperatingMode {
    fn default() -> Self {
        Self::Gateway
    }
}

/// Client session configuration for reconnection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientSessionConfig {
    /// Gateway's compressed secp256k1 public key (hex, 66 chars)
    pub gateway_pubkey: String,
    /// Gateway network address (IP:port or hostname:port)
    pub gateway_address: String,
    /// Gateway petname (BRC-42 derived or custom)
    pub gateway_petname: String,
    /// UTC timestamp when connection was established (ISO 8601)
    pub connected_at: String,
    /// Permission level for this session
    pub permission: String, // "owner" | "member" | "guest"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub port: u16,
    pub auto_start: bool,
    pub auto_restart: bool,
    pub max_restarts: u32,
    pub health_check_interval_ms: u64,
    pub log_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsConfig {
    pub enabled: bool,
    pub service_name: Option<String>,
    pub advertise_on_startup: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiConfig {
    pub theme: String, // "light", "dark", "system"
    pub minimize_to_tray: bool,
    pub start_minimized: bool,
    pub window_width: u32,
    pub window_height: u32,
    pub window_x: Option<i32>,
    pub window_y: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionConfig {
    pub cache_ttl_seconds: u64,
    pub check_on_startup: bool,
    pub auto_renew_reminder_days: u32,
}

impl Default for DesktopConfig {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            mode: OperatingMode::default(),
            gateway: GatewayConfig {
                port: 18789,
                auto_start: true,
                auto_restart: true,
                max_restarts: 5,
                health_check_interval_ms: 30_000,
                log_level: "info".to_string(),
            },
            mdns: MdnsConfig {
                enabled: true,
                service_name: None, // Will use hostname-based default
                advertise_on_startup: true,
            },
            ui: UiConfig {
                theme: "system".to_string(),
                minimize_to_tray: true,
                start_minimized: false,
                window_width: 1200,
                window_height: 800,
                window_x: None,
                window_y: None,
            },
            subscription: SubscriptionConfig {
                cache_ttl_seconds: 3600, // 1 hour
                check_on_startup: true,
                auto_renew_reminder_days: 7,
            },
            last_client_session: None,
        }
    }
}

/// Configuration manager with file-based persistence
#[derive(Clone)]
pub struct ConfigManager {
    config: Arc<Mutex<DesktopConfig>>,
    config_path: PathBuf,
}

impl ConfigManager {
    /// Create a new config manager
    pub fn new() -> Result<Self, String> {
        let config_path = Self::get_config_path()?;
        let config = Arc::new(Mutex::new(DesktopConfig::default()));

        Ok(Self {
            config,
            config_path,
        })
    }

    /// Get config file path: ~/.edwinpai/desktop-config.json
    fn get_config_path() -> Result<PathBuf, String> {
        let home_dir = dirs::home_dir()
            .ok_or("Failed to determine home directory")?;

        let config_dir = home_dir.join(".edwinpai");
        Ok(config_dir.join("desktop-config.json"))
    }

    /// Load configuration from file
    pub async fn load(&self) -> Result<DesktopConfig, String> {
        use tokio::fs;

        // Check if config file exists
        if !self.config_path.exists() {
            // Return default config if file doesn't exist
            return Ok(DesktopConfig::default());
        }

        // Read config file
        let contents = fs::read_to_string(&self.config_path)
            .await
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        // Parse JSON
        let config: DesktopConfig = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse config JSON: {}", e))?;

        // Update in-memory config
        {
            let mut config_lock = self.config.lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            *config_lock = config.clone();
        }

        Ok(config)
    }

    /// Save configuration to file
    pub async fn save(&self, config: DesktopConfig) -> Result<(), String> {
        use tokio::fs;

        // Ensure config directory exists
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        // Serialize config to JSON (pretty-printed)
        let json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        // Write to file
        fs::write(&self.config_path, json)
            .await
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        // Update in-memory config
        {
            let mut config_lock = self.config.lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            *config_lock = config;
        }

        Ok(())
    }

    /// Get current configuration
    pub fn get(&self) -> Result<DesktopConfig, String> {
        let config = self.config.lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        Ok(config.clone())
    }

}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new().expect("Failed to create config manager")
    }
}

/// Global config manager instance
static CONFIG_MANAGER: once_cell::sync::Lazy<Arc<Mutex<Option<ConfigManager>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Initialize global config manager
pub fn init_config_manager() -> Result<(), String> {
    let mut manager_lock = CONFIG_MANAGER.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let manager = ConfigManager::new()?;
    *manager_lock = Some(manager);

    Ok(())
}


// ============================================================================
// Tauri Commands
// ============================================================================

/// Get current configuration
#[tauri::command]
pub async fn get_config() -> Result<DesktopConfig, String> {
    // Clone manager to avoid holding lock across await
    let manager = {
        let manager_lock = CONFIG_MANAGER.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("Config manager not initialized")?
            .clone()
    };

    // Try to load from file first
    match manager.load().await {
        Ok(config) => Ok(config),
        Err(_) => {
            // Fall back to in-memory config
            manager.get()
        }
    }
}

/// Save configuration to file
#[tauri::command]
pub async fn save_config(config: DesktopConfig) -> Result<(), String> {
    // Clone manager to avoid holding lock across await
    let manager = {
        let manager_lock = CONFIG_MANAGER.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("Config manager not initialized")?
            .clone()
    };

    manager.save(config).await
}

/// Get config file path
#[tauri::command]
pub async fn get_config_path() -> Result<String, String> {
    let path = ConfigManager::get_config_path()?;
    Ok(path.to_string_lossy().to_string())
}

/// Reset configuration to defaults
#[tauri::command]
pub async fn reset_config() -> Result<DesktopConfig, String> {
    let config = DesktopConfig::default();
    save_config(config.clone()).await?;
    Ok(config)
}

/// Set operating mode (gateway or client)
#[tauri::command]
pub async fn set_mode(mode: OperatingMode) -> Result<DesktopConfig, String> {
    // Get current config
    let mut config = get_config().await?;

    // Update mode
    config.mode = mode;

    // Save updated config
    save_config(config.clone()).await?;

    Ok(config)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = DesktopConfig::default();
        assert_eq!(config.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(config.gateway.port, 18789);
        assert_eq!(config.gateway.auto_start, true);
        assert_eq!(config.mdns.enabled, true);
        assert_eq!(config.ui.theme, "system");
        assert_eq!(config.ui.minimize_to_tray, true);
    }

    #[test]
    fn test_config_serialization() {
        let config = DesktopConfig::default();
        let json = serde_json::to_string(&config).unwrap();

        assert!(json.contains(&format!("\"version\":\"{}\"", env!("CARGO_PKG_VERSION"))));
        assert!(json.contains("\"port\":18789"));
        assert!(json.contains("\"autoStart\":true"));
    }

    #[test]
    fn test_config_deserialization() {
        let json = format!(r#"{{
            "version": "{}",
            "gateway": {{
                "port": 18789,
                "autoStart": true,
                "autoRestart": true,
                "maxRestarts": 5,
                "healthCheckIntervalMs": 30000,
                "logLevel": "info"
            }},
            "mdns": {{
                "enabled": true,
                "serviceName": null,
                "advertiseOnStartup": true
            }},
            "ui": {{
                "theme": "dark",
                "minimizeToTray": true,
                "startMinimized": false,
                "windowWidth": 1200,
                "windowHeight": 800,
                "windowX": null,
                "windowY": null
            }},
            "subscription": {{
                "cacheTtlSeconds": 3600,
                "checkOnStartup": true,
                "autoRenewReminderDays": 7
            }}
        }}"#, env!("CARGO_PKG_VERSION"));

        let config: DesktopConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.ui.theme, "dark");
        assert_eq!(config.gateway.port, 18789);
    }

    #[test]
    fn test_config_manager_creation() {
        let manager = ConfigManager::new();
        assert!(manager.is_ok());

        let manager = manager.unwrap();
        let config = manager.get().unwrap();
        assert_eq!(config.version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn test_config_path_format() {
        let path = ConfigManager::get_config_path().unwrap();
        let path_str = path.to_string_lossy();

        assert!(path_str.contains(".edwinpai"));
        assert!(path_str.ends_with("desktop-config.json"));
    }

    #[tokio::test]
    async fn test_save_and_load_config() {
        let manager = ConfigManager::new().unwrap();

        let mut config = DesktopConfig::default();
        config.gateway.port = 4000;
        config.ui.theme = "dark".to_string();

        // Save config
        let save_result = manager.save(config.clone()).await;
        assert!(save_result.is_ok());

        // Load config
        let loaded_config = manager.load().await.unwrap();
        assert_eq!(loaded_config.gateway.port, 4000);
        assert_eq!(loaded_config.ui.theme, "dark");

        // Clean up test config file
        let _ = tokio::fs::remove_file(&manager.config_path).await;
    }

    // ========================================================================
    // Additional Tests: Filesystem Reads/Writes with Tempfile
    // ========================================================================

    use std::fs;

    #[tokio::test]
    async fn test_save_creates_directory_if_missing() {
        // Create a temporary directory for testing
        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", uuid::Uuid::new_v4()));

        // Create a config manager with custom path
        let manager = ConfigManager {
            config: Arc::new(Mutex::new(DesktopConfig::default())),
            config_path: temp_dir.join(".edwinpai").join("desktop-config.json"),
        };

        let config = DesktopConfig::default();

        // Directory doesn't exist yet
        assert!(!manager.config_path.parent().unwrap().exists());

        // Save should create directory
        let result = manager.save(config).await;
        assert!(result.is_ok());

        // Directory should now exist
        assert!(manager.config_path.parent().unwrap().exists());

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_load_nonexistent_file_returns_default() {
        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", uuid::Uuid::new_v4()));

        let manager = ConfigManager {
            config: Arc::new(Mutex::new(DesktopConfig::default())),
            config_path: temp_dir.join("nonexistent.json"),
        };

        // Load should return default config when file doesn't exist
        let result = manager.load().await;
        assert!(result.is_ok());

        let config = result.unwrap();
        assert_eq!(config.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(config.gateway.port, 18789);
    }

    #[tokio::test]
    async fn test_load_corrupted_file_returns_error() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let config_path = temp_dir.join("corrupted.json");

        // Write invalid JSON
        fs::write(&config_path, b"{ invalid json }").await.unwrap();

        let manager = ConfigManager {
            config: Arc::new(Mutex::new(DesktopConfig::default())),
            config_path: config_path.clone(),
        };

        // Load should fail with parse error
        let result = manager.load().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("parse"));

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }

    #[tokio::test]
    async fn test_save_overwrites_existing_file() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let config_path = temp_dir.join("config.json");

        let manager = ConfigManager {
            config: Arc::new(Mutex::new(DesktopConfig::default())),
            config_path: config_path.clone(),
        };

        // Save first config
        let mut config1 = DesktopConfig::default();
        config1.gateway.port = 18789;
        manager.save(config1).await.unwrap();

        // Save second config (overwrite)
        let mut config2 = DesktopConfig::default();
        config2.gateway.port = 4000;
        manager.save(config2).await.unwrap();

        // Load should return the second config
        let loaded = manager.load().await.unwrap();
        assert_eq!(loaded.gateway.port, 4000);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }

    #[tokio::test]
    async fn test_concurrent_save_operations() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let config_path = temp_dir.join("concurrent.json");

        let manager = Arc::new(ConfigManager {
            config: Arc::new(Mutex::new(DesktopConfig::default())),
            config_path: config_path.clone(),
        });

        // Spawn multiple concurrent save operations
        let mut handles = vec![];

        for i in 0..5 {
            let manager_clone = Arc::clone(&manager);
            let handle = tokio::spawn(async move {
                let mut config = DesktopConfig::default();
                config.gateway.port = 18789 + i;
                manager_clone.save(config).await
            });
            handles.push(handle);
        }

        // Wait for all operations to complete
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // File should exist and be valid
        assert!(config_path.exists());
        let loaded = manager.load().await.unwrap();
        // Port should be one of the saved values
        assert!(loaded.gateway.port >= 18789 && loaded.gateway.port < 18794);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }

    #[tokio::test]
    async fn test_save_preserves_json_structure() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let config_path = temp_dir.join("structure.json");

        let manager = ConfigManager {
            config: Arc::new(Mutex::new(DesktopConfig::default())),
            config_path: config_path.clone(),
        };

        let config = DesktopConfig::default();
        manager.save(config).await.unwrap();

        // Read raw JSON and verify structure
        let json_str = fs::read_to_string(&config_path).await.unwrap();

        assert!(json_str.contains("\"version\":"));
        assert!(json_str.contains("\"gateway\":"));
        assert!(json_str.contains("\"mdns\":"));
        assert!(json_str.contains("\"ui\":"));
        assert!(json_str.contains("\"subscription\":"));
        assert!(json_str.contains("\"port\":"));
        assert!(json_str.contains("\"autoStart\":"));

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }

    #[tokio::test]
    async fn test_load_updates_in_memory_config() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let config_path = temp_dir.join("memory.json");

        let manager = ConfigManager {
            config: Arc::new(Mutex::new(DesktopConfig::default())),
            config_path: config_path.clone(),
        };

        // Save a config with specific values
        let mut config = DesktopConfig::default();
        config.gateway.port = 5000;
        manager.save(config).await.unwrap();

        // Load should update in-memory config
        let loaded = manager.load().await.unwrap();
        assert_eq!(loaded.gateway.port, 5000);

        // Get should return the same values
        let from_get = manager.get().unwrap();
        assert_eq!(from_get.gateway.port, 5000);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }

    #[test]
    fn test_gateway_config_creation() {
        let config = GatewayConfig {
            port: 18789,
            auto_start: true,
            auto_restart: true,
            max_restarts: 5,
            health_check_interval_ms: 30_000,
            log_level: "info".to_string(),
        };
        assert_eq!(config.port, 18789);
        assert_eq!(config.auto_start, true);
        assert_eq!(config.auto_restart, true);
        assert_eq!(config.max_restarts, 5);
        assert_eq!(config.health_check_interval_ms, 30_000);
        assert_eq!(config.log_level, "info");
    }

    #[test]
    fn test_ui_config_creation() {
        let ui = UiConfig {
            theme: "system".to_string(),
            minimize_to_tray: true,
            start_minimized: false,
            window_width: 1200,
            window_height: 800,
            window_x: None,
            window_y: None,
        };
        assert_eq!(ui.theme, "system");
        assert_eq!(ui.minimize_to_tray, true);
        assert_eq!(ui.start_minimized, false);
        assert_eq!(ui.window_width, 1200);
        assert_eq!(ui.window_height, 800);
        assert!(ui.window_x.is_none());
        assert!(ui.window_y.is_none());
    }

    #[test]
    fn test_operating_mode_default() {
        let mode = OperatingMode::default();
        assert_eq!(mode, OperatingMode::Gateway);
    }

    #[test]
    fn test_operating_mode_serialization() {
        let gateway = OperatingMode::Gateway;
        let client = OperatingMode::Client;

        let gateway_json = serde_json::to_string(&gateway).unwrap();
        let client_json = serde_json::to_string(&client).unwrap();

        assert_eq!(gateway_json, "\"gateway\"");
        assert_eq!(client_json, "\"client\"");
    }

    #[tokio::test]
    async fn test_set_mode_command() {
        // Initialize config manager
        init_config_manager().unwrap();

        // Default mode should be Gateway
        let config = get_config().await.unwrap();
        assert_eq!(config.mode, OperatingMode::Gateway);

        // Switch to Client mode
        let updated = set_mode(OperatingMode::Client).await.unwrap();
        assert_eq!(updated.mode, OperatingMode::Client);

        // Verify persistence
        let reloaded = get_config().await.unwrap();
        assert_eq!(reloaded.mode, OperatingMode::Client);

        // Switch back to Gateway mode
        let updated2 = set_mode(OperatingMode::Gateway).await.unwrap();
        assert_eq!(updated2.mode, OperatingMode::Gateway);

        // Clean up
        let _ = reset_config().await;
    }

    #[tokio::test]
    async fn test_client_session_config_persistence() {
        init_config_manager().unwrap();

        let mut config = get_config().await.unwrap();
        config.mode = OperatingMode::Client;
        config.last_client_session = Some(ClientSessionConfig {
            gateway_pubkey: "03abc123...".to_string(),
            gateway_address: "192.168.1.100:18789".to_string(),
            gateway_petname: "Swift Falcon".to_string(),
            connected_at: "2026-02-11T10:00:00Z".to_string(),
            permission: "member".to_string(),
        });

        save_config(config.clone()).await.unwrap();

        let loaded = get_config().await.unwrap();
        assert_eq!(loaded.mode, OperatingMode::Client);
        assert!(loaded.last_client_session.is_some());

        let session = loaded.last_client_session.unwrap();
        assert_eq!(session.gateway_pubkey, "03abc123...");
        assert_eq!(session.gateway_petname, "Swift Falcon");
        assert_eq!(session.permission, "member");

        // Clean up
        let _ = reset_config().await;
    }

    // Add uuid to Cargo.toml for test uniqueness
    // Note: This assumes uuid crate is available or we use a different approach
    // For now, using a simple timestamp-based approach instead
    mod uuid {
        pub struct Uuid;
        impl Uuid {
            pub fn new_v4() -> String {
                format!("{}", std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos())
            }
        }
    }
}
