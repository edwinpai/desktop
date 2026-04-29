# Phase 4 Unresolved Imports Report

**Date**: 2026-02-11
**Verification Status**: ⚠️ Import issues detected in TypeScript (31 errors)

---

## Executive Summary

- **Rust Imports**: ✅ All resolve correctly (22 unused import warnings only)
- **TypeScript Imports**: ❌ 31 errors (4 critical type export issues + 27 minor)
- **Impact**: IDE errors, potential runtime failures, CI type checking will fail

---

## TypeScript Import Errors

### Critical Issues (4 errors)

#### 1. Missing Export: `GatewayStatus`
**File**: `src/types/phase4.ts:373`

```typescript
export type { GatewayStatus } from './api';
```

**Error**: `Module '"./api"' has no exported member 'GatewayStatus'`

**Root Cause**: `api.ts` does not export `GatewayStatus` type

**Impact**: Any code importing `GatewayStatus` from `phase4.ts` will fail

**Fix**: Add to `src/types/api.ts`:
```typescript
export type GatewayStatus = 'running' | 'stopped' | 'starting' | 'error';
```

---

#### 2. Wrong Export Name: `HealthCheckResponse`
**File**: `src/types/phase4.ts:374`

```typescript
export type { HealthCheckResponse } from './api';
```

**Error**: `Module '"./api"' has no exported member named 'HealthCheckResponse'. Did you mean 'HealthResponse'?`

**Root Cause**: Type is named `HealthResponse` in `api.ts`, not `HealthCheckResponse`

**Impact**: Import name mismatch

**Fix**: Change to:
```typescript
export type { HealthResponse } from './api';
```

Or alias:
```typescript
export type { HealthResponse as HealthCheckResponse } from './api';
```

---

#### 3. Missing Export: `ShortId`
**File**: `src/types/phase4.ts:381`

```typescript
export type { ShortId } from './identity';
```

**Error**: `Module '"./identity"' has no exported member 'ShortId'`

**Root Cause**: `identity.ts` does not export `ShortId` type

**Impact**: Cannot import shortId functionality

**Fix**: Add to `src/types/identity.ts`:
```typescript
export type ShortId = string;  // 8-char hex prefix of SHA-256(pubkey)
```

---

#### 4. Type Incompatibility: `DiscoveredPeerUI.lastSeen`
**File**: `src/types/phase4.ts:31`

```typescript
interface DiscoveredPeerUI extends DiscoveredPeer {
    lastSeen: number;  // ❌ Conflicts with parent
}
```

**Error**: `Types of property 'lastSeen' are incompatible. Type 'number' is not assignable to type 'string'`

**Root Cause**: `DiscoveredPeer.lastSeen` is `string` (ISO timestamp), but UI layer wants `number` (Unix ms)

**Impact**: Cannot extend interface with incompatible type

**Fix Option 1** - Rename property:
```typescript
interface DiscoveredPeerUI extends DiscoveredPeer {
    lastSeenMs: number;  // Add new property, keep original
}
```

**Fix Option 2** - Don't extend:
```typescript
interface DiscoveredPeerUI {
    id: string;
    petname: string;
    address: string;
    port: number;
    lastSeen: number;  // UI uses number
    // ... other properties
}
```

**Recommendation**: Use Option 1 to maintain type relationship

---

### IPC Type Mismatch (1 error)

#### 5. `SignMessageRequest` Not Assignable to `InvokeArgs`
**File**: `src/lib/gateway.ts:88`

```typescript
const result = await invoke<SignMessageResponse>('sign_message', request);
// request: SignMessageRequest
```

**Error**: `Argument of type 'SignMessageRequest' is not assignable to parameter of type 'InvokeArgs | undefined'. Index signature for type 'string' is missing.`

**Root Cause**: Tauri `invoke` expects `Record<string, unknown>` but `SignMessageRequest` interface doesn't have index signature

**Impact**: Type checking fails, but may work at runtime

**Fix**: Add index signature to `SignMessageRequest`:
```typescript
export interface SignMessageRequest {
    message: string;
    encoding?: 'utf8' | 'hex' | 'base64';
    [key: string]: unknown;  // Add index signature
}
```

Or cast:
```typescript
const result = await invoke<SignMessageResponse>(
    'sign_message',
    request as Record<string, unknown>
);
```

---

### Test Mock Issues (7 errors)

#### 6-12. InvitationData Mock Structure
**File**: `src/hooks/useInvitations.test.ts`

**Lines**: 167, 186, 294, 314, 329, 345, 363

```typescript
const mockData = {} as InvitationData;
```

**Error**: `Type '{}' is missing the following properties from type 'InvitationData': version, invitation`

**Root Cause**: Empty object cast doesn't satisfy required properties

**Impact**: Test mocks incomplete, may cause runtime errors

**Fix**: Provide complete mock:
```typescript
const mockData: InvitationData = {
    version: '1.0.0',
    invitation: {
        token: 'mock-token-123',
        gatewayPubkey: 'mock-pubkey',
        gatewayAddress: '127.0.0.1:3000',
        level: 'guest',
        expiresAt: Date.now() + 86400000,
        petname: 'Mock Gateway'
    }
};
```

---

### Unused Declarations (24 errors)

These are low-priority but indicate dead code:

#### Unused Imports (8)
- `src/App.tsx:12` - `AppRoute`
- `src/components/client/AccessControlPanel.tsx:9` - `Select`
- `src/components/client/AccessControlPanel.test.tsx:2` - `fireEvent`
- `src/components/client/ClientModeFlow.test.tsx:2` - `fireEvent`
- `src/components/client/DiscoveryList.test.tsx:2` - `fireEvent`
- `src/components/client/InvitationManager.test.tsx:2` - `fireEvent`
- `src/components/client/ModeSwitch.test.tsx:2` - `fireEvent`
- `src/hooks/useInvitations.ts:7` - `InvitationStatus`
- `src/lib/gateway.ts:10` - `BsvAuthHeaders`

#### Unused Variables (7)
- `src/App.tsx:31` - `setCurrentUserLevel`
- `src/App.tsx:490` - `isClientConnected`
- `src/components/client/ClientModeFlow.test.tsx:182` - `rerender`
- `src/components/client/InvitationManager.test.tsx:279` - `user`
- `src/components/client/AccessControlPanel.test.tsx:5` - `AccessLevel` (imported but not used)

#### Type Issues (3)
- `src/components/client/AccessControlPanel.test.tsx:250` - Mock type mismatch (updateUser)
- `src/components/client/AccessControlPanel.test.tsx:341` - Mock type mismatch (removeUser)
- `src/hooks/useInvitations.test.ts:123` - Property access on `never` type

#### Missing Test Globals (2)
- `src/components/client/AccessControlPanel.test.tsx:41` - `afterEach` not defined
- `src/components/client/ModeSwitch.test.tsx:13` - `afterEach` not defined

**Fix**: Add to test setup or import from vitest:
```typescript
import { describe, it, expect, afterEach } from 'vitest';
```

---

## Rust Import Analysis

### Status: ✅ ALL IMPORTS RESOLVE

**Verification Method**: `cargo check --lib` (aside from logic errors)

**Result**: All Phase 4 Rust modules have valid import paths. No `E0432` (unresolved import) or `E0433` (module not found) errors.

---

### Unused Imports (22 warnings)

These are cosmetic only and do not affect compilation:

| File | Unused Import | Line |
|------|---------------|------|
| `commands/auth.rs` | `AccessLevel`, `InvitationStatus` | - |
| `commands/client.rs` | `CryptoDomain`, `std::path::PathBuf` | 15, 18 |
| `commands/config.rs` | *(no unused imports)* | - |
| `crypto_domain/signing.rs` | `SignRequest` | 8 |
| `crypto_domain/brc42.rs` | `Brc42Params` | 10 |
| `spv_domain/merkle.rs` | `MerkleProofNode` | 13 |
| `spv_domain/verifier.rs` | `BeefEnvelope`, `MerkleProofNode` | 13, 231 |
| `overlay_domain/client.rs` | `TransactionInput` | 274 |
| `subscription/types.rs` | `MerkleProof` | 7 |
| `gateway/process.rs` | `GatewayIpcError` | 18 |
| `gateway/types.rs` | `std::time::SystemTime` | 12 |
| `tray/menu.rs` | `Runtime`, `Submenu`, `MouseButton as CustomMouseButton` | 12, 13, 17 |
| `discovery/mdns.rs` | `std::time::Duration` | 13 |
| `client_domain/ipc_types.rs` | `ClientConfig` | 7 |
| `client_domain/connection.rs` | `PeerInfo`, `AuthorizationLevel` | 9 |
| `client_domain/storage.rs` | `Result as SqlResult`, `std::net::SocketAddr` | 9, 289 |
| `auth/invitations.rs` | `Serialize`, `Deserialize` | 15 |
| `auth/users.rs` | `Serialize`, `Deserialize` | 14 |

**Recommendation**: Clean up in batch with automated tool:
```bash
cargo clippy --fix -- -W unused_imports
```

---

## Import Dependency Graph

### Phase 4 Module Dependencies (Rust)

```
commands/
├── auth.rs
│   ├── uses: auth/users, auth/invitations, client_domain/types
│   └── exports: 10 Tauri commands
│
├── client.rs
│   ├── uses: client_domain/connection, discovery/mdns
│   └── exports: 5 Tauri commands
│
└── config.rs
    ├── uses: client_domain/types
    └── exports: 3 Tauri commands (set_mode, get_config, set_config)

discovery/
└── mdns.rs
    ├── uses: mdns-sd crate, tokio
    └── exports: DiscoveryManager

client_domain/
├── connection.rs
│   ├── uses: crypto_domain (for BRC-103 auth)
│   └── exports: ConnectionManager
│
├── storage.rs
│   ├── uses: rusqlite
│   └── exports: ClientStorage
│
└── types.rs
    └── exports: ClientConfig, ConnectionState, PeerInfo, AuthorizationLevel

auth/
├── users.rs
│   ├── uses: client_domain/types
│   └── exports: UserManager
│
└── invitations.rs
    ├── uses: client_domain/types, qrcode
    └── exports: InvitationManager
```

**Analysis**: All dependencies are **acyclic** and follow **proper layering**:
- Commands → Domain logic → Infrastructure
- No circular dependencies detected
- Clear separation of concerns

---

### Phase 4 Module Dependencies (TypeScript)

```
src/
├── types/
│   ├── api.ts (extended with Phase 4 types)
│   ├── client.ts (new Phase 4 types)
│   ├── auth.ts (updated with Phase 4 types)
│   └── phase4.ts (re-exports, has 3 broken imports)
│
├── components/client/
│   ├── AccessControlPanel.tsx → types/auth, hooks/useAuthorization
│   ├── ClientModeFlow.tsx → types/client, hooks/useClientMode
│   ├── DiscoveryList.tsx → types/client, hooks/useNetworkScan
│   ├── InvitationManager.tsx → types/auth, hooks/useInvitations
│   └── ModeSwitch.tsx → hooks/useConfig, types/api
│
└── hooks/
    ├── useClientMode.ts → lib/gateway, types/client
    ├── useAuthorization.ts → lib/gateway, types/auth
    ├── useNetworkScan.ts → lib/gateway, types/client
    └── useInvitations.ts → lib/gateway, types/auth
```

**Analysis**:
- ✅ Layered architecture maintained (hooks → lib → types)
- ❌ 3 broken imports in `phase4.ts` re-export layer
- ✅ No circular dependencies

---

## Resolution Priority

### Must Fix Before Merge (Critical - 4 items)
1. ✅ Add `GatewayStatus` export to `api.ts`
2. ✅ Fix `HealthCheckResponse` → `HealthResponse` in `phase4.ts`
3. ✅ Add `ShortId` export to `identity.ts`
4. ✅ Fix `DiscoveredPeerUI.lastSeen` type incompatibility

### Should Fix Before Merge (High - 8 items)
5. 🔲 Fix `SignMessageRequest` index signature
6. 🔲 Fix 7 `InvitationData` mock structures in tests
7. 🔲 Add `afterEach` imports to test files (2×)

### Can Fix Later (Low - 20 items)
8. 🔲 Remove unused TypeScript imports/variables (15×)
9. 🔲 Clean Rust unused imports (22×) via clippy
10. 🔲 Fix mock type mismatches in tests (2×)

---

## Verification Commands

### TypeScript
```bash
# Check all imports resolve
npx tsc --noEmit

# Expected after fixes: 0 errors (down from 31)
```

### Rust
```bash
# Check imports compile
cargo check --lib 2>&1 | grep "unresolved import\|cannot find"

# Expected: no output (all imports resolve)

# Check for unused imports
cargo clippy 2>&1 | grep "unused import"

# Expected: 22 warnings (cosmetic only)
```

---

**Report Generated**: 2026-02-11
**Next Review**: After critical TypeScript fixes applied
