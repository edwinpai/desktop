// Configuration Types (Phase 7)
//
// Complete type definitions for EdwinPAI Desktop configuration system.
// Includes gateway settings, memory settings, identity config, and UI preferences.

use serde::{Deserialize, Serialize};

// Re-export types from commands/config.rs for backward compatibility
use crate::commands::config::{
    OperatingMode, ClientSessionConfig, UiConfig, MdnsConfig, SubscriptionConfig,
};

/// EdwinPAI Desktop complete configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EdwinPAIConfig {
    /// Config schema version (for migration)
    pub version: String,

    /// Gateway settings
    pub gateway: GatewayConfig,

    /// AI memory settings
    pub memory: MemoryConfig,

    /// User identity settings
    pub identity: IdentityConfig,

    /// UI preferences
    pub ui: UiConfig,

    /// Operating mode
    #[serde(default)]
    pub mode: OperatingMode,

    /// Last client session (for reconnection)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_client_session: Option<ClientSessionConfig>,
}

impl Default for EdwinPAIConfig {
    fn default() -> Self {
        Self {
            version: "1.0.0".to_string(),
            gateway: GatewayConfig::default(),
            memory: MemoryConfig::default(),
            identity: IdentityConfig::default(),
            ui: UiConfig::default(),
            mode: OperatingMode::default(),
            last_client_session: None,
        }
    }
}

/// Gateway process and server settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    /// HTTP server port
    pub port: u16,

    /// Auto-start gateway on app launch
    pub auto_start: bool,

    /// Auto-restart gateway on crash
    pub auto_restart: bool,

    /// Max restart attempts before giving up
    pub max_restarts: u32,

    /// Health check interval (milliseconds)
    pub health_check_interval_ms: u64,

    /// Health check timeout (milliseconds)
    pub health_check_timeout_ms: u64,

    /// Log level (trace, debug, info, warn, error)
    pub log_level: String,

    /// AI provider settings
    pub ai_provider: AiProviderConfig,

    /// mDNS settings
    pub mdns: MdnsConfig,

    /// Subscription settings
    pub subscription: SubscriptionConfig,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            port: 18789,
            auto_start: true,
            auto_restart: true,
            max_restarts: 5,
            health_check_interval_ms: 30_000,
            health_check_timeout_ms: 5_000,
            log_level: "info".to_string(),
            ai_provider: AiProviderConfig::default(),
            mdns: MdnsConfig {
                enabled: true,
                service_name: None,
                advertise_on_startup: true,
            },
            subscription: SubscriptionConfig {
                cache_ttl_seconds: 3600,
                check_on_startup: true,
                auto_renew_reminder_days: 7,
            },
        }
    }
}

/// AI provider configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    /// Default model identifier
    pub default_model: String,

    /// Temperature (0.0-1.0)
    pub temperature: f64,

    /// Max tokens per response
    pub max_tokens: u32,

    /// Enable streaming responses
    pub enable_streaming: bool,
}

impl Default for AiProviderConfig {
    fn default() -> Self {
        Self {
            default_model: "claude-sonnet-4-5".to_string(),
            temperature: 0.7,
            max_tokens: 4096,
            enable_streaming: true,
        }
    }
}

/// AI memory and context management settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryConfig {
    /// Enable conversation memory
    pub enabled: bool,

    /// Max conversation history messages
    pub max_history_messages: u32,

    /// Context window size (tokens)
    pub context_window_size: u32,

    /// Auto-summarize when context exceeds threshold
    pub auto_summarize: bool,

    /// Summarization threshold (0.0-1.0, fraction of context window)
    pub summarization_threshold: f64,

    /// Persist conversations to disk
    pub persist_conversations: bool,

    /// Conversation retention days (0 = forever)
    pub retention_days: u32,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_history_messages: 100,
            context_window_size: 200_000, // Claude Sonnet 4.5 context
            auto_summarize: true,
            summarization_threshold: 0.8, // Summarize at 80% full
            persist_conversations: true,
            retention_days: 30,
        }
    }
}

/// User identity and subscription settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IdentityConfig {
    /// User's compressed public key (66 hex chars)
    /// NOTE: Private key NEVER leaves OS keychain
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_key: Option<String>,

    /// User's petname (BRC-42 derived or custom)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub petname: Option<String>,

    /// Subscription UTXO (if active)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_utxo: Option<SubscriptionUtxo>,

    /// Subscription cache TTL (seconds)
    pub subscription_cache_ttl: u64,

    /// Check subscription on startup
    pub check_subscription_on_startup: bool,
}

impl Default for IdentityConfig {
    fn default() -> Self {
        Self {
            public_key: None,
            petname: None,
            subscription_utxo: None,
            subscription_cache_ttl: 3600, // 1 hour
            check_subscription_on_startup: true,
        }
    }
}

/// Subscription UTXO reference
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionUtxo {
    /// Transaction ID (64 hex chars)
    pub txid: String,

    /// Output index
    pub vout: u32,
}

/// Config operation result
pub type ConfigResult<T> = Result<T, ConfigError>;

/// Config error types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConfigError {
    /// File I/O error
    FileError {
        path: String,
        message: String,
    },

    /// JSON parsing error
    ParseError {
        line: Option<usize>,
        message: String,
    },

    /// Validation error
    ValidationError {
        field: String,
        message: String,
    },

    /// Migration error
    MigrationError {
        from_version: String,
        to_version: String,
        message: String,
    },

    /// Lock acquisition error
    LockError {
        message: String,
    },
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            ConfigError::FileError { path, message } => {
                write!(f, "File error at {}: {}", path, message)
            }
            ConfigError::ParseError { line, message } => {
                if let Some(line) = line {
                    write!(f, "Parse error at line {}: {}", line, message)
                } else {
                    write!(f, "Parse error: {}", message)
                }
            }
            ConfigError::ValidationError { field, message } => {
                write!(f, "Validation error for {}: {}", field, message)
            }
            ConfigError::MigrationError { from_version, to_version, message } => {
                write!(f, "Migration error ({}→{}): {}", from_version, to_version, message)
            }
            ConfigError::LockError { message } => {
                write!(f, "Lock error: {}", message)
            }
        }
    }
}

impl std::error::Error for ConfigError {}

// ============================================================================
// Migration
// ============================================================================

impl EdwinPAIConfig {
    /// Migrate from DesktopConfig (Phase 3-6) to EdwinPAIConfig (Phase 7)
    pub fn migrate_from_desktop_config(desktop_config: crate::commands::config::DesktopConfig) -> Self {
        Self {
            version: "1.0.0".to_string(),
            gateway: GatewayConfig {
                port: desktop_config.gateway.port,
                auto_start: desktop_config.gateway.auto_start,
                auto_restart: desktop_config.gateway.auto_restart,
                max_restarts: desktop_config.gateway.max_restarts,
                health_check_interval_ms: desktop_config.gateway.health_check_interval_ms,
                health_check_timeout_ms: 5_000, // NEW field
                log_level: desktop_config.gateway.log_level,
                ai_provider: AiProviderConfig::default(), // NEW section
                mdns: desktop_config.mdns,
                subscription: desktop_config.subscription,
            },
            memory: MemoryConfig::default(), // NEW section
            identity: IdentityConfig {
                public_key: None, // Populated from keychain
                petname: None,    // Populated from keychain
                subscription_utxo: None,
                subscription_cache_ttl: desktop_config.subscription.cache_ttl_seconds,
                check_subscription_on_startup: desktop_config.subscription.check_on_startup,
            },
            ui: desktop_config.ui,
            mode: desktop_config.mode,
            last_client_session: desktop_config.last_client_session,
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = EdwinPAIConfig::default();
        assert_eq!(config.version, "1.0.0");
        assert_eq!(config.gateway.port, 18789);
        assert_eq!(config.gateway.auto_start, true);
        assert_eq!(config.gateway.ai_provider.default_model, "claude-sonnet-4-5");
        assert_eq!(config.gateway.ai_provider.temperature, 0.7);
        assert_eq!(config.memory.enabled, true);
        assert_eq!(config.memory.context_window_size, 200_000);
        assert_eq!(config.identity.subscription_cache_ttl, 3600);
    }

    #[test]
    fn test_config_serialization() {
        let config = EdwinPAIConfig::default();
        let json = serde_json::to_string(&config).unwrap();

        assert!(json.contains("\"version\":\"1.0.0\""));
        assert!(json.contains("\"port\":18789"));
        assert!(json.contains("\"defaultModel\":\"claude-sonnet-4-5\""));
        assert!(json.contains("\"contextWindowSize\":200000"));
    }

    #[test]
    fn test_config_deserialization() {
        let json = r#"{
            "version": "1.0.0",
            "gateway": {
                "port": 18789,
                "autoStart": true,
                "autoRestart": true,
                "maxRestarts": 5,
                "healthCheckIntervalMs": 30000,
                "healthCheckTimeoutMs": 5000,
                "logLevel": "info",
                "aiProvider": {
                    "defaultModel": "claude-sonnet-4-5",
                    "temperature": 0.7,
                    "maxTokens": 4096,
                    "enableStreaming": true
                },
                "mdns": {
                    "enabled": true,
                    "serviceName": null,
                    "advertiseOnStartup": true
                },
                "subscription": {
                    "cacheTtlSeconds": 3600,
                    "checkOnStartup": true,
                    "autoRenewReminderDays": 7
                }
            },
            "memory": {
                "enabled": true,
                "maxHistoryMessages": 100,
                "contextWindowSize": 200000,
                "autoSummarize": true,
                "summarizationThreshold": 0.8,
                "persistConversations": true,
                "retentionDays": 30
            },
            "identity": {
                "subscriptionCacheTtl": 3600,
                "checkSubscriptionOnStartup": true
            },
            "ui": {
                "theme": "system",
                "minimizeToTray": true,
                "startMinimized": false,
                "windowWidth": 1200,
                "windowHeight": 800,
                "windowX": null,
                "windowY": null
            },
            "mode": "gateway"
        }"#;

        let config: EdwinPAIConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.version, "1.0.0");
        assert_eq!(config.gateway.port, 18789);
        assert_eq!(config.gateway.ai_provider.temperature, 0.7);
        assert_eq!(config.memory.context_window_size, 200_000);
    }

    #[test]
    fn test_ai_provider_defaults() {
        let config = AiProviderConfig::default();
        assert_eq!(config.default_model, "claude-sonnet-4-5");
        assert_eq!(config.temperature, 0.7);
        assert_eq!(config.max_tokens, 4096);
        assert_eq!(config.enable_streaming, true);
    }

    #[test]
    fn test_memory_config_defaults() {
        let config = MemoryConfig::default();
        assert_eq!(config.enabled, true);
        assert_eq!(config.max_history_messages, 100);
        assert_eq!(config.context_window_size, 200_000);
        assert_eq!(config.auto_summarize, true);
        assert_eq!(config.summarization_threshold, 0.8);
        assert_eq!(config.persist_conversations, true);
        assert_eq!(config.retention_days, 30);
    }

    #[test]
    fn test_identity_config_defaults() {
        let config = IdentityConfig::default();
        assert_eq!(config.public_key, None);
        assert_eq!(config.petname, None);
        assert_eq!(config.subscription_utxo, None);
        assert_eq!(config.subscription_cache_ttl, 3600);
        assert_eq!(config.check_subscription_on_startup, true);
    }

    #[test]
    fn test_subscription_utxo() {
        let utxo = SubscriptionUtxo {
            txid: "abc123".to_string(),
            vout: 0,
        };

        let json = serde_json::to_string(&utxo).unwrap();
        assert!(json.contains("\"txid\":\"abc123\""));
        assert!(json.contains("\"vout\":0"));
    }

    #[test]
    fn test_config_error_display() {
        let error = ConfigError::FileError {
            path: "/path/to/file".to_string(),
            message: "File not found".to_string(),
        };
        assert_eq!(error.to_string(), "File error at /path/to/file: File not found");

        let error = ConfigError::ValidationError {
            field: "gateway.port".to_string(),
            message: "must be between 1 and 65535".to_string(),
        };
        assert_eq!(error.to_string(), "Validation error for gateway.port: must be between 1 and 65535");
    }
}
