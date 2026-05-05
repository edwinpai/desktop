// Main CryptoDomain implementation
//
// Orchestrates all crypto operations: key derivation, signing, identity
// generation, and audit logging.

use secp256k1::{PublicKey, Secp256k1, SecretKey};
use std::sync::Arc;

use super::audit::{create_audit_entry, FileAuditLogger};
use super::brc42::Brc42Deriver;
use super::identity::IdentityGen;
use super::keychain::PlatformKeychain;
use super::signing::{sign_data, verify_signature};
use super::traits::{AuditLogger, Brc42KeyDerivation, CryptoDomain, IdentityGenerator, KeychainAccess};
use super::types::*;

const SERVICE_NAME: &str = "com.edwinpai.desktop";
const MASTER_KEY_ACCOUNT: &str = "master-identity-key";

pub struct EdwinPAICryptoDomain {
    keychain: Arc<dyn KeychainAccess>,
    audit_log: Arc<dyn AuditLogger>,
    key_deriver: Arc<dyn Brc42KeyDerivation>,
    identity_gen: Arc<dyn IdentityGenerator>,
}

impl EdwinPAICryptoDomain {
    pub fn new() -> CryptoResult<Self> {
        Ok(Self {
            keychain: Arc::new(PlatformKeychain),
            audit_log: Arc::new(FileAuditLogger::new()?),
            key_deriver: Arc::new(Brc42Deriver),
            identity_gen: Arc::new(IdentityGen),
        })
    }

    /// Get the fallback key file path (~/.edwinpai/identity-key)
    fn key_file_path() -> Option<std::path::PathBuf> {
        dirs::home_dir().map(|h| h.join(".edwinpai").join("identity-key"))
    }

    /// Read master key from fallback file
    fn read_key_file() -> Option<String> {
        let path = Self::key_file_path()?;
        std::fs::read_to_string(&path).ok().and_then(|s| {
            let trimmed = s.trim().to_string();
            if trimmed.len() == 64 { Some(trimmed) } else { None }
        })
    }

    /// Write master key to fallback file (restricted permissions)
    fn write_key_file(key: &str) -> CryptoResult<()> {
        if let Some(path) = Self::key_file_path() {
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(&path, key).map_err(|e| CryptoError {
                code: CryptoErrorCode::KeychainUnavailable,
                message: format!("Failed to write key file: {}", e),
            })?;
            // Restrict permissions on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
            }
        }
        Ok(())
    }

    /// Get or generate master private key
    ///
    /// Priority: keychain → file fallback → generate new
    /// Stores in both keychain AND file for resilience
    fn get_master_key(&self) -> CryptoResult<String> {
        // 1. Try keychain
        if let Ok(key) = self.keychain.get_key(SERVICE_NAME, MASTER_KEY_ACCOUNT) {
            return Ok(key);
        }

        // 2. Try file fallback (handles keychain unavailable on Linux)
        if let Some(key) = Self::read_key_file() {
            // Try to store in keychain for next time
            let _ = self.keychain.store_key(SERVICE_NAME, MASTER_KEY_ACCOUNT, &key);
            return Ok(key);
        }

        // 3. Generate new key
        let secp = Secp256k1::new();
        let (secret_key, _) = secp.generate_keypair(&mut secp256k1::rand::thread_rng());
        let key_hex = hex::encode(secret_key.secret_bytes());

        // Store in both keychain AND file
        let _ = self.keychain.store_key(SERVICE_NAME, MASTER_KEY_ACCOUNT, &key_hex);
        Self::write_key_file(&key_hex)?;

        Ok(key_hex)
    }

    /// Get master private key (for BRC-103 authentication)
    /// WARNING: This exposes the master private key. Only use for BRC-103 handshakes.
    pub fn get_master_private_key(&self) -> CryptoResult<String> {
        self.get_master_key()
    }

    /// Get master public key
    pub fn get_master_public_key(&self) -> CryptoResult<String> {
        let master_key = self.get_master_key()?;
        let secret_key = SecretKey::from_slice(&hex::decode(&master_key).map_err(|e| CryptoError {
            code: CryptoErrorCode::InvalidKey,
            message: format!("Invalid master key: {}", e),
        })?)
        .map_err(|e| CryptoError {
            code: CryptoErrorCode::InvalidKey,
            message: format!("Invalid master key: {}", e),
        })?;

        let secp = Secp256k1::new();
        let public_key = PublicKey::from_secret_key(&secp, &secret_key);

        Ok(hex::encode(public_key.serialize()))
    }
}

impl CryptoDomain for EdwinPAICryptoDomain {
    fn get_identity(&self) -> CryptoResult<Identity> {
        let result: CryptoResult<Identity> = (|| {
            let public_key = self.get_master_public_key()?;
            let petname = self.identity_gen.generate_petname(&public_key)?;
            let avatar_svg = self.identity_gen.generate_identicon(&public_key, 64)?;
            let short_id = self.identity_gen.generate_short_id(&public_key)?;

            Ok(Identity {
                public_key,
                petname: petname.display,
                avatar_svg,
                short_id,
            })
        })();

        // Audit log
        let entry = match &result {
            Ok(_) => create_audit_entry(AuditOperation::GetIdentity, true, None),
            Err(e) => create_audit_entry(AuditOperation::GetIdentity, false, Some(e.message.clone())),
        };
        let _ = self.audit_log.append(entry);

        result
    }

    fn generate_identicon(&self, public_key: &str, size: u32) -> CryptoResult<String> {
        let result = self.identity_gen.generate_identicon(public_key, size);

        // Audit log
        let entry = match &result {
            Ok(_) => create_audit_entry(AuditOperation::GenerateIdenticon, true, None),
            Err(e) => create_audit_entry(AuditOperation::GenerateIdenticon, false, Some(e.message.clone())),
        };
        let _ = self.audit_log.append(entry);

        result
    }

    fn derive_petname(&self, public_key: &str) -> CryptoResult<Petname> {
        self.identity_gen.generate_petname(public_key)
    }

    fn derive_public_key(&self, params: &Brc42Params) -> CryptoResult<String> {
        let result = (|| {
            let master_key = self.get_master_key()?;
            let invoice = params.invoice_number();
            self.key_deriver.derive_public_key(&master_key, &params.counterparty, &invoice)
        })();

        // Audit log
        let mut entry = match &result {
            Ok(_) => create_audit_entry(AuditOperation::DeriveKey, true, None),
            Err(e) => create_audit_entry(AuditOperation::DeriveKey, false, Some(e.message.clone())),
        };
        entry.protocol_id = Some(params.protocol_id.clone());
        entry.key_id = Some(params.key_id.clone());
        entry.counterparty = Some(params.counterparty.clone());
        let _ = self.audit_log.append(entry);

        result
    }

    fn derive_private_key(&self, params: &Brc42Params) -> CryptoResult<String> {
        let master_key = self.get_master_key()?;
        let invoice = params.invoice_number();
        self.key_deriver.derive_private_key(&master_key, &params.counterparty, &invoice)
    }

    fn sign(&self, request: &SignRequest) -> CryptoResult<SignResponse> {
        let result = (|| {
            let key = if let Some(ref derivation) = request.derivation {
                // Use derived key
                self.derive_private_key(derivation)?
            } else {
                // Use master identity key
                self.get_master_key()?
            };

            sign_data(&request.data, &key)
        })();

        // Audit log
        let mut entry = match &result {
            Ok(_) => create_audit_entry(AuditOperation::Sign, true, None),
            Err(e) => create_audit_entry(AuditOperation::Sign, false, Some(e.message.clone())),
        };

        if let Some(ref derivation) = request.derivation {
            entry.protocol_id = Some(derivation.protocol_id.clone());
            entry.key_id = Some(derivation.key_id.clone());
            entry.counterparty = Some(derivation.counterparty.clone());
        }

        // Hash the payload for audit
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(&request.data);
        entry.payload_hash = Some(hex::encode(hasher.finalize()));

        let _ = self.audit_log.append(entry);

        result
    }

    fn verify(&self, request: &VerifyRequest) -> CryptoResult<VerifyResponse> {
        let result = verify_signature(request);

        // Audit log
        let mut entry = match &result {
            Ok(_) => create_audit_entry(AuditOperation::Verify, true, None),
            Err(e) => create_audit_entry(AuditOperation::Verify, false, Some(e.message.clone())),
        };

        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(&request.data);
        entry.payload_hash = Some(hex::encode(hasher.finalize()));

        let _ = self.audit_log.append(entry);

        result
    }

    fn encrypt(&self, _request: &EncryptRequest) -> CryptoResult<EncryptResponse> {
        // TODO: Phase 2 - BRC-2 encryption
        Err(CryptoError {
            code: CryptoErrorCode::EncryptionFailed,
            message: "Encryption not yet implemented".to_string(),
        })
    }

    fn decrypt(&self, _request: &DecryptRequest) -> CryptoResult<DecryptResponse> {
        // TODO: Phase 2 - BRC-2 decryption
        Err(CryptoError {
            code: CryptoErrorCode::DecryptionFailed,
            message: "Decryption not yet implemented".to_string(),
        })
    }

    fn log_operation(&self, entry: AuditLogEntry) -> CryptoResult<()> {
        self.audit_log.append(entry)
    }

    fn read_audit_log(&self, limit: Option<usize>) -> CryptoResult<Vec<AuditLogEntry>> {
        self.audit_log.read(limit)
    }
}

impl Default for EdwinPAICryptoDomain {
    fn default() -> Self {
        Self::new().expect("Failed to initialize CryptoDomain")
    }
}

/// Helper function for channel encryption (uses BRC-42 key derivation)
///
/// # Arguments
/// * `plaintext` - Data to encrypt
/// * `protocol_id` - Protocol identifier (e.g., "channel-storage")
/// * `key_id` - Key identifier (e.g., channel name)
/// * `counterparty` - Counterparty public key (use "self" for local encryption)
///
/// # Returns
/// Encrypted ciphertext as bytes
pub async fn encrypt_data(
    plaintext: &[u8],
    protocol_id: &str,
    key_id: &str,
    counterparty: &str,
) -> Result<Vec<u8>, String> {
    use aes_gcm::{
        aead::{Aead, KeyInit},
        Aes256Gcm, Nonce,
    };
    use sha2::{Digest, Sha256};

    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.message)?;

    // Resolve "self" to actual public key for local encryption
    let resolved_counterparty = if counterparty == "self" {
        domain
            .get_master_public_key()
            .map_err(|e| format!("Failed to get own public key: {}", e.message))?
    } else {
        counterparty.to_string()
    };

    // Derive encryption key using BRC-42
    let params = Brc42Params {
        security_level: 2,
        protocol_id: protocol_id.to_string(),
        key_id: key_id.to_string(),
        counterparty: resolved_counterparty,
    };

    let derived_key_hex = domain
        .derive_private_key(&params)
        .map_err(|e| format!("Key derivation failed: {}", e.message))?;

    // Use SHA-256 of derived key as AES-256 key (32 bytes)
    let mut hasher = Sha256::new();
    hasher.update(hex::decode(&derived_key_hex).map_err(|e| e.to_string())?);
    let aes_key = hasher.finalize();

    // Generate random nonce (12 bytes for AES-GCM)
    use rand::RngCore;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt with AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(&aes_key).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Prepend nonce to ciphertext (format: nonce || ciphertext)
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Helper function for channel decryption (uses BRC-42 key derivation)
///
/// # Arguments
/// * `ciphertext` - Encrypted data (nonce || ciphertext format)
/// * `protocol_id` - Protocol identifier (must match encryption)
/// * `key_id` - Key identifier (must match encryption)
/// * `counterparty` - Counterparty public key (must match encryption)
///
/// # Returns
/// Decrypted plaintext as bytes
pub async fn decrypt_data(
    ciphertext: &[u8],
    protocol_id: &str,
    key_id: &str,
    counterparty: &str,
) -> Result<Vec<u8>, String> {
    use aes_gcm::{
        aead::{Aead, KeyInit},
        Aes256Gcm, Nonce,
    };
    use sha2::{Digest, Sha256};

    if ciphertext.len() < 12 {
        return Err("Ciphertext too short (missing nonce)".to_string());
    }

    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.message)?;

    // Resolve "self" to actual public key for local decryption
    let resolved_counterparty = if counterparty == "self" {
        domain
            .get_master_public_key()
            .map_err(|e| format!("Failed to get own public key: {}", e.message))?
    } else {
        counterparty.to_string()
    };

    // Derive decryption key using BRC-42
    let params = Brc42Params {
        security_level: 2,
        protocol_id: protocol_id.to_string(),
        key_id: key_id.to_string(),
        counterparty: resolved_counterparty,
    };

    let derived_key_hex = domain
        .derive_private_key(&params)
        .map_err(|e| format!("Key derivation failed: {}", e.message))?;

    // Use SHA-256 of derived key as AES-256 key (32 bytes)
    let mut hasher = Sha256::new();
    hasher.update(hex::decode(&derived_key_hex).map_err(|e| e.to_string())?);
    let aes_key = hasher.finalize();

    // Extract nonce (first 12 bytes) and ciphertext (rest)
    let nonce = Nonce::from_slice(&ciphertext[..12]);
    let encrypted_data = &ciphertext[12..];

    // Decrypt with AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(&aes_key).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(nonce, encrypted_data)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_identity() {
        let domain = EdwinPAICryptoDomain::new().unwrap();
        let identity = domain.get_identity().unwrap();

        assert!(!identity.public_key.is_empty());
        assert!(!identity.petname.is_empty());
        assert!(!identity.avatar_svg.is_empty());
        assert!(identity.short_id.starts_with("edw:"));
    }

    #[test]
    fn test_sign_and_verify() {
        let domain = EdwinPAICryptoDomain::new().unwrap();
        let data = b"test message";

        let sign_request = SignRequest {
            data: data.to_vec(),
            derivation: None,
        };

        let sign_response = domain.sign(&sign_request).unwrap();

        let verify_request = VerifyRequest {
            data: data.to_vec(),
            signature: sign_response.signature,
            public_key: sign_response.public_key,
        };

        let verify_response = domain.verify(&verify_request).unwrap();
        assert!(verify_response.valid);
    }
}
