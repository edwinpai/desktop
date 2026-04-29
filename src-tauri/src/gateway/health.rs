// Gateway Health Check Manager
//
// Manages continuous health monitoring of the gateway process:
// - tokio::spawn polling loop
// - reqwest GET /v1/status endpoint
// - Arc<Mutex<GatewayState>> updates
// - Failure tracking and automatic restart
//
// SPEC References:
// - §9.7: Health check endpoints
// - §6.3: Gateway process management

use super::types::{GatewayStatus, HealthCheckConfig, HealthCheckResponse, HealthStatus};
use std::sync::{Arc, Mutex};
use tokio::time::{sleep, Duration};

/// Health check state
#[derive(Debug, Clone)]
pub struct HealthState {
    pub status: GatewayStatus,
    pub last_check: Option<chrono::DateTime<chrono::Utc>>,
    pub consecutive_failures: u32,
    pub is_healthy: bool,
}

impl Default for HealthState {
    fn default() -> Self {
        Self {
            status: GatewayStatus::Stopped,
            last_check: None,
            consecutive_failures: 0,
            is_healthy: false,
        }
    }
}

/// Health check manager
pub struct HealthManager {
    port: u16,
    config: HealthCheckConfig,
    state: Arc<Mutex<HealthState>>,
    client: reqwest::Client,
}

impl HealthManager {
    /// Create a new health manager
    pub fn new(port: u16, config: HealthCheckConfig) -> Self {
        let timeout = Duration::from_millis(config.timeout_ms);
        let client = reqwest::Client::builder()
            .timeout(timeout)
            .build()
            .expect("Failed to create HTTP client");

        Self {
            port,
            config,
            state: Arc::new(Mutex::new(HealthState::default())),
            client,
        }
    }

    /// Start health check polling loop
    ///
    /// Spawns a background task that polls the gateway health endpoint.
    /// Updates shared state with Arc<Mutex<HealthState>>.
    pub fn start_polling(&self) -> tokio::task::JoinHandle<()> {
        let port = self.port;
        let config = self.config.clone();
        let state = Arc::clone(&self.state);
        let client = self.client.clone();

        tokio::spawn(async move {
            loop {
                // Perform health check
                let result = Self::check_health(&client, port).await;

                // Update state
                {
                    let mut health_state = state.lock().unwrap();
                    health_state.last_check = Some(chrono::Utc::now());

                    match result {
                        Ok(response) => {
                            health_state.is_healthy = response.status == HealthStatus::Healthy;
                            health_state.consecutive_failures = 0;

                            if health_state.is_healthy {
                                health_state.status = GatewayStatus::Running;
                            } else {
                                health_state.status = GatewayStatus::Unhealthy;
                            }
                        }
                        Err(_) => {
                            health_state.is_healthy = false;
                            health_state.consecutive_failures += 1;

                            if health_state.consecutive_failures >= config.max_failures {
                                health_state.status = GatewayStatus::Unhealthy;
                            }
                        }
                    }
                }

                // Sleep until next check
                sleep(Duration::from_millis(config.interval_ms)).await;
            }
        })
    }

    /// Perform a single health check
    async fn check_health(
        client: &reqwest::Client,
        port: u16,
    ) -> Result<HealthCheckResponse, String> {
        let url = format!("http://localhost:{}/v1/status", port);

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Health check request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Health check returned status: {}", response.status()));
        }

        let health = response
            .json::<HealthCheckResponse>()
            .await
            .map_err(|e| format!("Failed to parse health response: {}", e))?;

        Ok(health)
    }

    /// Get current health state
    pub fn get_state(&self) -> HealthState {
        self.state.lock().unwrap().clone()
    }

    /// Manual health check (one-off, not polling)
    pub async fn check_once(&self) -> Result<HealthCheckResponse, String> {
        Self::check_health(&self.client, self.port).await
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_manager_new() {
        let config = HealthCheckConfig::default();
        let manager = HealthManager::new(18789, config);

        let state = manager.get_state();
        assert_eq!(state.status, GatewayStatus::Stopped);
        assert!(!state.is_healthy);
        assert_eq!(state.consecutive_failures, 0);
    }

    #[tokio::test]
    async fn test_health_check_failure() {
        let config = HealthCheckConfig {
            interval_ms: 1000,
            timeout_ms: 100,
            max_failures: 3,
        };

        let manager = HealthManager::new(9999, config); // Non-existent port

        // Should fail (no server running)
        let result = manager.check_once().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_health_state_updates() {
        let config = HealthCheckConfig {
            interval_ms: 100,
            timeout_ms: 50,
            max_failures: 2,
        };

        let manager = HealthManager::new(9999, config);

        // Start polling
        let handle = manager.start_polling();

        // Wait for a few checks
        sleep(Duration::from_millis(250)).await;

        // State should show failures
        let state = manager.get_state();
        assert!(state.consecutive_failures > 0);
        assert!(!state.is_healthy);

        // Cleanup
        handle.abort();
    }

    #[test]
    fn test_health_state_default() {
        let state = HealthState::default();
        assert_eq!(state.status, GatewayStatus::Stopped);
        assert!(!state.is_healthy);
        assert_eq!(state.consecutive_failures, 0);
        assert!(state.last_check.is_none());
    }

    #[tokio::test]
    async fn test_health_poll_update() {
        let config = HealthCheckConfig {
            interval_ms: 50,
            timeout_ms: 25,
            max_failures: 3,
        };

        let manager = HealthManager::new(9999, config);
        let handle = manager.start_polling();

        // Initial state
        let state = manager.get_state();
        assert_eq!(state.consecutive_failures, 0);

        // Wait for health checks to run
        sleep(Duration::from_millis(200)).await;

        // Should have failures now
        let state = manager.get_state();
        assert!(state.consecutive_failures > 0);
        assert!(state.last_check.is_some());

        handle.abort();
    }

    #[test]
    fn test_health_check_config() {
        let config = HealthCheckConfig {
            interval_ms: 30_000,
            timeout_ms: 5_000,
            max_failures: 3,
        };

        assert_eq!(config.interval_ms, 30_000);
        assert_eq!(config.timeout_ms, 5_000);
        assert_eq!(config.max_failures, 3);
    }
}
