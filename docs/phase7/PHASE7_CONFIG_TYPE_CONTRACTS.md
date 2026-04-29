# Phase 7: Configuration Type Contracts

**Document Version**: 1.0.0
**Date**: 2026-02-12
**Phase**: 7 (AI Integration - Configuration Management)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Rust Type Definitions](#2-rust-type-definitions)
3. [TypeScript Type Definitions](#3-typescript-type-definitions)
4. [IPC Command Signatures](#4-ipc-command-signatures)
5. [Configuration File Schemas](#5-configuration-file-schemas)
6. [Type Mapping & Integration](#6-type-mapping--integration)
7. [Validation Rules](#7-validation-rules)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. Executive Summary

This document defines **all type contracts** for EdwinPAI Desktop configuration management, covering:

- **Rust backend types**: `EdwinPAIConfig`, `GatewayConfig`, `MemoryConfig`, `IdentityConfig`
- **TypeScript frontend types**: Config interfaces, IPC request/response types
- **IPC commands**: `get_config`, `update_config`, `validate_config`, `reset_config`
- **Configuration persistence**: JSON schema, validation rules, migration strategy

### Key Files

**Rust**:
- `src-tauri/src/config/types.rs` - Core config structs
- `src-tauri/src/config/manager.rs` - Config persistence logic
- `src-tauri/src/commands/config.rs` - IPC commands (already exists, needs extension)

**TypeScript**:
- `src/types/config.ts` - Frontend config types (NEW)
- `src/types/ipc.ts` - IPC message types (extend existing)
- `src/types/index.ts` - Barrel exports (extend existing)

---

## 2. Rust Type Definitions

### 2.1 Core Configuration Struct

**File**: `src-tauri/src/config/types.rs`

```rust
use serde::{Deserialize, Serialize};

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

    /// UI preferences (inherited from DesktopConfig)
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
```

### 2.2 Gateway Configuration

```rust
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
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            auto_start: true,
            auto_restart: true,
            max_restarts: 5,
            health_check_interval_ms: 30_000,
            health_check_timeout_ms: 5_000,
            log_level: "info".to_string(),
            ai_provider: AiProviderConfig::default(),
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
```

### 2.3 Memory Configuration

```rust
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
```

### 2.4 Identity Configuration

```rust
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
```

### 2.5 Result and Error Types

```rust
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
```

### 2.6 IPC Request/Response Types

```rust
/// Get config IPC request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigRequest {
    // No fields needed
}

/// Get config IPC response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetConfigResponse {
    pub config: EdwinPAIConfig,
}

/// Update config IPC request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfigRequest {
    pub config: EdwinPAIConfig,
}

/// Update config IPC response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfigResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Validate config IPC request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateConfigRequest {
    pub config: EdwinPAIConfig,
}

/// Validate config IPC response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateConfigResponse {
    pub valid: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<ValidationError>,
}

/// Validation error detail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

/// Reset config IPC request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetConfigRequest {
    // No fields needed
}

/// Reset config IPC response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetConfigResponse {
    pub config: EdwinPAIConfig,
}
```

---

## 3. TypeScript Type Definitions

### 3.1 Core Configuration Types

**File**: `src/types/config.ts`

```typescript
/**
 * EdwinPAI Desktop complete configuration
 */
export interface EdwinPAIConfig {
  /** Config schema version */
  version: string;

  /** Gateway settings */
  gateway: GatewayConfig;

  /** AI memory settings */
  memory: MemoryConfig;

  /** User identity settings */
  identity: IdentityConfig;

  /** UI preferences */
  ui: UiConfig;

  /** Operating mode */
  mode: OperatingMode;

  /** Last client session */
  lastClientSession?: ClientSessionConfig;
}

/**
 * Gateway process and server settings
 */
export interface GatewayConfig {
  /** HTTP server port */
  port: number;

  /** Auto-start gateway on app launch */
  autoStart: boolean;

  /** Auto-restart gateway on crash */
  autoRestart: boolean;

  /** Max restart attempts */
  maxRestarts: number;

  /** Health check interval (ms) */
  healthCheckIntervalMs: number;

  /** Health check timeout (ms) */
  healthCheckTimeoutMs: number;

  /** Log level */
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';

  /** AI provider settings */
  aiProvider: AiProviderConfig;
}

/**
 * AI provider configuration
 */
export interface AiProviderConfig {
  /** Default model identifier */
  defaultModel: string;

  /** Temperature (0.0-1.0) */
  temperature: number;

  /** Max tokens per response */
  maxTokens: number;

  /** Enable streaming responses */
  enableStreaming: boolean;
}

/**
 * AI memory and context management settings
 */
export interface MemoryConfig {
  /** Enable conversation memory */
  enabled: boolean;

  /** Max conversation history messages */
  maxHistoryMessages: number;

  /** Context window size (tokens) */
  contextWindowSize: number;

  /** Auto-summarize when context exceeds threshold */
  autoSummarize: boolean;

  /** Summarization threshold (0.0-1.0) */
  summarizationThreshold: number;

  /** Persist conversations to disk */
  persistConversations: boolean;

  /** Conversation retention days (0 = forever) */
  retentionDays: number;
}

/**
 * User identity and subscription settings
 */
export interface IdentityConfig {
  /** User's public key (66 hex chars) */
  publicKey?: string;

  /** User's petname */
  petname?: string;

  /** Subscription UTXO */
  subscriptionUtxo?: SubscriptionUtxo;

  /** Subscription cache TTL (seconds) */
  subscriptionCacheTtl: number;

  /** Check subscription on startup */
  checkSubscriptionOnStartup: boolean;
}

/**
 * Subscription UTXO reference
 */
export interface SubscriptionUtxo {
  /** Transaction ID (64 hex chars) */
  txid: string;

  /** Output index */
  vout: number;
}

/**
 * Operating mode
 */
export type OperatingMode = 'gateway' | 'client';

/**
 * UI preferences (from DesktopConfig)
 */
export interface UiConfig {
  /** Theme */
  theme: 'light' | 'dark' | 'system';

  /** Minimize to tray */
  minimizeToTray: boolean;

  /** Start minimized */
  startMinimized: boolean;

  /** Window dimensions */
  windowWidth: number;
  windowHeight: number;
  windowX?: number;
  windowY?: number;
}

/**
 * Client session configuration (from Phase 4)
 */
export interface ClientSessionConfig {
  gatewayPubkey: string;
  gatewayAddress: string;
  gatewayPetname: string;
  connectedAt: string;
  permission: 'owner' | 'member' | 'guest';
}

/**
 * Default configuration values
 */
export const DEFAULT_EDWINPAI_CONFIG: EdwinPAIConfig = {
  version: '1.0.0',
  gateway: {
    port: 3000,
    autoStart: true,
    autoRestart: true,
    maxRestarts: 5,
    healthCheckIntervalMs: 30_000,
    healthCheckTimeoutMs: 5_000,
    logLevel: 'info',
    aiProvider: {
      defaultModel: 'claude-sonnet-4-5',
      temperature: 0.7,
      maxTokens: 4096,
      enableStreaming: true,
    },
  },
  memory: {
    enabled: true,
    maxHistoryMessages: 100,
    contextWindowSize: 200_000,
    autoSummarize: true,
    summarizationThreshold: 0.8,
    persistConversations: true,
    retentionDays: 30,
  },
  identity: {
    subscriptionCacheTtl: 3600,
    checkSubscriptionOnStartup: true,
  },
  ui: {
    theme: 'system',
    minimizeToTray: true,
    startMinimized: false,
    windowWidth: 1200,
    windowHeight: 800,
  },
  mode: 'gateway',
};
```

### 3.2 IPC Message Types

**File**: `src/types/ipc.ts` (extend existing)

```typescript
/**
 * Get config IPC request
 */
export interface GetConfigRequest {
  // No fields needed
}

/**
 * Get config IPC response
 */
export interface GetConfigResponse {
  config: EdwinPAIConfig;
}

/**
 * Update config IPC request
 */
export interface UpdateConfigRequest {
  config: EdwinPAIConfig;
}

/**
 * Update config IPC response
 */
export interface UpdateConfigResponse {
  success: boolean;
  error?: string;
}

/**
 * Validate config IPC request
 */
export interface ValidateConfigRequest {
  config: EdwinPAIConfig;
}

/**
 * Validate config IPC response
 */
export interface ValidateConfigResponse {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error detail
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Reset config IPC request
 */
export interface ResetConfigRequest {
  // No fields needed
}

/**
 * Reset config IPC response
 */
export interface ResetConfigResponse {
  config: EdwinPAIConfig;
}

/**
 * Config error types
 */
export type ConfigErrorType =
  | 'FILE_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'MIGRATION_ERROR'
  | 'LOCK_ERROR';

/**
 * Config error detail
 */
export interface ConfigError {
  type: ConfigErrorType;
  message: string;
  details?: Record<string, unknown>;
}
```

### 3.3 Export Index

**File**: `src/types/index.ts` (extend existing)

```typescript
// Config types (NEW)
export type {
  EdwinPAIConfig,
  GatewayConfig,
  AiProviderConfig,
  MemoryConfig,
  IdentityConfig,
  SubscriptionUtxo,
  UiConfig,
  OperatingMode,
  ClientSessionConfig,
} from './config';

export { DEFAULT_EDWINPAI_CONFIG } from './config';

// Config IPC types (extend existing)
export type {
  GetConfigRequest,
  GetConfigResponse,
  UpdateConfigRequest,
  UpdateConfigResponse,
  ValidateConfigRequest,
  ValidateConfigResponse,
  ValidationError,
  ResetConfigRequest,
  ResetConfigResponse,
  ConfigError,
  ConfigErrorType,
} from './ipc';
```

---

## 4. IPC Command Signatures

### 4.1 Command Definitions

**File**: `src-tauri/src/commands/config.rs` (extend existing)

```rust
use crate::config::{
    types::{EdwinPAIConfig, ConfigResult, ConfigError},
    manager::get_config_manager,
};

/// Get current EdwinPAI configuration
#[tauri::command]
pub async fn get_edwinpai_config() -> Result<EdwinPAIConfig, String> {
    let manager = get_config_manager()
        .map_err(|e| format!("Config manager not initialized: {}", e))?;

    manager.load().await
        .map_err(|e| format!("Failed to load config: {}", e))
}

/// Update EdwinPAI configuration
#[tauri::command]
pub async fn update_edwinpai_config(config: EdwinPAIConfig) -> Result<(), String> {
    // Validate config first
    validate_edwinpai_config(config.clone()).await?;

    let manager = get_config_manager()
        .map_err(|e| format!("Config manager not initialized: {}", e))?;

    manager.save(config).await
        .map_err(|e| format!("Failed to save config: {}", e))
}

/// Validate EdwinPAI configuration
#[tauri::command]
pub async fn validate_edwinpai_config(config: EdwinPAIConfig) -> Result<Vec<String>, String> {
    let mut errors = Vec::new();

    // Validate gateway config
    if config.gateway.port == 0 || config.gateway.port > 65535 {
        errors.push("gateway.port must be between 1 and 65535".to_string());
    }

    if config.gateway.max_restarts == 0 {
        errors.push("gateway.maxRestarts must be at least 1".to_string());
    }

    if config.gateway.health_check_interval_ms < 1000 {
        errors.push("gateway.healthCheckIntervalMs must be at least 1000".to_string());
    }

    // Validate AI provider config
    if config.gateway.ai_provider.temperature < 0.0
        || config.gateway.ai_provider.temperature > 1.0 {
        errors.push("gateway.aiProvider.temperature must be between 0.0 and 1.0".to_string());
    }

    if config.gateway.ai_provider.max_tokens == 0 {
        errors.push("gateway.aiProvider.maxTokens must be at least 1".to_string());
    }

    // Validate memory config
    if config.memory.max_history_messages == 0 {
        errors.push("memory.maxHistoryMessages must be at least 1".to_string());
    }

    if config.memory.context_window_size == 0 {
        errors.push("memory.contextWindowSize must be at least 1".to_string());
    }

    if config.memory.summarization_threshold < 0.0
        || config.memory.summarization_threshold > 1.0 {
        errors.push("memory.summarizationThreshold must be between 0.0 and 1.0".to_string());
    }

    // Validate identity config
    if let Some(ref pubkey) = config.identity.public_key {
        if pubkey.len() != 66 {
            errors.push("identity.publicKey must be 66 hex characters".to_string());
        }
    }

    if config.identity.subscription_cache_ttl == 0 {
        errors.push("identity.subscriptionCacheTtl must be at least 1".to_string());
    }

    if errors.is_empty() {
        Ok(vec![])
    } else {
        Ok(errors)
    }
}

/// Reset configuration to defaults
#[tauri::command]
pub async fn reset_edwinpai_config() -> Result<EdwinPAIConfig, String> {
    let default_config = EdwinPAIConfig::default();

    let manager = get_config_manager()
        .map_err(|e| format!("Config manager not initialized: {}", e))?;

    manager.save(default_config.clone()).await
        .map_err(|e| format!("Failed to reset config: {}", e))?;

    Ok(default_config)
}

/// Get config file path
#[tauri::command]
pub async fn get_edwinpai_config_path() -> Result<String, String> {
    let manager = get_config_manager()
        .map_err(|e| format!("Config manager not initialized: {}", e))?;

    Ok(manager.config_path().to_string_lossy().to_string())
}
```

### 4.2 Command Registration

**File**: `src-tauri/src/lib.rs` (extend existing)

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... existing commands ...

        // Config commands (NEW)
        commands::config::get_edwinpai_config,
        commands::config::update_edwinpai_config,
        commands::config::validate_edwinpai_config,
        commands::config::reset_edwinpai_config,
        commands::config::get_edwinpai_config_path,
    ])
```

---

## 5. Configuration File Schemas

### 5.1 File Location

**Path**: `~/.edwinpai/edwinpai-config.json`

**Platform-Specific Paths**:
- Linux: `~/.edwinpai/edwinpai-config.json`
- macOS: `~/Library/Application Support/com.edwinpai.desktop/edwinpai-config.json`
- Windows: `%APPDATA%\EdwinPAI\edwinpai-config.json`

### 5.2 JSON Schema

```json
{
  "version": "1.0.0",
  "gateway": {
    "port": 3000,
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
    "publicKey": "03abc123...",
    "petname": "Swift Falcon",
    "subscriptionUtxo": {
      "txid": "abc123...",
      "vout": 0
    },
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
  "mode": "gateway",
  "lastClientSession": null
}
```

### 5.3 Migration Strategy

**Version 0.1.0 → 1.0.0** (DesktopConfig → EdwinPAIConfig):

```rust
impl EdwinPAIConfig {
    /// Migrate from DesktopConfig (Phase 3-6) to EdwinPAIConfig (Phase 7)
    pub fn migrate_from_desktop_config(desktop_config: DesktopConfig) -> Self {
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
```

---

## 6. Type Mapping & Integration

### 6.1 Rust → TypeScript

| Rust Type | TypeScript Type | Notes |
|-----------|-----------------|-------|
| `EdwinPAIConfig` | `EdwinPAIConfig` | 1:1 mapping |
| `GatewayConfig` | `GatewayConfig` | 1:1 mapping |
| `AiProviderConfig` | `AiProviderConfig` | 1:1 mapping |
| `MemoryConfig` | `MemoryConfig` | 1:1 mapping |
| `IdentityConfig` | `IdentityConfig` | 1:1 mapping |
| `OperatingMode` | `'gateway' \| 'client'` | Enum → string literal |
| `Option<T>` | `T \| undefined` | Rust `None` → JS `undefined` |
| `ConfigError` | `ConfigError` | Tagged union preserved |

### 6.2 Integration with Existing Types

**Phase 1 (Crypto Domain)**:
- `identity.publicKey` → populated from `crypto_domain::keypair::get_public_key()`
- `identity.petname` → populated from `crypto_domain::identity::derive_petname()`

**Phase 3 (Gateway Mode)**:
- `gateway.*` → extends existing `DesktopConfig.gateway`
- `ui.*` → reuses existing `DesktopConfig.ui`

**Phase 4 (Client Mode)**:
- `mode` → extends existing `DesktopConfig.mode`
- `lastClientSession` → reuses existing `DesktopConfig.last_client_session`

**Phase 7 (NEW)**:
- `memory.*` → NEW configuration section
- `gateway.aiProvider` → NEW configuration subsection
- Migration logic to convert `DesktopConfig` → `EdwinPAIConfig`

---

## 7. Validation Rules

### 7.1 Field Constraints

| Field | Type | Constraint | Error Message |
|-------|------|------------|---------------|
| `gateway.port` | `u16` | 1-65535 | "port must be between 1 and 65535" |
| `gateway.maxRestarts` | `u32` | ≥1 | "maxRestarts must be at least 1" |
| `gateway.healthCheckIntervalMs` | `u64` | ≥1000 | "healthCheckIntervalMs must be at least 1000" |
| `gateway.aiProvider.temperature` | `f64` | 0.0-1.0 | "temperature must be between 0.0 and 1.0" |
| `gateway.aiProvider.maxTokens` | `u32` | ≥1 | "maxTokens must be at least 1" |
| `memory.maxHistoryMessages` | `u32` | ≥1 | "maxHistoryMessages must be at least 1" |
| `memory.contextWindowSize` | `u32` | ≥1 | "contextWindowSize must be at least 1" |
| `memory.summarizationThreshold` | `f64` | 0.0-1.0 | "summarizationThreshold must be between 0.0 and 1.0" |
| `identity.publicKey` | `String` | 66 hex chars | "publicKey must be 66 hex characters" |
| `identity.subscriptionCacheTtl` | `u64` | ≥1 | "subscriptionCacheTtl must be at least 1" |

### 7.2 Cross-Field Validation

```rust
// Memory config consistency
if config.memory.auto_summarize && config.memory.summarization_threshold == 0.0 {
    return Err("autoSummarize requires summarizationThreshold > 0.0");
}

// Identity config consistency
if config.identity.public_key.is_some() && config.identity.petname.is_none() {
    return Err("publicKey requires petname to be set");
}
```

---

## 8. Implementation Checklist

### 8.1 Rust Backend (3 files)

- [ ] **`src-tauri/src/config/types.rs`** (NEW, ~400 LOC)
  - [ ] `EdwinPAIConfig` struct
  - [ ] `GatewayConfig` struct with `AiProviderConfig`
  - [ ] `MemoryConfig` struct
  - [ ] `IdentityConfig` struct with `SubscriptionUtxo`
  - [ ] `ConfigError` enum
  - [ ] `Default` implementations
  - [ ] `migrate_from_desktop_config()` function

- [ ] **`src-tauri/src/config/manager.rs`** (EXTEND, +150 LOC)
  - [ ] Update `ConfigManager` to use `EdwinPAIConfig`
  - [ ] Add migration logic in `load()`
  - [ ] Update `save()` to write `edwinpai-config.json`
  - [ ] Update global singleton

- [ ] **`src-tauri/src/commands/config.rs`** (EXTEND, +120 LOC)
  - [ ] `get_edwinpai_config()` command
  - [ ] `update_edwinpai_config()` command
  - [ ] `validate_edwinpai_config()` command (14 validation rules)
  - [ ] `reset_edwinpai_config()` command
  - [ ] `get_edwinpai_config_path()` command

### 8.2 TypeScript Frontend (2 files)

- [ ] **`src/types/config.ts`** (NEW, ~250 LOC)
  - [ ] `EdwinPAIConfig` interface
  - [ ] `GatewayConfig` interface with `AiProviderConfig`
  - [ ] `MemoryConfig` interface
  - [ ] `IdentityConfig` interface with `SubscriptionUtxo`
  - [ ] `UiConfig` interface (imported from existing)
  - [ ] `OperatingMode` type (imported from existing)
  - [ ] `DEFAULT_EDWINPAI_CONFIG` constant

- [ ] **`src/types/ipc.ts`** (EXTEND, +80 LOC)
  - [ ] `GetConfigRequest/Response`
  - [ ] `UpdateConfigRequest/Response`
  - [ ] `ValidateConfigRequest/Response`
  - [ ] `ResetConfigRequest/Response`
  - [ ] `ConfigError` interface

- [ ] **`src/types/index.ts`** (EXTEND, +20 LOC)
  - [ ] Export all config types
  - [ ] Export `DEFAULT_EDWINPAI_CONFIG`

### 8.3 Tests (3 files)

- [ ] **`src-tauri/src/config/types_test.rs`** (NEW, ~200 LOC)
  - [ ] Default config values
  - [ ] Serialization/deserialization
  - [ ] Migration from `DesktopConfig`

- [ ] **`src-tauri/src/commands/config_test.rs`** (EXTEND, +150 LOC)
  - [ ] `get_edwinpai_config()` test
  - [ ] `update_edwinpai_config()` test
  - [ ] `validate_edwinpai_config()` test (14 validation cases)
  - [ ] `reset_edwinpai_config()` test

- [ ] **`src/types/config.test.ts`** (NEW, ~100 LOC)
  - [ ] Type consistency
  - [ ] Default values
  - [ ] TypeScript validation

### 8.4 Documentation

- [ ] **This document** (`PHASE7_CONFIG_TYPE_CONTRACTS.md`)
- [ ] Update `MEMORY.md` with Phase 7 config lessons

---

## Summary

**Total LOC Estimate**: ~1,470 LOC
- Rust: ~870 LOC (400 types + 150 manager + 120 commands + 200 tests)
- TypeScript: ~450 LOC (250 types + 80 IPC + 20 exports + 100 tests)
- Documentation: 150 LOC (this doc)

**Key Deliverables**:
1. Complete type contracts (Rust + TypeScript)
2. 5 IPC commands with validation
3. JSON schema with migration strategy
4. 14 validation rules
5. Integration with Phase 1-6 types

**Ready for Implementation**: ✅ All types defined, all validation rules specified, all IPC commands documented.
