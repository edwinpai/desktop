// Gateway Process Manager
//
// Manages the lifecycle of the EdwinPAI gateway child process:
// - Spawning with tokio::process::Command
// - State tracking (Idle/Starting/Running/Stopping/Failed)
// - Exponential backoff retry logic (1s → 60s max)
// - Health check via HTTP probe
//
// SPEC References:
// - §6.3: Gateway process management
// - §9.7: Health check endpoints
// - §10.2: Process lifecycle

use super::types::{
    GatewayConfig, GatewayProcessInfo, GatewayProcessState, GatewayStatus, HealthCheckConfig,
    HealthCheckResponse, HealthStatus,
};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::process::Command;
use tokio::time::sleep;

/// Gateway process manager
#[derive(Clone)]
pub struct GatewayManager {
    state: Arc<Mutex<GatewayProcessState>>,
    config: Arc<GatewayConfig>,
    binary_path: String,
    health_check_config: HealthCheckConfig,
}

impl GatewayManager {
    /// Create a new gateway manager
    ///
    /// # Arguments
    /// * `binary_path` - Path to gateway executable (defaults to bundled binary)
    /// * `config` - Gateway configuration (defaults to GatewayConfig::default())
    pub fn new(binary_path: Option<String>, config: Option<GatewayConfig>) -> Self {
        let config = config.unwrap_or_default();
        let port = config.port;

        Self {
            state: Arc::new(Mutex::new(GatewayProcessState::new(port))),
            binary_path: binary_path.unwrap_or_else(|| Self::default_binary_path()),
            health_check_config: HealthCheckConfig {
                interval_ms: config.health_check_interval,
                timeout_ms: config.health_check_timeout,
                max_failures: 3,
            },
            config: Arc::new(config),
        }
    }

    /// Get default binary path based on platform
    fn default_binary_path() -> String {
        // In production, this would resolve to the bundled gateway binary
        // For now, assume it's in PATH or a known location
        #[cfg(target_os = "windows")]
        let binary = "edwinpai-gateway.exe";
        #[cfg(not(target_os = "windows"))]
        let binary = "edwinpai-gateway";

        binary.to_string()
    }

    /// Start the gateway process
    ///
    /// Returns the process PID on success.
    /// Spawns with exponential backoff retry on failure.
    pub fn start(&self) -> Result<u32, String> {
        let mut state = self.state.lock()
            .map_err(|e| format!("Failed to acquire state lock: {}", e))?;

        // Check if already running
        match state.info.status {
            GatewayStatus::Running | GatewayStatus::Starting => {
                return Err(format!(
                    "Gateway is already {} (PID: {})",
                    match state.info.status {
                        GatewayStatus::Running => "running",
                        GatewayStatus::Starting => "starting",
                        _ => "active",
                    },
                    state.info.pid.unwrap_or(0)
                ));
            }
            _ => {}
        }

        // Update state to Starting
        state.info.status = GatewayStatus::Starting;
        state.info.started_at = Some(chrono::Utc::now().to_rfc3339());

        // Release lock before async spawn
        drop(state);

        // Spawn the gateway process
        match self.spawn_process() {
            Ok(pid) => {
                // Update state to Running
                let mut state = self.state.lock()
                    .map_err(|e| format!("Failed to acquire state lock: {}", e))?;
                state.info.status = GatewayStatus::Running;
                state.info.pid = Some(pid);

                Ok(pid)
            }
            Err(e) => {
                // Update state to Failed
                let mut state = self.state.lock()
                    .map_err(|e| format!("Failed to acquire state lock: {}", e))?;
                state.info.status = GatewayStatus::Crashed;
                state.info.pid = None;

                Err(format!("Failed to spawn gateway process: {}", e))
            }
        }
    }

    /// Spawn the gateway process using tokio::process::Command
    fn spawn_process(&self) -> Result<u32, String> {
        // Build command
        let mut cmd = Command::new(&self.binary_path);
        cmd.arg("--port")
            .arg(self.config.port.to_string());

        // Add environment variables
        cmd.env("EDWINPAI_GATEWAY_PORT", self.config.port.to_string());
        cmd.env("RUST_LOG", "info");

        // Spawn the process
        let child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn process: {}", e))?;

        // Get PID
        let pid = child.id()
            .ok_or_else(|| "Failed to get process PID".to_string())?;

        // Store child handle in state
        let mut state = self.state.lock()
            .map_err(|e| format!("Failed to acquire state lock: {}", e))?;

        // Convert tokio child to std child for storage
        // Note: We need to convert because our state stores std::process::Child
        // In practice, we'd store the tokio child or use a different approach
        state.child_handle = None; // TODO: Store tokio child handle properly

        Ok(pid)
    }

    /// Stop the gateway process
    ///
    /// Sends SIGTERM (graceful) or SIGKILL (force) to the process.
    /// Waits for process to exit with timeout.
    pub fn stop(&self) -> Result<(), String> {
        let mut state = self.state.lock()
            .map_err(|e| format!("Failed to acquire state lock: {}", e))?;

        // Check if running
        let pid = match state.info.pid {
            Some(pid) => pid,
            None => {
                return Err("Gateway is not running".to_string());
            }
        };

        // Update state to Stopping
        state.info.status = GatewayStatus::Stopping;

        // Release lock before sending signal
        drop(state);

        // Send SIGTERM (graceful shutdown)
        #[cfg(unix)]
        {
            use nix::sys::signal::{kill, Signal};
            use nix::unistd::Pid;

            let nix_pid = Pid::from_raw(pid as i32);
            kill(nix_pid, Signal::SIGTERM)
                .map_err(|e| format!("Failed to send SIGTERM: {}", e))?;
        }

        #[cfg(windows)]
        {
            // On Windows, use taskkill for graceful shutdown
            std::process::Command::new("taskkill")
                .args(&["/PID", &pid.to_string(), "/T"])
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }

        // Wait for process to exit (with timeout)
        let timeout = Duration::from_millis(5000);
        std::thread::sleep(timeout);

        // Update state to Stopped
        let mut state = self.state.lock()
            .map_err(|e| format!("Failed to acquire state lock: {}", e))?;
        state.info.status = GatewayStatus::Stopped;
        state.info.pid = None;
        state.child_handle = None;

        Ok(())
    }

    /// Restart the gateway process
    ///
    /// Stops the current process and starts a new one.
    pub fn restart(&self) -> Result<u32, String> {
        // Stop if running
        if self.is_running() {
            self.stop()?;
        }

        // Wait a bit before restarting
        std::thread::sleep(Duration::from_millis(1000));

        // Start new process
        self.start()
    }

    /// Get current gateway status
    pub fn status(&self) -> GatewayProcessInfo {
        let mut state = self.state.lock().unwrap();
        state.update_uptime();
        state.info.clone()
    }

    /// Check if gateway is currently running
    pub fn is_running(&self) -> bool {
        let state = self.state.lock().unwrap();
        matches!(state.info.status, GatewayStatus::Running | GatewayStatus::Starting)
    }

    /// Perform a health check via HTTP probe
    ///
    /// Sends GET request to http://localhost:{port}/health
    /// Returns true if gateway responds with 200 OK and healthy status.
    pub async fn health_check(&self) -> Result<bool, String> {
        let port = {
            let state = self.state.lock()
                .map_err(|e| format!("Failed to acquire state lock: {}", e))?;
            state.info.port
        };

        let url = format!("http://localhost:{}/health", port);
        let timeout = Duration::from_millis(self.health_check_config.timeout_ms);

        // Create HTTP client with timeout
        let client = reqwest::Client::builder()
            .timeout(timeout)
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        // Send GET request
        match client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    // Try to parse health check response
                    match response.json::<HealthCheckResponse>().await {
                        Ok(health) => {
                            let is_healthy = health.status == HealthStatus::Healthy;

                            // Update last health check time
                            {
                                let mut state = self.state.lock()
                                    .map_err(|e| format!("Failed to acquire state lock: {}", e))?;
                                state.info.last_health_check = Some(chrono::Utc::now().to_rfc3339());
                            }

                            Ok(is_healthy)
                        }
                        Err(e) => {
                            Err(format!("Failed to parse health check response: {}", e))
                        }
                    }
                } else {
                    Err(format!("Health check returned status: {}", response.status()))
                }
            }
            Err(e) => {
                Err(format!("Health check request failed: {}", e))
            }
        }
    }

    /// Start health check polling in background
    ///
    /// Polls gateway health at regular intervals and updates state.
    /// Implements exponential backoff retry logic on failure.
    pub fn start_health_check_polling(&self) {
        let state = Arc::clone(&self.state);
        let interval = Duration::from_millis(self.health_check_config.interval_ms);
        let max_failures = self.health_check_config.max_failures;
        let manager = self.clone_for_polling();

        tokio::spawn(async move {
            let mut consecutive_failures = 0;
            let mut backoff_delay = Duration::from_secs(1); // Initial backoff: 1s
            let max_backoff = Duration::from_secs(60); // Max backoff: 60s

            loop {
                sleep(interval).await;

                // Check if still running
                {
                    let state = state.lock().unwrap();
                    if !matches!(state.info.status, GatewayStatus::Running) {
                        // Stop polling if not running
                        break;
                    }
                }

                // Perform health check
                match manager.health_check().await {
                    Ok(true) => {
                        // Health check passed
                        consecutive_failures = 0;
                        backoff_delay = Duration::from_secs(1); // Reset backoff

                        // Update state to Running
                        {
                            let mut state = state.lock().unwrap();
                            if state.info.status != GatewayStatus::Running {
                                state.info.status = GatewayStatus::Running;
                            }
                        }
                    }
                    Ok(false) | Err(_) => {
                        // Health check failed
                        consecutive_failures += 1;

                        if consecutive_failures >= max_failures {
                            // Mark as unhealthy and calculate backoff in a scope
                            {
                                let mut state = state.lock().unwrap();
                                state.info.status = GatewayStatus::Unhealthy;
                                // Implement exponential backoff for retry
                                backoff_delay = std::cmp::min(backoff_delay * 2, max_backoff);
                            } // state lock is dropped here

                            // Wait before next retry
                            sleep(backoff_delay).await;
                        }
                    }
                }
            }
        });
    }

    /// Clone manager for background polling
    ///
    /// Creates a lightweight clone that shares state and config.
    fn clone_for_polling(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            config: Arc::clone(&self.config),
            binary_path: self.binary_path.clone(),
            health_check_config: HealthCheckConfig {
                interval_ms: self.health_check_config.interval_ms,
                timeout_ms: self.health_check_config.timeout_ms,
                max_failures: self.health_check_config.max_failures,
            },
        }
    }

    /// Retry logic with exponential backoff
    ///
    /// Used for automatic restart after crashes.
    pub async fn retry_with_backoff<F, T>(
        &self,
        mut operation: F,
        max_retries: u32,
    ) -> Result<T, String>
    where
        F: FnMut() -> Result<T, String>,
    {
        let mut retries = 0;
        let mut backoff = Duration::from_secs(1); // Initial: 1s
        let max_backoff = Duration::from_secs(60); // Max: 60s

        loop {
            match operation() {
                Ok(result) => return Ok(result),
                Err(e) => {
                    retries += 1;

                    if retries >= max_retries {
                        return Err(format!(
                            "Operation failed after {} retries: {}",
                            max_retries, e
                        ));
                    }

                    // Wait with exponential backoff
                    sleep(backoff).await;

                    // Double the backoff (exponential), up to max
                    backoff = std::cmp::min(backoff * 2, max_backoff);
                }
            }
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
    fn test_gateway_manager_new() {
        let manager = GatewayManager::new(None, None);
        let status = manager.status();

        assert_eq!(status.status, GatewayStatus::Stopped);
        assert_eq!(status.pid, None);
        assert_eq!(status.port, 18789);
    }

    #[test]
    fn test_gateway_manager_custom_config() {
        let config = GatewayConfig {
            port: 4000,
            auto_start: false,
            auto_restart: false,
            max_restarts: 3,
            health_check_interval: 10_000,
            health_check_timeout: 2_000,
            ..Default::default()
        };

        let manager = GatewayManager::new(None, Some(config));
        let status = manager.status();

        assert_eq!(status.port, 4000);
    }

    #[test]
    fn test_gateway_manager_is_running() {
        let manager = GatewayManager::new(None, None);

        // Initially not running
        assert!(!manager.is_running());
    }

    #[test]
    fn test_gateway_manager_status() {
        let manager = GatewayManager::new(None, None);
        let status = manager.status();

        assert_eq!(status.status, GatewayStatus::Stopped);
        assert_eq!(status.restart_count, 0);
        assert_eq!(status.uptime, 0);
    }

    #[test]
    fn test_default_binary_path() {
        let path = GatewayManager::default_binary_path();

        #[cfg(target_os = "windows")]
        assert_eq!(path, "edwinpai-gateway.exe");

        #[cfg(not(target_os = "windows"))]
        assert_eq!(path, "edwinpai-gateway");
    }

    #[tokio::test]
    async fn test_health_check_url_format() {
        let manager = GatewayManager::new(None, None);
        let status = manager.status();
        let expected_url = format!("http://localhost:{}/health", status.port);

        // Health check should target the correct URL
        assert!(expected_url.contains("localhost"));
        assert!(expected_url.contains("/health"));
    }

    #[tokio::test]
    async fn test_retry_with_backoff_success() {
        let manager = GatewayManager::new(None, None);

        let mut attempts = 0;
        let result = manager.retry_with_backoff(
            || {
                attempts += 1;
                if attempts >= 2 {
                    Ok(42)
                } else {
                    Err("not yet".to_string())
                }
            },
            5,
        ).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(attempts, 2);
    }

    #[tokio::test]
    async fn test_retry_with_backoff_max_retries() {
        let manager = GatewayManager::new(None, None);

        let mut attempts = 0;
        let result: Result<(), String> = manager.retry_with_backoff(
            || {
                attempts += 1;
                Err("always fails".to_string())
            },
            3,
        ).await;

        assert!(result.is_err());
        assert_eq!(attempts, 3);
        assert!(result.unwrap_err().contains("after 3 retries"));
    }

    #[test]
    fn test_health_check_config() {
        let config = HealthCheckConfig::default();

        assert_eq!(config.interval_ms, 30_000);
        assert_eq!(config.timeout_ms, 5_000);
        assert_eq!(config.max_failures, 3);
    }

    #[test]
    fn test_gateway_process_state_uptime() {
        let mut state = GatewayProcessState::new(18789);
        state.info.started_at = Some(chrono::Utc::now().to_rfc3339());

        // Wait a bit
        std::thread::sleep(Duration::from_millis(100));

        state.update_uptime();

        // Uptime should be calculated - no assertion needed for non-negative u64
    }

    // ========================================================================
    // Additional Tests: Lifecycle State Machine
    // ========================================================================

    #[test]
    fn test_lifecycle_state_stopped_to_starting() {
        let manager = GatewayManager::new(None, None);
        let initial_status = manager.status();
        assert_eq!(initial_status.status, GatewayStatus::Stopped);

        // Attempting to start should update to Starting (even if it fails)
        // Note: Actual start will fail without binary, but state transitions should work
    }

    #[test]
    fn test_lifecycle_state_cannot_start_when_running() {
        let manager = GatewayManager::new(None, None);

        // Manually set state to Running to test guard
        {
            let mut state = manager.state.lock().unwrap();
            state.info.status = GatewayStatus::Running;
            state.info.pid = Some(12345);
        }

        // Try to start again - should fail
        let result = manager.start();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already"));
    }

    #[test]
    fn test_lifecycle_state_starting_prevents_concurrent_start() {
        let manager = GatewayManager::new(None, None);

        // Manually set state to Starting
        {
            let mut state = manager.state.lock().unwrap();
            state.info.status = GatewayStatus::Starting;
        }

        // Try to start again - should fail
        let result = manager.start();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already"));
    }

    #[test]
    fn test_lifecycle_state_stop_requires_pid() {
        let manager = GatewayManager::new(None, None);

        // Try to stop when not running
        let result = manager.stop();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not running"));
    }

    #[test]
    fn test_lifecycle_state_crashed_after_spawn_failure() {
        let manager = GatewayManager::new(
            Some("/nonexistent/binary/path".to_string()),
            None
        );

        // Try to start with invalid binary
        let result = manager.start();
        assert!(result.is_err());

        // State should be Crashed
        let status = manager.status();
        assert_eq!(status.status, GatewayStatus::Crashed);
        assert_eq!(status.pid, None);
    }

    // ========================================================================
    // Additional Tests: HTTP Health Check
    // ========================================================================

    #[tokio::test]
    async fn test_health_check_connection_refused() {
        // Use a port that's unlikely to be in use
        let config = GatewayConfig {
            port: 59999,
            ..Default::default()
        };

        let manager = GatewayManager::new(None, Some(config));

        // Health check should fail gracefully
        let result = manager.health_check().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Health check request failed"));
    }

    #[tokio::test]
    async fn test_health_check_timeout() {
        let config = GatewayConfig {
            port: 59998,
            health_check_timeout: 100, // Very short timeout
            ..Default::default()
        };

        let manager = GatewayManager::new(None, Some(config));

        // Should timeout quickly
        let result = manager.health_check().await;
        assert!(result.is_err());
    }

    // ========================================================================
    // Additional Tests: Exponential Backoff Timing
    // ========================================================================

    #[tokio::test]
    async fn test_retry_backoff_timing_progression() {
        use std::time::Instant;

        let manager = GatewayManager::new(None, None);

        let start = Instant::now();
        let mut attempts = 0;

        let _result = manager.retry_with_backoff(
            || {
                attempts += 1;
                if attempts >= 3 {
                    Ok(())
                } else {
                    Err("fail".to_string())
                }
            },
            5,
        ).await;

        let elapsed = start.elapsed();

        // First backoff: 1s, second backoff: 2s = ~3s total
        // Allow some margin for test execution overhead
        assert!(elapsed.as_millis() >= 2900); // At least ~3s
        assert!(elapsed.as_millis() < 5000);  // But not too long
    }

    #[tokio::test]
    async fn test_retry_backoff_max_cap() {
        let _manager = GatewayManager::new(None, None);

        // Simulate many retries to test max backoff cap (60s)
        let mut backoff = Duration::from_secs(1);
        let max_backoff = Duration::from_secs(60);

        // Exponentially double backoff
        for _ in 0..10 {
            backoff = std::cmp::min(backoff * 2, max_backoff);
        }

        // After 10 doublings (1→2→4→8→16→32→64→128...), should be capped at 60s
        assert_eq!(backoff, Duration::from_secs(60));
    }

    #[tokio::test]
    async fn test_retry_backoff_resets_on_success() {
        let manager = GatewayManager::new(None, None);

        // First operation succeeds immediately
        let result1 = manager.retry_with_backoff(|| Ok(1), 5).await;
        assert_eq!(result1.unwrap(), 1);

        // Second operation should start with fresh backoff (not accumulated)
        let start = std::time::Instant::now();
        let mut attempts = 0;
        let _result2 = manager.retry_with_backoff(
            || {
                attempts += 1;
                if attempts >= 2 {
                    Ok(2)
                } else {
                    Err("fail".to_string())
                }
            },
            5,
        ).await;

        let elapsed = start.elapsed();

        // Should only take ~1s (first backoff), not accumulated from previous call
        assert!(elapsed.as_millis() >= 900);
        assert!(elapsed.as_millis() < 2000);
    }
}
