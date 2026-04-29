# IPC Bridge Type System

**Phase 1 Deliverable** | Created: 2026-02-09

## Overview

This document describes the Rust type definitions for the IPC bridge between the frontend (React/TypeScript) and backend (Tauri/Rust) in EdwinPAI Desktop. These types form the serialization contract for all crypto domain operations.

## File Structure

- **Source TypeScript**: `src/types/ipc.ts` (230 LOC)
- **Source Rust**: `src-tauri/src/crypto_domain/ipc_types.rs` (457 LOC)
- **Module Export**: `src-tauri/src/crypto_domain/mod.rs`

## Type Mapping Strategy

### 1. **Naming Conventions**

TypeScript uses `camelCase` for field names; Rust uses `snake_case`. Serde handles conversion:

```rust
#[derive(Serialize, Deserialize)]
pub struct SignRequest {
    #[serde(rename = "protocolID")]
    pub protocol_id: String,  // TypeScript: protocolID → Rust: protocol_id

    #[serde(rename = "keyID")]
    pub key_id: String,       // TypeScript: keyID → Rust: key_id
}
```

### 2. **Binary Data Handling**

TypeScript `Uint8Array` maps to Rust `Vec<u8>` with `serde_bytes` optimization:

```rust
#[derive(Serialize, Deserialize)]
pub struct SignRequest {
    #[serde(with = "serde_bytes")]
    pub payload: Vec<u8>,  // TypeScript: Uint8Array → Rust: Vec<u8>
}
```

This uses base64 encoding for JSON serialization (efficient transport).

### 3. **Optional Fields**

TypeScript optional fields (`field?: Type`) map to Rust `Option<Type>`:

```rust
// TypeScript: counterparty?: string
pub counterparty: Option<String>,
```

### 4. **Tagged Unions (Discriminated Unions)**

TypeScript discriminated unions use `type` field; Rust uses `#[serde(tag = "type")]`:

```typescript
// TypeScript
export type CryptoRequest =
  | SignRequest
  | VerifyRequest
  | GetPublicKeyRequest;
```

```rust
// Rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CryptoRequest {
    SignRequest(SignRequest),
    VerifyRequest(VerifyRequest),
    GetPublicKeyRequest(GetPublicKeyRequest),
}
```

## Request Types (11 total)

All requests are sent from the frontend to the Rust backend via Tauri IPC.

| Type | Fields | Purpose |
|------|--------|---------|
| `SignRequest` | `payload`, `protocolID`, `keyID`, `counterparty?` | BRC-42 signing |
| `VerifyRequest` | `payload`, `signature`, `publicKey` | Signature verification |
| `GetPublicKeyRequest` | `identityKey?`, `protocolID?`, `keyID?`, `counterparty?` | Public key retrieval |
| `CheckSubscriptionRequest` | `forceRefresh?` | Subscription status check |
| `EncryptRequest` | `plaintext`, `protocolID`, `keyID`, `counterparty` | BRC-2 encryption |
| `DecryptRequest` | `ciphertext`, `protocolID`, `keyID`, `counterparty` | BRC-2 decryption |
| `DeriveKeyRequest` | `protocolID`, `keyID`, `counterparty`, `securityLevel?` | BRC-42 key derivation |
| `SignMessageRequest` | `data`, `protocolID?`, `keyID?`, `useIdentityKey?` | BRC-103 message signing |
| `GetIdentityRequest` | _(empty)_ | Get user identity |
| `GenerateIdenticonRequest` | `publicKey`, `size?` | Generate BRC-103 identicon |
| `GetAuditLogRequest` | `operation?`, `startTime?`, `endTime?`, `limit?` | Query audit log |

## Response Types (11 total)

All responses are returned from the Rust backend to the frontend.

| Type | Fields | Purpose |
|------|--------|---------|
| `SignResponse` | `signature`, `publicKey` | Signature + key used |
| `VerifyResponse` | `valid` | Verification result |
| `GetPublicKeyResponse` | `publicKey` | Public key (hex) |
| `CheckSubscriptionResponse` | `active`, `expiresAt?`, `cachedProof` | Subscription state |
| `EncryptResponse` | `ciphertext` | Encrypted data |
| `DecryptResponse` | `plaintext` | Decrypted data |
| `DeriveKeyResponse` | `publicKey` | Derived public key |
| `SignMessageResponse` | `signature`, `publicKey` | Message signature |
| `GetIdentityResponse` | `publicKey`, `petname`, `avatarSvg`, `shortId` | Full identity |
| `GenerateIdenticonResponse` | `svg` | SVG markup |
| `GetAuditLogResponse` | `entries` | Audit log entries |

## Special Types

### `AuditLogEntry`

Serialized audit log entry (matches TypeScript exactly):

```rust
#[derive(Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub timestamp: String,              // ISO 8601
    pub operation: String,              // "sign", "verify", etc.
    #[serde(rename = "protocolId", skip_serializing_if = "Option::is_none")]
    pub protocol_id: Option<String>,
    #[serde(rename = "keyId", skip_serializing_if = "Option::is_none")]
    pub key_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty: Option<String>,
    #[serde(rename = "payloadHash", skip_serializing_if = "Option::is_none")]
    pub payload_hash: Option<String>,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
```

### `IpcError`

Serializable error type for IPC responses:

```rust
#[derive(Serialize, Deserialize)]
pub struct IpcError {
    pub code: String,           // "ERR_KEYCHAIN_UNAVAILABLE", etc.
    pub message: String,        // Human-readable description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,  // Optional structured data
}
```

**Error Codes** (matching SPEC §3.3.2):

- `ERR_KEYCHAIN_UNAVAILABLE` — OS keychain unavailable
- `ERR_KEY_NOT_FOUND` — Key not found in keychain
- `ERR_INVALID_KEY` — Malformed or invalid key
- `ERR_INVALID_SIGNATURE` — Signature verification failed
- `ERR_DERIVATION_FAILED` — BRC-42 derivation failed
- `ERR_SIGNING_FAILED` — ECDSA signing failed
- `ERR_VERIFICATION_FAILED` — Signature verification error
- `ERR_ENCRYPTION_FAILED` — BRC-2 encryption failed
- `ERR_DECRYPTION_FAILED` — BRC-2 decryption failed
- `ERR_INVALID_COUNTERPARTY` — Invalid counterparty key
- `ERR_SUBSCRIPTION_EXPIRED` — Subscription expired
- `ERR_SUBSCRIPTION_CHECK_FAILED` — Subscription check error
- `ERR_INTERNAL` — Internal error

**Constructor Helpers**:

```rust
IpcError::keychain_unavailable()
IpcError::key_not_found("identity")
IpcError::derivation_failed("invalid protocol ID")
IpcError::internal_error("unexpected state")
```

### Conversion from Internal Errors

Automatic conversion from `CryptoError` to `IpcError`:

```rust
impl From<crate::crypto_domain::types::CryptoError> for IpcError {
    fn from(err: crate::crypto_domain::types::CryptoError) -> Self {
        // Maps CryptoErrorCode → IpcError code strings
    }
}
```

## Union Types for Dispatching

Three top-level union types for message routing:

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CryptoRequest { /* 11 request variants */ }

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CryptoResponse { /* 11 response variants */ }

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CryptoMessage { /* All requests + responses + authorize spend */ }
```

These enable Tauri commands to accept generic `CryptoRequest` and dispatch to specific handlers.

## Tauri Command Integration

Example Tauri command signature using IPC types:

```rust
#[tauri::command]
async fn crypto_sign(
    request: IpcSignRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<IpcSignResponse> {
    // Business logic using crypto_domain modules
    let domain = &state.crypto_domain;
    let signature = domain.sign(&request.payload, /* ... */)?;

    Ok(IpcSignResponse {
        signature,
        public_key: /* ... */,
    })
}
```

Frontend invokes via Tauri invoke:

```typescript
import { invoke } from '@tauri-apps/api/core';

const response = await invoke<SignResponse>('crypto_sign', {
  request: {
    type: 'SignRequest',
    payload: new Uint8Array([1, 2, 3]),
    protocolID: 'edwinpai',
    keyID: 'session-1',
  }
});
```

## Type Aliases to Avoid Conflicts

Because `types.rs` already defines internal `SignRequest`, `VerifyRequest`, etc., the IPC module re-exports with aliases:

```rust
pub use ipc_types::{
    SignRequest as IpcSignRequest,
    SignResponse as IpcSignResponse,
    VerifyRequest as IpcVerifyRequest,
    VerifyResponse as IpcVerifyResponse,
    EncryptRequest as IpcEncryptRequest,
    EncryptResponse as IpcEncryptResponse,
    DecryptRequest as IpcDecryptRequest,
    DecryptResponse as IpcDecryptResponse,
    // ... (others use original names since no conflict)
};
```

**Usage in commands**:

```rust
use crate::crypto_domain::{IpcSignRequest, IpcSignResponse};

#[tauri::command]
async fn crypto_sign(req: IpcSignRequest) -> IpcResult<IpcSignResponse> {
    // ...
}
```

## Testing

The `ipc_types.rs` module includes unit tests:

```rust
#[test]
fn test_sign_request_serialization() {
    // Validates camelCase field names in JSON
}

#[test]
fn test_get_identity_response_serialization() {
    // Validates response field mapping
}

#[test]
fn test_ipc_error_construction() {
    // Validates error code and message formatting
}

#[test]
fn test_audit_log_entry_serialization() {
    // Validates optional field omission
}
```

Run tests:

```bash
cd edwinpai-desktop/src-tauri
cargo test crypto_domain::ipc_types
```

## Serde Features Used

1. **`#[serde(tag = "type")]`** — Tagged enum for discriminated unions
2. **`#[serde(rename = "fieldName")]`** — Field name mapping (snake_case ↔ camelCase)
3. **`#[serde(with = "serde_bytes")]`** — Efficient binary serialization
4. **`#[serde(skip_serializing_if = "Option::is_none")]`** — Omit null fields
5. **`#[serde(skip)]`** — Exclude non-serializable fields (used in `Keychain`)

## Type Safety Guarantees

1. **Compile-time checks** — Rust compiler validates all field types
2. **Serde validation** — Automatic deserialization validates JSON structure
3. **No runtime type errors** — TypeScript and Rust types are guaranteed compatible
4. **Tagged unions** — Impossible to construct invalid message variants
5. **Optional field handling** — Explicit `Option<T>` prevents null pointer errors

## Next Steps (Phase 2+)

- **BRC-2 encryption/decryption** — Implement `EncryptRequest`/`DecryptRequest` handlers
- **Subscription validation** — Implement `CheckSubscriptionRequest` with BSV proof verification
- **Authorization UI** — Implement `AuthorizeSpendRequest` modal dialog
- **Error telemetry** — Add structured error logging to `IpcError`
- **Performance metrics** — Add request/response timing to audit log

## References

- **SPEC §3.3** — Crypto Domain IPC Messages
- **BRC-42** — BSV Key Derivation Scheme ([source](https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md))
- **BRC-103** — Message Signing & Identity
- **BRC-2** — Encryption & Decryption Protocol
- **Tauri IPC** — [Tauri Command Documentation](https://tauri.app/v2/guide/inter-process-communication/)
- **Serde** — [Serde JSON Documentation](https://serde.rs/)

---

**File**: `edwinpai-desktop/docs/IPC_BRIDGE_TYPES.md`
**Author**: Claude Code (Sonnet 4.5)
**Phase**: 1 (Crypto Domain & BSV Identity)
**Status**: Complete
