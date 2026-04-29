// Gateway Process Management Module
//
// Entry point for gateway process lifecycle, health checks, and mDNS advertising.
// Exports public types and modules for use by IPC commands.

pub mod discovery;
pub mod health;
pub mod ipc_types;
pub mod lifecycle;
pub mod log;
pub mod logs;
pub mod process;
pub mod types;

// Re-export primary domain types for convenience
pub use types::{
    GatewayConfig, GatewayProcessInfo, GatewayProcessState, GatewayState, GatewayStatus,
    HealthCheckConfig, HealthCheckResponse, HealthStatus, HealthStatusTracker, MDnsConfig,
    MDnsState, MDnsStatus, ProcessHandle, RestartPolicy,
};

// Re-export log types (NEW in Phase 7)
pub use log::{GetGatewayLogsRequest, GetGatewayLogsResponse, LogEntry, LogLevel, LogQueryFilters};

// Re-export IPC message types from ipc_types
pub use ipc_types::{
    GetGatewayStatusRequest, GetGatewayStatusResponse, GetMDnsStatusRequest,
    GetMDnsStatusResponse, PerformHealthCheckRequest, PerformHealthCheckResponse,
    StartGatewayRequest, StartGatewayResponse, StartMDnsRequest, StartMDnsResponse,
    StopGatewayRequest, StopGatewayResponse,
};

// Re-export event types from ipc_types
pub use ipc_types::GatewayProcessEventPayload;

// Re-export error types from ipc_types
pub use ipc_types::{GatewayIpcError, GatewayIpcResult};

// Re-export process manager
pub use process::GatewayManager;

// Re-export discovery functions
pub use discovery::find_edwinpai_binary;

// Re-export new Phase 7 modules
pub use health::{HealthManager, HealthState};
pub use lifecycle::LifecycleManager;
pub use logs::LogRingBuffer;
