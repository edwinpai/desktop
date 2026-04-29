// Discovery Domain Type Extensions (Phase 4)
//
// Extends DiscoveredGateway from mdns.rs with additional fields for:
// - Continuous scanning mode
// - Persistent gateway tracking
// - Quality metrics for connection selection

use serde::{Deserialize, Serialize};

// Re-export core DiscoveredGateway from mdns module
pub use super::mdns::DiscoveredGateway;

/// Extended gateway information with connection quality metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredGatewayExtended {
    /// Core discovery info (from mDNS)
    #[serde(flatten)]
    pub gateway: DiscoveredGateway,

    /// Persistent ID (stable across reconnects)
    pub gateway_id: String,

    /// Connection quality score (0-100)
    pub quality_score: u8,

    /// Last successful ping timestamp (RFC 3339)
    pub last_ping: Option<String>,

    /// Average response time (milliseconds)
    pub avg_response_time_ms: Option<u32>,

    /// Number of times discovered in current scan session
    pub discovery_count: u32,

    /// Whether this gateway is currently reachable
    pub is_reachable: bool,

    /// Last reachability check timestamp (RFC 3339)
    pub last_reachability_check: Option<String>,
}

/// Continuous scanning configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuousScanConfig {
    /// Enable continuous scanning
    pub enabled: bool,

    /// Scan interval in seconds (default: 30)
    pub interval_secs: u64,

    /// Maximum number of gateways to track
    pub max_tracked: u32,

    /// Ping timeout in milliseconds
    pub ping_timeout_ms: u64,

    /// Auto-connect to best gateway
    pub auto_connect_best: bool,
}

impl Default for ContinuousScanConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_secs: 30,
            max_tracked: 10,
            ping_timeout_ms: 2000,
            auto_connect_best: false,
        }
    }
}

/// Scan result from continuous scanning
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    /// Discovered gateways with quality metrics
    pub gateways: Vec<DiscoveredGatewayExtended>,

    /// Scan timestamp (RFC 3339)
    pub scanned_at: String,

    /// Scan duration in milliseconds
    pub duration_ms: u64,

    /// Number of new gateways discovered
    pub new_count: u32,

    /// Number of previously known gateways rediscovered
    pub rediscovered_count: u32,

    /// Number of gateways that disappeared
    pub lost_count: u32,
}

impl DiscoveredGatewayExtended {
    /// Create from core DiscoveredGateway
    pub fn from_discovered(gateway: DiscoveredGateway) -> Self {
        // Generate stable ID from public key (use full key if < 16 chars)
        let gateway_id = gateway
            .public_key
            .as_ref()
            .map(|pk| {
                let len = pk.len().min(16);
                format!("gw:{}", &pk[..len])
            })
            .unwrap_or_else(|| format!("gw:unknown:{}", gateway.service_name));

        Self {
            gateway,
            gateway_id,
            quality_score: 50, // Start at neutral score
            last_ping: None,
            avg_response_time_ms: None,
            discovery_count: 1,
            is_reachable: false,
            last_reachability_check: None,
        }
    }

    /// Update quality score based on response time
    pub fn update_quality(&mut self, response_time_ms: u32) {
        // Update average response time
        self.avg_response_time_ms = Some(match self.avg_response_time_ms {
            Some(avg) => (avg + response_time_ms) / 2,
            None => response_time_ms,
        });

        // Calculate quality score (0-100)
        // < 50ms = 100, 50-100ms = 75, 100-200ms = 50, > 200ms = 25
        self.quality_score = if response_time_ms < 50 {
            100
        } else if response_time_ms < 100 {
            75
        } else if response_time_ms < 200 {
            50
        } else {
            25
        };

        self.last_ping = Some(chrono::Utc::now().to_rfc3339());
        self.is_reachable = true;
        self.last_reachability_check = Some(chrono::Utc::now().to_rfc3339());
    }

    /// Mark as unreachable
    pub fn mark_unreachable(&mut self) {
        self.is_reachable = false;
        self.quality_score = 0;
        self.last_reachability_check = Some(chrono::Utc::now().to_rfc3339());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_continuous_scan_config_default() {
        let config = ContinuousScanConfig::default();
        assert_eq!(config.enabled, false);
        assert_eq!(config.interval_secs, 30);
        assert_eq!(config.max_tracked, 10);
        assert_eq!(config.ping_timeout_ms, 2000);
        assert_eq!(config.auto_connect_best, false);
    }

    #[test]
    fn test_discovered_gateway_extended_quality_update() {
        let base = DiscoveredGateway {
            service_name: "EdwinPAI-Test._edwinpai._tcp.local.".to_string(),
            hostname: "test.local.".to_string(),
            port: 18789,
            addresses: vec!["192.168.1.100".to_string()],
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            public_key: Some("03abc123".to_string()),
            discovered_at: "2026-02-11T10:00:00Z".to_string(),
        };

        let mut extended = DiscoveredGatewayExtended::from_discovered(base);
        assert_eq!(extended.quality_score, 50); // Initial neutral score

        extended.update_quality(25); // Fast response
        assert_eq!(extended.quality_score, 100);
        assert!(extended.is_reachable);

        extended.update_quality(150); // Slower response
        assert_eq!(extended.quality_score, 50);
    }

    #[test]
    fn test_discovered_gateway_extended_mark_unreachable() {
        let base = DiscoveredGateway {
            service_name: "EdwinPAI-Test._edwinpai._tcp.local.".to_string(),
            hostname: "test.local.".to_string(),
            port: 18789,
            addresses: vec!["192.168.1.100".to_string()],
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            public_key: Some("03abc123".to_string()),
            discovered_at: "2026-02-11T10:00:00Z".to_string(),
        };

        let mut extended = DiscoveredGatewayExtended::from_discovered(base);
        extended.mark_unreachable();

        assert_eq!(extended.is_reachable, false);
        assert_eq!(extended.quality_score, 0);
        assert!(extended.last_reachability_check.is_some());
    }

    #[test]
    fn test_gateway_id_generation() {
        let base = DiscoveredGateway {
            service_name: "EdwinPAI-Test._edwinpai._tcp.local.".to_string(),
            hostname: "test.local.".to_string(),
            port: 18789,
            addresses: vec!["192.168.1.100".to_string()],
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            public_key: Some("03abc123def456".to_string()),
            discovered_at: "2026-02-11T10:00:00Z".to_string(),
        };

        let extended = DiscoveredGatewayExtended::from_discovered(base);
        assert_eq!(extended.gateway_id, "gw:03abc123def456");
    }
}
