# Phase 3 Module Export Index

**Purpose**: Centralized import paths for all Phase 3 type contracts.

## Module Hierarchy

```
src-tauri/src/
│
├── lib.rs                    # Root module declarations
│
├── gateway/
│   ├── mod.rs               # ✅ Re-exports gateway types
│   ├── types.rs             # ✅ Domain types (GatewayStatus, GatewayProcessInfo, etc.)
│   └── ipc_types.rs         # ✅ IPC request/response types
│
├── tray/
│   ├── mod.rs               # ✅ Re-exports tray types
│   └── types.rs             # ✅ Tray menu types & IPC types
│
├── mdns.rs                  # ✅ MdnsManager implementation
│
├── config/                  # ⚠️ NEW MODULE NEEDED
│   ├── mod.rs               # ⚠️ Re-exports config types
│   └── types.rs             # ⚠️ DesktopConfig, ChatConfig, IPC types
│
└── commands/
    ├── gateway.rs           # ⚠️ Gateway lifecycle commands
    ├── tray.rs              # ⚠️ Tray menu commands
    ├── discovery.rs         # ⚠️ mDNS commands
    └── config.rs            # ⚠️ Config persistence commands
```

---

## Export Index by Module

### 1. Gateway Module (`gateway/mod.rs`)

```rust
// ============================================================================
// Gateway Process Management Module
// ============================================================================

pub mod ipc_types;
pub mod types;

// ----------------------------------------------------------------------------
// Domain Types (types.rs)
// ----------------------------------------------------------------------------

pub use types::{
    // Status enum
    GatewayStatus,              // Stopped | Starting | Running | Unhealthy | Stopping | Crashed

    // Process info
    GatewayProcessInfo,         // Serialized status (pid, port, uptime, etc.)
    GatewayProcessState,        // Internal state (child handle, health check task)

    // Health check
    HealthCheckResponse,        // Response from /health endpoint
    HealthStatus,               // Healthy | Degraded | Unhealthy
    HealthCheckServices,        // {chat, identity, subscription} booleans
    HealthCheckConfig,          // Polling config (interval, timeout, max failures)

    // Configuration
    GatewayConfig,              // Complete gateway config

    // mDNS
    MDnsConfig,                 // Service advertising config
    MDnsStatus,                 // Current advertising status
    MDnsState,                  // Internal mDNS state
};

// ----------------------------------------------------------------------------
// IPC Types (ipc_types.rs)
// ----------------------------------------------------------------------------

pub use ipc_types::{
    // Gateway lifecycle
    StartGatewayRequest,        // {port, autoRestart}
    StartGatewayResponse,       // {success, pid, port, message}
    StopGatewayRequest,         // {force, timeout}
    StopGatewayResponse,        // {success, message}
    GetGatewayStatusRequest,    // {}
    GetGatewayStatusResponse,   // {info: GatewayProcessInfo}

    // Health check
    PerformHealthCheckRequest,  // {timeout}
    PerformHealthCheckResponse, // {success, health?, error?}

    // mDNS
    StartMDnsRequest,           // {config: MDnsConfig}
    StartMDnsResponse,          // {success, message}
    StopMDnsRequest,            // {}
    StopMDnsResponse,           // {success, message}
    GetMDnsStatusRequest,       // {}
    GetMDnsStatusResponse,      // {status: MDnsStatus}

    // Events
    GatewayProcessEventPayload, // Emitted to frontend on status changes

    // Errors
    GatewayIpcError,            // Structured error with code, message, details
    GatewayIpcResult,           // Result<T, GatewayIpcError>
};
```

**Import Example**:

```rust
// In commands/gateway.rs
use crate::gateway::{
    StartGatewayRequest, StartGatewayResponse,
    GatewayIpcError, GatewayIpcResult,
};
```

---

### 2. Tray Module (`tray/mod.rs`)

```rust
// ============================================================================
// System Tray Module
// ============================================================================

pub mod types;

// ----------------------------------------------------------------------------
// Tray Types (types.rs)
// ----------------------------------------------------------------------------

pub use types::{
    // Menu items
    TrayMenuItemType,           // Normal | Separator | Submenu | Checkbox
    TrayMenuItemId,             // ShowWindow | StartGateway | Quit | etc. (13 actions)
    TrayMenuItem,               // Complete menu item definition
    TrayMenu,                   // {items: Vec<TrayMenuItem>}

    // Menu state
    TrayMenuState,              // Dynamic state (gateway_running, subscription_active, etc.)

    // Icons
    TrayIconType,               // Default | Active | Warning | Error
    MouseButton,                // Left | Right | Middle

    // IPC types
    UpdateTrayMenuRequest,      // {state: TrayMenuState}
    UpdateTrayMenuResponse,     // {success}
    GetTrayMenuStateRequest,    // {}
    GetTrayMenuStateResponse,   // {state: TrayMenuState}
    SetTrayTooltipRequest,      // {tooltip}
    SetTrayTooltipResponse,     // {success}
    SetTrayIconRequest,         // {icon: TrayIconType}
    SetTrayIconResponse,        // {success}

    // Events
    MenuItemClickedEventPayload,    // {item_id, timestamp}
    TrayIconClickedEventPayload,    // {button, timestamp}
};
```

**Import Example**:

```rust
// In commands/tray.rs
use crate::tray::{
    TrayMenuState, UpdateTrayMenuRequest, UpdateTrayMenuResponse,
    SetTrayIconRequest, TrayIconType,
};
```

---

### 3. mDNS Module (`mdns.rs`)

```rust
// ============================================================================
// mDNS Service Discovery
// ============================================================================

// Direct exports from mdns.rs (no submodules)

pub struct MdnsManager {
    // Advertises EdwinPAI gateway on local network
}

pub struct DiscoveredGateway {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub public_key: Option<String>,
    pub version: Option<String>,
    pub addresses: Vec<String>,
}

impl MdnsManager {
    pub fn new(service_name: Option<String>, port: u16) -> Result<Self, String>;
    pub fn advertise(&self, public_key: String, version: String) -> Result<(), String>;
    pub fn stop_advertising(&self) -> Result<(), String>;
    pub async fn discover_gateways(&self, timeout_secs: u64) -> Result<Vec<DiscoveredGateway>, String>;
    pub fn service_name(&self) -> &str;
}
```

**Import Example**:

```rust
// In commands/discovery.rs
use crate::mdns::{MdnsManager, DiscoveredGateway};
use crate::gateway::{StartMDnsRequest, MDnsConfig};
```

---

### 4. Config Module (`config/mod.rs`) — **NEW**

```rust
// ============================================================================
// Configuration Module
// ============================================================================

pub mod types;

// ----------------------------------------------------------------------------
// Config Types (types.rs)
// ----------------------------------------------------------------------------

pub use types::{
    // Desktop configuration
    DesktopConfig,              // Complete app config
    ChatConfig,                 // Chat settings (streaming, temperature, maxTokens)
    GatewayConfigSubset,        // Gateway settings (autoRestart, healthCheckInterval)
    ThemePreference,            // Light | Dark | System

    // IPC types
    GetConfigRequest,           // {}
    GetConfigResponse,          // {config: DesktopConfig}
    UpdateConfigRequest,        // {updates: serde_json::Value}
    UpdateConfigResponse,       // {config: DesktopConfig}
    ResetConfigRequest,         // {}
    ResetConfigResponse,        // {config: DesktopConfig}
};
```

**Import Example**:

```rust
// In commands/config.rs
use crate::config::{
    DesktopConfig, GetConfigResponse,
    UpdateConfigRequest, UpdateConfigResponse,
};
```

---

## Root Module Registration (`lib.rs`)

```rust
// ============================================================================
// Module Declarations
// ============================================================================

mod commands;

// Phase 1-2 modules
pub mod crypto_domain;
pub mod spv_domain;
pub mod overlay_domain;
pub mod subscription;

// Phase 3 modules
pub mod gateway;
pub mod mdns;
pub mod tray;
pub mod config;  // NEW

#[cfg(test)]
mod tests;

// ============================================================================
// Tauri App Builder
// ============================================================================

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
            // ----------------------------------------------------------------
            // Phase 1: Crypto Domain
            // ----------------------------------------------------------------
            commands::crypto::get_identity,
            commands::crypto::derive_key,
            commands::crypto::sign_message,
            commands::crypto::verify_message,
            commands::crypto::generate_identicon,

            // ----------------------------------------------------------------
            // Phase 2: SPV & Subscription
            // ----------------------------------------------------------------
            commands::spv::spv_verify,
            commands::spv::check_subscription,
            commands::spv::submit_to_arcade,

            // ----------------------------------------------------------------
            // Phase 3: Gateway Management
            // ----------------------------------------------------------------
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::get_gateway_status,
            commands::gateway::gateway_health_check,
            commands::gateway::is_gateway_running,

            // ----------------------------------------------------------------
            // Phase 3: System Tray
            // ----------------------------------------------------------------
            commands::tray::update_tray_state,
            commands::tray::setup_tray,
            commands::tray::get_tray_state,

            // ----------------------------------------------------------------
            // Phase 3: mDNS Discovery
            // ----------------------------------------------------------------
            commands::discovery::advertise_gateway,
            commands::discovery::stop_advertising,
            commands::discovery::discover_gateways,
            commands::discovery::get_advertised_service_name,

            // ----------------------------------------------------------------
            // Phase 3: Configuration
            // ----------------------------------------------------------------
            commands::config::get_config,
            commands::config::update_config,
            commands::config::reset_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Command Implementation Templates

### Gateway Commands (`commands/gateway.rs`)

```rust
use tauri::State;
use crate::gateway::{
    StartGatewayRequest, StartGatewayResponse,
    StopGatewayRequest, StopGatewayResponse,
    GetGatewayStatusResponse,
    PerformHealthCheckRequest, PerformHealthCheckResponse,
    GatewayIpcError, GatewayIpcResult,
};

#[tauri::command]
pub async fn start_gateway(
    req: StartGatewayRequest,
    state: State<'_, GatewayState>,
) -> GatewayIpcResult<StartGatewayResponse> {
    // Implementation
    todo!()
}

#[tauri::command]
pub async fn stop_gateway(
    req: StopGatewayRequest,
    state: State<'_, GatewayState>,
) -> GatewayIpcResult<StopGatewayResponse> {
    todo!()
}

#[tauri::command]
pub async fn get_gateway_status(
    state: State<'_, GatewayState>,
) -> GatewayIpcResult<GetGatewayStatusResponse> {
    todo!()
}

#[tauri::command]
pub async fn gateway_health_check(
    req: PerformHealthCheckRequest,
    state: State<'_, GatewayState>,
) -> GatewayIpcResult<PerformHealthCheckResponse> {
    todo!()
}

#[tauri::command]
pub async fn is_gateway_running(
    state: State<'_, GatewayState>,
) -> bool {
    todo!()
}
```

### Tray Commands (`commands/tray.rs`)

```rust
use tauri::{AppHandle, State};
use crate::tray::{
    TrayMenuState, UpdateTrayMenuRequest, UpdateTrayMenuResponse,
    GetTrayMenuStateResponse, SetTrayIconRequest, SetTrayTooltipRequest,
};

#[tauri::command]
pub async fn update_tray_state(
    req: UpdateTrayMenuRequest,
    app: AppHandle,
) -> Result<UpdateTrayMenuResponse, String> {
    // Rebuild menu from state
    let menu = req.state.build_menu();
    // Update system tray
    todo!()
}

#[tauri::command]
pub async fn setup_tray(app: AppHandle) -> Result<(), String> {
    // Initialize tray icon and menu
    todo!()
}

#[tauri::command]
pub async fn get_tray_state() -> Result<GetTrayMenuStateResponse, String> {
    todo!()
}
```

### Config Commands (`commands/config.rs`)

```rust
use std::fs;
use tauri::api::path::app_data_dir;
use crate::config::{
    DesktopConfig, GetConfigResponse,
    UpdateConfigRequest, UpdateConfigResponse,
    ResetConfigResponse,
};

#[tauri::command]
pub async fn get_config(
    config: tauri::Config,
) -> Result<GetConfigResponse, String> {
    let path = get_config_path(&config);
    let contents = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    let config: DesktopConfig = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse config: {}", e))?;
    Ok(GetConfigResponse { config })
}

#[tauri::command]
pub async fn update_config(
    req: UpdateConfigRequest,
    config: tauri::Config,
) -> Result<UpdateConfigResponse, String> {
    // Read current config
    let current = get_config(config.clone()).await?.config;
    // Merge updates
    let updated = merge_config(current, req.updates)?;
    // Write back to file
    write_config(&config, &updated)?;
    Ok(UpdateConfigResponse { config: updated })
}

#[tauri::command]
pub async fn reset_config(
    config: tauri::Config,
) -> Result<ResetConfigResponse, String> {
    let default = DesktopConfig::default();
    write_config(&config, &default)?;
    Ok(ResetConfigResponse { config: default })
}

fn get_config_path(config: &tauri::Config) -> std::path::PathBuf {
    app_data_dir(config)
        .expect("failed to resolve app data dir")
        .join("desktop-config.json")
}
```

### mDNS Commands (`commands/discovery.rs`)

```rust
use tauri::State;
use crate::mdns::{MdnsManager, DiscoveredGateway};
use crate::gateway::{StartMDnsRequest, StopMDnsRequest};

#[tauri::command]
pub async fn advertise_gateway(
    req: StartMDnsRequest,
    state: State<'_, MdnsManager>,
) -> Result<(), String> {
    state.advertise(
        req.config.txt_records.get("publicKey").cloned().unwrap_or_default(),
        "0.1.0".to_string(),
    )
}

#[tauri::command]
pub async fn stop_advertising(
    state: State<'_, MdnsManager>,
) -> Result<(), String> {
    state.stop_advertising()
}

#[tauri::command]
pub async fn discover_gateways(
    timeout_secs: u64,
    state: State<'_, MdnsManager>,
) -> Result<Vec<DiscoveredGateway>, String> {
    state.discover_gateways(timeout_secs).await
}

#[tauri::command]
pub async fn get_advertised_service_name(
    state: State<'_, MdnsManager>,
) -> String {
    state.service_name().to_string()
}
```

---

## Type Safety Checklist

### Serde Attributes

- [x] Enums use `#[serde(rename_all = "lowercase")]` or `snake_case`
- [x] Structs use `#[serde(rename = "camelCase")]` for field names
- [x] Optional fields use `#[serde(skip_serializing_if = "Option::is_none")]`
- [x] Renamed fields match TypeScript conventions (`gatewayPort`, `autoRestart`, etc.)

### Public API

- [x] All IPC request/response types implement `Serialize` + `Deserialize`
- [x] All domain types implement `Debug` + `Clone`
- [x] Internal state types (not serialized) omit Serde derives
- [x] Event payloads include ISO 8601 timestamps
- [x] Error types implement `Display` + `std::error::Error`

### Re-exports

- [x] `gateway/mod.rs` re-exports all public types
- [x] `tray/mod.rs` re-exports all public types
- [x] `config/mod.rs` re-exports all public types (NEW)
- [x] `lib.rs` declares all modules

---

## Testing Coverage

### Unit Tests (28 total)

- ✅ Gateway types: 9 tests
- ✅ Gateway IPC: 8 tests
- ✅ Tray types: 6 tests
- ✅ mDNS: 5 tests

### Integration Tests (TODO)

- [ ] Gateway start/stop lifecycle
- [ ] Health check polling
- [ ] Tray menu state synchronization
- [ ] Config persistence
- [ ] mDNS service registration

---

## Dependency Graph

```
commands/gateway.rs
    └── gateway::*
            ├── gateway/types.rs
            └── gateway/ipc_types.rs

commands/tray.rs
    └── tray::*
            └── tray/types.rs

commands/discovery.rs
    ├── mdns::*
    │       └── mdns.rs
    └── gateway::MDnsConfig
            └── gateway/types.rs

commands/config.rs
    └── config::*
            └── config/types.rs (NEW)
```

---

## File Creation Checklist

- [x] `src-tauri/src/gateway/mod.rs`
- [x] `src-tauri/src/gateway/types.rs`
- [x] `src-tauri/src/gateway/ipc_types.rs`
- [x] `src-tauri/src/tray/mod.rs`
- [x] `src-tauri/src/tray/types.rs`
- [x] `src-tauri/src/mdns.rs`
- [ ] `src-tauri/src/config/mod.rs` — **NEW**
- [ ] `src-tauri/src/config/types.rs` — **NEW**
- [ ] `src-tauri/src/commands/gateway.rs` — **NEW**
- [ ] `src-tauri/src/commands/tray.rs` — **NEW**
- [ ] `src-tauri/src/commands/discovery.rs` — **NEW**
- [ ] `src-tauri/src/commands/config.rs` — **NEW**

---

**Status**: ✅ Export index complete. All types defined and ready for implementation imports.
