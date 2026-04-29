# Phase 4 Type Contracts - Quick Reference Card

**Purpose**: Fast lookup for Phase 4 type imports and usage patterns
**Audience**: Developers implementing Phase 4 features

---

## Import Cheat Sheet

### Rust Imports

```rust
// Core domain types
use crate::client_domain::types::{
    ClientConfig,
    ConnectionState,
    PeerInfo,
    AuthorizationLevel,
};

// IPC types
use crate::client_domain::ipc_types::{
    ConnectRequest, ConnectResponse,
    DisconnectRequest,
    GetPeersRequest, GetPeersResponse,
    AuthorizeUserRequest, AuthorizeUserResponse,
};

// Config types
use crate::commands::config::{
    DesktopConfig,
    OperatingMode,
    ClientSessionConfig,
};

// Storage
use crate::client_domain::storage::UserStorage;
```

### TypeScript Imports

```typescript
// Authentication types
import type {
  AccessLevel,
  AuthUser,
  Invitation,
  InvitationData,
  Brc103AuthHeaders,
} from '@/types/auth';

// API types
import type {
  DiscoveredPeer,
  ClientConnectionStatus,
  ClientConfig,
} from '@/types/api';

// Desktop config
import type {
  DesktopConfig,
  OperatingMode,
  ClientSessionConfig,
} from '@/types/desktop-config';

// Utilities
import {
  canManageUsers,
  canWrite,
  parseInvitationData,
} from '@/types/auth';
```

---

## Common Patterns

### 1. Check User Permission (Rust)

```rust
fn requires_admin(level: AuthorizationLevel) -> Result<(), String> {
    if !level.can_manage_users() {
        return Err("Insufficient permission".to_string());
    }
    Ok(())
}
```

### 2. Check User Permission (TypeScript)

```typescript
function AdminButton({ level }: { level: AccessLevel }) {
  if (!canManageUsers(level)) return null;
  return <button>Admin Panel</button>;
}
```

### 3. Connect to Gateway (TypeScript → Rust)

```typescript
const response = await invoke<ConnectResponse>('connect_to_gateway', {
  gatewayAddress: '192.168.1.100:3000',
  gatewayPubkey: '0279be667...',
});

if (response.success) {
  console.log(`Connected to ${response.gatewayPetname}`);
}
```

### 4. Create Invitation (TypeScript → Rust)

```typescript
const { token, invitationData, expiresAt } =
  await invoke<CreateInvitationResponse>('create_invitation', {
    level: 'member',
    expiresInHours: 24,
  });

// Generate QR code from invitationData
const qrCode = await QRCode.toDataURL(invitationData);
```

### 5. Save Client Session (Rust)

```rust
let session = ClientSessionConfig {
    gateway_pubkey: "0279be667...".to_string(),
    gateway_address: "192.168.1.100:3000".to_string(),
    gateway_petname: "alice-gateway".to_string(),
    connected_at: chrono::Utc::now().to_rfc3339(),
    permission: "owner".to_string(),
};

let mut config = DesktopConfig::default();
config.mode = OperatingMode::Client;
config.last_client_session = Some(session);

save_config(config).await?;
```

### 6. Restore Client Session (TypeScript)

```typescript
const config = await invoke<DesktopConfig>('get_config');

if (config.mode === 'client' && config.lastClientSession) {
  const { gatewayAddress, gatewayPubkey } = config.lastClientSession;
  await invoke('connect_to_gateway', { gatewayAddress, gatewayPubkey });
}
```

---

## Type Mapping Reference

| Concept | Rust Type | TypeScript Type | Serialization |
|---------|-----------|-----------------|---------------|
| Operating mode | `OperatingMode` | `"gateway" \| "client"` | Lowercase |
| Connection state | `ConnectionState` | `ClientConnectionStatus` | Lowercase |
| Permission level | `AuthorizationLevel` | `AccessLevel` | Lowercase |
| Gateway info | `PeerInfo` | `DiscoveredPeer` | camelCase |
| Client config | `ClientConfig` | `ClientConfig` | camelCase |
| Timestamp | `SystemTime` | `string` (ISO 8601) | RFC 3339 |
| Network address | `SocketAddr` | `string` ("IP:port") | String |

---

## Permission Matrix

| Action | Guest | Member | Owner |
|--------|-------|--------|-------|
| Read chat | ✅ | ✅ | ✅ |
| Write chat | ❌ | ✅ | ✅ |
| Modify settings | ❌ | ✅ | ✅ |
| Create invitations | ❌ | ❌ | ✅ |
| Revoke users | ❌ | ❌ | ✅ |
| Manage gateway | ❌ | ❌ | ✅ |

**Code (Rust)**:
```rust
level.can_read()         // true for all
level.can_write()        // true for Member + Owner
level.can_manage_users() // true for Owner only
```

**Code (TypeScript)**:
```typescript
canRead(level)         // true for all
canWrite(level)        // true for 'member' + 'owner'
canManageUsers(level)  // true for 'owner' only
```

---

## Connection State Machine

```
Disconnected → Connecting → Connected
      ↑            ↓            ↓
      └─────── Failed ←────────┘
                   ↓
             Reconnecting
                   ↓
              Connected
```

**States**:
- `Disconnected`: Initial state, no connection
- `Connecting`: Connection attempt in progress
- `Connected`: Authenticated and ready
- `Reconnecting`: Lost connection, retrying
- `Failed`: Terminal state, manual retry required

---

## Default Config Values

| Field | Default Value |
|-------|---------------|
| `mode` | `"gateway"` |
| `gateway.port` | `3000` |
| `gateway.autoStart` | `true` |
| `gateway.autoRestart` | `true` |
| `gateway.maxRestarts` | `5` |
| `gateway.healthCheckIntervalMs` | `30000` (30s) |
| `mdns.enabled` | `true` |
| `ui.theme` | `"system"` |
| `ui.minimizeToTray` | `true` |
| `subscription.cacheTtlSeconds` | `3600` (1h) |
| `lastClientSession` | `null` |

---

## File Paths

| File | Purpose |
|------|---------|
| `src-tauri/src/client_domain/types.rs` | Core domain types |
| `src-tauri/src/client_domain/ipc_types.rs` | IPC request/response |
| `src-tauri/src/commands/config.rs` | Config schema + persistence |
| `src/types/auth.ts` | Auth + invitation types |
| `src/types/api.ts` | API extensions |
| `src/types/desktop-config.ts` | Desktop config mirror |
| `PHASE4_TYPE_EXPORT_INDEX.md` | Full documentation |

---

## Common Errors

### Error: User Not Authorized
```typescript
// TypeScript
if (!response.success && response.error?.includes('unauthorized')) {
  // User not in authorized list
  await promptInvitation();
}
```

### Error: Insufficient Permission
```rust
// Rust
if !level.can_manage_users() {
    return Err("ERR_AUTH_INSUFFICIENT_PERMISSION".to_string());
}
```

### Error: Connection Failed
```typescript
// TypeScript
if (response.state === 'failed') {
  console.error(response.error);
  // Show reconnect button
}
```

---

## Testing Helpers

### Mock PeerInfo (Rust)
```rust
let peer = PeerInfo {
    pubkey: "0279be667...".to_string(),
    petname: "test-gateway".to_string(),
    address: "127.0.0.1:3000".parse().unwrap(),
    authorization_level: AuthorizationLevel::Owner,
    last_seen: chrono::Utc::now().to_rfc3339(),
    is_online: true,
};
```

### Mock Invitation (TypeScript)
```typescript
const mockInvitation: Invitation = {
  token: 'a'.repeat(64),
  level: 'member',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  status: 'pending',
  createdBy: '0279be667...',
  createdAt: new Date().toISOString(),
};
```

---

**Quick Start**: See `PHASE4_TYPE_EXPORT_INDEX.md` for complete documentation.
