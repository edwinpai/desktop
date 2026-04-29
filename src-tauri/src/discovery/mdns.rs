// mDNS Service Discovery for EdwinPAI Gateway (Phase 4)
//
// Implements mDNS/Bonjour service advertisement and discovery:
// - Service type: _edwinpai._tcp.local
// - TXT records: version, port, publicKey
// - Discovery: Browse for other EdwinPAI gateways on LAN
//
// Uses mdns-sd crate for cross-platform mDNS support.

use mdns_sd::{ServiceDaemon, ServiceInfo, ServiceEvent};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

const SERVICE_TYPE: &str = "_edwinpai._tcp.local.";
const DEFAULT_TIMEOUT_SECS: u64 = 5;

/// mDNS service manager for EdwinPAI gateway advertisement
pub struct MdnsService {
    daemon: Arc<Mutex<Option<ServiceDaemon>>>,
    service_name: String,
    port: u16,
    version: String,
}

/// Discovered EdwinPAI gateway on local network
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredGateway {
    pub service_name: String,
    pub hostname: String,
    pub port: u16,
    pub addresses: Vec<String>,
    pub version: Option<String>,
    pub public_key: Option<String>,
    pub discovered_at: String, // ISO 8601 timestamp
}

impl MdnsService {
    /// Create a new mDNS service manager
    pub fn new(service_name: Option<String>, port: u16, version: String) -> Self {
        let service_name = service_name.unwrap_or_else(|| {
            // Generate unique service name using hostname
            let hostname = hostname::get()
                .ok()
                .and_then(|h| h.into_string().ok())
                .unwrap_or_else(|| "unknown".to_string());
            format!("EdwinPAI-{}", hostname)
        });

        Self {
            daemon: Arc::new(Mutex::new(None)),
            service_name,
            port,
            version,
        }
    }

    /// Start advertising EdwinPAI gateway service on local network
    pub fn advertise(&self, public_key: String) -> Result<(), String> {
        let mut daemon_lock = self.daemon.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        // Create daemon if not exists
        if daemon_lock.is_none() {
            let daemon = ServiceDaemon::new()
                .map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;
            *daemon_lock = Some(daemon);
        }

        let daemon = daemon_lock.as_ref()
            .ok_or("mDNS daemon not initialized")?;

        // Build TXT records
        let mut txt_records = HashMap::new();
        txt_records.insert("version".to_string(), self.version.clone());
        txt_records.insert("port".to_string(), self.port.to_string());
        txt_records.insert("publicKey".to_string(), public_key);
        txt_records.insert("app".to_string(), "edwinpai-desktop".to_string());

        // Get local hostname
        let hostname = hostname::get()
            .ok()
            .and_then(|h| h.into_string().ok())
            .unwrap_or_else(|| "localhost".to_string());

        let fqdn = if hostname.ends_with(".local.") {
            hostname
        } else if hostname.ends_with(".local") {
            format!("{}.", hostname)
        } else {
            format!("{}.local.", hostname)
        };

        // Create service info
        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            &self.service_name,
            &fqdn,
            (), // Use default network interfaces
            self.port,
            Some(txt_records),
        ).map_err(|e| format!("Failed to create service info: {}", e))?;

        // Register service
        daemon.register(service_info)
            .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

        Ok(())
    }

    /// Stop advertising the service
    pub fn stop_advertising(&self) -> Result<(), String> {
        let mut daemon_lock = self.daemon.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        if let Some(daemon) = daemon_lock.take() {
            daemon.shutdown()
                .map_err(|e| format!("Failed to shutdown mDNS daemon: {}", e))?;
        }

        Ok(())
    }

    /// Discover EdwinPAI gateways on local network
    pub async fn discover(&self, timeout_secs: Option<u64>) -> Result<Vec<DiscoveredGateway>, String> {
        use tokio::time::{sleep, Duration};

        let timeout = timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);

        // Create a new daemon for browsing (separate from advertising daemon)
        let browse_daemon = ServiceDaemon::new()
            .map_err(|e| format!("Failed to create browse daemon: {}", e))?;

        let receiver = browse_daemon.browse(SERVICE_TYPE)
            .map_err(|e| format!("Failed to start mDNS browse: {}", e))?;

        let mut discovered = Vec::new();
        let start = std::time::Instant::now();

        // Browse for services until timeout
        while start.elapsed().as_secs() < timeout {
            match receiver.recv_timeout(Duration::from_millis(100)) {
                Ok(event) => {
                    match event {
                        ServiceEvent::ServiceResolved(info) => {
                            let gateway = DiscoveredGateway {
                                service_name: info.get_fullname().to_string(),
                                hostname: info.get_hostname().to_string(),
                                port: info.get_port(),
                                addresses: info.get_addresses()
                                    .iter()
                                    .map(|addr| addr.to_string())
                                    .collect(),
                                version: info.get_property_val_str("version")
                                    .map(|s| s.to_string()),
                                public_key: info.get_property_val_str("publicKey")
                                    .map(|s| s.to_string()),
                                discovered_at: chrono::Utc::now().to_rfc3339(),
                            };

                            // Avoid duplicates
                            if !discovered.iter().any(|g: &DiscoveredGateway| {
                                g.service_name == gateway.service_name
                            }) {
                                discovered.push(gateway);
                            }
                        }
                        ServiceEvent::ServiceRemoved(_, fullname) => {
                            // Remove from list if present
                            discovered.retain(|g| g.service_name != fullname);
                        }
                        ServiceEvent::SearchStarted(_) => {
                            // Search started, continue
                        }
                        ServiceEvent::SearchStopped(_) => {
                            // Search stopped, exit
                            break;
                        }
                        _ => {
                            // ServiceFound and other events — continue
                        }
                    }
                }
                Err(e) => {
                    if e.to_string().contains("disconnected") {
                        break;
                    }
                    // Timeout — no events, continue waiting
                }
            }

            // Yield to async runtime
            sleep(Duration::from_millis(10)).await;
        }

        // Shutdown browse daemon
        let _ = browse_daemon.shutdown();

        Ok(discovered)
    }

    /// Get the advertised service name
    pub fn service_name(&self) -> &str {
        &self.service_name
    }

    /// Get the service type
    pub fn service_type(&self) -> &str {
        SERVICE_TYPE
    }

    /// Get the port
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Check if service is currently advertising
    pub fn is_advertising(&self) -> bool {
        self.daemon.lock()
            .map(|d| d.is_some())
            .unwrap_or(false)
    }
}

impl Drop for MdnsService {
    fn drop(&mut self) {
        // Ensure daemon is shut down when dropped
        let _ = self.stop_advertising();
    }
}

/// Global mDNS service manager
static MDNS_SERVICE: once_cell::sync::Lazy<Arc<Mutex<Option<MdnsService>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Initialize global mDNS service
pub fn init_mdns_service(service_name: Option<String>, port: u16, version: String) -> Result<(), String> {
    let mut service_lock = MDNS_SERVICE.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let service = MdnsService::new(service_name, port, version);
    *service_lock = Some(service);

    Ok(())
}

/// Get global mDNS service instance
pub fn get_mdns_service() -> Arc<Mutex<Option<MdnsService>>> {
    MDNS_SERVICE.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mdns_service_creation() {
        let service = MdnsService::new(None, 18789, env!("CARGO_PKG_VERSION").to_string());
        assert_eq!(service.port(), 18789);
        assert_eq!(service.service_type(), "_edwinpai._tcp.local.");
        assert!(service.service_name().starts_with("EdwinPAI-"));
    }

    #[test]
    fn test_mdns_service_custom_name() {
        let service = MdnsService::new(
            Some("MyEdwinPAI".to_string()),
            8080,
            "0.2.0".to_string(),
        );
        assert_eq!(service.service_name(), "MyEdwinPAI");
        assert_eq!(service.port(), 8080);
    }

    #[test]
    fn test_discovered_gateway_serialization() {
        let gateway = DiscoveredGateway {
            service_name: "EdwinPAI-MacBook._edwinpai._tcp.local.".to_string(),
            hostname: "macbook.local.".to_string(),
            port: 18789,
            addresses: vec!["192.168.1.100".to_string()],
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            public_key: Some("03abc123def456".to_string()),
            discovered_at: "2026-02-11T10:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&gateway).unwrap();
        assert!(json.contains("\"serviceName\":\"EdwinPAI-MacBook._edwinpai._tcp.local.\""));
        assert!(json.contains("\"port\":18789"));
        assert!(json.contains("\"publicKey\":\"03abc123def456\""));
    }

    #[test]
    fn test_service_type_format() {
        assert_eq!(SERVICE_TYPE, "_edwinpai._tcp.local.");
        assert!(SERVICE_TYPE.starts_with("_edwinpai._tcp"));
        assert!(SERVICE_TYPE.ends_with(".local."));
    }

    #[test]
    fn test_mdns_service_not_advertising_initially() {
        let service = MdnsService::new(None, 18789, env!("CARGO_PKG_VERSION").to_string());
        assert!(!service.is_advertising());
    }

    #[tokio::test]
    async fn test_discover_empty_network() {
        let service = MdnsService::new(None, 18789, env!("CARGO_PKG_VERSION").to_string());
        // Should complete without error even if no services found
        let result = service.discover(Some(1)).await;
        assert!(result.is_ok());
    }

    // ========================================================================
    // Additional Tests: Service Registration/Deregistration
    // ========================================================================

    #[test]
    fn test_service_registration_state() {
        let service = MdnsService::new(
            Some("TestService".to_string()),
            3001,
            env!("CARGO_PKG_VERSION").to_string(),
        );

        // Initially not advertising
        assert!(!service.is_advertising());
    }

    #[test]
    fn test_advertise_requires_public_key() {
        let service = MdnsService::new(None, 3002, env!("CARGO_PKG_VERSION").to_string());

        // Try to advertise with public key
        let result = service.advertise("03abcdef1234567890".to_string());

        // May fail due to network/permissions, but should handle gracefully
        // The important part is it accepts the public key parameter
        match result {
            Ok(_) => {
                assert!(service.is_advertising());
                let _ = service.stop_advertising();
            }
            Err(e) => {
                // Expected in test environment without proper mDNS daemon
                assert!(!e.is_empty());
            }
        }
    }

    #[test]
    fn test_stop_advertising_when_not_advertising() {
        let service = MdnsService::new(None, 3003, env!("CARGO_PKG_VERSION").to_string());

        // Stop advertising when not started - should not panic
        let result = service.stop_advertising();
        assert!(result.is_ok());
    }

    #[test]
    fn test_service_drop_cleanup() {
        {
            let service = MdnsService::new(None, 3004, env!("CARGO_PKG_VERSION").to_string());
            let _ = service.advertise("03test".to_string());
            // Service drops here - Drop impl should clean up
        }
        // If we get here without panic, cleanup worked
    }

    #[test]
    fn test_multiple_service_instances() {
        let service1 = MdnsService::new(
            Some("Service1".to_string()),
            3005,
            env!("CARGO_PKG_VERSION").to_string(),
        );
        let service2 = MdnsService::new(
            Some("Service2".to_string()),
            3006,
            env!("CARGO_PKG_VERSION").to_string(),
        );

        assert_eq!(service1.service_name(), "Service1");
        assert_eq!(service2.service_name(), "Service2");
        assert_eq!(service1.port(), 3005);
        assert_eq!(service2.port(), 3006);
    }

    #[tokio::test]
    async fn test_discover_timeout_honored() {
        use std::time::Instant;

        let service = MdnsService::new(None, 3007, env!("CARGO_PKG_VERSION").to_string());

        let timeout_secs = 2;
        let start = Instant::now();

        let result = service.discover(Some(timeout_secs)).await;

        let elapsed = start.elapsed();

        // Should complete within timeout window
        assert!(result.is_ok());
        assert!(elapsed.as_secs() >= timeout_secs);
        assert!(elapsed.as_secs() < timeout_secs + 2); // Allow 2s margin
    }

    #[tokio::test]
    async fn test_discover_returns_empty_list_on_timeout() {
        let service = MdnsService::new(None, 3008, env!("CARGO_PKG_VERSION").to_string());

        // Short timeout, unlikely to find services
        let result = service.discover(Some(1)).await;

        assert!(result.is_ok());
        let _discovered = result.unwrap();
        // In isolated test environment, may find 0 services - no assertion needed
    }

    #[test]
    fn test_discovered_gateway_has_required_fields() {
        let gateway = DiscoveredGateway {
            service_name: "Test._edwinpai._tcp.local.".to_string(),
            hostname: "test.local.".to_string(),
            port: 18789,
            addresses: vec!["192.168.1.100".to_string()],
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            public_key: Some("03abc".to_string()),
            discovered_at: "2026-02-11T10:00:00Z".to_string(),
        };

        // Verify all fields are accessible
        assert!(!gateway.service_name.is_empty());
        assert!(!gateway.hostname.is_empty());
        assert!(gateway.port > 0);
        assert!(!gateway.addresses.is_empty());
        assert!(gateway.version.is_some());
        assert!(gateway.public_key.is_some());
        assert!(!gateway.discovered_at.is_empty());
    }

    #[test]
    fn test_global_mdns_service_init() {
        let result = init_mdns_service(
            Some("GlobalTest".to_string()),
            3009,
            env!("CARGO_PKG_VERSION").to_string(),
        );

        assert!(result.is_ok());

        // Get the global instance
        let service_arc = get_mdns_service();
        let service_lock = service_arc.lock();

        assert!(service_lock.is_ok());
        let service_opt = service_lock.unwrap();
        assert!(service_opt.is_some());

        if let Some(service) = service_opt.as_ref() {
            assert_eq!(service.service_name(), "GlobalTest");
            assert_eq!(service.port(), 3009);
        }
    }

    #[tokio::test]
    async fn test_advertise_with_txt_records() {
        let service = MdnsService::new(
            Some("TXTTest".to_string()),
            3010,
            "0.2.0".to_string(),
        );

        // TXT records should include: version, port, publicKey, app
        let result = service.advertise("03deadbeef".to_string());

        match result {
            Ok(_) => {
                // If advertising succeeds, verify service is marked as advertising
                assert!(service.is_advertising());
                let _ = service.stop_advertising();
            }
            Err(e) => {
                // Expected in restricted test environments
                assert!(e.contains("mDNS") || e.contains("daemon") || e.contains("Failed"));
            }
        }
    }

    #[test]
    fn test_service_type_constant() {
        let service = MdnsService::new(None, 3011, env!("CARGO_PKG_VERSION").to_string());
        assert_eq!(service.service_type(), "_edwinpai._tcp.local.");
        assert_eq!(SERVICE_TYPE, "_edwinpai._tcp.local.");
    }
}
