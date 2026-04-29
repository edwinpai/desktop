// Crypto Domain trait contracts (Phase 1)
//
// These traits define the interface for the Crypto Domain capability.
// Implementations must handle BRC-42 key derivation, signing, verification,
// encryption, decryption, identity operations, and audit logging per SPEC §3.

use super::types::*;

// --- Main Crypto Domain Trait ---

/// CryptoDomain capability trait
///
/// This trait defines the contract for all cryptographic operations in the
/// Crypto Domain. All operations are audited per SPEC §3.6.
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
    ///
    /// Uses the master identity private key and the counterparty's public key
    /// to derive a shared child key per BRC-42.
    fn derive_public_key(&self, params: &Brc42Params) -> CryptoResult<String>;

    /// Derive a private key using BRC-42 (for decryption/signing)
    ///
    /// Returns the derived private key (hex-encoded). This is NOT exposed via
    /// IPC; it's only used internally for signing/decryption operations.
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

// --- Keychain Trait ---

/// Keychain access trait
///
/// Abstracts OS-specific keychain operations. Only the Crypto Domain
/// has access to the keychain per SPEC §3.4.
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

// --- Audit Logger Trait ---

/// Audit log writer trait
///
/// Append-only audit log per SPEC §3.6. Logs are stored in
/// ~/.edwinpai/audit/crypto.log and are readable by the AI Domain.
pub trait AuditLogger: Send + Sync {
    /// Append an entry to the audit log
    fn append(&self, entry: AuditLogEntry) -> CryptoResult<()>;

    /// Read entries from the audit log
    fn read(&self, limit: Option<usize>) -> CryptoResult<Vec<AuditLogEntry>>;

    /// Get the total number of logged operations
    fn count(&self) -> CryptoResult<usize>;
}

// --- Identity Generator Trait ---

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

// --- BRC-42 Key Derivation Trait ---

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
