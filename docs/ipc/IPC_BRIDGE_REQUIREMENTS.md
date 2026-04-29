# EdwinPAI Desktop - IPC Bridge Requirements

**Generated:** 2026-02-09
**Status:** Phase 1 Implementation Complete (Backend), Frontend Pending
**Purpose:** Document all Tauri invoke handlers, type mappings, error handling, and serialization requirements

---

## Table of Contents

1. [Overview](#overview)
2. [Current Implementation Status](#current-implementation-status)
3. [Tauri Invoke Handlers](#tauri-invoke-handlers)
4. [Type Mappings (TypeScript ↔ Rust)](#type-mappings-typescript--rust)
5. [Error Handling Strategy](#error-handling-strategy)
6. [Serialization Requirements](#serialization-requirements)
7. [Security Considerations](#security-considerations)
8. [Phase 2 Planned Extensions](#phase-2-planned-extensions)

---

## Overview

The IPC bridge connects the React frontend (TypeScript) to the Rust crypto_domain backend via Tauri's invoke API. All operations follow these principles:

- **Type Safety:** Every request/response is strongly typed on both sides
- **Audit Logging:** All crypto operations are logged to `audit.jsonl`
- **Error Consistency:** Rust `CryptoError` maps to TypeScript exceptions with structured error codes
- **Binary Serialization:** `Uint8Array` (TS) ↔ `Vec<u8>` (Rust) for signatures/payloads
- **BRC-42 Compliance:** Key derivation follows BRC-42 with 10 official test vectors validated

---

## Current Implementation Status

### ✅ Implemented (Phase 1)

**Backend (Rust):**
- `src-tauri/src/commands/crypto.rs` (165 LOC) — 5 Tauri commands
- `src-tauri/src/crypto_domain/` — 10 modules (2,100 LOC)
- `src-tauri/src/lib.rs` — Handler registration (lines 13-19)

**Handlers Registered:**
1. ✅ `get_identity` → `EdwinPAICryptoDomain::get_identity()`
2. ✅ `derive_key` → `EdwinPAICryptoDomain::derive_public_key()`
3. ✅ `sign_message` → `EdwinPAICryptoDomain::sign()`
4. ✅ `verify_message` → `EdwinPAICryptoDomain::verify()`
5. ✅ `generate_identicon` → `EdwinPAICryptoDomain::generate_identicon()`

### ⏸️ Planned (Phase 2)

6. ⏸️ `check_subscription` — UTXO/SPV proof validation
7. ⏸️ `encrypt_request` — BRC-2 ECIES encryption
8. ⏸️ `decrypt_request` — BRC-2 ECIES decryption
9. ⏸️ `get_audit_log` — Query audit.jsonl with filters

**Frontend (TypeScript):**
- ⏸️ `src/hooks/useCrypto.ts` — React hooks for invoke calls
- ⏸️ `src/stores/cryptoStore.ts` — Zustand store for crypto state
- ⏸️ Frontend tests (~300 LOC estimated)

---

## Tauri Invoke Handlers

### Handler Naming Convention
- Rust function: `snake_case` (e.g., `get_identity`)
- Frontend invocation: `invoke('get_identity', { ... })`
- TypeScript types: `PascalCase` Request/Response pairs

---

### 1. **get_identity**

**Purpose:** Retrieve master identity (public key, petname, identicon, shortId)

**Rust Signature:**
```rust
#[tauri::command]
pub async fn get_identity() -> Result<GetIdentityResponse, String>
```

**TypeScript Types:**
```typescript
// Request (none — no parameters)
export interface GetIdentityRequest {
  type: "GetIdentityRequest";
}

// Response
export interface GetIdentityResponse {
  type: "GetIdentityResponse";
  publicKey: string;      // Compressed, hex-encoded (66 chars)
  petname: string;        // BRC-103 petname (e.g., "happy-elephant-42")
  avatarSvg: string;      // SVG markup for identicon
  shortId: string;        // Format: "edw:XXXXX"
}
```

**Frontend Invocation:**
```typescript
const identity = await invoke<GetIdentityResponse>('get_identity');
```

**Crypto Domain Mapping:**
- Calls `EdwinPAICryptoDomain::get_identity()` (domain.rs:76)
- Generates master public key from OS keychain
- Derives petname via `IdentityGen::generate_petname()`
- Generates identicon via `IdentityGen::generate_identicon()`
- Logs to audit trail with operation: `AuditOperation::GetIdentity`

**Error Cases:**
- `ERR_KEYCHAIN_UNAVAILABLE` — OS keychain inaccessible
- `ERR_INVALID_KEY` — Corrupt master key in keychain

---

### 2. **derive_key**

**Purpose:** Derive BRC-42 public key for protocol/counterparty pair

**Rust Signature:**
```rust
#[tauri::command]
pub async fn derive_key(request: DeriveKeyRequest) -> Result<DeriveKeyResponse, String>
```

**TypeScript Types:**
```typescript
// Request
export interface DeriveKeyRequest {
  type: "DeriveKeyRequest";
  protocolID: string;     // e.g., "edwinpai", "edwinpai-auth"
  keyID: string;          // Context-specific key identifier
  counterparty: string;   // Compressed public key (hex, 66 chars)
  securityLevel?: number; // Default: 2 (BRC-42 security level)
}

// Response
export interface DeriveKeyResponse {
  type: "DeriveKeyResponse";
  publicKey: string;      // Derived compressed public key (hex)
}
```

**Frontend Invocation:**
```typescript
const { publicKey } = await invoke<DeriveKeyResponse>('derive_key', {
  protocolID: 'edwinpai',
  keyID: 'chat-session',
  counterparty: '02a1b2c3...',
  securityLevel: 2
});
```

**Crypto Domain Mapping:**
- Calls `EdwinPAICryptoDomain::derive_public_key(&Brc42Params)` (domain.rs:118)
- Constructs invoice number: `{securityLevel}-{protocolID}-{keyID}` (BRC-43)
- Uses `Brc42Deriver::derive_public_key()` with HMAC-SHA256
- Validates against 10 official BRC-42 test vectors (tests/brc42_test_vectors.rs)
- Logs to audit trail with operation: `AuditOperation::DeriveKey`

**Error Cases:**
- `ERR_INVALID_COUNTERPARTY` — Invalid public key format
- `ERR_DERIVATION_FAILED` — HMAC or EC point derivation failure
- `ERR_KEYCHAIN_UNAVAILABLE` — Cannot retrieve master key

**BRC-42 Test Vector Coverage:**
- Test Vector 1: Base case with security level 2
- Test Vector 2: Different protocol ID
- Test Vector 3-10: Edge cases (long IDs, special chars, etc.)

---

### 3. **sign_message**

**Purpose:** Sign arbitrary data with identity key or derived key

**Rust Signature:**
```rust
#[tauri::command]
pub async fn sign_message(request: SignMessageRequest) -> Result<SignMessageResponse, String>
```

**TypeScript Types:**
```typescript
// Request
export interface SignMessageRequest {
  type: "SignMessageRequest";
  data: Uint8Array;           // Raw data to sign
  protocolID?: string;        // For derived key signing
  keyID?: string;             // For derived key signing
  counterparty?: string;      // For derived key signing (optional)
  useIdentityKey?: boolean;   // If true, ignore protocol/key/counterparty
}

// Response
export interface SignMessageResponse {
  type: "SignMessageResponse";
  signature: Uint8Array;      // DER-encoded ECDSA signature
  publicKey: string;          // Public key used (hex)
}
```

**Frontend Invocation:**
```typescript
// Sign with identity key
const { signature, publicKey } = await invoke<SignMessageResponse>('sign_message', {
  data: new Uint8Array([0x01, 0x02, 0x03]),
  useIdentityKey: true
});

// Sign with derived key
const { signature, publicKey } = await invoke<SignMessageResponse>('sign_message', {
  data: new Uint8Array([0x01, 0x02, 0x03]),
  protocolID: 'edwinpai',
  keyID: 'chat-session',
  counterparty: '02a1b2c3...'
});
```

**Crypto Domain Mapping:**
- Calls `EdwinPAICryptoDomain::sign(&SignRequest)` (domain.rs:144)
- If `useIdentityKey=true`: uses master key from keychain
- Else: derives key via `derive_private_key()` with BRC-42
- Signing via `sign_data()` (signing.rs:41) — RFC 6979 deterministic ECDSA
- Returns DER-encoded signature + public key
- Logs to audit trail with operation: `AuditOperation::Sign`, includes SHA-256 payload hash

**Error Cases:**
- `ERR_SIGNING_FAILED` — secp256k1 signing error
- `ERR_KEYCHAIN_UNAVAILABLE` — Cannot retrieve key
- `ERR_DERIVATION_FAILED` — BRC-42 derivation failure (for derived key signing)

**Security Notes:**
- Uses RFC 6979 for deterministic signatures (no nonce reuse risk)
- Payload never stored in audit log (only SHA-256 hash)
- Private keys never leave crypto_domain module

---

### 4. **verify_message**

**Purpose:** Verify ECDSA signature against public key

**Rust Signature:**
```rust
#[tauri::command]
pub async fn verify_message(request: VerifyMessageRequest) -> Result<VerifyMessageResponse, String>
```

**TypeScript Types:**
```typescript
// Request
export interface VerifyMessageRequest {
  type: "VerifyRequest";
  data: Uint8Array;        // Original data
  signature: Uint8Array;   // DER-encoded ECDSA signature
  publicKey: string;       // Compressed public key (hex)
}

// Response
export interface VerifyMessageResponse {
  type: "VerifyResponse";
  valid: boolean;          // True if signature is valid
}
```

**Frontend Invocation:**
```typescript
const { valid } = await invoke<VerifyMessageResponse>('verify_message', {
  data: new Uint8Array([0x01, 0x02, 0x03]),
  signature: new Uint8Array([0x30, 0x45, ...]),
  publicKey: '02a1b2c3...'
});
```

**Crypto Domain Mapping:**
- Calls `EdwinPAICryptoDomain::verify(&VerifyRequest)` (domain.rs:180)
- Uses `verify_signature()` (signing.rs:91) — secp256k1 ECDSA verification
- Logs to audit trail with operation: `AuditOperation::Verify`, includes SHA-256 payload hash
- Returns `valid: true` only if signature + public key match data

**Error Cases:**
- `ERR_VERIFICATION_FAILED` — Invalid signature format
- `ERR_INVALID_KEY` — Malformed public key
- Returns `valid: false` for signature mismatch (NOT an error)

**Important:**
- Signature mismatch → `valid: false` (success case)
- Invalid inputs → throws `CryptoError` (error case)

---

### 5. **generate_identicon**

**Purpose:** Generate BRC-103 identicon SVG from any public key

**Rust Signature:**
```rust
#[tauri::command]
pub async fn generate_identicon(request: GenerateIdenticonRequest) -> Result<GenerateIdenticonResponse, String>
```

**TypeScript Types:**
```typescript
// Request
export interface GenerateIdenticonRequest {
  type: "GenerateIdenticonRequest";
  publicKey: string;       // Any compressed public key (hex)
  size?: number;           // Pixels (default: 64)
}

// Response
export interface GenerateIdenticonResponse {
  type: "GenerateIdenticonResponse";
  svg: string;             // SVG markup
}
```

**Frontend Invocation:**
```typescript
const { svg } = await invoke<GenerateIdenticonResponse>('generate_identicon', {
  publicKey: '02a1b2c3...',
  size: 128
});
```

**Crypto Domain Mapping:**
- Calls `EdwinPAICryptoDomain::generate_identicon()` (domain.rs:101)
- Uses `IdentityGen::generate_identicon()` (identity.rs:120)
- Generates deterministic 5×5 grid pattern from public key hash
- Returns SVG with color palette derived from public key
- Logs to audit trail with operation: `AuditOperation::GenerateIdenticon`

**Error Cases:**
- `ERR_INVALID_KEY` — Malformed public key hex string

---

### 6. **check_subscription** (⏸️ Phase 2)

**Purpose:** Validate subscription via UTXO/SPV proof

**Rust Signature:**
```rust
#[tauri::command]
pub async fn check_subscription(request: CheckSubscriptionRequest) -> Result<CheckSubscriptionResponse, String>
```

**TypeScript Types:**
```typescript
// Request
export interface CheckSubscriptionRequest {
  type: "CheckSubscriptionRequest";
  forceRefresh?: boolean;  // Bypass cache, fetch new proof
}

// Response
export interface CheckSubscriptionResponse {
  type: "CheckSubscriptionResponse";
  active: boolean;         // True if subscription valid
  expiresAt?: string;      // ISO 8601 timestamp
  cachedProof: boolean;    // True if using cached proof
}
```

**Crypto Domain Mapping:**
- Will call `EdwinPAICryptoDomain::check_subscription()` (not yet implemented)
- Validates UTXO ownership via SPV proof (BRC-9, BRC-10)
- Caches valid proofs for offline mode
- Logs to audit trail with operation: `AuditOperation::CheckSubscription`

**Error Cases:**
- `ERR_SUBSCRIPTION_EXPIRED` — Proof expired
- `ERR_NETWORK_UNAVAILABLE` — Cannot fetch new proof (offline)

---

### 7. **encrypt_request** (⏸️ Phase 2)

**Purpose:** Encrypt data using BRC-2 ECIES

**Rust Signature:**
```rust
#[tauri::command]
pub async fn encrypt_request(request: EncryptRequest) -> Result<EncryptResponse, String>
```

**TypeScript Types:**
```typescript
// Request
export interface EncryptRequest {
  type: "EncryptRequest";
  plaintext: Uint8Array;
  protocolID: string;
  keyID: string;
  counterparty: string;
}

// Response
export interface EncryptResponse {
  type: "EncryptResponse";
  ciphertext: Uint8Array;
}
```

**Crypto Domain Mapping:**
- Will call `EdwinPAICryptoDomain::encrypt()` (currently returns `EncryptionFailed`)
- Uses BRC-2 ECIES with AES-256-GCM
- Derives shared secret via BRC-42
- Logs to audit trail with operation: `AuditOperation::Encrypt`

**Error Cases:**
- `ERR_ENCRYPTION_FAILED` — Encryption operation failure

---

### 8. **decrypt_request** (⏸️ Phase 2)

**Purpose:** Decrypt BRC-2 ECIES ciphertext

**Rust Signature:**
```rust
#[tauri::command]
pub async fn decrypt_request(request: DecryptRequest) -> Result<DecryptResponse, String>
```

**TypeScript Types:**
```typescript
// Request
export interface DecryptRequest {
  type: "DecryptRequest";
  ciphertext: Uint8Array;
  protocolID: string;
  keyID: string;
  counterparty: string;
}

// Response
export interface DecryptResponse {
  type: "DecryptResponse";
  plaintext: Uint8Array;
}
```

**Crypto Domain Mapping:**
- Will call `EdwinPAICryptoDomain::decrypt()` (currently returns `DecryptionFailed`)
- Uses BRC-2 ECIES with AES-256-GCM
- Derives shared secret via BRC-42
- Logs to audit trail with operation: `AuditOperation::Decrypt`

**Error Cases:**
- `ERR_DECRYPTION_FAILED` — Decryption failure (invalid key or corrupt data)

---

### 9. **get_audit_log** (⏸️ Phase 2)

**Purpose:** Query audit.jsonl with filters

**TypeScript Types:**
```typescript
// Request
export interface GetAuditLogRequest {
  type: "GetAuditLogRequest";
  operation?: string;      // Filter by operation type
  startTime?: string;      // ISO 8601 start timestamp
  endTime?: string;        // ISO 8601 end timestamp
  limit?: number;          // Max entries to return
}

// Response
export interface GetAuditLogResponse {
  type: "GetAuditLogResponse";
  entries: AuditLogEntry[];
}

export interface AuditLogEntry {
  timestamp: string;       // ISO 8601
  operation: string;       // "sign", "verify", "derive_key", etc.
  protocolId?: string;
  keyId?: string;
  counterparty?: string;
  payloadHash?: string;    // SHA-256 hex
  success: boolean;
  error?: string;
}
```

**Crypto Domain Mapping:**
- Will call `EdwinPAICryptoDomain::read_audit_log()`
- Parses `audit.jsonl` from OS-specific data directory
- Filters by operation, time range, limit
- Returns entries in reverse chronological order

---

## Type Mappings (TypeScript ↔ Rust)

### Primitive Type Mappings

| TypeScript | Rust | Serialization | Notes |
|------------|------|---------------|-------|
| `string` | `String` | JSON string | UTF-8, no restrictions |
| `number` | `u32`, `u8`, `i32` | JSON number | Use `u8` for security levels |
| `boolean` | `bool` | JSON boolean | Direct mapping |
| `Uint8Array` | `Vec<u8>` | Base64 (Tauri default) | For signatures, payloads, keys |
| `undefined` | `Option::None` | Omitted in JSON | Optional fields |

### Complex Type Mappings

#### **BRC-42 Parameters**

**TypeScript:**
```typescript
export interface DeriveKeyRequest {
  protocolID: string;
  keyID: string;
  counterparty: string;
  securityLevel?: number;
}
```

**Rust:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeriveKeyRequest {
    pub protocol_id: String,
    pub key_id: String,
    pub counterparty: String,
    pub security_level: Option<u8>,
}
```

**Key Differences:**
- TypeScript: `camelCase` (per JavaScript conventions)
- Rust: `snake_case` (per Rust conventions)
- Serde handles automatic case conversion with `#[serde(rename_all = "camelCase")]` (NOT currently applied — requires explicit mapping in frontend)

#### **Binary Data**

**TypeScript:**
```typescript
export interface SignMessageRequest {
  data: Uint8Array;  // Binary payload
}
```

**Rust:**
```rust
pub struct SignMessageRequest {
    pub data: Vec<u8>,
}
```

**Serialization:**
- Tauri IPC automatically converts `Uint8Array` → Base64 JSON string → `Vec<u8>`
- No manual encoding needed in frontend code
- Example: `new Uint8Array([0x01, 0x02])` → `"AQI="` (Base64) → `vec![1, 2]`

---

## Error Handling Strategy

### Rust Error Type

**Definition (types.rs:319-364):**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoError {
    pub code: CryptoErrorCode,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CryptoErrorCode {
    KeychainUnavailable,
    KeyNotFound,
    InvalidKey,
    InvalidSignature,
    DerivationFailed,
    SigningFailed,
    VerificationFailed,
    EncryptionFailed,
    DecryptionFailed,
    InvalidCounterparty,
}
```

**String Representation:**
- `KeychainUnavailable` → `"ERR_KEYCHAIN_UNAVAILABLE"`
- `SigningFailed` → `"ERR_SIGNING_FAILED"`
- etc.

### Tauri Command Error Handling

**All commands return `Result<Response, String>`:**
```rust
#[tauri::command]
pub async fn sign_message(request: SignMessageRequest) -> Result<SignMessageResponse, String> {
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.to_string())?;
    // ...
    domain.sign(&sign_request).map_err(|e| e.to_string())
}
```

**Error Conversion:**
- `CryptoError` → `String` via `to_string()` impl
- Format: `"{code}: {message}"` (e.g., `"ERR_SIGNING_FAILED: Invalid private key"`)

### Frontend Error Handling

**TypeScript Pattern:**
```typescript
import { invoke } from '@tauri-apps/api/core';

try {
  const result = await invoke<SignMessageResponse>('sign_message', { ... });
  // Success
} catch (error: unknown) {
  // Tauri wraps errors in a string
  const errorStr = String(error);

  if (errorStr.includes('ERR_KEYCHAIN_UNAVAILABLE')) {
    // Handle keychain error
  } else if (errorStr.includes('ERR_SIGNING_FAILED')) {
    // Handle signing error
  }
}
```

**Recommended Frontend Wrapper:**
```typescript
// src/lib/crypto-errors.ts
export enum CryptoErrorCode {
  KEYCHAIN_UNAVAILABLE = 'ERR_KEYCHAIN_UNAVAILABLE',
  KEY_NOT_FOUND = 'ERR_KEY_NOT_FOUND',
  INVALID_KEY = 'ERR_INVALID_KEY',
  SIGNING_FAILED = 'ERR_SIGNING_FAILED',
  // ...
}

export class CryptoError extends Error {
  constructor(public code: CryptoErrorCode, message: string) {
    super(message);
    this.name = 'CryptoError';
  }

  static fromString(errorStr: string): CryptoError {
    const match = errorStr.match(/^(ERR_\w+): (.+)$/);
    if (match) {
      return new CryptoError(match[1] as CryptoErrorCode, match[2]);
    }
    return new CryptoError(CryptoErrorCode.UNKNOWN, errorStr);
  }
}
```

### Audit Log for Errors

**All crypto operations log errors:**
```rust
let entry = match &result {
    Ok(_) => create_audit_entry(AuditOperation::Sign, true, None),
    Err(e) => create_audit_entry(AuditOperation::Sign, false, Some(e.message.clone())),
};
self.audit_log.append(entry);
```

**Audit Entry Structure (audit.jsonl):**
```json
{
  "timestamp": "2026-02-09T12:34:56.789Z",
  "operation": "sign",
  "protocol_id": "edwinpai",
  "key_id": "chat-session",
  "payload_hash": "a1b2c3...",
  "success": false,
  "error": "Invalid private key"
}
```

---

## Serialization Requirements

### JSON Serialization (Tauri Default)

**Tauri IPC uses JSON for all data transfer:**
- Primitives: Direct JSON types
- Binary data: Base64 encoding (automatic)
- Complex types: Nested JSON objects

### Binary Data Handling

**TypeScript → Rust:**
```typescript
// Frontend
const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
const result = await invoke<SignMessageResponse>('sign_message', { data });
```

**Serialization Flow:**
1. `Uint8Array` → Base64 string (Tauri frontend)
2. JSON: `{ "data": "AQIDBA==" }`
3. Rust deserializes: `Vec<u8>` ← Base64 decode (Tauri backend)

**Rust → TypeScript:**
```rust
// Backend
let signature = vec![0x30, 0x45, 0x02, ...];
Ok(SignMessageResponse { signature, public_key })
```

**Serialization Flow:**
1. Rust serializes: `Vec<u8>` → Base64 string
2. JSON: `{ "signature": "MEUCIQCx...", "publicKey": "02a1b2..." }`
3. TypeScript deserializes: `Uint8Array` ← Base64 decode (Tauri frontend)

### Case Conversion

**⚠️ IMPORTANT: Current implementation uses Rust `snake_case`**

TypeScript types in `src/types/ipc.ts` use `camelCase`:
```typescript
export interface DeriveKeyRequest {
  protocolID: string;  // camelCase
  keyID: string;
  counterparty: string;
}
```

Rust types in `src-tauri/src/commands/crypto.rs` use `snake_case`:
```rust
pub struct DeriveKeyRequest {
    pub protocol_id: String,  // snake_case
    pub key_id: String,
    pub counterparty: String,
}
```

**Two Solutions:**

1. **Frontend adapts to Rust** (current approach):
```typescript
await invoke('derive_key', {
  protocol_id: 'edwinpai',  // Use snake_case in invoke
  key_id: 'chat-session',
  counterparty: '02a1b2...'
});
```

2. **Add Serde rename** (recommended for Phase 1 frontend):
```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // Add this
pub struct DeriveKeyRequest {
    pub protocol_id: String,  // Accepts "protocolID"
    pub key_id: String,       // Accepts "keyID"
    pub counterparty: String,
}
```

**Recommendation:** Add `#[serde(rename_all = "camelCase")]` to all command request/response types in Phase 1 frontend implementation.

---

## Security Considerations

### 1. **Private Key Storage**

- Master private key stored in OS keychain via `keyring` crate
- macOS: Keychain Access
- Windows: Credential Manager
- Linux: Secret Service API (libsecret)
- **Never transmitted via IPC** — all signing happens in Rust backend

### 2. **Audit Trail Immutability**

- Audit log stored as append-only JSON Lines (`.jsonl`)
- Tampering detection: Each entry includes timestamp + payload hash
- Location: `~/.local/share/com.edwinpai.desktop/audit.jsonl` (Linux)
- Rotation: TBD in Phase 2 (limit file size)

### 3. **Payload Privacy**

- Raw payloads **NEVER** stored in audit log
- Only SHA-256 hash recorded (32 bytes hex)
- Prevents audit log from leaking sensitive data

### 4. **Error Message Sanitization**

- Internal errors (e.g., keychain API failures) logged verbatim in audit.jsonl
- Frontend errors: Generic messages for security-sensitive operations
- Example: "Keychain unavailable" (not "Failed to unlock keychain: incorrect password")

### 5. **BRC-42 Compliance**

- 10 official test vectors validated (100% pass required)
- Deterministic derivation (same inputs → same output)
- No random number generation in key derivation (prevents implementation variance)

### 6. **RFC 6979 Deterministic ECDSA**

- Signatures are deterministic (same key + message → same signature)
- Prevents nonce reuse attacks
- secp256k1 crate implements RFC 6979 by default

---

## Phase 2 Planned Extensions

### 1. **Subscription Validation (check_subscription)**

- **Dependencies:** BRC-9 (UTXO proofs), BRC-10 (SPV)
- **New Rust modules:**
  - `src-tauri/src/crypto_domain/subscription.rs` (currently stub)
  - `src-tauri/src/crypto_domain/spv.rs` (new)
- **New crates:** `bitcoin` for UTXO parsing
- **Audit operation:** `AuditOperation::CheckSubscription`

### 2. **BRC-2 Encryption (encrypt/decrypt)**

- **Dependencies:** BRC-2 (ECIES), AES-256-GCM
- **New Rust modules:**
  - `src-tauri/src/crypto_domain/encryption.rs` (new)
- **New crates:** `aes-gcm`, `ecies` (or manual ECIES impl)
- **Audit operations:** `AuditOperation::Encrypt`, `AuditOperation::Decrypt`

### 3. **Audit Log Querying (get_audit_log)**

- **Implementation:** Parse `audit.jsonl` with filters
- **Filters:** operation, time range, protocol/key/counterparty
- **Performance:** Index file if >10,000 entries
- **Rust module:** Add `read_filtered()` to `FileAuditLogger` (audit.rs)

### 4. **Frontend State Management**

- **New hooks:**
  - `useCrypto()` — Invoke wrapper with error handling
  - `useIdentity()` — Cached identity retrieval
  - `useAuditLog()` — Real-time audit log viewer
- **New stores:**
  - `cryptoStore.ts` — Derived key cache (in-memory)
  - `subscriptionStore.ts` — Subscription status cache

### 5. **Testing Infrastructure**

- **Frontend tests:** Vitest + Tauri test harness
- **Mock IPC:** `@tauri-apps/api/mocks` for unit tests
- **Integration tests:** E2E tests with Tauri runtime
- **Target:** 80%+ code coverage for crypto hooks/stores

---

## Validation Checklist

### Backend (Rust) — ✅ Complete
- [x] 5 Tauri commands implemented
- [x] 10 crypto_domain modules complete
- [x] 44 Rust tests (33 unit + 11 integration)
- [x] 10/10 BRC-42 test vectors pass
- [x] Audit logging for all operations
- [x] Error handling with `CryptoError` type
- [x] Handlers registered in `lib.rs`

### Frontend (TypeScript) — ⏸️ Pending
- [ ] `src/hooks/useCrypto.ts` — Invoke wrappers
- [ ] `src/stores/cryptoStore.ts` — State management
- [ ] `src/lib/crypto-errors.ts` — Error handling utilities
- [ ] Frontend tests (Vitest)
- [ ] E2E tests (Tauri test harness)

### Documentation — ✅ Complete
- [x] IPC bridge requirements (this document)
- [x] Type contract manifest
- [x] Crypto domain implementation summary
- [x] Phase 1 completion report

---

## References

- **PLAN.md** — 7-phase development roadmap
- **TYPE_CONTRACT_MANIFEST.md** — Complete type catalog
- **CRYPTO_DOMAIN_IMPLEMENTATION_SUMMARY.md** — Backend implementation details
- **PHASE1_CRYPTO_IMPLEMENTATION.md** — BRC-42/signing report
- **BRC-42 Spec:** https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md
- **BRC-43 (Invoice Numbers):** https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0043.md
- **BRC-103 (Identicons):** Petname generation spec
- **Tauri IPC Docs:** https://v2.tauri.app/develop/calling-rust/

---

**Generated by:** Claude Sonnet 4.5
**Project:** EdwinPAI Desktop (edwinpai-ux/edwinpai-desktop)
**Last Updated:** 2026-02-09
