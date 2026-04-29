# Tauri Command Contracts (Phase 1)

**Reference**: Function signatures for Tauri commands using IPC bridge types
**Date**: 2026-02-09

## Overview

This document defines the Rust function signatures for all Tauri commands that will be implemented in Phase 1 and beyond. Each command uses the IPC types defined in `ipc_types.rs`.

## Command Naming Convention

- **Pattern**: `crypto_{operation}` for crypto domain operations
- **Examples**: `crypto_sign`, `crypto_verify`, `crypto_derive_key`
- **Frontend invocation**: `invoke('crypto_sign', { request })`

## Phase 1 Commands (11 total)

### 1. Sign (BRC-42 + ECDSA)

```rust
#[tauri::command]
async fn crypto_sign(
    request: IpcSignRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<IpcSignResponse>
```

**Logic**:
- If `counterparty` provided: derive key via BRC-42, then sign
- Else: use identity key to sign
- Log to audit log
- Return signature + public key hex

---

### 2. Verify (ECDSA)

```rust
#[tauri::command]
async fn crypto_verify(
    request: IpcVerifyRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<IpcVerifyResponse>
```

**Logic**:
- Parse public key from hex
- Verify signature using `signing::verify_signature`
- Log to audit log
- Return boolean result

---

### 3. Get Public Key

```rust
#[tauri::command]
async fn crypto_get_public_key(
    request: GetPublicKeyRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<GetPublicKeyResponse>
```

**Logic**:
- If `identityKey == true`: return identity public key
- Else if `protocolID`, `keyID`, `counterparty` provided: derive key via BRC-42
- Else: return error (ambiguous request)
- Log to audit log
- Return public key hex

---

### 4. Check Subscription

```rust
#[tauri::command]
async fn crypto_check_subscription(
    request: CheckSubscriptionRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<CheckSubscriptionResponse>
```

**Logic**:
- If `forceRefresh == true`: contact gateway for fresh proof
- Else: check cached subscription state
- Validate BSV proof (Phase 2+)
- Log to audit log
- Return `active`, `expiresAt`, `cachedProof`

---

### 5. Encrypt (BRC-2)

```rust
#[tauri::command]
async fn crypto_encrypt(
    request: IpcEncryptRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<IpcEncryptResponse>
```

**Logic** (Phase 2+):
- Derive shared secret via BRC-42 ECDH
- Encrypt plaintext using AES-256-GCM
- Log to audit log (payload hash only)
- Return ciphertext

---

### 6. Decrypt (BRC-2)

```rust
#[tauri::command]
async fn crypto_decrypt(
    request: IpcDecryptRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<IpcDecryptResponse>
```

**Logic** (Phase 2+):
- Derive shared secret via BRC-42 ECDH
- Decrypt ciphertext using AES-256-GCM
- Log to audit log (payload hash only)
- Return plaintext

---

### 7. Derive Key (Explicit BRC-42)

```rust
#[tauri::command]
async fn crypto_derive_key(
    request: DeriveKeyRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<DeriveKeyResponse>
```

**Logic**:
- Call `brc42::derive_key` with parameters
- Cache derived key in keychain
- Log to audit log
- Return derived public key hex

---

### 8. Sign Message (BRC-103)

```rust
#[tauri::command]
async fn crypto_sign_message(
    request: SignMessageRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<SignMessageResponse>
```

**Logic**:
- If `useIdentityKey == true`: sign with identity key
- Else if `protocolID`, `keyID` provided: derive key, then sign
- Else: use identity key (default)
- Log to audit log
- Return signature + public key hex

---

### 9. Get Identity

```rust
#[tauri::command]
async fn crypto_get_identity(
    request: GetIdentityRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<GetIdentityResponse>
```

**Logic**:
- Retrieve identity keypair from keychain
- Generate petname via `identity::generate_petname`
- Generate identicon via `identity::generate_identicon`
- Generate short ID via `identity::generate_short_id`
- Return full identity structure

---

### 10. Generate Identicon

```rust
#[tauri::command]
async fn crypto_generate_identicon(
    request: GenerateIdenticonRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<GenerateIdenticonResponse>
```

**Logic**:
- Parse public key from hex
- Generate identicon SVG via `identity::generate_identicon`
- Return SVG markup

---

### 11. Get Audit Log

```rust
#[tauri::command]
async fn crypto_get_audit_log(
    request: GetAuditLogRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<GetAuditLogResponse>
```

**Logic**:
- Read audit log file (`.jsonl`)
- Filter by `operation`, `startTime`, `endTime`
- Apply `limit` (default: 100, max: 1000)
- Parse JSON Lines into `AuditLogEntry` structs
- Return entries array

---

## Authorization Command (User Interaction)

### 12. Authorize Spend (Modal Dialog)

```rust
#[tauri::command]
async fn crypto_authorize_spend(
    request: AuthorizeSpendRequest,
    window: tauri::Window,
) -> IpcResult<AuthorizeSpendResponse>
```

**Logic**:
- Emit event to frontend: `authorize-spend-request`
- Frontend shows modal with `txid`, `vout`, `amount`, `description`
- User clicks "Approve" or "Deny"
- Frontend emits event: `authorize-spend-response` with `authorized` bool
- Backend returns response to caller

---

## AppState Structure

All commands use `tauri::State<'_, AppState>` for shared state:

```rust
pub struct AppState {
    pub crypto_domain: Arc<EdwinPAICryptoDomain>,
    pub config: Arc<RwLock<AppConfig>>,
    pub subscription_cache: Arc<RwLock<Option<SubscriptionProof>>>,
}
```

---

## Error Handling Pattern

All commands return `IpcResult<T> = Result<T, IpcError>`:

```rust
#[tauri::command]
async fn crypto_sign(
    request: IpcSignRequest,
    state: tauri::State<'_, AppState>,
) -> IpcResult<IpcSignResponse> {
    let domain = &state.crypto_domain;

    // Business logic
    let result = domain.sign(&request.payload, /* ... */)
        .map_err(|e| IpcError::from(e))?;  // Convert CryptoError → IpcError

    // Or use custom error
    if invalid_condition {
        return Err(IpcError::derivation_failed("reason"));
    }

    Ok(response)
}
```

Tauri automatically serializes `IpcError` as JSON:

```json
{
  "code": "ERR_DERIVATION_FAILED",
  "message": "Key derivation failed: reason"
}
```

---

## Registration in `main.rs`

Add all commands to Tauri builder:

```rust
fn main() {
    tauri::Builder::default()
        .manage(AppState {
            crypto_domain: Arc::new(EdwinPAICryptoDomain::new()?),
            config: Arc::new(RwLock::new(AppConfig::load()?)),
            subscription_cache: Arc::new(RwLock::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            // Crypto domain commands (Phase 1)
            crypto_sign,
            crypto_verify,
            crypto_get_public_key,
            crypto_check_subscription,
            crypto_derive_key,
            crypto_sign_message,
            crypto_get_identity,
            crypto_generate_identicon,
            crypto_get_audit_log,

            // Encryption/decryption (Phase 2+)
            crypto_encrypt,
            crypto_decrypt,

            // Authorization (Phase 2+)
            crypto_authorize_spend,

            // Other domains...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Frontend Invocation Pattern

```typescript
import { invoke } from '@tauri-apps/api/core';
import type {
  SignRequest,
  SignResponse,
  IpcError
} from '@/types/ipc';

async function signData(payload: Uint8Array) {
  try {
    const request: SignRequest = {
      type: 'SignRequest',
      payload,
      protocolID: 'edwinpai',
      keyID: 'session-1',
      counterparty: '03abc123...',
    };

    const response = await invoke<SignResponse>('crypto_sign', { request });
    console.log('Signature:', response.signature);
    return response;

  } catch (error) {
    // Tauri serializes IpcError as { code, message, details? }
    const ipcError = error as IpcError;
    if (ipcError.code === 'ERR_KEYCHAIN_UNAVAILABLE') {
      // Handle keychain error
    }
    throw error;
  }
}
```

---

## Type Safety Flow

1. **TypeScript request** → Serde deserializes → **Rust request struct**
2. **Business logic** → Internal types (`CryptoError`, `Keypair`, etc.)
3. **Rust response struct** → Serde serializes → **TypeScript response**
4. **Errors** → `CryptoError` converted to `IpcError` → Serde → **TypeScript error**

At every step, types are validated:
- **Compile-time**: Rust type checker
- **Runtime**: Serde deserialization validation
- **TypeScript**: Type annotations (development-time only)

---

## Testing Commands

### Unit Test (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_crypto_sign_with_identity_key() {
        let state = create_test_state().await;
        let request = IpcSignRequest {
            payload: vec![1, 2, 3, 4],
            protocol_id: "edwinpai".into(),
            key_id: "test".into(),
            counterparty: None,  // Use identity key
        };

        let response = crypto_sign(request, state).await.unwrap();
        assert_eq!(response.signature.len(), 64..=72);  // DER encoding
        assert_eq!(response.public_key.len(), 66);      // Compressed hex
    }
}
```

### Integration Test (TypeScript + Rust)

```typescript
import { test, expect } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

test('crypto_sign returns valid signature', async () => {
  const request: SignRequest = {
    type: 'SignRequest',
    payload: new Uint8Array([1, 2, 3, 4]),
    protocolID: 'edwinpai',
    keyID: 'test',
  };

  const response = await invoke<SignResponse>('crypto_sign', { request });

  expect(response.signature).toBeInstanceOf(Uint8Array);
  expect(response.publicKey).toMatch(/^[0-9a-f]{66}$/);
});
```

---

## Performance Considerations

1. **Async/await** — All commands are `async fn` to support future I/O operations
2. **Arc<T>** — Shared state uses `Arc` for thread-safe reference counting
3. **RwLock** — Config/cache use `RwLock` for concurrent reads, exclusive writes
4. **No cloning** — Pass references (`&AppState`) where possible
5. **Binary optimization** — `serde_bytes` for efficient `Vec<u8>` serialization

---

## References

- **IPC Types**: `src-tauri/src/crypto_domain/ipc_types.rs`
- **SPEC §3.3**: Crypto Domain IPC Messages
- **SPEC §6.3**: Tauri Commands Architecture
- **Tauri Commands**: https://tauri.app/v2/guide/inter-process-communication/
- **Serde**: https://serde.rs/

---

**Next Steps**:
1. Implement all 11 command handlers in `src-tauri/src/commands/crypto.rs`
2. Register commands in `main.rs`
3. Create AppState structure
4. Add integration tests
