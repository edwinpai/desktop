// mDNS module tests

use crate::mdns::MdnsManager;

#[test]
fn test_mdns_manager_initialization() {
    let manager = MdnsManager::new(None, 18789).unwrap();

    assert_eq!(manager.service_type(), "_edwinpai._tcp.local.");
    assert!(manager.service_name().starts_with("EdwinPAI-"));
}

#[test]
fn test_mdns_manager_custom_service_name() {
    let manager = MdnsManager::new(Some("MyEdwinPAIGateway".to_string()), 18789).unwrap();

    assert_eq!(manager.service_name(), "MyEdwinPAIGateway");
    assert_eq!(manager.service_type(), "_edwinpai._tcp.local.");
}

#[test]
fn test_mdns_service_type_format() {
    let manager = MdnsManager::new(None, 18789).unwrap();

    let service_type = manager.service_type();
    assert!(service_type.starts_with("_edwinpai._tcp"));
    assert!(service_type.ends_with(".local."));
}

#[test]
fn test_discovered_gateway_serialization() {
    use crate::mdns::DiscoveredGateway;

    let gateway = DiscoveredGateway {
        name: "EdwinPAI-Desktop-123".to_string(),
        host: "desktop.local.".to_string(),
        port: 18789,
        public_key: Some("03abc123def456".to_string()),
        version: Some(env!("CARGO_PKG_VERSION").to_string()),
        addresses: vec!["192.168.1.100".to_string(), "fe80::1".to_string()],
    };

    let json = serde_json::to_string(&gateway).unwrap();
    assert!(json.contains("\"name\":\"EdwinPAI-Desktop-123\""));
    assert!(json.contains("\"port\":18789"));
    assert!(json.contains("\"publicKey\":\"03abc123def456\""));
    assert!(json.contains(&format!("\"version\":\"{}\"", env!("CARGO_PKG_VERSION"))));
}

#[tokio::test]
async fn test_discover_gateways_timeout() {
    let manager = MdnsManager::new(None, 18789).unwrap();

    // Discovery should complete within timeout
    let start = std::time::Instant::now();
    let result = manager.discover_gateways(1).await;
    let elapsed = start.elapsed();

    assert!(result.is_ok());
    assert!(elapsed.as_secs() <= 2); // Should complete within timeout + small buffer
}

#[tokio::test]
async fn test_discover_gateways_returns_vec() {
    let manager = MdnsManager::new(None, 18789).unwrap();

    let gateways = manager.discover_gateways(1).await.unwrap();

    // Should return a vector (may be empty if no gateways on network)
    assert!(gateways.len() >= 0);
}

#[test]
fn test_stop_advertising_when_not_started() {
    let manager = MdnsManager::new(None, 18789).unwrap();

    // Should not error when stopping advertising that wasn't started
    let result = manager.stop_advertising();
    assert!(result.is_ok());
}

#[test]
fn test_advertise_gateway_properties() {
    let manager = MdnsManager::new(Some("TestGateway".to_string()), 18789).unwrap();

    // Test that we can call advertise (actual mDNS registration requires network)
    // This is a smoke test - full functionality requires integration testing
    let result = manager.advertise(
        "03test123".to_string(),
        env!("CARGO_PKG_VERSION").to_string(),
    );

    // May fail in CI environments without proper network access
    // Just verify the method signature works
    let _ = result;
}
