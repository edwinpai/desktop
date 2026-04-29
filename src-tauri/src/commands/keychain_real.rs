// Real Keychain Commands
//
// Tauri commands for generating and managing user identity using the system
// keychain and crypto_domain modules.
//
// Identity generation flow:
// 1. Generate secp256k1 keypair via crypto_domain/keypair.rs
// 2. Store private key in OS keychain (macOS Keychain/Windows Credential Manager/Linux Secret Service)
// 3. Store public key in ~/.edwinpai/edwinpai.json (via deep merge, preserving all other fields)
// 4. Derive petname via crypto_domain/identity.rs and store in config

use crate::crypto_domain::keypair::generate_keypair;
use crate::crypto_domain::identity::IdentityGen;
use crate::crypto_domain::keychain::PlatformKeychain;
use crate::crypto_domain::traits::{IdentityGenerator, KeychainAccess};
use crate::edwinpai_config::{read_edwinpai_config, update_edwinpai_config};
use serde::{Deserialize, Serialize};

const KEYCHAIN_SERVICE: &str = "com.edwinpai.desktop";
const KEYCHAIN_ACCOUNT: &str = "main-identity";

/// Generate a new identity (keypair + petname)
#[tauri::command]
pub async fn generate_identity() -> Result<GeneratedIdentity, String> {
    // Generate keypair
    let keypair = generate_keypair()
        .map_err(|e| format!("Failed to generate keypair: {}", e.message))?;

    let public_key_hex = keypair.public_key_hex();
    let private_key_hex = hex::encode(keypair.private_key);

    // Store private key in OS keychain
    let keychain = PlatformKeychain;
    keychain.store_key(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, &private_key_hex)
        .map_err(|e| format!("Failed to store private key in keychain: {}", e.message))?;

    // Derive petname
    let identity_gen = IdentityGen;
    let petname = identity_gen.generate_petname(&public_key_hex)
        .map_err(|e| format!("Failed to generate petname: {}", e.message))?;

    // Update edwinpai.json (deep merge — preserves all existing fields)
    let updates = serde_json::json!({
        "publicKey": public_key_hex,
        "petname": petname.display,
    });
    update_edwinpai_config(&updates)?;

    Ok(GeneratedIdentity {
        public_key: public_key_hex,
        petname: petname.display,
        stored_in_keychain: true,
    })
}

/// Check if identity exists in keychain
#[tauri::command]
pub async fn has_identity() -> Result<bool, String> {
    let keychain = PlatformKeychain;
    Ok(keychain.key_exists(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT))
}

/// Get public key from config (does not access keychain)
#[tauri::command]
pub async fn get_public_key() -> Result<Option<String>, String> {
    let config = read_edwinpai_config()?;
    Ok(config.get("publicKey").and_then(|v| v.as_str()).map(|s| s.to_string()))
}

/// Delete identity from keychain and config
///
/// WARNING: This is destructive and cannot be undone.
#[tauri::command]
pub async fn delete_identity() -> Result<(), String> {
    // Delete from keychain
    let keychain = PlatformKeychain;
    keychain.delete_key(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|e| format!("Failed to delete key from keychain: {}", e.message))?;

    // Remove publicKey and petname from config (set to null, deep merge preserves rest)
    let updates = serde_json::json!({
        "publicKey": null,
        "petname": null,
    });
    update_edwinpai_config(&updates)?;

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedIdentity {
    pub public_key: String,
    pub petname: String,
    pub stored_in_keychain: bool,
}
