# Phase 4 Module Export Index

**Date**: 2026-02-11
**Phase**: 4 - Client Mode & Multi-User Authorization
**Purpose**: Complete index of all Rust type exports for Phase 4 implementation

---

## Table of Contents

1. [Client Domain (`client`)](#client-domain-client)
2. [Authorization Domain (`auth`)](#authorization-domain-auth)
3. [Discovery Domain Extensions (`discovery`)](#discovery-domain-extensions-discovery)
4. [Configuration Types (`commands/config.rs`)](#configuration-types-commandsconfigrs)
5. [Import Validation](#import-validation)
6. [Cross-Module Dependencies](#cross-module-dependencies)

---

## Client Domain (`client`)

**Module Path**: `src-tauri/src/client/`

### File Structure

```
client/
├── mod.rs        # Module exports
└── types.rs      # Type definitions (260 LOC)
```

### Exported Types (via `mod.rs`)

```rust
// src-tauri/src/client/mod.rs
pub use types::{
    ClientConfig,               // Client connection configuration
    ClientConnection,           // Connection info and state
    ClientConnectionStatus,     // Connection state enum
    ClientSessionState,         // Internal session management
    DiscoveredPeer,            // Peer from mDNS or manual entry
    PeerDiscoveryMethod,       // Discovery method enum
    PeerDiscoveryResult,       // Discovery scan results
};
```

### Type Details

#### `ClientConnectionStatus` (enum)
**File**: `client/types.rs:18-31`

```rust
pub enum ClientConnectionStatus {
    Disconnected,  // Not connected
    Connecting,    // Connection in progress
    Connected,     // Authenticated
    Reconnecting,  // Attempting reconnect
    Failed,        // Terminal failure
}
```

**Serde**: `rename_all = "lowercase"`
**Derives**: `Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize`

---

#### `ClientConnection` (struct)
**File**: `client/types.rs:34-61`

```rust
pub struct ClientConnection {
    pub status: ClientConnectionStatus,
    pub gateway_pubkey: String,          // Hex-encoded secp256k1 (66 chars)
    pub gateway_address: String,         // IP:port or hostname:port
    pub gateway_petname: String,
    pub connected_at: Option<String>,    // ISO 8601 timestamp
    pub last_activity: Option<String>,
    pub access_level: crate::auth::types::AccessLevel,
    pub reconnect_attempts: u32,
}
```

**Serde**: `rename_all = "camelCase"`
**Cross-Module Dependency**: `auth::types::AccessLevel`

---

#### `ClientSessionState` (struct)
**File**: `client/types.rs:64-97`

```rust
pub struct ClientSessionState {
    pub connection: ClientConnection,
    pub http_client: Option<reqwest::Client>,
    pub auto_reconnect: bool,
    pub reconnect_interval_secs: u64,
    pub connection_timeout_secs: u64,
    pub max_reconnect_attempts: u32,
}
```

**Not Serialized** (internal state, not exposed to frontend)
**Methods**:
- `new(gateway_pubkey, gateway_address, gateway_petname) -> Self`
- `update_last_activity(&mut self)`

---

#### `DiscoveredPeer` (struct)
**File**: `client/types.rs:104-123`

```rust
pub struct DiscoveredPeer {
    pub pubkey: String,
    pub petname: String,
    pub address: String,
    pub is_online: bool,
    pub last_seen: String,                    // ISO 8601
    pub authorization_level: crate::auth::types::AccessLevel,
}
```

**Serde**: `rename_all = "camelCase"`
**Cross-Module Dependency**: `auth::types::AccessLevel`

---

#### `PeerDiscoveryResult` (struct)
**File**: `client/types.rs:126-136`

```rust
pub struct PeerDiscoveryResult {
    pub peers: Vec<DiscoveredPeer>,
    pub method: PeerDiscoveryMethod,
    pub discovered_at: String,  // ISO 8601
}
```

---

#### `PeerDiscoveryMethod` (enum)
**File**: `client/types.rs:138-147`

```rust
pub enum PeerDiscoveryMethod {
    MDns,       // mDNS/Bonjour discovery
    Manual,     // Manual entry
    Invitation, // Invitation redemption
}
```

**Serde**: `rename_all = "lowercase"`

---

#### `ClientConfig` (struct)
**File**: `client/types.rs:154-201`

```rust
pub struct ClientConfig {
    pub gateway_address: String,
    pub gateway_pubkey: String,
    pub gateway_petname: String,
    pub auto_reconnect: bool,                // Default: true
    pub reconnect_interval_secs: u64,        // Default: 5
    pub connection_timeout_secs: u64,        // Default: 10
}
```

**Implements**: `Default`

---

## Authorization Domain (`auth`)

**Module Path**: `src-tauri/src/auth/`

### File Structure

```
auth/
├── mod.rs           # Module exports
├── types.rs         # Type definitions (588 LOC)
├── ipc_types.rs     # IPC message types (Phase 4 backend)
├── users.rs         # User management (Phase 4 backend)
└── invitations.rs   # Invitation lifecycle (Phase 4 backend)
```

### Exported Types (via `mod.rs`)

```rust
// src-tauri/src/auth/mod.rs
pub use types::{
    AccessLevel,         // Access control enum
    AuthUser,           // Authorized user record
    Brc103AuthHeaders,  // BRC-103 auth headers
    Invitation,         // Invitation record
    InvitationData,     // QR code payload
    InvitationDatabase, // Invitation storage
    InvitationDetails,  // Invitation info for QR
    InvitationStatus,   // Invitation state enum
    NonceError,         // Nonce validation error
    NonceTracker,       // Replay attack prevention
    UserDatabase,       // User storage
};

// Manager exports (Phase 4 backend)
pub use invitations::{get_invitation_manager, init_invitation_manager, InvitationManager};
pub use users::{get_user_manager, init_user_manager, UserManager};
```

### Type Details

#### `AccessLevel` (enum)
**File**: `auth/types.rs:18-61`

```rust
pub enum AccessLevel {
    Owner,   // Full access: manage users, read/write
    Member,  // Standard access: read/write, no user management
    Guest,   // Limited access: read-only
}
```

**Serde**: `rename_all = "lowercase"`
**Derives**: `Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize`
**Methods**:
- `can_manage_users(&self) -> bool`
- `can_write(&self) -> bool`
- `can_read(&self) -> bool` (always true)
- `from_str(s: &str) -> Option<Self>`
- `Display` impl (e.g., "owner", "member", "guest")

**Permission Matrix**:

| Role   | Read | Write | Manage Users | Configure | Manage Subscription |
|--------|------|-------|--------------|-----------|---------------------|
| Owner  | ✅   | ✅    | ✅           | ✅        | ✅                  |
| Member | ✅   | ✅    | ❌           | ❌        | ❌                  |
| Guest  | ✅   | ❌    | ❌           | ❌        | ❌                  |

---

#### `AuthUser` (struct)
**File**: `auth/types.rs:68-88`

```rust
pub struct AuthUser {
    pub pubkey: String,         // Hex-encoded secp256k1 (66 chars)
    pub petname: String,
    pub level: AccessLevel,
    pub authorized_at: String,  // ISO 8601
    pub last_active: String,
    pub invited_by: Option<String>,  // Pubkey or None if owner
}
```

**Serde**: `rename_all = "camelCase"`

---

#### `UserDatabase` (struct)
**File**: `auth/types.rs:91-137`

```rust
pub struct UserDatabase {
    pub users: HashMap<String, AuthUser>,  // pubkey -> AuthUser
    pub updated_at: String,                 // ISO 8601
}
```

**Methods**:
- `new() -> Self`
- `add_user(&mut self, user: AuthUser)`
- `remove_user(&mut self, pubkey: &str) -> Option<AuthUser>`
- `get_user(&self, pubkey: &str) -> Option<&AuthUser>`
- `update_last_active(&mut self, pubkey: &str)`

**Implements**: `Default`

---

#### `InvitationStatus` (enum)
**File**: `auth/types.rs:144-155`

```rust
pub enum InvitationStatus {
    Pending,   // Not yet redeemed
    Accepted,  // Successfully redeemed
    Expired,   // Past expiration
    Revoked,   // Manually revoked
}
```

**Serde**: `rename_all = "lowercase"`

---

#### `Invitation` (struct)
**File**: `auth/types.rs:158-230`

```rust
pub struct Invitation {
    pub token: String,              // 64 hex chars (32 bytes random)
    pub level: AccessLevel,
    pub expires_at: String,         // ISO 8601
    pub status: InvitationStatus,
    pub created_by: String,         // Pubkey
    pub created_at: String,         // ISO 8601
    pub redeemed_by: Option<String>,
    pub redeemed_at: Option<String>,
}
```

**Methods**:
- `new(level, expires_in_hours, created_by) -> Self`
- `is_expired(&self) -> bool`
- `is_valid(&self) -> bool`
- `redeem(&mut self, pubkey: String)`
- `revoke(&mut self)`

---

#### `InvitationDatabase` (struct)
**File**: `auth/types.rs:233-287`

```rust
pub struct InvitationDatabase {
    pub invitations: HashMap<String, Invitation>,  // token -> Invitation
    pub updated_at: String,
}
```

**Methods**:
- `new() -> Self`
- `add_invitation(&mut self, invitation: Invitation)`
- `get_invitation(&self, token: &str) -> Option<&Invitation>`
- `get_invitation_mut(&mut self, token: &str) -> Option<&mut Invitation>`
- `cleanup_expired(&mut self)`

---

#### `Brc103AuthHeaders` (struct)
**File**: `auth/types.rs:293-304`

```rust
pub struct Brc103AuthHeaders {
    pub identity: String,   // X-BSV-Identity (pubkey)
    pub nonce: String,      // X-BSV-Nonce
    pub signature: String,  // X-BSV-Signature
}
```

---

#### `NonceTracker` (struct)
**File**: `auth/types.rs:320-386`

```rust
pub struct NonceTracker {
    nonces: HashMap<String, NonceRecord>,
    max_age_secs: u64,           // Default: 300 (5 minutes)
    cleanup_interval_secs: u64,  // Default: 60 (1 minute)
    last_cleanup: std::time::Instant,
}
```

**Methods**:
- `new() -> Self`
- `check_and_record(&mut self, nonce: &str) -> Result<(), NonceError>`
- `cleanup_if_needed(&mut self)` (private)

**Error**: `NonceError::Reused` if nonce was already used

---

#### `InvitationData` (struct)
**File**: `auth/types.rs:408-466`

```rust
pub struct InvitationData {
    pub version: String,            // "edwinpai-invite-v1"
    pub invitation: InvitationDetails,
    pub petname: Option<String>,
}

pub struct InvitationDetails {
    pub gateway_pubkey: String,
    pub gateway_address: String,
    pub level: AccessLevel,
    pub expires_at: String,
    pub token: String,
}
```

**Methods**:
- `new(gateway_pubkey, gateway_address, invitation, petname) -> Self`
- `to_json(&self) -> Result<String, serde_json::Error>`
- `from_json(json: &str) -> Result<Self, serde_json::Error>`

**Usage**: QR code encoding/decoding for invitation redemption

---

## Discovery Domain Extensions (`discovery`)

**Module Path**: `src-tauri/src/discovery/`

### File Structure

```
discovery/
├── mod.rs     # Module exports
├── mdns.rs    # mDNS service (Phase 3, 499 LOC)
└── types.rs   # Extended types (Phase 4, NEW)
```

### Exported Types (via `mod.rs`)

```rust
// src-tauri/src/discovery/mod.rs
pub use mdns::{MdnsService, DiscoveredGateway, init_mdns_service, get_mdns_service};
pub use types::{DiscoveredGatewayExtended, ContinuousScanConfig, ScanResult};
```

### Type Details

#### `DiscoveredGateway` (struct) [Phase 3]
**File**: `discovery/mdns.rs:27-37`

```rust
pub struct DiscoveredGateway {
    pub service_name: String,
    pub hostname: String,
    pub port: u16,
    pub addresses: Vec<String>,
    pub version: Option<String>,
    pub public_key: Option<String>,
    pub discovered_at: String,  // ISO 8601
}
```

**Serde**: `rename_all = "camelCase"`

---

#### `DiscoveredGatewayExtended` (struct) [Phase 4 NEW]
**File**: `discovery/types.rs:12-107`

```rust
pub struct DiscoveredGatewayExtended {
    #[serde(flatten)]
    pub gateway: DiscoveredGateway,         // Core mDNS info
    pub gateway_id: String,                  // Stable ID (e.g., "gw:03abc123def456")
    pub quality_score: u8,                   // 0-100
    pub last_ping: Option<String>,
    pub avg_response_time_ms: Option<u32>,
    pub discovery_count: u32,
    pub is_reachable: bool,
    pub last_reachability_check: Option<String>,
}
```

**Methods**:
- `from_discovered(gateway: DiscoveredGateway) -> Self`
- `update_quality(&mut self, response_time_ms: u32)`
- `mark_unreachable(&mut self)`

**Quality Scoring**:
- < 50ms → 100
- 50-100ms → 75
- 100-200ms → 50
- \> 200ms → 25

---

#### `ContinuousScanConfig` (struct) [Phase 4 NEW]
**File**: `discovery/types.rs:22-43`

```rust
pub struct ContinuousScanConfig {
    pub enabled: bool,
    pub interval_secs: u64,      // Default: 30
    pub max_tracked: u32,        // Default: 10
    pub ping_timeout_ms: u64,    // Default: 2000
    pub auto_connect_best: bool, // Default: false
}
```

**Implements**: `Default`

---

#### `ScanResult` (struct) [Phase 4 NEW]
**File**: `discovery/types.rs:45-60`

```rust
pub struct ScanResult {
    pub gateways: Vec<DiscoveredGatewayExtended>,
    pub scanned_at: String,       // ISO 8601
    pub duration_ms: u64,
    pub new_count: u32,
    pub rediscovered_count: u32,
    pub lost_count: u32,
}
```

---

## Configuration Types (`commands/config.rs`)

**File Path**: `src-tauri/src/commands/config.rs`

### Exported Types

#### `OperatingMode` (enum) [Phase 3]
**File**: `commands/config.rs:30-44`

```rust
pub enum OperatingMode {
    Gateway,  // Local EdwinPAI instance (default)
    Client,   // Connected to remote gateway
}
```

**Serde**: `rename_all = "lowercase"`
**Implements**: `Default` (defaults to `Gateway`)

**Aliases**: Also referred to as `ConfigMode` in spec

---

#### `ClientSessionConfig` (struct) [Phase 4]
**File**: `commands/config.rs:47-60`

```rust
pub struct ClientSessionConfig {
    pub gateway_pubkey: String,    // 66 hex chars
    pub gateway_address: String,   // IP:port or hostname:port
    pub gateway_petname: String,
    pub connected_at: String,      // ISO 8601
    pub permission: String,        // "owner" | "member" | "guest"
}
```

**Usage**: Stored in `DesktopConfig.last_client_session` for reconnection

---

## Import Validation

### Cross-Module Import Graph

```
client/types.rs
  ├─ crate::auth::types::AccessLevel  (line 57, 122)
  └─ Used by: commands (client mode IPC)

auth/types.rs
  ├─ std::collections::HashMap
  ├─ chrono::Utc
  ├─ rand::Rng
  └─ Used by: client/types.rs, commands (auth middleware)

discovery/types.rs
  ├─ super::mdns::DiscoveredGateway  (re-export)
  ├─ chrono::Utc
  └─ Used by: commands (discovery IPC)

commands/config.rs
  └─ Used by: client, auth, gateway (config persistence)
```

### Dependency Validation

✅ **Acyclic**: No circular dependencies detected
✅ **Type Safety**: All cross-module imports resolve to existing types
✅ **Serde Compatibility**: All IPC types derive `Serialize + Deserialize`

---

## Cross-Module Dependencies

### `auth::types::AccessLevel` Dependencies

**Used by**:
1. `client::types::ClientConnection` (field `access_level`)
2. `client::types::DiscoveredPeer` (field `authorization_level`)
3. `auth::types::AuthUser` (field `level`)
4. `auth::types::Invitation` (field `level`)
5. `commands/config.rs::ClientSessionConfig` (as string)

**Import Pattern**:
```rust
// client/types.rs
pub access_level: crate::auth::types::AccessLevel,
```

---

### `discovery::mdns::DiscoveredGateway` Dependencies

**Extended by**:
1. `discovery::types::DiscoveredGatewayExtended` (via `#[serde(flatten)]`)

**Import Pattern**:
```rust
// discovery/types.rs
pub use super::mdns::DiscoveredGateway;
```

---

## Test Coverage

### Client Domain Tests
**File**: `client/types.rs:207-259`
- `test_client_connection_status_serialization`
- `test_client_session_state_default`
- `test_peer_discovery_method_serialization`
- `test_client_config_default`
- `test_client_config_serialization`

### Auth Domain Tests
**File**: `auth/types.rs:473-587`
- `test_access_level_permissions` (9 assertions)
- `test_access_level_serialization`
- `test_user_database` (add/remove/get)
- `test_invitation_lifecycle` (create/redeem)
- `test_invitation_database`
- `test_nonce_tracker` (replay prevention)
- `test_invitation_data_json` (QR encoding/decoding)

### Discovery Tests
**File**: `discovery/types.rs:110-174`
- `test_continuous_scan_config_default`
- `test_discovered_gateway_extended_quality_update`
- `test_discovered_gateway_extended_mark_unreachable`
- `test_gateway_id_generation`

**Total**: 16 unit tests across 3 modules

---

## Module Export Summary

| Module | Types Exported | LOC | Tests | Status |
|--------|----------------|-----|-------|--------|
| `client` | 7 types | 260 | 5 | ✅ Complete |
| `auth` | 11 types + 2 managers | 588 | 7 | ✅ Complete |
| `discovery` (extensions) | 3 types | 174 | 4 | ✅ Complete |
| `commands/config` | 2 types | 99 | 0 | ✅ Phase 3 |

**Total**: 23 types, 1,121 LOC, 16 tests

---

## Import Resolution Verification

### Phase 1 Crypto Domain Types (Available)

```rust
// crypto_domain/types.rs
pub struct Keypair { ... }
pub struct Keychain { ... }
pub struct Brc42Params { ... }
pub struct SignRequest { ... }
pub struct SignResponse { ... }
pub struct Identity { ... }
pub struct Petname { ... }
```

**Status**: ✅ All crypto types available for BRC-103 signing

### Phase 2 Subscription Types (Available)

```rust
// subscription/types.rs
pub struct SubscriptionState { ... }
pub enum SubscriptionStatus { ... }
```

**Status**: ✅ Available for subscription gating in Client mode

### Phase 3 Gateway Types (Available)

```rust
// gateway/types.rs
pub struct GatewayStatus { ... }
pub struct GatewayHealth { ... }
```

**Status**: ✅ Available for gateway monitoring in Client mode

---

## Next Steps

### Phase 4 Backend Implementation

1. **Client Domain**:
   - `client/manager.rs` (connection manager, 250 LOC est.)
   - `client/brc103.rs` (BRC-103 handshake, 180 LOC est.)

2. **Auth Domain**:
   - `auth/users.rs` (user management, 200 LOC est.)
   - `auth/invitations.rs` (invitation lifecycle, 220 LOC est.)
   - `auth/middleware.rs` (request auth, 150 LOC est.)

3. **Commands**:
   - `commands/client.rs` (client IPC, 200 LOC est.)
   - `commands/auth.rs` (auth IPC, 180 LOC est.)

**Total Estimated**: ~1,380 LOC Rust backend

### Phase 4 Frontend Implementation

**Estimated**: ~1,860 LOC TypeScript (per PLAN.md)

---

**End of Module Export Index**
