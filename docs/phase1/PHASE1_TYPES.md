# Phase 1 TypeScript Contracts Summary

This document summarizes the Phase 1 type definitions created for the EdwinPAI Desktop Crypto Domain & BSV Identity implementation.

## Created Files

### TypeScript Type Files

1. **`src/types/crypto.ts`** (NEW)
   - BRC-42 derivation parameter types
   - Signing request/response types
   - Verification types
   - Encryption/decryption types (BRC-2)
   - Public key info types
   - Crypto error codes

2. **`src/types/audit.ts`** (NEW)
   - Audit log entry schema (per §3.6)
   - Audit operation enum (9 operations)
   - Audit query/response types
   - Audit statistics types
   - Audit log file format

3. **`src/types/ipc.ts`** (EXTENDED)
   - Added `DeriveKeyRequest/Response` (BRC-42)
   - Added `SignMessageRequest/Response` (BRC-103)
   - Added `GetIdentityRequest/Response`
   - Added `GenerateIdenticonRequest/Response`
   - Updated `CryptoRequest` and `CryptoResponse` unions

4. **`src/types/identity.ts`** (EXTENDED)
   - Added `PetnameConfig` and `PetnameWordLists`
   - Added `IdenticonConfig` and `IdenticonResult`
   - Added `Brc42Context` (invoice number format)
   - Added `DerivedIdentity` (identity + derivation context)

5. **`src/types/index.ts`** (UPDATED)
   - Re-exported all new crypto types
   - Re-exported all new audit types
   - Re-exported extended identity types

### Rust Type Files

6. **`src-tauri/src/crypto_domain/types.rs`** (NEW)
   - `Brc42Params` struct with `invoice_number()` method
   - `Identity`, `Petname` structs (mirrors TypeScript)
   - `SignRequest/Response`, `VerifyRequest/Response`
   - `EncryptRequest/Response`, `DecryptRequest/Response`
   - `AuditLogEntry` struct (per §3.6)
   - `AuditOperation` enum with Display impl
   - `CryptoError` and `CryptoErrorCode` with Display impls
   - `CryptoResult<T>` type alias

7. **`src-tauri/src/crypto_domain/traits.rs`** (NEW)
   - `CryptoDomain` trait (main capability interface)
   - `KeychainAccess` trait (OS keychain abstraction)
   - `AuditLogger` trait (append-only audit log)
   - `IdentityGenerator` trait (petname + identicon)
   - `Brc42KeyDerivation` trait (BSV key derivation)

8. **`src-tauri/src/crypto_domain/mod.rs`** (UPDATED)
   - Added module declarations for `types` and `traits`
   - Re-exported commonly used types and traits

## Type System Overview

### 1. IPC Messages (TypeScript ↔ Rust)

#### New Messages (Phase 1)
- **DeriveKey**: BRC-42 key derivation from counterparty
  - Request: `protocolID`, `keyID`, `counterparty`, optional `securityLevel`
  - Response: derived `publicKey`

- **SignMessage**: BRC-103 message signing
  - Request: `data`, optional `protocolID`, `keyID`, `useIdentityKey`
  - Response: `signature`, `publicKey`

- **GetIdentity**: Retrieve master identity
  - Response: `publicKey`, `petname`, `avatarSvg`, `shortId`

- **GenerateIdenticon**: Create SVG identicon from public key
  - Request: `publicKey`, optional `size`
  - Response: `svg` markup

### 2. BRC-42 Derivation Types

**TypeScript (`crypto.ts`):**
```typescript
interface Brc42DerivationParams {
  protocolID: string;
  keyID: string;
  counterparty: string;
  securityLevel?: number; // default: 2
}
```

**Rust (`types.rs`):**
```rust
struct Brc42Params {
  security_level: u8,
  protocol_id: String,
  key_id: String,
  counterparty: String,
}
// Method: invoice_number() -> "<level>-<protocol>-<key>"
```

### 3. Identity Types

**Core Identity** (§4.2):
- `publicKey`: 33-byte compressed key (66 hex chars)
- `petname`: Deterministic adjective-noun (e.g., "Swift Falcon")
- `avatarSvg`: Deterministic identicon SVG
- `shortId`: `edw:<first 8 hex chars of SHA-256(publicKey)>`

**Extended Types** (Phase 1):
- `PetnameConfig`: Word lists + hash byte config
- `IdenticonConfig`: Size, colors, grid size, style
- `Brc42Context`: Derivation context (level, protocol, key, invoice)
- `DerivedIdentity`: Identity + derivation + counterparty

### 4. Audit Log Schema (§3.6)

**Entry Format:**
```
timestamp | operation | protocolID | keyID | counterparty | payload_hash | success | error
```

**Operations** (9 total):
1. `sign`
2. `verify`
3. `derive_key`
4. `get_public_key`
5. `encrypt`
6. `decrypt`
7. `check_subscription`
8. `get_identity`
9. `generate_identicon`

**Storage**: `~/.edwinpai/audit/crypto.log` (append-only)

### 5. Crypto Domain Trait Contracts

**`CryptoDomain` trait** (main interface):
- Identity: `get_identity()`, `generate_identicon()`, `derive_petname()`
- Key derivation: `derive_public_key()`, `derive_private_key()`
- Signing: `sign()`, `verify()`
- Encryption: `encrypt()`, `decrypt()`
- Audit: `log_operation()`, `read_audit_log()`

**`KeychainAccess` trait** (OS keychain):
- `store_key()`, `get_key()`, `delete_key()`, `key_exists()`

**`AuditLogger` trait** (append-only log):
- `append()`, `read()`, `count()`

**`IdentityGenerator` trait** (petname/identicon):
- `generate_petname()`, `generate_identicon()`, `generate_short_id()`

**`Brc42KeyDerivation` trait** (BSV key derivation):
- `derive_public_key()`, `derive_private_key()`, `compute_shared_secret()`

## Error Codes

**10 Crypto Error Codes:**
1. `ERR_KEYCHAIN_UNAVAILABLE`
2. `ERR_KEY_NOT_FOUND`
3. `ERR_INVALID_KEY`
4. `ERR_INVALID_SIGNATURE`
5. `ERR_DERIVATION_FAILED`
6. `ERR_SIGNING_FAILED`
7. `ERR_VERIFICATION_FAILED`
8. `ERR_ENCRYPTION_FAILED`
9. `ERR_DECRYPTION_FAILED`
10. `ERR_INVALID_COUNTERPARTY`

## Integration with Phase 0 Types

All Phase 1 types properly reference Phase 0 types:
- `api.ts`: Gateway REST API types (auth headers, chat, subscription, etc.)
- `subscription.ts`: 5-state subscription model
- `channels.ts`: Channel config schema
- `access.ts`: Permission levels (Owner/Member/Guest)

## Verification

✅ TypeScript compilation: `npx tsc --noEmit` — PASS
✅ All imports resolve correctly
✅ No circular dependencies
✅ Types exported via `src/types/index.ts`

## Next Steps (Phase 1 Implementation)

1. Implement Rust traits in `src-tauri/src/crypto_domain/`:
   - `signing.rs`: BRC-42 derivation + ECDSA signing
   - `audit.rs`: Append-only audit log writer
   - Add `keychain.rs`: OS keychain wrapper
   - Add `identity.rs`: Petname + identicon generation

2. Implement Tauri commands in `src-tauri/src/commands/crypto.rs`:
   - `derive_key`
   - `sign_message`
   - `get_identity`
   - `generate_identicon`

3. Create React hooks in `src/hooks/`:
   - `useIdentity.ts`
   - `useCrypto.ts`
   - `useAuditLog.ts`

4. Build UI components (§7.1):
   - `IdentitySetup.tsx`: Keypair generation flow
   - `IdentityBadge.tsx`: Display petname + avatar + shortId
   - `AuditLogViewer.tsx`: Read-only audit log UI

## Sources

- SPEC §3.3: Crypto Domain IPC API
- SPEC §3.6: Audit Logging
- SPEC §4.2: Human-Readable Identity
- SPEC §4.3: BRC-42 Key Derivation
- SPEC §4.4: BRC-103 Request Signing
- BRC-42: BSV Key Derivation Scheme
- BRC-43: Protocol and Key ID Scheme
- BRC-103: Peer-to-Peer Mutual Authentication
