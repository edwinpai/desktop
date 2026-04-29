// Multi-User Authorization - Invitation Management
//
// Handles invitation lifecycle: create, redeem, revoke, expiry checks.
// File location: ~/.edwinpai/invitations.json
//
// Invitation flow:
// 1. Owner creates invitation with expiry time
// 2. Invitation encoded in QR code (JSON payload)
// 3. Client scans QR, redeems invitation
// 4. Redemption adds client to authorized_users.json
//
// Phase 4 implementation per PLAN.md

use super::types::{AccessLevel, Invitation, InvitationDatabase, InvitationData, InvitationStatus};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Invitation manager with file-based persistence
#[derive(Clone)]
pub struct InvitationManager {
    database: Arc<Mutex<InvitationDatabase>>,
    file_path: PathBuf,
}

impl InvitationManager {
    /// Create a new invitation manager
    pub fn new() -> Result<Self, String> {
        let file_path = Self::get_file_path()?;
        let database = Arc::new(Mutex::new(InvitationDatabase::new()));

        Ok(Self {
            database,
            file_path,
        })
    }

    /// Get invitations file path: ~/.edwinpai/invitations.json
    fn get_file_path() -> Result<PathBuf, String> {
        let home_dir = dirs::home_dir()
            .ok_or("Failed to determine home directory")?;

        let config_dir = home_dir.join(".edwinpai");
        Ok(config_dir.join("invitations.json"))
    }

    /// Load invitations from file
    pub async fn load(&self) -> Result<InvitationDatabase, String> {
        use tokio::fs;

        // Check if file exists
        if !self.file_path.exists() {
            // Return empty database if file doesn't exist
            return Ok(InvitationDatabase::new());
        }

        // Read file
        let contents = fs::read_to_string(&self.file_path)
            .await
            .map_err(|e| format!("Failed to read invitations file: {}", e))?;

        // Parse JSON
        let mut db: InvitationDatabase = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse invitations JSON: {}", e))?;

        // Cleanup expired invitations on load
        db.cleanup_expired();

        // Update in-memory database
        {
            let mut db_lock = self.database.lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            *db_lock = db.clone();
        }

        Ok(db)
    }

    /// Save invitations to file
    pub async fn save(&self, db: InvitationDatabase) -> Result<(), String> {
        use tokio::fs;

        // Ensure directory exists
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        // Serialize to JSON (pretty-printed)
        let json = serde_json::to_string_pretty(&db)
            .map_err(|e| format!("Failed to serialize invitations: {}", e))?;

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
    pub fn get(&self) -> Result<InvitationDatabase, String> {
        let db = self.database.lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        Ok(db.clone())
    }

    /// Create invitation (owner only)
    pub async fn create_invitation(
        &self,
        level: AccessLevel,
        expires_in_hours: u64,
        created_by: String,
    ) -> Result<Invitation, String> {
        // Owner cannot be invited (owner is set during initial setup)
        if level == AccessLevel::Owner {
            return Err("Cannot create invitation for owner level".to_string());
        }

        let mut db = self.get()?;

        let invitation = Invitation::new(level, expires_in_hours, created_by);
        db.add_invitation(invitation.clone());

        self.save(db).await?;
        Ok(invitation)
    }

    /// Get invitation by token
    pub fn get_invitation(&self, token: &str) -> Result<Option<Invitation>, String> {
        let db = self.get()?;
        Ok(db.get_invitation(token).cloned())
    }

    /// Redeem invitation
    pub async fn redeem_invitation(
        &self,
        token: &str,
        pubkey: String,
    ) -> Result<AccessLevel, String> {
        let mut db = self.get()?;

        let invitation = db.get_invitation_mut(token)
            .ok_or_else(|| "Invitation not found".to_string())?;

        // Check if invitation is valid
        if !invitation.is_valid() {
            if invitation.status == InvitationStatus::Accepted {
                return Err("Invitation already used".to_string());
            } else if invitation.status == InvitationStatus::Revoked {
                return Err("Invitation revoked".to_string());
            } else if invitation.is_expired() {
                return Err("Invitation expired".to_string());
            } else {
                return Err("Invalid invitation".to_string());
            }
        }

        let access_level = invitation.level;
        invitation.redeem(pubkey);

        self.save(db).await?;
        Ok(access_level)
    }

    /// Revoke invitation (owner only)
    pub async fn revoke_invitation(&self, token: &str) -> Result<(), String> {
        let mut db = self.get()?;

        let invitation = db.get_invitation_mut(token)
            .ok_or_else(|| "Invitation not found".to_string())?;

        // Can only revoke pending invitations
        if invitation.status != InvitationStatus::Pending {
            return Err(format!("Cannot revoke invitation with status: {:?}", invitation.status));
        }

        invitation.revoke();
        self.save(db).await
    }

    /// List all invitations (optionally filter by status)
    pub fn list_invitations(&self, status_filter: Option<InvitationStatus>) -> Result<Vec<Invitation>, String> {
        let db = self.get()?;

        let invitations: Vec<Invitation> = match status_filter {
            Some(status) => db.invitations
                .values()
                .filter(|inv| inv.status == status)
                .cloned()
                .collect(),
            None => db.invitations.values().cloned().collect(),
        };

        Ok(invitations)
    }

    /// Cleanup expired invitations
    pub async fn cleanup_expired(&self) -> Result<usize, String> {
        let mut db = self.get()?;

        let before_count = db.invitations.len();
        db.cleanup_expired();
        let after_count = db.invitations.len();

        if before_count != after_count {
            self.save(db).await?;
        }

        Ok(before_count - after_count)
    }

    /// Generate invitation data for QR code
    pub fn generate_invitation_data(
        &self,
        token: &str,
        gateway_pubkey: String,
        gateway_address: String,
        petname: Option<String>,
    ) -> Result<InvitationData, String> {
        let invitation = self.get_invitation(token)?
            .ok_or_else(|| "Invitation not found".to_string())?;

        if !invitation.is_valid() {
            return Err("Invitation is not valid".to_string());
        }

        Ok(InvitationData::new(
            gateway_pubkey,
            gateway_address,
            invitation,
            petname,
        ))
    }

    /// Get file path (for display purposes)
    pub fn file_path(&self) -> &PathBuf {
        &self.file_path
    }
}

impl Default for InvitationManager {
    fn default() -> Self {
        Self::new().expect("Failed to create invitation manager")
    }
}

/// Global invitation manager instance
static INVITATION_MANAGER: once_cell::sync::Lazy<Arc<Mutex<Option<InvitationManager>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Initialize global invitation manager
pub fn init_invitation_manager() -> Result<(), String> {
    let mut manager_lock = INVITATION_MANAGER.lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let manager = InvitationManager::new()?;
    *manager_lock = Some(manager);

    Ok(())
}

/// Get global invitation manager instance
pub fn get_invitation_manager() -> Arc<Mutex<Option<InvitationManager>>> {
    INVITATION_MANAGER.clone()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invitation_manager_creation() {
        let manager = InvitationManager::new();
        assert!(manager.is_ok());

        let manager = manager.unwrap();
        let db = manager.get().unwrap();
        assert_eq!(db.invitations.len(), 0);
    }

    #[test]
    fn test_file_path_format() {
        let path = InvitationManager::get_file_path().unwrap();
        let path_str = path.to_string_lossy();

        assert!(path_str.contains(".edwinpai"));
        assert!(path_str.ends_with("invitations.json"));
        assert!(path.is_absolute());
    }

    #[tokio::test]
    async fn test_create_invitation() {
        let manager = InvitationManager::new().unwrap();

        let invitation = manager.create_invitation(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        ).await;

        assert!(invitation.is_ok());
        let inv = invitation.unwrap();
        assert_eq!(inv.level, AccessLevel::Member);
        assert_eq!(inv.status, InvitationStatus::Pending);
        assert!(inv.is_valid());
        assert_eq!(inv.token.len(), 64); // 32 bytes hex = 64 chars
    }

    #[tokio::test]
    async fn test_cannot_create_owner_invitation() {
        let manager = InvitationManager::new().unwrap();

        let result = manager.create_invitation(
            AccessLevel::Owner,
            24,
            "03owner...".to_string(),
        ).await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot create invitation for owner"));
    }

    #[tokio::test]
    async fn test_redeem_invitation() {
        let manager = InvitationManager::new().unwrap();

        // Create invitation
        let invitation = manager.create_invitation(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        ).await.unwrap();

        let token = invitation.token.clone();

        // Redeem invitation
        let result = manager.redeem_invitation(&token, "03member...".to_string()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), AccessLevel::Member);

        // Verify invitation marked as accepted
        let inv = manager.get_invitation(&token).unwrap().unwrap();
        assert_eq!(inv.status, InvitationStatus::Accepted);
        assert_eq!(inv.redeemed_by.as_deref(), Some("03member..."));
        assert!(!inv.is_valid());
    }

    #[tokio::test]
    async fn test_cannot_redeem_twice() {
        let manager = InvitationManager::new().unwrap();

        let invitation = manager.create_invitation(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        ).await.unwrap();

        let token = invitation.token.clone();

        // First redemption - should succeed
        assert!(manager.redeem_invitation(&token, "03member1...".to_string()).await.is_ok());

        // Second redemption - should fail
        let result = manager.redeem_invitation(&token, "03member2...".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already used"));
    }

    #[tokio::test]
    async fn test_revoke_invitation() {
        let manager = InvitationManager::new().unwrap();

        let invitation = manager.create_invitation(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        ).await.unwrap();

        let token = invitation.token.clone();

        // Revoke invitation
        let result = manager.revoke_invitation(&token).await;
        assert!(result.is_ok());

        // Verify invitation marked as revoked
        let inv = manager.get_invitation(&token).unwrap().unwrap();
        assert_eq!(inv.status, InvitationStatus::Revoked);
        assert!(!inv.is_valid());

        // Cannot redeem revoked invitation
        let redeem_result = manager.redeem_invitation(&token, "03member...".to_string()).await;
        assert!(redeem_result.is_err());
        assert!(redeem_result.unwrap_err().contains("revoked"));
    }

    #[tokio::test]
    async fn test_cannot_revoke_accepted_invitation() {
        let manager = InvitationManager::new().unwrap();

        let invitation = manager.create_invitation(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        ).await.unwrap();

        let token = invitation.token.clone();

        // Redeem first
        manager.redeem_invitation(&token, "03member...".to_string()).await.unwrap();

        // Cannot revoke after redemption
        let result = manager.revoke_invitation(&token).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot revoke"));
    }

    #[tokio::test]
    async fn test_list_invitations() {
        let manager = InvitationManager::new().unwrap();

        // Create multiple invitations
        manager.create_invitation(AccessLevel::Member, 24, "03owner...".to_string()).await.unwrap();
        let inv2 = manager.create_invitation(AccessLevel::Guest, 48, "03owner...".to_string()).await.unwrap();

        // Redeem one
        manager.redeem_invitation(&inv2.token, "03guest...".to_string()).await.unwrap();

        // List all
        let all = manager.list_invitations(None).unwrap();
        assert_eq!(all.len(), 2);

        // List pending
        let pending = manager.list_invitations(Some(InvitationStatus::Pending)).unwrap();
        assert_eq!(pending.len(), 1);

        // List accepted
        let accepted = manager.list_invitations(Some(InvitationStatus::Accepted)).unwrap();
        assert_eq!(accepted.len(), 1);
    }

    #[tokio::test]
    async fn test_generate_invitation_data() {
        let manager = InvitationManager::new().unwrap();

        let invitation = manager.create_invitation(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        ).await.unwrap();

        let token = invitation.token.clone();

        let data = manager.generate_invitation_data(
            &token,
            "03gateway...".to_string(),
            "192.168.1.100:18789".to_string(),
            Some("Swift Falcon".to_string()),
        );

        assert!(data.is_ok());
        let inv_data = data.unwrap();
        assert_eq!(inv_data.version, "edwinpai-invite-v1");
        assert_eq!(inv_data.invitation.level, AccessLevel::Member);
        assert_eq!(inv_data.invitation.gateway_pubkey, "03gateway...");
        assert_eq!(inv_data.petname.as_deref(), Some("Swift Falcon"));
    }

    #[tokio::test]
    async fn test_save_and_load() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let manager = InvitationManager {
            database: Arc::new(Mutex::new(InvitationDatabase::new())),
            file_path: temp_dir.join("invitations.json"),
        };

        // Create invitation
        let invitation = manager.create_invitation(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        ).await.unwrap();

        let token = invitation.token.clone();

        // Load in new instance
        let loaded_db = manager.load().await.unwrap();
        assert_eq!(loaded_db.invitations.len(), 1);
        assert!(loaded_db.invitations.contains_key(&token));

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }

    #[tokio::test]
    async fn test_cleanup_expired() {
        let manager = InvitationManager::new().unwrap();

        // Create an invitation with 0 hours expiry (already expired)
        // Note: We can't easily test this without mocking time, so we'll test the cleanup logic
        // by directly manipulating the database

        let mut db = manager.get().unwrap();

        // Create an already-expired invitation
        let mut expired_inv = Invitation::new(AccessLevel::Member, 1, "03owner...".to_string());
        // Manually set expires_at to the past
        expired_inv.expires_at = "2020-01-01T00:00:00Z".to_string();
        db.add_invitation(expired_inv);

        // Create a valid invitation
        let valid_inv = Invitation::new(AccessLevel::Guest, 24, "03owner...".to_string());
        db.add_invitation(valid_inv);

        manager.save(db).await.unwrap();

        // Cleanup should mark expired invitation
        let cleaned = manager.cleanup_expired().await.unwrap();
        // Note: cleanup_expired doesn't remove, it just marks status as Expired
        // So count will be 0 (no items removed)
        assert_eq!(cleaned, 0);

        // But the invitation should be marked as expired
        let db_after = manager.get().unwrap();
        let expired_count = db_after.invitations.values()
            .filter(|inv| inv.status == InvitationStatus::Expired)
            .count();
        assert_eq!(expired_count, 1);
    }

    #[tokio::test]
    async fn test_atomic_write() {
        use tokio::fs;

        let temp_dir = std::env::temp_dir().join(format!("edwinpai-test-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&temp_dir).await.unwrap();

        let manager = InvitationManager {
            database: Arc::new(Mutex::new(InvitationDatabase::new())),
            file_path: temp_dir.join("invitations.json"),
        };

        // Create invitation (triggers save)
        manager.create_invitation(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        ).await.unwrap();

        // Verify no .tmp file left behind
        let tmp_path = manager.file_path.with_extension("json.tmp");
        assert!(!tmp_path.exists());

        // Verify final file exists
        assert!(manager.file_path.exists());

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir).await;
    }
}
