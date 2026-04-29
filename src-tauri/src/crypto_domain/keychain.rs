// Keychain integration (SPEC §3.4)
//
// Platform-specific secure key storage:
// - macOS: Keychain Access
// - Windows: Credential Manager
// - Linux: Secret Service (libsecret)

use keyring::Entry;

use super::traits::KeychainAccess;
use super::types::{CryptoError, CryptoErrorCode, CryptoResult};

pub struct PlatformKeychain;

impl KeychainAccess for PlatformKeychain {
    fn store_key(&self, service: &str, account: &str, key: &str) -> CryptoResult<()> {
        let entry = Entry::new(service, account).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Keychain entry creation failed: {}", e),
        })?;

        entry.set_password(key).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Keychain store failed: {}", e),
        })?;

        Ok(())
    }

    fn get_key(&self, service: &str, account: &str) -> CryptoResult<String> {
        let entry = Entry::new(service, account).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Keychain entry creation failed: {}", e),
        })?;

        entry.get_password().map_err(|e| CryptoError {
            code: CryptoErrorCode::KeyNotFound,
            message: format!("Keychain get failed: {}", e),
        })
    }

    fn delete_key(&self, service: &str, account: &str) -> CryptoResult<()> {
        let entry = Entry::new(service, account).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Keychain entry creation failed: {}", e),
        })?;

        entry.delete_credential().map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Keychain delete failed: {}", e),
        })?;

        Ok(())
    }

    fn key_exists(&self, service: &str, account: &str) -> bool {
        if let Ok(entry) = Entry::new(service, account) {
            entry.get_password().is_ok()
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires platform keychain (Secret Service on Linux)"]
    fn test_keychain_lifecycle() {
        let keychain = PlatformKeychain;
        let service = "com.edwinpai.test";
        let account = "test-user";
        let test_key = "test-secret-key";

        // Clean up any existing test key
        let _ = keychain.delete_key(service, account);

        // Store
        let result = keychain.store_key(service, account, test_key);
        assert!(result.is_ok(), "Store should succeed");

        // Check exists
        assert!(keychain.key_exists(service, account));

        // Retrieve
        let retrieved = keychain.get_key(service, account);
        assert!(retrieved.is_ok());
        assert_eq!(retrieved.unwrap(), test_key);

        // Delete
        let result = keychain.delete_key(service, account);
        assert!(result.is_ok());

        // Verify deleted
        assert!(!keychain.key_exists(service, account));
    }

    #[test]
    #[ignore = "requires platform keychain (Secret Service on Linux)"]
    fn test_keychain_save_and_load() {
        let keychain = PlatformKeychain;
        let service = "com.edwinpai.test.save";
        let account = "save-test";
        let secret = "my-secret-key-12345";

        // Clean up
        let _ = keychain.delete_key(service, account);

        // Save key
        assert!(keychain.store_key(service, account, secret).is_ok());

        // Load key
        let loaded = keychain.get_key(service, account);
        assert!(loaded.is_ok());
        assert_eq!(loaded.unwrap(), secret);

        // Cleanup
        let _ = keychain.delete_key(service, account);
    }

    #[test]
    #[ignore = "requires platform keychain (Secret Service on Linux)"]
    fn test_keychain_update_existing_key() {
        let keychain = PlatformKeychain;
        let service = "com.edwinpai.test.update";
        let account = "update-test";
        let original_key = "original-key";
        let updated_key = "updated-key";

        // Clean up
        let _ = keychain.delete_key(service, account);

        // Store original
        assert!(keychain.store_key(service, account, original_key).is_ok());
        assert_eq!(keychain.get_key(service, account).unwrap(), original_key);

        // Update with new value
        assert!(keychain.store_key(service, account, updated_key).is_ok());

        // Verify update
        let retrieved = keychain.get_key(service, account).unwrap();
        assert_eq!(retrieved, updated_key);
        assert_ne!(retrieved, original_key);

        // Cleanup
        let _ = keychain.delete_key(service, account);
    }

    #[test]
    fn test_keychain_get_nonexistent_key() {
        let keychain = PlatformKeychain;
        let service = "com.edwinpai.test.nonexistent";
        let account = "nonexistent-account";

        // Ensure key doesn't exist
        let _ = keychain.delete_key(service, account);

        // Try to get nonexistent key
        let result = keychain.get_key(service, account);
        assert!(result.is_err(), "Should error for nonexistent key");

        // Verify key_exists returns false
        assert!(!keychain.key_exists(service, account));
    }
}
