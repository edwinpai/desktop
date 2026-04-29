// mDNS Service Discovery (Phase 4)
//
// Advertises EdwinPAI gateway on the local network using mDNS/Bonjour.
// - Service type: _edwinpai._tcp.local
// - Advertises port, version, and public key
// - Discovery: Browse for other EdwinPAI instances on LAN

use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/// mDNS service advertisement manager
pub struct MdnsManager {
    daemon: Arc<Mutex<Option<ServiceDaemon>>>,
    service_name: String,
    service_type: String,
    port: u16,
}

/// Discovered EdwinPAI gateway on LAN
#[derive(Debug, Clone, serde::Serialize)]
pub struct DiscoveredGateway {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub public_key: Option<String>,
    pub version: Option<String>,
    pub addresses: Vec<String>,
}

impl MdnsManager {
    /// Create a new mDNS manager
    pub fn new(service_name: Option<String>, port: u16) -> Result<Self, String> {
        let service_name = service_name.unwrap_or_else(|| {
            // Generate unique service name using hostname
            let hostname = hostname::get()
                .ok()
                .and_then(|h| h.into_string().ok())
                .unwrap_or_else(|| "edwinpai-desktop".to_string());
            format!("EdwinPAI-{}", hostname)
        });

        Ok(Self {
            daemon: Arc::new(Mutex::new(None)),
            service_name,
            service_type: "_edwinpai._tcp.local.".to_string(),
            port,
        })
    }

    /// Start advertising the EdwinPAI gateway service
    pub fn advertise(&self, public_key: String, version: String) -> Result<(), String> {
        let mut daemon_lock = self.daemon.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        // Create daemon if it doesn't exist
        if daemon_lock.is_none() {
            let daemon = ServiceDaemon::new()
                .map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;
            *daemon_lock = Some(daemon);
        }

        let daemon = daemon_lock.as_ref().unwrap();

        // Prepare service properties
        let mut properties = HashMap::new();
        properties.insert("publicKey".to_string(), public_key);
        properties.insert("version".to_string(), version);
        properties.insert("app".to_string(), "edwinpai-desktop".to_string());

        // Create service info
        let service_info = ServiceInfo::new(
            &self.service_type,
            &self.service_name,
            &format!("{}.local.", hostname::get()
                .ok()
                .and_then(|h| h.into_string().ok())
                .unwrap_or_else(|| "localhost".to_string())),
            (), // Use default IP addresses
            self.port,
            Some(properties),
        )
        .map_err(|e| format!("Failed to create service info: {}", e))?;

        // Register the service
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

    /// Discover EdwinPAI gateways on the local network
    pub async fn discover_gateways(&self, timeout_secs: u64) -> Result<Vec<DiscoveredGateway>, String> {
        use tokio::time::{sleep, Duration};

        let daemon = ServiceDaemon::new()
            .map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

        let receiver = daemon.browse(&self.service_type)
            .map_err(|e| format!("Failed to browse mDNS services: {}", e))?;

        let mut discovered = Vec::new();
        let start = std::time::Instant::now();

        // Browse for specified timeout
        while start.elapsed().as_secs() < timeout_secs {
            // Check for events with 100ms timeout
            match receiver.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(event) => {
                    use mdns_sd::ServiceEvent;

                    match event {
                        ServiceEvent::ServiceResolved(info) => {
                            let public_key = info.get_property_val_str("publicKey")
                                .map(|s| s.to_string());
                            let version = info.get_property_val_str("version")
                                .map(|s| s.to_string());

                            let addresses = info.get_addresses()
                                .iter()
                                .map(|addr| addr.to_string())
                                .collect();

                            discovered.push(DiscoveredGateway {
                                name: info.get_fullname().to_string(),
                                host: info.get_hostname().to_string(),
                                port: info.get_port(),
                                public_key,
                                version,
                                addresses,
                            });
                        }
                        ServiceEvent::ServiceRemoved(_, _) => {
                            // Service went offline - could remove from list
                        }
                        _ => {}
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

        // Shutdown the browse daemon
        let _ = daemon.shutdown();

        Ok(discovered)
    }

    /// Get the advertised service name
    pub fn service_name(&self) -> &str {
        &self.service_name
    }

    /// Get the service type
    pub fn service_type(&self) -> &str {
        &self.service_type
    }
}

impl Drop for MdnsManager {
    fn drop(&mut self) {
        // Ensure daemon is shut down when manager is dropped
        let _ = self.stop_advertising();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mdns_manager_creation() {
        let manager = MdnsManager::new(None, 18789).unwrap();
        assert_eq!(manager.port, 18789);
        assert_eq!(manager.service_type, "_edwinpai._tcp.local.");
        assert!(manager.service_name().starts_with("EdwinPAI-"));
    }

    #[test]
    fn test_mdns_manager_custom_name() {
        let manager = MdnsManager::new(Some("MyEdwinPAI".to_string()), 8080).unwrap();
        assert_eq!(manager.service_name(), "MyEdwinPAI");
        assert_eq!(manager.port, 8080);
    }

    #[test]
    fn test_discovered_gateway_serialization() {
        let gateway = DiscoveredGateway {
            name: "EdwinPAI-MacBook".to_string(),
            host: "macbook.local.".to_string(),
            port: 18789,
            public_key: Some("03abc123".to_string()),
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            addresses: vec!["192.168.1.100".to_string()],
        };

        let json = serde_json::to_string(&gateway).unwrap();
        assert!(json.contains("\"name\":\"EdwinPAI-MacBook\""));
        assert!(json.contains("\"port\":18789"));
        assert!(json.contains("\"public_key\":\"03abc123\""));
    }

    #[test]
    fn test_service_type_format() {
        let manager = MdnsManager::new(None, 18789).unwrap();
        assert!(manager.service_type().starts_with("_edwinpai._tcp"));
        assert!(manager.service_type().ends_with(".local."));
    }
}
