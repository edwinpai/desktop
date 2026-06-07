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
use std::collections::HashMap;
use std::path::{Path, PathBuf};
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
        for arg in self.gateway_command_args() {
            cmd.arg(arg);
        }
        for (key, value) in self.gateway_command_env() {
            cmd.env(key, value);
        }
        cmd.stdout(Stdio::piped())
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

    fn gateway_command_args(&self) -> Vec<String> {
        vec![
            "gateway".to_string(),
            "--port".to_string(),
            self.port.to_string(),
        ]
    }

    fn gateway_command_env(&self) -> HashMap<String, String> {
        build_gateway_command_env(self.port)
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
            Ok(process_handle) => process_handle
                .as_ref()
                .map(|h| h.restart_count)
                .unwrap_or(0),
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

fn build_gateway_command_env(port: u16) -> HashMap<String, String> {
    let mut env = HashMap::new();
    let state_dir = resolve_state_dir();
    let config_path = std::env::var("EDWINPAI_CONFIG_PATH")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| state_dir.join("edwinpai.json"));

    env.insert("EDWINPAI_GATEWAY_PORT".to_string(), port.to_string());
    env.insert(
        "EDWINPAI_STATE_DIR".to_string(),
        state_dir.to_string_lossy().to_string(),
    );
    env.insert(
        "EDWINPAI_CONFIG_PATH".to_string(),
        config_path.to_string_lossy().to_string(),
    );
    env.insert(
        "SHAD_COLLECTION_PATH".to_string(),
        std::env::var("SHAD_COLLECTION_PATH")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| state_dir.join("workspace").to_string_lossy().to_string()),
    );
    env.insert(
        "RUST_LOG".to_string(),
        std::env::var("RUST_LOG")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "info".to_string()),
    );

    for (key, value) in read_dotenv_file(&state_dir.join(".env")) {
        env.entry(key).or_insert(value);
    }

    for key in [
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_OAUTH_TOKEN",
        "EDWINPAI_GATEWAY_TOKEN",
        "EDWINPAI_GATEWAY_PASSWORD",
        "BRAVE_API_KEY",
    ] {
        if let Ok(value) = std::env::var(key) {
            if !value.trim().is_empty() {
                env.insert(key.to_string(), value);
            }
        }
    }

    env
}

fn resolve_state_dir() -> PathBuf {
    std::env::var("EDWINPAI_STATE_DIR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".edwinpai")
        })
}

fn read_dotenv_file(path: &Path) -> HashMap<String, String> {
    let mut env = HashMap::new();
    let Ok(raw) = std::fs::read_to_string(path) else {
        return env;
    };

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some((raw_key, raw_value)) = trimmed.split_once('=') else {
            continue;
        };
        let key = raw_key.trim();
        if key.is_empty()
            || !key
                .chars()
                .all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
        {
            continue;
        }
        env.insert(key.to_string(), unquote_dotenv_value(raw_value.trim()));
    }

    env
}

fn unquote_dotenv_value(value: &str) -> String {
    if value.len() >= 2 {
        let bytes = value.as_bytes();
        if (bytes[0] == b'"' && bytes[value.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[value.len() - 1] == b'\'')
        {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_spawn_success() {
        // Use a simple command that exists on all platforms and tolerates extra args.
        #[cfg(unix)]
        let binary = "true";
        #[cfg(windows)]
        let binary = "cmd";

        let policy = RestartPolicy::default();
        let manager = LifecycleManager::new(binary.to_string(), 18789, policy);

        // Spawn should succeed
        let result = manager.spawn().await;
        assert!(result.is_ok());

        // Cleanup. The command may exit very quickly, so success is enough here.
        let _ = manager.stop().await;
    }

    #[test]
    fn test_gateway_command_args_use_cli_gateway_subcommand() {
        let policy = RestartPolicy::default();
        let manager = LifecycleManager::new("edwinpai".to_string(), 19001, policy);

        assert_eq!(
            manager.gateway_command_args(),
            vec![
                "gateway".to_string(),
                "--port".to_string(),
                "19001".to_string()
            ],
        );
    }

    #[test]
    fn test_gateway_command_env_matches_cli_service_safe_defaults() {
        let temp = tempfile::tempdir().unwrap();
        let state_dir = temp.path().join("state");
        std::fs::create_dir_all(&state_dir).unwrap();
        std::fs::write(
            state_dir.join(".env"),
            "OPENAI_API_KEY=sk-shared\nBRAVE_API_KEY='brave-shared'\n# ignored\n",
        )
        .unwrap();

        let previous_state_dir = std::env::var("EDWINPAI_STATE_DIR").ok();
        let previous_config_path = std::env::var("EDWINPAI_CONFIG_PATH").ok();
        let previous_shad = std::env::var("SHAD_COLLECTION_PATH").ok();
        let previous_openai = std::env::var("OPENAI_API_KEY").ok();
        let previous_brave = std::env::var("BRAVE_API_KEY").ok();

        std::env::set_var("EDWINPAI_STATE_DIR", &state_dir);
        std::env::remove_var("EDWINPAI_CONFIG_PATH");
        std::env::remove_var("SHAD_COLLECTION_PATH");
        std::env::remove_var("OPENAI_API_KEY");
        std::env::remove_var("BRAVE_API_KEY");

        let env = build_gateway_command_env(19001);

        assert_eq!(env.get("EDWINPAI_GATEWAY_PORT"), Some(&"19001".to_string()));
        assert_eq!(
            env.get("EDWINPAI_STATE_DIR"),
            Some(&state_dir.to_string_lossy().to_string())
        );
        assert_eq!(
            env.get("EDWINPAI_CONFIG_PATH"),
            Some(
                &state_dir
                    .join("edwinpai.json")
                    .to_string_lossy()
                    .to_string()
            )
        );
        assert_eq!(
            env.get("SHAD_COLLECTION_PATH"),
            Some(&state_dir.join("workspace").to_string_lossy().to_string())
        );
        assert_eq!(env.get("OPENAI_API_KEY"), Some(&"sk-shared".to_string()));
        assert_eq!(env.get("BRAVE_API_KEY"), Some(&"brave-shared".to_string()));

        restore_env("EDWINPAI_STATE_DIR", previous_state_dir);
        restore_env("EDWINPAI_CONFIG_PATH", previous_config_path);
        restore_env("SHAD_COLLECTION_PATH", previous_shad);
        restore_env("OPENAI_API_KEY", previous_openai);
        restore_env("BRAVE_API_KEY", previous_brave);
    }

    #[test]
    fn test_gateway_command_env_keeps_parent_env_over_shared_env_file() {
        let temp = tempfile::tempdir().unwrap();
        let state_dir = temp.path().join("state");
        std::fs::create_dir_all(&state_dir).unwrap();
        std::fs::write(state_dir.join(".env"), "OPENAI_API_KEY=sk-shared\n").unwrap();

        let previous_state_dir = std::env::var("EDWINPAI_STATE_DIR").ok();
        let previous_openai = std::env::var("OPENAI_API_KEY").ok();

        std::env::set_var("EDWINPAI_STATE_DIR", &state_dir);
        std::env::set_var("OPENAI_API_KEY", "sk-parent");

        let env = build_gateway_command_env(18789);
        assert_eq!(env.get("OPENAI_API_KEY"), Some(&"sk-parent".to_string()));

        restore_env("EDWINPAI_STATE_DIR", previous_state_dir);
        restore_env("OPENAI_API_KEY", previous_openai);
    }

    fn restore_env(key: &str, value: Option<String>) {
        if let Some(value) = value {
            std::env::set_var(key, value);
        } else {
            std::env::remove_var(key);
        }
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
