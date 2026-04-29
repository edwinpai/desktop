# Crypto Domain Types & IPC Contracts Reference

**Generated:** 2026-02-09
**Phase:** Phase 1 (BRC-42 Key Derivation & BSV Identity)
**Scope:** Complete type definitions for Rust backend and TypeScript frontend

This document serves as the comprehensive reference for all type definitions, error enums, function signatures, and trait bounds in the EdwinPAI Desktop crypto domain.

---

## Table of Contents

1. [Rust Core Types](#rust-core-types)
2. [Rust Error Enums](#rust-error-enums)
3. [Rust Traits & Function Signatures](#rust-traits--function-signatures)
4. [TypeScript IPC Contracts](#typescript-ipc-contracts)
5. [TypeScript Frontend Types](#typescript-frontend-types)
6. [Type Export Barrel](#type-export-barrel)
7. [BRC Specifications Alignment](#brc-specifications-alignment)

---

## 1. Rust Core Types

### 1.1 Keypair (secp256k1)

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone)]
pub struct Keypair {
    /// Private key (32 bytes)
    pub private_key: [u8; 32],
    /// Compressed public key (33 bytes)
    pub public_key: [u8; 33],
}

impl Keypair {
    /// Get hex-encoded public key
    pub fn public_key_hex(&self) -> String;
}
```

**Purpose:** Represents a secp256k1 elliptic curve key pair for Bitcoin SV cryptographic operations.

**Security Note:** Private key is NOT serialized (using `#[serde(skip)]` in parent structs).

---

### 1.2 KeychainEntry

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keychain {
    /// Master identity keypair (stored securely)
    #[serde(skip)]
    pub identity_key: Option<Keypair>,

    /// Encrypted identity key (for persistence)
    pub encrypted_identity_key: Option<Vec<u8>>,

    /// Derived key cache (protocol_id:key_id:counterparty -> public_key)
    pub derived_keys: std::collections::HashMap<String, String>,
}
```

**Purpose:** Stores the master identity key and cached derived keys. The master key is encrypted before storage in the OS keychain.

**Keychain Service/Account Convention:**
- Service: `com.edwinpaiapp.desktop`
- Account: `identity_master_key`

---

### 1.3 DerivationParams (BRC-42)

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Brc42DerivationParams {
    /// Security level (default: 2 per BRC-42)
    pub security_level: u8,

    /// Protocol ID (e.g., "edwinpai", "edwinpai-auth")
    pub protocol_id: String,

    /// Key ID (context-specific identifier)
    pub key_id: String,

    /// Counterparty public key (compressed, 33 bytes, hex-encoded)
    pub counterparty: String,
}

impl Brc42DerivationParams {
    /// Construct BRC-43 invoice number: "<security_level>-<protocol_id>-<key_id>"
    pub fn invoice_number(&self) -> String {
        format!("{}-{}-{}", self.security_level, self.protocol_id, self.key_id)
    }

    /// Construct cache key for derived key lookup
    pub fn cache_key(&self) -> String {
        format!("{}:{}:{}", self.protocol_id, self.key_id, self.counterparty)
    }
}
```

**Alias:** `Brc42Params` (legacy compatibility)

**BRC-42 Specification:**
- Security Level: Determines HMAC iteration count (default: 2)
- Protocol ID: Application-specific identifier (e.g., "edwinpai-chat")
- Key ID: Context within protocol (e.g., "encryption-key", "signing-key")
- Counterparty: Public key of the other party in bilateral key derivation

**Reference:** [BRC-42 Specification](https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md)

---

### 1.4 SigningRequest (BRC-103)

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignRequest {
    /// Raw data to sign (will be hashed with SHA-256)
    pub data: Vec<u8>,

    /// Optional BRC-42 derivation parameters
    /// If None, uses master identity key
    pub derivation: Option<Brc42Params>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignResponse {
    /// DER-encoded ECDSA signature
    pub signature: Vec<u8>,

    /// Public key used for signing (compressed, hex-encoded)
    pub public_key: String,
}
```

**Signature Algorithm:**
- Hash: SHA-256 of input data
- Signature: ECDSA over secp256k1
- Encoding: DER format (compatible with Bitcoin transaction signatures)

**Reference:** [BRC-103 Message Signatures](https://github.com/bitcoin-sv/BRCs)

---

### 1.5 Verification Types

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyRequest {
    /// Original data that was signed
    pub data: Vec<u8>,

    /// DER-encoded ECDSA signature
    pub signature: Vec<u8>,

    /// Public key to verify against (compressed, hex-encoded)
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResponse {
    /// Whether the signature is valid
    pub valid: bool,
}
```

---

### 1.6 Encryption Types (BRC-2)

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptRequest {
    /// Plaintext to encrypt
    pub plaintext: Vec<u8>,

    /// BRC-42 derivation for encryption key
    pub derivation: Brc42Params,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptResponse {
    /// Ciphertext
    pub ciphertext: Vec<u8>,

    /// Initialization vector (16 bytes for AES-256-GCM)
    pub iv: Vec<u8>,

    /// Authentication tag (16 bytes for GCM mode)
    pub auth_tag: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptRequest {
    /// Ciphertext to decrypt
    pub ciphertext: Vec<u8>,

    /// Initialization vector
    pub iv: Vec<u8>,

    /// Authentication tag (for AEAD modes)
    pub auth_tag: Option<Vec<u8>>,

    /// BRC-42 derivation for decryption key
    pub derivation: Brc42Params,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptResponse {
    /// Decrypted plaintext
    pub plaintext: Vec<u8>,
}
```

**Encryption Algorithm:** AES-256-GCM (Authenticated Encryption with Associated Data)

**Reference:** [BRC-2 Encryption/Decryption](https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0002.md)

---

### 1.7 Identity Types

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Petname {
    pub adjective: String,
    pub noun: String,
    pub display: String, // e.g., "Swift Falcon"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    /// Compressed public key (33 bytes, 66 hex chars)
    pub public_key: String,

    /// Deterministic petname (e.g., "Swift Falcon")
    pub petname: String,

    /// SVG identicon (deterministic from public key)
    pub avatar_svg: String,

    /// Short ID with prefix (e.g., "edw:a3f7b2c1")
    pub short_id: String,
}
```

**Identicon Specification:**
- Algorithm: Deterministic SVG generation from public key hash
- Grid: 5x5 pixel blocks
- Colors: Derived from first 3 bytes of SHA-256(public_key)
- Size: Configurable (default: 64x64 pixels)

**Reference:** [BRC-103 Identicons](https://github.com/bitcoin-sv/BRCs)

---

### 1.8 BRC-103 Identicon Parameters

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
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

impl Default for Brc103IdenticonParams {
    fn default() -> Self {
        Self {
            public_key: String::new(),
            size: 64,
            grid_size: 5,
            colors: None,
        }
    }
}
```

---

### 1.9 AuditLogEntry

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    /// ISO 8601 timestamp (e.g., "2026-02-09T14:30:00Z")
    pub timestamp: String,

    /// Operation type (see AuditOperation enum)
    pub operation: AuditOperation,

    /// Protocol ID (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol_id: Option<String>,

    /// Key ID (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_id: Option<String>,

    /// Counterparty public key (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty: Option<String>,

    /// SHA-256 hash of payload (not the raw data for privacy)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload_hash: Option<String>,

    /// Whether operation succeeded
    pub success: bool,

    /// Error message if success=false
    #[serde(skip_serializing_if = "Option::is_none")]
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

**Audit Event (Pre-Storage):**

```rust
#[derive(Debug, Clone)]
pub struct AuditEvent {
    pub operation: AuditOperation,
    pub protocol_id: Option<String>,
    pub key_id: Option<String>,
    pub counterparty: Option<String>,
    pub payload: Option<Vec<u8>>, // Raw payload (hashed before storage)
    pub success: bool,
    pub error: Option<String>,
}

impl AuditEvent {
    /// Convert to AuditLogEntry with timestamp and payload hash
    pub fn to_log_entry(&self) -> AuditLogEntry;
}
```

**Storage Location:** `~/.edwinpai/audit/crypto.log` (newline-delimited JSON)

**Privacy:** Raw payloads are NEVER stored; only SHA-256 hashes are logged.

---

## 2. Rust Error Enums

### 2.1 KeychainError

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum KeychainError {
    #[error("Keychain entry not found: {0}")]
    NotFound(String),

    #[error("Failed to access OS keychain: {0}")]
    OsKeychainAccess(String),

    #[error("Failed to decrypt master key: {0}")]
    DecryptionFailed(String),

    #[error("Failed to encrypt master key: {0}")]
    EncryptionFailed(String),

    #[error("Invalid keychain entry format: {0}")]
    InvalidFormat(String),

    #[error("Keychain entry already exists: {0}")]
    AlreadyExists(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}
```

---

### 2.2 DerivationError

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum DerivationError {
    #[error("Invalid protocol ID: {0}")]
    InvalidProtocolId(String),

    #[error("Invalid key ID: {0}")]
    InvalidKeyId(String),

    #[error("Invalid counterparty public key: {0}")]
    InvalidCounterpartyKey(String),

    #[error("Invalid master key: {0}")]
    InvalidMasterKey(String),

    #[error("HMAC derivation failed: {0}")]
    HmacFailed(String),

    #[error("Secp256k1 operation failed: {0}")]
    Secp256k1Error(String),

    #[error("Missing required parameter: {0}")]
    MissingParameter(String),

    #[error("Invoice number out of range: {0}")]
    InvalidInvoiceNumber(String),
}
```

---

### 2.3 SigningError

**Location:** `src-tauri/src/crypto_domain/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum SigningError {
    #[error("Invalid data format: {0}")]
    InvalidDataFormat(String),

    #[error("Data too large: {0} bytes (max: {1})")]
    DataTooLarge(usize, usize),

    #[error("Signing operation failed: {0}")]
    SigningFailed(String),

    #[error("User denied signing request")]
    UserDenied,

    #[error("Key derivation failed: {0}")]
    DerivationFailed(String),

    #[error("Invalid transaction format: {0}")]
    InvalidTransaction(String),

    #[error("Unsupported signature type: {0}")]
    UnsupportedSignatureType(String),
}
```

---

### 2.4 Consolidated CryptoError

**Location:** `src-tauri/src/crypto_domain/types.rs`

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

impl std::fmt::Display for CryptoErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::KeychainUnavailable => write!(f, "ERR_KEYCHAIN_UNAVAILABLE"),
            Self::KeyNotFound => write!(f, "ERR_KEY_NOT_FOUND"),
            Self::InvalidKey => write!(f, "ERR_INVALID_KEY"),
            Self::InvalidSignature => write!(f, "ERR_INVALID_SIGNATURE"),
            Self::DerivationFailed => write!(f, "ERR_DERIVATION_FAILED"),
            Self::SigningFailed => write!(f, "ERR_SIGNING_FAILED"),
            Self::VerificationFailed => write!(f, "ERR_VERIFICATION_FAILED"),
            Self::EncryptionFailed => write!(f, "ERR_ENCRYPTION_FAILED"),
            Self::DecryptionFailed => write!(f, "ERR_DECRYPTION_FAILED"),
            Self::InvalidCounterparty => write!(f, "ERR_INVALID_COUNTERPARTY"),
        }
    }
}

pub type CryptoResult<T> = Result<T, CryptoError>;
```

**Error Code Mapping:**
- Frontend receives `code` as string constant (e.g., `"ERR_SIGNING_FAILED"`)
- Frontend can display `message` to user or map to localized strings

---

## 3. Rust Traits & Function Signatures

### 3.1 CryptoDomain Trait

**Location:** `src-tauri/src/crypto_domain/traits.rs`

```rust
/// Main Crypto Domain capability trait
///
/// All operations are audited per SPEC §3.6.
pub trait CryptoDomain: Send + Sync {
    // --- Identity Operations ---

    /// Get the master identity (public key, petname, avatar, short ID)
    fn get_identity(&self) -> CryptoResult<Identity>;

    /// Generate a deterministic identicon SVG from a public key
    fn generate_identicon(&self, public_key: &str, size: u32) -> CryptoResult<String>;

    /// Derive a petname from a public key
    fn derive_petname(&self, public_key: &str) -> CryptoResult<Petname>;

    // --- Key Derivation (BRC-42) ---

    /// Derive a public key using BRC-42 ECDH key derivation
    fn derive_public_key(&self, params: &Brc42Params) -> CryptoResult<String>;

    /// Derive a private key using BRC-42 (for decryption/signing)
    ///
    /// NOT exposed via IPC; only used internally.
    fn derive_private_key(&self, params: &Brc42Params) -> CryptoResult<String>;

    // --- Signing & Verification ---

    /// Sign data using either the identity key or a derived key
    fn sign(&self, request: &SignRequest) -> CryptoResult<SignResponse>;

    /// Verify a signature against a public key
    fn verify(&self, request: &VerifyRequest) -> CryptoResult<VerifyResponse>;

    // --- Encryption & Decryption (BRC-2) ---

    /// Encrypt plaintext using a BRC-42 derived key
    fn encrypt(&self, request: &EncryptRequest) -> CryptoResult<EncryptResponse>;

    /// Decrypt ciphertext using a BRC-42 derived key
    fn decrypt(&self, request: &DecryptRequest) -> CryptoResult<DecryptResponse>;

    // --- Audit Logging ---

    /// Append an entry to the audit log
    fn log_operation(&self, entry: AuditLogEntry) -> CryptoResult<()>;

    /// Read audit log entries (for diagnostics/transparency)
    fn read_audit_log(&self, limit: Option<usize>) -> CryptoResult<Vec<AuditLogEntry>>;
}
```

**Trait Bounds:**
- `Send`: Can be transferred across thread boundaries
- `Sync`: Can be shared between threads (for async Tauri commands)

---

### 3.2 KeychainAccess Trait

**Location:** `src-tauri/src/crypto_domain/traits.rs`

```rust
/// Keychain access trait
///
/// Abstracts OS-specific keychain operations.
pub trait KeychainAccess: Send + Sync {
    /// Store a key in the OS keychain
    fn store_key(&self, service: &str, account: &str, key: &str) -> CryptoResult<()>;

    /// Retrieve a key from the OS keychain
    fn get_key(&self, service: &str, account: &str) -> CryptoResult<String>;

    /// Delete a key from the OS keychain
    fn delete_key(&self, service: &str, account: &str) -> CryptoResult<()>;

    /// Check if a key exists in the keychain
    fn key_exists(&self, service: &str, account: &str) -> bool;
}
```

**Implementation Note:** Uses `keyring` crate for cross-platform keychain access:
- macOS: Keychain Access
- Windows: Credential Manager
- Linux: Secret Service API (libsecret)

---

### 3.3 AuditLogger Trait

**Location:** `src-tauri/src/crypto_domain/traits.rs`

```rust
/// Audit log writer trait
///
/// Append-only audit log per SPEC §3.6.
pub trait AuditLogger: Send + Sync {
    /// Append an entry to the audit log
    fn append(&self, entry: AuditLogEntry) -> CryptoResult<()>;

    /// Read entries from the audit log
    fn read(&self, limit: Option<usize>) -> CryptoResult<Vec<AuditLogEntry>>;

    /// Get the total number of logged operations
    fn count(&self) -> CryptoResult<usize>;
}
```

**Storage Format:** Newline-delimited JSON (NDJSON)

---

### 3.4 IdentityGenerator Trait

**Location:** `src-tauri/src/crypto_domain/traits.rs`

```rust
/// Identity generation trait
///
/// Deterministic petname and identicon generation from public keys.
pub trait IdentityGenerator: Send + Sync {
    /// Derive a petname from a public key
    fn generate_petname(&self, public_key: &str) -> CryptoResult<Petname>;

    /// Generate an identicon SVG from a public key
    fn generate_identicon(&self, public_key: &str, size: u32) -> CryptoResult<String>;

    /// Derive a short ID from a public key (edw:<8 hex chars>)
    fn generate_short_id(&self, public_key: &str) -> CryptoResult<String>;
}
```

---

### 3.5 Brc42KeyDerivation Trait

**Location:** `src-tauri/src/crypto_domain/traits.rs`

```rust
/// BRC-42 key derivation trait
///
/// Implements BSV Key Derivation Scheme per BRC-42 and BRC-43.
pub trait Brc42KeyDerivation: Send + Sync {
    /// Derive a child public key from a counterparty's public key
    fn derive_public_key(
        &self,
        master_private_key: &str,
        counterparty_public_key: &str,
        invoice_number: &str,
    ) -> CryptoResult<String>;

    /// Derive a child private key (for decryption/signing)
    fn derive_private_key(
        &self,
        master_private_key: &str,
        counterparty_public_key: &str,
        invoice_number: &str,
    ) -> CryptoResult<String>;

    /// Compute ECDH shared secret
    fn compute_shared_secret(
        &self,
        private_key: &str,
        public_key: &str,
    ) -> CryptoResult<Vec<u8>>;
}
```

**BRC-42 Derivation Algorithm:**

1. **ECDH Shared Secret:** `S = private_key * counterparty_public_key`
2. **HMAC Derivation:** `child_key = HMAC-SHA256(S, invoice_number)`
3. **Child Key:** `child_private_key = (master_private_key + child_key) mod n`
4. **Child Public Key:** `child_public_key = child_private_key * G`

Where:
- `G` = secp256k1 generator point
- `n` = secp256k1 curve order

---

## 4. TypeScript IPC Contracts

### 4.1 Core IPC Messages

**Location:** `src/types/ipc.ts`

All IPC messages follow a request/response pattern with discriminated unions via the `type` field.

#### 4.1.1 Sign Request/Response

```typescript
export interface SignRequest {
  type: "SignRequest";
  payload: Uint8Array;
  protocolID: string;
  keyID: string;
  counterparty?: string;
}

export interface SignResponse {
  type: "SignResponse";
  signature: Uint8Array;
  publicKey: string; // hex-encoded compressed public key
}
```

---

#### 4.1.2 Verify Request/Response

```typescript
export interface VerifyRequest {
  type: "VerifyRequest";
  payload: Uint8Array;
  signature: Uint8Array;
  publicKey: string;
}

export interface VerifyResponse {
  type: "VerifyResponse";
  valid: boolean;
}
```

---

#### 4.1.3 Get Public Key Request/Response

```typescript
export interface GetPublicKeyRequest {
  type: "GetPublicKeyRequest";
  identityKey?: boolean; // true = identity key, false = derived key
  protocolID?: string;
  keyID?: string;
  counterparty?: string;
}

export interface GetPublicKeyResponse {
  type: "GetPublicKeyResponse";
  publicKey: string;
}
```

---

#### 4.1.4 Encrypt/Decrypt Request/Response

```typescript
export interface EncryptRequest {
  type: "EncryptRequest";
  plaintext: Uint8Array;
  protocolID: string;
  keyID: string;
  counterparty: string;
}

export interface EncryptResponse {
  type: "EncryptResponse";
  ciphertext: Uint8Array;
}

export interface DecryptRequest {
  type: "DecryptRequest";
  ciphertext: Uint8Array;
  protocolID: string;
  keyID: string;
  counterparty: string;
}

export interface DecryptResponse {
  type: "DecryptResponse";
  plaintext: Uint8Array;
}
```

---

### 4.2 BRC-42 Key Derivation (Phase 1)

```typescript
export interface DeriveKeyRequest {
  type: "DeriveKeyRequest";
  protocolID: string;
  keyID: string;
  counterparty: string;
  /** Security level (default: 2) */
  securityLevel?: number;
}

export interface DeriveKeyResponse {
  type: "DeriveKeyResponse";
  /** Derived public key (compressed, hex-encoded) */
  publicKey: string;
}
```

---

### 4.3 BRC-103 Message Signing (Phase 1)

```typescript
export interface SignMessageRequest {
  type: "SignMessageRequest";
  /** Raw data to sign */
  data: Uint8Array;
  /** Protocol ID for BRC-43 invoice number */
  protocolID?: string;
  /** Key ID for BRC-43 invoice number */
  keyID?: string;
  /** If true, sign with identity key; otherwise derive key */
  useIdentityKey?: boolean;
}

export interface SignMessageResponse {
  type: "SignMessageResponse";
  signature: Uint8Array;
  publicKey: string;
}
```

---

### 4.4 Identity Operations (Phase 1)

```typescript
export interface GetIdentityRequest {
  type: "GetIdentityRequest";
}

export interface GetIdentityResponse {
  type: "GetIdentityResponse";
  publicKey: string;
  petname: string;
  avatarSvg: string;
  shortId: string;
}

export interface GenerateIdenticonRequest {
  type: "GenerateIdenticonRequest";
  /** Public key to generate identicon from */
  publicKey: string;
  /** Size in pixels (default: 64) */
  size?: number;
}

export interface GenerateIdenticonResponse {
  type: "GenerateIdenticonResponse";
  /** SVG markup for identicon */
  svg: string;
}
```

---

### 4.5 Audit Log Operations (Phase 1)

```typescript
export interface GetAuditLogRequest {
  type: "GetAuditLogRequest";
  /** Filter by operation type */
  operation?: string;
  /** Start timestamp (ISO 8601) */
  startTime?: string;
  /** End timestamp (ISO 8601) */
  endTime?: string;
  /** Maximum number of entries to return */
  limit?: number;
}

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

export interface GetAuditLogResponse {
  type: "GetAuditLogResponse";
  entries: AuditLogEntry[];
}
```

---

### 4.6 Union Types

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

## 5. TypeScript Frontend Types

### 5.1 Crypto Types

**Location:** `src/types/crypto.ts`

```typescript
export interface Brc42DerivationParams {
  protocolID: string;
  keyID: string;
  counterparty: string;
  securityLevel?: number;
}

export interface InvoiceNumber {
  full: string; // "<securityLevel>-<protocolID>-<keyID>"
  securityLevel: number;
  protocolID: string;
  keyID: string;
}

export interface SigningRequest {
  data: string | Uint8Array;
  derivation?: Brc42DerivationParams;
  protocol?: string;
}

export interface SigningResponse {
  signature: Uint8Array;
  publicKey: string;
  keyType: "identity" | "derived";
}

export interface VerificationRequest {
  data: string | Uint8Array;
  signature: Uint8Array;
  publicKey: string;
}

export interface VerificationResponse {
  valid: boolean;
  error?: string;
}

export interface EncryptionRequest {
  plaintext: string | Uint8Array;
  derivation: Brc42DerivationParams;
  algorithm?: string;
}

export interface EncryptionResponse {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag?: Uint8Array;
  algorithm: string;
}

export interface DecryptionRequest {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag?: Uint8Array;
  derivation: Brc42DerivationParams;
  algorithm?: string;
}

export interface DecryptionResponse {
  plaintext: Uint8Array;
  authenticated: boolean;
}

export interface PublicKeyInfo {
  key: string;
  type: "identity" | "derived";
  derivation?: Brc42DerivationParams;
}

export interface CryptoError {
  code:
    | "ERR_KEYCHAIN_UNAVAILABLE"
    | "ERR_KEY_NOT_FOUND"
    | "ERR_INVALID_KEY"
    | "ERR_INVALID_SIGNATURE"
    | "ERR_DERIVATION_FAILED"
    | "ERR_SIGNING_FAILED"
    | "ERR_VERIFICATION_FAILED"
    | "ERR_ENCRYPTION_FAILED"
    | "ERR_DECRYPTION_FAILED"
    | "ERR_INVALID_COUNTERPARTY";
  message: string;
  details?: Record<string, unknown>;
}
```

---

### 5.2 Audit Types

**Location:** `src/types/audit.ts`

```typescript
export type AuditOperation =
  | "sign"
  | "verify"
  | "derive_key"
  | "get_public_key"
  | "encrypt"
  | "decrypt"
  | "check_subscription"
  | "get_identity"
  | "generate_identicon";

export interface AuditLogEntry {
  timestamp: string;
  operation: AuditOperation;
  protocolID?: string;
  keyID?: string;
  counterparty?: string;
  payloadHash?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  operation?: AuditOperation;
  protocolID?: string;
  keyID?: string;
  counterparty?: string;
  success?: boolean;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  hasMore: boolean;
}

export interface AuditStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number; // 0-1
  operationCounts: Record<AuditOperation, number>;
  lastOperationTime?: string;
  firstOperationTime?: string;
}

export interface AuditLogFileFormat {
  version: number;
  entries: AuditLogEntry[];
}
```

---

## 6. Type Export Barrel

**Location:** `src/types/index.ts`

```typescript
// IPC Types
export type {
  SignRequest,
  SignResponse,
  VerifyRequest,
  VerifyResponse,
  GetPublicKeyRequest,
  GetPublicKeyResponse,
  CheckSubscriptionRequest,
  CheckSubscriptionResponse,
  EncryptRequest,
  EncryptResponse,
  DecryptRequest,
  DecryptResponse,
  DeriveKeyRequest,
  DeriveKeyResponse,
  SignMessageRequest,
  SignMessageResponse,
  GetIdentityRequest,
  GetIdentityResponse,
  GenerateIdenticonRequest,
  GenerateIdenticonResponse,
  GetAuditLogRequest,
  GetAuditLogResponse,
  AuditLogEntry as IpcAuditLogEntry,
  AuthorizeSpendRequest,
  AuthorizeSpendResponse,
  CryptoRequest,
  CryptoResponse,
  CryptoMessage,
} from "./ipc";

// Crypto Types
export type {
  Brc42DerivationParams,
  InvoiceNumber,
  SigningRequest,
  SigningResponse,
  VerificationRequest,
  VerificationResponse,
  EncryptionRequest,
  EncryptionResponse,
  DecryptionRequest,
  DecryptionResponse,
  PublicKeyInfo,
  CryptoError,
} from "./crypto";

// Audit Types
export type {
  AuditOperation,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogResponse,
  AuditStats,
  AuditLogFileFormat,
} from "./audit";

// Identity Types
export type {
  Petname,
  PetnameWordLists,
  PetnameConfig,
  IdenticonConfig,
  IdenticonResult,
  Identity,
  IdentityDisplay,
  Brc42Context,
  DerivedIdentity,
} from "./identity";

// Subscription Types
export type {
  SubscriptionState,
  UtxoRef,
  CachedProof,
  SubscriptionInfo,
  SubscriptionStatus,
} from "./subscription";
export { SUBSCRIPTION_BEHAVIORS } from "./subscription";

// Channel Types
export type {
  ChannelName,
  ChannelSettings,
  ChannelConfig,
  WizardStep,
  WizardState,
} from "./channels";

// Access Types
export type {
  PermissionLevel,
  PermissionCapabilities,
  OwnerPermissions,
  MemberPermissions,
  GuestPermissions,
  AuthorizedUser,
  AuthorizedUsersStore,
  InvitationPayload,
} from "./access";
export { PERMISSION_MATRIX } from "./access";

// Identity Setup Types
export type {
  IdentitySetupProps,
  IdentitySetupStepProps,
  SetupIdentity,
  WelcomeStepProps,
  GenerateKeyStepProps,
  ReviewIdentityStepProps,
  BackupKeyStepProps,
  ConfirmBackupStepProps,
  CompleteStepProps,
  IdentityCardProps,
  IdenticonProps,
  PetnameDisplayProps,
  RecoveryPhraseDisplayProps,
  RecoveryPhraseInputProps,
  ImportKeyProps,
  ImportKeyFormProps,
} from "./identity-setup";
export { IdentitySetupStep } from "./identity-setup";

// API Types
export type {
  BsvAuthHeaders,
  ChatRole,
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionChunkChoice,
  ChatCompletionChunk,
  ChatCompletionChoice,
  ChatCompletionResponse,
  IdentityResponse,
  SubscriptionUtxo,
  SubscriptionResponse,
  SubscriptionStatusResponse,
  UserEntry,
  UserRecord,
  UsersResponse,
  InviteRequest,
  InviteResponse,
  DeleteUserResponse,
  RedeemInviteRequest,
  RedeemInviteResponse,
  ChannelStatus,
  ChannelEntry,
  ChannelsResponse,
  UpdateChannelRequest,
  ChannelUpdateRequest,
  UpdateChannelResponse,
  HealthResponse,
  ErrorCode,
  ApiError,
  ErrorResponse,
} from "./api";
export { ErrorCodeEnum, ERROR_HTTP_STATUS } from "./api";
```

**Usage in Frontend:**

```typescript
import type { SignRequest, CryptoError } from "@/types";
```

---

## 7. BRC Specifications Alignment

### 7.1 BRC-42: BSV Key Derivation Scheme

**Reference:** https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md

**Implementation:**
- Security Level: 2 (default for EdwinPAI)
- Protocol ID: "edwinpai-chat", "edwinpai-auth", etc.
- Key ID: Context-specific (e.g., "encryption-key", "signing-key")
- Invoice Number Format: `<security_level>-<protocol_id>-<key_id>`

**Test Vectors:** Phase 1 includes 10 BRC-42 test vectors that MUST pass (non-negotiable).

---

### 7.2 BRC-43: Invoice Number Scheme

**Reference:** https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0043.md

**Implementation:**
- Invoice numbers are constructed from BRC-42 derivation parameters
- Format: `2-edwinpai-<key_id>` (security level 2)

---

### 7.3 BRC-2: Encryption/Decryption

**Reference:** https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0002.md

**Implementation:**
- Algorithm: AES-256-GCM (Authenticated Encryption)
- Key Derivation: BRC-42 derived keys
- IV: 16 bytes (randomly generated per encryption)
- Auth Tag: 16 bytes (GCM mode)

---

### 7.4 BRC-103: Message Signatures

**Reference:** https://github.com/bitcoin-sv/BRCs

**Implementation:**
- Hash Algorithm: SHA-256
- Signature Algorithm: ECDSA over secp256k1
- Encoding: DER format
- Identicons: 5x5 deterministic grid, colors derived from SHA-256(public_key)

---

## Summary

This document defines the complete type system for the EdwinPAI Desktop crypto domain, including:

- **14 Rust Core Types** (Keypair, Keychain, DerivationParams, SigningRequest, etc.)
- **3 Rust Error Enums** (KeychainError, DerivationError, SigningError)
- **5 Rust Traits** (CryptoDomain, KeychainAccess, AuditLogger, IdentityGenerator, Brc42KeyDerivation)
- **21 TypeScript IPC Contracts** (Request/Response pairs for all crypto operations)
- **30+ TypeScript Frontend Types** (Crypto, Audit, Identity, etc.)
- **1 Unified Type Export Barrel** (`src/types/index.ts`)

All types are aligned with BRC-42, BRC-43, BRC-2, and BRC-103 specifications, ensuring compatibility with the BSV blockchain ecosystem.

**Next Steps:**
- Implement BRC-42 key derivation algorithm in `src-tauri/src/crypto_domain/brc42.rs`
- Implement OS keychain integration in `src-tauri/src/crypto_domain/keychain.rs`
- Wire up Tauri IPC commands to call crypto domain traits
- Write 80 automated tests (35 TS + 45 Rust) per `PHASE1_TEST_COVERAGE.md`
- Verify all 10 BRC-42 test vectors pass

---

**Document Version:** 1.0
**Last Updated:** 2026-02-09
**Author:** Claude (Sonnet 4.5) + EdwinPAI Desktop Team
