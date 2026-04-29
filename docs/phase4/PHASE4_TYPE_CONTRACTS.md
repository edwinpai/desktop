# Phase 4 Type Contracts

**Phase**: 4 - Client Mode & Multi-User Authorization
**Date**: 2026-02-11
**Status**: Complete type definitions for client domain, invitation system, and authorization
**Purpose**: Define all TypeScript and Rust type contracts for client mode connections, peer discovery, multi-user authorization, and invitation flow

---

## Table of Contents

1. [Rust Type Definitions](#rust-type-definitions)
   - [client_domain::types](#client_domaintypes)
   - [client_domain::ipc_types](#client_domainipc_types)
   - [invitation::types](#invitationtypes)
2. [TypeScript Type Definitions](#typescript-type-definitions)
   - [api.ts Extensions](#apits-extensions)
3. [Type Mappings (Rust ↔ TypeScript)](#type-mappings-rust--typescript)
4. [Import Patterns](#import-patterns)
5. [Conflict Validation](#conflict-validation)

---

## Rust Type Definitions

### client_domain::types

**File**: `src-tauri/src/client_domain/types.rs`

```rust
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

/// Client-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClientConfig {
    /// Gateway address (e.g., "192.168.1.100:3000")
    pub gateway_address: String,

    /// Gateway public key (hex-encoded secp256k1)
    pub gateway_pubkey: String,

    /// Gateway petname (from mDNS TXT or manual entry)
    pub gateway_petname: String,

    /// Auto-reconnect on disconnect
    pub auto_reconnect: bool,

    /// Reconnect interval in seconds
    pub reconnect_interval_secs: u64,

    /// Connection timeout in seconds
    pub connection_timeout_secs: u64,
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

/// Connection state for client mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    /// Not connected to any gateway
    Disconnected,

    /// Attempting to connect
    Connecting,

    /// Connected and authenticated
    Connected,

    /// Connection lost, attempting reconnect
    Reconnecting,

    /// Connection failed (terminal state until retry)
    Failed,
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self::Disconnected
    }
}

/// Information about a discovered or connected peer
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfo {
    /// Peer public key (hex-encoded secp256k1)
    pub pubkey: String,

    /// Peer petname (derived from pubkey or custom)
    pub petname: String,

    /// Peer network address
    pub address: SocketAddr,

    /// Authorization level for this peer
    pub authorization_level: AuthorizationLevel,

    /// Last seen timestamp (RFC 3339)
    pub last_seen: String,

    /// Whether peer is currently online
    pub is_online: bool,
}

/// Authorization level for multi-user access
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuthorizationLevel {
    /// Full control (gateway owner)
    Owner,

    /// Read/write access (invited member)
    Member,

    /// Read-only access (temporary guest)
    Guest,
}

impl Default for AuthorizationLevel {
    fn default() -> Self {
        Self::Guest
    }
}

impl AuthorizationLevel {
    /// Check if this level can perform administrative actions
    pub fn can_manage_users(&self) -> bool {
        matches!(self, Self::Owner)
    }

    /// Check if this level can write data
    pub fn can_write(&self) -> bool {
        matches!(self, Self::Owner | Self::Member)
    }

    /// Check if this level can read data
    pub fn can_read(&self) -> bool {
        true // All levels can read
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_config_default() {
        let config = ClientConfig::default();
        assert_eq!(config.auto_reconnect, true);
        assert_eq!(config.reconnect_interval_secs, 5);
        assert_eq!(config.connection_timeout_secs, 10);
    }

    #[test]
    fn test_connection_state_default() {
        assert_eq!(ConnectionState::default(), ConnectionState::Disconnected);
    }

    #[test]
    fn test_authorization_level_permissions() {
        assert!(AuthorizationLevel::Owner.can_manage_users());
        assert!(!AuthorizationLevel::Member.can_manage_users());
        assert!(!AuthorizationLevel::Guest.can_manage_users());

        assert!(AuthorizationLevel::Owner.can_write());
        assert!(AuthorizationLevel::Member.can_write());
        assert!(!AuthorizationLevel::Guest.can_write());

        assert!(AuthorizationLevel::Owner.can_read());
        assert!(AuthorizationLevel::Member.can_read());
        assert!(AuthorizationLevel::Guest.can_read());
    }

    #[test]
    fn test_authorization_level_default() {
        assert_eq!(AuthorizationLevel::default(), AuthorizationLevel::Guest);
    }
}
```

---

### client_domain::ipc_types

**File**: `src-tauri/src/client_domain/ipc_types.rs`

```rust
use serde::{Deserialize, Serialize};
use super::types::{ClientConfig, ConnectionState, PeerInfo, AuthorizationLevel};

/// Request to connect to a gateway
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectRequest {
    /// Gateway address to connect to
    pub gateway_address: String,

    /// Optional gateway public key for verification
    pub gateway_pubkey: Option<String>,
}

/// Response from connect request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResponse {
    /// Whether connection succeeded
    pub success: bool,

    /// Current connection state
    pub state: ConnectionState,

    /// Error message if failed
    pub error: Option<String>,

    /// Gateway petname if connected
    pub gateway_petname: Option<String>,
}

/// Request to disconnect from gateway
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisconnectRequest {
    /// Whether to disable auto-reconnect
    pub disable_reconnect: bool,
}

/// Request to get list of discovered/connected peers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPeersRequest {
    /// Filter by online status (None = all peers)
    pub online_only: Option<bool>,
}

/// Response with peer list
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPeersResponse {
    /// List of discovered/connected peers
    pub peers: Vec<PeerInfo>,

    /// Total peer count
    pub total: usize,
}

/// Request to authorize a user
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeUserRequest {
    /// User's public key (hex-encoded)
    pub pubkey: String,

    /// Authorization level to grant
    pub level: AuthorizationLevel,

    /// Optional custom petname
    pub petname: Option<String>,
}

/// Response from authorization request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeUserResponse {
    /// Whether authorization succeeded
    pub success: bool,

    /// Error message if failed
    pub error: Option<String>,

    /// Updated peer info if successful
    pub peer: Option<PeerInfo>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connect_request_serialization() {
        let req = ConnectRequest {
            gateway_address: "192.168.1.100:3000".to_string(),
            gateway_pubkey: Some("02abc123".to_string()),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("gatewayAddress"));
        assert!(json.contains("gatewayPubkey"));
    }

    #[test]
    fn test_get_peers_response() {
        let resp = GetPeersResponse {
            peers: vec![],
            total: 0,
        };
        assert_eq!(resp.total, 0);
    }

    #[test]
    fn test_authorize_user_request() {
        let req = AuthorizeUserRequest {
            pubkey: "02def456".to_string(),
            level: AuthorizationLevel::Member,
            petname: Some("alice".to_string()),
        };
        assert_eq!(req.level, AuthorizationLevel::Member);
    }
}
```

---

### invitation::types

**File**: `src-tauri/src/invitation/types.rs`

```rust
use serde::{Deserialize, Serialize};
use super::super::client_domain::types::AuthorizationLevel;

/// Invitation token for QR code generation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InvitationToken {
    /// Gateway public key (hex-encoded)
    pub gateway_pubkey: String,

    /// Gateway network address
    pub gateway_address: String,

    /// Authorization level granted
    pub level: AuthorizationLevel,

    /// Token expiration timestamp (RFC 3339)
    pub expires_at: String,

    /// One-time use token (32 bytes hex)
    pub token: String,
}

/// QR code data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QRData {
    /// Protocol version (always "edwinpai-invite-v1")
    pub version: String,

    /// Serialized invitation token
    pub invitation: InvitationToken,

    /// Optional gateway petname for display
    pub petname: Option<String>,
}

impl QRData {
    /// Create new QR data from invitation
    pub fn new(invitation: InvitationToken, petname: Option<String>) -> Self {
        Self {
            version: "edwinpai-invite-v1".to_string(),
            invitation,
            petname,
        }
    }

    /// Serialize to JSON for QR encoding
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserialize from QR JSON
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

/// Invitation status tracking
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum InvitationStatus {
    /// Invitation created, awaiting acceptance
    Pending,

    /// Invitation accepted by recipient
    Accepted,

    /// Invitation expired (past expires_at)
    Expired,

    /// Invitation revoked by sender
    Revoked,
}

impl Default for InvitationStatus {
    fn default() -> Self {
        Self::Pending
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qr_data_serialization() {
        let token = InvitationToken {
            gateway_pubkey: "02abc123".to_string(),
            gateway_address: "192.168.1.100:3000".to_string(),
            level: AuthorizationLevel::Member,
            expires_at: "2026-02-11T12:00:00Z".to_string(),
            token: "a".repeat(64),
        };
        let qr = QRData::new(token, Some("alice-gateway".to_string()));

        let json = qr.to_json().unwrap();
        assert!(json.contains("edwinpai-invite-v1"));

        let parsed = QRData::from_json(&json).unwrap();
        assert_eq!(parsed.version, "edwinpai-invite-v1");
        assert_eq!(parsed.petname, Some("alice-gateway".to_string()));
    }

    #[test]
    fn test_invitation_status_default() {
        assert_eq!(InvitationStatus::default(), InvitationStatus::Pending);
    }

    #[test]
    fn test_invitation_token_equality() {
        let token1 = InvitationToken {
            gateway_pubkey: "02abc".to_string(),
            gateway_address: "192.168.1.1:3000".to_string(),
            level: AuthorizationLevel::Guest,
            expires_at: "2026-02-11T12:00:00Z".to_string(),
            token: "x".repeat(64),
        };
        let token2 = token1.clone();
        assert_eq!(token1, token2);
    }
}
```

---

## TypeScript Type Definitions

### api.ts Extensions

**File**: `src/types/api.ts` (append to existing file)

```typescript
// ============================================================================
// PHASE 4: CLIENT MODE & AUTHORIZATION TYPES
// ============================================================================

/**
 * Discovered peer from mDNS or manual entry
 */
export interface DiscoveredPeer {
  /** Peer public key (hex-encoded secp256k1) */
  pubkey: string;

  /** Peer petname (derived or custom) */
  petname: string;

  /** Network address (IP:port) */
  address: string;

  /** Whether peer is currently reachable */
  isOnline: boolean;

  /** Last seen timestamp (ISO 8601) */
  lastSeen: string;

  /** Current authorization level */
  authorizationLevel: AccessLevel;
}

/**
 * Client connection status
 */
export type ClientConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

/**
 * Invitation data for QR code generation
 */
export interface InvitationData {
  /** Protocol version */
  version: 'edwinpai-invite-v1';

  /** Invitation token */
  invitation: {
    /** Gateway public key */
    gatewayPubkey: string;

    /** Gateway network address */
    gatewayAddress: string;

    /** Authorization level granted */
    level: AccessLevel;

    /** Expiration timestamp (ISO 8601) */
    expiresAt: string;

    /** One-time use token (64 hex chars) */
    token: string;
  };

  /** Optional gateway petname */
  petname?: string;
}

/**
 * User authorization record
 */
export interface UserAuthorization {
  /** User's public key */
  pubkey: string;

  /** User's petname */
  petname: string;

  /** Access level granted */
  level: AccessLevel;

  /** Authorization timestamp (ISO 8601) */
  authorizedAt: string;

  /** Last activity timestamp (ISO 8601) */
  lastActive: string;
}

/**
 * Access level for multi-user authorization
 */
export type AccessLevel = 'owner' | 'member' | 'guest';

/**
 * Access level capability matrix
 */
export const ACCESS_CAPABILITIES: Record<AccessLevel, {
  canManageUsers: boolean;
  canWrite: boolean;
  canRead: boolean;
}> = {
  owner: {
    canManageUsers: true,
    canWrite: true,
    canRead: true,
  },
  member: {
    canManageUsers: false,
    canWrite: true,
    canRead: true,
  },
  guest: {
    canManageUsers: false,
    canWrite: false,
    canRead: true,
  },
};

/**
 * Client configuration
 */
export interface ClientConfig {
  /** Gateway address */
  gatewayAddress: string;

  /** Gateway public key */
  gatewayPubkey: string;

  /** Gateway petname */
  gatewayPetname: string;

  /** Auto-reconnect on disconnect */
  autoReconnect: boolean;

  /** Reconnect interval (seconds) */
  reconnectIntervalSecs: number;

  /** Connection timeout (seconds) */
  connectionTimeoutSecs: number;
}

/**
 * Invitation status
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
```

---

## Type Mappings (Rust ↔ TypeScript)

### Client Domain Types

| Rust Type | TypeScript Type | Serialization |
|-----------|----------------|---------------|
| `ClientConfig` | `ClientConfig` | camelCase JSON |
| `ConnectionState` | `ClientConnectionStatus` | lowercase strings |
| `PeerInfo` | `DiscoveredPeer` | camelCase JSON |
| `AuthorizationLevel` | `AccessLevel` | lowercase strings |

### IPC Message Types

| Rust Type | TypeScript Type | Direction |
|-----------|----------------|-----------|
| `ConnectRequest` | `{ gatewayAddress: string; gatewayPubkey?: string }` | TS → Rust |
| `ConnectResponse` | `{ success: boolean; state: ClientConnectionStatus; error?: string; gatewayPetname?: string }` | Rust → TS |
| `DisconnectRequest` | `{ disableReconnect: boolean }` | TS → Rust |
| `GetPeersRequest` | `{ onlineOnly?: boolean }` | TS → Rust |
| `GetPeersResponse` | `{ peers: DiscoveredPeer[]; total: number }` | Rust → TS |
| `AuthorizeUserRequest` | `{ pubkey: string; level: AccessLevel; petname?: string }` | TS → Rust |
| `AuthorizeUserResponse` | `{ success: boolean; error?: string; peer?: DiscoveredPeer }` | Rust → TS |

### Invitation Types

| Rust Type | TypeScript Type | Serialization |
|-----------|----------------|---------------|
| `InvitationToken` | `InvitationData['invitation']` | camelCase JSON |
| `QRData` | `InvitationData` | camelCase JSON |
| `InvitationStatus` | `InvitationStatus` | lowercase strings |

---

## Import Patterns

### Rust Imports

```rust
// Client domain types
use crate::client_domain::types::{
    ClientConfig,
    ConnectionState,
    PeerInfo,
    AuthorizationLevel,
};

// Client domain IPC
use crate::client_domain::ipc_types::{
    ConnectRequest,
    ConnectResponse,
    DisconnectRequest,
    GetPeersRequest,
    GetPeersResponse,
    AuthorizeUserRequest,
    AuthorizeUserResponse,
};

// Invitation types
use crate::invitation::types::{
    InvitationToken,
    QRData,
    InvitationStatus,
};

// Crypto domain types (Phase 1)
use crate::crypto_domain::types::{
    Keypair,
    PublicKey,
    Signature,
};

// Crypto domain IPC (Phase 1)
use crate::crypto_domain::ipc_types::{
    SignRequest,
    SignResponse,
    GetPublicKeyRequest,
    GetPublicKeyResponse,
};
```

### TypeScript Imports

```typescript
// Phase 4 types
import type {
  DiscoveredPeer,
  ClientConnectionStatus,
  InvitationData,
  UserAuthorization,
  AccessLevel,
  ClientConfig,
  InvitationStatus,
  ACCESS_CAPABILITIES,
} from '@/types/api';

// Phase 1 types (existing)
import type {
  SignRequest,
  SignResponse,
  GetPublicKeyRequest,
  GetPublicKeyResponse,
} from '@/types/ipc';

// Phase 2/3 types (existing)
import type {
  SubscriptionStatus,
  GatewayConfig,
  ChatMessage,
} from '@/types/api';

// Identity types (existing)
import type {
  Petname,
  ShortId,
} from '@/types/identity';
```

---

## Conflict Validation

### Phase 1-3 Type Review

✅ **No conflicts detected** with existing types:

#### Phase 1 (ipc.ts)
- `SignRequest`, `SignResponse` → Crypto domain only
- `GetPublicKeyRequest`, `GetPublicKeyResponse` → Crypto domain only
- **No overlap** with Phase 4 client/invitation types

#### Phase 2/3 (api.ts)
- `SubscriptionStatus` → 5 states (active, cached, expired, graceExceeded, notFound)
- **No overlap** with `InvitationStatus` (4 states: pending, accepted, expired, revoked)
- `GatewayConfig` → Gateway-specific settings
- **No overlap** with `ClientConfig` (client-specific settings)

#### Identity Types (identity.ts)
- `Petname` → String type for user-friendly names
- **Used consistently** in `PeerInfo.petname`, `UserAuthorization.petname`

### Naming Conventions

All Phase 4 types follow established patterns:

| Pattern | Examples |
|---------|----------|
| Request/Response pairs | `ConnectRequest/ConnectResponse`, `AuthorizeUserRequest/Response` |
| camelCase serialization | `#[serde(rename_all = "camelCase")]` |
| Enum lowercase strings | `ConnectionState → 'disconnected'`, `AccessLevel → 'owner'` |
| Optional fields | `Option<String>` in Rust, `string?` in TypeScript |

### Type Safety

All enums have explicit defaults:
```rust
impl Default for ConnectionState {
    fn default() -> Self {
        Self::Disconnected
    }
}

impl Default for AuthorizationLevel {
    fn default() -> Self {
        Self::Guest // Principle of least privilege
    }
}
```

---

## Module Export Index

### Rust Module Structure

```
src-tauri/src/
├── client_domain/
│   ├── mod.rs              // Re-exports types, ipc_types
│   ├── types.rs            // ClientConfig, ConnectionState, PeerInfo, AuthorizationLevel
│   ├── ipc_types.rs        // Connect/Disconnect/GetPeers/AuthorizeUser messages
│   └── connection.rs       // Implementation (Phase 4.2)
├── invitation/
│   ├── mod.rs              // Re-exports types
│   ├── types.rs            // InvitationToken, QRData, InvitationStatus
│   └── manager.rs          // Implementation (Phase 4.3)
├── crypto_domain/          // Phase 1 (existing)
│   ├── types.rs
│   └── ipc_types.rs
├── gateway_domain/         // Phase 2/3 (existing)
│   ├── types.rs
│   └── ipc_types.rs
└── commands/
    └── client.rs           // Tauri IPC handlers (Phase 4.2)
```

### TypeScript Module Structure

```
src/types/
├── api.ts                  // All REST/IPC types (Phase 1-4)
├── ipc.ts                  // Crypto domain IPC (Phase 1)
├── identity.ts             // Petname, ShortId (Phase 1)
├── subscription.ts         // Subscription FSM (Phase 2)
├── channels.ts             // Channel config (deferred)
└── access.ts               // Access control (deprecated, use api.ts AccessLevel)
```

---

## Implementation Checklist

- [ ] Create `src-tauri/src/client_domain/types.rs` with all 4 types
- [ ] Create `src-tauri/src/client_domain/ipc_types.rs` with 6 message types
- [ ] Create `src-tauri/src/invitation/types.rs` with 3 types
- [ ] Update `src-tauri/src/client_domain/mod.rs` to re-export types
- [ ] Update `src-tauri/src/invitation/mod.rs` to re-export types
- [ ] Extend `src/types/api.ts` with Phase 4 types
- [ ] Verify `cargo check` passes (CI-only)
- [ ] Verify `tsc --noEmit` passes
- [ ] Run unit tests (18 new tests: 12 Rust + 6 implied TS)
- [ ] Update `PHASE4_TYPE_CONTRACTS.md` if deviations occur

---

**Next**: Implement client domain connection logic using these type contracts.
