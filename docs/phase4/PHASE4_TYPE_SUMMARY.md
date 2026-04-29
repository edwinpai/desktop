# Phase 4 Type Requirements - Executive Summary

**Generated**: 2026-02-11
**Full Documentation**: `PHASE4_TYPE_REQUIREMENTS.md`

---

## Quick Reference

### 7 Core Rust Type Modules

1. **Client Domain** (`client_domain/types.rs`)
   - `ClientConfig`, `ConnectionState`, `PeerInfo`, `AuthorizationLevel`

2. **Auth Domain** (`auth/types.rs`)
   - `AccessLevel`, `AuthUser`, `UserDatabase`, `Brc103AuthHeaders`, `NonceTracker`

3. **Invitation Domain** (`invitation/types.rs`)
   - `Invitation`, `InvitationStatus`, `InvitationData`, `QRData`

4. **Discovery** (`discovery/mdns.rs`)
   - `DiscoveredGateway`

5. **Config Extensions** (`commands/config.rs`)
   - `AppMode`, `ClientModeConfig` (new fields in `DesktopConfig`)

---

## 12 Tauri Command Signatures

### Client Mode (4 commands)
```rust
scan_network(timeout_secs: Option<u64>) -> Vec<DiscoveredGateway>
connect_to_gateway(request: ConnectRequest) -> ConnectResponse
disconnect(request: DisconnectRequest) -> ()
get_connection_status() -> ConnectionStatus
```

### Authorization (4 commands)
```rust
list_users(_req: ListUsersRequest) -> ListUsersResponse
get_user(req: GetUserRequest) -> GetUserResponse
remove_user(req: RemoveUserRequest) -> RemoveUserResponse
check_authorization(req: CheckAuthRequest) -> CheckAuthResponse
```

### Invitations (4 commands)
```rust
create_invitation(req: CreateInvitationRequest) -> CreateInvitationResponse
scan_qr_code(req: ScanQRCodeRequest) -> ScanQRCodeResponse
accept_invitation(req: AcceptInvitationRequest) -> AcceptInvitationResponse
list_invitations() -> ListInvitationsResponse
```

---

## Config Schema Changes

### DesktopConfig (2 new fields)
```rust
pub struct DesktopConfig {
    pub mode: AppMode,              // NEW: "gateway" | "client"
    pub client: Option<ClientModeConfig>, // NEW: client-specific settings
    // ... existing fields (gateway, mdns, ui, subscription)
}
```

### AppMode Enum
```rust
pub enum AppMode {
    Gateway,  // Default
    Client,
}
```

### ClientModeConfig
```rust
pub struct ClientModeConfig {
    pub last_gateway: Option<ClientConfig>,
    pub last_connected_at: Option<String>,
    pub auto_connect_on_startup: bool,
}
```

---

## TypeScript Type Extensions

### New `src/types/auth.ts` (8 interfaces)
- `Brc103AuthHeaders`, `AuthorizationResult`, `UserSession`
- `CreateInvitationRequest/Response`, `RedeemInvitationRequest/Response`
- `UserListEntry`, `InvitationListEntry`

### New `src/types/client.ts` (6 interfaces)
- `GatewayDiscoveryResult`, `ConnectionRequest/Response`
- `ConnectionStatus`, `DisconnectRequest`, `NetworkScanOptions`

### Extensions to `src/types/api.ts` (already in codebase)
- `DiscoveredPeer`, `ClientConnectionStatus`, `InvitationData`
- `UserAuthorization`, `AccessLevel`, `ClientConfig`, `InvitationStatus`

---

## Permission Matrix

| Level | Manage Users | Write Data | Read Data |
|-------|-------------|-----------|----------|
| **Owner** | ✅ | ✅ | ✅ |
| **Member** | ❌ | ✅ | ✅ |
| **Guest** | ❌ | ❌ | ✅ |

---

## State Machines

### ConnectionState FSM
```
Disconnected → Connecting → Connected
                    ↓           ↓
                 Failed      Reconnecting
                                ↓
                           Connected
```

### InvitationStatus FSM
```
Pending → Accepted
   ↓
Expired (after expiresAt)
   ↓
Revoked (manual)
```

---

## Integration Points with Prior Phases

### Phase 1 (Crypto Domain)
- BRC-103 signing: `SignRequest`, `VerifyRequest`
- Identity for auth: `GetPublicKeyRequest`

### Phase 2 (Subscription)
- Gateway validates subscription before accepting clients
- Client mode does NOT require subscription

### Phase 3 (Gateway & mDNS)
- `scan_network` uses `_edwinpai._tcp.local` service
- TXT records: `pubkey`, `version`, `petname`

---

## File Persistence

| Data | Path | Format |
|------|------|--------|
| Authorized users | `~/.edwinpai/authorized_users.json` | JSON |
| Invitations | `~/.edwinpai/invitations.json` | JSON |
| Client config | `~/.edwinpai/desktop-config.json` → `client` | JSON |
| Nonce cache | In-memory only | N/A |

---

## QR Code Format

### InvitationData Structure
```json
{
  "version": "edwinpai-invite-v1",
  "invitation": {
    "gatewayPubkey": "02a1b2c3...",
    "gatewayAddress": "192.168.1.100:3117",
    "level": "member",
    "expiresAt": "2026-02-12T12:00:00Z",
    "token": "<64 hex chars>"
  },
  "petname": "Swift Falcon"
}
```

**Deep Link**: `edwinpai://invite/<base64url(JSON)>`

---

## BRC-103 Authentication Headers

```typescript
{
  "X-BSV-Identity": "<client public key>",
  "X-BSV-Nonce": "<32-byte hex>",
  "X-BSV-Signature": "<ECDSA signature>"
}
```

**Replay Protection**:
- 5-minute nonce TTL
- In-memory `NonceTracker` with LRU cleanup

---

## Key Deviations from SPEC.md

All Phase 4 types align with SPEC.md §8 (Multi-User Access Control):
- ✅ 3-tier permission model (Owner/Member/Guest)
- ✅ QR code invitation format
- ✅ BRC-103 mutual authentication
- ✅ Nonce-based replay prevention

---

## Implementation Status

### ✅ Complete (existing in codebase)
- Rust types: `client_domain/types.rs`, `auth/types.rs`, `invitation/types.rs`
- TypeScript extensions: `src/types/api.ts` (Phase 4 section)
- Tauri command stubs: `commands/client.rs`, `commands/auth.rs`, `commands/invitation.rs`

### ⏳ Needs Creation (documented in PHASE4_TYPE_REQUIREMENTS.md)
- `src/types/auth.ts` (8 new interfaces)
- `src/types/client.ts` (6 new interfaces)
- Config type updates in `src/types/config.ts`

### ⏳ Pending Implementation
- BRC-103 handshake logic in `client_domain/connection.rs`
- Permission middleware in gateway request handler
- Integration tests for 12 Tauri commands

---

## Next Steps

1. **Frontend Types**: Create `src/types/auth.ts` and `src/types/client.ts`
2. **Config Migration**: Add v1→v2 migration for `mode` field
3. **Connection Manager**: Implement BRC-103 client handshake
4. **User Storage**: SQLite schema for `authorized_users.db`
5. **QR Generation**: SVG rendering in `invitation/qr.rs`
6. **Integration Tests**: Cover all 12 commands + permission enforcement

---

**For complete type definitions, see `PHASE4_TYPE_REQUIREMENTS.md`**
