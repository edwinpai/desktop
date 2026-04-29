# Phase 3 Type Definitions - Quick Reference

**Date**: 2026-02-11
**Status**: ✅ COMPLETE (23 unit tests passing)

## Overview

All Phase 3 Rust types are **fully defined** in existing modules. This document provides import paths and key contracts for implementation.

---

## 1. Gateway Manager Types

### Core Types (`src-tauri/src/gateway/types.rs`)

```rust
// Status enum - 6 states
pub enum GatewayStatus {
    Stopped | Starting | Running | Unhealthy | Stopping | Crashed
}

// Process info (serialized to frontend)
pub struct GatewayProcessInfo {
    pub status: GatewayStatus,
    pub pid: Option<u32>,
    pub port: u16,
    pub started_at: Option<String>,
    pub restart_count: u32,
    pub uptime: u64,
}

// Internal state (not serialized)
pub struct GatewayProcessState {
    pub info: GatewayProcessInfo,
    pub child_handle: Option<std::process::Child>,
    pub health_check_handle: Option<tokio::task::JoinHandle<()>>,
    pub auto_restart_enabled: bool,
    pub max_restarts: u32,
}

// Health check response
pub struct HealthCheckResponse {
    pub status: HealthStatus,  // Healthy | Degraded | Unhealthy
    pub timestamp: String,
    pub uptime: u64,
    pub version: String,
    pub services: HealthCheckServices,  // {chat, identity, subscription}
}

// Configuration
pub struct GatewayConfig {
    pub port: u16,
    pub auto_start: bool,
    pub auto_restart: bool,
    pub max_restarts: u32,
    pub health_check_interval: u64,
    pub health_check_timeout: u64,
    pub mdns: MDnsConfig,
}
```

### IPC Types (`src-tauri/src/gateway/ipc_types.rs`)

```rust
// Start gateway
pub struct StartGatewayRequest {
    pub port: u16,                    // default: 3000
    #[serde(rename = "autoRestart")]
    pub auto_restart: bool,           // default: true
}

pub struct StartGatewayResponse {
    pub success: bool,
    pub pid: u32,
    pub port: u16,
    pub message: Option<String>,
}

// Stop gateway
pub struct StopGatewayRequest {
    pub force: bool,        // SIGKILL vs SIGTERM
    pub timeout: u64,       // ms, default: 5000
}

// Get status
pub struct GetGatewayStatusResponse {
    pub info: GatewayProcessInfo,
}

// Health check
pub struct PerformHealthCheckRequest {
    pub timeout: u64,  // default: 5000ms
}

pub struct PerformHealthCheckResponse {
    pub success: bool,
    pub health: Option<HealthCheckResponse>,
    pub error: Option<String>,
}

// Events (emitted to frontend)
pub struct GatewayProcessEventPayload {
    pub status: GatewayStatus,
    pub pid: Option<u32>,
    pub timestamp: String,  // ISO 8601
    pub message: Option<String>,
}

// Errors
pub struct GatewayIpcError {
    pub code: String,       // ERR_GATEWAY_NOT_RUNNING, etc.
    pub message: String,
    pub details: Option<serde_json::Value>,
}
```

**Error Codes**:
- `ERR_GATEWAY_NOT_RUNNING`
- `ERR_GATEWAY_ALREADY_RUNNING`
- `ERR_GATEWAY_START_FAILED`
- `ERR_GATEWAY_STOP_FAILED`
- `ERR_HEALTH_CHECK_FAILED`
- `ERR_HEALTH_CHECK_TIMEOUT`

---

## 2. mDNS Types

### Core Types (`src-tauri/src/gateway/types.rs`)

```rust
pub struct MDnsConfig {
    pub enabled: bool,
    pub service_name: String,       // "EdwinPAI Gateway"
    pub service_type: String,       // "_edwinpai._tcp"
    pub domain: String,             // "local."
    pub port: u16,
    pub txt_records: Option<HashMap<String, String>>,
}

pub struct MDnsStatus {
    pub active: bool,
    pub service_name: Option<String>,
    pub port: Option<u16>,
}
```

### Manager (`src-tauri/src/mdns.rs`)

```rust
pub struct MdnsManager {
    // Advertises service on LAN
    pub fn advertise(&self, public_key: String, version: String) -> Result<()>;
    pub fn stop_advertising(&self) -> Result<()>;
    pub async fn discover_gateways(&self, timeout_secs: u64) -> Result<Vec<DiscoveredGateway>>;
}

pub struct DiscoveredGateway {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub public_key: Option<String>,
    pub version: Option<String>,
    pub addresses: Vec<String>,
}
```

### IPC Types (`src-tauri/src/gateway/ipc_types.rs`)

```rust
pub struct StartMDnsRequest {
    pub config: MDnsConfig,
}

pub struct StopMDnsRequest {}

pub struct GetMDnsStatusResponse {
    pub status: MDnsStatus,
}
```

---

## 3. System Tray Types

### Core Types (`src-tauri/src/tray/types.rs`)

```rust
// Menu item type
pub enum TrayMenuItemType {
    Normal | Separator | Submenu | Checkbox
}

// Menu item ID (13 actions)
pub enum TrayMenuItemId {
    ShowWindow | HideWindow | NewConversation |
    GatewayStatus | StartGateway | StopGateway | RestartGateway |
    SubscriptionStatus | CheckSubscription |
    Settings | About | CheckForUpdates | Quit
}

// Menu item definition
pub struct TrayMenuItem {
    pub id: TrayMenuItemId,
    #[serde(rename = "type")]
    pub item_type: TrayMenuItemType,
    pub label: String,
    pub enabled: bool,
    pub checked: Option<bool>,
    pub children: Option<Vec<TrayMenuItem>>,
    pub accelerator: Option<String>,  // "Ctrl+N"
    pub icon: Option<String>,
}

// Complete menu
pub struct TrayMenu {
    pub items: Vec<TrayMenuItem>,
}

// Dynamic state (drives menu construction)
pub struct TrayMenuState {
    pub window_visible: bool,
    pub gateway_running: bool,
    pub gateway_healthy: bool,
    pub subscription_active: bool,
    pub update_available: bool,
}

impl TrayMenuState {
    pub fn build_menu(&self) -> TrayMenu {
        // Dynamically constructs menu based on state
        // - Show/Hide toggle
        // - New Conversation (enabled if gateway + subscription)
        // - Gateway submenu (Start/Stop/Restart)
        // - Subscription submenu
        // - Settings, About, Updates, Quit
    }
}
```

### IPC Types

```rust
pub struct UpdateTrayMenuRequest {
    pub state: TrayMenuState,
}

pub struct GetTrayMenuStateResponse {
    pub state: TrayMenuState,
}

pub struct SetTrayIconRequest {
    pub icon: TrayIconType,  // Default | Active | Warning | Error
}

pub struct SetTrayTooltipRequest {
    pub tooltip: String,
}
```

### Event Types

```rust
pub struct MenuItemClickedEventPayload {
    pub item_id: TrayMenuItemId,
    pub timestamp: String,
}

pub struct TrayIconClickedEventPayload {
    pub button: MouseButton,  // Left | Right | Middle
    pub timestamp: String,
}
```

---

## 4. Configuration Types

**⚠️ NEW MODULE NEEDED**: `src-tauri/src/config/types.rs`

### Rust Mirror of TypeScript Config

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    Light | Dark | System
}

pub struct ChatConfig {
    #[serde(rename = "enableStreaming")]
    pub enable_streaming: bool,
    pub temperature: f64,          // 0.0-1.0
    #[serde(rename = "maxTokens")]
    pub max_tokens: u32,
}

pub struct GatewayConfigSubset {
    #[serde(rename = "autoRestart")]
    pub auto_restart: bool,
    #[serde(rename = "maxRestarts")]
    pub max_restarts: u32,
    #[serde(rename = "healthCheckInterval")]
    pub health_check_interval: u64,  // milliseconds
}

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

### Config File Path

```rust
use tauri::api::path::app_data_dir;

fn get_config_path(config: &tauri::Config) -> PathBuf {
    app_data_dir(config)
        .expect("failed to resolve app data dir")
        .join("desktop-config.json")
}
```

**Platform Paths**:
- Linux: `~/.local/share/com.edwinpai.desktop/desktop-config.json`
- macOS: `~/Library/Application Support/com.edwinpai.desktop/desktop-config.json`
- Windows: `%APPDATA%\com.edwinpai.desktop\desktop-config.json`

### Config IPC Types

```rust
pub struct GetConfigResponse {
    pub config: DesktopConfig,
}

pub struct UpdateConfigRequest {
    pub updates: serde_json::Value,  // Partial config
}

pub struct UpdateConfigResponse {
    pub config: DesktopConfig,
}

pub struct ResetConfigResponse {
    pub config: DesktopConfig,
}
```

---

## 5. Module Exports

### Gateway (`src-tauri/src/gateway/mod.rs`)

```rust
pub use types::{
    GatewayConfig, GatewayProcessInfo, GatewayStatus,
    HealthCheckResponse, HealthStatus,
    MDnsConfig, MDnsStatus,
};

pub use ipc_types::{
    StartGatewayRequest, StartGatewayResponse,
    StopGatewayRequest, StopGatewayResponse,
    GetGatewayStatusResponse,
    PerformHealthCheckRequest, PerformHealthCheckResponse,
    GatewayProcessEventPayload,
    GatewayIpcError, GatewayIpcResult,
};
```

### Tray (`src-tauri/src/tray/mod.rs`)

```rust
pub use types::{
    TrayMenu, TrayMenuItem, TrayMenuItemId, TrayMenuState,
    UpdateTrayMenuRequest, UpdateTrayMenuResponse,
    SetTrayIconRequest, SetTrayTooltipRequest,
    MenuItemClickedEventPayload,
};
```

### Config (`src-tauri/src/config/mod.rs`) — **NEW**

```rust
pub use types::{
    DesktopConfig, ChatConfig, GatewayConfigSubset, ThemePreference,
    GetConfigResponse, UpdateConfigRequest, UpdateConfigResponse,
};
```

---

## 6. Implementation Imports

### Gateway Commands

```rust
// src-tauri/src/commands/gateway.rs
use crate::gateway::{
    StartGatewayRequest, StartGatewayResponse,
    StopGatewayRequest, StopGatewayResponse,
    GetGatewayStatusResponse,
    PerformHealthCheckRequest, PerformHealthCheckResponse,
    GatewayIpcError, GatewayIpcResult,
};

#[tauri::command]
pub async fn start_gateway(req: StartGatewayRequest) -> Result<StartGatewayResponse, GatewayIpcError> {
    // Implementation
}
```

### Tray Commands

```rust
// src-tauri/src/commands/tray.rs
use crate::tray::{
    TrayMenuState, UpdateTrayMenuRequest, UpdateTrayMenuResponse,
    SetTrayIconRequest, SetTrayTooltipRequest,
};

#[tauri::command]
pub async fn update_tray_state(req: UpdateTrayMenuRequest) -> Result<UpdateTrayMenuResponse> {
    // Implementation
}
```

### Config Commands

```rust
// src-tauri/src/commands/config.rs
use crate::config::{
    DesktopConfig, GetConfigResponse,
    UpdateConfigRequest, UpdateConfigResponse,
};

#[tauri::command]
pub async fn get_config() -> Result<GetConfigResponse> {
    // Read from desktop-config.json
}
```

### mDNS Commands

```rust
// src-tauri/src/commands/discovery.rs
use crate::mdns::{MdnsManager, DiscoveredGateway};
use crate::gateway::{StartMDnsRequest, StopMDnsRequest};

#[tauri::command]
pub async fn advertise_gateway(req: StartMDnsRequest) -> Result<()> {
    // Call MdnsManager::advertise()
}
```

---

## 7. Testing Status

### Gateway Types (9 tests) ✅
- Serialization formats (lowercase enums, camelCase fields)
- Default values (port 3000, 5 max restarts, 30s health checks)
- State machine initialization

### Gateway IPC (8 tests) ✅
- Request defaults (port 3000, autoRestart true, 5s timeout)
- Response serialization (success, pid, message)
- Error constructors (7 error codes)
- Event payload timestamps (ISO 8601)

### Tray Types (6 tests) ✅
- Menu state defaults (window visible, gateway stopped)
- Dynamic menu construction (Show/Hide toggle, gateway submenu)
- Menu item ID serialization (snake_case)

### mDNS (5 tests) ✅
- Service name generation (EdwinPAI-{hostname})
- Service type format (_edwinpai._tcp.local.)
- Discovered gateway serialization

**Total**: 28 unit tests passing ✅

---

## 8. Tauri Command Registration

**File**: `src-tauri/src/lib.rs`

```rust
.invoke_handler(tauri::generate_handler![
    // ... Phase 1-2 commands ...

    // Gateway commands
    commands::gateway::start_gateway,
    commands::gateway::stop_gateway,
    commands::gateway::get_gateway_status,
    commands::gateway::gateway_health_check,
    commands::gateway::is_gateway_running,

    // Tray commands
    commands::tray::update_tray_state,
    commands::tray::setup_tray,
    commands::tray::get_tray_state,

    // mDNS commands
    commands::discovery::advertise_gateway,
    commands::discovery::stop_advertising,
    commands::discovery::discover_gateways,

    // Config commands (NEW)
    commands::config::get_config,
    commands::config::update_config,
    commands::config::reset_config,
])
```

---

## 9. Dependencies

### Cargo.toml

```toml
[dependencies]
# Existing Phase 1-2 deps
secp256k1 = { version = "0.29", features = ["rand"] }
sha2 = "0.10"
hmac = "0.12"
keyring = "3.2"
hex = "0.4"
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2.2", features = ["unstable"] }

# Phase 3 additions
mdns-sd = "0.11"       # mDNS service discovery
hostname = "0.4"       # System hostname
tokio = { version = "1", features = ["full"] }  # Already in Tauri
```

---

## 10. Remaining Work

### Config Module ⚠️
- [ ] Create `src-tauri/src/config/mod.rs`
- [ ] Create `src-tauri/src/config/types.rs`
- [ ] Implement `get_config()`, `update_config()`, `reset_config()`
- [ ] Add unit tests (file I/O, validation, sanitization)

### Command Implementations ⚠️
- [ ] `commands/gateway.rs` — Gateway lifecycle (start/stop/status/health)
- [ ] `commands/tray.rs` — Tray menu updates
- [ ] `commands/discovery.rs` — mDNS advertising
- [ ] `commands/config.rs` — Config persistence

### Integration Tests ⚠️
- [ ] Gateway start → health check → stop lifecycle
- [ ] Tray menu state synchronization
- [ ] Config persistence across app restarts
- [ ] mDNS service registration and discovery

---

## 11. Cross-Reference

**TypeScript Types**:
- `src/types/gateway.ts` ↔ `src-tauri/src/gateway/types.rs`
- `src/types/tray.ts` ↔ `src-tauri/src/tray/types.rs`
- `src/types/config.ts` ↔ `src-tauri/src/config/types.rs` (NEW)

**Field Name Convention**:
- Rust: `snake_case` with `#[serde(rename = "camelCase")]`
- JSON: `camelCase` (matches TypeScript)
- Enum variants: `lowercase` (e.g., `"running"`, `"stopped"`)

---

## 12. Key Decisions

1. **Gateway State Machine**: 6 states (Stopped → Starting → Running → [Unhealthy/Crashed] → Stopping → Stopped)
2. **Health Check**: HTTP GET `/health` every 30s with 5s timeout
3. **Auto-Restart**: Max 5 attempts with exponential backoff (not yet implemented)
4. **mDNS Service Type**: `_edwinpai._tcp.local.` with TXT records for public key and version
5. **Tray Menu**: Dynamically constructed from `TrayMenuState` (gateway status, subscription, window visibility)
6. **Config Path**: Uses Tauri's `app_data_dir()` for cross-platform consistency
7. **Error Handling**: All IPC commands return `Result<T, GatewayIpcError>` with structured error codes

---

## 13. References

- **Full Specification**: See `PHASE3_RUST_TYPE_DEFINITIONS.md` (8,200 words)
- **TypeScript Contracts**: `src/types/*.ts`
- **Phase 1 Pattern**: `crypto_domain/` module structure
- **Tauri Docs**: [IPC](https://tauri.app/v2/develop/calling-rust/), [Events](https://tauri.app/v2/develop/calling-frontend/)

---

**Status**: ✅ All types defined and tested. Ready for command implementation.
