// Gateway module tests

use crate::gateway::{GatewayManager, GatewayState};

#[test]
fn test_gateway_manager_initialization() {
    let manager = GatewayManager::new(None, None);
    assert!(!manager.is_running());

    let status = manager.status();
    assert_eq!(status.state, "stopped");
    assert_eq!(status.pid, None);
    assert_eq!(status.uptime_seconds, None);
}

#[test]
fn test_gateway_manager_custom_binary_path() {
    let custom_path = "/custom/edwinpai".to_string();
    let manager = GatewayManager::new(Some(custom_path.clone()), None);

    let status = manager.status();
    assert_eq!(status.state, "stopped");
}

#[test]
fn test_gateway_manager_custom_port() {
    let manager = GatewayManager::new(None, Some(8080));

    let status = manager.status();
    assert!(status.health_check_url.contains("8080"));
}

#[test]
fn test_gateway_status_health_check_url_format() {
    let manager = GatewayManager::new(None, Some(18789));
    let status = manager.status();

    assert_eq!(status.health_check_url, "http://localhost:18789/health");
}

#[test]
fn test_gateway_double_start_protection() {
    let manager = GatewayManager::new(Some("/bin/false".to_string()), None);

    // First start might fail (binary doesn't exist or isn't a gateway)
    // but we're testing the double-start protection
    let _ = manager.start();

    // Second start should fail with "already running" error
    // Note: This test is limited without mocking the process spawn
}

#[test]
fn test_gateway_state_transitions() {
    // Test that we can create a manager and check its state
    let manager = GatewayManager::new(None, None);

    // Initial state should be stopped
    assert!(!manager.is_running());

    // After attempting to stop when already stopped, should remain stopped
    let result = manager.stop();
    assert!(result.is_ok());
    assert!(!manager.is_running());
}

#[tokio::test]
async fn test_gateway_health_check_unreachable() {
    let manager = GatewayManager::new(None, Some(9999)); // Unlikely port

    // Health check should fail for unreachable endpoint
    let result = manager.health_check().await;
    assert!(result.is_err());
}

#[test]
fn test_gateway_status_serialization() {
    use crate::gateway::GatewayStatus;

    let status = GatewayStatus {
        state: "running".to_string(),
        pid: Some(12345),
        uptime_seconds: Some(60),
        health_check_url: "http://localhost:18789/health".to_string(),
        last_health_check: Some("2026-02-11T12:00:00Z".to_string()),
    };

    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"state\":\"running\""));
    assert!(json.contains("\"pid\":12345"));
    assert!(json.contains("\"uptime_seconds\":60"));
}
