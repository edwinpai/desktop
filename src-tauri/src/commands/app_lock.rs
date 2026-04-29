// App Lock - PIN/password protection for EdwinPAI Desktop
//
// Security model:
// - PIN is never stored in plaintext
// - Verification hash = HMAC-SHA256(PIN, identity_key)
// - Ties app lock to BSV identity (can't bypass without the key)
// - Stored in ~/.edwinpai/app-lock.json

use serde::{Deserialize, Serialize};
use sha2::Sha256;
use hmac::{Hmac, Mac};

use crate::crypto_domain::{EdwinPAICryptoDomain, CryptoDomain};

type HmacSha256 = Hmac<Sha256>;

const LOCK_FILE: &str = "app-lock.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppLockData {
    /// HMAC-SHA256 hash of the PIN using identity key
    pin_hash: String,
    /// Whether lock is enabled
    enabled: bool,
    /// Number of failed attempts since last success
    failed_attempts: u32,
    /// Lock type for UI hints
    lock_type: String,
}

fn lock_file_path() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".edwinpai").join(LOCK_FILE))
}

fn read_lock_data() -> Option<AppLockData> {
    let path = lock_file_path()?;
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn write_lock_data(data: &AppLockData) -> Result<(), String> {
    let path = lock_file_path().ok_or("Could not determine home directory")?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

fn compute_pin_hash(pin: &str) -> Result<String, String> {
    // Get identity key to use as HMAC key
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.message)?;
    let identity = domain.get_identity().map_err(|e| e.message)?;

    // HMAC-SHA256(pin, pubkey) — ties PIN to identity
    let mut mac = HmacSha256::new_from_slice(identity.public_key.as_bytes())
        .map_err(|e| format!("HMAC error: {}", e))?;
    mac.update(pin.as_bytes());
    let result = mac.finalize();

    Ok(hex::encode(result.into_bytes()))
}

/// Check if app lock (PIN) is configured
#[tauri::command]
pub async fn has_app_lock() -> Result<bool, String> {
    Ok(read_lock_data().map(|d| d.enabled).unwrap_or(false))
}

/// Set up app lock with a PIN
#[tauri::command]
pub async fn set_app_lock(pin: String) -> Result<(), String> {
    if pin.len() < 4 {
        return Err("PIN must be at least 4 characters".to_string());
    }

    let pin_hash = compute_pin_hash(&pin)?;

    let data = AppLockData {
        pin_hash,
        enabled: true,
        failed_attempts: 0,
        lock_type: "pin".to_string(),
    };

    write_lock_data(&data)?;
    Ok(())
}

/// Verify PIN to unlock the app
#[tauri::command]
pub async fn verify_app_lock(pin: String) -> Result<bool, String> {
    let mut data = read_lock_data().ok_or("No app lock configured")?;

    if !data.enabled {
        return Ok(true);
    }

    let pin_hash = compute_pin_hash(&pin)?;

    if pin_hash == data.pin_hash {
        // Reset failed attempts on success
        data.failed_attempts = 0;
        let _ = write_lock_data(&data);
        Ok(true)
    } else {
        // Track failed attempts
        data.failed_attempts += 1;
        let _ = write_lock_data(&data);
        Ok(false)
    }
}

/// Disable app lock (requires current PIN)
#[tauri::command]
pub async fn disable_app_lock(pin: String) -> Result<(), String> {
    let data = read_lock_data().ok_or("No app lock configured")?;

    let pin_hash = compute_pin_hash(&pin)?;
    if pin_hash != data.pin_hash {
        return Err("Incorrect PIN".to_string());
    }

    let updated = AppLockData {
        enabled: false,
        failed_attempts: 0,
        ..data
    };

    write_lock_data(&updated)?;
    Ok(())
}

/// Get lock status (for UI)
#[tauri::command]
pub async fn get_lock_status() -> Result<LockStatusResponse, String> {
    match read_lock_data() {
        Some(data) => Ok(LockStatusResponse {
            enabled: data.enabled,
            failed_attempts: data.failed_attempts,
            lock_type: data.lock_type,
        }),
        None => Ok(LockStatusResponse {
            enabled: false,
            failed_attempts: 0,
            lock_type: "none".to_string(),
        }),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LockStatusResponse {
    pub enabled: bool,
    pub failed_attempts: u32,
    pub lock_type: String,
}
