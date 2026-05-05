// Crypto Domain type definitions for Phase 1
//
// These types define the Rust-side contracts for BRC-42 key derivation,
// BRC-103 signing, identity operations, and audit logging.

use serde::{Deserialize, Serialize};

// --- Core Cryptographic Types ---

/// Secp256k1 keypair (SPEC §3.3.1, BRC-42)
#[derive(Debug, Clone)]
pub struct Keypair {
    /// Private key (32 bytes)
    pub private_key: [u8; 32],
    /// Compressed public key (33 bytes)
    pub public_key: [u8; 33],
}

impl Keypair {
    /// Hex-encoded public key
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.public_key)
    }
}

/// Keychain storage (SPEC §3.4)
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

// --- BRC-42 Derivation Parameters ---

/// BRC-42 key derivation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Brc42DerivationParams {
    /// Security level (default: 2)
    pub security_level: u8,
    /// Protocol ID (e.g., "edwinpai", "edwinpai-auth")
    pub protocol_id: String,
    /// Key ID (context-specific)
    pub key_id: String,
    /// Counterparty public key (compressed, 33 bytes, hex-encoded)
    pub counterparty: String,
}

impl Brc42DerivationParams {
    /// Construct invoice number per BRC-43
    pub fn invoice_number(&self) -> String {
        format!("{}-{}-{}", self.security_level, self.protocol_id, self.key_id)
    }

    /// Construct cache key for derived key lookup
    pub fn cache_key(&self) -> String {
        format!("{}:{}:{}", self.protocol_id, self.key_id, self.counterparty)
    }
}

// --- BRC-42 Derivation Parameters (legacy alias) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
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

// --- BRC-103 Identicon Parameters ---

/// BRC-103 identicon generation parameters
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

fn default_identicon_size() -> u32 {
    64
}

fn default_identicon_grid() -> u32 {
    5
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

// --- Identity Types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Petname {
    pub adjective: String,
    pub noun: String,
    pub display: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

// --- Signing Types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignRequest {
    /// Raw data to sign
    pub data: Vec<u8>,
    /// Optional BRC-42 derivation parameters
    pub derivation: Option<Brc42Params>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignResponse {
    /// DER-encoded ECDSA signature
    pub signature: Vec<u8>,
    /// Public key used (compressed, hex-encoded)
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyRequest {
    /// Original data
    pub data: Vec<u8>,
    /// DER-encoded ECDSA signature
    pub signature: Vec<u8>,
    /// Public key to verify against (compressed, hex-encoded)
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResponse {
    /// Whether signature is valid
    pub valid: bool,
}

// --- Encryption Types (BRC-2) ---

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
    /// Initialization vector
    pub iv: Vec<u8>,
    /// Authentication tag (for AEAD modes)
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

// --- Audit Log Types (SPEC §3.6) ---

/// Audit event (before persistence)
#[derive(Debug, Clone)]
pub struct AuditEvent {
    /// Operation type
    pub operation: AuditOperation,
    /// Protocol ID (if applicable)
    pub protocol_id: Option<String>,
    /// Key ID (if applicable)
    pub key_id: Option<String>,
    /// Counterparty (if applicable)
    pub counterparty: Option<String>,
    /// Raw payload (will be hashed for storage)
    pub payload: Option<Vec<u8>>,
    /// Whether operation succeeded
    pub success: bool,
    /// Error message if success=false
    pub error: Option<String>,
}

impl AuditEvent {
    /// Convert to AuditLogEntry with timestamp and payload hash
    pub fn to_log_entry(&self) -> AuditLogEntry {
        use sha2::{Digest, Sha256};

        let timestamp = chrono::Utc::now().to_rfc3339();
        let payload_hash = self.payload.as_ref().map(|p| {
            let mut hasher = Sha256::new();
            hasher.update(p);
            hex::encode(hasher.finalize())
        });

        AuditLogEntry {
            timestamp,
            operation: self.operation,
            protocol_id: self.protocol_id.clone(),
            key_id: self.key_id.clone(),
            counterparty: self.counterparty.clone(),
            payload_hash,
            success: self.success,
            error: self.error.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    /// ISO 8601 timestamp
    pub timestamp: String,
    /// Operation type
    pub operation: AuditOperation,
    /// Protocol ID (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol_id: Option<String>,
    /// Key ID (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_id: Option<String>,
    /// Counterparty (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty: Option<String>,
    /// SHA-256 hash of payload
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

impl std::fmt::Display for AuditOperation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Sign => write!(f, "sign"),
            Self::Verify => write!(f, "verify"),
            Self::DeriveKey => write!(f, "derive_key"),
            Self::GetPublicKey => write!(f, "get_public_key"),
            Self::Encrypt => write!(f, "encrypt"),
            Self::Decrypt => write!(f, "decrypt"),
            Self::CheckSubscription => write!(f, "check_subscription"),
            Self::GetIdentity => write!(f, "get_identity"),
            Self::GenerateIdenticon => write!(f, "generate_identicon"),
        }
    }
}

// --- Error Types ---

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

impl std::error::Error for CryptoError {}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

pub type CryptoResult<T> = Result<T, CryptoError>;
