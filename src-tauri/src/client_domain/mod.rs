// Client Domain — connection management and peer discovery
//
// Stub module for types referenced by invitation and client commands.
// Client mode is not yet fully implemented — these types compile the
// command surface while gateway mode remains the primary focus.

pub mod types;

use serde::{Deserialize, Serialize};
use types::AuthorizationLevel;

// ============================================================================
// Connection Manager
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed,
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self::Disconnected
    }
}

pub struct ConnectionManager {
    state: ConnectionState,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            state: ConnectionState::Disconnected,
        }
    }

    pub fn get_state(&self) -> Result<ConnectionState, String> {
        Ok(self.state)
    }

    pub fn connect(&mut self, _req: ConnectRequest) -> Result<ConnectResponse, String> {
        self.state = ConnectionState::Connected;
        Ok(ConnectResponse {
            success: true,
            state: ConnectionState::Connected,
            error: None,
            gateway_petname: None,
        })
    }

    pub fn disconnect(&mut self, _req: DisconnectRequest) -> Result<(), String> {
        self.state = ConnectionState::Disconnected;
        Ok(())
    }

    pub fn get_peers(&self, _req: GetPeersRequest) -> Result<GetPeersResponse, String> {
        Ok(GetPeersResponse {
            peers: vec![],
            total: 0,
        })
    }

    pub fn authorize_user(
        &mut self,
        _req: AuthorizeUserRequest,
    ) -> Result<AuthorizeUserResponse, String> {
        Ok(AuthorizeUserResponse {
            success: false,
            error: Some("Client mode authorization not yet implemented".to_string()),
            peer: None,
        })
    }
}

// ============================================================================
// Request / Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub gateway_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectResponse {
    pub success: bool,
    pub state: ConnectionState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway_petname: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisconnectRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetPeersRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,
    pub name: String,
    pub online: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authorization_level: Option<AuthorizationLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetPeersResponse {
    pub peers: Vec<PeerInfo>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizeUserRequest {
    pub user_id: String,
    pub level: AuthorizationLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizeUserResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer: Option<PeerInfo>,
}
