// Gateway process management commands (Phase 2/3)
//
// Tauri commands for starting, stopping, and monitoring the EdwinPAI gateway process.

use crate::gateway::{GatewayConfig, GatewayManager, GatewayProcessInfo};
use lazy_static::lazy_static;
use std::sync::Mutex;

lazy_static! {
    /// Global gateway manager singleton
    static ref GATEWAY_MANAGER: Mutex<GatewayManager> = {
        Mutex::new(GatewayManager::new(None, None))
    };
}

fn configure_legacy_gateway_manager(
    manager: &mut GatewayManager,
    binary_path: Option<String>,
    port: Option<u16>,
) {
    if binary_path.is_none() && port.is_none() {
        return;
    }

    let mut config = GatewayConfig::default();
    if let Some(port) = port {
        config.port = port;
        config.mdns.port = port;
    }

    *manager = GatewayManager::new(binary_path, Some(config));
}

/// Start the EdwinPAI gateway process
///
/// # Arguments
/// * `binary_path` - Optional path to gateway binary (defaults to bundled binary)
/// * `port` - Optional port number (defaults to 18789)
///
/// # Returns
/// * `Ok(pid)` - Process ID of started gateway
/// * `Err(message)` - Error message if start fails
#[tauri::command]
pub async fn start_gateway(
    binary_path: Option<String>,
    port: Option<u16>,
) -> Result<u32, String> {
    let mut manager = GATEWAY_MANAGER.lock()
        .map_err(|e| format!("Failed to acquire gateway manager lock: {}", e))?;

    if !manager.is_running() {
        configure_legacy_gateway_manager(&mut manager, binary_path, port);
    }

    // Start the gateway
    let pid = manager.start()?;

    // Start health check polling in background
    manager.start_health_check_polling();

    Ok(pid)
}

/// Stop the EdwinPAI gateway process
///
/// Sends SIGTERM to gracefully shut down the gateway.
/// Waits up to 5 seconds before force killing.
///
/// # Returns
/// * `Ok(())` - Gateway stopped successfully
/// * `Err(message)` - Error message if stop fails
#[tauri::command]
pub async fn stop_gateway() -> Result<(), String> {
    let manager = GATEWAY_MANAGER.lock()
        .map_err(|e| format!("Failed to acquire gateway manager lock: {}", e))?;

    manager.stop()
}

/// Restart the EdwinPAI gateway process
///
/// Stops the current gateway and starts a new one.
///
/// # Returns
/// * `Ok(pid)` - Process ID of restarted gateway
/// * `Err(message)` - Error message if restart fails
#[tauri::command]
pub async fn restart_gateway() -> Result<u32, String> {
    let manager = GATEWAY_MANAGER.lock()
        .map_err(|e| format!("Failed to acquire gateway manager lock: {}", e))?;

    let pid = manager.restart()?;

    // Start health check polling for the new process
    manager.start_health_check_polling();

    Ok(pid)
}

/// Get current gateway status
///
/// Returns detailed information about the gateway process state.
///
/// # Returns
/// * `Ok(status)` - Gateway process information
/// * `Err(message)` - Error message if status query fails
#[tauri::command]
pub async fn get_gateway_status() -> Result<GatewayProcessInfo, String> {
    let manager = GATEWAY_MANAGER.lock()
        .map_err(|e| format!("Failed to acquire gateway manager lock: {}", e))?;

    Ok(manager.status())
}

/// Perform a health check on the gateway
///
/// Sends HTTP probe to /health endpoint and checks response.
///
/// # Returns
/// * `Ok(true)` - Gateway is healthy
/// * `Ok(false)` - Gateway is unhealthy
/// * `Err(message)` - Health check request failed
#[tauri::command]
pub async fn gateway_health_check() -> Result<bool, String> {
    // Clone the Arc so we can release the lock before the async call
    let manager = {
        let lock = GATEWAY_MANAGER.lock()
            .map_err(|e| format!("Failed to acquire gateway manager lock: {}", e))?;
        lock.clone()
    };

    manager.health_check().await
}

/// Check if gateway is running
///
/// Quick status check without full health probe.
///
/// # Returns
/// * `Ok(true)` - Gateway process is running
/// * `Ok(false)` - Gateway process is not running
/// * `Err(message)` - Status check failed
#[tauri::command]
pub async fn is_gateway_running() -> Result<bool, String> {
    let manager = GATEWAY_MANAGER.lock()
        .map_err(|e| format!("Failed to acquire gateway manager lock: {}", e))?;

    Ok(manager.is_running())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_gateway_status() {
        let status = get_gateway_status().await.unwrap();
        // Initially should be stopped
        assert!(matches!(
            status.status,
            crate::gateway::GatewayStatus::Stopped
        ));
        assert_eq!(status.pid, None);
    }

    #[test]
    fn test_configure_legacy_gateway_manager_applies_port_override() {
        let mut manager = GatewayManager::new(None, None);
        configure_legacy_gateway_manager(&mut manager, None, Some(19191));

        let status = manager.status();
        assert_eq!(status.port, 19191);
    }

    #[tokio::test]
    async fn test_is_gateway_running() {
        let running = is_gateway_running().await.unwrap();
        // Initially should not be running
        assert!(!running);
    }

    #[tokio::test]
    async fn test_gateway_status_structure() {
        let status = get_gateway_status().await.unwrap();
        assert_eq!(status.port, 18789); // Default port
        assert_eq!(status.restart_count, 0);
    }

    #[tokio::test]
    async fn test_stop_gateway_when_not_running() {
        let result = stop_gateway().await;
        // Should return error when not running
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not running"));
    }

    #[tokio::test]
    async fn test_health_check_when_not_running() {
        let result = gateway_health_check().await;
        // Health check should fail when gateway is not running
        assert!(result.is_err());
    }
}
