# Phase 4 Type Export Index

**Purpose**: Comprehensive reference for all Phase 4 type definitions, import paths, and usage patterns.
**Status**: Phase 4 - Client Mode & Multi-User Authorization
**Last Updated**: 2026-02-11

---

## Table of Contents

1. [Rust Types](#rust-types)
   - [Core Domain Types](#core-domain-types)
   - [IPC Types](#ipc-types)
   - [Config Types](#config-types)
2. [TypeScript Types](#typescript-types)
   - [Authentication Types](#authentication-types)
   - [API Types](#api-types)
   - [IPC Bridge Types](#ipc-bridge-types)
3. [Type Mappings](#type-mappings)
4. [Usage Examples](#usage-examples)

---

## Rust Types

### Core Domain Types

**Location**: `src-tauri/src/client_domain/types.rs`

#### 1. `ClientConfig`
Client-specific configuration for gateway connections.

```rust
use crate::client_domain::types::ClientConfig;

pub struct ClientConfig {
    pub gateway_address: String,      // "192.168.1.100:3000"
    pub gateway_pubkey: String,        // Hex-encoded secp256k1 (66 chars)
    pub gateway_petname: String,       // "alice-gateway"
    pub auto_reconnect: bool,          // Default: true
    pub reconnect_interval_secs: u64,  // Default: 5
    pub connection_timeout_secs: u64,  // Default: 10
}
```

**Default**: Auto-reconnect enabled, 5s retry interval, 10s timeout

---

#### 2. `ConnectionState`
Connection lifecycle states for client mode.

```rust
use crate::client_domain::types::ConnectionState;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Disconnected,  // No active connection (initial state)
    Connecting,    // Connection attempt in progress
    Connected,     // Authenticated and ready
    Reconnecting,  // Lost connection, attempting reconnect
    Failed,        // Terminal state until manual retry
}
```

**Serialization**: Lowercase strings (`"disconnected"`, `"connected"`, etc.)

---

#### 3. `PeerInfo`
Discovered or connected peer information.

```rust
use crate::client_domain::types::PeerInfo;
use std::net::SocketAddr;

pub struct PeerInfo {
    pub pubkey: String,                           // Hex secp256k1
    pub petname: String,                          // BRC-42 derived or custom
    pub address: SocketAddr,                      // IPv4/IPv6 + port
    pub authorization_level: AuthorizationLevel,  // Owner/Member/Guest
    pub last_seen: String,                        // RFC 3339 timestamp
    pub is_online: bool,                          // Current reachability
}
```

**Usage**: Returned by mDNS discovery, stored in SQLite via `UserStorage`

---

#### 4. `AuthorizationLevel`
Multi-user access control hierarchy.

```rust
use crate::client_domain::types::AuthorizationLevel;

#[derive(serde::Serialize, serde::Deserialize, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum AuthorizationLevel {
    Guest = 0,   // Read-only chat
    Member = 1,  // Read/write, no admin
    Owner = 2,   // Full control (only 1 per gateway)
}

impl AuthorizationLevel {
    pub fn can_manage_users(&self) -> bool;  // Owner only
    pub fn can_write(&self) -> bool;         // Owner + Member
    pub fn can_read(&self) -> bool;          // All levels
}
```

**Ordering**: `Owner > Member > Guest`
**Serialization**: Lowercase strings (`"owner"`, `"member"`, `"guest"`)

---

### IPC Types

**Location**: `src-tauri/src/client_domain/ipc_types.rs`

#### 5. `ConnectRequest`
Request to connect to a gateway.

```rust
use crate::client_domain::ipc_types::ConnectRequest;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectRequest {
    pub gateway_address: String,       // "192.168.1.100:3000"
    pub gateway_pubkey: Option<String>, // Optional pubkey verification
}
```

**Tauri Command**: `connect_to_gateway`

---

#### 6. `ConnectResponse`
Response from connection attempt.

```rust
use crate::client_domain::ipc_types::ConnectResponse;

pub struct ConnectResponse {
    pub success: bool,                    // Connection succeeded
    pub state: ConnectionState,           // Current state
    pub error: Option<String>,            // Error message if failed
    pub gateway_petname: Option<String>,  // Petname if connected
}
```

**States on Success**: `Connected`
**States on Failure**: `Failed` + error message

---

#### 7. `DisconnectRequest`
Request to disconnect from gateway.

```rust
use crate::client_domain::ipc_types::DisconnectRequest;

pub struct DisconnectRequest {
    pub disable_reconnect: bool,  // Prevent auto-reconnect
}
```

**Tauri Command**: `disconnect_from_gateway`

---

#### 8. `GetPeersRequest`
Request to list discovered/connected peers.

```rust
use crate::client_domain::ipc_types::GetPeersRequest;

pub struct GetPeersRequest {
    pub online_only: Option<bool>,  // Filter: None = all, Some(true) = online
}
```

**Tauri Command**: `get_peers`

---

#### 9. `GetPeersResponse`
Response with peer list.

```rust
use crate::client_domain::ipc_types::GetPeersResponse;

pub struct GetPeersResponse {
    pub peers: Vec<PeerInfo>,  // Discovered/connected peers
    pub total: usize,          // Total count (before filtering)
}
```

**Sorting**: By `last_seen` descending (most recent first)

---

#### 10. `AuthorizeUserRequest`
Request to authorize a user (owner only).

```rust
use crate::client_domain::ipc_types::AuthorizeUserRequest;

pub struct AuthorizeUserRequest {
    pub pubkey: String,                   // User's public key (hex)
    pub level: AuthorizationLevel,        // Owner/Member/Guest
    pub petname: Option<String>,          // Custom petname (overrides BRC-42)
}
```

**Tauri Command**: `authorize_user`
**Permission Required**: `AuthorizationLevel::Owner`

---

#### 11. `AuthorizeUserResponse`
Response from authorization request.

```rust
use crate::client_domain::ipc_types::AuthorizeUserResponse;

pub struct AuthorizeUserResponse {
    pub success: bool,           // Authorization succeeded
    pub error: Option<String>,   // Error message if failed
    pub peer: Option<PeerInfo>,  // Updated peer info if successful
}
```

**Error Cases**: User already authorized, insufficient permission, invalid pubkey

---

### Config Types

**Location**: `src-tauri/src/commands/config.rs`

#### 12. `DesktopConfig`
Root configuration object.

```rust
use crate::commands::config::DesktopConfig;

pub struct DesktopConfig {
    pub version: String,                      // Semver format
    pub gateway: GatewayConfig,               // Gateway mode settings
    pub mdns: MdnsConfig,                     // mDNS discovery settings
    pub ui: UiConfig,                         // UI preferences
    pub subscription: SubscriptionConfig,     // Subscription caching
}
```

**Persistence**: `~/.edwinpai/desktop-config.json`
**Default Version**: `"0.1.0"`

---

#### 13. `GatewayConfig`
Gateway process configuration.

```rust
pub struct GatewayConfig {
    pub port: u16,                        // Default: 3000
    pub auto_start: bool,                 // Default: true
    pub auto_restart: bool,               // Default: true
    pub max_restarts: u32,                // Default: 5
    pub health_check_interval_ms: u64,    // Default: 30000 (30s)
    pub log_level: String,                // Default: "info"
}
```

**Health Checks**: Every 30s when gateway running

---

#### 14. `MdnsConfig`
mDNS discovery configuration.

```rust
pub struct MdnsConfig {
    pub enabled: bool,                     // Default: true
    pub service_name: Option<String>,      // Default: None (use hostname)
    pub advertise_on_startup: bool,        // Default: true
}
```

**Service Type**: `_edwinpai._tcp.local`
**TXT Records**: `pubkey`, `version`, `petname`

---

#### 15. `UiConfig`
UI preferences and window state.

```rust
pub struct UiConfig {
    pub theme: String,               // "light" | "dark" | "system"
    pub minimize_to_tray: bool,      // Default: true
    pub start_minimized: bool,       // Default: false
    pub window_width: u32,           // Default: 1200
    pub window_height: u32,          // Default: 800
    pub window_x: Option<i32>,       // Saved position
    pub window_y: Option<i32>,       // Saved position
}
```

**Theme Switching**: Uses Tailwind v4 dark mode variant

---

#### 16. `SubscriptionConfig`
Subscription verification settings.

```rust
pub struct SubscriptionConfig {
    pub cache_ttl_seconds: u64,         // Default: 3600 (1 hour)
    pub check_on_startup: bool,         // Default: true
    pub auto_renew_reminder_days: u32,  // Default: 7
}
```

**Cache Storage**: In-memory + periodic SPV verification

---

## TypeScript Types

### Authentication Types

**Location**: `src/types/auth.ts`

#### 17. `AccessLevel`
TypeScript equivalent of `AuthorizationLevel`.

```typescript
export type AccessLevel = 'owner' | 'member' | 'guest';
```

**Capability Matrix**: `ACCESS_CAPABILITIES` constant

---

#### 18. `AuthUser`
Authorized user record (mirrors Rust `PeerInfo`).

```typescript
export interface AuthUser {
  pubkey: string;          // Hex secp256k1
  petname: string;         // BRC-42 derived or custom
  level: AccessLevel;      // owner/member/guest
  authorizedAt: string;    // ISO 8601
  lastActive: string;      // ISO 8601
  invitedBy?: string | null;  // Inviter's pubkey (null if owner)
}
```

**Usage**: User management UI, permission checks

---

#### 19. `Invitation`
Invitation record with lifecycle tracking.

```typescript
export interface Invitation {
  token: string;              // 64 hex chars (one-time use)
  level: AccessLevel;         // Granted permission level
  expiresAt: string;          // ISO 8601
  status: InvitationStatus;   // pending/accepted/expired/revoked
  createdBy: string;          // Creator's pubkey (always owner)
  createdAt: string;          // ISO 8601
  redeemedBy?: string;        // Redeemer's pubkey
  redeemedAt?: string;        // ISO 8601
}
```

**Token Format**: Cryptographically random 32-byte hex string

---

#### 20. `InvitationStatus`
Invitation lifecycle states.

```typescript
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
```

**Transitions**: `pending` → `accepted` (single-use) or `expired` (time-based)

---

#### 21. `Brc103AuthHeaders`
BRC-103 authentication HTTP headers.

```typescript
export interface Brc103AuthHeaders {
  'X-BSV-Identity': string;   // Public key (hex)
  'X-BSV-Nonce': string;      // Nonce (hex)
  'X-BSV-Signature': string;  // ECDSA signature (hex)
}
```

**Signature Format**: Deterministic ECDSA (RFC 6979) over SHA-256 hash

---

#### 22. `InvitationDetails`
Invitation data for QR codes.

```typescript
export interface InvitationDetails {
  gatewayPubkey: string;    // Gateway's public key
  gatewayAddress: string;   // IP:port
  level: AccessLevel;       // Granted permission
  expiresAt: string;        // ISO 8601
  token: string;            // One-time use token
}
```

**QR Code Format**: JSON-encoded `InvitationData` (see below)

---

#### 23. `InvitationData`
Full invitation payload for QR encoding.

```typescript
export interface InvitationData {
  version: 'edwinpai-invite-v1';        // Protocol version
  invitation: InvitationDetails;     // Invitation details
  petname?: string;                  // Optional gateway petname
}
```

**Encoding**: `JSON.stringify()` → QR code
**Decoding**: Scan → `parseInvitationData(json)`

---

### API Types

**Location**: `src/types/api.ts`

#### 24. `DiscoveredPeer`
Peer discovered via mDNS (TypeScript equivalent of `PeerInfo`).

```typescript
export interface DiscoveredPeer {
  pubkey: string;                  // Hex secp256k1
  petname: string;                 // BRC-42 derived or custom
  address: string;                 // "IP:port"
  isOnline: boolean;               // Current reachability
  lastSeen: string;                // ISO 8601
  authorizationLevel: AccessLevel; // owner/member/guest
}
```

**Usage**: Client mode peer browser, connection UI

---

#### 25. `ClientConnectionStatus`
Connection state (TypeScript equivalent of `ConnectionState`).

```typescript
export type ClientConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';
```

**UI Indicators**: Color-coded status badges

---

#### 26. `ClientConfig`
Client configuration (TypeScript equivalent of Rust `ClientConfig`).

```typescript
export interface ClientConfig {
  gatewayAddress: string;           // "192.168.1.100:3000"
  gatewayPubkey: string;            // Hex secp256k1
  gatewayPetname: string;           // "alice-gateway"
  autoReconnect: boolean;           // Default: true
  reconnectIntervalSecs: number;    // Default: 5
  connectionTimeoutSecs: number;    // Default: 10
}
```

**Persistence**: Saved to `DesktopConfig` after successful connection

---

#### 27. `UserAuthorization`
User authorization record (extended `AuthUser`).

```typescript
export interface UserAuthorization {
  pubkey: string;           // User's public key
  petname: string;          // User's petname
  level: AccessLevel;       // owner/member/guest
  authorizedAt: string;     // ISO 8601
  lastActive: string;       // ISO 8601
}
```

**Usage**: User management table, permission guards

---

### IPC Bridge Types

**Location**: `src/types/ipc.ts` (existing) + `src/types/auth.ts` (new)

#### 28-39. Request/Response Pairs

All IPC types are documented in `src/types/auth.ts` with full TypeScript contracts:

| Request Type                      | Response Type                       | Tauri Command              |
|-----------------------------------|-------------------------------------|----------------------------|
| `ListUsersRequest`                | `ListUsersResponse`                 | `list_users`               |
| `GetUserRequest`                  | `GetUserResponse`                   | `get_user`                 |
| `RemoveUserRequest`               | `RemoveUserResponse`                | `remove_user`              |
| `UpdateUserActivityRequest`       | `UpdateUserActivityResponse`        | `update_user_activity`     |
| `CreateInvitationRequest`         | `CreateInvitationResponse`          | `create_invitation`        |
| `RedeemInvitationRequest`         | `RedeemInvitationResponse`          | `redeem_invitation`        |
| `RevokeInvitationRequest`         | `RevokeInvitationResponse`          | `revoke_invitation`        |
| `ListInvitationsRequest`          | `ListInvitationsResponse`           | `list_invitations`         |
| `CheckAuthorizationRequest`       | `CheckAuthorizationResponse`        | `check_authorization`      |
| `VerifyBrc103SignatureRequest`    | `VerifyBrc103SignatureResponse`     | `verify_brc103_signature`  |

**Total IPC Types**: 20 (10 request + 10 response pairs)

---

## Type Mappings

### Rust ↔ TypeScript Equivalents

| Rust Type               | TypeScript Type          | Serialization Format |
|-------------------------|--------------------------|----------------------|
| `ConnectionState`       | `ClientConnectionStatus` | Lowercase strings    |
| `AuthorizationLevel`    | `AccessLevel`            | Lowercase strings    |
| `PeerInfo`              | `DiscoveredPeer`         | camelCase fields     |
| `ClientConfig`          | `ClientConfig`           | camelCase fields     |
| `SystemTime`            | `string` (ISO 8601)      | RFC 3339 format      |
| `SocketAddr`            | `string` ("IP:port")     | String representation|

**Serialization**: All Rust structs use `#[serde(rename_all = "camelCase")]`

---

## Usage Examples

### Backend: Authorize User (Rust)

```rust
use crate::client_domain::{
    types::{PeerInfo, AuthorizationLevel},
    storage::UserStorage,
};
use std::path::PathBuf;

#[tauri::command]
async fn authorize_user(
    pubkey: String,
    level: AuthorizationLevel,
    petname: Option<String>,
) -> Result<PeerInfo, String> {
    // Validate permission (caller must be owner)
    // ... permission check ...

    // Create peer info
    let peer = PeerInfo {
        pubkey: pubkey.clone(),
        petname: petname.unwrap_or_else(|| derive_petname(&pubkey)),
        address: "0.0.0.0:0".parse().unwrap(), // Filled on connection
        authorization_level: level,
        last_seen: chrono::Utc::now().to_rfc3339(),
        is_online: false,
    };

    // Store in database
    let db_path = PathBuf::from("~/.edwinpai/users.db");
    let storage = UserStorage::new(db_path)?;
    storage.upsert_user(&peer)?;

    Ok(peer)
}
```

---

### Frontend: Connect to Gateway (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { ConnectRequest, ConnectResponse } from '@/types/ipc';

async function connectToGateway(address: string, pubkey?: string) {
  const request: ConnectRequest = {
    gatewayAddress: address,
    gatewayPubkey: pubkey,
  };

  const response = await invoke<ConnectResponse>('connect_to_gateway', request);

  if (response.success) {
    console.log(`Connected to ${response.gateway_petname}`);
    return response;
  } else {
    throw new Error(response.error || 'Connection failed');
  }
}
```

---

### Frontend: Create Invitation (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { CreateInvitationRequest, CreateInvitationResponse } from '@/types/auth';
import type { AccessLevel } from '@/types/api';

async function createInvitation(level: AccessLevel, expiresInHours: number) {
  const request: CreateInvitationRequest = { level, expiresInHours };

  const response = await invoke<CreateInvitationResponse>(
    'create_invitation',
    request
  );

  // Parse invitation data for QR code
  const invitationData = JSON.parse(response.invitationData);

  return {
    token: response.token,
    qrData: invitationData,
    expiresAt: response.expiresAt,
  };
}
```

---

### Backend: Query Users by Permission (Rust)

```rust
use crate::client_domain::{
    types::AuthorizationLevel,
    storage::UserStorage,
};

fn get_owners(storage: &UserStorage) -> Result<Vec<PeerInfo>, String> {
    // Query by authorization level
    let all_users = storage.get_all_users()?;

    let owners: Vec<PeerInfo> = all_users
        .into_iter()
        .filter(|u| u.authorization_level == AuthorizationLevel::Owner)
        .collect();

    // Should only be 1 owner per gateway
    if owners.len() > 1 {
        return Err("Multiple owners detected".to_string());
    }

    Ok(owners)
}
```

---

### Frontend: Permission Guard (TypeScript)

```typescript
import { ACCESS_CAPABILITIES, type AccessLevel } from '@/types/api';

function canManageUsers(level: AccessLevel): boolean {
  return ACCESS_CAPABILITIES[level].canManageUsers;
}

// Usage in React component
function UserManagementButton({ userLevel }: { userLevel: AccessLevel }) {
  if (!canManageUsers(userLevel)) {
    return null; // Hide button for non-owners
  }

  return <button onClick={openUserManagement}>Manage Users</button>;
}
```

---

## Type Count Summary

### Rust Types (20)
- **Core Domain**: `ClientConfig`, `ConnectionState`, `PeerInfo`, `AuthorizationLevel` (4)
- **IPC Types**: 6 request types + 5 response types (11)
- **Config Types**: `DesktopConfig`, `GatewayConfig`, `MdnsConfig`, `UiConfig`, `SubscriptionConfig` (5)

### TypeScript Types (27)
- **Authentication**: `AccessLevel`, `AuthUser`, `Invitation`, `InvitationStatus`, `Brc103AuthHeaders`, `InvitationDetails`, `InvitationData` (7)
- **API Extensions**: `DiscoveredPeer`, `ClientConnectionStatus`, `ClientConfig`, `UserAuthorization` (4)
- **IPC Bridge**: 10 request types + 10 response types (20) — documented in `auth.ts`

**Total Phase 4 Types**: 47 (20 Rust + 27 TypeScript)

---

## Related Documentation

- **Phase 3 Type Contracts**: `PHASE3_TYPE_CONTRACTS.md`
- **Phase 1 Crypto Types**: `CRYPTO_DOMAIN_TYPES_REFERENCE.md`
- **IPC Bridge Spec**: `IPC_BRIDGE_REQUIREMENTS.md`
- **SPEC.md**: §9.7 (Multi-User Authorization), §10 (REST API)
- **Rust Module Index**: `client_domain/mod.rs`

---

**End of Phase 4 Type Export Index**

**Maintainer**: EdwinPAI Desktop Team
**Revision**: 1.0 (Phase 4 Implementation)
**Next Review**: Phase 5 (Channels Configuration)
