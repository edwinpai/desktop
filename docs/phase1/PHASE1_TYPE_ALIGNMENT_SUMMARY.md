# Phase 1 Type Alignment Summary

**Quick Reference for Implementation**
**Generated**: 2026-02-09

---

## Critical Type Alignments

### 1. Rust → TypeScript Serialization

| Rust Type | TS Type | Serde Config | Notes |
|-----------|---------|--------------|-------|
| `String` | `string` | Default | ✅ |
| `Vec<u8>` | `Uint8Array` | Default | ✅ Tauri handles |
| `u8` | `number` | Default | 0-255 |
| `bool` | `boolean` | Default | ✅ |
| `Option<T>` | `T?` | `#[serde(skip_serializing_if = "Option::is_none")]` | Omit null |
| Struct | Interface | `#[serde(rename_all = "camelCase")]` | **REQUIRED** |

**Action Required**: Add `#[serde(rename_all = "camelCase")]` to ALL command response structs.

---

## 2. IPC Protocol Gaps

### Current Gaps Between Rust Commands & TS Types

| TS Type (ipc.ts) | Rust Command | Status | Action |
|------------------|--------------|--------|--------|
| `GetIdentityResponse` has `type` field | `GetIdentityResponse` lacks `type` | ❌ Mismatch | Add in TS wrapper |
| `DeriveKeyRequest` uses `protocolID` | Rust uses `protocol_id` | ✅ Fixed | Serde rename |
| `SignMessageRequest` | `SignMessageRequest` | ✅ Match | None |
| `GetAuditLogRequest` | Not implemented | ⏸️ Phase 1 | Implement command |

**Resolution Strategy**:
- Rust structs: use `snake_case` fields + `#[serde(rename_all = "camelCase")]`
- TS adds `type` discriminator manually in IPC wrapper functions

---

## 3. Critical Struct Contracts

### Identity (Rust ↔ TS)

**Rust** (`crypto_domain/types.rs:125`):
```rust
pub struct Identity {
    pub public_key: String,    // 66 hex chars
    pub petname: String,        // "Adjective Noun"
    pub avatar_svg: String,     // SVG markup
    pub short_id: String,       // "edw:xxxxxxxx"
}
```

**TypeScript** (`types/identity.ts:61`):
```typescript
export interface Identity {
  publicKey: string;    // 66 hex chars
  petname: string;      // "Adjective Noun"
  avatarSvg: string;    // SVG markup
  shortId: string;      // "edw:xxxxxxxx"
}
```

**Alignment**: ✅ Perfect (with camelCase serde)

---

### Brc42Params (Rust ↔ TS)

**Rust** (`crypto_domain/types.rs:67`):
```rust
pub struct Brc42Params {
    pub security_level: u8,
    pub protocol_id: String,
    pub key_id: String,
    pub counterparty: String,
}
```

**TypeScript** (inferred from `ipc.ts:89`):
```typescript
interface DeriveKeyRequest {
  type: "DeriveKeyRequest";
  protocolID: string;
  keyID: string;
  counterparty: string;
  securityLevel?: number;
}
```

**Alignment**: ✅ Compatible (Rust command handles conversion)

---

### AuditLogEntry (Rust ↔ TS)

**Rust** (`crypto_domain/types.rs:262`):
```rust
pub struct AuditLogEntry {
    pub timestamp: String,
    pub operation: AuditOperation,  // enum → snake_case string
    pub protocol_id: Option<String>,
    pub key_id: Option<String>,
    pub counterparty: Option<String>,
    pub payload_hash: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}
```

**TypeScript** (`types/ipc.ts:166`):
```typescript
export interface AuditLogEntry {
  timestamp: string;
  operation: string;         // snake_case
  protocolId?: string;       // camelCase
  keyId?: string;            // camelCase
  counterparty?: string;
  payloadHash?: string;      // camelCase
  success: boolean;
  error?: string;
}
```

**Alignment**: ⚠️ Requires `#[serde(rename_all = "camelCase")]` on Rust struct

---

## 4. Trait Implementation Requirements

### EdwinPAICryptoDomain Must Implement

**Trait**: `CryptoDomain` (`crypto_domain/traits.rs:15`)

**Required Methods** (11 total):

1. ✅ `get_identity() -> Identity`
2. ✅ `generate_identicon(public_key, size) -> String`
3. ✅ `derive_petname(public_key) -> Petname`
4. ✅ `derive_public_key(params) -> String`
5. ⏸️ `derive_private_key(params) -> String` (internal only)
6. ✅ `sign(request) -> SignResponse`
7. ✅ `verify(request) -> VerifyResponse`
8. ⏸️ `encrypt(request) -> EncryptResponse` (Phase 2)
9. ⏸️ `decrypt(request) -> DecryptResponse` (Phase 2)
10. ✅ `log_operation(entry) -> ()`
11. ✅ `read_audit_log(limit) -> Vec<AuditLogEntry>`

**Status**: 7/11 implemented, 4 deferred to Phase 2

---

### Keychain Implementation Requirements

**Platform**: macOS, Windows, Linux

**Crate**: `keyring = "3.5"`

**Service Names**:
- `"edwinpai.identity.privateKey"` → 64 hex chars (32 bytes)
- `"edwinpai.identity.publicKey"` → 66 hex chars (33 bytes, compressed)

**Account**: OS username (`std::env::var("USER")`)

**Methods**:
```rust
impl KeychainAccess for EdwinPAIKeychain {
    fn store_key(&self, service: &str, account: &str, key: &str) -> CryptoResult<()>;
    fn get_key(&self, service: &str, account: &str) -> CryptoResult<String>;
    fn delete_key(&self, service: &str, account: &str) -> CryptoResult<()>;
    fn key_exists(&self, service: &str, account: &str) -> bool;
}
```

---

## 5. Module Export Index

### Rust Exports (`crypto_domain/mod.rs`)

**Public API**:
```rust
pub use types::{
    // Identity
    Identity, Petname,

    // BRC-42
    Brc42Params, Brc42DerivationParams,

    // Signing
    SignRequest, SignResponse, VerifyRequest, VerifyResponse,

    // Encryption (Phase 2)
    EncryptRequest, EncryptResponse, DecryptRequest, DecryptResponse,

    // Audit
    AuditLogEntry, AuditOperation, AuditEvent,

    // Errors
    CryptoError, CryptoErrorCode, CryptoResult,

    // Config
    Brc103IdenticonParams,
};

pub use traits::{
    CryptoDomain, KeychainAccess, Brc42KeyDerivation,
    IdentityGenerator, AuditLogger,
};

pub use domain::EdwinPAICryptoDomain;
```

**Status**: ✅ Complete in `mod.rs:12-24`

---

### TypeScript Exports (Planned)

**Create**: `src/lib/index.ts`
```typescript
// Crypto operations
export { getIdentity, deriveKey, signMessage, verifyMessage } from './crypto';

// Identity utilities
export { generatePetname, generateIdenticon, generateShortId } from './identity';

// Types
export type {
  Identity, Petname, IdenticonConfig,
  DeriveKeyRequest, SignMessageRequest,
  AuditLogEntry,
} from '@/types';
```

**Status**: ⏸️ Not yet created (Phase 1 task)

---

## 6. Test Coverage Requirements

### BRC-42 Test Vectors (Critical)

**Location**: `src/test/crypto/brc42.test.ts` + Rust unit tests

**Requirement**: 10/10 official BRC-42 test vectors MUST pass

**Source**: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md#test-vectors

**Test Structure** (TypeScript):
```typescript
describe('BRC-42 Key Derivation', () => {
  test('Test Vector 1', async () => {
    const result = await invoke('derive_key', {
      request: {
        protocol_id: 'test',
        key_id: 'vector1',
        counterparty: '02...', // from spec
        security_level: 2,
      }
    });
    expect(result.public_key).toBe('02...'); // expected from spec
  });
  // ... 9 more vectors
});
```

**Test Structure** (Rust):
```rust
#[test]
fn brc42_test_vector_1() {
    let domain = EdwinPAICryptoDomain::new().unwrap();
    let params = Brc42Params { /* ... */ };
    let result = domain.derive_public_key(&params).unwrap();
    assert_eq!(result, "02..."); // expected
}
```

---

### Petname Determinism Tests

**Requirement**: Same public key → same petname (always)

```typescript
test('Petname is deterministic', async () => {
  const pubkey = '02abc...';
  const petname1 = await generatePetname(pubkey);
  const petname2 = await generatePetname(pubkey);
  expect(petname1.display).toBe(petname2.display);
});
```

---

### Identicon Determinism Tests

**Requirement**: Same public key → same SVG (always)

```typescript
test('Identicon is deterministic', async () => {
  const pubkey = '02abc...';
  const icon1 = await generateIdenticon(pubkey, { size: 64 });
  const icon2 = await generateIdenticon(pubkey, { size: 64 });
  expect(icon1.svg).toBe(icon2.svg);
});
```

---

## 7. Action Items for Implementation

### Phase 1 Type Contract Tasks

- [ ] **Add Serde rename to all command response structs**
  - Files: `commands/crypto.rs`, `crypto_domain/types.rs`
  - Annotation: `#[serde(rename_all = "camelCase")]`

- [ ] **Implement GetAuditLog Tauri command**
  - File: `commands/crypto.rs`
  - Match signature: `GetAuditLogRequest` → `GetAuditLogResponse`

- [ ] **Create TypeScript barrel export**
  - File: `src/lib/index.ts`
  - Export: crypto functions, identity utilities, types

- [ ] **Implement BRC-42 test vectors**
  - File: `src/test/crypto/brc42.test.ts` (TypeScript)
  - File: `src-tauri/src/crypto_domain/brc42.rs` (Rust unit tests)
  - Target: 10/10 pass rate

- [ ] **Verify petname word lists**
  - File: `src/lib/petname-wordlists.ts`
  - Requirement: 256 adjectives + 256 nouns (exactly)

- [ ] **Implement identicon generator**
  - File: `src/lib/identicon-generator.ts`
  - Algorithm: Blockies-style 5x5 grid from SHA-256

- [ ] **Add Drop impl for Keypair**
  - File: `src-tauri/src/crypto_domain/types.rs`
  - Action: Zero private_key bytes on drop (use `zeroize` crate)

---

## 8. Quick Reference Tables

### IPC Commands (Frontend → Backend)

| Command | Input Type | Output Type | Status |
|---------|-----------|-------------|--------|
| `get_identity` | None | `GetIdentityResponse` | ✅ Implemented |
| `derive_key` | `DeriveKeyRequest` | `DeriveKeyResponse` | ✅ Implemented |
| `sign_message` | `SignMessageRequest` | `SignMessageResponse` | ✅ Implemented |
| `verify_message` | `VerifyMessageRequest` | `VerifyMessageResponse` | ✅ Implemented |
| `generate_identicon` | `GenerateIdenticonRequest` | `GenerateIdenticonResponse` | ✅ Implemented |
| `get_audit_log` | `GetAuditLogRequest` | `GetAuditLogResponse` | ⏸️ TODO |

---

### Key Validation Rules

| Field | Format | Validation |
|-------|--------|------------|
| `publicKey` | Hex string | 66 chars, starts with 02/03 |
| `privateKey` | Hex string | 64 chars (32 bytes) |
| `signature` | Binary (DER) | 70-72 bytes typical |
| `counterparty` | Hex string | 66 chars, starts with 02/03 |
| `petname` | String | `"{Adj} {Noun}"` format |
| `shortId` | String | `"edw:{8 hex}"` format |
| `avatarSvg` | String | Starts with `<svg` |

---

### Error Codes (Rust → TypeScript)

| Rust Enum | String Representation | HTTP Context |
|-----------|----------------------|--------------|
| `KeychainUnavailable` | `ERR_KEYCHAIN_UNAVAILABLE` | 503 Service Unavailable |
| `KeyNotFound` | `ERR_KEY_NOT_FOUND` | 404 Not Found |
| `InvalidKey` | `ERR_INVALID_KEY` | 400 Bad Request |
| `InvalidSignature` | `ERR_INVALID_SIGNATURE` | 401 Unauthorized |
| `DerivationFailed` | `ERR_DERIVATION_FAILED` | 500 Internal Error |
| `SigningFailed` | `ERR_SIGNING_FAILED` | 500 Internal Error |
| `VerificationFailed` | `ERR_VERIFICATION_FAILED` | 401 Unauthorized |

---

**End of Type Alignment Summary**

**See Also**:
- `PHASE1_TYPE_CONTRACTS.md` — Full type documentation
- `PHASE1_DELIVERABLES.md` — Implementation scope
- `src/types/ipc.ts` — TypeScript IPC types
- `src-tauri/src/crypto_domain/types.rs` — Rust core types
