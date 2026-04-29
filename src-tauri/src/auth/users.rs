// Multi-User Authorization - User Management
//
// Handles CRUD operations for authorized users with file-based persistence.
// File location: ~/.edwinpai/authorized_users.json
//
// Access control:
// - Owner: can manage users, read/write
// - Member: read/write, no user management
// - Guest: read-only
//
// Phase 4 implementation per PLAN.md

use super::types::{AccessLevel, AuthUser, UserDatabase};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// User manager with file-based persistence
#[derive(Clone)]
pub struct UserManager {
    database: Arc<Mutex<UserDatabase>>,
    file_path: PathBuf,
}

impl UserManager {
    /// Create a new user manager
    pub fn new() -> Result<Self, String> {
        let file_path = Self::get_file_path()?;
        let database = Arc::new(Mutex::new(UserDatabase::new()));

        Ok(Self {
            database,
            file_path,
        })
    }

    /// Get authorized users file path: ~/.edwinpai/authorized_users.json
    fn get_file_path() -> Result<PathBuf, String> {
        let home_dir = dirs::home_dir()
            .ok_or("Failed to determine home directory")?;

        let config_dir = home_dir.join(".edwinpai");
        Ok(config_dir.join("authorized_users.json"))
    }

    /// Load users from file
    pub async fn load(&self) -> Result<UserDatabase, String> {
        use tokio::fs;

        // Check if file exists
        if !self.file_path.exists() {
            // Return empty database if file doesn't exist
            return Ok(UserDatabase::new());
        }

        // Read file
        let contents = fs::read_to_string(&self.file_path)
            .await
            .map_err(|e| format!("Failed to read users file: {}", e))?;

        // Parse JSON
        let db: UserDatabase = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse users JSON: {}", e))?;

        // Update in-memory database
        {
            let mut db_lock = self.database.lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            *db_lock = db.clone();
        }

        Ok(db)
    }

    /// Save users to file
    pub async fn save(&self, db: UserDatabase) -> Result<(), String> {
        use tokio::fs;

        // Ensure directory exists
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        // Serialize to JSON (pretty-printed)
        let json = serde_json::to_string_pretty(&db)
            .map_err(|e| format!("Failed to serialize users: {}", e))?;

        // Write to file atomically (tmp file + rename)
        let tmp_path = self.file_path.with_extension("json.tmp");
        fs::write(&tmp_path, json)
            .await
            .map_err(|e| format!("Failed to write tmp file: {}", e))?;

        fs::rename(&tmp_path, &self.file_path)
            .await
            .map_err(|e| format!("Failed to rename tmp file: {}", e))?;

        // Update in-memory database
        {
            let mut db_lock = self.database.lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            *db_lock = db;
        }

        Ok(())
    }

    /// Get current database
    pub fn get(&self) -> Result<UserDatabase, String> {
        let db = self.database.lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        Ok(db.clone())
    }

    /// Add user (owner only)
    pub async fn add_user(&self, user: AuthUser) -> Result<(), String> {
        let mut db = self.get()?;

        // Check if user already exists
        if db.users.contains_key(&user.pubkey) {
            return Err(format!("User {} already exists", user.pubkey));
        }

        db.add_user(user);
        self.save(db).await
    }

    /// Remove user (owner only)
    pub async fn remove_user(&self, pubkey: &str) -> Result<AuthUser, String> {
        let mut db = self.get()?;

        let removed = db.remove_user(pubkey)
            .ok_or_else(|| format!("User {} not found", pubkey))?;

        self.save(db).await?;
        Ok(removed)
    }

    /// Get user by public key
    pub fn get_user(&self, pubkey: &str) -> Result<Option<AuthUser>, String> {
        let db = self.get()?;
        Ok(db.get_user(pubkey).cloned())
    }

    /// List all users
    pub fn list_users(&self) -> Result<Vec<AuthUser>, String> {
        let db = self.get()?;
        Ok(db.users.values().cloned().collect())
    }

    /// Update user's last activity timestamp
    pub async fn update_last_active(&self, pubkey: &str) -> Result<(), String> {
        let mut db = self.get()?;

        if !db.users.contains_key(pubkey) {
            return Err(format!("User {} not found", pubkey));
        }

        db.update_last_active(pubkey);
        self.save(db).await
    }

    /// Check if user is authorized and get their access level
    pub fn check_authorization(&self, pubkey: &str) -> Result<Option<AccessLevel>, String> {
        let user = self.get_user(pubkey)?;
        Ok(user.map(|u| u.level))
    }

    /// Check if user has owner privileges
    pub fn is_owner(&self, pubkey: &str) -> Result<bool, String> {
        match self.check_authorization(pubkey)? {
            Some(AccessLevel::Owner) => Ok(true),
            _ => Ok(false),
        }
    }

    /// Get file path (for display purposes)
    pub fn file_path(&self) -> &PathBuf {
        &self.file_path
    }
}

impl Default for UserManager {
    fn default() -> Self {
        Self::new().expect("Failed to create user manager")
    }
}

/// Global user manager instance
static USER_MANAGER: once_cell::sync::Lazy<Arc<Mutex<Option<UserManager>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Initialize global user manager
pub fn init_user_manager() -> Result<(), String> {
    let mut manager_lock = USER_MANAGER.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let manager = UserManager::new()?;
    *manager_lock = Some(manager);

    Ok(())
}

/// Get global user manager instance
pub fn get_user_manager() -> Arc<Mutex<Option<UserManager>>> {
    USER_MANAGER.clone()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_manager_creation() {
        let manager = UserManager::new();
        assert!(manager.is_ok());

        let manager = manager.unwrap();
        let db = manager.get().unwrap();
        assert_eq!(db.users.len(), 0);
    }

    #[test]
    fn test_file_path_format() {
        let path = UserManager::get_file_path().unwrap();
        let path_str = path.to_string_lossy();

        assert!(path_str.contains(".edwinpai"));
        assert!(path_str.ends_with("authorized_users.json"));
        assert!(path.is_absolute());
    }

    #[tokio::test]
    async fn test_add_and_remove_user() {
        let manager = UserManager::new().unwrap();

        let user = AuthUser {
            pubkey: "03abc123...".to_string(),
            petname: "Swift Falcon".to_string(),
            level: AccessLevel::Member,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: Some("03owner...".to_string()),
        };

        // Add user
        let add_result = manager.add_user(user.clone()).await;
        assert!(add_result.is_ok());

        // Verify user exists
        let found = manager.get_user("03abc123...").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().petname, "Swift Falcon");

        // Remove user
        let removed = manager.remove_user("03abc123...").await;
        assert!(removed.is_ok());
        assert_eq!(removed.unwrap().petname, "Swift Falcon");

        // Verify user removed
        let not_found = manager.get_user("03abc123...").unwrap();
        assert!(not_found.is_none());
    }

    #[tokio::test]
    async fn test_duplicate_user_error() {
        let manager = UserManager::new().unwrap();

        let user = AuthUser {
            pubkey: "03duplicate...".to_string(),
            petname: "Test User".to_string(),
            level: AccessLevel::Member,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: None,
        };

        // Add user first time - should succeed
        assert!(manager.add_user(user.clone()).await.is_ok());

        // Add same user again - should fail
        let result = manager.add_user(user).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[tokio::test]
    async fn test_remove_nonexistent_user_error() {
        let manager = UserManager::new().unwrap();

        let result = manager.remove_user("03nonexistent...").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[tokio::test]
    async fn test_list_users() {
        let manager = UserManager::new().unwrap();

        // Start with empty list
        let users = manager.list_users().unwrap();
        assert_eq!(users.len(), 0);

        // Add multiple users
        let user1 = AuthUser {
            pubkey: "03user1...".to_string(),
            petname: "User One".to_string(),
            level: AccessLevel::Owner,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: None,
        };

        let user2 = AuthUser {
            pubkey: "03user2...".to_string(),
            petname: "User Two".to_string(),
            level: AccessLevel::Member,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: Some("03user1...".to_string()),
        };

        manager.add_user(user1).await.unwrap();
        manager.add_user(user2).await.unwrap();

        // List should contain both users
        let users = manager.list_users().unwrap();
        assert_eq!(users.len(), 2);
    }

    #[tokio::test]
    async fn test_update_last_active() {
        let manager = UserManager::new().unwrap();

        let user = AuthUser {
            pubkey: "03active...".to_string(),
            petname: "Active User".to_string(),
            level: AccessLevel::Member,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: "2026-01-01T00:00:00Z".to_string(),
            invited_by: None,
        };

        manager.add_user(user).await.unwrap();

        // Update last active
        let result = manager.update_last_active("03active...").await;
        assert!(result.is_ok());

        // Verify timestamp updated
        let updated_user = manager.get_user("03active...").unwrap().unwrap();
        assert_ne!(updated_user.last_active, "2026-01-01T00:00:00Z");
    }

    #[tokio::test]
    async fn test_check_authorization() {
        let manager = UserManager::new().unwrap();

        let owner = AuthUser {
            pubkey: "03owner...".to_string(),
            petname: "Owner".to_string(),
            level: AccessLevel::Owner,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: None,
        };

        let member = AuthUser {
            pubkey: "03member...".to_string(),
            petname: "Member".to_string(),
            level: AccessLevel::Member,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: Some("03owner...".to_string()),
        };

        manager.add_user(owner).await.unwrap();
        manager.add_user(member).await.unwrap();

        // Check owner
        let owner_level = manager.check_authorization("03owner...").unwrap();
        assert_eq!(owner_level, Some(AccessLevel::Owner));
        assert!(manager.is_owner("03owner...").unwrap());

        // Check member
        let member_level = manager.check_authorization("03member...").unwrap();
        assert_eq!(member_level, Some(AccessLevel::Member));
        assert!(!manager.is_owner("03member...").unwrap());

        // Check nonexistent
        let none_level = manager.check_authorization("03nonexistent...").unwrap();
        assert_eq!(none_level, None);
    }

    #[tokio::test]
    async fn test_save_and_load() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let manager = UserManager {
            database: Arc::new(Mutex::new(UserDatabase::new())),
            file_path: temp_dir.join("authorized_users.json"),
        };

        let user = AuthUser {
            pubkey: "03persist...".to_string(),
            petname: "Persistent User".to_string(),
            level: AccessLevel::Member,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: None,
        };

        // Add and save
        manager.add_user(user).await.unwrap();

        // Load in new instance
        let loaded_db = manager.load().await.unwrap();
        assert_eq!(loaded_db.users.len(), 1);
        assert!(loaded_db.users.contains_key("03persist..."));

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }

    #[tokio::test]
    async fn test_atomic_write() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let manager = UserManager {
            database: Arc::new(Mutex::new(UserDatabase::new())),
            file_path: temp_dir.join("authorized_users.json"),
        };

        let user = AuthUser {
            pubkey: "03atomic...".to_string(),
            petname: "Atomic Test".to_string(),
            level: AccessLevel::Member,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: None,
        };

        // Save should use tmp file + rename (atomic)
        manager.add_user(user).await.unwrap();

        // Verify no .tmp file left behind
        let tmp_path = manager.file_path.with_extension("json.tmp");
        assert!(!tmp_path.exists());

        // Verify final file exists
        assert!(manager.file_path.exists());

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }
}
