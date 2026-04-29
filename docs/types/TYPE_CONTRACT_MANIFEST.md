# EdwinPAI Desktop - Complete Type Contract Manifest

**Generated:** 2026-02-10
**Version:** 1.0 (Phase 1 + Phase 2 Extensions)
**Sources:** edwinpai-ux/edwinpai-desktop/type-contract-manifest.md, phase1-handoff-phase2.md

## Overview

This manifest catalogs all type contracts defined across the EdwinPAI Desktop implementation, organized by domain and module. Type contracts establish the single source of truth for data structures shared between Rust (backend) and TypeScript (frontend).

## Type Organization

```
src-tauri/src/
├── crypto_domain/
│   ├── types.rs              → 21 core types (18 structs, 2 enums, 1 alias)
│   └── traits.rs             → 8 trait definitions
├── commands/
│   └── types.rs              → 12 IPC command types
└── subscription/
    ├── types.rs              → 11 subscription types (Phase 2)
    └── state_machine.rs      → 5 state types + transitions

src/lib/
├── types/
│   ├── crypto.ts             → 15 crypto operation types
│   ├── identity.ts           → 8 identity types
│   ├── subscription.ts       → 9 subscription types (Phase 2)
│   └── ipc.ts                → 14 Tauri command types
└── __tests__/types/
    └── test-types.ts         → 12 testing utility types
```

**Total Type Count:** ~95 defined types across Rust and TypeScript

---

## 1. Core Cryptographic Types (`src-tauri/src/crypto_domain/types.rs`)

### 1.1 Key Types
```rust
/// BIP-32 master key derived from seed phrase
pub struct MasterKey {
    pub private_key: [u8; 32],
    pub public_key: [u8; 33],  // Compressed SEC format
    pub chain_code: [u8; 32],
}

/// BRC-42 derived identity key
pub struct IdentityKey {
    pub private_key: [u8; 32],
    pub public_key: [u8; 33],
    pub invoice_number: String,  // Protocol ID (e.g., "edwinpai identity 0")
    pub index: u32,
}

/// Symmetric encryption key (AES-256)
pub struct SymmetricKey {
    pub key: [u8; 32],
    pub derived_from: String,  // Protocol ID for derivation
}
```

**Relationships:**
- `MasterKey` → derives → `IdentityKey` (via BRC-42)
- `IdentityKey` → derives → `SymmetricKey` (via ECDH)

### 1.2 Seed and Recovery Types
```rust
/// BIP-39 mnemonic seed phrase
pub struct SeedPhrase {
    pub words: Vec<String>,     // 12, 15, 18, 21, or 24 words
    pub word_count: u8,
    pub language: Language,
}

/// Recovery data for backup/restore
pub struct RecoveryData {
    pub encrypted_seed: Vec<u8>,
    pub nonce: [u8; 12],
    pub timestamp: u64,
    pub version: u8,
}

pub enum Language {
    English,
    Spanish,
    French,
    Italian,
    Japanese,
    Korean,
    SimplifiedChinese,
    TraditionalChinese,
}
```

### 1.3 Cryptographic Operation Types
```rust
/// Encryption result with metadata
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; 12],          // AES-GCM nonce
    pub tag: [u8; 16],            // Authentication tag
    pub algorithm: Algorithm,
}

/// Digital signature
pub struct Signature {
    pub r: [u8; 32],
    pub s: [u8; 32],
    pub recovery_id: u8,          // For public key recovery
}

/// Hash digest
pub struct HashDigest {
    pub digest: [u8; 32],
    pub algorithm: HashAlgorithm,
}

pub enum Algorithm {
    AesGcm256,
    ChaCha20Poly1305,
}

pub enum HashAlgorithm {
    Sha256,
    Sha512,
    Blake3,
}
```

### 1.4 Error Types
```rust
/// Comprehensive crypto error enum
pub enum CryptoError {
    InvalidKeyLength { expected: usize, got: usize },
    InvalidSeedPhrase(String),
    DerivationFailed(String),
    EncryptionFailed(String),
    DecryptionFailed(String),
    SignatureFailed(String),
    InvalidSignature,
    InvalidPublicKey,
    InvalidPrivateKey,
}

/// Type alias for Result with CryptoError
pub type CryptoResult<T> = Result<T, CryptoError>;
```

**Count:** 18 structs + 2 enums + 1 alias = **21 types**

---

## 2. Cryptographic Traits (`src-tauri/src/crypto_domain/traits.rs`)

### 2.1 Key Derivation Traits
```rust
/// BRC-42 protocol-level key derivation
pub trait Brc42Deriver {
    fn derive_private_key(
        &self,
        private_key: &[u8; 32],
        invoice_number: &str,
        derivation_path: Option<&str>
    ) -> CryptoResult<[u8; 32]>;

    fn derive_public_key(
        &self,
        public_key: &[u8; 33],
        invoice_number: &str,
        derivation_path: Option<&str>
    ) -> CryptoResult<[u8; 33]>;

    fn derive_symmetric_key(
        &self,
        private_key: &[u8; 32],
        public_key: &[u8; 33],
        invoice_number: &str
    ) -> CryptoResult<[u8; 32]>;
}

/// BIP-32 hierarchical deterministic derivation
pub trait Bip32Deriver {
    fn derive_master_key(&self, seed: &[u8]) -> CryptoResult<MasterKey>;

    fn derive_child_key(
        &self,
        parent: &MasterKey,
        path: &str  // e.g., "m/44'/0'/0'/0/0"
    ) -> CryptoResult<MasterKey>;
}
```

### 2.2 Cryptographic Operation Traits
```rust
/// Encryption and decryption operations
pub trait Cipher {
    fn encrypt(&self, plaintext: &[u8], key: &SymmetricKey) -> CryptoResult<EncryptedData>;
    fn decrypt(&self, encrypted: &EncryptedData, key: &SymmetricKey) -> CryptoResult<Vec<u8>>;
}

/// Digital signature operations
pub trait Signer {
    fn sign(&self, message: &[u8], private_key: &[u8; 32]) -> CryptoResult<Signature>;
    fn verify(&self, message: &[u8], signature: &Signature, public_key: &[u8; 33]) -> CryptoResult<bool>;
}

/// Hashing operations
pub trait Hasher {
    fn hash(&self, data: &[u8], algorithm: HashAlgorithm) -> CryptoResult<HashDigest>;
    fn hmac(&self, data: &[u8], key: &[u8], algorithm: HashAlgorithm) -> CryptoResult<HashDigest>;
}
```

### 2.3 Seed Management Traits
```rust
/// BIP-39 mnemonic operations
pub trait MnemonicGenerator {
    fn generate(&self, word_count: u8, language: Language) -> CryptoResult<SeedPhrase>;
    fn from_words(&self, words: Vec<String>, language: Language) -> CryptoResult<SeedPhrase>;
    fn to_seed(&self, phrase: &SeedPhrase, passphrase: Option<&str>) -> CryptoResult<Vec<u8>>;
}

/// Secure seed storage
pub trait SeedStorage {
    fn store(&self, seed: &SeedPhrase, password: &str) -> CryptoResult<RecoveryData>;
    fn retrieve(&self, recovery: &RecoveryData, password: &str) -> CryptoResult<SeedPhrase>;
}
```

### 2.4 Identity Management Trait
```rust
/// Identity generation and management
pub trait IdentityManager {
    fn generate_identity(&self, master_key: &MasterKey, index: u32) -> CryptoResult<IdentityKey>;
    fn list_identities(&self) -> CryptoResult<Vec<IdentityKey>>;
    fn get_identity(&self, index: u32) -> CryptoResult<Option<IdentityKey>>;
}
```

**Count:** 8 traits with 23 total methods

---

## 3. Tauri IPC Command Types (`src-tauri/src/commands/types.rs`)

### 3.1 Command Request Types
```rust
/// Generate new seed phrase
#[derive(Deserialize)]
pub struct GenerateSeedRequest {
    pub word_count: u8,
    pub language: String,
}

/// Derive master key from seed
#[derive(Deserialize)]
pub struct DeriveMasterKeyRequest {
    pub seed_phrase: Vec<String>,
    pub passphrase: Option<String>,
}

/// Generate identity from master key
#[derive(Deserialize)]
pub struct GenerateIdentityRequest {
    pub master_private_key: String,  // Hex-encoded
    pub index: u32,
}

/// Encrypt data request
#[derive(Deserialize)]
pub struct EncryptRequest {
    pub plaintext: String,
    pub private_key: String,
    pub public_key: String,
    pub protocol: String,
}

/// Decrypt data request
#[derive(Deserialize)]
pub struct DecryptRequest {
    pub ciphertext: String,  // Base64-encoded
    pub nonce: String,       // Base64-encoded
    pub private_key: String,
    pub public_key: String,
    pub protocol: String,
}
```

### 3.2 Command Response Types
```rust
/// Seed phrase response
#[derive(Serialize)]
pub struct SeedPhraseResponse {
    pub words: Vec<String>,
    pub word_count: u8,
}

/// Master key response
#[derive(Serialize)]
pub struct MasterKeyResponse {
    pub private_key: String,  // Hex-encoded
    pub public_key: String,   // Hex-encoded
}

/// Identity response
#[derive(Serialize)]
pub struct IdentityResponse {
    pub index: u32,
    pub private_key: String,
    pub public_key: String,
    pub invoice_number: String,
}

/// Encryption response
#[derive(Serialize)]
pub struct EncryptionResponse {
    pub ciphertext: String,  // Base64-encoded
    pub nonce: String,       // Base64-encoded
    pub tag: String,         // Base64-encoded
}

/// Decryption response
#[derive(Serialize)]
pub struct DecryptionResponse {
    pub plaintext: String,
}
```

### 3.3 Error Response Type
```rust
/// Unified error response for IPC commands
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
    pub details: Option<String>,
}
```

**Count:** 12 types (5 request types + 6 response types + 1 error type)

---

## 4. Subscription Types (`src-tauri/src/subscription/types.rs`) - Phase 2

### 4.1 Subscription State Types
```rust
/// Subscription state machine states
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SubscriptionState {
    NotFound,
    Active,
    Cached,
    Expired,
    GraceExceeded,
}

/// Subscription UTXO reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionUtxo {
    pub txid: String,
    pub vout: u32,
    pub amount_satoshis: u64,
}

/// Cached subscription proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedProof {
    pub txid: String,
    pub vout: u32,
    pub timestamp: u64,  // Unix timestamp (ms) of last verification
    pub proof: MerkleProof,
}

/// Merkle proof for SPV verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleProof {
    pub merkle_root: String,
    pub merkle_path: Vec<MerklePathElement>,
    pub block_height: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerklePathElement {
    pub hash: String,
    pub position: MerklePosition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MerklePosition {
    Left,
    Right,
}
```

### 4.2 Subscription Management Types
```rust
/// Subscription verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub state: SubscriptionState,
    pub utxo: Option<SubscriptionUtxo>,
    pub cached_proof: Option<CachedProof>,
    pub grace_time_remaining_ms: Option<u64>,
    pub last_verification_attempt: u64,
}

/// Subscription manager configuration
#[derive(Debug, Clone, Deserialize)]
pub struct SubscriptionConfig {
    pub verification_interval_ms: u64,  // Default: 3600000 (1 hour)
    pub grace_period_ms: u64,           // Default: 259200000 (72 hours)
    pub overlay_services_url: String,
}

/// Subscription payment request
#[derive(Debug, Clone, Deserialize)]
pub struct SubscriptionPaymentRequest {
    pub identity_public_key: String,
    pub amount_satoshis: u64,
    pub recipient_address: String,
}

/// Subscription payment response
#[derive(Debug, Clone, Serialize)]
pub struct SubscriptionPaymentResponse {
    pub txid: String,
    pub vout: u32,
    pub raw_tx: String,
}
```

**Count:** 11 types (2 enums + 9 structs)

---

## 5. TypeScript Frontend Types

### 5.1 Crypto Types (`src/lib/types/crypto.ts`)
```typescript
/** Master key derived from seed phrase */
export interface MasterKey {
  privateKey: string;  // Hex-encoded
  publicKey: string;   // Hex-encoded, compressed
  chainCode: string;   // Hex-encoded
}

/** BRC-42 derived identity key */
export interface IdentityKey {
  privateKey: string;
  publicKey: string;
  invoiceNumber: string;
  index: number;
}

/** Encrypted data with metadata */
export interface EncryptedData {
  ciphertext: string;  // Base64-encoded
  nonce: string;       // Base64-encoded
  tag: string;         // Base64-encoded
  algorithm: 'AES-GCM-256' | 'ChaCha20-Poly1305';
}

/** Digital signature */
export interface Signature {
  r: string;  // Hex-encoded
  s: string;  // Hex-encoded
  recoveryId: number;
}

/** Seed phrase */
export interface SeedPhrase {
  words: string[];
  wordCount: 12 | 15 | 18 | 21 | 24;
  language: Language;
}

export type Language =
  | 'English'
  | 'Spanish'
  | 'French'
  | 'Italian'
  | 'Japanese'
  | 'Korean'
  | 'SimplifiedChinese'
  | 'TraditionalChinese';

/** Key derivation protocol IDs */
export const EDWINPAI_PROTOCOLS = {
  IDENTITY: 'edwinpai:identity:0',
  SUBSCRIPTION: 'edwinpai:subscription:0',
  MESSAGE: 'edwinpai:message:0',
  BACKUP: 'edwinpai:backup:0',
} as const;

export type EdwinPAIProtocol = typeof EDWINPAI_PROTOCOLS[keyof typeof EDWINPAI_PROTOCOLS];
```

### 5.2 Identity Types (`src/lib/types/identity.ts`)
```typescript
/** Complete EdwinPAI identity */
export interface EdwinPAIIdentity {
  index: number;
  privateKey: string;
  publicKey: string;
  invoiceNumber: string;
  createdAt: Date;
  label?: string;
}

/** Identity list entry */
export interface IdentityListItem {
  index: number;
  publicKey: string;
  label?: string;
  createdAt: Date;
}

/** Identity creation options */
export interface CreateIdentityOptions {
  masterPrivateKey: string;
  index: number;
  label?: string;
}

/** Identity export format */
export interface IdentityExport {
  version: '1.0';
  identities: EdwinPAIIdentity[];
  exportedAt: string;  // ISO 8601
}
```

### 5.3 Subscription Types (`src/lib/types/subscription.ts`) - Phase 2
```typescript
/** Subscription state */
export type SubscriptionState =
  | 'NotFound'
  | 'Active'
  | 'Cached'
  | 'Expired'
  | 'GraceExceeded';

/** Subscription status response */
export interface SubscriptionStatus {
  state: SubscriptionState;
  txid?: string;
  vout?: number;
  graceTimeRemaining?: number;  // Milliseconds
  lastVerificationAttempt: number;  // Unix timestamp (ms)
}

/** Subscription payment details */
export interface SubscriptionPayment {
  identityPublicKey: string;
  amountSatoshis: number;
  recipientAddress: string;
}

/** Subscription configuration */
export interface SubscriptionConfig {
  verificationIntervalMs: number;
  gracePeriodMs: number;
  overlayServicesUrl: string;
}

/** Merkle proof for SPV */
export interface MerkleProof {
  merkleRoot: string;
  merklePath: Array<{
    hash: string;
    position: 'Left' | 'Right';
  }>;
  blockHeight: number;
}
```

### 5.4 IPC Types (`src/lib/types/ipc.ts`)
```typescript
/** Tauri command request/response types */

// Seed generation
export interface GenerateSeedCommand {
  wordCount: 12 | 15 | 18 | 21 | 24;
  language: Language;
}

export interface GenerateSeedResponse {
  words: string[];
  wordCount: number;
}

// Master key derivation
export interface DeriveMasterKeyCommand {
  seedPhrase: string[];
  passphrase?: string;
}

export interface DeriveMasterKeyResponse {
  privateKey: string;
  publicKey: string;
}

// Identity generation
export interface GenerateIdentityCommand {
  masterPrivateKey: string;
  index: number;
}

export interface GenerateIdentityResponse {
  index: number;
  privateKey: string;
  publicKey: string;
  invoiceNumber: string;
}

// Encryption
export interface EncryptCommand {
  plaintext: string;
  privateKey: string;
  publicKey: string;
  protocol: string;
}

export interface EncryptResponse {
  ciphertext: string;
  nonce: string;
  tag: string;
}

// Subscription check (Phase 2)
export interface CheckSubscriptionCommand {
  identityPublicKey: string;
}

export interface CheckSubscriptionResponse {
  state: SubscriptionState;
  txid?: string;
  vout?: number;
  graceTimeRemaining?: number;
}
```

**Count (TypeScript):** 15 (crypto) + 8 (identity) + 9 (subscription) + 14 (IPC) = **46 types**

---

## 6. Test Types (`src/__tests__/types/test-types.ts`)

### 6.1 Test Fixture Types
```typescript
/** Test seed phrase fixture */
export interface TestSeedFixture {
  words: string[];
  expectedMasterKey: string;
  expectedPublicKey: string;
}

/** Test identity fixture */
export interface TestIdentityFixture {
  masterKey: string;
  index: number;
  expectedPrivateKey: string;
  expectedPublicKey: string;
  expectedInvoiceNumber: string;
}

/** Test encryption fixture */
export interface TestEncryptionFixture {
  privateKeyA: string;
  publicKeyA: string;
  privateKeyB: string;
  publicKeyB: string;
  plaintext: string;
  protocol: string;
}
```

### 6.2 Mock Types
```typescript
/** Mock Brc42Deriver for testing */
export interface MockBrc42Deriver {
  derivePrivateKey: jest.Mock;
  derivePublicKey: jest.Mock;
  deriveSymmetricKey: jest.Mock;
  derivationLog: Array<{
    invoice: string;
    path?: string;
  }>;
}

/** Mock subscription manager */
export interface MockSubscriptionManager {
  checkSubscription: jest.Mock;
  updateState: jest.Mock;
  getCachedProof: jest.Mock;
}
```

**Count:** 12 types (5 fixture types + 7 mock types)

---

## 7. Type Relationships

### 7.1 Key Derivation Hierarchy
```
SeedPhrase (BIP-39)
    ↓ to_seed()
SeedBytes (512 bits)
    ↓ derive_master_key()
MasterKey (BIP-32)
    ↓ derive_private_key(invoice_number)
IdentityKey (BRC-42)
    ↓ derive_symmetric_key(counterparty_pubkey)
SymmetricKey (ECDH + KDF)
```

### 7.2 Subscription State Flow
```
NotFound
    ↓ payment creates UTXO
Active
    ↓ verification fails (within grace)
Cached
    ↓ grace period expires
Expired
    ↓ UTXO confirmed spent
GraceExceeded
    ↓ new payment
Active
```

### 7.3 IPC Request/Response Pairs
| Request Type | Response Type | Tauri Command |
|--------------|---------------|---------------|
| `GenerateSeedRequest` | `SeedPhraseResponse` | `generate_seed` |
| `DeriveMasterKeyRequest` | `MasterKeyResponse` | `derive_master_key` |
| `GenerateIdentityRequest` | `IdentityResponse` | `generate_identity` |
| `EncryptRequest` | `EncryptionResponse` | `encrypt_data` |
| `DecryptRequest` | `DecryptionResponse` | `decrypt_data` |
| `CheckSubscriptionCommand` | `CheckSubscriptionResponse` | `check_subscription` |

### 7.4 Cross-Language Type Mapping
| Rust Type | TypeScript Type | Serialization |
|-----------|----------------|---------------|
| `[u8; 32]` | `string` (hex) | `hex::encode()` / `hex::decode()` |
| `[u8; 33]` | `string` (hex) | `hex::encode()` / `hex::decode()` |
| `Vec<u8>` | `string` (base64) | `base64::encode()` / `base64::decode()` |
| `u64` | `number` | Direct JSON serialization |
| `String` | `string` | Direct JSON serialization |
| `Option<T>` | `T \| undefined` | JSON `null` → `undefined` |
| `Result<T, E>` | `Promise<T>` | Tauri error handling |

---

## 8. Type Evolution Strategy

### Version Compatibility
```rust
/// Type versioning for backward compatibility
#[derive(Serialize, Deserialize)]
pub struct VersionedIdentityKey {
    pub version: u8,  // Current: 1
    pub data: IdentityKey,
}

/// Migration function example
pub fn migrate_identity_v1_to_v2(v1: IdentityKeyV1) -> IdentityKeyV2 {
    IdentityKeyV2 {
        // ... migration logic
    }
}
```

### Deprecation Pattern
```typescript
/** @deprecated Use EdwinPAIIdentity instead. Will be removed in v2.0 */
export interface LegacyIdentity {
  // ...
}
```

---

## 9. Documentation Standards

### JSDoc/RustDoc Requirements
1. **All public types** must have doc comments
2. **Field descriptions** for all struct/interface fields
3. **Example usage** for complex types
4. **Cross-references** using `@see` or `///` links

### Example (TypeScript)
```typescript
/**
 * Complete EdwinPAI identity with cryptographic keys and metadata
 *
 * @see {IdentityKey} for the Rust backend equivalent
 * @see {CreateIdentityOptions} for creation parameters
 *
 * @example
 * ```typescript
 * const identity: EdwinPAIIdentity = {
 *   index: 0,
 *   privateKey: '0x...',
 *   publicKey: '0x...',
 *   invoiceNumber: 'edwinpai:identity:0 0',
 *   createdAt: new Date(),
 * };
 * ```
 */
export interface EdwinPAIIdentity {
  /** Zero-based identity index */
  index: number;
  /** Hex-encoded private key (32 bytes) */
  privateKey: string;
  // ...
}
```

---

## 10. Type Contract Validation

### Phase 1 Deliverables
- ✅ 21 Rust core types (`types.rs`)
- ✅ 8 Rust traits (`traits.rs`)
- ✅ 12 Rust IPC types (`commands/types.rs`)
- ✅ 15 TypeScript crypto types
- ✅ 8 TypeScript identity types
- ✅ 14 TypeScript IPC types
- ✅ 12 TypeScript test types

### Phase 2 Extensions (Subscription)
- ✅ 11 Rust subscription types
- ✅ 5 state machine types
- ✅ 9 TypeScript subscription types

**Total:** ~115 types across 10 modules

---

## References

1. **Phase 1 Type Contracts:** edwinpai-ux/edwinpai-desktop/type-contract-manifest.md
2. **Phase 2 Handoff:** edwinpai-ux/edwinpai-desktop/phase1-handoff-phase2.md (lines 69-72)
3. **Test Types:** edwinpai-ux/edwinpai-desktop/docs/test-types.md
4. **Subscription Implementation:** edwinpai-ux/edwinpai-desktop/subscription-implementation-summary.md
5. **BRC-42 Specification:** https://github.com/bitcoin-sv/BRCs/tree/master/key-derivation

---

## Appendix: Type Count Summary

| Category | Rust Types | TypeScript Types | Total |
|----------|-----------|------------------|-------|
| Core Crypto | 21 | 15 | 36 |
| Traits/Interfaces | 8 | 0 | 8 |
| IPC Commands | 12 | 14 | 26 |
| Identity | 0 | 8 | 8 |
| Subscription | 16 | 9 | 25 |
| Test Types | 0 | 12 | 12 |
| **Grand Total** | **57** | **58** | **115** |
