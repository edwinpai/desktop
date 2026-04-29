// BRC-103 signing and verification (SPEC §4.4)
//
// Implements secp256k1 ECDSA signing and verification operations.

use secp256k1::{ecdsa::Signature, Message, PublicKey, SecretKey, Secp256k1};
use sha2::{Digest, Sha256};

use super::types::{CryptoError, CryptoErrorCode, CryptoResult, SignResponse, VerifyRequest, VerifyResponse};

/// Sign data using secp256k1 ECDSA
pub fn sign_data(data: &[u8], private_key_hex: &str) -> CryptoResult<SignResponse> {
    let secp = Secp256k1::new();

    // Parse private key
    let secret_key = parse_secret_key(private_key_hex)?;

    // Hash the data (SHA-256)
    let message_hash = sha256_bytes(data);
    let message = Message::from_digest(message_hash);

    // Sign
    let signature = secp.sign_ecdsa(&message, &secret_key);

    // Get public key
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);

    Ok(SignResponse {
        signature: signature.serialize_der().to_vec(),
        public_key: hex::encode(public_key.serialize()),
    })
}

/// Verify signature using secp256k1 ECDSA
pub fn verify_signature(request: &VerifyRequest) -> CryptoResult<VerifyResponse> {
    let secp = Secp256k1::new();

    // Parse public key
    let public_key = parse_public_key(&request.public_key)?;

    // Parse signature
    let signature = Signature::from_der(&request.signature).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidSignature,
        message: format!("Invalid signature format: {}", e),
    })?;

    // Hash the data
    let message_hash = sha256_bytes(&request.data);
    let message = Message::from_digest(message_hash);

    // Verify
    let valid = secp.verify_ecdsa(&message, &signature, &public_key).is_ok();

    Ok(VerifyResponse { valid })
}

// --- Helpers ---

fn parse_secret_key(hex_str: &str) -> CryptoResult<SecretKey> {
    let bytes = hex::decode(hex_str).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid private key hex: {}", e),
    })?;

    SecretKey::from_slice(&bytes).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid private key: {}", e),
    })
}

fn parse_public_key(hex_str: &str) -> CryptoResult<PublicKey> {
    let bytes = hex::decode(hex_str).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid public key hex: {}", e),
    })?;

    PublicKey::from_slice(&bytes).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid public key: {}", e),
    })
}

fn sha256_bytes(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_and_verify() {
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let data = b"test message";

        // Sign
        let sign_response = sign_data(data, private_key).unwrap();
        assert!(!sign_response.signature.is_empty());
        assert!(!sign_response.public_key.is_empty());

        // Verify
        let verify_request = VerifyRequest {
            data: data.to_vec(),
            signature: sign_response.signature.clone(),
            public_key: sign_response.public_key.clone(),
        };

        let verify_response = verify_signature(&verify_request).unwrap();
        assert!(verify_response.valid);

        // Verify with wrong data should fail
        let bad_verify = VerifyRequest {
            data: b"wrong message".to_vec(),
            signature: sign_response.signature,
            public_key: sign_response.public_key,
        };

        let verify_response = verify_signature(&bad_verify).unwrap();
        assert!(!verify_response.valid);
    }

    #[test]
    fn test_deterministic_signing() {
        // ECDSA with secp256k1 should produce deterministic signatures (RFC 6979)
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let data = b"Hello BSV";

        let sig1 = sign_data(data, private_key).unwrap();
        let sig2 = sign_data(data, private_key).unwrap();

        // Same message + same key should produce identical signature
        assert_eq!(sig1.signature, sig2.signature);
        assert_eq!(sig1.public_key, sig2.public_key);
    }

    #[test]
    fn test_known_public_key_derivation() {
        // Test vector: private key = 1, public key is known generator point
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let expected_pubkey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

        let sign_response = sign_data(b"test", private_key).unwrap();

        assert_eq!(sign_response.public_key, expected_pubkey);
    }

    #[test]
    fn test_signature_der_encoding() {
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let data = b"test message";

        let sign_response = sign_data(data, private_key).unwrap();

        // DER signatures start with 0x30 (SEQUENCE tag)
        assert_eq!(sign_response.signature[0], 0x30);

        // Minimum DER signature length is ~70 bytes, max ~72 bytes
        assert!(sign_response.signature.len() >= 70);
        assert!(sign_response.signature.len() <= 73);
    }

    #[test]
    fn test_verify_invalid_signature_format() {
        let public_key = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
        let data = b"test";

        // Completely invalid DER: not even a SEQUENCE tag
        let verify_request = VerifyRequest {
            data: data.to_vec(),
            signature: vec![0xFF, 0xFF, 0xFF],
            public_key: public_key.to_string(),
        };

        let result = verify_signature(&verify_request);
        assert!(result.is_err(), "Should reject malformed signature");
    }

    #[test]
    fn test_verify_with_wrong_public_key() {
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let wrong_pubkey = "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
        let data = b"test message";

        // Sign with correct key
        let sign_response = sign_data(data, private_key).unwrap();

        // Verify with wrong public key
        let verify_request = VerifyRequest {
            data: data.to_vec(),
            signature: sign_response.signature,
            public_key: wrong_pubkey.to_string(),
        };

        let verify_response = verify_signature(&verify_request).unwrap();
        assert!(!verify_response.valid, "Should fail with wrong public key");
    }

    #[test]
    fn test_sign_empty_payload() {
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let empty_data: &[u8] = &[];

        // Should still produce valid signature for empty message
        let sign_response = sign_data(empty_data, private_key).unwrap();
        assert!(!sign_response.signature.is_empty());

        // Verify it
        let verify_request = VerifyRequest {
            data: empty_data.to_vec(),
            signature: sign_response.signature,
            public_key: sign_response.public_key,
        };

        let verify_response = verify_signature(&verify_request).unwrap();
        assert!(verify_response.valid);
    }

    #[test]
    fn test_sign_large_payload() {
        let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
        // 1MB payload
        let large_data = vec![0x42u8; 1024 * 1024];

        let sign_response = sign_data(&large_data, private_key).unwrap();
        assert!(!sign_response.signature.is_empty());

        // Verify it
        let verify_request = VerifyRequest {
            data: large_data,
            signature: sign_response.signature,
            public_key: sign_response.public_key,
        };

        let verify_response = verify_signature(&verify_request).unwrap();
        assert!(verify_response.valid);
    }

    #[test]
    fn test_invalid_private_key() {
        // Invalid hex
        let result = sign_data(b"test", "not_hex");
        assert!(result.is_err());

        // Invalid length
        let result = sign_data(b"test", "0000");
        assert!(result.is_err());

        // All zeros (invalid private key)
        let result = sign_data(
            b"test",
            "0000000000000000000000000000000000000000000000000000000000000000",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_public_key_format() {
        let verify_request = VerifyRequest {
            data: b"test".to_vec(),
            signature: vec![
                0x30, 0x45, 0x02, 0x21, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x02, 0x20,
                0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
            ],
            public_key: "invalid_hex".to_string(),
        };

        let result = verify_signature(&verify_request);
        assert!(result.is_err(), "Should reject invalid public key");
    }

    #[test]
    fn test_signature_cross_validation() {
        // Create two different keypairs
        let key1 = "0000000000000000000000000000000000000000000000000000000000000001";
        let key2 = "0000000000000000000000000000000000000000000000000000000000000002";

        let data = b"cross validation test";

        // Sign with key1
        let sig1 = sign_data(data, key1).unwrap();

        // Sign with key2
        let sig2 = sign_data(data, key2).unwrap();

        // Signatures should be different
        assert_ne!(sig1.signature, sig2.signature);
        assert_ne!(sig1.public_key, sig2.public_key);

        // Each signature should only verify with its own public key
        let verify1_with1 = verify_signature(&VerifyRequest {
            data: data.to_vec(),
            signature: sig1.signature.clone(),
            public_key: sig1.public_key.clone(),
        })
        .unwrap();
        assert!(verify1_with1.valid);

        let verify1_with2 = verify_signature(&VerifyRequest {
            data: data.to_vec(),
            signature: sig1.signature,
            public_key: sig2.public_key.clone(),
        })
        .unwrap();
        assert!(!verify1_with2.valid);

        let verify2_with2 = verify_signature(&VerifyRequest {
            data: data.to_vec(),
            signature: sig2.signature.clone(),
            public_key: sig2.public_key,
        })
        .unwrap();
        assert!(verify2_with2.valid);
    }
}
