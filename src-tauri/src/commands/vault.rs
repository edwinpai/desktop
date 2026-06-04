// Credential Vault Commands
//
// Metadata-only credential vault backed by the OS keychain.
// Vault metadata is stored in ~/.edwinpai/vault/<profile>/vault.enc.
// Raw secret values are stored per-entry in the platform keychain.

use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use super::signed_request::SignedEnvelope;
use crate::crypto_domain::keychain::PlatformKeychain;
use crate::crypto_domain::traits::{CryptoDomain, KeychainAccess};
use crate::crypto_domain::types::VerifyRequest;
use crate::crypto_domain::EdwinPAICryptoDomain;

const KEYCHAIN_SERVICE: &str = "com.edwinpai.desktop";
const KEYCHAIN_VAULT_ACCOUNT_PREFIX: &str = "vault-master-key";
const KEYCHAIN_VAULT_SECRET_PREFIX: &str = "edwin:vault";
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
    #[serde(default)]
    pub keychain_ref: String,
    #[serde(default)]
    pub fingerprint: String,
    #[serde(default = "default_requires_approval")]
    pub reveal_requires_approval: bool,
    #[serde(default = "default_requires_approval")]
    pub use_requires_approval: bool,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
    #[allow(dead_code)]
    #[serde(default, skip_serializing)]
    pub credential: Option<String>,
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
    pub keychain_ref: String,
    pub fingerprint: String,
    pub reveal_requires_approval: bool,
    pub use_requires_approval: bool,
}

fn default_requires_approval() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct VaultDatabase {
    version: u32,
    entries: HashMap<String, VaultEntry>,
}

fn sanitize_keychain_part(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn vault_keychain_ref(profile_id: &str, id: &str) -> String {
    format!(
        "{}:{}:{}",
        KEYCHAIN_VAULT_SECRET_PREFIX,
        sanitize_keychain_part(profile_id),
        sanitize_keychain_part(id)
    )
}

fn fingerprint_secret(secret: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    let digest = hex::encode(hasher.finalize());
    format!("sha256:{}", &digest[..16])
}

fn is_legacy_secret_fingerprint(fingerprint: &str) -> bool {
    fingerprint.is_empty()
        || fingerprint == "••••"
        || fingerprint.contains('…')
        || fingerprint.starts_with("sk-")
        || !fingerprint.starts_with("sha256:")
}

fn entry_meta(e: &VaultEntry) -> VaultEntryMeta {
    VaultEntryMeta {
        id: e.id.clone(),
        name: e.name.clone(),
        entry_type: e.entry_type.clone(),
        provider: e.provider.clone(),
        created_at: e.created_at,
        last_accessed_at: e.last_accessed_at,
        access_count: e.access_count,
        keychain_ref: e.keychain_ref.clone(),
        fingerprint: e.fingerprint.clone(),
        reveal_requires_approval: e.reveal_requires_approval,
        use_requires_approval: e.use_requires_approval,
    }
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

fn vault_key_account(profile_id: &str) -> String {
    let safe_id = profile_id.replace(['/', '\\', '.', ' '], "_");
    format!("{}:{}", KEYCHAIN_VAULT_ACCOUNT_PREFIX, safe_id)
}

fn legacy_key_file() -> Result<PathBuf, String> {
    Ok(dirs::home_dir()
        .ok_or("No home dir")?
        .join(".edwinpai")
        .join("vault")
        .join(".vault-key"))
}

fn read_key_file(key_file: &PathBuf) -> Result<[u8; 32], String> {
    let hex_key = fs::read_to_string(key_file)
        .map_err(|e| format!("Failed to read vault key file: {}", e))?;
    let bytes =
        hex::decode(hex_key.trim()).map_err(|e| format!("Invalid vault key file: {}", e))?;
    if bytes.len() != 32 {
        return Err(format!("Vault key file wrong length: {}", bytes.len()));
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}

fn get_or_create_master_key(profile_id: &str) -> Result<[u8; 32], String> {
    // Use a namespace-scoped file key as primary (reliable across dev/prod).
    // OS keychain is used as secondary storage for production builds.
    let key_file = vault_dir(profile_id)?.join(".vault-key");

    if key_file.exists() {
        return read_key_file(&key_file);
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
    let _ = keychain.store_key(KEYCHAIN_SERVICE, &vault_key_account(profile_id), &hex_key);

    Ok(key)
}

// ============================================================================
// Encryption / Decryption
// ============================================================================

fn encrypt_vault(db: &VaultDatabase, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let plaintext =
        serde_json::to_vec(db).map_err(|e| format!("Failed to serialize vault: {}", e))?;

    let cipher =
        Aes256Gcm::new_from_slice(key).map_err(|e| format!("Failed to create cipher: {}", e))?;

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

    let cipher =
        Aes256Gcm::new_from_slice(key).map_err(|e| format!("Failed to create cipher: {}", e))?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed — wrong key or corrupted vault".to_string())?;

    serde_json::from_slice(&plaintext).map_err(|e| format!("Failed to parse vault: {}", e))
}

fn migrate_legacy_inline_credentials(
    profile_id: &str,
    db: &mut VaultDatabase,
) -> Result<bool, String> {
    let mut changed = false;
    let keychain = PlatformKeychain;
    for entry in db.entries.values_mut() {
        if entry.keychain_ref.is_empty() {
            entry.keychain_ref = vault_keychain_ref(profile_id, &entry.id);
            changed = true;
        }
        let legacy_inline_secret = entry.credential.clone();
        if let Some(secret) = entry.credential.take() {
            keychain
                .store_key(KEYCHAIN_SERVICE, &entry.keychain_ref, &secret)
                .map_err(|e| format!("Failed to migrate secret to OS keychain: {}", e.message))?;
            entry.fingerprint = fingerprint_secret(&secret);
            changed = true;
        } else if is_legacy_secret_fingerprint(&entry.fingerprint) {
            let secret = legacy_inline_secret.or_else(|| read_secret_from_keychain(entry).ok());
            if let Some(secret) = secret {
                entry.fingerprint = fingerprint_secret(&secret);
            } else if entry.fingerprint.is_empty() {
                entry.fingerprint = "sha256:unknown".to_string();
            }
            changed = true;
        }
    }
    Ok(changed)
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

    let data = fs::read(&path).map_err(|e| format!("Failed to read vault: {}", e))?;

    let key = get_or_create_master_key(profile_id)?;
    match decrypt_vault(&data, &key) {
        Ok(mut db) => {
            if migrate_legacy_inline_credentials(profile_id, &mut db)? {
                save_vault(profile_id, &db)?;
            }
            Ok(db)
        }
        Err(_) => {
            // Migration path: older Desktop builds used one shared key at
            // ~/.edwinpai/vault/.vault-key for every profile namespace. If this
            // profile has not been migrated yet, try the legacy key before
            // treating the vault as corrupted.
            if let Ok(legacy_path) = legacy_key_file() {
                let namespaced_path = vault_dir(profile_id)?.join(".vault-key");
                if legacy_path.exists() && legacy_path != namespaced_path {
                    if let Ok(legacy_key) = read_key_file(&legacy_path) {
                        if let Ok(mut db) = decrypt_vault(&data, &legacy_key) {
                            if migrate_legacy_inline_credentials(profile_id, &mut db)? {
                                save_vault(profile_id, &db)?;
                            } else {
                                save_vault(profile_id, &db)?;
                            }
                            eprintln!(
                                "[vault] Migrated vault namespace '{}' to a scoped master key",
                                profile_id
                            );
                            return Ok(db);
                        }
                    }
                }
            }

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
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create vault directory: {}", e))?;

    let key = get_or_create_master_key(profile_id)?;
    let encrypted = encrypt_vault(db, &key)?;

    let path = vault_path(profile_id)?;
    let tmp_path = path.with_extension("enc.tmp");

    fs::write(&tmp_path, &encrypted).map_err(|e| format!("Failed to write vault: {}", e))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("Failed to rename vault: {}", e))?;

    Ok(())
}

fn verify_signed_vault_payload(
    payload: &str,
    envelope: &SignedEnvelope,
    expected_action: &str,
    expected_id: &str,
) -> Result<(), String> {
    if envelope.alg != "BSV-ECDSA" {
        return Err("Unsupported signed envelope algorithm".to_string());
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    if envelope.exp < now {
        return Err("Signed vault approval envelope expired".to_string());
    }

    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    let payload_hash = hex::encode(hasher.finalize());
    if payload_hash != envelope.payload_hash {
        return Err("Signed vault approval payload hash mismatch".to_string());
    }

    let parsed: Value = serde_json::from_str(payload)
        .map_err(|e| format!("Invalid signed vault approval payload: {}", e))?;
    if parsed.get("actionType").and_then(Value::as_str) != Some(expected_action) {
        return Err("Signed vault approval action mismatch".to_string());
    }
    if parsed.get("vaultEntryId").and_then(Value::as_str) != Some(expected_id) {
        return Err("Signed vault approval entry mismatch".to_string());
    }

    let signing_data = format!(
        "{}|{}|{}|{}|{}",
        envelope.kid, envelope.iat, envelope.exp, envelope.nonce, envelope.payload_hash
    );
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.message)?;
    let verify = domain
        .verify(&VerifyRequest {
            data: signing_data.into_bytes(),
            signature: hex::decode(&envelope.sig)
                .map_err(|e| format!("Invalid signed vault approval signature: {}", e))?,
            public_key: envelope.pub_key.clone(),
        })
        .map_err(|e| e.message)?;
    if !verify.valid {
        return Err("Invalid signed vault approval signature".to_string());
    }
    Ok(())
}

fn read_secret_from_keychain(entry: &VaultEntry) -> Result<String, String> {
    let keychain = PlatformKeychain;
    keychain
        .get_key(KEYCHAIN_SERVICE, &entry.keychain_ref)
        .map_err(|e| format!("Failed to read secret from OS keychain: {}", e.message))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultUseResult {
    pub ok: bool,
    pub vault_entry_id: String,
    pub fingerprint: String,
    pub capability: String,
}

fn gateway_ws_url(gateway_url: &str) -> Result<String, String> {
    let mut url = gateway_url.trim().trim_end_matches('/').to_string();
    if url.starts_with("https://") {
        url = url.replacen("https://", "wss://", 1);
    } else if url.starts_with("http://") {
        url = url.replacen("http://", "ws://", 1);
    } else if !url.starts_with("ws://") && !url.starts_with("wss://") {
        return Err("Gateway URL must start with http://, https://, ws://, or wss://".to_string());
    }
    Ok(url)
}

async fn resolve_gateway_credential_with_secret(
    gateway_url: &str,
    gateway_token: Option<String>,
    request_id: &str,
    credential: String,
    lease_ms: Option<u64>,
    signed_envelope: SignedEnvelope,
) -> Result<(), String> {
    let ws_url = gateway_ws_url(gateway_url)?;
    let (mut ws, _) = connect_async(&ws_url)
        .await
        .map_err(|e| format!("Failed to connect to gateway websocket: {}", e))?;

    let connect = serde_json::json!({
        "type": "req",
        "id": "vault-use-connect",
        "method": "connect",
        "params": {
            "minProtocol": 3,
            "maxProtocol": 3,
            "client": {
                "id": "edwinpai-macos",
                "displayName": "EdwinPAI Desktop Vault",
                "version": env!("CARGO_PKG_VERSION"),
                "platform": "desktop",
                "mode": "ui"
            },
            "role": "operator",
            "scopes": ["operator.admin", "operator.approvals"],
            "auth": gateway_token.filter(|t| !t.is_empty()).map(|token| serde_json::json!({ "token": token }))
        }
    });
    ws.send(Message::Text(connect.to_string()))
        .await
        .map_err(|e| format!("Failed to send gateway handshake: {}", e))?;

    let mut handshake_ok = false;
    while let Some(msg) = ws.next().await {
        let msg = msg.map_err(|e| format!("Gateway websocket handshake failed: {}", e))?;
        if !msg.is_text() {
            continue;
        }
        let frame: Value = serde_json::from_str(msg.to_text().unwrap_or(""))
            .map_err(|e| format!("Invalid gateway handshake response: {}", e))?;
        if frame.get("type").and_then(Value::as_str) == Some("res")
            && frame.get("id").and_then(Value::as_str) == Some("vault-use-connect")
        {
            if frame.get("ok").and_then(Value::as_bool) == Some(true) {
                handshake_ok = true;
                break;
            }
            return Err(frame
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("Gateway handshake rejected")
                .to_string());
        }
    }
    if !handshake_ok {
        return Err("Gateway websocket closed before handshake completed".to_string());
    }

    let resolve = serde_json::json!({
        "type": "req",
        "id": "vault-use-resolve",
        "method": "credential.resolve",
        "params": {
            "requestId": request_id,
            "decision": "granted",
            "credential": credential,
            "leaseMs": lease_ms,
            "grantedBy": "desktop-vault",
            "signedEnvelope": signed_envelope
        }
    });
    ws.send(Message::Text(resolve.to_string()))
        .await
        .map_err(|e| format!("Failed to send credential resolution: {}", e))?;

    while let Some(msg) = ws.next().await {
        let msg = msg.map_err(|e| format!("Gateway credential resolution failed: {}", e))?;
        if !msg.is_text() {
            continue;
        }
        let frame: Value = serde_json::from_str(msg.to_text().unwrap_or(""))
            .map_err(|e| format!("Invalid credential resolution response: {}", e))?;
        if frame.get("type").and_then(Value::as_str) == Some("res")
            && frame.get("id").and_then(Value::as_str) == Some("vault-use-resolve")
        {
            if frame.get("ok").and_then(Value::as_bool) == Some(true) {
                let _ = ws.close(None).await;
                return Ok(());
            }
            return Err(frame
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("Credential resolution rejected")
                .to_string());
        }
    }
    Err("Gateway websocket closed before credential resolution completed".to_string())
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

    let keychain_ref = vault_keychain_ref(&profile_id, &id);
    let fingerprint = fingerprint_secret(&credential);
    let keychain = PlatformKeychain;
    keychain
        .store_key(KEYCHAIN_SERVICE, &keychain_ref, &credential)
        .map_err(|e| format!("Failed to store secret in OS keychain: {}", e.message))?;
    let verified_secret = keychain
        .get_key(KEYCHAIN_SERVICE, &keychain_ref)
        .map_err(|e| {
            format!(
                "Stored secret could not be read back from OS keychain; not saving Vault metadata: {}",
                e.message
            )
        })?;
    if verified_secret != credential {
        return Err(
            "Stored secret readback mismatch from OS keychain; not saving Vault metadata"
                .to_string(),
        );
    }

    let entry = VaultEntry {
        id: id.clone(),
        name: name.clone(),
        entry_type: entry_type.clone(),
        provider: provider.clone(),
        keychain_ref,
        fingerprint,
        reveal_requires_approval: true,
        use_requires_approval: true,
        metadata: metadata.unwrap_or_default(),
        credential: None,
        created_at: now,
        last_accessed_at: now,
        access_count: 0,
    };

    let meta = entry_meta(&entry);

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
            Some(read_secret_from_keychain(entry)?)
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
    let mut entries: Vec<VaultEntryMeta> = db.entries.values().map(entry_meta).collect();
    entries.sort_by(|a, b| b.last_accessed_at.cmp(&a.last_accessed_at));
    Ok(entries)
}

/// Delete a credential from the vault
#[tauri::command]
pub async fn vault_delete(profile_id: String, id: String) -> Result<bool, String> {
    let mut db = load_vault(&profile_id)?;
    let removed_entry = db.entries.remove(&id);
    if let Some(entry) = &removed_entry {
        let keychain = PlatformKeychain;
        let _ = keychain.delete_key(KEYCHAIN_SERVICE, &entry.keychain_ref);
        save_vault(&profile_id, &db)?;
    }
    Ok(removed_entry.is_some())
}

/// Reveal a credential from the vault after a signed high-sensitivity approval.
#[tauri::command]
pub async fn vault_reveal(
    profile_id: String,
    id: String,
    payload: String,
    envelope: SignedEnvelope,
) -> Result<Option<String>, String> {
    verify_signed_vault_payload(&payload, &envelope, "vault.secret.reveal", &id)?;
    vault_get(profile_id, id).await
}

/// Use a credential after signed approval without returning the raw value to React.
/// The secret is read inside the host process, sent directly to the gateway
/// credential resolver over a short-lived WebSocket, and then dropped.
#[tauri::command]
pub async fn vault_use_for_credential_request(
    profile_id: String,
    id: String,
    payload: String,
    envelope: SignedEnvelope,
    gateway_url: String,
    gateway_token: Option<String>,
    request_id: String,
    lease_ms: Option<u64>,
) -> Result<VaultUseResult, String> {
    verify_signed_vault_payload(&payload, &envelope, "vault.secret.use", &id)?;
    let mut db = load_vault(&profile_id)?;

    let (credential, fingerprint) = {
        let entry = db
            .entries
            .get_mut(&id)
            .ok_or_else(|| "Vault entry not found".to_string())?;
        entry.last_accessed_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis() as u64;
        entry.access_count += 1;
        (read_secret_from_keychain(entry)?, entry.fingerprint.clone())
    };

    save_vault(&profile_id, &db)?;
    resolve_gateway_credential_with_secret(
        &gateway_url,
        gateway_token,
        &request_id,
        credential,
        lease_ms,
        envelope,
    )
    .await?;

    Ok(VaultUseResult {
        ok: true,
        vault_entry_id: id.clone(),
        fingerprint,
        capability: format!("vault-use:{}:{}", id, request_id),
    })
}
