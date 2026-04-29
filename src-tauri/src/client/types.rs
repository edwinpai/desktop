// Client Mode - Rust Type Definitions
//
// Defines type contracts for:
// - Client connection management
// - Gateway discovery and peer management
// - Client session lifecycle
// - Connection state machine
//
// All implementation nodes MUST import from this module.

use serde::{Deserialize, Serialize};

// ============================================================================
// Client Connection Types
// ============================================================================

/// Client connection states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientConnectionStatus {
    /// Not connected to any gateway
    Disconnected,
    /// Connection attempt in progress
    Connecting,
    /// Successfully connected and authenticated
    Connected,
    /// Attempting to reconnect after disconnect
    Reconnecting,
    /// Connection failed and not retrying
    Failed,
}

/// Client connection information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConnection {
    /// Current connection status
    pub status: ClientConnectionStatus,

    /// Gateway public key (hex-encoded compressed secp256k1)
    pub gateway_pubkey: String,

    /// Gateway network address (IP:port or hostname:port)
    pub gateway_address: String,

    /// Gateway petname
    pub gateway_petname: String,

    /// Connected since (ISO 8601 timestamp)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connected_at: Option<String>,

    /// Last successful message timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_activity: Option<String>,

    /// Current authorization level
    pub access_level: crate::auth::types::AccessLevel,

    /// Reconnect attempts count
    pub reconnect_attempts: u32,
}

/// Internal client session state (not serialized to frontend)
pub struct ClientSessionState {
    pub connection: ClientConnection,
    pub http_client: Option<reqwest::Client>,
    pub auto_reconnect: bool,
    pub reconnect_interval_secs: u64,
    pub connection_timeout_secs: u64,
    pub max_reconnect_attempts: u32,
}

impl ClientSessionState {
    pub fn new(gateway_pubkey: String, gateway_address: String, gateway_petname: String) -> Self {
        Self {
            connection: ClientConnection {
                status: ClientConnectionStatus::Disconnected,
                gateway_pubkey,
                gateway_address,
                gateway_petname,
                connected_at: None,
                last_activity: None,
                access_level: super::super::auth::types::AccessLevel::Guest,
                reconnect_attempts: 0,
            },
            http_client: None,
            auto_reconnect: true,
            reconnect_interval_secs: 5,
            connection_timeout_secs: 10,
            max_reconnect_attempts: 10,
        }
    }

    pub fn update_last_activity(&mut self) {
        self.connection.last_activity = Some(chrono::Utc::now().to_rfc3339());
    }
}

// ============================================================================
// Peer Discovery Types
// ============================================================================

/// Discovered peer from mDNS or manual entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredPeer {
    /// Peer public key (hex-encoded compressed secp256k1)
    pub pubkey: String,

    /// Peer petname (derived or custom)
    pub petname: String,

    /// Network address (IP:port)
    pub address: String,

    /// Whether peer is currently reachable
    pub is_online: bool,

    /// Last seen timestamp (ISO 8601)
    pub last_seen: String,

    /// Current authorization level (for this client)
    pub authorization_level: crate::auth::types::AccessLevel,
}

/// Peer discovery result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerDiscoveryResult {
    /// List of discovered peers
    pub peers: Vec<DiscoveredPeer>,

    /// Discovery method used
    pub method: PeerDiscoveryMethod,

    /// Discovery timestamp (ISO 8601)
    pub discovered_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PeerDiscoveryMethod {
    /// mDNS/Bonjour discovery
    MDns,
    /// Manual entry
    Manual,
    /// Invitation redemption
    Invitation,
}

// ============================================================================
// Client Configuration
// ============================================================================

/// Client mode configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    /// Gateway address
    pub gateway_address: String,

    /// Gateway public key
    pub gateway_pubkey: String,

    /// Gateway petname
    pub gateway_petname: String,

    /// Auto-reconnect on disconnect
    #[serde(default = "default_auto_reconnect")]
    pub auto_reconnect: bool,

    /// Reconnect interval (seconds)
    #[serde(default = "default_reconnect_interval")]
    pub reconnect_interval_secs: u64,

    /// Connection timeout (seconds)
    #[serde(default = "default_connection_timeout")]
    pub connection_timeout_secs: u64,
}

fn default_auto_reconnect() -> bool {
    true
}

fn default_reconnect_interval() -> u64 {
    5
}

fn default_connection_timeout() -> u64 {
    10
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            gateway_address: String::new(),
            gateway_pubkey: String::new(),
            gateway_petname: String::new(),
            auto_reconnect: true,
            reconnect_interval_secs: 5,
            connection_timeout_secs: 10,
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
    fn test_client_connection_status_serialization() {
        let status = ClientConnectionStatus::Connected;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"connected\"");
    }

    #[test]
    fn test_client_session_state_default() {
        let state = ClientSessionState::new(
            "03abc...".to_string(),
            "192.168.1.100:18789".to_string(),
            "Swift Falcon".to_string(),
        );
        assert_eq!(state.connection.status, ClientConnectionStatus::Disconnected);
        assert_eq!(state.connection.reconnect_attempts, 0);
        assert!(state.auto_reconnect);
    }

    #[test]
    fn test_peer_discovery_method_serialization() {
        let method = PeerDiscoveryMethod::MDns;
        let json = serde_json::to_string(&method).unwrap();
        assert_eq!(json, "\"mdns\"");
    }

    #[test]
    fn test_client_config_default() {
        let config = ClientConfig::default();
        assert_eq!(config.auto_reconnect, true);
        assert_eq!(config.reconnect_interval_secs, 5);
        assert_eq!(config.connection_timeout_secs, 10);
    }

    #[test]
    fn test_client_config_serialization() {
        let config = ClientConfig {
            gateway_address: "192.168.1.100:18789".to_string(),
            gateway_pubkey: "03abc...".to_string(),
            gateway_petname: "Swift Falcon".to_string(),
            auto_reconnect: true,
            reconnect_interval_secs: 5,
            connection_timeout_secs: 10,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"gateway_address\":"));
        assert!(json.contains("\"auto_reconnect\":true"));
    }
}
