# Phase 4 Type Requirements

**Generated**: 2026-02-11
**Purpose**: Comprehensive extraction of Phase 4 type requirements for Client Mode & Multi-User Authorization
**Status**: Complete type documentation for implementation reference

---

## Table of Contents

1. [Rust Type Definitions](#1-rust-type-definitions)
2. [TypeScript Type Definitions](#2-typescript-type-definitions)
3. [Tauri Command Signatures](#3-tauri-command-signatures)
4. [Config Schema Changes](#4-config-schema-changes)
5. [Integration Points](#5-integration-points)
6. [Type Contract Matrix](#6-type-contract-matrix)

---

## 1. Rust Type Definitions

### 1.1 Client Domain Types (`src-tauri/src/client_domain/types.rs`)

#### ClientConfig
```rust
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
```

**Default Values**:
- `auto_reconnect`: true
- `reconnect_interval_secs`: 5
- `connection_timeout_secs`: 10

---

#### ConnectionState
```rust
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
```

**Default**: `Disconnected`

---

#### PeerInfo
```rust
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
```

---

#### AuthorizationLevel
```rust
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
```

**Permission Methods**:
```rust
impl AuthorizationLevel {
    pub fn can_manage_users(&self) -> bool {
        matches!(self, Self::Owner)
    }

    pub fn can_write(&self) -> bool {
        matches!(self, Self::Owner | Self::Member)
    }

    pub fn can_read(&self) -> bool {
        true // All levels can read
    }
}
```

**Default**: `Guest`

---

### 1.2 Auth Domain Types (`src-tauri/src/auth/types.rs`)

#### AccessLevel
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccessLevel {
    /// Full access: manage users, read/write
    Owner,

    /// Standard access: read/write, no user management
    Member,

    /// Limited access: read-only
    Guest,
}
```

**String Conversion**:
```rust
impl AccessLevel {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "owner" => Some(AccessLevel::Owner),
            "member" => Some(AccessLevel::Member),
            "guest" => Some(AccessLevel::Guest),
            _ => None,
        }
    }
}

impl std::fmt::Display for AccessLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Owner => write!(f, "owner"),
            Self::Member => write!(f, "member"),
            Self::Guest => write!(f, "guest"),
        }
    }
}
```

---

#### AuthUser
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    /// User's public key (hex-encoded compressed secp256k1)
    pub pubkey: String,

    /// User's petname
    pub petname: String,

    /// Access level granted
    pub level: AccessLevel,

    /// Authorization timestamp (ISO 8601)
    pub authorized_at: String,

    /// Last activity timestamp (ISO 8601)
    pub last_active: String,

    /// Invited by (public key, None if owner)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invited_by: Option<String>,
}
```

---

#### UserDatabase
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDatabase {
    /// Map of pubkey -> AuthUser
    pub users: HashMap<String, AuthUser>,

    /// Last updated timestamp (ISO 8601)
    pub updated_at: String,
}
```

**Methods**:
```rust
impl UserDatabase {
    pub fn new() -> Self;
    pub fn add_user(&mut self, user: AuthUser);
    pub fn remove_user(&mut self, pubkey: &str) -> Option<AuthUser>;
    pub fn get_user(&self, pubkey: &str) -> Option<&AuthUser>;
    pub fn update_last_active(&mut self, pubkey: &str);
}
```

---

#### Invitation
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invitation {
    /// One-time use token (64 hex chars, 32 bytes random)
    pub token: String,

    /// Access level to grant
    pub level: AccessLevel,

    /// Expiration timestamp (ISO 8601)
    pub expires_at: String,

    /// Current status
    pub status: InvitationStatus,

    /// Created by (public key)
    pub created_by: String,

    /// Created at timestamp (ISO 8601)
    pub created_at: String,

    /// Redeemed by (public key, None if not redeemed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redeemed_by: Option<String>,

    /// Redeemed at timestamp (ISO 8601, None if not redeemed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redeemed_at: Option<String>,
}
```

**Methods**:
```rust
impl Invitation {
    pub fn new(level: AccessLevel, expires_in_hours: u64, created_by: String) -> Self;
    pub fn is_expired(&self) -> bool;
    pub fn is_valid(&self) -> bool;
    pub fn redeem(&mut self, pubkey: String);
    pub fn revoke(&mut self);
}
```

---

#### InvitationStatus
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InvitationStatus {
    /// Not yet redeemed
    Pending,

    /// Successfully redeemed
    Accepted,

    /// Past expiration time
    Expired,

    /// Manually revoked by owner
    Revoked,
}
```

---

#### InvitationDatabase
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvitationDatabase {
    /// Map of token -> Invitation
    pub invitations: HashMap<String, Invitation>,

    /// Last updated timestamp (ISO 8601)
    pub updated_at: String,
}
```

**Methods**:
```rust
impl InvitationDatabase {
    pub fn new() -> Self;
    pub fn add_invitation(&mut self, invitation: Invitation);
    pub fn get_invitation(&self, token: &str) -> Option<&Invitation>;
    pub fn get_invitation_mut(&mut self, token: &str) -> Option<&mut Invitation>;
    pub fn cleanup_expired(&mut self);
}
```

---

#### InvitationData (QR Code Format)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvitationData {
    /// Protocol version
    pub version: String, // "edwinpai-invite-v1"

    /// Invitation details
    pub invitation: InvitationDetails,

    /// Optional gateway petname
    #[serde(skip_serializing_if = "Option::is_none")]
    pub petname: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvitationDetails {
    /// Gateway public key
    pub gateway_pubkey: String,

    /// Gateway network address
    pub gateway_address: String,

    /// Authorization level granted
    pub level: AccessLevel,

    /// Expiration timestamp (ISO 8601)
    pub expires_at: String,

    /// One-time use token
    pub token: String,
}
```

**Methods**:
```rust
impl InvitationData {
    pub fn new(
        gateway_pubkey: String,
        gateway_address: String,
        invitation: Invitation,
        petname: Option<String>,
    ) -> Self;

    pub fn to_json(&self) -> Result<String, serde_json::Error>;
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error>;
}
```

---

#### BRC-103 Authentication Types
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Brc103AuthHeaders {
    /// User's public key (X-BSV-Identity)
    pub identity: String,

    /// Nonce (X-BSV-Nonce)
    pub nonce: String,

    /// Signature (X-BSV-Signature)
    pub signature: String,
}

#[derive(Debug, Clone)]
pub struct NonceRecord {
    /// Nonce value
    pub nonce: String,

    /// First seen timestamp
    pub first_seen: std::time::Instant,

    /// Number of times seen
    pub count: u32,
}

pub struct NonceTracker {
    nonces: HashMap<String, NonceRecord>,
    max_age_secs: u64, // Default: 300 (5 minutes)
    cleanup_interval_secs: u64, // Default: 60 (1 minute)
    last_cleanup: std::time::Instant,
}
```

**Methods**:
```rust
impl NonceTracker {
    pub fn new() -> Self;
    pub fn check_and_record(&mut self, nonce: &str) -> Result<(), NonceError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NonceError {
    Reused,
}
```

---

### 1.3 Discovery Types

#### DiscoveredGateway (from `src-tauri/src/discovery/mdns.rs`)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredGateway {
    /// Gateway petname (from mDNS TXT record)
    pub petname: String,

    /// Gateway public key (first 16 hex chars from TXT)
    pub pubkey: String,

    /// Network address (IP:port)
    pub address: String,

    /// Application version
    pub version: String,

    /// Last seen timestamp
    pub last_seen: String,
}
```

---

## 2. TypeScript Type Definitions

### 2.1 Existing Types in `src/types/api.ts` (Phase 4 Extensions)

#### DiscoveredPeer
```typescript
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
```

---

#### ClientConnectionStatus
```typescript
export type ClientConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';
```

---

#### InvitationData
```typescript
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
```

---

#### UserAuthorization
```typescript
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
```

---

#### AccessLevel
```typescript
export type AccessLevel = 'owner' | 'member' | 'guest';

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
```

---

#### ClientConfig
```typescript
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
```

---

#### InvitationStatus
```typescript
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
```

---

### 2.2 New `src/types/auth.ts` (Phase 4)

```typescript
/**
 * BRC-103 authentication headers
 */
export interface Brc103AuthHeaders {
  'X-BSV-Identity': string;
  'X-BSV-Nonce': string;
  'X-BSV-Signature': string;
}

/**
 * Authorization request result
 */
export interface AuthorizationResult {
  authorized: boolean;
  level?: AccessLevel;
  error?: string;
}

/**
 * User session information
 */
export interface UserSession {
  pubkey: string;
  petname: string;
  level: AccessLevel;
  authenticatedAt: string;
  sessionId: string;
}

/**
 * Invitation creation request
 */
export interface CreateInvitationRequest {
  level: AccessLevel;
  expiresInHours: number;
}

/**
 * Invitation creation response
 */
export interface CreateInvitationResponse {
  token: string;
  qrCodeData: InvitationData;
  qrCodeSvg: string;
  deepLink: string; // edwinpai://invite/<base64url>
  expiresAt: string;
}

/**
 * Invitation redemption request
 */
export interface RedeemInvitationRequest {
  inviteData: InvitationData;
  clientPubkey: string;
}

/**
 * Invitation redemption response
 */
export interface RedeemInvitationResponse {
  success: boolean;
  level?: AccessLevel;
  gatewayPetname?: string;
  error?: string;
}

/**
 * User list entry
 */
export interface UserListEntry {
  pubkey: string;
  petname: string;
  level: AccessLevel;
  authorizedAt: string;
  lastActive: string;
  invitedBy?: string;
}

/**
 * Invitation list entry
 */
export interface InvitationListEntry {
  token: string;
  level: AccessLevel;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  redeemedBy?: string;
  redeemedAt?: string;
}
```

---

### 2.3 Client Mode Types (extensions to `src/types/client.ts`)

```typescript
/**
 * Gateway discovery result
 */
export interface GatewayDiscoveryResult {
  gateways: DiscoveredPeer[];
  scanDuration: number;
  method: 'mdns' | 'manual';
}

/**
 * Connection request
 */
export interface ConnectionRequest {
  gatewayAddress: string;
  gatewayPubkey: string;
  autoReconnect?: boolean;
}

/**
 * Connection response
 */
export interface ConnectionResponse {
  success: boolean;
  state: ClientConnectionStatus;
  gatewayPetname?: string;
  level?: AccessLevel;
  error?: string;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  state: ClientConnectionStatus;
  gatewayAddress?: string;
  gatewayPubkey?: string;
  gatewayPetname?: string;
  level?: AccessLevel;
  connectedAt?: string;
  lastError?: string;
}

/**
 * Disconnect request
 */
export interface DisconnectRequest {
  disableAutoReconnect?: boolean;
}

/**
 * Network scan options
 */
export interface NetworkScanOptions {
  timeoutSecs?: number; // Default: 5
  serviceType?: string; // Default: "_edwinpai._tcp.local"
}
```

---

## 3. Tauri Command Signatures

### 3.1 Client Mode Commands (`src-tauri/src/commands/client.rs`)

#### scan_network
```rust
#[tauri::command]
pub async fn scan_network(
    timeout_secs: Option<u64>
) -> Result<Vec<DiscoveredGateway>, String>
```

**Purpose**: Discover EdwinPAI gateways on local network via mDNS
**Default Timeout**: 5 seconds
**Returns**: List of discovered gateways with petname, pubkey, address, version

---

#### connect_to_gateway
```rust
#[tauri::command]
pub async fn connect_to_gateway(
    request: ConnectRequest
) -> Result<ConnectResponse, String>

// Where ConnectRequest is:
pub struct ConnectRequest {
    pub gateway_address: String,
    pub gateway_pubkey: String,
    pub auto_reconnect: Option<bool>,
}

// And ConnectResponse is:
pub struct ConnectResponse {
    pub success: bool,
    pub state: ConnectionState,
    pub error: Option<String>,
    pub gateway_petname: Option<String>,
}
```

**Purpose**: Establish BRC-103 authenticated connection to gateway
**Side Effects**: Stores connection state, initiates handshake

---

#### disconnect
```rust
#[tauri::command]
pub async fn disconnect(
    request: DisconnectRequest
) -> Result<(), String>

pub struct DisconnectRequest {
    pub disable_auto_reconnect: Option<bool>,
}
```

**Purpose**: Close connection to gateway
**Options**: Optionally disable auto-reconnect

---

#### get_connection_status
```rust
#[tauri::command]
pub async fn get_connection_status() -> Result<ConnectionStatus, String>

pub struct ConnectionStatus {
    pub state: ConnectionState,
    pub gateway_address: Option<String>,
    pub gateway_pubkey: Option<String>,
    pub gateway_petname: Option<String>,
    pub connected_at: Option<String>,
}
```

**Purpose**: Query current connection state and details

---

### 3.2 Authorization Commands (`src-tauri/src/commands/auth.rs`)

#### list_users
```rust
#[tauri::command]
pub async fn list_users(
    _req: ListUsersRequest
) -> Result<ListUsersResponse, String>

pub struct ListUsersResponse {
    pub users: Vec<AuthUser>,
}
```

**Purpose**: List all authorized users (requires Owner level)

---

#### get_user
```rust
#[tauri::command]
pub async fn get_user(
    req: GetUserRequest
) -> Result<GetUserResponse, String>

pub struct GetUserRequest {
    pub pubkey: String,
}

pub struct GetUserResponse {
    pub user: AuthUser,
}
```

**Purpose**: Get user details by public key

---

#### remove_user
```rust
#[tauri::command]
pub async fn remove_user(
    req: RemoveUserRequest
) -> Result<RemoveUserResponse, String>

pub struct RemoveUserRequest {
    pub pubkey: String,
}

pub struct RemoveUserResponse {
    pub success: bool,
    pub message: String,
}
```

**Purpose**: Remove user from authorized list (requires Owner level)

---

#### check_authorization
```rust
#[tauri::command]
pub async fn check_authorization(
    req: CheckAuthRequest
) -> Result<CheckAuthResponse, String>

pub struct CheckAuthRequest {
    pub pubkey: String,
}

pub struct CheckAuthResponse {
    pub authorized: bool,
    pub level: Option<AccessLevel>,
}
```

**Purpose**: Check if public key is authorized and get access level

---

#### verify_signature
```rust
#[tauri::command]
pub async fn verify_signature(
    req: VerifySignatureRequest
) -> Result<VerifySignatureResponse, String>

pub struct VerifySignatureRequest {
    pub pubkey: String,
    pub payload: Vec<u8>,
    pub signature: Vec<u8>,
}

pub struct VerifySignatureResponse {
    pub valid: bool,
}
```

**Purpose**: Verify BRC-103 signature (delegated to crypto domain)

---

### 3.3 Invitation Commands (`src-tauri/src/commands/invitation.rs`)

#### create_invitation
```rust
#[tauri::command]
pub async fn create_invitation(
    req: CreateInvitationRequest
) -> Result<CreateInvitationResponse, String>

pub struct CreateInvitationRequest {
    pub gateway_pubkey: String,
    pub gateway_address: String,
    pub level: AuthorizationLevel,
    pub expires_in_secs: u64,
    pub petname: Option<String>,
}

pub struct CreateInvitationResponse {
    pub invitation: InvitationToken,
    pub qr_code_svg: String,
    pub deep_link: String, // edwinpai://invite/<base64url>
}
```

**Purpose**: Generate invitation token and QR code (requires Owner level)

---

#### scan_qr_code
```rust
#[tauri::command]
pub async fn scan_qr_code(
    req: ScanQRCodeRequest
) -> Result<ScanQRCodeResponse, String>

pub struct ScanQRCodeRequest {
    pub qr_data_json: String,
}

pub struct ScanQRCodeResponse {
    pub qr_data: QRData,
    pub is_valid: bool,
    pub error: Option<String>,
}
```

**Purpose**: Parse and validate scanned QR code data

---

#### accept_invitation
```rust
#[tauri::command]
pub async fn accept_invitation(
    req: AcceptInvitationRequest
) -> Result<AcceptInvitationResponse, String>

pub struct AcceptInvitationRequest {
    pub invitation: InvitationToken,
}

pub struct AcceptInvitationResponse {
    pub success: bool,
    pub error: Option<String>,
    pub gateway_petname: Option<String>,
}
```

**Purpose**: Redeem invitation and connect to gateway

---

#### list_invitations
```rust
#[tauri::command]
pub async fn list_invitations() -> Result<ListInvitationsResponse, String>

pub struct ListInvitationsResponse {
    pub invitations: Vec<InvitationListEntry>,
}

pub struct InvitationListEntry {
    pub token: String,
    pub level: AccessLevel,
    pub status: InvitationStatus,
    pub created_at: String,
    pub expires_at: String,
    pub redeemed_by: Option<String>,
}
```

**Purpose**: List all invitations (Owner only)

---

#### revoke_invitation
```rust
#[tauri::command]
pub async fn revoke_invitation(
    req: RevokeInvitationRequest
) -> Result<RevokeInvitationResponse, String>

pub struct RevokeInvitationRequest {
    pub token: String,
}

pub struct RevokeInvitationResponse {
    pub success: bool,
}
```

**Purpose**: Revoke pending invitation (Owner only)

---

## 4. Config Schema Changes

### 4.1 Desktop Config (`src-tauri/src/commands/config.rs`)

#### Add `mode` field
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopConfig {
    pub version: String,

    // NEW in Phase 4
    pub mode: AppMode,

    // Existing fields
    pub gateway: GatewayConfig,
    pub mdns: MdnsConfig,
    pub ui: UiConfig,
    pub subscription: SubscriptionConfig,

    // NEW in Phase 4
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client: Option<ClientModeConfig>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    Gateway,
    Client,
}

impl Default for AppMode {
    fn default() -> Self {
        Self::Gateway
    }
}
```

---

#### ClientModeConfig (new)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientModeConfig {
    /// Last connected gateway config
    pub last_gateway: Option<ClientConfig>,

    /// Last successful connection timestamp
    pub last_connected_at: Option<String>,

    /// Auto-connect to last gateway on startup
    pub auto_connect_on_startup: bool,
}

impl Default for ClientModeConfig {
    fn default() -> Self {
        Self {
            last_gateway: None,
            last_connected_at: None,
            auto_connect_on_startup: false,
        }
    }
}
```

---

### 4.2 Updated Default Config
```rust
impl Default for DesktopConfig {
    fn default() -> Self {
        Self {
            version: "0.1.0".to_string(),
            mode: AppMode::Gateway, // NEW
            gateway: GatewayConfig::default(),
            mdns: MdnsConfig::default(),
            ui: UiConfig::default(),
            subscription: SubscriptionConfig::default(),
            client: None, // NEW - None until Client mode is enabled
        }
    }
}
```

---

### 4.3 TypeScript Config Extension (`src/types/config.ts`)

```typescript
export type AppMode = 'gateway' | 'client';

export interface DesktopConfig {
  version: string;
  mode: AppMode; // NEW
  gateway: GatewayConfig;
  mdns: MdnsConfig;
  ui: UiConfig;
  subscription: SubscriptionConfig;
  client?: ClientModeConfig; // NEW
}

export interface ClientModeConfig {
  lastGateway?: ClientConfig;
  lastConnectedAt?: string;
  autoConnectOnStartup: boolean;
}
```

---

## 5. Integration Points

### 5.1 Phase 1 Integration (Crypto Domain)

**BRC-103 Authentication**:
- `SignRequest` → signs authentication payloads with identity key
- `VerifyRequest` → verifies remote gateway signatures
- `GetPublicKeyRequest` → returns client's public key for handshake

**Used By**:
- Client connection handshake (`connect_to_gateway`)
- Invitation redemption (`accept_invitation`)
- Request signing in HTTP client

---

### 5.2 Phase 2 Integration (Subscription)

**Subscription Gating**:
- Gateway mode checks `CheckSubscriptionRequest` before accepting client connections
- Client mode does NOT require subscription (uses gateway's subscription)

**Authorization Flow**:
```
Client connects → Gateway checks own subscription → If active, proceed with auth
```

---

### 5.3 Phase 3 Integration (Gateway Process & mDNS)

**mDNS Discovery**:
- `scan_network` uses same mDNS service (`_edwinpai._tcp.local`)
- TXT records include `pubkey`, `version`, `petname`
- Gateway advertises on startup (if `mdns.enabled: true`)

**Tray Integration**:
- Client mode shows "Connected to [Petname]" status
- Gateway mode shows "Running" + connected client count

---

## 6. Type Contract Matrix

### 6.1 Rust ↔ TypeScript Mappings

| Rust Type | TypeScript Type | Serialization | Notes |
|-----------|----------------|---------------|-------|
| `ConnectionState` | `ClientConnectionStatus` | `"disconnected"` | lowercase enum |
| `AuthorizationLevel` | `AccessLevel` | `"owner"` | lowercase enum |
| `InvitationStatus` | `InvitationStatus` | `"pending"` | lowercase enum |
| `PeerInfo` | `DiscoveredPeer` | camelCase keys | via `#[serde(rename_all = "camelCase")]` |
| `ClientConfig` | `ClientConfig` | camelCase keys | identical structure |
| `InvitationData` | `InvitationData` | camelCase keys | QR code payload |
| `AuthUser` | `UserAuthorization` | camelCase keys | user record |
| `AppMode` | `AppMode` | `"gateway"` | config mode field |

---

### 6.2 IPC Type Contracts (Tauri Commands)

| Command | Request Type | Response Type | Error Type |
|---------|--------------|---------------|------------|
| `scan_network` | `Option<u64>` | `Vec<DiscoveredGateway>` | `String` |
| `connect_to_gateway` | `ConnectRequest` | `ConnectResponse` | `String` |
| `disconnect` | `DisconnectRequest` | `()` | `String` |
| `get_connection_status` | `()` | `ConnectionStatus` | `String` |
| `list_users` | `ListUsersRequest` | `ListUsersResponse` | `String` |
| `get_user` | `GetUserRequest` | `GetUserResponse` | `String` |
| `remove_user` | `RemoveUserRequest` | `RemoveUserResponse` | `String` |
| `check_authorization` | `CheckAuthRequest` | `CheckAuthResponse` | `String` |
| `create_invitation` | `CreateInvitationRequest` | `CreateInvitationResponse` | `String` |
| `accept_invitation` | `AcceptInvitationRequest` | `AcceptInvitationResponse` | `String` |
| `list_invitations` | `()` | `ListInvitationsResponse` | `String` |
| `revoke_invitation` | `RevokeInvitationRequest` | `RevokeInvitationResponse` | `String` |

---

### 6.3 File Persistence

| Data Type | File Path | Format | Owner |
|-----------|-----------|--------|-------|
| `UserDatabase` | `~/.edwinpai/authorized_users.json` | JSON | Gateway |
| `InvitationDatabase` | `~/.edwinpai/invitations.json` | JSON | Gateway |
| `ClientConfig` | `~/.edwinpai/desktop-config.json` → `client` field | JSON | Client |
| `NonceTracker` | In-memory only | N/A | Gateway |

---

### 6.4 mDNS TXT Record Format

| Key | Value | Example | Type |
|-----|-------|---------|------|
| `pubkey` | First 16 hex chars of public key | `02a1b2c3d4e5f6a7` | String |
| `version` | Application version | `1.0.0` | String |
| `petname` | URL-encoded petname | `Swift%20Falcon` | String |

**Service Type**: `_edwinpai._tcp.local`
**Port**: Gateway port (default: 3117)

---

## 7. Cross-Reference with Specification

### SPEC.md §8 (Multi-User Access Control)

✅ **§8.1 Permission Levels**: `AccessLevel` enum with Owner/Member/Guest
✅ **§8.2 Authorization Store**: `UserDatabase` persisted to `authorized_users.json`
✅ **§8.3 Invitation Flow**: `InvitationData` QR code format
✅ **§8.4 Request Authorization**: `NonceTracker` for replay prevention

### PLAN.md Phase 4 Tasks

✅ **Task 1 (LAN Discovery)**: `scan_network` command, `DiscoveredGateway` type
✅ **Task 2 (Client Mode Connection)**: `connect_to_gateway`, `ConnectionState` FSM
✅ **Task 3 (Multi-User Authorization)**: `AuthUser`, `UserDatabase`, permission checks
✅ **Task 4 (Invitation System)**: `Invitation`, `InvitationData`, QR encoding
✅ **Task 5 (Client Onboarding)**: Frontend types ready, config schema extended
✅ **Task 6 (Access Control Settings)**: `list_users`, `create_invitation`, `remove_user` commands

---

## 8. Implementation Checklist

### Rust Backend
- ✅ Client domain types defined (`src-tauri/src/client_domain/types.rs`)
- ✅ Auth domain types defined (`src-tauri/src/auth/types.rs`)
- ✅ Invitation types defined (`src-tauri/src/invitation/types.rs`)
- ✅ Config schema extended with `mode` field
- ✅ Tauri commands scaffolded (12 commands)

### TypeScript Frontend
- ✅ API extensions in `src/types/api.ts` (Phase 4 section)
- ⏳ New `src/types/auth.ts` (documented here, needs creation)
- ⏳ New `src/types/client.ts` (documented here, needs creation)
- ⏳ Config type updates in `src/types/config.ts`

### Integration Tests
- ⏳ BRC-103 handshake flow
- ⏳ Invitation lifecycle (create → QR → scan → redeem)
- ⏳ Permission enforcement (Owner/Member/Guest)
- ⏳ Nonce replay prevention
- ⏳ mDNS discovery timeout handling

---

**End of Phase 4 Type Requirements**
