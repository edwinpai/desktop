# Gateway Type System Flow

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (TypeScript)                    │
│                      src/types/gateway.ts                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC (Tauri invoke)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Tauri Commands (Rust)                         │
│                  src/commands/gateway.rs                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - start_gateway()                                        │  │
│  │ - stop_gateway()                                         │  │
│  │ - restart_gateway()                                      │  │
│  │ - get_gateway_status()                                   │  │
│  │ - gateway_health_check()                                 │  │
│  │ - is_gateway_running()                                   │  │
│  └────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             │ Uses GatewayManager
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Gateway Domain Layer                          │
│                    src/gateway/                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ process.rs - GatewayManager                              │  │
│  │   - spawn_process()                                      │  │
│  │   - health_check()                                       │  │
│  │   - start_health_check_polling()                         │  │
│  │   - retry_with_backoff()                                 │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│                            │ Imports types from                  │
│                            │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │ types.rs (Domain Types - Source of Truth)               │  │
│  │   - GatewayStatus (enum)                                 │  │
│  │   - GatewayProcessInfo                                   │  │
│  │   - GatewayProcessState                                  │  │
│  │   - GatewayConfig                                        │  │
│  │   - HealthCheckConfig                                    │  │
│  │   - HealthCheckResponse                                  │  │
│  │   - MDnsConfig                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ipc_types.rs (IPC Message Types)                         │  │
│  │   - StartGatewayRequest/Response                         │  │
│  │   - StopGatewayRequest/Response                          │  │
│  │   - GetGatewayStatusRequest/Response                     │  │
│  │   - PerformHealthCheckRequest/Response                   │  │
│  │   - GatewayProcessEventPayload                           │  │
│  │   - GatewayIpcError                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ Spawns child process
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Gateway Process (Separate Binary)             │
│                    edwinpai-gateway                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ HTTP Server on port 3000                                 │  │
│  │   GET /health → HealthCheckResponse                      │  │
│  │   POST /chat/completions → SSE stream                    │  │
│  │   GET /identity → Identity info                          │  │
│  │   GET /subscription → Subscription status                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Type Import Flow

### Domain Types (types.rs)

**Exported by**: `src/gateway/types.rs`

**Consumed by**:
- `src/gateway/process.rs` (GatewayManager implementation)
- `src/gateway/ipc_types.rs` (re-exports for IPC layer)
- `src/commands/gateway.rs` (Tauri commands)

**Key Types**:
```rust
// Process state
pub enum GatewayStatus { Stopped, Starting, Running, Unhealthy, Stopping, Crashed }
pub struct GatewayProcessInfo { status, pid, port, started_at, last_health_check, restart_count, uptime }
pub struct GatewayProcessState { info, child_handle, health_check_handle, auto_restart_enabled, max_restarts }

// Configuration
pub struct GatewayConfig { port, auto_start, auto_restart, max_restarts, health_check_interval, health_check_timeout, mdns }
pub struct HealthCheckConfig { interval_ms, timeout_ms, max_failures }

// Health check
pub enum HealthStatus { Healthy, Degraded, Unhealthy }
pub struct HealthCheckResponse { status, timestamp, uptime, version, services }
pub struct HealthCheckServices { chat, identity, subscription }

// mDNS
pub struct MDnsConfig { enabled, service_name, service_type, domain, port, txt_records }
pub struct MDnsStatus { active, service_name, port }
pub struct MDnsState { config, status, service_handle }
```

### IPC Types (ipc_types.rs)

**Exported by**: `src/gateway/ipc_types.rs`

**Consumed by**:
- `src/commands/gateway.rs` (Tauri commands)
- Frontend via Tauri IPC (TypeScript types mirror these)

**Key Types**:
```rust
// Request/Response pairs
StartGatewayRequest { port, auto_restart } → StartGatewayResponse { success, pid, port, message }
StopGatewayRequest { force, timeout } → StopGatewayResponse { success, message }
GetGatewayStatusRequest {} → GetGatewayStatusResponse { info: GatewayProcessInfo }
PerformHealthCheckRequest { timeout } → PerformHealthCheckResponse { success, health, error }

// Events (emitted to frontend)
GatewayProcessEventPayload { status, pid, timestamp, message }

// Errors
GatewayIpcError { code, message, details }
```

### Process Manager (process.rs)

**Exports**: `GatewayManager`

**Imports from**:
- `super::types::*` - Domain types
- `super::ipc_types::GatewayIpcError` - Error handling

**Key Methods**:
```rust
pub fn new(binary_path: Option<String>, config: Option<GatewayConfig>) -> Self
pub fn start(&self) -> Result<u32, String>
pub fn stop(&self) -> Result<(), String>
pub fn restart(&self) -> Result<u32, String>
pub fn status(&self) -> GatewayProcessInfo
pub fn is_running(&self) -> bool
pub async fn health_check(&self) -> Result<bool, String>
pub fn start_health_check_polling(&self)
pub async fn retry_with_backoff<F, T>(&self, operation: F, max_retries: u32) -> Result<T, String>
```

### Tauri Commands (commands/gateway.rs)

**Imports from**:
- `crate::gateway::GatewayManager` - Process manager
- `crate::gateway::GatewayProcessInfo` - Response type

**Exports** (Tauri commands):
```rust
#[tauri::command]
pub async fn start_gateway(binary_path: Option<String>, port: Option<u16>) -> Result<u32, String>

#[tauri::command]
pub async fn stop_gateway() -> Result<(), String>

#[tauri::command]
pub async fn restart_gateway() -> Result<u32, String>

#[tauri::command]
pub async fn get_gateway_status() -> Result<GatewayProcessInfo, String>

#[tauri::command]
pub async fn gateway_health_check() -> Result<bool, String>

#[tauri::command]
pub async fn is_gateway_running() -> Result<bool, String>
```

## Data Flow Example: Starting Gateway

```
1. Frontend calls: await invoke('start_gateway', { port: 3000 })
   ↓
2. Tauri routes to: commands::gateway::start_gateway()
   ↓
3. Command acquires: GATEWAY_MANAGER.lock()
   ↓
4. Command calls: manager.start() → Result<u32, String>
   ↓
5. GatewayManager:
   - Checks state (must be Stopped/Crashed)
   - Updates state to Starting
   - Calls spawn_process()
     * Creates tokio::process::Command
     * Spawns child process
     * Gets PID
   - Updates state to Running with PID
   - Returns PID
   ↓
6. Command calls: manager.start_health_check_polling()
   ↓
7. Background task spawned:
   - Polls /health every 30s
   - Tracks consecutive failures
   - Implements exponential backoff (1s → 60s)
   - Updates state to Unhealthy after 3 failures
   ↓
8. Command returns: Ok(12345) // PID
   ↓
9. Frontend receives: { data: 12345, error: null }
```

## Type Consistency Guarantees

### Serde Attributes

All types use consistent serde attributes:
```rust
// Enum serialization: lowercase strings
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GatewayStatus { Stopped, Starting, Running }
// → JSON: "stopped", "starting", "running"

// CamelCase conversion for TypeScript
#[derive(Deserialize)]
pub struct StartGatewayRequest {
    #[serde(rename = "autoRestart")]
    pub auto_restart: bool,
}
// → JSON: { "autoRestart": true } → Rust: auto_restart: true

// Optional field omission
#[derive(Serialize)]
pub struct Response {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
// → JSON: {} if None, { "message": "..." } if Some
```

### Default Values

```rust
// Struct defaults
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

// Field-level defaults
fn default_port() -> u16 { 3000 }
fn default_auto_restart() -> bool { true }

#[derive(Deserialize)]
pub struct StartGatewayRequest {
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_auto_restart")]
    pub auto_restart: bool,
}
```

## Re-export Strategy

**Module hierarchy**:
```
src/gateway/
├── mod.rs          ← Re-exports everything for easy access
├── types.rs        ← Domain types (source of truth)
├── ipc_types.rs    ← IPC message types (imports from types.rs)
└── process.rs      ← GatewayManager (imports from types.rs)
```

**mod.rs exports**:
```rust
// Domain types
pub use types::{
    GatewayConfig, GatewayProcessInfo, GatewayStatus, HealthCheckConfig,
    HealthCheckResponse, HealthStatus, MDnsConfig, MDnsStatus,
};

// IPC types
pub use ipc_types::{
    StartGatewayRequest, StartGatewayResponse, GetGatewayStatusResponse,
    GatewayProcessEventPayload, GatewayIpcError, GatewayIpcResult,
};

// Process manager
pub use process::GatewayManager;
```

**Consumer import patterns**:
```rust
// Commands import from top-level gateway module
use crate::gateway::{GatewayManager, GatewayProcessInfo};

// Process manager imports from sibling modules
use super::types::{GatewayConfig, GatewayProcessInfo, GatewayStatus};
use super::ipc_types::GatewayIpcError;
```

## Type Safety Benefits

1. **Single Source of Truth**: All domain types defined once in `types.rs`
2. **Import Verification**: Compiler enforces correct imports from contracts
3. **Acyclic Dependencies**: Clear hierarchy prevents circular imports
4. **Consistent Serialization**: All types use same serde attributes
5. **Type Checking**: Rust compiler validates all type usage
6. **Frontend Mirroring**: TypeScript types can be generated from Rust types

---

**Type system complete and validated** ✅
All imports flow from contracts, no circular dependencies, full type safety maintained.
