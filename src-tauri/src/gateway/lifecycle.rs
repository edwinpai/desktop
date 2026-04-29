// Gateway Process Lifecycle Management
//
// Manages the lifecycle of the EdwinPAI gateway child process:
// - Spawning via tokio::process::Command
// - Capturing stdout/stderr streams
// - Monitoring Child process state
// - Exponential backoff restart logic with RestartPolicy
//
// SPEC References:
// - §6.3: Gateway process management
// - §10.2: Process lifecycle

use super::types::{ProcessHandle, RestartPolicy};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::time::{sleep, Duration};

/// Lifecycle manager for gateway process
pub struct LifecycleManager {
    binary_path: String,
    port: u16,
    process_handle: Arc<Mutex<Option<ProcessHandle>>>,
    restart_policy: RestartPolicy,
}

impl LifecycleManager {
    /// Create a new lifecycle manager
    pub fn new(binary_path: String, port: u16, restart_policy: RestartPolicy) -> Self {
        Self {
            binary_path,
            port,
            process_handle: Arc::new(Mutex::new(None)),
            restart_policy,
        }
    }

    /// Spawn the gateway process
    ///
    /// Returns PID on success.
    /// Captures stdout/stderr for log streaming.
    pub async fn spawn(&self) -> Result<u32, String> {
        let mut cmd = Command::new(&self.binary_path);
        cmd.arg("--port")
            .arg(self.port.to_string())
            .env("EDWINPAI_GATEWAY_PORT", self.port.to_string())
            .env("RUST_LOG", "info")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn process: {}", e))?;

        let pid = child
            .id()
            .ok_or_else(|| "Failed to get process PID".to_string())?;

        // Capture stdout/stderr
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Spawn tasks to read stdout/stderr
        if let Some(stdout) = stdout {
            tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    // TODO: Send to log manager
                    println!("[GATEWAY STDOUT] {}", line);
                }
            });
        }

        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    // TODO: Send to log manager
                    eprintln!("[GATEWAY STDERR] {}", line);
                }
            });
        }

        // Store process handle
        let handle = ProcessHandle {
            child,
            start_time: std::time::Instant::now(),
            restart_count: 0,
        };

        let mut process_handle = self
            .process_handle
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        *process_handle = Some(handle);

        Ok(pid)
    }

    /// Stop the gateway process
    ///
    /// Sends SIGTERM, waits 5s, then SIGKILL if needed.
    pub async fn stop(&self) -> Result<(), String> {
        let mut process_handle = self
            .process_handle
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        if let Some(handle) = process_handle.as_mut() {
            // Try graceful shutdown (SIGTERM)
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;

                if let Some(pid) = handle.child.id() {
                    let nix_pid = Pid::from_raw(pid as i32);
                    let _ = kill(nix_pid, Signal::SIGTERM);
                }
            }

            // Wait for graceful shutdown (5 seconds)
            let timeout = Duration::from_secs(5);
            let result = tokio::time::timeout(timeout, handle.child.wait()).await;

            match result {
                Ok(Ok(_)) => {
                    // Process exited gracefully
                }
                _ => {
                    // Force kill
                    let _ = handle.child.kill().await;
                    let _ = handle.child.wait().await;
                }
            }

            *process_handle = None;
            Ok(())
        } else {
            Err("Process not running".to_string())
        }
    }

    /// Restart with exponential backoff
    ///
    /// Implements RestartPolicy with exponential backoff.
    /// Returns new PID on success.
    pub async fn restart_with_backoff(&self, attempt: u32) -> Result<u32, String> {
        if attempt >= self.restart_policy.max_retries {
            return Err(format!(
                "Max restart attempts ({}) exceeded",
                self.restart_policy.max_retries
            ));
        }

        // Calculate backoff delay
        let delay_ms = self.restart_policy.calculate_delay(attempt);
        sleep(Duration::from_millis(delay_ms)).await;

        // Try to stop existing process
        let _ = self.stop().await;

        // Spawn new process
        match self.spawn().await {
            Ok(pid) => {
                // Update restart count
                let mut process_handle = self
                    .process_handle
                    .lock()
                    .map_err(|e| format!("Failed to acquire lock: {}", e))?;
                if let Some(handle) = process_handle.as_mut() {
                    handle.restart_count = attempt + 1;
                }
                Ok(pid)
            }
            Err(e) => Err(format!("Restart attempt {} failed: {}", attempt, e)),
        }
    }

    /// Get current process PID
    pub fn get_pid(&self) -> Option<u32> {
        let process_handle = self.process_handle.lock().ok()?;
        process_handle.as_ref()?.child.id()
    }

    /// Get restart count
    pub fn get_restart_count(&self) -> u32 {
        match self.process_handle.lock() {
            Ok(process_handle) => process_handle.as_ref().map(|h| h.restart_count).unwrap_or(0),
            Err(_) => 0,
        }
    }

    /// Check if process is running
    pub async fn is_running(&self) -> bool {
        let mut process_handle = match self.process_handle.lock() {
            Ok(handle) => handle,
            Err(_) => return false,
        };

        if let Some(handle) = process_handle.as_mut() {
            // Check if child process has exited
            match handle.child.try_wait() {
                Ok(Some(_)) => {
                    // Process has exited
                    *process_handle = None;
                    false
                }
                Ok(None) => {
                    // Still running
                    true
                }
                Err(_) => false,
            }
        } else {
            false
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_spawn_success() {
        // Use a simple command that exists on all platforms
        #[cfg(unix)]
        let binary = "sleep";
        #[cfg(windows)]
        let binary = "timeout";

        let policy = RestartPolicy::default();
        let manager = LifecycleManager::new(binary.to_string(), 18789, policy);

        // Spawn should succeed
        let result = manager.spawn().await;
        assert!(result.is_ok());

        // Should have PID
        assert!(manager.get_pid().is_some());

        // Cleanup
        let _ = manager.stop().await;
    }

    #[tokio::test]
    async fn test_spawn_failure() {
        let policy = RestartPolicy::default();
        let manager = LifecycleManager::new("/nonexistent/binary".to_string(), 18789, policy);

        // Spawn should fail
        let result = manager.spawn().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to spawn process"));
    }

    #[tokio::test]
    async fn test_restart_backoff() {
        let policy = RestartPolicy {
            max_retries: 3,
            base_delay_ms: 100,
            max_delay_ms: 1000,
        };

        // Test backoff calculation
        assert_eq!(policy.calculate_delay(0), 100); // 100ms
        assert_eq!(policy.calculate_delay(1), 200); // 200ms
        assert_eq!(policy.calculate_delay(2), 400); // 400ms
        assert_eq!(policy.calculate_delay(10), 1000); // capped at max_delay_ms
    }
}
