// Channel Credential Encryption (SPEC §9.8)
//
// Encrypts channel credentials at rest using the Crypto Domain's BRC-2 encryption.
// All credentials are encrypted with protocolID="channel-storage" and keyID=<channel_name>.

use crate::crypto_domain::domain::{decrypt_data, encrypt_data};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Encrypted credential storage format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedCredentials {
    /// Map of field name → encrypted value (hex-encoded ciphertext)
    pub fields: HashMap<String, String>,
}

/// Decrypted credential storage format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptedCredentials {
    /// Map of field name → plaintext value
    pub fields: HashMap<String, String>,
}

/// Encrypts a set of plaintext credentials for a specific channel
///
/// # Arguments
/// * `channel_name` - Channel identifier (used as keyID in BRC-42 derivation)
/// * `credentials` - Map of field names → plaintext values
/// * `counterparty` - Counterparty public key (defaults to "self" for local encryption)
///
/// # Returns
/// Map of field names → hex-encoded encrypted values
///
/// # Example
/// ```
/// let creds = HashMap::from([("botToken".to_string(), "123456:ABC...".to_string())]);
/// let encrypted = encrypt_credentials("telegram", creds, "self").await?;
/// ```
pub async fn encrypt_credentials(
    channel_name: &str,
    credentials: HashMap<String, String>,
    counterparty: Option<&str>,
) -> Result<HashMap<String, String>, String> {
    let mut encrypted_fields = HashMap::new();
    let protocol_id = "channel-storage";
    let key_id = channel_name;
    let counterparty_str = counterparty.unwrap_or("self");

    for (field_name, plaintext_value) in credentials {
        // Encrypt the plaintext value using the Crypto Domain
        let ciphertext = encrypt_data(
            plaintext_value.as_bytes(),
            protocol_id,
            key_id,
            counterparty_str,
        )
        .await
        .map_err(|e| format!("Failed to encrypt {}: {}", field_name, e))?;

        // Convert to hex for JSON storage
        let hex_ciphertext = hex::encode(&ciphertext);
        encrypted_fields.insert(field_name, hex_ciphertext);
    }

    Ok(encrypted_fields)
}

/// Decrypts a set of encrypted credentials for a specific channel
///
/// # Arguments
/// * `channel_name` - Channel identifier (must match the keyID used during encryption)
/// * `encrypted_credentials` - Map of field names → hex-encoded encrypted values
/// * `counterparty` - Counterparty public key (must match encryption counterparty)
///
/// # Returns
/// Map of field names → plaintext values
///
/// # Example
/// ```
/// let encrypted = HashMap::from([("botToken".to_string(), "a1b2c3...".to_string())]);
/// let decrypted = decrypt_credentials("telegram", encrypted, "self").await?;
/// assert_eq!(decrypted.get("botToken"), Some(&"123456:ABC...".to_string()));
/// ```
pub async fn decrypt_credentials(
    channel_name: &str,
    encrypted_credentials: HashMap<String, String>,
    counterparty: Option<&str>,
) -> Result<HashMap<String, String>, String> {
    let mut decrypted_fields = HashMap::new();
    let protocol_id = "channel-storage";
    let key_id = channel_name;
    let counterparty_str = counterparty.unwrap_or("self");

    for (field_name, hex_ciphertext) in encrypted_credentials {
        // Decode hex ciphertext
        let ciphertext = hex::decode(&hex_ciphertext)
            .map_err(|e| format!("Invalid hex for {}: {}", field_name, e))?;

        // Decrypt using the Crypto Domain
        let plaintext = decrypt_data(&ciphertext, protocol_id, key_id, counterparty_str)
            .await
            .map_err(|e| format!("Failed to decrypt {}: {}", field_name, e))?;

        // Convert to UTF-8 string
        let plaintext_str = String::from_utf8(plaintext)
            .map_err(|e| format!("Invalid UTF-8 for {}: {}", field_name, e))?;

        decrypted_fields.insert(field_name, plaintext_str);
    }

    Ok(decrypted_fields)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test helper: Mock encrypt/decrypt using simple XOR (for unit tests without crypto domain)
    fn mock_encrypt(plaintext: &str, _key: &str) -> String {
        hex::encode(plaintext.as_bytes().iter().map(|b| b ^ 0x42).collect::<Vec<u8>>())
    }

    fn mock_decrypt(hex_ciphertext: &str, _key: &str) -> String {
        let bytes = hex::decode(hex_ciphertext).unwrap();
        String::from_utf8(bytes.iter().map(|b| b ^ 0x42).collect::<Vec<u8>>()).unwrap()
    }

    #[test]
    fn test_encrypted_credentials_serialization() {
        let encrypted = EncryptedCredentials {
            fields: HashMap::from([
                ("botToken".to_string(), "a1b2c3".to_string()),
                ("apiKey".to_string(), "d4e5f6".to_string()),
            ]),
        };

        let json = serde_json::to_string(&encrypted).unwrap();
        assert!(json.contains("botToken"));
        assert!(json.contains("a1b2c3"));

        let deserialized: EncryptedCredentials = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.fields.len(), 2);
        assert_eq!(deserialized.fields.get("botToken"), Some(&"a1b2c3".to_string()));
    }

    #[test]
    fn test_decrypted_credentials_serialization() {
        let decrypted = DecryptedCredentials {
            fields: HashMap::from([
                ("username".to_string(), "alice".to_string()),
                ("password".to_string(), "secret123".to_string()),
            ]),
        };

        let json = serde_json::to_string(&decrypted).unwrap();
        let deserialized: DecryptedCredentials = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.fields.get("username"), Some(&"alice".to_string()));
    }

    #[test]
    fn test_mock_encryption_roundtrip() {
        let plaintext = "mySecretToken123";
        let encrypted = mock_encrypt(plaintext, "telegram");
        let decrypted = mock_decrypt(&encrypted, "telegram");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_hex_encoding_validation() {
        // Valid hex
        assert!(hex::decode("a1b2c3").is_ok());

        // Invalid hex
        assert!(hex::decode("xyz").is_err());
    }

    // Integration tests require the Crypto Domain to be running.
    // These tests are marked with #[ignore] and run in CI only.

    #[tokio::test]
    #[ignore]
    async fn test_encrypt_single_field() {
        let credentials = HashMap::from([("botToken".to_string(), "123456:ABC-DEF".to_string())]);

        let encrypted = encrypt_credentials("telegram", credentials, None)
            .await
            .expect("Encryption should succeed");

        assert_eq!(encrypted.len(), 1);
        assert!(encrypted.contains_key("botToken"));

        // Encrypted value should be hex-encoded (even length, valid hex chars)
        let hex_value = encrypted.get("botToken").unwrap();
        assert_eq!(hex_value.len() % 2, 0);
        assert!(hex::decode(hex_value).is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_encrypt_multiple_fields() {
        let credentials = HashMap::from([
            ("apiKey".to_string(), "sk-1234567890abcdef".to_string()),
            ("apiSecret".to_string(), "secret-xyz-999".to_string()),
            ("webhookUrl".to_string(), "https://example.com/hook".to_string()),
        ]);

        let encrypted = encrypt_credentials("slack", credentials, None)
            .await
            .expect("Encryption should succeed");

        assert_eq!(encrypted.len(), 3);
        assert!(encrypted.contains_key("apiKey"));
        assert!(encrypted.contains_key("apiSecret"));
        assert!(encrypted.contains_key("webhookUrl"));
    }

    #[tokio::test]
    #[ignore]
    async fn test_decrypt_single_field() {
        // First encrypt
        let original = HashMap::from([("token".to_string(), "my-secret-token".to_string())]);
        let encrypted = encrypt_credentials("whatsapp", original.clone(), None)
            .await
            .expect("Encryption should succeed");

        // Then decrypt
        let decrypted = decrypt_credentials("whatsapp", encrypted, None)
            .await
            .expect("Decryption should succeed");

        assert_eq!(decrypted.len(), 1);
        assert_eq!(decrypted.get("token"), Some(&"my-secret-token".to_string()));
    }

    #[tokio::test]
    #[ignore]
    async fn test_decrypt_multiple_fields() {
        let original = HashMap::from([
            ("homeserver".to_string(), "https://matrix.org".to_string()),
            ("accessToken".to_string(), "syt_abc123".to_string()),
            ("userId".to_string(), "@alice:matrix.org".to_string()),
        ]);

        let encrypted = encrypt_credentials("matrix", original.clone(), None)
            .await
            .expect("Encryption should succeed");

        let decrypted = decrypt_credentials("matrix", encrypted, None)
            .await
            .expect("Decryption should succeed");

        assert_eq!(decrypted, original);
    }

    #[tokio::test]
    #[ignore]
    async fn test_encryption_roundtrip_preserves_values() {
        let test_cases = vec![
            ("simple", "abc123"),
            ("unicode", "Hello 世界 🚀"),
            ("special_chars", "!@#$%^&*()_+-=[]{}|;':\",./<>?"),
            ("whitespace", "  leading and trailing  "),
            ("newlines", "line1\nline2\nline3"),
        ];

        for (field_name, value) in test_cases {
            let credentials = HashMap::from([(field_name.to_string(), value.to_string())]);

            let encrypted = encrypt_credentials("test-channel", credentials.clone(), None)
                .await
                .expect("Encryption should succeed");

            let decrypted = decrypt_credentials("test-channel", encrypted, None)
                .await
                .expect("Decryption should succeed");

            assert_eq!(
                decrypted.get(field_name),
                Some(&value.to_string()),
                "Roundtrip failed for: {}",
                field_name
            );
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_decrypt_invalid_hex_fails() {
        let invalid_encrypted = HashMap::from([("field".to_string(), "not-valid-hex!!!".to_string())]);

        let result = decrypt_credentials("test", invalid_encrypted, None).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid hex"));
    }

    #[tokio::test]
    #[ignore]
    async fn test_decrypt_wrong_channel_name_fails() {
        // Encrypt with one channel name
        let credentials = HashMap::from([("token".to_string(), "secret".to_string())]);
        let encrypted = encrypt_credentials("telegram", credentials, None)
            .await
            .expect("Encryption should succeed");

        // Try to decrypt with a different channel name (wrong keyID)
        let result = decrypt_credentials("whatsapp", encrypted, None).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[ignore]
    async fn test_decrypt_wrong_counterparty_fails() {
        // Encrypt with one counterparty
        let credentials = HashMap::from([("token".to_string(), "secret".to_string())]);
        let encrypted = encrypt_credentials("signal", credentials.clone(), Some("self"))
            .await
            .expect("Encryption should succeed");

        // Try to decrypt with a different counterparty
        let result = decrypt_credentials("signal", encrypted, Some("other")).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[ignore]
    async fn test_empty_credentials() {
        let empty: HashMap<String, String> = HashMap::new();

        let encrypted = encrypt_credentials("discord", empty.clone(), None)
            .await
            .expect("Should handle empty credentials");

        assert_eq!(encrypted.len(), 0);

        let decrypted = decrypt_credentials("discord", encrypted, None)
            .await
            .expect("Should handle empty credentials");

        assert_eq!(decrypted.len(), 0);
    }

    #[tokio::test]
    #[ignore]
    async fn test_large_credential_value() {
        // Test with a large value (e.g., OAuth token, certificate)
        let large_value = "x".repeat(10000);
        let credentials = HashMap::from([("largeField".to_string(), large_value.clone())]);

        let encrypted = encrypt_credentials("test", credentials, None)
            .await
            .expect("Should handle large values");

        let decrypted = decrypt_credentials("test", encrypted, None)
            .await
            .expect("Should handle large values");

        assert_eq!(decrypted.get("largeField"), Some(&large_value));
    }
}
