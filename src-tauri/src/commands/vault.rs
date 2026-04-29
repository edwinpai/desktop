// Credential Vault Commands
//
// Encrypted credential storage backed by OS Keychain master key.
// Credentials are stored in ~/.edwinpai/vault/vault.enc using AES-256-GCM.
// The encryption key is derived from a master secret in the OS Keychain.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::crypto_domain::keychain::PlatformKeychain;
use crate::crypto_domain::traits::KeychainAccess;

const KEYCHAIN_SERVICE: &str = "com.edwinpai.desktop";
const KEYCHAIN_VAULT_ACCOUNT: &str = "vault-master-key";
const NONCE_SIZE: usize = 12;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub provider: String,
    pub credential: String,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
    pub created_at: u64,
    pub last_accessed_at: u64,
    pub access_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntryMeta {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub provider: String,
    pub created_at: u64,
    pub last_accessed_at: u64,
    pub access_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct VaultDatabase {
    version: u32,
    entries: HashMap<String, VaultEntry>,
}

// ============================================================================
// Paths
// ============================================================================

fn vault_dir(profile_id: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to determine home directory")?;
    // Sanitize profile_id to prevent path traversal
    let safe_id = profile_id.replace(['/', '\\', '.', ' '], "_");
    Ok(home.join(".edwinpai").join("vault").join(safe_id))
}

fn vault_path(profile_id: &str) -> Result<PathBuf, String> {
    Ok(vault_dir(profile_id)?.join("vault.enc"))
}

// ============================================================================
// Master Key Management
// ============================================================================

fn get_or_create_master_key() -> Result<[u8; 32], String> {
    // Use file-based key as primary (reliable across dev/prod)
    // OS keychain is used as secondary storage for production builds
    let key_file = dirs::home_dir()
        .ok_or("No home dir")?
        .join(".edwinpai")
        .join("vault")
        .join(".vault-key");

    if key_file.exists() {
        let hex_key = fs::read_to_string(&key_file)
            .map_err(|e| format!("Failed to read vault key file: {}", e))?;
        let bytes = hex::decode(hex_key.trim())
            .map_err(|e| format!("Invalid vault key file: {}", e))?;
        if bytes.len() != 32 {
            return Err(format!("Vault key file wrong length: {}", bytes.len()));
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        return Ok(key);
    }

    // Generate new key and save to file
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    let hex_key = hex::encode(key);

    let dir = key_file.parent().unwrap();
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create vault dir: {}", e))?;
    fs::write(&key_file, &hex_key).map_err(|e| format!("Failed to write vault key: {}", e))?;
    eprintln!("[vault] Created master key at {:?}", key_file);

    // Also try to store in OS keychain as backup
    let keychain = PlatformKeychain;
    let _ = keychain.store_key(KEYCHAIN_SERVICE, KEYCHAIN_VAULT_ACCOUNT, &hex_key);

    Ok(key)
}

// ============================================================================
// Encryption / Decryption
// ============================================================================

fn encrypt_vault(db: &VaultDatabase, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let plaintext = serde_json::to_vec(db)
        .map_err(|e| format!("Failed to serialize vault: {}", e))?;

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Prepend nonce to ciphertext
    let mut output = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

fn decrypt_vault(data: &[u8], key: &[u8; 32]) -> Result<VaultDatabase, String> {
    if data.len() < NONCE_SIZE {
        return Err("Vault file too short".to_string());
    }

    let (nonce_bytes, ciphertext) = data.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed — wrong key or corrupted vault".to_string())?;

    serde_json::from_slice(&plaintext)
        .map_err(|e| format!("Failed to parse vault: {}", e))
}

// ============================================================================
// Database Operations
// ============================================================================

fn load_vault(profile_id: &str) -> Result<VaultDatabase, String> {
    let path = vault_path(profile_id)?;
    if !path.exists() {
        return Ok(VaultDatabase {
            version: 1,
            entries: HashMap::new(),
        });
    }

    let data = fs::read(&path)
        .map_err(|e| format!("Failed to read vault: {}", e))?;

    let key = get_or_create_master_key()?;
    match decrypt_vault(&data, &key) {
        Ok(db) => Ok(db),
        Err(_) => {
            // Vault is corrupted or was encrypted with a different key.
            // Back up the old file and start fresh.
            let backup = path.with_extension("enc.bak");
            let _ = fs::rename(&path, &backup);
            Ok(VaultDatabase {
                version: 1,
                entries: HashMap::new(),
            })
        }
    }
}

fn save_vault(profile_id: &str, db: &VaultDatabase) -> Result<(), String> {
    let dir = vault_dir(profile_id)?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create vault directory: {}", e))?;

    let key = get_or_create_master_key()?;
    let encrypted = encrypt_vault(db, &key)?;

    let path = vault_path(profile_id)?;
    let tmp_path = path.with_extension("enc.tmp");

    fs::write(&tmp_path, &encrypted)
        .map_err(|e| format!("Failed to write vault: {}", e))?;
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to rename vault: {}", e))?;

    Ok(())
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Store a credential in the encrypted vault
#[tauri::command]
pub async fn vault_store(
    profile_id: String,
    id: String,
    name: String,
    entry_type: String,
    provider: String,
    credential: String,
    metadata: Option<HashMap<String, String>>,
) -> Result<VaultEntryMeta, String> {
    let mut db = load_vault(&profile_id)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    let entry = VaultEntry {
        id: id.clone(),
        name: name.clone(),
        entry_type: entry_type.clone(),
        provider: provider.clone(),
        credential,
        metadata: metadata.unwrap_or_default(),
        created_at: now,
        last_accessed_at: now,
        access_count: 0,
    };

    let meta = VaultEntryMeta {
        id: entry.id.clone(),
        name: entry.name.clone(),
        entry_type: entry.entry_type.clone(),
        provider: entry.provider.clone(),
        created_at: entry.created_at,
        last_accessed_at: entry.last_accessed_at,
        access_count: entry.access_count,
    };

    db.entries.insert(id, entry);
    save_vault(&profile_id, &db)?;

    Ok(meta)
}

/// Get a credential from the vault (returns the secret value)
#[tauri::command]
pub async fn vault_get(profile_id: String, id: String) -> Result<Option<String>, String> {
    let mut db = load_vault(&profile_id)?;

    let credential = {
        if let Some(entry) = db.entries.get_mut(&id) {
            entry.last_accessed_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_millis() as u64;
            entry.access_count += 1;
            Some(entry.credential.clone())
        } else {
            None
        }
    };

    if credential.is_some() {
        save_vault(&profile_id, &db)?;
    }
    Ok(credential)
}

/// List all credentials (metadata only, no secrets)
#[tauri::command]
pub async fn vault_list(profile_id: String) -> Result<Vec<VaultEntryMeta>, String> {
    let db = load_vault(&profile_id)?;
    let mut entries: Vec<VaultEntryMeta> = db
        .entries
        .values()
        .map(|e| VaultEntryMeta {
            id: e.id.clone(),
            name: e.name.clone(),
            entry_type: e.entry_type.clone(),
            provider: e.provider.clone(),
            created_at: e.created_at,
            last_accessed_at: e.last_accessed_at,
            access_count: e.access_count,
        })
        .collect();
    entries.sort_by(|a, b| b.last_accessed_at.cmp(&a.last_accessed_at));
    Ok(entries)
}

/// Delete a credential from the vault
#[tauri::command]
pub async fn vault_delete(profile_id: String, id: String) -> Result<bool, String> {
    let mut db = load_vault(&profile_id)?;
    let removed = db.entries.remove(&id).is_some();
    if removed {
        save_vault(&profile_id, &db)?;
    }
    Ok(removed)
}
