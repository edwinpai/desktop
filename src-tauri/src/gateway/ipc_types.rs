// Gateway IPC Bridge Types (SPEC §6.3)
//
// Serde-compatible request/response structs matching src/types/gateway.ts
// These types form the contract between the frontend and Rust backend for gateway process management.

use serde::{Deserialize, Serialize};

// Re-export core types from types.rs
pub use super::types::{
    GatewayConfig, GatewayProcessInfo, GatewayStatus, HealthCheckResponse, HealthStatus,
    MDnsConfig, MDnsStatus,
};

// ============================================================================
// Gateway Process Lifecycle Commands
// ============================================================================

/// Start gateway process request
#[derive(Debug, Clone, Deserialize)]
pub struct StartGatewayRequest {
    /// Port to run gateway on (default: 18789)
    #[serde(default = "default_port")]
    pub port: u16,
    /// Enable auto-restart on crash (default: true)
    #[serde(default = "default_auto_restart", rename = "autoRestart")]
    pub auto_restart: bool,
}

fn default_port() -> u16 {
    18789
}

fn default_auto_restart() -> bool {
    true
}

/// Start gateway response
#[derive(Debug, Clone, Serialize)]
pub struct StartGatewayResponse {
    pub success: bool,
    pub pid: u32,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Stop gateway request
#[derive(Debug, Clone, Deserialize)]
pub struct StopGatewayRequest {
    /// Force kill (SIGKILL) if true, graceful (SIGTERM) if false
    #[serde(default)]
    pub force: bool,
    /// Timeout in milliseconds before force kill (default: 5000)
    #[serde(default = "default_timeout")]
    pub timeout: u64,
}

fn default_timeout() -> u64 {
    5000
}

/// Stop gateway response
#[derive(Debug, Clone, Serialize)]
pub struct StopGatewayResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Get gateway status request (empty struct)
#[derive(Debug, Clone, Deserialize)]
pub struct GetGatewayStatusRequest {}

/// Get gateway status response
#[derive(Debug, Clone, Serialize)]
pub struct GetGatewayStatusResponse {
    pub info: GatewayProcessInfo,
}

// ============================================================================
// Health Check Commands
// ============================================================================

/// Perform health check request
#[derive(Debug, Clone, Deserialize)]
pub struct PerformHealthCheckRequest {
    /// Timeout in milliseconds (default: 5000)
    #[serde(default = "default_health_timeout")]
    pub timeout: u64,
}

fn default_health_timeout() -> u64 {
    5000
}

/// Perform health check response
#[derive(Debug, Clone, Serialize)]
pub struct PerformHealthCheckResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health: Option<HealthCheckResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ============================================================================
// mDNS Commands
// ============================================================================

/// Start mDNS advertising request
#[derive(Debug, Clone, Deserialize)]
pub struct StartMDnsRequest {
    pub config: MDnsConfig,
}

/// Start mDNS advertising response
#[derive(Debug, Clone, Serialize)]
pub struct StartMDnsResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Stop mDNS advertising request (empty struct)
#[derive(Debug, Clone, Deserialize)]
pub struct StopMDnsRequest {}

/// Stop mDNS advertising response
#[derive(Debug, Clone, Serialize)]
pub struct StopMDnsResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Get mDNS status request (empty struct)
#[derive(Debug, Clone, Deserialize)]
pub struct GetMDnsStatusRequest {}

/// Get mDNS status response
#[derive(Debug, Clone, Serialize)]
pub struct GetMDnsStatusResponse {
    pub status: MDnsStatus,
}

// ============================================================================
// Event Payloads (for Tauri event emissions)
// ============================================================================

/// Gateway process event payload (emitted to frontend via Tauri events)
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

// ============================================================================
// Error Types
// ============================================================================

/// Gateway IPC error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayIpcError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl GatewayIpcError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    // Common error constructors
    pub fn gateway_not_running() -> Self {
        Self::new("ERR_GATEWAY_NOT_RUNNING", "Gateway process is not running")
    }

    pub fn gateway_already_running(pid: u32) -> Self {
        Self::new(
            "ERR_GATEWAY_ALREADY_RUNNING",
            format!("Gateway is already running (PID: {})", pid),
        )
    }

    pub fn gateway_start_failed(reason: &str) -> Self {
        Self::new(
            "ERR_GATEWAY_START_FAILED",
            format!("Failed to start gateway: {}", reason),
        )
    }

    pub fn gateway_stop_failed(reason: &str) -> Self {
        Self::new(
            "ERR_GATEWAY_STOP_FAILED",
            format!("Failed to stop gateway: {}", reason),
        )
    }

    pub fn health_check_failed(reason: &str) -> Self {
        Self::new(
            "ERR_HEALTH_CHECK_FAILED",
            format!("Health check failed: {}", reason),
        )
    }

    pub fn health_check_timeout() -> Self {
        Self::new("ERR_HEALTH_CHECK_TIMEOUT", "Health check timed out")
    }

    pub fn mdns_start_failed(reason: &str) -> Self {
        Self::new(
            "ERR_MDNS_START_FAILED",
            format!("Failed to start mDNS advertising: {}", reason),
        )
    }

    pub fn mdns_stop_failed(reason: &str) -> Self {
        Self::new(
            "ERR_MDNS_STOP_FAILED",
            format!("Failed to stop mDNS advertising: {}", reason),
        )
    }

    pub fn mdns_not_running() -> Self {
        Self::new("ERR_MDNS_NOT_RUNNING", "mDNS advertising is not active")
    }

    pub fn internal_error(reason: &str) -> Self {
        Self::new("ERR_INTERNAL", format!("Internal error: {}", reason))
    }
}

impl std::fmt::Display for GatewayIpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for GatewayIpcError {}

pub type GatewayIpcResult<T> = Result<T, GatewayIpcError>;

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_start_gateway_request_defaults() {
        let json = r#"{"port": 18789}"#;
        let req: StartGatewayRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.port, 18789);
        assert!(req.auto_restart);
    }

    #[test]
    fn test_start_gateway_request_explicit() {
        let json = r#"{"port": 4000, "autoRestart": false}"#;
        let req: StartGatewayRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.port, 4000);
        assert!(!req.auto_restart);
    }

    #[test]
    fn test_start_gateway_response_serialization() {
        let resp = StartGatewayResponse {
            success: true,
            pid: 12345,
            port: 18789,
            message: Some("Gateway started successfully".to_string()),
        };

        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"pid\":12345"));
        assert!(json.contains("\"port\":18789"));
    }

    #[test]
    fn test_stop_gateway_request_defaults() {
        let json = r#"{}"#;
        let req: StopGatewayRequest = serde_json::from_str(json).unwrap();
        assert!(!req.force);
        assert_eq!(req.timeout, 5000);
    }

    #[test]
    fn test_perform_health_check_request_defaults() {
        let json = r#"{}"#;
        let req: PerformHealthCheckRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.timeout, 5000);
    }

    #[test]
    fn test_gateway_process_event_payload() {
        let event = GatewayProcessEventPayload::new(
            GatewayStatus::Running,
            Some(12345),
            Some("Gateway is healthy".to_string()),
        );

        assert_eq!(event.status, GatewayStatus::Running);
        assert_eq!(event.pid, Some(12345));
        assert!(event.timestamp.contains("T")); // ISO 8601 format
    }

    #[test]
    fn test_gateway_ipc_error_constructors() {
        let err = GatewayIpcError::gateway_not_running();
        assert_eq!(err.code, "ERR_GATEWAY_NOT_RUNNING");

        let err2 = GatewayIpcError::gateway_already_running(12345);
        assert!(err2.message.contains("12345"));

        let err3 = GatewayIpcError::health_check_failed("connection refused");
        assert!(err3.message.contains("connection refused"));
    }

    #[test]
    fn test_gateway_ipc_error_serialization() {
        let err = GatewayIpcError::new("ERR_TEST", "Test error")
            .with_details(serde_json::json!({"pid": 12345}));

        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"code\":\"ERR_TEST\""));
        assert!(json.contains("\"message\":\"Test error\""));
        assert!(json.contains("\"details\""));
    }

    #[test]
    fn test_empty_request_structs() {
        let json = r#"{}"#;
        let _req1: GetGatewayStatusRequest = serde_json::from_str(json).unwrap();
        let _req2: StopMDnsRequest = serde_json::from_str(json).unwrap();
        let _req3: GetMDnsStatusRequest = serde_json::from_str(json).unwrap();
        // Just verify they deserialize without error
    }
}
