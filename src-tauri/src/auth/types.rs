// Multi-User Authorization - Rust Type Definitions
//
// Defines type contracts for:
// - BRC-103 authentication and authorization
// - User management and access control
// - Invitation lifecycle
// - Nonce tracking and replay prevention
//
// All implementation nodes MUST import from this module.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Access Control Types
// ============================================================================

/// Access level for multi-user authorization (SPEC §12.2)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccessLevel {
    /// Full access: manage users, read/write
    Owner,
    /// Standard access: read/write, no user management
    Member,
    /// Limited access: read-only
    Guest,
}

impl AccessLevel {
    pub fn can_manage_users(&self) -> bool {
        matches!(self, AccessLevel::Owner)
    }

    pub fn can_write(&self) -> bool {
        matches!(self, AccessLevel::Owner | AccessLevel::Member)
    }

    pub fn can_read(&self) -> bool {
        true // All levels can read
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "owner" => Some(AccessLevel::Owner),
            "member" => Some(AccessLevel::Member),
            "guest" => Some(AccessLevel::Guest),
            _ => None,
        }
    }
}

impl std::fmt::Display for AccessLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Owner => write!(f, "owner"),
            Self::Member => write!(f, "member"),
            Self::Guest => write!(f, "guest"),
        }
    }
}

// ============================================================================
// User Management Types
// ============================================================================

/// Authorized user record
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthUser {
    /// User's public key (hex-encoded compressed secp256k1)
    pub pubkey: String,

    /// User's petname
    pub petname: String,

    /// Access level granted
    pub level: AccessLevel,

    /// Authorization timestamp (ISO 8601)
    pub authorized_at: String,

    /// Last activity timestamp (ISO 8601)
    pub last_active: String,

    /// Invited by (public key, None if owner)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invited_by: Option<String>,
}

/// User database (in-memory, persisted to file)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDatabase {
    /// Map of pubkey -> AuthUser
    pub users: HashMap<String, AuthUser>,

    /// Last updated timestamp (ISO 8601)
    pub updated_at: String,
}

impl UserDatabase {
    pub fn new() -> Self {
        Self {
            users: HashMap::new(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn add_user(&mut self, user: AuthUser) {
        self.users.insert(user.pubkey.clone(), user);
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn remove_user(&mut self, pubkey: &str) -> Option<AuthUser> {
        let removed = self.users.remove(pubkey);
        if removed.is_some() {
            self.updated_at = chrono::Utc::now().to_rfc3339();
        }
        removed
    }

    pub fn get_user(&self, pubkey: &str) -> Option<&AuthUser> {
        self.users.get(pubkey)
    }

    pub fn update_last_active(&mut self, pubkey: &str) {
        if let Some(user) = self.users.get_mut(pubkey) {
            user.last_active = chrono::Utc::now().to_rfc3339();
            self.updated_at = chrono::Utc::now().to_rfc3339();
        }
    }
}

impl Default for UserDatabase {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Invitation Types
// ============================================================================

/// Invitation status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InvitationStatus {
    /// Not yet redeemed
    Pending,
    /// Successfully redeemed
    Accepted,
    /// Past expiration time
    Expired,
    /// Manually revoked by owner
    Revoked,
}

/// Invitation record
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invitation {
    /// One-time use token (64 hex chars, 32 bytes random)
    pub token: String,

    /// Access level to grant
    pub level: AccessLevel,

    /// Expiration timestamp (ISO 8601)
    pub expires_at: String,

    /// Current status
    pub status: InvitationStatus,

    /// Created by (public key)
    pub created_by: String,

    /// Created at timestamp (ISO 8601)
    pub created_at: String,

    /// Redeemed by (public key, None if not redeemed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redeemed_by: Option<String>,

    /// Redeemed at timestamp (ISO 8601, None if not redeemed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redeemed_at: Option<String>,
}

impl Invitation {
    pub fn new(level: AccessLevel, expires_in_hours: u64, created_by: String) -> Self {
        let now = chrono::Utc::now();
        let expires_at = (now + chrono::Duration::hours(expires_in_hours as i64)).to_rfc3339();

        // Generate 32-byte random token
        use rand::Rng;
        let token_bytes: [u8; 32] = rand::thread_rng().gen();
        let token = hex::encode(token_bytes);

        Self {
            token,
            level,
            expires_at,
            status: InvitationStatus::Pending,
            created_by,
            created_at: now.to_rfc3339(),
            redeemed_by: None,
            redeemed_at: None,
        }
    }

    pub fn is_expired(&self) -> bool {
        if let Ok(expires_at) = chrono::DateTime::parse_from_rfc3339(&self.expires_at) {
            chrono::Utc::now() > expires_at
        } else {
            true // If we can't parse, treat as expired
        }
    }

    pub fn is_valid(&self) -> bool {
        self.status == InvitationStatus::Pending && !self.is_expired()
    }

    pub fn redeem(&mut self, pubkey: String) {
        self.status = InvitationStatus::Accepted;
        self.redeemed_by = Some(pubkey);
        self.redeemed_at = Some(chrono::Utc::now().to_rfc3339());
    }

    pub fn revoke(&mut self) {
        self.status = InvitationStatus::Revoked;
    }
}

/// Invitation database (in-memory, persisted to file)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationDatabase {
    /// Map of token -> Invitation
    pub invitations: HashMap<String, Invitation>,

    /// Last updated timestamp (ISO 8601)
    pub updated_at: String,
}

impl InvitationDatabase {
    pub fn new() -> Self {
        Self {
            invitations: HashMap::new(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn add_invitation(&mut self, invitation: Invitation) {
        self.invitations.insert(invitation.token.clone(), invitation);
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn get_invitation(&self, token: &str) -> Option<&Invitation> {
        self.invitations.get(token)
    }

    pub fn get_invitation_mut(&mut self, token: &str) -> Option<&mut Invitation> {
        self.invitations.get_mut(token)
    }

    pub fn cleanup_expired(&mut self) {
        let expired_tokens: Vec<String> = self
            .invitations
            .iter()
            .filter(|(_, inv)| inv.is_expired() && inv.status == InvitationStatus::Pending)
            .map(|(token, _)| token.clone())
            .collect();

        for token in expired_tokens {
            if let Some(inv) = self.invitations.get_mut(&token) {
                inv.status = InvitationStatus::Expired;
            }
        }

        if !self.invitations.is_empty() {
            self.updated_at = chrono::Utc::now().to_rfc3339();
        }
    }
}

impl Default for InvitationDatabase {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// BRC-103 Authentication Types
// ============================================================================

/// BRC-103 authentication headers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Brc103AuthHeaders {
    /// User's public key (X-BSV-Identity)
    pub identity: String,

    /// Nonce (X-BSV-Nonce)
    pub nonce: String,

    /// Signature (X-BSV-Signature)
    pub signature: String,
}

/// Nonce record for replay prevention (SPEC §12.3)
#[derive(Debug, Clone)]
pub struct NonceRecord {
    /// Nonce value
    pub nonce: String,

    /// First seen timestamp
    pub first_seen: std::time::Instant,

    /// Number of times seen
    pub count: u32,
}

/// Nonce tracker (in-memory)
pub struct NonceTracker {
    /// Map of nonce -> NonceRecord
    nonces: HashMap<String, NonceRecord>,

    /// Maximum nonce age (seconds)
    max_age_secs: u64,

    /// Cleanup interval (seconds)
    cleanup_interval_secs: u64,

    /// Last cleanup timestamp
    last_cleanup: std::time::Instant,
}

impl NonceTracker {
    pub fn new() -> Self {
        Self {
            nonces: HashMap::new(),
            max_age_secs: 300, // 5 minutes
            cleanup_interval_secs: 60, // 1 minute
            last_cleanup: std::time::Instant::now(),
        }
    }

    pub fn check_and_record(&mut self, nonce: &str) -> Result<(), NonceError> {
        // Cleanup old nonces if needed
        self.cleanup_if_needed();

        // Check if nonce was already used
        if let Some(record) = self.nonces.get_mut(nonce) {
            record.count += 1;
            return Err(NonceError::Reused);
        }

        // Record new nonce
        self.nonces.insert(
            nonce.to_string(),
            NonceRecord {
                nonce: nonce.to_string(),
                first_seen: std::time::Instant::now(),
                count: 1,
            },
        );

        Ok(())
    }

    fn cleanup_if_needed(&mut self) {
        let now = std::time::Instant::now();
        if now.duration_since(self.last_cleanup).as_secs() < self.cleanup_interval_secs {
            return;
        }

        let max_age = std::time::Duration::from_secs(self.max_age_secs);
        self.nonces.retain(|_, record| {
            now.duration_since(record.first_seen) < max_age
        });

        self.last_cleanup = now;
    }
}

impl Default for NonceTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NonceError {
    Reused,
}

impl std::fmt::Display for NonceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Reused => write!(f, "Nonce already used"),
        }
    }
}

impl std::error::Error for NonceError {}

// ============================================================================
// Invitation Data (for QR codes)
// ============================================================================

/// Invitation data for QR code encoding
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationData {
    /// Protocol version
    pub version: String,

    /// Invitation details
    pub invitation: InvitationDetails,

    /// Optional gateway petname
    #[serde(skip_serializing_if = "Option::is_none")]
    pub petname: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationDetails {
    /// Gateway public key
    pub gateway_pubkey: String,

    /// Gateway network address
    pub gateway_address: String,

    /// Authorization level granted
    pub level: AccessLevel,

    /// Expiration timestamp (ISO 8601)
    pub expires_at: String,

    /// One-time use token
    pub token: String,
}

impl InvitationData {
    pub fn new(
        gateway_pubkey: String,
        gateway_address: String,
        invitation: Invitation,
        petname: Option<String>,
    ) -> Self {
        Self {
            version: "edwinpai-invite-v1".to_string(),
            invitation: InvitationDetails {
                gateway_pubkey,
                gateway_address,
                level: invitation.level,
                expires_at: invitation.expires_at,
                token: invitation.token,
            },
            petname,
        }
    }

    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_access_level_permissions() {
        assert!(AccessLevel::Owner.can_manage_users());
        assert!(AccessLevel::Owner.can_write());
        assert!(AccessLevel::Owner.can_read());

        assert!(!AccessLevel::Member.can_manage_users());
        assert!(AccessLevel::Member.can_write());
        assert!(AccessLevel::Member.can_read());

        assert!(!AccessLevel::Guest.can_manage_users());
        assert!(!AccessLevel::Guest.can_write());
        assert!(AccessLevel::Guest.can_read());
    }

    #[test]
    fn test_access_level_serialization() {
        let level = AccessLevel::Member;
        let json = serde_json::to_string(&level).unwrap();
        assert_eq!(json, "\"member\"");
    }

    #[test]
    fn test_user_database() {
        let mut db = UserDatabase::new();
        let user = AuthUser {
            pubkey: "03abc...".to_string(),
            petname: "Swift Falcon".to_string(),
            level: AccessLevel::Member,
            authorized_at: chrono::Utc::now().to_rfc3339(),
            last_active: chrono::Utc::now().to_rfc3339(),
            invited_by: None,
        };

        db.add_user(user.clone());
        assert!(db.get_user("03abc...").is_some());
        assert_eq!(db.users.len(), 1);

        db.remove_user("03abc...");
        assert!(db.get_user("03abc...").is_none());
        assert_eq!(db.users.len(), 0);
    }

    #[test]
    fn test_invitation_lifecycle() {
        let mut invitation = Invitation::new(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        );

        assert!(invitation.is_valid());
        assert_eq!(invitation.status, InvitationStatus::Pending);
        assert!(invitation.redeemed_by.is_none());

        invitation.redeem("03member...".to_string());
        assert_eq!(invitation.status, InvitationStatus::Accepted);
        assert_eq!(invitation.redeemed_by.as_deref(), Some("03member..."));
        assert!(!invitation.is_valid());
    }

    #[test]
    fn test_invitation_database() {
        let mut db = InvitationDatabase::new();
        let invitation = Invitation::new(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        );
        let token = invitation.token.clone();

        db.add_invitation(invitation);
        assert!(db.get_invitation(&token).is_some());
        assert_eq!(db.invitations.len(), 1);
    }

    #[test]
    fn test_nonce_tracker() {
        let mut tracker = NonceTracker::new();

        // First use should succeed
        assert!(tracker.check_and_record("nonce1").is_ok());

        // Second use should fail (replay attack)
        assert_eq!(tracker.check_and_record("nonce1"), Err(NonceError::Reused));

        // Different nonce should succeed
        assert!(tracker.check_and_record("nonce2").is_ok());
    }

    #[test]
    fn test_invitation_data_json() {
        let invitation = Invitation::new(
            AccessLevel::Member,
            24,
            "03owner...".to_string(),
        );
        let data = InvitationData::new(
            "03gateway...".to_string(),
            "192.168.1.100:18789".to_string(),
            invitation,
            Some("Swift Falcon".to_string()),
        );

        let json = data.to_json().unwrap();
        let parsed = InvitationData::from_json(&json).unwrap();

        assert_eq!(parsed.version, "edwinpai-invite-v1");
        assert_eq!(parsed.invitation.level, AccessLevel::Member);
        assert_eq!(parsed.petname.as_deref(), Some("Swift Falcon"));
    }
}
