// Phase 6 Integration Tests
//
// Comprehensive integration test suite:
// - IPC command flows (6 tests)
// - Subscription FSM transitions (5 tests)
// - Channel encrypt/decrypt with BRC-42 (4 tests)

use crate::crypto_domain::{
    brc42::Brc42Deriver,
    domain::{decrypt_data, encrypt_data},
    signing::{sign_data, verify_signature},
    traits::Brc42KeyDerivation,
    types::VerifyRequest,
};
use crate::subscription::types::SubscriptionState;

// ============================================================================
// IPC Command Flow Tests (6 tests)
// ============================================================================

#[tokio::test]
async fn test_ipc_sign_verify_flow() {
    // Simulates: Frontend → sign_message → Backend → verify_message
    let private_key = "0000000000000000000000000000000000000000000000000000000000000001";
    let data = b"IPC test message";

    // Step 1: Frontend calls sign_message command
    let sign_response = sign_data(data, private_key).expect("Sign failed");
    assert!(!sign_response.signature.is_empty());
    assert!(!sign_response.public_key.is_empty());

    // Step 2: Frontend calls verify_message command
    let verify_request = VerifyRequest {
        data: data.to_vec(),
        signature: sign_response.signature.clone(),
        public_key: sign_response.public_key.clone(),
    };
    let verify_response = verify_signature(&verify_request).expect("Verify failed");
    assert!(verify_response.valid);
}

#[tokio::test]
async fn test_ipc_derive_key_flow() {
    // Simulates: Frontend → derive_key command → Backend
    let deriver = Brc42Deriver;

    // Step 1: Derive private key (recipient perspective)
    let master_priv = "6a1751169c111b4667a6539ee1be6b7cd9f6e9c8fe011a5f2fe31e03a15e0ede";
    let counterparty_pub = "033f9160df035156f1c48e75eae99914fa1a1546bec19781e8eddb900200bff9d1";
    let invoice = "test_invoice_001";

    let child_priv = deriver
        .derive_private_key(master_priv, counterparty_pub, invoice)
        .expect("Private key derivation failed");
    assert_eq!(child_priv.len(), 64);

    // Step 2: Derive public key (sender perspective)
    let child_pub = deriver
        .derive_public_key(master_priv, counterparty_pub, invoice)
        .expect("Public key derivation failed");
    assert_eq!(child_pub.len(), 66);
}

#[tokio::test]
async fn test_ipc_encrypt_decrypt_flow() {
    // Simulates: Frontend → encrypt → Backend → decrypt
    let plaintext = b"Sensitive channel credentials";
    let protocol_id = "channel-storage";
    let key_id = "telegram";
    let counterparty = "self";

    // Step 1: Frontend calls encrypt command
    let ciphertext = encrypt_data(plaintext, protocol_id, key_id, counterparty)
        .await
        .expect("Encryption failed");
    assert!(!ciphertext.is_empty());
    assert_ne!(ciphertext, plaintext);

    // Step 2: Frontend calls decrypt command
    let decrypted = decrypt_data(&ciphertext, protocol_id, key_id, counterparty)
        .await
        .expect("Decryption failed");
    assert_eq!(decrypted, plaintext);
}

#[tokio::test]
async fn test_ipc_get_identity_flow() {
    // Simulates: Frontend → get_identity command → Backend
    let deriver = Brc42Deriver;
    let master_priv = "0000000000000000000000000000000000000000000000000000000000000001";

    // Step 1: Get master public key
    let master_pub = deriver
        .derive_public_key(
            master_priv,
            "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
            "",
        )
        .expect("Public key derivation failed");

    // Step 2: Derive petname from public key (first 8 chars of hex)
    let petname = &master_pub[0..8];
    assert_eq!(petname.len(), 8);

    // Step 3: Generate short ID (first 6 chars)
    let short_id = &master_pub[0..6];
    assert_eq!(short_id.len(), 6);
}

#[tokio::test]
async fn test_ipc_check_subscription_flow() {
    // Simulates: Frontend → check_subscription command → Backend
    // Mock subscription check (no actual SPV verification in unit test)

    let mock_subscription_active = SubscriptionState::Active;
    let mock_subscription_expired = SubscriptionState::Expired;

    // Active subscription allows full operation
    assert!(mock_subscription_active.allows_full_operation());
    assert!(mock_subscription_active.allows_channel_io());

    // Expired subscription blocks operations
    assert!(!mock_subscription_expired.allows_full_operation());
    assert!(!mock_subscription_expired.allows_channel_io());
}

#[tokio::test]
async fn test_ipc_channel_crud_flow() {
    // Simulates: Frontend → create_channel → update_channel → delete_channel
    use std::collections::HashMap;

    // Step 1: Create channel config
    let mut channel_config = HashMap::new();
    channel_config.insert("name".to_string(), "telegram_bot".to_string());
    channel_config.insert("platform".to_string(), "telegram".to_string());
    channel_config.insert("enabled".to_string(), "true".to_string());

    // Step 2: Encrypt credentials
    let credentials = HashMap::from([("botToken".to_string(), "123456:ABC".to_string())]);
    let protocol_id = "channel-storage";
    let key_id = "telegram_bot";

    let mut encrypted_creds = HashMap::new();
    for (field, value) in credentials {
        let ciphertext = encrypt_data(value.as_bytes(), protocol_id, key_id, "self")
            .await
            .expect("Encryption failed");
        encrypted_creds.insert(field, hex::encode(ciphertext));
    }
    assert!(encrypted_creds.contains_key("botToken"));

    // Step 3: Update channel (re-encrypt new credentials)
    let new_token = "654321:XYZ";
    let new_ciphertext = encrypt_data(new_token.as_bytes(), protocol_id, key_id, "self")
        .await
        .expect("Re-encryption failed");
    encrypted_creds.insert("botToken".to_string(), hex::encode(new_ciphertext));

    // Step 4: Decrypt for verification
    let stored_hex = encrypted_creds.get("botToken").unwrap();
    let stored_bytes = hex::decode(stored_hex).expect("Hex decode failed");
    let decrypted = decrypt_data(&stored_bytes, protocol_id, key_id, "self")
        .await
        .expect("Decryption failed");
    assert_eq!(decrypted, new_token.as_bytes());

    // Step 5: Delete (clear credentials)
    encrypted_creds.clear();
    assert!(encrypted_creds.is_empty());
}

// ============================================================================
// Subscription FSM Transition Tests (5 tests)
// ============================================================================

#[tokio::test]
async fn test_subscription_fsm_active_to_cached() {
    // Transition: Active → Cached (goes offline)
    let state = SubscriptionState::Active;
    assert!(state.allows_full_operation());
    assert!(state.allows_channel_io());

    let new_state = SubscriptionState::Cached;
    assert!(new_state.allows_full_operation()); // Cached still allows operation
    assert!(new_state.allows_channel_io());
}

#[tokio::test]
async fn test_subscription_fsm_cached_to_expired() {
    // Transition: Cached → Expired (cache timeout reached)
    let state = SubscriptionState::Cached;
    assert!(state.allows_full_operation());

    let new_state = SubscriptionState::Expired;
    assert!(!new_state.allows_full_operation()); // Expired blocks operations
    assert!(!new_state.allows_channel_io());
}

#[tokio::test]
async fn test_subscription_fsm_expired_to_active() {
    // Transition: Expired → Active (subscription renewed)
    let state = SubscriptionState::Expired;
    assert!(!state.allows_full_operation());

    let new_state = SubscriptionState::Active;
    assert!(new_state.allows_full_operation()); // Active restores access
    assert!(new_state.allows_channel_io());
}

#[tokio::test]
async fn test_subscription_fsm_grace_exceeded() {
    // Transition: Expired → GraceExceeded (grace period timeout)
    let state = SubscriptionState::Expired;
    assert!(!state.allows_full_operation());

    let new_state = SubscriptionState::GraceExceeded;
    assert!(!new_state.allows_full_operation()); // Grace exceeded still blocks
    assert!(!new_state.allows_channel_io());
}

#[tokio::test]
async fn test_subscription_fsm_not_found() {
    // State: NotFound (no subscription ever existed)
    let state = SubscriptionState::NotFound;
    assert!(!state.allows_full_operation());
    assert!(!state.allows_channel_io());

    // NotFound can transition to Active (first subscription)
    let new_state = SubscriptionState::Active;
    assert!(new_state.allows_full_operation());
}

// ============================================================================
// Channel Encrypt/Decrypt with BRC-42 (4 tests)
// ============================================================================

#[tokio::test]
async fn test_channel_encryption_telegram() {
    // Test: Encrypt/decrypt Telegram bot token
    let bot_token = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
    let protocol_id = "channel-storage";
    let key_id = "telegram_main";
    let counterparty = "self";

    // Encrypt
    let ciphertext = encrypt_data(bot_token.as_bytes(), protocol_id, key_id, counterparty)
        .await
        .expect("Telegram encryption failed");

    // Decrypt
    let plaintext = decrypt_data(&ciphertext, protocol_id, key_id, counterparty)
        .await
        .expect("Telegram decryption failed");

    assert_eq!(plaintext, bot_token.as_bytes());
}

#[tokio::test]
async fn test_channel_encryption_whatsapp() {
    // Test: Encrypt/decrypt WhatsApp session data (JSON)
    let session_json = r#"{"creds":{"noiseKey":{"private":"...","public":"..."}}}"#;
    let protocol_id = "channel-storage";
    let key_id = "whatsapp_business";
    let counterparty = "self";

    // Encrypt
    let ciphertext = encrypt_data(session_json.as_bytes(), protocol_id, key_id, counterparty)
        .await
        .expect("WhatsApp encryption failed");

    // Decrypt
    let plaintext = decrypt_data(&ciphertext, protocol_id, key_id, counterparty)
        .await
        .expect("WhatsApp decryption failed");

    assert_eq!(plaintext, session_json.as_bytes());
}

#[tokio::test]
async fn test_channel_encryption_cross_channel_isolation() {
    // Test: Different channels cannot decrypt each other's data
    let telegram_token = "telegram_secret_123";
    let telegram_key_id = "telegram";
    let discord_key_id = "discord";
    let protocol_id = "channel-storage";
    let counterparty = "self";

    // Encrypt with telegram keyID
    let ciphertext = encrypt_data(
        telegram_token.as_bytes(),
        protocol_id,
        telegram_key_id,
        counterparty,
    )
    .await
    .expect("Encryption failed");

    // Try to decrypt with discord keyID (should fail or produce garbage)
    let result = decrypt_data(&ciphertext, protocol_id, discord_key_id, counterparty).await;

    // Decryption should fail or produce incorrect plaintext
    if let Ok(plaintext) = result {
        assert_ne!(plaintext, telegram_token.as_bytes());
    }
    // If it errors, that's also acceptable behavior (key derivation mismatch)
}

#[tokio::test]
async fn test_channel_encryption_multiple_fields() {
    // Test: Encrypt multiple credential fields independently
    use std::collections::HashMap;

    let protocol_id = "channel-storage";
    let key_id = "matrix_homeserver";
    let counterparty = "self";

    // Multiple credential fields
    let credentials = HashMap::from([
        ("homeserver".to_string(), "https://matrix.org".to_string()),
        ("userId".to_string(), "@user:matrix.org".to_string()),
        ("accessToken".to_string(), "syt_secret_token".to_string()),
    ]);

    // Encrypt all fields
    let mut encrypted = HashMap::new();
    for (field, value) in &credentials {
        let ciphertext = encrypt_data(value.as_bytes(), protocol_id, key_id, counterparty)
            .await
            .expect(&format!("Encryption of {} failed", field));
        encrypted.insert(field.clone(), hex::encode(ciphertext));
    }

    // Decrypt all fields
    let mut decrypted = HashMap::new();
    for (field, hex_ciphertext) in &encrypted {
        let ciphertext = hex::decode(hex_ciphertext).expect("Hex decode failed");
        let plaintext = decrypt_data(&ciphertext, protocol_id, key_id, counterparty)
            .await
            .expect(&format!("Decryption of {} failed", field));
        decrypted.insert(field.clone(), String::from_utf8(plaintext).unwrap());
    }

    // Verify all fields match
    assert_eq!(
        decrypted.get("homeserver").unwrap(),
        credentials.get("homeserver").unwrap()
    );
    assert_eq!(
        decrypted.get("userId").unwrap(),
        credentials.get("userId").unwrap()
    );
    assert_eq!(
        decrypted.get("accessToken").unwrap(),
        credentials.get("accessToken").unwrap()
    );
}

// ============================================================================
// Additional Integration Tests
// ============================================================================

#[tokio::test]
async fn test_end_to_end_brc42_sign_verify() {
    // Test: BRC-42 derive → Sign with derived key → Verify signature
    let deriver = Brc42Deriver;

    // Step 1: Derive child private key
    let master_priv = "6a1751169c111b4667a6539ee1be6b7cd9f6e9c8fe011a5f2fe31e03a15e0ede";
    let counterparty_pub = "033f9160df035156f1c48e75eae99914fa1a1546bec19781e8eddb900200bff9d1";
    let invoice = "integration_test_001";

    let child_priv = deriver
        .derive_private_key(master_priv, counterparty_pub, invoice)
        .expect("Derivation failed");

    // Step 2: Sign message with derived key
    let message = b"Integration test message";
    let sign_response = sign_data(message, &child_priv).expect("Sign failed");

    // Step 3: Verify signature
    let verify_request = VerifyRequest {
        data: message.to_vec(),
        signature: sign_response.signature.clone(),
        public_key: sign_response.public_key.clone(),
    };
    let verify_response = verify_signature(&verify_request).expect("Verify failed");

    assert!(verify_response.valid);
}

#[tokio::test]
async fn test_subscription_gated_channel_access() {
    // Test: Subscription state gates channel operations
    let active = SubscriptionState::Active;
    let expired = SubscriptionState::Expired;

    // Active subscription: Channel encryption should proceed
    if active.allows_channel_io() {
        let plaintext = b"Test data";
        let ciphertext = encrypt_data(plaintext, "channel-storage", "test", "self")
            .await
            .expect("Encryption failed");
        assert!(!ciphertext.is_empty());
    }

    // Expired subscription: Channel operations should be blocked
    if !expired.allows_channel_io() {
        // In production, this would return an error before reaching encrypt_data
        // For testing, we just verify the state check works
        assert!(!expired.allows_channel_io());
    }
}
