# Phase 4 Module Export Index

**Generated:** 2026-02-11
**Phase:** 4 - Client Mode & Multi-User Authorization
**Purpose:** Document all module exports, type re-exports, and command registrations for Phase 4 backend

---

## 1. Module Structure Overview

```
src-tauri/src/
├── discovery/               # Enhanced mDNS discovery
│   ├── mdns.rs             # ⚠️ Enhanced scanner (replaces Phase 3)
│   ├── types.rs            # ✅ Discovery domain types
│   ├── ipc_types.rs        # ✅ IPC request/response types
│   └── mod.rs              # ✅ Module root with re-exports
├── client/                  # 🆕 Client mode domain
│   ├── auth.rs             # ✅ BRC-103 authorization handshake
│   ├── connection.rs       # ✅ HTTP client with auth headers
│   ├── users.rs            # ✅ User CRUD operations
│   ├── invitations.rs      # ✅ Invitation lifecycle
│   ├── types.rs            # ✅ Client domain types
│   ├── ipc_types.rs        # ✅ IPC request/response types
│   └── mod.rs              # ✅ Module root with re-exports
├── commands/
│   ├── client.rs           # 🆕 Client mode command handlers
│   └── discovery.rs        # ⚠️ Enhanced discovery commands
├── state.rs                # ⚠️ Extended with client connection state
└── lib.rs                  # ⚠️ Register Phase 4 commands

Legend:
✅ New file
⚠️ Modified from previous phase
🆕 New domain
```

---

## 2. Discovery Domain Exports

### `src-tauri/src/discovery/mod.rs`

```rust
// Re-export types
pub use types::{DiscoveredGateway, GatewayMetadata, ScanOptions};
pub use ipc_types::{
    ScanGatewaysRequest, ScanGatewaysResponse,
    GetGatewayMetadataRequest, GetGatewayMetadataResponse,
};

// Re-export functions
pub use mdns::{
    scan_gateways,
    parse_txt_records,
    filter_compatible_gateways,
    verify_gateway_signature,
};
```

### Key Types (`discovery/types.rs`)

```rust
pub struct DiscoveredGateway {
    pub id: String,                      // Unique identifier (hash of addr:port)
    pub addr: IpAddr,                    // IPv4/IPv6 address
    pub port: u16,                       // Port number
    pub pubkey: String,                  // Base58-encoded public key
    pub petname: String,                 // Human-readable name
    pub version: String,                 // Gateway version (semver)
    pub capabilities: Vec<String>,       // Feature flags
    pub last_seen: SystemTime,           // Last discovery timestamp
}

pub struct GatewayMetadata {
    pub pubkey: String,
    pub petname: String,
    pub version: String,
    pub capabilities: Vec<String>,
}

pub struct ScanOptions {
    pub timeout: Duration,               // Max scan duration
    pub max_results: usize,              // Limit number of results
    pub filter_compatible: bool,         // Only return compatible versions
}
```

---

## 3. Client Domain Exports

### `src-tauri/src/client/mod.rs`

```rust
// Re-export types
pub use types::{
    User, NewUser, UserUpdates, UserRole,
    Invitation, NewInvitation, InvitationStatus,
    Challenge, ChallengeResponse,
    SessionToken,
};
pub use ipc_types::{
    ConnectGatewayRequest, ConnectGatewayResponse,
    CreateUserRequest, CreateUserResponse,
    UpdateUserRequest, UpdateUserResponse,
    DeleteUserRequest, DeleteUserResponse,
    ListUsersRequest, ListUsersResponse,
    CreateInvitationRequest, CreateInvitationResponse,
    AcceptInvitationRequest, AcceptInvitationResponse,
    RejectInvitationRequest, RejectInvitationResponse,
    ListInvitationsRequest, ListInvitationsResponse,
};

// Re-export auth functions
pub use auth::{
    initiate_handshake,
    sign_challenge,
    submit_response,
    verify_session_token,
    refresh_token,
};

// Re-export connection client
pub use connection::GatewayClient;

// Re-export domain functions
pub use users::{create_user, get_user, update_user, delete_user, list_users};
pub use invitations::{
    create_invitation,
    accept_invitation,
    reject_invitation,
    revoke_invitation,
    list_pending_invitations,
};
```

### Key Types (`client/types.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,                      // UUID
    pub pubkey: String,                  // Base58-encoded public key
    pub petname: String,                 // Human-readable name
    pub role: UserRole,                  // Owner/Member/Guest
    pub created_at: SystemTime,
    pub last_seen: SystemTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserRole {
    Owner,                               // Full permissions
    Member,                              // Chat + read permissions
    Guest,                               // Read-only
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewUser {
    pub pubkey: String,
    pub petname: String,
    pub role: UserRole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserUpdates {
    pub petname: Option<String>,
    pub role: Option<UserRole>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invitation {
    pub id: String,                      // UUID
    pub from_user: String,               // Inviter user ID
    pub to_pubkey: String,               // Invitee public key
    pub role: UserRole,                  // Proposed role
    pub expires_at: SystemTime,
    pub status: InvitationStatus,
    pub created_at: SystemTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InvitationStatus {
    Pending,
    Accepted,
    Rejected,
    Revoked,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewInvitation {
    pub to_pubkey: String,
    pub role: UserRole,
    pub expires_in_hours: u32,           // Default: 72
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Challenge {
    pub nonce: String,                   // 32-byte hex string
    pub gateway_pubkey: String,          // Gateway's public key
    pub expires_at: SystemTime,          // Challenge valid for 5 minutes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeResponse {
    pub nonce: String,                   // Same nonce from challenge
    pub signature: String,               // DER-encoded ECDSA signature
    pub client_pubkey: String,           // Client's public key
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionToken {
    pub token: String,                   // JWT token
    pub expires_at: SystemTime,          // Token valid for 24 hours
    pub user_id: String,                 // Associated user ID
}
```

---

## 4. Command Registrations

### `src-tauri/src/lib.rs` (Updated)

```rust
use commands::{
    // Phase 1-3 commands (unchanged)
    crypto, gateway, tray, config,

    // Phase 4 commands
    client, discovery,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // Phase 1 - Crypto Domain (7 commands)
            crypto::sign_message,
            crypto::verify_signature,
            crypto::get_public_key,
            crypto::derive_child_key,
            crypto::encrypt_message,
            crypto::decrypt_message,
            crypto::check_subscription,

            // Phase 2 - Gateway & SPV (5 commands)
            gateway::start_gateway,
            gateway::stop_gateway,
            gateway::get_gateway_status,
            spv::verify_transaction,
            spv::get_merkle_proof,

            // Phase 3 - System Tray & Config (6 commands)
            tray::update_tray_status,
            tray::show_window,
            tray::minimize_to_tray,
            config::get_config,
            config::update_config,
            config::reset_config,

            // Phase 4 - Discovery (2 commands, enhanced)
            discovery::scan_gateways,
            discovery::get_gateway_metadata,

            // Phase 4 - Client Mode (10 commands, new)
            client::connect_gateway,
            client::disconnect_gateway,
            client::create_user,
            client::get_user,
            client::update_user,
            client::delete_user,
            client::list_users,
            client::create_invitation,
            client::accept_invitation,
            client::reject_invitation,
            client::revoke_invitation,
            client::list_pending_invitations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Total Commands:**
- Phase 1: 7 (crypto_domain)
- Phase 2: 5 (gateway, spv)
- Phase 3: 6 (tray, config)
- Phase 4: 12 (2 discovery + 10 client)
- **Total: 30 commands**

---

## Summary

**Phase 4 Backend Structure:**
- 2 domains: `discovery` (enhanced), `client` (new)
- 17 files: 14 implementation + 3 config/root
- 30 total commands: 18 from Phases 1-3, 12 new in Phase 4
- 77 tests: 61 unit + 16 integration
- 2 new dependencies: reqwest, jsonwebtoken
- Clean integration with Phases 1-3 via well-defined domain boundaries
