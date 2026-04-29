# Phase 1 Type Contracts Documentation

**Generated**: 2026-02-09
**Status**: Reference document for Phase 1 implementation
**Purpose**: Catalog all type contracts across Rust/TypeScript boundary and internal modules

---

## Table of Contents

1. [Rust Core Types](#1-rust-core-types)
2. [Rust Trait Boundaries](#2-rust-trait-boundaries)
3. [Tauri Command Types](#3-tauri-command-types)
4. [TypeScript IPC Protocol Types](#4-typescript-ipc-protocol-types)
5. [TypeScript Identity Types](#5-typescript-identity-types)
6. [TypeScript Configuration Types](#6-typescript-configuration-types)
7. [Module Export Requirements](#7-module-export-requirements)
8. [Type Alignment Verification](#8-type-alignment-verification)
9. [Critical Type Constraints](#9-critical-type-constraints)

---

## 1. Rust Core Types

### Location: `src-tauri/src/crypto_domain/types.rs`

#### 1.1 Keypair Struct

```rust
pub struct Keypair {
    /// Private key (32 bytes) — NEVER serialized
    pub private_key: [u8; 32],
    /// Compressed public key (33 bytes)
    pub public_key: [u8; 33],
}

impl Keypair {
    pub fn public_key_hex(&self) -> String;
}
```

**Constraints**:
- Private key: exactly 32 bytes (secp256k1 scalar)
- Public key: exactly 33 bytes (compressed format: 0x02/0x03 prefix + 32-byte x-coordinate)
- Private key MUST be zeroed on drop (memory safety)
- Never expose private key via IPC

---

#### 1.2 BRC-42 Derivation Parameters

```rust
pub struct Brc42Params {
    /// Security level (default: 2)
    pub security_level: u8,
    /// Protocol ID (e.g., "edwinpai", "edwinpai-auth")
    pub protocol_id: String,
    /// Key ID (context-specific)
    pub key_id: String,
    /// Counterparty public key (compressed, 33 bytes, hex-encoded)
    pub counterparty: String,
}

impl Brc42Params {
    /// Construct invoice number per BRC-43
    pub fn invoice_number(&self) -> String {
        format!("{}-{}-{}", self.security_level, self.protocol_id, self.key_id)
    }
}
```

**Type Alias**: `Brc42DerivationParams` (same structure)

**Constraints**:
- `security_level`: 0-255 (u8), default 2 for EdwinPAI
- `protocol_id`: non-empty string, lowercase-hyphenated (e.g., "edwinpai-subscription")
- `key_id`: application-specific, non-empty
- `counterparty`: 66 hex chars (33-byte compressed public key)
- Invoice number format: `"{level}-{protocol}-{keyid}"` (BRC-43 §2.1)

---

#### 1.3 Identity Struct

```rust
pub struct Identity {
    /// Compressed public key (33 bytes, 66 hex chars)
    pub public_key: String,
    /// Deterministic petname (e.g., "Swift Falcon")
    pub petname: String,
    /// SVG identicon
    pub avatar_svg: String,
    /// Short ID (e.g., "edw:a3f7b2c1")
    pub short_id: String,
}
```

**Constraints**:
- `public_key`: exactly 66 hex chars, starts with "02" or "03"
- `petname`: format `"{Adjective} {Noun}"`, title case
- `avatar_svg`: valid SVG markup starting with `<svg`
- `short_id`: format `"edw:{8 hex chars}"`, derived from SHA-256(public_key)

---

#### 1.4 Petname Struct

```rust
pub struct Petname {
    pub adjective: String,
    pub noun: String,
    pub display: String,
}
```

**Constraints**:
- `adjective`: single word from 256-word adjective list
- `noun`: single word from 256-word noun list
- `display`: always `"{adjective} {noun}"` (space-separated, title case)

---

#### 1.5 Signing Types

```rust
pub struct SignRequest {
    /// Raw data to sign
    pub data: Vec<u8>,
    /// Optional BRC-42 derivation parameters (None = use identity key)
    pub derivation: Option<Brc42Params>,
}

pub struct SignResponse {
    /// DER-encoded ECDSA signature
    pub signature: Vec<u8>,
    /// Public key used (compressed, hex-encoded)
    pub public_key: String,
}

pub struct VerifyRequest {
    /// Original data
    pub data: Vec<u8>,
    /// DER-encoded ECDSA signature
    pub signature: Vec<u8>,
    /// Public key to verify against (compressed, hex-encoded)
    pub public_key: String,
}

pub struct VerifyResponse {
    /// Whether signature is valid
    pub valid: bool,
}
```

**Constraints**:
- `data`: arbitrary length (typically <10MB for performance)
- `signature`: DER-encoded, typically 70-72 bytes (Bitcoin standard)
- Signature encoding: DER (NOT raw R||S concatenation)

---

#### 1.6 Encryption Types (BRC-2)

```rust
pub struct EncryptRequest {
    pub plaintext: Vec<u8>,
    pub derivation: Brc42Params,
}

pub struct EncryptResponse {
    pub ciphertext: Vec<u8>,
    pub iv: Vec<u8>,
    pub auth_tag: Option<Vec<u8>>,
}

pub struct DecryptRequest {
    pub ciphertext: Vec<u8>,
    pub iv: Vec<u8>,
    pub auth_tag: Option<Vec<u8>>,
    pub derivation: Brc42Params,
}

pub struct DecryptResponse {
    pub plaintext: Vec<u8>,
}
```

**Constraints**:
- `iv`: 16 bytes for AES-256-GCM (BRC-2 §3.2)
- `auth_tag`: 16 bytes for GCM mode (optional for legacy modes)
- Encryption algorithm: AES-256-GCM (BRC-2 default)

---

#### 1.7 Audit Log Types

```rust
pub struct AuditLogEntry {
    /// ISO 8601 timestamp
    pub timestamp: String,
    /// Operation type
    pub operation: AuditOperation,
    /// Protocol ID (if applicable)
    pub protocol_id: Option<String>,
    /// Key ID (if applicable)
    pub key_id: Option<String>,
    /// Counterparty (if applicable)
    pub counterparty: Option<String>,
    /// SHA-256 hash of payload
    pub payload_hash: Option<String>,
    /// Whether operation succeeded
    pub success: bool,
    /// Error message if success=false
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditOperation {
    Sign,
    Verify,
    DeriveKey,
    GetPublicKey,
    Encrypt,
    Decrypt,
    CheckSubscription,
    GetIdentity,
    GenerateIdenticon,
}
```

**Constraints**:
- `timestamp`: RFC 3339 format (e.g., "2026-02-09T19:35:42.123Z")
- `operation`: snake_case serialization for JSON storage
- `payload_hash`: 64 hex chars (SHA-256 digest)
- Log file location: `~/.edwinpai/audit/crypto.log` (append-only)

---

#### 1.8 Error Types

```rust
pub struct CryptoError {
    pub code: CryptoErrorCode,
    pub message: String,
}

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

pub type CryptoResult<T> = Result<T, CryptoError>;
```

**String Representation** (for TypeScript error handling):
- `ERR_KEYCHAIN_UNAVAILABLE`
- `ERR_KEY_NOT_FOUND`
- `ERR_INVALID_KEY`
- `ERR_INVALID_SIGNATURE`
- `ERR_DERIVATION_FAILED`
- `ERR_SIGNING_FAILED`
- `ERR_VERIFICATION_FAILED`
- `ERR_ENCRYPTION_FAILED`
- `ERR_DECRYPTION_FAILED`
- `ERR_INVALID_COUNTERPARTY`

---

#### 1.9 Identicon Parameters

```rust
pub struct Brc103IdenticonParams {
    /// Public key to generate identicon from (compressed, hex-encoded)
    pub public_key: String,
    /// Size in pixels (default: 64)
    #[serde(default = "default_identicon_size")]
    pub size: u32,
    /// Grid size (default: 5x5)
    #[serde(default = "default_identicon_grid")]
    pub grid_size: u32,
    /// Color palette (default: deterministic from pubkey)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub colors: Option<Vec<String>>,
}
```

**Constraints**:
- `size`: 16-512 pixels (recommended: 64, 128, 256)
- `grid_size`: 3-10 (5x5 recommended for blockies-style)
- `colors`: hex color strings (e.g., `["#FF5733", "#33FF57"]`)

---

## 2. Rust Trait Boundaries

### Location: `src-tauri/src/crypto_domain/traits.rs`

#### 2.1 CryptoDomain Trait

```rust
pub trait CryptoDomain: Send + Sync {
    // Identity Operations
    fn get_identity(&self) -> CryptoResult<Identity>;
    fn generate_identicon(&self, public_key: &str, size: u32) -> CryptoResult<String>;
    fn derive_petname(&self, public_key: &str) -> CryptoResult<Petname>;

    // Key Derivation (BRC-42)
    fn derive_public_key(&self, params: &Brc42Params) -> CryptoResult<String>;
    fn derive_private_key(&self, params: &Brc42Params) -> CryptoResult<String>;

    // Signing & Verification
    fn sign(&self, request: &SignRequest) -> CryptoResult<SignResponse>;
    fn verify(&self, request: &VerifyRequest) -> CryptoResult<VerifyResponse>;

    // Encryption & Decryption (BRC-2)
    fn encrypt(&self, request: &EncryptRequest) -> CryptoResult<EncryptResponse>;
    fn decrypt(&self, request: &DecryptRequest) -> CryptoResult<DecryptResponse>;

    // Audit Logging
    fn log_operation(&self, entry: AuditLogEntry) -> CryptoResult<()>;
    fn read_audit_log(&self, limit: Option<usize>) -> CryptoResult<Vec<AuditLogEntry>>;
}
```

**Constraints**:
- `Send + Sync`: required for Tauri async runtime
- All methods return `CryptoResult<T>` (error propagation)
- Audit logging MUST be called for all operations (transparency requirement)

---

#### 2.2 KeychainAccess Trait

```rust
pub trait KeychainAccess: Send + Sync {
    fn store_key(&self, service: &str, account: &str, key: &str) -> CryptoResult<()>;
    fn get_key(&self, service: &str, account: &str) -> CryptoResult<String>;
    fn delete_key(&self, service: &str, account: &str) -> CryptoResult<()>;
    fn key_exists(&self, service: &str, account: &str) -> bool;
}
```

**Keychain Naming Convention**:
- Service: `"edwinpai.identity.privateKey"`, `"edwinpai.identity.publicKey"`
- Account: current OS username (`whoami`)

**Platform Implementations**:
- macOS: Keychain Services (`security-framework` crate or `keyring`)
- Windows: Windows Credential Manager (`wincred` / `keyring`)
- Linux: Secret Service D-Bus API (`libsecret` / `keyring`)

---

#### 2.3 Brc42KeyDerivation Trait

```rust
pub trait Brc42KeyDerivation: Send + Sync {
    fn derive_public_key(
        &self,
        master_private_key: &str,
        counterparty_public_key: &str,
        invoice_number: &str,
    ) -> CryptoResult<String>;

    fn derive_private_key(
        &self,
        master_private_key: &str,
        counterparty_public_key: &str,
        invoice_number: &str,
    ) -> CryptoResult<String>;

    fn compute_shared_secret(
        &self,
        private_key: &str,
        public_key: &str,
    ) -> CryptoResult<Vec<u8>>;
}
```

**BRC-42 Algorithm** (reference: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md):
1. **ECDH**: `sharedSecret = privKey * counterpartyPubKey` (elliptic curve multiplication)
2. **HMAC**: `hmacDigest = HMAC-SHA256(sharedSecret, invoiceNumber)`
3. **Scalar derivation**: `derivedScalar = (hmacDigest + masterPrivKey) mod N`
4. **Public key derivation**: `derivedPubKey = hmacPoint + masterPubKey` (point addition)

**Test Vectors**: BRC-42 §Test Vectors (10 official cases, 100% pass required)

---

#### 2.4 IdentityGenerator Trait

```rust
pub trait IdentityGenerator: Send + Sync {
    fn generate_petname(&self, public_key: &str) -> CryptoResult<Petname>;
    fn generate_identicon(&self, public_key: &str, size: u32) -> CryptoResult<String>;
    fn generate_short_id(&self, public_key: &str) -> CryptoResult<String>;
}
```

**Algorithms**:
- **Petname**: SHA-256(publicKey), use byte[0] for adjective index, byte[1] for noun index
- **Identicon**: Blockies-style deterministic 5x5 grid from SHA-256 hash
- **Short ID**: `"edw:" + hex(SHA-256(publicKey)[0..4])`

---

#### 2.5 AuditLogger Trait

```rust
pub trait AuditLogger: Send + Sync {
    fn append(&self, entry: AuditLogEntry) -> CryptoResult<()>;
    fn read(&self, limit: Option<usize>) -> CryptoResult<Vec<AuditLogEntry>>;
    fn count(&self) -> CryptoResult<usize>;
}
```

**File Format**: JSON Lines (JSONL), one entry per line
**Rotation**: TBD (Phase 6 — recommend 10MB max per file)

---

## 3. Tauri Command Types

### Location: `src-tauri/src/commands/crypto.rs`

#### 3.1 Get Identity Command

```rust
#[tauri::command]
pub async fn get_identity() -> Result<GetIdentityResponse, String>

pub struct GetIdentityResponse {
    pub public_key: String,
    pub petname: String,
    pub avatar_svg: String,
    pub short_id: String,
}
```

**TypeScript Invocation**:
```typescript
import { invoke } from '@tauri-apps/api/core';
const identity = await invoke<GetIdentityResponse>('get_identity');
```

---

#### 3.2 Derive Key Command

```rust
#[tauri::command]
pub async fn derive_key(request: DeriveKeyRequest) -> Result<DeriveKeyResponse, String>

pub struct DeriveKeyRequest {
    pub protocol_id: String,
    pub key_id: String,
    pub counterparty: String,
    pub security_level: Option<u8>,
}

pub struct DeriveKeyResponse {
    pub public_key: String,
}
```

**TypeScript Invocation**:
```typescript
const result = await invoke<DeriveKeyResponse>('derive_key', {
  request: {
    protocol_id: 'edwinpai-subscription',
    key_id: 'payment-2026-02',
    counterparty: '02abc...',
    security_level: 2,
  }
});
```

---

#### 3.3 Sign Message Command

```rust
#[tauri::command]
pub async fn sign_message(request: SignMessageRequest) -> Result<SignMessageResponse, String>

pub struct SignMessageRequest {
    pub data: Vec<u8>,
    pub protocol_id: Option<String>,
    pub key_id: Option<String>,
    pub counterparty: Option<String>,
    pub use_identity_key: Option<bool>,
}

pub struct SignMessageResponse {
    pub signature: Vec<u8>,
    pub public_key: String,
}
```

**Behavior**:
- If `use_identity_key = true`: sign with master identity key
- If `protocol_id`/`key_id`/`counterparty` provided: derive key via BRC-42, then sign
- Otherwise: default to identity key

---

#### 3.4 Verify Message Command

```rust
#[tauri::command]
pub async fn verify_message(request: VerifyMessageRequest) -> Result<VerifyMessageResponse, String>

pub struct VerifyMessageRequest {
    pub data: Vec<u8>,
    pub signature: Vec<u8>,
    pub public_key: String,
}

pub struct VerifyMessageResponse {
    pub valid: bool,
}
```

---

#### 3.5 Generate Identicon Command

```rust
#[tauri::command]
pub async fn generate_identicon(request: GenerateIdenticonRequest) -> Result<GenerateIdenticonResponse, String>

pub struct GenerateIdenticonRequest {
    pub public_key: String,
    pub size: Option<u32>,
}

pub struct GenerateIdenticonResponse {
    pub svg: String,
}
```

---

## 4. TypeScript IPC Protocol Types

### Location: `src/types/ipc.ts`

#### 4.1 IPC Message Structure

All IPC messages follow discriminated union pattern with `type` field:

```typescript
export interface DeriveKeyRequest {
  type: "DeriveKeyRequest";
  protocolID: string;
  keyID: string;
  counterparty: string;
  securityLevel?: number;
}

export interface DeriveKeyResponse {
  type: "DeriveKeyResponse";
  publicKey: string;
}
```

**Constraints**:
- `type` field: PascalCase, ends with "Request" or "Response"
- Arrays use `Uint8Array` for binary data (not `number[]` or `Buffer`)
- Optional fields use `?:` syntax

---

#### 4.2 Union Types

```typescript
export type CryptoRequest =
  | SignRequest
  | VerifyRequest
  | GetPublicKeyRequest
  | CheckSubscriptionRequest
  | EncryptRequest
  | DecryptRequest
  | DeriveKeyRequest
  | SignMessageRequest
  | GetIdentityRequest
  | GenerateIdenticonRequest
  | GetAuditLogRequest;

export type CryptoResponse =
  | SignResponse
  | VerifyResponse
  | GetPublicKeyResponse
  | CheckSubscriptionResponse
  | EncryptResponse
  | DecryptResponse
  | DeriveKeyResponse
  | SignMessageResponse
  | GetIdentityResponse
  | GenerateIdenticonResponse
  | GetAuditLogResponse;

export type CryptoMessage =
  | CryptoRequest
  | CryptoResponse
  | AuthorizeSpendRequest
  | AuthorizeSpendResponse;
```

---

#### 4.3 Audit Log IPC Types

```typescript
export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  protocolId?: string;
  keyId?: string;
  counterparty?: string;
  payloadHash?: string;
  success: boolean;
  error?: string;
}

export interface GetAuditLogRequest {
  type: "GetAuditLogRequest";
  operation?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}

export interface GetAuditLogResponse {
  type: "GetAuditLogResponse";
  entries: AuditLogEntry[];
}
```

**Constraints**:
- `timestamp`: ISO 8601 string (RFC 3339)
- `operation`: snake_case (matches Rust `AuditOperation` serialization)

---

## 5. TypeScript Identity Types

### Location: `src/types/identity.ts`

#### 5.1 Petname Types

```typescript
export interface Petname {
  adjective: string;
  noun: string;
  display: string;
}

export interface PetnameWordLists {
  adjectives: string[];
  nouns: string[];
}

export interface PetnameConfig {
  wordLists: PetnameWordLists;
  hashBytes?: number;
}
```

**Constraints**:
- `adjectives`: exactly 256 words (indexed by byte value 0-255)
- `nouns`: exactly 256 words (indexed by byte value 0-255)
- `hashBytes`: default 4 (first 4 bytes of SHA-256 for indexing)

---

#### 5.2 Identicon Types

```typescript
export interface IdenticonConfig {
  size?: number;
  backgroundColor?: string;
  foregroundColors?: string[];
  gridSize?: number;
  style?: "blocks" | "circles" | "triangles";
}

export interface IdenticonResult {
  svg: string;
  dataUri: string;
  publicKey: string;
}
```

**Defaults**:
- `size`: 64px
- `backgroundColor`: transparent
- `foregroundColors`: auto-generated from public key hash
- `gridSize`: 5 (blockies-style 5x5)
- `style`: "blocks"

---

#### 5.3 Identity Types

```typescript
export interface Identity {
  publicKey: string;
  petname: string;
  avatarSvg: string;
  shortId: string;
}

export interface IdentityDisplay {
  petname: string;
  avatarSvg: string;
  shortId: string;
}
```

---

#### 5.4 BRC-42 Context

```typescript
export interface Brc42Context {
  securityLevel: number;
  protocolID: string;
  keyID: string;
  invoiceNumber: string;
}

export interface DerivedIdentity extends Identity {
  derivation: Brc42Context;
  counterparty: string;
}
```

---

## 6. TypeScript Configuration Types

### Location: `src/lib/petname-wordlists.ts`

#### 6.1 WordList Export

```typescript
export const WORDLISTS: PetnameWordLists = {
  adjectives: [
    // 256 adjectives (0-255)
    "Swift", "Clever", "Brave", ..., "Wise"
  ],
  nouns: [
    // 256 nouns (0-255)
    "Falcon", "Tiger", "Dragon", ..., "Phoenix"
  ]
};

export function getPetnameFromIndices(
  adjectiveIndex: number,
  nounIndex: number
): Petname;
```

**Constraints**:
- Both arrays MUST have exactly 256 entries
- Each word: title case, single word (no spaces or hyphens)
- Word length: 3-12 characters recommended

---

### Location: `src/lib/identicon-generator.ts`

#### 6.2 Identicon Generator

```typescript
export async function generateIdenticon(
  publicKey: string,
  config?: IdenticonConfig
): Promise<IdenticonResult>;

export function generateIdenticonSync(
  publicKey: string,
  config?: IdenticonConfig
): IdenticonResult;
```

**Return Format**:
```typescript
{
  svg: '<svg width="64" height="64">...</svg>',
  dataUri: 'data:image/svg+xml;base64,...',
  publicKey: '02abc...'
}
```

---

## 7. Module Export Requirements

### 7.1 Rust Exports

**File**: `src-tauri/src/crypto_domain/mod.rs`

```rust
pub mod types;
pub mod traits;
pub mod signing;
pub mod subscription;
pub mod audit;
pub mod brc42;
pub mod identity;
pub mod keychain;
pub mod domain;

// Re-export commonly used types
pub use types::{
    AuditEvent, AuditLogEntry, AuditOperation,
    Brc103IdenticonParams, Brc42DerivationParams, Brc42Params,
    CryptoError, CryptoErrorCode, CryptoResult,
    DecryptRequest, DecryptResponse, EncryptRequest, EncryptResponse,
    Identity, Keychain, Keypair, Petname,
    SignRequest, SignResponse, VerifyRequest, VerifyResponse,
};

pub use traits::{
    AuditLogger, Brc42KeyDerivation, CryptoDomain, IdentityGenerator, KeychainAccess,
};

pub use domain::EdwinPAICryptoDomain;
```

---

### 7.2 Tauri Command Exports

**File**: `src-tauri/src/commands/mod.rs`

```rust
pub mod crypto;
pub mod keychain;
pub mod gateway;
pub mod discovery;
pub mod tray;
```

**File**: `src-tauri/src/main.rs`

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        commands::crypto::get_identity,
        commands::crypto::derive_key,
        commands::crypto::sign_message,
        commands::crypto::verify_message,
        commands::crypto::generate_identicon,
        // ... other commands
    ])
    .run(tauri::generate_context!())
```

---

### 7.3 TypeScript Exports

**File**: `src/lib/crypto.ts` (planned, currently stub)

```typescript
export { getIdentity, deriveKey, signMessage, verifyMessage, generateIdenticon } from './crypto-ipc';
export type { GetIdentityResponse, DeriveKeyRequest, SignMessageRequest } from '@/types/ipc';
```

**File**: `src/lib/identity.ts`

```typescript
export { generatePetname, generateShortId, generateIdentity, isValidPublicKey };
export type { Identity, Petname, IdentityDisplay } from '@/types/identity';
```

**File**: `src/types/index.ts` (planned barrel export)

```typescript
export * from './ipc';
export * from './identity';
export * from './api';
export * from './subscription';
export * from './channels';
export * from './access';
```

---

## 8. Type Alignment Verification

### 8.1 Rust ↔ TypeScript Alignment

| Rust Type | TypeScript Type | Serialization | Notes |
|-----------|-----------------|---------------|-------|
| `String` | `string` | JSON | ✅ Direct mapping |
| `Vec<u8>` | `Uint8Array` | Binary array | ✅ Tauri auto-converts |
| `u8` | `number` | JSON number | ✅ Range check: 0-255 |
| `u32` | `number` | JSON number | ✅ Range check: 0-2³² |
| `bool` | `boolean` | JSON | ✅ Direct mapping |
| `Option<T>` | `T \| undefined` | JSON null | ✅ Serde omits null |
| `Result<T, E>` | Promise rejection | Error string | ⚠️ Error converted to string |

---

### 8.2 IPC Message Alignment

**Rust**: `GetIdentityResponse` (commands/crypto.rs)
```rust
pub struct GetIdentityResponse {
    pub public_key: String,
    pub petname: String,
    pub avatar_svg: String,
    pub short_id: String,
}
```

**TypeScript**: `GetIdentityResponse` (types/ipc.ts)
```typescript
export interface GetIdentityResponse {
  type: "GetIdentityResponse";
  publicKey: string;
  petname: string;
  avatarSvg: string;
  shortId: string;
}
```

**Discrepancy**: Rust version lacks `type` field (discriminator)

**Resolution**: TypeScript side adds `type` field manually in wrapper:
```typescript
const identity = await invoke<GetIdentityResponse>('get_identity');
return { type: "GetIdentityResponse", ...identity };
```

---

### 8.3 Naming Convention Alignment

| Context | Convention | Example |
|---------|-----------|---------|
| Rust struct | PascalCase | `SignRequest` |
| Rust field | snake_case | `public_key` |
| TS interface | PascalCase | `SignRequest` |
| TS field | camelCase | `publicKey` |
| TS type field | PascalCase | `"SignRequest"` |
| JSON serialization | snake_case (Rust) → camelCase (TS) | Via Serde `rename_all = "camelCase"` |

**Serde Annotation Required**:
```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetIdentityResponse { ... }
```

---

## 9. Critical Type Constraints

### 9.1 Security Constraints

1. **Private Key Isolation**:
   - Private key MUST NEVER appear in:
     - Tauri command responses
     - TypeScript types
     - IPC messages
     - Audit logs (only payload hash)

2. **Memory Safety**:
   - Implement `Drop` for `Keypair` to zero `private_key` bytes
   - Use `secrecy` crate or manual `zeroize` after use

3. **Key Format Validation**:
   - Public keys: validate 66 hex chars, 02/03 prefix
   - Counterparty keys: validate before ECDH computation
   - Reject invalid keys early (fail-fast)

---

### 9.2 BRC-42 Test Vector Compliance

**Non-Negotiable**: 10/10 BRC-42 test vectors MUST pass

Test vector source: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md#test-vectors

Expected test structure (Rust):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_brc42_vector_1() {
        let domain = EdwinPAICryptoDomain::new().unwrap();
        let params = Brc42Params {
            security_level: 2,
            protocol_id: "test".to_string(),
            key_id: "vector1".to_string(),
            counterparty: "02...".to_string(), // from test vector
        };
        let result = domain.derive_public_key(&params).unwrap();
        assert_eq!(result, "02..."); // expected from test vector
    }
    // ... 9 more test vectors
}
```

---

### 9.3 Audit Log Constraints

1. **Append-Only**: No deletions, no modifications (immutable log)
2. **File Location**: `~/.edwinpai/audit/crypto.log`
3. **Format**: JSON Lines (one JSON object per line, no commas between lines)
4. **Fields Required**:
   - `timestamp` (ISO 8601)
   - `operation` (snake_case)
   - `success` (boolean)
5. **Fields Optional**:
   - `protocol_id`, `key_id`, `counterparty` (context-dependent)
   - `payload_hash` (SHA-256 of raw data)
   - `error` (if success=false)

---

### 9.4 Petname Constraints

1. **Word List Size**: Exactly 256 adjectives, 256 nouns (no more, no less)
2. **Indexing**: Single-byte indices (0-255)
3. **Determinism**: Same public key MUST always produce same petname
4. **Uniqueness**: 256×256 = 65,536 possible combinations (collision possible but rare)

---

### 9.5 Identicon Constraints

1. **Determinism**: Same public key MUST always produce same SVG
2. **Size Range**: 16-512 pixels (recommend 64, 128, 256)
3. **SVG Format**: Must be valid, parseable SVG
4. **Grid Style**: Blockies-compatible (5x5 grid, symmetric)

---

## 10. Integration Checklist

### Phase 1 Completion Verification

- [ ] All Rust types compile without warnings
- [ ] All TypeScript types pass `tsc --noEmit`
- [ ] Tauri commands registered in `main.rs`
- [ ] IPC types match Rust command signatures
- [ ] BRC-42 test vectors: 10/10 PASS
- [ ] Petname word lists: 256 adjectives + 256 nouns
- [ ] Identicon generates valid SVG for all test cases
- [ ] Audit log writes to `~/.edwinpai/audit/crypto.log`
- [ ] Keychain stores/retrieves identity key on macOS/Windows/Linux
- [ ] Identity displayed in UI matches keychain public key

---

**End of Phase 1 Type Contracts Documentation**

**Related Documents**:
- `PHASE1_DELIVERABLES.md` — Implementation scope
- `PHASE1_FILE_MANIFEST.txt` — File listing with LOC estimates
- `PHASE1_TEST_COVERAGE.md` — Test plan
- `src/types/ipc.ts` — TypeScript IPC protocol
- `src-tauri/src/crypto_domain/types.rs` — Rust core types
- `src-tauri/src/crypto_domain/traits.rs` — Rust trait contracts

**Version**: 1.0
**Last Updated**: 2026-02-09
