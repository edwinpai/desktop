# Phase 4 Type Contracts - Quick Reference

**Quick lookup guide for Phase 4 Rust types**

---

## Client Types (`crate::client::types`)

```rust
// Connection State Machine
pub enum ConnectionState {
    Disconnected | Connecting | Connected | Reconnecting | Failed
}

// Client Connection
pub struct ClientConnection {
    gateway_address: String,     // "192.168.1.100:3000"
    gateway_pubkey: String,       // 66 hex chars
    gateway_petname: String,      // "Swift Falcon"
    auto_reconnect: bool,
    session_token: Option<String>,
    session_expires_at: Option<String>,  // ISO 8601
}

// BRC-103 Challenge (gateway → client)
pub struct BRC103Challenge {
    nonce: String,                // 64 hex chars
    timestamp: String,            // ISO 8601
    gateway_pubkey: String,
    expires_at: String,           // ISO 8601
}

// BRC-103 Response (client → gateway)
pub struct BRC103Response {
    client_pubkey: String,
    signature: String,            // DER-encoded ECDSA
    nonce: String,
    timestamp: String,
}
```

---

## Auth Types (`crate::auth::types`)

```rust
// Access Control
pub enum UserRole {
    Owner | Member | Guest  // Default: Guest
}

impl UserRole {
    fn can_manage_users(&self) -> bool;  // Owner only
    fn can_write(&self) -> bool;         // Owner, Member
    fn can_read(&self) -> bool;          // All (always true)
}

// Authorized User
pub struct User {
    pubkey: String,               // 66 hex chars
    petname: String,
    role: UserRole,
    added_at: String,             // ISO 8601
    added_by: Option<String>,     // pubkey or None
    last_seen: Option<String>,
    is_active: bool,
}

// Invitation
pub struct Invitation {
    uuid: String,                 // UUID v4
    token: String,                // 64 hex chars (32 random bytes)
    role: UserRole,               // Member or Guest (never Owner)
    expires_at: String,           // ISO 8601
    created_by: String,           // owner's pubkey
    is_used: bool,
    redeemed_by: Option<String>,
}

// QR Code Format
pub enum QRCodeFormat {
    DeepLink(String),            // edwinpai://invite/<base64url>
    Json(String),                // Raw JSON
    Url(String),                 // API endpoint URL
}
```

---

## Discovery Types (`crate::discovery::types`)

```rust
// Base type from Phase 3
pub struct DiscoveredGateway {
    service_name: String,
    hostname: String,
    port: u16,
    addresses: Vec<String>,
    version: Option<String>,
    public_key: Option<String>,
    discovered_at: String,       // ISO 8601
}

// Phase 4 extensions
pub struct DiscoveredGatewayExtended {
    #[serde(flatten)]
    gateway: DiscoveredGateway,
    gateway_id: String,          // "gw:03abc123..."
    quality_score: u8,           // 0-100
    avg_response_time_ms: Option<u32>,
    discovery_count: u32,
    is_reachable: bool,
}

// Continuous Scanning
pub struct ContinuousScanConfig {
    enabled: bool,
    interval_secs: u64,          // Default: 30
    max_tracked: u32,            // Default: 10
    ping_timeout_ms: u64,        // Default: 2000
}
```

---

## Config Types (`crate::commands::config`)

```rust
// Operating Mode (Phase 3, extended Phase 4)
pub enum OperatingMode {
    Gateway | Client  // Default: Gateway
}

// Client Session (for reconnection)
pub struct ClientSessionConfig {
    gateway_pubkey: String,
    gateway_address: String,
    gateway_petname: String,
    connected_at: String,        // ISO 8601
    permission: String,          // "owner" | "member" | "guest"
}
```

---

## Import Patterns

```rust
// In client domain
use crate::auth::types::UserRole;

// In auth domain
use crate::crypto_domain::types::{SignRequest, SignResponse};

// In discovery domain
use super::mdns::DiscoveredGateway;
```

---

## Common Patterns

### Creating an invitation
```rust
let invitation = Invitation::new(
    UserRole::Member,
    24,  // expires in 24 hours
    owner_pubkey.to_string(),
);
```

### Checking permissions
```rust
if user.role.can_write() {
    // Allow write operation
}
```

### Quality scoring
```rust
let mut gateway = DiscoveredGatewayExtended::from_discovered(base_gateway);
gateway.update_quality(response_time_ms);
// quality_score now 0-100 based on response time
```

---

## Serde Naming Conventions

- **Rust fields**: `snake_case` (e.g., `gateway_pubkey`)
- **JSON fields**: `camelCase` (e.g., `"gatewayPubkey"`)
- **Enums**: `lowercase` (e.g., `"owner"`, `"member"`, `"guest"`)

---

## Test Examples

```rust
#[test]
fn test_user_role_permissions() {
    assert!(UserRole::Owner.can_manage_users());
    assert!(!UserRole::Member.can_manage_users());
    assert!(UserRole::Member.can_write());
    assert!(!UserRole::Guest.can_write());
}

#[test]
fn test_invitation_lifecycle() {
    let mut inv = Invitation::new(UserRole::Member, 24, "03owner".to_string());
    assert!(inv.is_valid());

    inv.redeem("03member".to_string());
    assert_eq!(inv.is_used, true);
    assert!(!inv.is_valid());
}
```

---

**For full details, see**: `PHASE4_MODULE_EXPORT_INDEX.md`
