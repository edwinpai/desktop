// Client mode Tauri commands (Phase 4)
//
// Implements IPC command handlers for client mode operations:
// - scan_network: Discover gateways via mDNS
// - connect_to_gateway: BRC-103 authentication and connection
// - disconnect: Close connection and optionally disable reconnect
// - get_connection_status: Query current connection state
// - authorize_user: Grant access level to a user
//
// NOTE: Client mode is not yet fully implemented. These are stubs that compile
// but return placeholder responses. Gateway mode is the primary focus.

use crate::client_domain::{
    AuthorizeUserRequest, AuthorizeUserResponse, ConnectionManager, ConnectionState,
    ConnectRequest, ConnectResponse, DisconnectRequest, GetPeersRequest, GetPeersResponse,
};
use once_cell::sync::Lazy;
use std::sync::Mutex;

// Global connection manager instance
static CONNECTION_MANAGER: Lazy<Mutex<ConnectionManager>> =
    Lazy::new(|| Mutex::new(ConnectionManager::new()));

/// Scan local network for EdwinPAI gateways (mDNS discovery)
#[tauri::command]
pub async fn scan_network(_timeout_secs: Option<u64>) -> Result<Vec<serde_json::Value>, String> {
    // TODO: Implement mDNS gateway discovery
    Ok(vec![])
}

/// Connect to a gateway with BRC-103 authentication
#[tauri::command]
pub async fn connect_to_gateway(_request: ConnectRequest) -> Result<ConnectResponse, String> {
    // TODO: Implement BRC-103 mutual authentication
    Ok(ConnectResponse {
        success: false,
        state: ConnectionState::Disconnected,
        error: Some("Client mode connection not yet implemented".to_string()),
        gateway_petname: None,
    })
}

/// Disconnect from gateway
#[tauri::command]
pub fn disconnect(_request: DisconnectRequest) -> Result<(), String> {
    // TODO: Implement disconnect
    Ok(())
}

/// Get current connection status
#[tauri::command]
pub fn get_connection_status() -> Result<ConnectionState, String> {
    let manager = CONNECTION_MANAGER
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    manager.get_state()
}

/// Get list of authorized users
#[tauri::command]
pub fn get_authorized_users(_request: GetPeersRequest) -> Result<GetPeersResponse, String> {
    // TODO: Implement user storage
    Ok(GetPeersResponse {
        peers: vec![],
        total: 0,
    })
}

/// Authorize a user with specified access level
#[tauri::command]
pub fn authorize_user(_request: AuthorizeUserRequest) -> Result<AuthorizeUserResponse, String> {
    // TODO: Implement user authorization
    Ok(AuthorizeUserResponse {
        success: false,
        error: Some("Client mode authorization not yet implemented".to_string()),
        peer: None,
    })
}
