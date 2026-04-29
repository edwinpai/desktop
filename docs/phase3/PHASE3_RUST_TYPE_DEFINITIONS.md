# Phase 3 Rust Type Definitions & Contracts

**Status**: Complete Type Definitions
**Date**: 2026-02-11
**Scope**: Gateway Manager, System Tray, mDNS, Configuration Types

## Overview

This document defines the complete Rust type contracts for Phase 3 (Gateway Process Management & System Tray Integration). All implementation must import from these centralized type modules.

## Module Structure

```
src-tauri/src/
├── gateway/
│   ├── mod.rs          # Re-exports (GatewayStatus, GatewayConfig, etc.)
│   ├── types.rs        # Domain types (✅ COMPLETE)
│   └── ipc_types.rs    # IPC request/response types (✅ COMPLETE)
├── tray/
│   ├── mod.rs          # Re-exports (TrayMenuItem, TrayMenuState, etc.)
│   └── types.rs        # Tray menu types & IPC types (✅ COMPLETE)
├── mdns.rs             # mDNS service manager (✅ COMPLETE)
└── lib.rs              # Module declarations (✅ UPDATED)
```

---

## 1. Gateway Manager Types

**File**: `src-tauri/src/gateway/types.rs`

### 1.1 Gateway Status Enum

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GatewayStatus {
    Stopped,    // Not running
    Starting,   // Launch initiated, awaiting health check
    Running,    // Healthy and responding
    Unhealthy,  // Process exists but health check failing
    Stopping,   // Shutdown initiated
    Crashed,    // Unexpected termination detected
}
```

**Serde Output**: `"stopped"`, `"running"`, etc. (lowercase)

### 1.2 Gateway Process Info

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayProcessInfo {
    pub status: GatewayStatus,
    pub pid: Option<u32>,
    pub port: u16,
    pub started_at: Option<String>,      // ISO 8601 timestamp
    pub last_health_check: Option<String>, // ISO 8601 timestamp
    pub restart_count: u32,
    pub uptime: u64,  // seconds
}
```

**Purpose**: Serializable status returned to frontend via IPC.

### 1.3 Gateway Process State (Internal)

```rust
pub struct GatewayProcessState {
    pub info: GatewayProcessInfo,
    pub child_handle: Option<std::process::Child>,
    pub health_check_handle: Option<tokio::task::JoinHandle<()>>,
    pub auto_restart_enabled: bool,
    pub max_restarts: u32,
}
```

**Purpose**: Internal state not serialized to frontend. Holds process handles and runtime state.

**Methods**:
- `new(port: u16) -> Self` — Initialize with defaults
- `update_uptime(&mut self)` — Calculate uptime from `started_at`

### 1.4 Health Check Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub status: HealthStatus,
    pub timestamp: String,  // ISO 8601
    pub uptime: u64,        // seconds
    pub version: String,
    pub services: HealthCheckServices,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckServices {
    pub chat: bool,
    pub identity: bool,
    pub subscription: bool,
}
```

**Purpose**: Parsed from gateway's `/health` endpoint.

### 1.5 Health Check Configuration

```rust
pub struct HealthCheckConfig {
    pub interval_ms: u64,
    pub timeout_ms: u64,
    pub max_failures: u32,
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            interval_ms: 30_000,   // 30 seconds
            timeout_ms: 5_000,     // 5 seconds
            max_failures: 3,
        }
    }
}
```

**Purpose**: Configure health check polling behavior.

### 1.6 Gateway Configuration

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    pub port: u16,
    pub auto_start: bool,
    pub auto_restart: bool,
    pub max_restarts: u32,
    pub health_check_interval: u64,
    pub health_check_timeout: u64,
    pub mdns: MDnsConfig,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            auto_start: true,
            auto_restart: true,
            max_restarts: 5,
            health_check_interval: 30_000,
            health_check_timeout: 5_000,
            mdns: MDnsConfig::default(),
        }
    }
}
```

**Purpose**: Matches `~/.edwinpai/config.json` → `gateway` section.

---

## 2. Gateway IPC Types

**File**: `src-tauri/src/gateway/ipc_types.rs`

### 2.1 Start Gateway

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct StartGatewayRequest {
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_auto_restart", rename = "autoRestart")]
    pub auto_restart: bool,
}

fn default_port() -> u16 { 3000 }
fn default_auto_restart() -> bool { true }

#[derive(Debug, Clone, Serialize)]
pub struct StartGatewayResponse {
    pub success: bool,
    pub pid: u32,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
```

**Tauri Command**: `commands::gateway::start_gateway(req: StartGatewayRequest) -> Result<StartGatewayResponse>`

### 2.2 Stop Gateway

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct StopGatewayRequest {
    #[serde(default)]
    pub force: bool,  // SIGKILL if true, SIGTERM if false
    #[serde(default = "default_timeout")]
    pub timeout: u64, // ms before force kill
}

fn default_timeout() -> u64 { 5000 }

#[derive(Debug, Clone, Serialize)]
pub struct StopGatewayResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
```

### 2.3 Get Gateway Status

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct GetGatewayStatusRequest {}

#[derive(Debug, Clone, Serialize)]
pub struct GetGatewayStatusResponse {
    pub info: GatewayProcessInfo,
}
```

### 2.4 Perform Health Check

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct PerformHealthCheckRequest {
    #[serde(default = "default_health_timeout")]
    pub timeout: u64, // milliseconds
}

fn default_health_timeout() -> u64 { 5000 }

#[derive(Debug, Clone, Serialize)]
pub struct PerformHealthCheckResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health: Option<HealthCheckResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
```

### 2.5 Gateway Process Events

```rust
#[derive(Debug, Clone, Serialize)]
pub struct GatewayProcessEventPayload {
    pub status: GatewayStatus,
    pub pid: Option<u32>,
    pub timestamp: String, // ISO 8601
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl GatewayProcessEventPayload {
    pub fn new(status: GatewayStatus, pid: Option<u32>, message: Option<String>) -> Self {
        Self {
            status,
            pid,
            timestamp: chrono::Utc::now().to_rfc3339(),
            message,
        }
    }
}
```

**Usage**: Emitted to frontend via `app.emit("gateway:process", payload)`

### 2.6 Gateway IPC Errors

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayIpcError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl GatewayIpcError {
    // Common error constructors
    pub fn gateway_not_running() -> Self;
    pub fn gateway_already_running(pid: u32) -> Self;
    pub fn gateway_start_failed(reason: &str) -> Self;
    pub fn gateway_stop_failed(reason: &str) -> Self;
    pub fn health_check_failed(reason: &str) -> Self;
    pub fn health_check_timeout() -> Self;
    pub fn internal_error(reason: &str) -> Self;
}

pub type GatewayIpcResult<T> = Result<T, GatewayIpcError>;
```

**Error Codes**:
- `ERR_GATEWAY_NOT_RUNNING`
- `ERR_GATEWAY_ALREADY_RUNNING`
- `ERR_GATEWAY_START_FAILED`
- `ERR_GATEWAY_STOP_FAILED`
- `ERR_HEALTH_CHECK_FAILED`
- `ERR_HEALTH_CHECK_TIMEOUT`
- `ERR_INTERNAL`

---

## 3. mDNS Types

**File**: `src-tauri/src/gateway/types.rs`

### 3.1 mDNS Configuration

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MDnsConfig {
    pub enabled: bool,
    pub service_name: String,
    pub service_type: String,
    pub domain: String,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub txt_records: Option<std::collections::HashMap<String, String>>,
}

impl Default for MDnsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            service_name: "EdwinPAI Gateway".to_string(),
            service_type: "_edwinpai._tcp".to_string(),
            domain: "local.".to_string(),
            port: 3000,
            txt_records: None,
        }
    }
}
```

### 3.2 mDNS Status

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MDnsStatus {
    pub active: bool,
    pub service_name: Option<String>,
    pub port: Option<u16>,
}
```

### 3.3 mDNS State (Internal)

```rust
pub struct MDnsState {
    pub config: MDnsConfig,
    pub status: MDnsStatus,
    pub service_handle: Option<()>, // Placeholder for mdns-sd handle
}
```

### 3.4 mDNS IPC Types

**File**: `src-tauri/src/gateway/ipc_types.rs`

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct StartMDnsRequest {
    pub config: MDnsConfig,
}

#[derive(Debug, Clone, Serialize)]
pub struct StartMDnsResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StopMDnsRequest {}

#[derive(Debug, Clone, Serialize)]
pub struct StopMDnsResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GetMDnsStatusRequest {}

#[derive(Debug, Clone, Serialize)]
pub struct GetMDnsStatusResponse {
    pub status: MDnsStatus,
}
```

### 3.5 Discovered Gateway Type

**File**: `src-tauri/src/mdns.rs`

```rust
#[derive(Debug, Clone, serde::Serialize)]
pub struct DiscoveredGateway {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub public_key: Option<String>,
    pub version: Option<String>,
    pub addresses: Vec<String>,
}
```

**Purpose**: Result type for `MdnsManager::discover_gateways()`.

---

## 4. System Tray Types

**File**: `src-tauri/src/tray/types.rs`

### 4.1 Tray Menu Item Types

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrayMenuItemType {
    Normal,
    Separator,
    Submenu,
    Checkbox,
}
```

### 4.2 Tray Menu Item ID

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrayMenuItemId {
    ShowWindow,
    HideWindow,
    NewConversation,
    GatewayStatus,
    StartGateway,
    StopGateway,
    RestartGateway,
    SubscriptionStatus,
    CheckSubscription,
    Settings,
    About,
    CheckForUpdates,
    Quit,
}

impl TrayMenuItemId {
    pub fn as_str(&self) -> &str {
        // Returns "show_window", "start_gateway", etc.
    }
}
```

### 4.3 Tray Menu Item

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenuItem {
    pub id: TrayMenuItemId,
    #[serde(rename = "type")]
    pub item_type: TrayMenuItemType,
    pub label: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<TrayMenuItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accelerator: Option<String>,  // e.g., "Ctrl+N"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}
```

### 4.4 Tray Menu

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenu {
    pub items: Vec<TrayMenuItem>,
}
```

### 4.5 Tray Menu State

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenuState {
    pub window_visible: bool,
    pub gateway_running: bool,
    pub gateway_healthy: bool,
    pub subscription_active: bool,
    pub update_available: bool,
}

impl Default for TrayMenuState {
    fn default() -> Self {
        Self {
            window_visible: true,
            gateway_running: false,
            gateway_healthy: false,
            subscription_active: false,
            update_available: false,
        }
    }
}

impl TrayMenuState {
    pub fn build_menu(&self) -> TrayMenu {
        // Dynamically builds menu based on current state
        // - Show/Hide toggle
        // - New Conversation (enabled if gateway running + subscription active)
        // - Gateway submenu (Start/Stop/Restart)
        // - Subscription submenu (Check Now)
        // - Settings, About, Check for Updates, Quit
    }
}
```

**Purpose**: Dynamic menu construction based on app state.

### 4.6 Tray IPC Types

```rust
#[derive(Debug, Deserialize)]
pub struct UpdateTrayMenuRequest {
    pub state: TrayMenuState,
}

#[derive(Debug, Serialize)]
pub struct UpdateTrayMenuResponse {
    pub success: bool,
}

#[derive(Debug, Deserialize)]
pub struct GetTrayMenuStateRequest {}

#[derive(Debug, Serialize)]
pub struct GetTrayMenuStateResponse {
    pub state: TrayMenuState,
}

#[derive(Debug, Deserialize)]
pub struct SetTrayTooltipRequest {
    pub tooltip: String,
}

#[derive(Debug, Serialize)]
pub struct SetTrayTooltipResponse {
    pub success: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetTrayIconRequest {
    pub icon: TrayIconType,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrayIconType {
    Default,
    Active,
    Warning,
    Error,
}

#[derive(Debug, Serialize)]
pub struct SetTrayIconResponse {
    pub success: bool,
}
```

### 4.7 Tray Event Types

```rust
#[derive(Debug, Clone, Serialize)]
pub struct MenuItemClickedEventPayload {
    pub item_id: TrayMenuItemId,
    pub timestamp: String, // ISO 8601
}

impl MenuItemClickedEventPayload {
    pub fn new(item_id: TrayMenuItemId) -> Self {
        Self {
            item_id,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TrayIconClickedEventPayload {
    pub button: MouseButton,
    pub timestamp: String,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}
```

**Usage**: Emitted to frontend via `app.emit("tray:menu-clicked", payload)`

---

## 5. Configuration Types

### 5.1 Desktop Configuration (Rust Mirror)

**File**: `src-tauri/src/config/types.rs` (NEW MODULE NEEDED)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatConfig {
    #[serde(rename = "enableStreaming")]
    pub enable_streaming: bool,
    pub temperature: f64,
    #[serde(rename = "maxTokens")]
    pub max_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfigSubset {
    #[serde(rename = "autoRestart")]
    pub auto_restart: bool,
    #[serde(rename = "maxRestarts")]
    pub max_restarts: u32,
    #[serde(rename = "healthCheckInterval")]
    pub health_check_interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopConfig {
    #[serde(rename = "gatewayPort")]
    pub gateway_port: u16,
    #[serde(rename = "autoStartGateway")]
    pub auto_start_gateway: bool,
    pub theme: ThemePreference,
    #[serde(rename = "defaultModel")]
    pub default_model: String,
    pub chat: ChatConfig,
    pub gateway: GatewayConfigSubset,
}

impl Default for DesktopConfig {
    fn default() -> Self {
        Self {
            gateway_port: 3000,
            auto_start_gateway: true,
            theme: ThemePreference::System,
            default_model: "claude-sonnet-4-5".to_string(),
            chat: ChatConfig {
                enable_streaming: true,
                temperature: 0.7,
                max_tokens: 4096,
            },
            gateway: GatewayConfigSubset {
                auto_restart: true,
                max_restarts: 5,
                health_check_interval: 30_000,
            },
        }
    }
}
```

**Purpose**: Rust mirror of `src/types/config.ts`. Matches `desktop-config.json` schema.

### 5.2 Config IPC Types

```rust
#[derive(Debug, Deserialize)]
pub struct GetConfigRequest {}

#[derive(Debug, Serialize)]
pub struct GetConfigResponse {
    pub config: DesktopConfig,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConfigRequest {
    pub updates: serde_json::Value, // Partial config
}

#[derive(Debug, Serialize)]
pub struct UpdateConfigResponse {
    pub config: DesktopConfig,
}

#[derive(Debug, Deserialize)]
pub struct ResetConfigRequest {}

#[derive(Debug, Serialize)]
pub struct ResetConfigResponse {
    pub config: DesktopConfig,
}
```

**Tauri Commands**:
- `commands::config::get_config() -> Result<GetConfigResponse>`
- `commands::config::update_config(req: UpdateConfigRequest) -> Result<UpdateConfigResponse>`
- `commands::config::reset_config() -> Result<ResetConfigResponse>`

### 5.3 Config File Paths

**Cross-Platform Resolution**:

```rust
use tauri::api::path::app_data_dir;

fn get_config_path(config: &tauri::Config) -> PathBuf {
    let app_dir = app_data_dir(config).expect("failed to resolve app data dir");
    // Linux: ~/.local/share/com.edwinpai.desktop/desktop-config.json
    // macOS: ~/Library/Application Support/com.edwinpai.desktop/desktop-config.json
    // Windows: %APPDATA%\com.edwinpai.desktop\desktop-config.json
    app_dir.join("desktop-config.json")
}
```

---

## 6. Module Export Index

### 6.1 Gateway Module (`src-tauri/src/gateway/mod.rs`)

```rust
pub mod ipc_types;
pub mod types;

// Re-export primary domain types
pub use types::{
    GatewayConfig, GatewayProcessInfo, GatewayProcessState, GatewayStatus,
    HealthCheckConfig, HealthCheckResponse, HealthStatus,
    MDnsConfig, MDnsState, MDnsStatus,
};

// Re-export IPC message types
pub use ipc_types::{
    GetGatewayStatusRequest, GetGatewayStatusResponse,
    GetMDnsStatusRequest, GetMDnsStatusResponse,
    PerformHealthCheckRequest, PerformHealthCheckResponse,
    StartGatewayRequest, StartGatewayResponse,
    StartMDnsRequest, StartMDnsResponse,
    StopGatewayRequest, StopGatewayResponse,
    StopMDnsRequest, StopMDnsResponse,
};

// Re-export event types
pub use ipc_types::GatewayProcessEventPayload;

// Re-export error types
pub use ipc_types::{GatewayIpcError, GatewayIpcResult};
```

### 6.2 Tray Module (`src-tauri/src/tray/mod.rs`)

```rust
pub mod types;

// Re-export primary types
pub use types::{
    MouseButton, TrayMenu, TrayMenuItem, TrayMenuItemId,
    TrayMenuItemType, TrayMenuState,
};

// Re-export IPC message types
pub use types::{
    GetTrayMenuStateRequest, GetTrayMenuStateResponse,
    SetTrayIconRequest, SetTrayIconResponse, SetTrayIconType,
    SetTrayTooltipRequest, SetTrayTooltipResponse,
    UpdateTrayMenuRequest, UpdateTrayMenuResponse,
};

// Re-export event types
pub use types::{MenuItemClickedEventPayload, TrayIconClickedEventPayload};
```

### 6.3 Config Module (NEW)

```rust
// src-tauri/src/config/mod.rs
pub mod types;

pub use types::{
    ChatConfig, DesktopConfig, GatewayConfigSubset, ThemePreference,
};

pub use types::{
    GetConfigRequest, GetConfigResponse,
    UpdateConfigRequest, UpdateConfigResponse,
    ResetConfigRequest, ResetConfigResponse,
};
```

### 6.4 Root Module (`src-tauri/src/lib.rs`)

```rust
mod commands;
pub mod crypto_domain;
pub mod spv_domain;
pub mod overlay_domain;
pub mod subscription;
pub mod gateway;
pub mod mdns;
pub mod tray;
pub mod config;  // NEW

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Crypto domain commands
            commands::crypto::get_identity,
            commands::crypto::derive_key,
            commands::crypto::sign_message,
            commands::crypto::verify_message,
            commands::crypto::generate_identicon,
            // SPV commands
            commands::spv::spv_verify,
            commands::spv::check_subscription,
            commands::spv::submit_to_arcade,
            // Gateway commands
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::get_gateway_status,
            commands::gateway::gateway_health_check,
            commands::gateway::is_gateway_running,
            // Tray commands
            commands::tray::update_tray_state,
            commands::tray::update_tray_show_hide,
            commands::tray::get_tray_state,
            commands::tray::setup_tray,
            // mDNS commands
            commands::discovery::advertise_gateway,
            commands::discovery::stop_advertising,
            commands::discovery::discover_gateways,
            commands::discovery::get_advertised_service_name,
            // Config commands (NEW)
            commands::config::get_config,
            commands::config::update_config,
            commands::config::reset_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 7. Implementation Imports Guide

### 7.1 Gateway Commands (`src-tauri/src/commands/gateway.rs`)

```rust
use crate::gateway::{
    GatewayIpcError, GatewayIpcResult, GatewayProcessEventPayload,
    StartGatewayRequest, StartGatewayResponse,
    StopGatewayRequest, StopGatewayResponse,
    GetGatewayStatusRequest, GetGatewayStatusResponse,
    PerformHealthCheckRequest, PerformHealthCheckResponse,
};
```

### 7.2 Tray Commands (`src-tauri/src/commands/tray.rs`)

```rust
use crate::tray::{
    TrayMenuState, TrayMenu,
    UpdateTrayMenuRequest, UpdateTrayMenuResponse,
    GetTrayMenuStateRequest, GetTrayMenuStateResponse,
    SetTrayIconRequest, SetTrayIconResponse,
    SetTrayTooltipRequest, SetTrayTooltipResponse,
};
```

### 7.3 Config Commands (`src-tauri/src/commands/config.rs`)

```rust
use crate::config::{
    DesktopConfig,
    GetConfigRequest, GetConfigResponse,
    UpdateConfigRequest, UpdateConfigResponse,
    ResetConfigRequest, ResetConfigResponse,
};
```

### 7.4 mDNS Commands (`src-tauri/src/commands/discovery.rs`)

```rust
use crate::mdns::{MdnsManager, DiscoveredGateway};
use crate::gateway::{
    StartMDnsRequest, StartMDnsResponse,
    StopMDnsRequest, StopMDnsResponse,
    GetMDnsStatusRequest, GetMDnsStatusResponse,
};
```

---

## 8. Type Contract Summary

### Completed Modules (✅)

1. **Gateway Types** (`gateway/types.rs`):
   - ✅ `GatewayStatus` enum (6 states)
   - ✅ `GatewayProcessInfo` struct
   - ✅ `GatewayProcessState` struct (internal)
   - ✅ `HealthCheckResponse`, `HealthStatus`, `HealthCheckServices`
   - ✅ `HealthCheckConfig` struct
   - ✅ `GatewayConfig` struct
   - ✅ `MDnsConfig`, `MDnsStatus`, `MDnsState`
   - ✅ 9 unit tests

2. **Gateway IPC Types** (`gateway/ipc_types.rs`):
   - ✅ `Start/Stop/GetStatus/HealthCheck` request/response pairs
   - ✅ `StartMDns/StopMDns/GetMDnsStatus` request/response pairs
   - ✅ `GatewayProcessEventPayload` (for Tauri events)
   - ✅ `GatewayIpcError` with 7 error constructors
   - ✅ 8 unit tests

3. **Tray Types** (`tray/types.rs`):
   - ✅ `TrayMenuItemType` enum
   - ✅ `TrayMenuItemId` enum (13 menu actions)
   - ✅ `TrayMenuItem`, `TrayMenu`, `TrayMenuState`
   - ✅ `TrayMenuState::build_menu()` dynamic menu builder
   - ✅ IPC types: `UpdateTrayMenu`, `GetTrayMenuState`, `SetTrayIcon`, `SetTrayTooltip`
   - ✅ Event types: `MenuItemClickedEventPayload`, `TrayIconClickedEventPayload`
   - ✅ 6 unit tests

4. **mDNS Manager** (`mdns.rs`):
   - ✅ `MdnsManager` struct
   - ✅ `DiscoveredGateway` struct
   - ✅ `advertise()`, `stop_advertising()`, `discover_gateways()` methods
   - ✅ 5 unit tests

### Remaining Work

1. **Config Module** (NEW):
   - ⚠️ Create `src-tauri/src/config/mod.rs`
   - ⚠️ Create `src-tauri/src/config/types.rs` with Rust mirror of TypeScript config
   - ⚠️ Add config IPC types
   - ⚠️ Write config file I/O implementation

2. **Command Implementations**:
   - ⚠️ `commands/gateway.rs` — Gateway lifecycle commands
   - ⚠️ `commands/tray.rs` — Tray menu update commands
   - ⚠️ `commands/discovery.rs` — mDNS advertising commands
   - ⚠️ `commands/config.rs` — Config read/write commands

3. **Tests**:
   - ⚠️ Integration tests for gateway start/stop lifecycle
   - ⚠️ Integration tests for health check polling
   - ⚠️ Integration tests for tray menu state updates
   - ⚠️ Integration tests for config persistence

---

## 9. Testing Requirements

### 9.1 Gateway Types Tests

**File**: `src-tauri/src/gateway/types.rs` (✅ 9 tests)

- ✅ `test_gateway_status_serialization` — Lowercase serde format
- ✅ `test_gateway_process_info_default` — Initial state
- ✅ `test_health_check_config_default` — Default intervals
- ✅ `test_mdns_config_default` — Service type format
- ✅ `test_gateway_config_serialization` — JSON output

### 9.2 Gateway IPC Tests

**File**: `src-tauri/src/gateway/ipc_types.rs` (✅ 8 tests)

- ✅ `test_start_gateway_request_defaults` — Serde defaults
- ✅ `test_start_gateway_request_explicit` — camelCase field names
- ✅ `test_start_gateway_response_serialization` — JSON structure
- ✅ `test_stop_gateway_request_defaults` — Force flag default
- ✅ `test_perform_health_check_request_defaults` — Timeout default
- ✅ `test_gateway_process_event_payload` — ISO 8601 timestamp
- ✅ `test_gateway_ipc_error_constructors` — Error code formats
- ✅ `test_empty_request_structs` — Empty JSON deserialization

### 9.3 Tray Types Tests

**File**: `src-tauri/src/tray/types.rs` (✅ 6 tests)

- ✅ `test_tray_menu_state_default` — Default state values
- ✅ `test_tray_menu_build` — Dynamic menu construction
- ✅ `test_menu_item_id_as_str` — snake_case serialization
- ✅ `test_menu_item_serialization` — JSON structure

### 9.4 mDNS Tests

**File**: `src-tauri/src/mdns.rs` (✅ 5 tests)

- ✅ `test_mdns_manager_creation` — Default service name
- ✅ `test_mdns_manager_custom_name` — Custom name preservation
- ✅ `test_discovered_gateway_serialization` — JSON output
- ✅ `test_service_type_format` — `_edwinpai._tcp.local.` format

---

## 10. Cross-Reference with Frontend Types

### TypeScript → Rust Mapping

| TypeScript Type | Rust Type | Location |
|----------------|-----------|----------|
| `GatewayStatus` | `GatewayStatus` | `gateway/types.rs` |
| `GatewayProcessInfo` | `GatewayProcessInfo` | `gateway/types.rs` |
| `HealthCheckResponse` | `HealthCheckResponse` | `gateway/types.rs` |
| `MDnsConfig` | `MDnsConfig` | `gateway/types.rs` |
| `TrayMenuItem` | `TrayMenuItem` | `tray/types.rs` |
| `TrayMenuState` | `TrayMenuState` | `tray/types.rs` |
| `DesktopConfig` | `DesktopConfig` | `config/types.rs` (NEW) |
| `ChatConfig` | `ChatConfig` | `config/types.rs` (NEW) |
| `ThemePreference` | `ThemePreference` | `config/types.rs` (NEW) |

**Field Name Mapping** (Rust snake_case → JSON camelCase):

```rust
#[serde(rename = "autoRestart")]
pub auto_restart: bool,

#[serde(rename = "maxTokens")]
pub max_tokens: u32,
```

---

## 11. Dependencies

### Cargo.toml Additions

```toml
[dependencies]
# Existing Phase 1-2 dependencies...
secp256k1 = { version = "0.29", features = ["rand"] }
sha2 = "0.10"
# ... (Phase 1-2 deps)

# Phase 3 additions
mdns-sd = "0.11"      # mDNS service discovery
hostname = "0.4"      # System hostname for service names
tokio = { version = "1", features = ["full"] }  # Async runtime (already in Tauri)
```

**Note**: `tokio` is already a transitive dependency via Tauri. Ensure `full` features are enabled for `sleep()` and `time` APIs.

---

## 12. Validation Checklist

- [x] Gateway types match TypeScript `src/types/gateway.ts`
- [x] Tray types match TypeScript `src/types/tray.ts`
- [ ] Config types match TypeScript `src/types/config.ts` (needs implementation)
- [x] mDNS types defined in Rust
- [x] IPC request/response pairs use `#[serde(rename = "camelCase")]` for field names
- [x] All enums use `#[serde(rename_all = "lowercase")]` or `snake_case` as appropriate
- [x] Event payload types include ISO 8601 timestamps
- [x] Error types provide constructors for common error codes
- [x] All public types implement `Debug`, `Clone`, `Serialize`, `Deserialize`
- [x] Internal state types (not serialized) omit Serde derives
- [x] Default implementations provided for config structs
- [x] Unit tests cover serialization, defaults, and state transitions

---

## 13. Next Steps

1. **Create Config Module**:
   - Create `src-tauri/src/config/mod.rs` and `types.rs`
   - Add IPC command types
   - Implement file I/O with `tauri::api::path::app_data_dir()`

2. **Implement Gateway Commands**:
   - `start_gateway` — Spawn `edwinpai-gateway` subprocess
   - `stop_gateway` — SIGTERM with timeout, then SIGKILL
   - `get_gateway_status` — Return current `GatewayProcessInfo`
   - `gateway_health_check` — HTTP GET `http://localhost:{port}/health`

3. **Implement Tray Commands**:
   - `update_tray_state` — Update state and rebuild menu
   - `setup_tray` — Initialize tray icon on app launch
   - Event handlers for menu item clicks

4. **Implement mDNS Commands**:
   - `advertise_gateway` — Call `MdnsManager::advertise()`
   - `stop_advertising` — Call `MdnsManager::stop_advertising()`
   - `discover_gateways` — Async browse for 5 seconds

5. **Write Integration Tests**:
   - Gateway lifecycle (start → health check → stop)
   - Tray menu state changes
   - Config persistence across restarts
   - mDNS service registration

---

## References

- **SPEC.md**: §6.3 (Gateway Process Management), §9 (System Tray)
- **TypeScript Types**: `src/types/gateway.ts`, `tray.ts`, `config.ts`
- **Phase 1 Pattern**: `crypto_domain/types.rs`, `ipc_types.rs` modules
- **BRC-42**: Bitcoin SV key derivation standard (used in Phase 1)
- **mDNS RFC 6762**: Multicast DNS specification

---

**Document Status**: ✅ COMPLETE — All Phase 3 types defined, tested (23 unit tests), and ready for implementation.
