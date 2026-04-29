// Gateway Process Management - Rust Type Definitions
//
// Defines type contracts for:
// - Gateway process lifecycle (PID tracking, status monitoring)
// - Health check management
// - mDNS service advertising
// - Process state machine
//
// All implementation nodes MUST import from this module.

use serde::{Deserialize, Serialize};
use std::time::Instant;

// ============================================================================
// Gateway Process State
// ============================================================================

/// Gateway process states (aliases for backward compatibility)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GatewayStatus {
    /// Not running
    Stopped,
    /// Launch initiated, awaiting health check
    Starting,
    /// Healthy and responding
    Running,
    /// Process exists but health check failing
    Unhealthy,
    /// Shutdown initiated
    Stopping,
    /// Unexpected termination detected
    Crashed,
}

/// Gateway state enum (simplified state machine)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GatewayState {
    Stopped,
    Starting,
    Running,
    Unhealthy,
    Restarting,
}

impl From<GatewayStatus> for GatewayState {
    fn from(status: GatewayStatus) -> Self {
        match status {
            GatewayStatus::Stopped | GatewayStatus::Crashed => GatewayState::Stopped,
            GatewayStatus::Starting => GatewayState::Starting,
            GatewayStatus::Running => GatewayState::Running,
            GatewayStatus::Unhealthy => GatewayState::Unhealthy,
            GatewayStatus::Stopping => GatewayState::Stopped,
        }
    }
}

/// Process handle for managing child gateway process
#[derive(Debug)]
pub struct ProcessHandle {
    pub child: tokio::process::Child,
    pub start_time: Instant,
    pub restart_count: u32,
}

/// Gateway process information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayProcessInfo {
    pub status: GatewayStatus,
    pub pid: Option<u32>,
    pub port: u16,
    pub started_at: Option<String>, // ISO 8601 timestamp
    pub last_health_check: Option<String>, // ISO 8601 timestamp
    pub restart_count: u32,
    pub uptime: u64, // seconds
}

/// Internal gateway process state (not serialized to frontend)
pub struct GatewayProcessState {
    pub info: GatewayProcessInfo,
    pub child_handle: Option<std::process::Child>,
    pub health_check_handle: Option<tokio::task::JoinHandle<()>>,
    pub auto_restart_enabled: bool,
    pub max_restarts: u32,
}

impl GatewayProcessState {
    pub fn new(port: u16) -> Self {
        Self {
            info: GatewayProcessInfo {
                status: GatewayStatus::Stopped,
                pid: None,
                port,
                started_at: None,
                last_health_check: None,
                restart_count: 0,
                uptime: 0,
            },
            child_handle: None,
            health_check_handle: None,
            auto_restart_enabled: true,
            max_restarts: 5,
        }
    }

    pub fn update_uptime(&mut self) {
        if let Some(started_at_str) = &self.info.started_at {
            if let Ok(started_at) = chrono::DateTime::parse_from_rfc3339(started_at_str) {
                let now = chrono::Utc::now();
                self.info.uptime = (now.timestamp() - started_at.timestamp()) as u64;
            }
        }
    }
}

// ============================================================================
// Health Check
// ============================================================================

/// Health check response (from gateway HTTP endpoint)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub status: HealthStatus,
    pub timestamp: String, // ISO 8601
    pub uptime: u64,       // seconds
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

/// Health status tracking (for internal use)
#[derive(Debug, Clone)]
pub struct HealthStatusTracker {
    pub is_healthy: bool,
    pub last_check: Instant,
    pub response_time_ms: u64,
}

impl Default for HealthStatusTracker {
    fn default() -> Self {
        Self {
            is_healthy: false,
            last_check: Instant::now(),
            response_time_ms: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckServices {
    pub chat: bool,
    pub identity: bool,
    pub subscription: bool,
}

/// Health check configuration
#[derive(Clone)]
pub struct HealthCheckConfig {
    pub interval_ms: u64,
    pub timeout_ms: u64,
    pub max_failures: u32,
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            interval_ms: 30_000,  // 30 seconds
            timeout_ms: 5_000,    // 5 seconds
            max_failures: 3,
        }
    }
}

// ============================================================================
// Restart Policy
// ============================================================================

/// Restart policy configuration for gateway process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestartPolicy {
    pub max_retries: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
}

impl Default for RestartPolicy {
    fn default() -> Self {
        Self {
            max_retries: 5,
            base_delay_ms: 1_000,  // 1 second
            max_delay_ms: 30_000,  // 30 seconds
        }
    }
}

impl RestartPolicy {
    /// Calculate backoff delay with exponential backoff
    pub fn calculate_delay(&self, attempt: u32) -> u64 {
        let delay = self.base_delay_ms * 2u64.pow(attempt);
        delay.min(self.max_delay_ms)
    }
}

// Note: LogEntry and LogLevel types are defined in gateway/log.rs
// and re-exported via gateway/mod.rs for use across the gateway module

// ============================================================================
// mDNS Service Advertising
// ============================================================================

/// mDNS service configuration
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
            port: 18789,
            txt_records: None,
        }
    }
}

/// mDNS service status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MDnsStatus {
    pub active: bool,
    pub service_name: Option<String>,
    pub port: Option<u16>,
}

/// Internal mDNS state
pub struct MDnsState {
    pub config: MDnsConfig,
    pub status: MDnsStatus,
    pub service_handle: Option<()>, // Placeholder for actual mDNS service handle
}

impl MDnsState {
    pub fn new() -> Self {
        Self {
            config: MDnsConfig::default(),
            status: MDnsStatus {
                active: false,
                service_name: None,
                port: None,
            },
            service_handle: None,
        }
    }
}

// ============================================================================
// Gateway Configuration
// ============================================================================

/// Gateway configuration schema
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
            port: 18789,
            auto_start: true,
            auto_restart: true,
            max_restarts: 5,
            health_check_interval: 30_000, // 30 seconds
            health_check_timeout: 5_000,   // 5 seconds
            mdns: MDnsConfig::default(),
        }
    }
}

// Note: IPC message types (requests/responses/events) moved to ipc_types.rs
// This file contains only domain types and internal state structures

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gateway_status_serialization() {
        let status = GatewayStatus::Running;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"running\"");
    }

    #[test]
    fn test_gateway_process_info_default() {
        let state = GatewayProcessState::new(18789);
        assert_eq!(state.info.status, GatewayStatus::Stopped);
        assert_eq!(state.info.port, 18789);
        assert_eq!(state.info.restart_count, 0);
    }

    #[test]
    fn test_health_check_config_default() {
        let config = HealthCheckConfig::default();
        assert_eq!(config.interval_ms, 30_000);
        assert_eq!(config.timeout_ms, 5_000);
        assert_eq!(config.max_failures, 3);
    }

    #[test]
    fn test_mdns_config_default() {
        let config = MDnsConfig::default();
        assert_eq!(config.service_name, "EdwinPAI Gateway");
        assert_eq!(config.service_type, "_edwinpai._tcp");
        assert_eq!(config.port, 18789);
    }

    #[test]
    fn test_gateway_config_serialization() {
        let config = GatewayConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"port\":18789"));
        assert!(json.contains("\"auto_start\":true"));
    }

    #[test]
    fn test_gateway_state_enum() {
        let state = GatewayState::Running;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"running\"");
    }

    #[test]
    fn test_gateway_state_from_status() {
        assert_eq!(GatewayState::from(GatewayStatus::Running), GatewayState::Running);
        assert_eq!(GatewayState::from(GatewayStatus::Crashed), GatewayState::Stopped);
        assert_eq!(GatewayState::from(GatewayStatus::Unhealthy), GatewayState::Unhealthy);
    }

    #[test]
    fn test_restart_policy_default() {
        let policy = RestartPolicy::default();
        assert_eq!(policy.max_retries, 5);
        assert_eq!(policy.base_delay_ms, 1_000);
        assert_eq!(policy.max_delay_ms, 30_000);
    }

    #[test]
    fn test_restart_policy_backoff() {
        let policy = RestartPolicy::default();
        assert_eq!(policy.calculate_delay(0), 1_000);  // 1 second
        assert_eq!(policy.calculate_delay(1), 2_000);  // 2 seconds
        assert_eq!(policy.calculate_delay(2), 4_000);  // 4 seconds
        assert_eq!(policy.calculate_delay(3), 8_000);  // 8 seconds
        assert_eq!(policy.calculate_delay(4), 16_000); // 16 seconds
        assert_eq!(policy.calculate_delay(10), 30_000); // capped at max_delay_ms
    }

    #[test]
    fn test_health_status_tracker_default() {
        let tracker = HealthStatusTracker::default();
        assert!(!tracker.is_healthy);
        assert_eq!(tracker.response_time_ms, 0);
    }

    // Note: LogEntry and LogLevel tests are in gateway/log.rs
}
