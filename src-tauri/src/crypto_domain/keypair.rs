// Keypair generation and management
//
// Provides secp256k1 keypair generation, serialization, and basic operations.

use secp256k1::{PublicKey, Secp256k1, SecretKey};

use super::types::{CryptoError, CryptoErrorCode, CryptoResult, Keypair};

/// Generate a new random secp256k1 keypair
///
/// Uses cryptographically secure random number generation.
/// Returns a Keypair struct with both private key (32 bytes) and compressed public key (33 bytes).
pub fn generate_keypair() -> CryptoResult<Keypair> {
    let secp = Secp256k1::new();

    // Generate random secret key
    let secret_key = SecretKey::new(&mut secp256k1::rand::thread_rng());

    // Derive public key
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);

    Ok(Keypair {
        private_key: secret_key.secret_bytes(),
        public_key: public_key.serialize(),
    })
}

/// Create a Keypair from an existing private key (hex-encoded)
pub fn keypair_from_private_key(private_key_hex: &str) -> CryptoResult<Keypair> {
    let secp = Secp256k1::new();

    // Parse private key
    let bytes = hex::decode(private_key_hex).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid private key hex: {}", e),
    })?;

    let secret_key = SecretKey::from_slice(&bytes).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid private key: {}", e),
    })?;

    // Derive public key
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);

    Ok(Keypair {
        private_key: secret_key.secret_bytes(),
        public_key: public_key.serialize(),
    })
}

/// Validate a public key (hex-encoded)
pub fn validate_public_key(public_key_hex: &str) -> CryptoResult<bool> {
    let bytes = hex::decode(public_key_hex).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid public key hex: {}", e),
    })?;

    match PublicKey::from_slice(&bytes) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Get compressed public key from private key (hex-encoded)
pub fn public_key_from_private(private_key_hex: &str) -> CryptoResult<String> {
    let keypair = keypair_from_private_key(private_key_hex)?;
    Ok(keypair.public_key_hex())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair() {
        let keypair = generate_keypair().unwrap();

        // Private key should be 32 bytes
        assert_eq!(keypair.private_key.len(), 32);

        // Public key should be 33 bytes (compressed)
        assert_eq!(keypair.public_key.len(), 33);

        // Public key should start with 02 or 03 (compressed format)
        assert!(keypair.public_key[0] == 0x02 || keypair.public_key[0] == 0x03);
    }

    #[test]
    fn test_keypair_from_private_key() {
        // Known test vector: private key = 1
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let expected_pubkey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

        let keypair = keypair_from_private_key(private_key).unwrap();

        assert_eq!(keypair.public_key_hex(), expected_pubkey);
    }

    #[test]
    fn test_validate_public_key() {
        // Valid compressed public key
        let valid_pubkey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
        assert!(validate_public_key(valid_pubkey).unwrap());

        // Invalid public key (wrong length)
        let invalid_pubkey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f817";
        assert!(!validate_public_key(invalid_pubkey).unwrap());

        // Invalid hex
        let invalid_hex = "not_hex";
        assert!(validate_public_key(invalid_hex).is_err());
    }

    #[test]
    fn test_public_key_from_private() {
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let expected_pubkey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

        let pubkey = public_key_from_private(private_key).unwrap();

        assert_eq!(pubkey, expected_pubkey);
    }

    #[test]
    fn test_generate_multiple_unique_keypairs() {
        let keypair1 = generate_keypair().unwrap();
        let keypair2 = generate_keypair().unwrap();

        // Different keypairs should have different keys
        assert_ne!(keypair1.private_key, keypair2.private_key);
        assert_ne!(keypair1.public_key, keypair2.public_key);
    }

    #[test]
    fn test_invalid_private_key() {
        // Invalid hex
        let result = keypair_from_private_key("not_hex");
        assert!(result.is_err());

        // Invalid length
        let result = keypair_from_private_key("0000");
        assert!(result.is_err());

        // All zeros (invalid)
        let result = keypair_from_private_key(
            "0000000000000000000000000000000000000000000000000000000000000000",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_keypair_public_key_format() {
        let keypair = generate_keypair().unwrap();

        // Public key should be compressed (33 bytes)
        assert_eq!(keypair.public_key.len(), 33);

        // First byte must be 0x02 or 0x03 (compressed format)
        assert!(
            keypair.public_key[0] == 0x02 || keypair.public_key[0] == 0x03,
            "Public key must start with 0x02 or 0x03 for compressed format"
        );

        // Hex encoding should be 66 characters (33 bytes * 2)
        let hex = keypair.public_key_hex();
        assert_eq!(hex.len(), 66);
        assert!(hex.starts_with("02") || hex.starts_with("03"));
    }
}
