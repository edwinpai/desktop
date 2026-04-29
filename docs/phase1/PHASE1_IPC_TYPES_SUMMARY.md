# Phase 1: IPC Bridge Types Implementation Summary

**Deliverable**: Rust IPC types for frontend-backend communication
**Date**: 2026-02-09
**Status**: ✅ COMPLETE

## Overview

Implemented complete Rust type definitions for the IPC bridge between React/TypeScript frontend and Tauri/Rust backend. All 22 message types (11 requests + 11 responses) are now fully defined with Serde serialization support.

## Files Created/Modified

### New Files (2)

1. **`src-tauri/src/crypto_domain/ipc_types.rs`** (457 LOC)
   - Serde-compatible request/response structs
   - Error types with serialization support
   - Union types for message dispatching
   - Comprehensive unit tests (4 tests)

2. **`docs/IPC_BRIDGE_TYPES.md`** (Documentation)
   - Type mapping strategy (TypeScript ↔ Rust)
   - Complete type reference
   - Tauri command integration examples
   - Error code reference

### Modified Files (1)

1. **`src-tauri/src/crypto_domain/mod.rs`**
   - Added `pub mod ipc_types`
   - Re-exported IPC types with aliases to avoid conflicts
   - Exposed `IpcError` and `IpcResult<T>` for command handlers

## Type Statistics

| Category | Count | Description |
|----------|-------|-------------|
| Request types | 11 | Frontend → Backend messages |
| Response types | 11 | Backend → Frontend messages |
| Union types | 3 | `CryptoRequest`, `CryptoResponse`, `CryptoMessage` |
| Error codes | 13 | Serializable error variants |
| Tests | 4 | Unit tests for serialization |

## Request Types Implemented

1. ✅ `SignRequest` — BRC-42 signing with derived keys
2. ✅ `VerifyRequest` — ECDSA signature verification
3. ✅ `GetPublicKeyRequest` — Identity/derived key retrieval
4. ✅ `CheckSubscriptionRequest` — Subscription status check
5. ✅ `EncryptRequest` — BRC-2 encryption (Phase 2+)
6. ✅ `DecryptRequest` — BRC-2 decryption (Phase 2+)
7. ✅ `DeriveKeyRequest` — Explicit BRC-42 key derivation
8. ✅ `SignMessageRequest` — BRC-103 message signing
9. ✅ `GetIdentityRequest` — User identity retrieval
10. ✅ `GenerateIdenticonRequest` — BRC-103 identicon generation
11. ✅ `GetAuditLogRequest` — Audit log query with filters

## Response Types Implemented

1. ✅ `SignResponse` — Signature + public key
2. ✅ `VerifyResponse` — Boolean validation result
3. ✅ `GetPublicKeyResponse` — Hex-encoded public key
4. ✅ `CheckSubscriptionResponse` — Active status + expiry
5. ✅ `EncryptResponse` — Ciphertext
6. ✅ `DecryptResponse` — Plaintext
7. ✅ `DeriveKeyResponse` — Derived public key
8. ✅ `SignMessageResponse` — Message signature
9. ✅ `GetIdentityResponse` — Full identity (petname, avatar, shortId)
10. ✅ `GenerateIdenticonResponse` — SVG markup
11. ✅ `GetAuditLogResponse` — Array of audit entries

## Key Design Decisions

### 1. Field Name Mapping

TypeScript uses `camelCase`, Rust uses `snake_case`. Serde handles conversion:

```rust
#[serde(rename = "protocolID")]
pub protocol_id: String,
```

### 2. Binary Data Optimization

`Uint8Array` → `Vec<u8>` with `serde_bytes` for efficient base64 serialization:

```rust
#[serde(with = "serde_bytes")]
pub payload: Vec<u8>,
```

### 3. Tagged Unions

Discriminated unions use `#[serde(tag = "type")]` for type-safe dispatching:

```rust
#[serde(tag = "type")]
pub enum CryptoRequest { /* ... */ }
```

### 4. Type Aliases for Conflicts

Internal `types.rs` already defines some type names, so IPC types are aliased:

```rust
pub use ipc_types::{
    SignRequest as IpcSignRequest,
    SignResponse as IpcSignResponse,
    // ...
};
```

### 5. Error Serialization

`IpcError` provides structured error responses with helper constructors:

```rust
IpcError::keychain_unavailable()
IpcError::derivation_failed("invalid protocol ID")
```

## Error Codes Defined

| Code | Usage |
|------|-------|
| `ERR_KEYCHAIN_UNAVAILABLE` | OS keychain unavailable |
| `ERR_KEY_NOT_FOUND` | Key missing from keychain |
| `ERR_INVALID_KEY` | Malformed key data |
| `ERR_INVALID_SIGNATURE` | Signature verification failed |
| `ERR_DERIVATION_FAILED` | BRC-42 derivation error |
| `ERR_SIGNING_FAILED` | ECDSA signing error |
| `ERR_VERIFICATION_FAILED` | Signature verification error |
| `ERR_ENCRYPTION_FAILED` | BRC-2 encryption error |
| `ERR_DECRYPTION_FAILED` | BRC-2 decryption error |
| `ERR_INVALID_COUNTERPARTY` | Invalid counterparty key |
| `ERR_SUBSCRIPTION_EXPIRED` | Subscription no longer active |
| `ERR_SUBSCRIPTION_CHECK_FAILED` | Subscription check error |
| `ERR_INTERNAL` | Internal/unexpected error |

## Serde Features Used

1. **`#[serde(tag = "type")]`** — Tagged enums (discriminated unions)
2. **`#[serde(rename = "fieldName")]`** — Field name conversion
3. **`#[serde(with = "serde_bytes")]`** — Binary data optimization
4. **`#[serde(skip_serializing_if = "Option::is_none")]`** — Omit null fields
5. **`derive(Serialize, Deserialize)`** — Automatic ser/de implementation

## Type Safety Guarantees

✅ **Compile-time validation** — Rust compiler checks all field types
✅ **Deserialization validation** — Serde validates JSON structure at runtime
✅ **No type coercion** — TypeScript and Rust types are exactly compatible
✅ **Tagged unions** — Impossible to construct invalid message variants
✅ **Optional field handling** — Explicit `Option<T>` prevents null errors

## Testing

### Unit Tests (4 tests)

```bash
cd edwinpai-desktop/src-tauri
cargo test crypto_domain::ipc_types
```

**Test Coverage**:

1. `test_sign_request_serialization` — Validates field name mapping
2. `test_get_identity_response_serialization` — Validates response structure
3. `test_ipc_error_construction` — Validates error helpers
4. `test_audit_log_entry_serialization` — Validates optional field omission

### Integration with Existing Tests

IPC types will be tested via Tauri command integration tests in Phase 2.

## Example Tauri Command

```rust
use crate::crypto_domain::{IpcSignRequest, IpcSignResponse, IpcResult};

#[tauri::command]
async fn crypto_sign(
    request: IpcSignRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<IpcSignResponse> {
    let domain = &state.crypto_domain;

    // Derive key if counterparty provided, else use identity key
    let keypair = if let Some(counterparty) = &request.counterparty {
        domain.derive_key(
            &request.protocol_id,
            &request.key_id,
            counterparty,
            2, // security level
        ).await?
    } else {
        domain.get_identity_keypair().await?
    };

    // Sign payload
    let signature = domain.sign(&request.payload, &keypair)?;

    Ok(IpcSignResponse {
        signature,
        public_key: keypair.public_key_hex(),
    })
}
```

## Frontend Usage Example

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { SignRequest, SignResponse } from '@/types/ipc';

async function signData(payload: Uint8Array) {
  const request: SignRequest = {
    type: 'SignRequest',
    payload,
    protocolID: 'edwinpai',
    keyID: 'session-1',
    counterparty: '03abc123...',
  };

  const response = await invoke<SignResponse>('crypto_sign', { request });
  console.log('Signature:', response.signature);
  console.log('Public key:', response.publicKey);
}
```

## Phase 1 Integration

These IPC types enable the following Phase 1 features:

- ✅ **BRC-42 key derivation** — `DeriveKeyRequest`/`DeriveKeyResponse`
- ✅ **ECDSA signing** — `SignRequest`/`SignResponse`, `SignMessageRequest`/`SignMessageResponse`
- ✅ **Signature verification** — `VerifyRequest`/`VerifyResponse`
- ✅ **Identity management** — `GetIdentityRequest`/`GetIdentityResponse`
- ✅ **Identicon generation** — `GenerateIdenticonRequest`/`GenerateIdenticonResponse`
- ✅ **Audit logging** — `GetAuditLogRequest`/`GetAuditLogResponse`

## Next Steps (Phase 2+)

1. **Implement Tauri commands** — Wire up handlers for all 11 request types
2. **BRC-2 encryption** — Implement `EncryptRequest`/`DecryptRequest` handlers
3. **Subscription validation** — Implement `CheckSubscriptionRequest` with BSV proof
4. **Authorization UI** — Implement modal for `AuthorizeSpendRequest`
5. **Integration tests** — End-to-end tests for all IPC message flows
6. **Error telemetry** — Structured logging of IPC errors

## References

- **TypeScript source**: `src/types/ipc.ts` (230 LOC)
- **SPEC §3.3**: Crypto Domain IPC Messages
- **BRC-42**: BSV Key Derivation Scheme
- **BRC-103**: Message Signing & Identity
- **Tauri IPC**: https://tauri.app/v2/guide/inter-process-communication/
- **Serde**: https://serde.rs/

## Deliverables Checklist

- [x] Create `ipc_types.rs` with all 22 message types
- [x] Define `IpcError` with 13 error codes
- [x] Add Serde field name mapping (`camelCase` ↔ `snake_case`)
- [x] Add binary data optimization (`serde_bytes`)
- [x] Create union types for dispatching
- [x] Export types from `mod.rs` with aliases
- [x] Write comprehensive documentation
- [x] Add unit tests for serialization
- [x] Verify no Rust syntax errors

---

**Status**: All IPC bridge types implemented and ready for Tauri command integration.
**Next**: Implement Tauri command handlers using these types.
