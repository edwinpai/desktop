// mDNS LAN discovery commands (Phase 4)
//
// Tauri commands for advertising and discovering EdwinPAI gateways on the local network.

use crate::discovery::mdns::{MdnsService, DiscoveredGateway};
use lazy_static::lazy_static;
use std::sync::Mutex;

lazy_static! {
    /// Global mDNS manager singleton
    static ref MDNS_MANAGER: Mutex<Option<MdnsService>> = Mutex::new(None);
}

/// Advertise EdwinPAI gateway on the local network
#[tauri::command]
pub async fn advertise_gateway(
    public_key: String,
    version: String,
    port: Option<u16>,
    service_name: Option<String>,
) -> Result<(), String> {
    let mut manager_lock = MDNS_MANAGER.lock()
        .map_err(|e| format!("Failed to acquire mDNS manager lock: {}", e))?;

    // Create manager if it doesn't exist
    if manager_lock.is_none() {
        let manager = MdnsService::new(service_name, port.unwrap_or(18789), version.clone());
        *manager_lock = Some(manager);
    }

    let manager = manager_lock.as_ref().unwrap();
    manager.advertise(public_key)
}

/// Stop advertising EdwinPAI gateway
#[tauri::command]
pub async fn stop_advertising() -> Result<(), String> {
    let mut manager_lock = MDNS_MANAGER.lock()
        .map_err(|e| format!("Failed to acquire mDNS manager lock: {}", e))?;

    if let Some(manager) = manager_lock.take() {
        manager.stop_advertising()?;
    }

    Ok(())
}

/// Discover EdwinPAI gateways on the local network
#[tauri::command]
pub async fn discover_gateways(timeout_secs: Option<u64>) -> Result<Vec<DiscoveredGateway>, String> {
    // Create a temporary manager for discovery
    let manager = MdnsService::new(None, 18789, env!("CARGO_PKG_VERSION").to_string());
    manager.discover(timeout_secs).await
}

/// Get current service name being advertised
#[tauri::command]
pub async fn get_advertised_service_name() -> Result<Option<String>, String> {
    let manager_lock = MDNS_MANAGER.lock()
        .map_err(|e| format!("Failed to acquire mDNS manager lock: {}", e))?;

    Ok(manager_lock.as_ref().map(|m| m.service_name().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_advertised_service_name_none() {
        // Initially should be None
        let name = get_advertised_service_name().await.unwrap();
        assert!(name.is_none());
    }

    #[tokio::test]
    async fn test_discover_gateways_timeout() {
        // Should complete within timeout
        let result = discover_gateways(Some(1)).await;
        assert!(result.is_ok());
        let _gateways = result.unwrap();
        // May or may not find gateways depending on network - no assertion needed
    }
}
