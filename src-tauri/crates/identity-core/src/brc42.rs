// BRC-42 BSV Key Derivation Scheme implementation
//
// Implements the key derivation formulas from SPEC §4.3 and BRC-42 spec.
// Uses secp256k1 elliptic curve operations for ECDH-based key derivation.

use hmac::{Hmac, Mac};
use secp256k1::{ecdh, PublicKey, Scalar, SecretKey};
use sha2::Sha256;

use super::types::{CryptoError, CryptoErrorCode, CryptoResult};
use super::traits::Brc42KeyDerivation;

type HmacSha256 = Hmac<Sha256>;

pub struct Brc42Deriver;

impl Brc42KeyDerivation for Brc42Deriver {
    /// Derive child public key using BRC-42 (sender's perspective)
    ///
    /// Formula (SPEC §4.3):
    /// 1. sharedSecret = senderPrivateKey * recipientPublicKey (ECDH)
    /// 2. hmac = HMAC-SHA256(sharedSecret, invoiceNumber)
    /// 3. scalar = bigEndian(hmac)
    /// 4. point = scalar * G
    /// 5. childPublicKey = point + recipientPublicKey
    fn derive_public_key(
        &self,
        master_private_key: &str,
        counterparty_public_key: &str,
        invoice_number: &str,
    ) -> CryptoResult<String> {
        // Parse keys
        let _secret_key = parse_secret_key(master_private_key)?;
        let counterparty_pubkey = parse_public_key(counterparty_public_key)?;

        // Step 1: Compute ECDH shared secret
        let shared_secret = self.compute_shared_secret(master_private_key, counterparty_public_key)?;

        // Step 2: HMAC-SHA256(sharedSecret, invoiceNumber)
        let mut mac = HmacSha256::new_from_slice(&shared_secret).map_err(|e| CryptoError {
            code: CryptoErrorCode::DerivationFailed,
            message: format!("HMAC initialization failed: {}", e),
        })?;
        mac.update(invoice_number.as_bytes());
        let hmac_result = mac.finalize().into_bytes();

        // Step 3: Convert HMAC to scalar (big-endian)
        let scalar = Scalar::from_be_bytes(hmac_result.into()).map_err(|e| CryptoError {
            code: CryptoErrorCode::DerivationFailed,
            message: format!("Scalar conversion failed: {}", e),
        })?;

        // Step 4: point = scalar * G (generator)
        let point = PublicKey::from_secret_key_global(&SecretKey::from_slice(&scalar.to_be_bytes()).unwrap());

        // Step 5: childPublicKey = point + counterparty_pubkey
        let child_pubkey = point.combine(&counterparty_pubkey).map_err(|e| CryptoError {
            code: CryptoErrorCode::DerivationFailed,
            message: format!("Public key combination failed: {}", e),
        })?;

        Ok(hex::encode(child_pubkey.serialize()))
    }

    /// Derive child private key using BRC-42 (recipient's perspective)
    ///
    /// Formula (SPEC §4.3):
    /// 1. sharedSecret = recipientPrivateKey * senderPublicKey (ECDH)
    /// 2. hmac = HMAC-SHA256(sharedSecret, invoiceNumber)
    /// 3. scalar = bigEndian(hmac)
    /// 4. childPrivateKey = (scalar + recipientPrivateKey) mod N
    fn derive_private_key(
        &self,
        master_private_key: &str,
        counterparty_public_key: &str,
        invoice_number: &str,
    ) -> CryptoResult<String> {
        // Parse master private key
        let secret_key = parse_secret_key(master_private_key)?;

        // Step 1: Compute ECDH shared secret
        let shared_secret = self.compute_shared_secret(master_private_key, counterparty_public_key)?;

        // Step 2: HMAC-SHA256(sharedSecret, invoiceNumber)
        let mut mac = HmacSha256::new_from_slice(&shared_secret).map_err(|e| CryptoError {
            code: CryptoErrorCode::DerivationFailed,
            message: format!("HMAC initialization failed: {}", e),
        })?;
        mac.update(invoice_number.as_bytes());
        let hmac_result = mac.finalize().into_bytes();

        // Step 3: Convert HMAC to scalar (big-endian)
        let hmac_scalar = Scalar::from_be_bytes(hmac_result.into()).map_err(|e| CryptoError {
            code: CryptoErrorCode::DerivationFailed,
            message: format!("Scalar conversion failed: {}", e),
        })?;

        // Step 4: childPrivateKey = (masterPrivateKey + scalar) mod N
        let child_secret = secret_key.add_tweak(&hmac_scalar).map_err(|e| CryptoError {
            code: CryptoErrorCode::DerivationFailed,
            message: format!("Child key derivation failed: {}", e),
        })?;

        Ok(hex::encode(child_secret.secret_bytes()))
    }

    /// Compute ECDH shared secret: privateKey * publicKey
    fn compute_shared_secret(
        &self,
        private_key: &str,
        public_key: &str,
    ) -> CryptoResult<Vec<u8>> {
        let secret_key = parse_secret_key(private_key)?;
        let pub_key = parse_public_key(public_key)?;

        // ECDH: shared_point = private_key * public_key
        // BRC-42 uses the compressed serialized point (33 bytes) as the HMAC key
        // per BSV SDK: sharedSecret.encode(true) = compressed point
        let shared_point_xy = ecdh::shared_secret_point(&pub_key, &secret_key);
        // shared_secret_point returns [x(32) || y(32)] — reconstruct compressed pubkey
        let x = &shared_point_xy[..32];
        let y_is_odd = shared_point_xy[63] & 1 == 1;
        let prefix = if y_is_odd { 0x03u8 } else { 0x02u8 };
        let mut compressed = vec![prefix];
        compressed.extend_from_slice(x);
        Ok(compressed)
    }
}

// --- Helper functions ---

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_brc42_derivation() {
        let deriver = Brc42Deriver;

        // Test with dummy keys (not cryptographically secure, just for structure testing)
        let master_key = "0000000000000000000000000000000000000000000000000000000000000001";
        let counterparty_key = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
        let invoice = "2-edwinpai-test";

        // Test public key derivation
        let result = deriver.derive_public_key(master_key, counterparty_key, invoice);
        assert!(result.is_ok(), "Public key derivation should succeed");

        // Test private key derivation
        let result = deriver.derive_private_key(master_key, counterparty_key, invoice);
        assert!(result.is_ok(), "Private key derivation should succeed");
    }

    // =====================================================================
    // BRC-42 OFFICIAL TEST VECTORS
    // Source: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md#test-vectors
    // =====================================================================

    /// Test vector structure for private key derivation
    struct PrivateKeyTestVector {
        sender_public_key: &'static str,
        recipient_private_key: &'static str,
        invoice_number: &'static str,
        expected_private_key: &'static str,
    }

    /// Test vector structure for public key derivation
    struct PublicKeyTestVector {
        sender_private_key: &'static str,
        recipient_public_key: &'static str,
        invoice_number: &'static str,
        expected_public_key: &'static str,
    }

    /// Official BRC-42 test vectors for private key derivation (5 vectors)
    const PRIVATE_KEY_VECTORS: [PrivateKeyTestVector; 5] = [
        PrivateKeyTestVector {
            sender_public_key: "033f9160df035156f1c48e75eae99914fa1a1546bec19781e8eddb900200bff9d1",
            recipient_private_key: "6a1751169c111b4667a6539ee1be6b7cd9f6e9c8fe011a5f2fe31e03a15e0ede",
            invoice_number: "f3WCaUmnN9U=",
            expected_private_key: "761656715bbfa172f8f9f58f5af95d9d0dfd69014cfdcacc9a245a10ff8893ef",
        },
        PrivateKeyTestVector {
            sender_public_key: "027775fa43959548497eb510541ac34b01d5ee9ea768de74244a4a25f7b60fae8d",
            recipient_private_key: "cab2500e206f31bc18a8af9d6f44f0b9a208c32d5cca2b22acfe9d1a213b2f36",
            invoice_number: "2Ska++APzEc=",
            expected_private_key: "09f2b48bd75f4da6429ac70b5dce863d5ed2b350b6f2119af5626914bdb7c276",
        },
        PrivateKeyTestVector {
            sender_public_key: "0338d2e0d12ba645578b0955026ee7554889ae4c530bd7a3b6f688233d763e169f",
            recipient_private_key: "7a66d0896f2c4c2c9ac55670c71a9bc1bdbdfb4e8786ee5137cea1d0a05b6f20",
            invoice_number: "cN/yQ7+k7pg=",
            expected_private_key: "7114cd9afd1eade02f76703cc976c241246a2f26f5c4b7a3a0150ecc745da9f0",
        },
        PrivateKeyTestVector {
            sender_public_key: "02830212a32a47e68b98d477000bde08cb916f4d44ef49d47ccd4918d9aaabe9c8",
            recipient_private_key: "6e8c3da5f2fb0306a88d6bcd427cbfba0b9c7f4c930c43122a973d620ffa3036",
            invoice_number: "m2/QAsmwaA4=",
            expected_private_key: "f1d6fb05da1225feeddd1cf4100128afe09c3c1aadbffbd5c8bd10d329ef8f40",
        },
        PrivateKeyTestVector {
            sender_public_key: "03f20a7e71c4b276753969e8b7e8b67e2dbafc3958d66ecba98dedc60a6615336d",
            recipient_private_key: "e9d174eff5708a0a41b32624f9b9cc97ef08f8931ed188ee58d5390cad2bf68e",
            invoice_number: "jgpUIjWFlVQ=",
            expected_private_key: "c5677c533f17c30f79a40744b18085632b262c0c13d87f3848c385f1389f79a6",
        },
    ];

    /// Official BRC-42 test vectors for public key derivation (5 vectors)
    const PUBLIC_KEY_VECTORS: [PublicKeyTestVector; 5] = [
        PublicKeyTestVector {
            sender_private_key: "583755110a8c059de5cd81b8a04e1be884c46083ade3f779c1e022f6f89da94c",
            recipient_public_key: "02c0c1e1a1f7d247827d1bcf399f0ef2deef7695c322fd91a01a91378f101b6ffc",
            invoice_number: "IBioA4D/OaE=",
            expected_public_key: "03c1bf5baadee39721ae8c9882b3cf324f0bf3b9eb3fc1b8af8089ca7a7c2e669f",
        },
        PublicKeyTestVector {
            sender_private_key: "2c378b43d887d72200639890c11d79e8f22728d032a5733ba3d7be623d1bb118",
            recipient_public_key: "039a9da906ecb8ced5c87971e9c2e7c921e66ad450fd4fc0a7d569fdb5bede8e0f",
            invoice_number: "PWYuo9PDKvI=",
            expected_public_key: "0398cdf4b56a3b2e106224ff3be5253afd5b72de735d647831be51c713c9077848",
        },
        PublicKeyTestVector {
            sender_private_key: "d5a5f70b373ce164998dff7ecd93260d7e80356d3d10abf928fb267f0a6c7be6",
            recipient_public_key: "02745623f4e5de046b6ab59ce837efa1a959a8f28286ce9154a4781ec033b85029",
            invoice_number: "X9pnS+bByrM=",
            expected_public_key: "0273eec9380c1a11c5a905e86c2d036e70cbefd8991d9a0cfca671f5e0bbea4a3c",
        },
        PublicKeyTestVector {
            sender_private_key: "46cd68165fd5d12d2d6519b02feb3f4d9c083109de1bfaa2b5c4836ba717523c",
            recipient_public_key: "031e18bb0bbd3162b886007c55214c3c952bb2ae6c33dd06f57d891a60976003b1",
            invoice_number: "+ktmYRHv3uQ=",
            expected_public_key: "034c5c6bf2e52e8de8b2eb75883090ed7d1db234270907f1b0d1c2de1ddee5005d",
        },
        PublicKeyTestVector {
            sender_private_key: "7c98b8abd7967485cfb7437f9c56dd1e48ceb21a4085b8cdeb2a647f62012db4",
            recipient_public_key: "03c8885f1e1ab4facd0f3272bb7a48b003d2e608e1619fb38b8be69336ab828f37",
            invoice_number: "PPfDTTcl1ao=",
            expected_public_key: "03304b41cfa726096ffd9d8907fe0835f888869eda9653bca34eb7bcab870d3779",
        },
    ];

    #[test]
    fn test_brc42_private_key_vector_01() {
        let deriver = Brc42Deriver;
        let vector = &PRIVATE_KEY_VECTORS[0];

        let result = deriver
            .derive_private_key(
                vector.recipient_private_key,
                vector.sender_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 01 private key derivation failed");

        assert_eq!(
            result, vector.expected_private_key,
            "BRC-42 vector 01: derived private key mismatch"
        );
    }

    #[test]
    fn test_brc42_private_key_vector_02() {
        let deriver = Brc42Deriver;
        let vector = &PRIVATE_KEY_VECTORS[1];

        let result = deriver
            .derive_private_key(
                vector.recipient_private_key,
                vector.sender_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 02 private key derivation failed");

        assert_eq!(
            result, vector.expected_private_key,
            "BRC-42 vector 02: derived private key mismatch"
        );
    }

    #[test]
    fn test_brc42_private_key_vector_03() {
        let deriver = Brc42Deriver;
        let vector = &PRIVATE_KEY_VECTORS[2];

        let result = deriver
            .derive_private_key(
                vector.recipient_private_key,
                vector.sender_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 03 private key derivation failed");

        assert_eq!(
            result, vector.expected_private_key,
            "BRC-42 vector 03: derived private key mismatch"
        );
    }

    #[test]
    fn test_brc42_private_key_vector_04() {
        let deriver = Brc42Deriver;
        let vector = &PRIVATE_KEY_VECTORS[3];

        let result = deriver
            .derive_private_key(
                vector.recipient_private_key,
                vector.sender_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 04 private key derivation failed");

        assert_eq!(
            result, vector.expected_private_key,
            "BRC-42 vector 04: derived private key mismatch"
        );
    }

    #[test]
    fn test_brc42_private_key_vector_05() {
        let deriver = Brc42Deriver;
        let vector = &PRIVATE_KEY_VECTORS[4];

        let result = deriver
            .derive_private_key(
                vector.recipient_private_key,
                vector.sender_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 05 private key derivation failed");

        assert_eq!(
            result, vector.expected_private_key,
            "BRC-42 vector 05: derived private key mismatch"
        );
    }

    #[test]
    fn test_brc42_public_key_vector_01() {
        let deriver = Brc42Deriver;
        let vector = &PUBLIC_KEY_VECTORS[0];

        let result = deriver
            .derive_public_key(
                vector.sender_private_key,
                vector.recipient_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 01 public key derivation failed");

        assert_eq!(
            result, vector.expected_public_key,
            "BRC-42 vector 01: derived public key mismatch"
        );
    }

    #[test]
    fn test_brc42_public_key_vector_02() {
        let deriver = Brc42Deriver;
        let vector = &PUBLIC_KEY_VECTORS[1];

        let result = deriver
            .derive_public_key(
                vector.sender_private_key,
                vector.recipient_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 02 public key derivation failed");

        assert_eq!(
            result, vector.expected_public_key,
            "BRC-42 vector 02: derived public key mismatch"
        );
    }

    #[test]
    fn test_brc42_public_key_vector_03() {
        let deriver = Brc42Deriver;
        let vector = &PUBLIC_KEY_VECTORS[2];

        let result = deriver
            .derive_public_key(
                vector.sender_private_key,
                vector.recipient_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 03 public key derivation failed");

        assert_eq!(
            result, vector.expected_public_key,
            "BRC-42 vector 03: derived public key mismatch"
        );
    }

    #[test]
    fn test_brc42_public_key_vector_04() {
        let deriver = Brc42Deriver;
        let vector = &PUBLIC_KEY_VECTORS[3];

        let result = deriver
            .derive_public_key(
                vector.sender_private_key,
                vector.recipient_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 04 public key derivation failed");

        assert_eq!(
            result, vector.expected_public_key,
            "BRC-42 vector 04: derived public key mismatch"
        );
    }

    #[test]
    fn test_brc42_public_key_vector_05() {
        let deriver = Brc42Deriver;
        let vector = &PUBLIC_KEY_VECTORS[4];

        let result = deriver
            .derive_public_key(
                vector.sender_private_key,
                vector.recipient_public_key,
                vector.invoice_number,
            )
            .expect("BRC-42 vector 05 public key derivation failed");

        assert_eq!(
            result, vector.expected_public_key,
            "BRC-42 vector 05: derived public key mismatch"
        );
    }

    /// Comprehensive test running all BRC-42 test vectors at once
    #[test]
    fn test_brc42_all_official_vectors() {
        let deriver = Brc42Deriver;
        let mut passed = 0;
        let mut failed = 0;

        // Test all private key derivation vectors
        for (i, vector) in PRIVATE_KEY_VECTORS.iter().enumerate() {
            match deriver.derive_private_key(
                vector.recipient_private_key,
                vector.sender_public_key,
                vector.invoice_number,
            ) {
                Ok(result) if result == vector.expected_private_key => {
                    passed += 1;
                    println!("✓ Private key vector {} PASS", i + 1);
                }
                Ok(result) => {
                    failed += 1;
                    println!("✗ Private key vector {} FAIL: got {}, expected {}",
                        i + 1, result, vector.expected_private_key);
                }
                Err(e) => {
                    failed += 1;
                    println!("✗ Private key vector {} ERROR: {}", i + 1, e);
                }
            }
        }

        // Test all public key derivation vectors
        for (i, vector) in PUBLIC_KEY_VECTORS.iter().enumerate() {
            match deriver.derive_public_key(
                vector.sender_private_key,
                vector.recipient_public_key,
                vector.invoice_number,
            ) {
                Ok(result) if result == vector.expected_public_key => {
                    passed += 1;
                    println!("✓ Public key vector {} PASS", i + 1);
                }
                Ok(result) => {
                    failed += 1;
                    println!("✗ Public key vector {} FAIL: got {}, expected {}",
                        i + 1, result, vector.expected_public_key);
                }
                Err(e) => {
                    failed += 1;
                    println!("✗ Public key vector {} ERROR: {}", i + 1, e);
                }
            }
        }

        println!("\nBRC-42 Test Vector Results: {} passed, {} failed", passed, failed);
        assert_eq!(failed, 0, "All BRC-42 test vectors must pass (10/10)");
        assert_eq!(passed, 10, "Expected 10 test vectors to pass");
    }

    #[test]
    fn test_brc42_ecdh_symmetry() {
        // Test that both parties derive the same shared secret (ECDH property)
        let deriver = Brc42Deriver;

        let alice_private = "583755110a8c059de5cd81b8a04e1be884c46083ade3f779c1e022f6f89da94c";
        let bob_private = "2c378b43d887d72200639890c11d79e8f22728d032a5733ba3d7be623d1bb118";

        // Derive public keys from private keys
        use secp256k1::{PublicKey, SecretKey, Secp256k1};
        let secp = Secp256k1::new();

        let alice_secret = SecretKey::from_slice(&hex::decode(alice_private).unwrap()).unwrap();
        let alice_public_hex = hex::encode(PublicKey::from_secret_key(&secp, &alice_secret).serialize());

        let bob_secret = SecretKey::from_slice(&hex::decode(bob_private).unwrap()).unwrap();
        let bob_public_hex = hex::encode(PublicKey::from_secret_key(&secp, &bob_secret).serialize());

        // Alice computes shared secret with Bob's public key
        let alice_shared = deriver
            .compute_shared_secret(alice_private, &bob_public_hex)
            .expect("Alice ECDH failed");

        // Bob computes shared secret with Alice's public key
        let bob_shared = deriver
            .compute_shared_secret(bob_private, &alice_public_hex)
            .expect("Bob ECDH failed");

        assert_eq!(
            alice_shared, bob_shared,
            "ECDH shared secrets must be identical (symmetry property)"
        );
    }

    #[test]
    fn test_brc42_public_private_key_consistency() {
        // Verify that derived public key matches the public key from derived private key
        let deriver = Brc42Deriver;

        let sender_private = "583755110a8c059de5cd81b8a04e1be884c46083ade3f779c1e022f6f89da94c";
        let recipient_private = "2c378b43d887d72200639890c11d79e8f22728d032a5733ba3d7be623d1bb118";
        let invoice = "2-edwinpai-test";

        // Derive recipient's public key
        use secp256k1::{PublicKey, SecretKey, Secp256k1};
        let secp = Secp256k1::new();
        let recipient_secret = SecretKey::from_slice(&hex::decode(recipient_private).unwrap()).unwrap();
        let recipient_public = hex::encode(PublicKey::from_secret_key(&secp, &recipient_secret).serialize());

        // Sender derives child public key
        let derived_public = deriver
            .derive_public_key(sender_private, &recipient_public, invoice)
            .expect("Public key derivation failed");

        // Recipient derives child private key
        let sender_secret = SecretKey::from_slice(&hex::decode(sender_private).unwrap()).unwrap();
        let sender_public = hex::encode(PublicKey::from_secret_key(&secp, &sender_secret).serialize());

        let derived_private = deriver
            .derive_private_key(recipient_private, &sender_public, invoice)
            .expect("Private key derivation failed");

        // Convert derived private key to public key
        let derived_private_secret = SecretKey::from_slice(&hex::decode(&derived_private).unwrap()).unwrap();
        let derived_private_public = hex::encode(PublicKey::from_secret_key(&secp, &derived_private_secret).serialize());

        // They should match
        assert_eq!(
            derived_public, derived_private_public,
            "Derived public key must match public key from derived private key"
        );
    }

    #[test]
    fn test_brc42_different_invoices_different_keys() {
        // Verify that different invoice numbers produce different derived keys
        let deriver = Brc42Deriver;

        let private_key = "583755110a8c059de5cd81b8a04e1be884c46083ade3f779c1e022f6f89da94c";
        let counterparty = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

        let invoice1 = "2-edwinpai-chat-session-001";
        let invoice2 = "2-edwinpai-chat-session-002";
        let invoice3 = "2-edwinpai-auth-login";

        // Derive public keys for different invoices
        let key1 = deriver
            .derive_public_key(private_key, counterparty, invoice1)
            .expect("Derivation 1 failed");

        let key2 = deriver
            .derive_public_key(private_key, counterparty, invoice2)
            .expect("Derivation 2 failed");

        let key3 = deriver
            .derive_public_key(private_key, counterparty, invoice3)
            .expect("Derivation 3 failed");

        // All keys should be different
        assert_ne!(key1, key2, "Different key IDs should produce different keys");
        assert_ne!(key1, key3, "Different protocols should produce different keys");
        assert_ne!(key2, key3, "Different protocols should produce different keys");

        // All keys should be valid compressed public keys (66 hex chars)
        assert_eq!(key1.len(), 66);
        assert_eq!(key2.len(), 66);
        assert_eq!(key3.len(), 66);

        // All keys should start with 02 or 03
        assert!(key1.starts_with("02") || key1.starts_with("03"));
        assert!(key2.starts_with("02") || key2.starts_with("03"));
        assert!(key3.starts_with("02") || key3.starts_with("03"));
    }
}
