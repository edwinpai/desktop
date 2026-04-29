// Invitation type definitions for Phase 4
//
// These types define the invitation token structure, QR code data format,
// and invitation status tracking for multi-user access control.

use serde::{Deserialize, Serialize};
use crate::client_domain::types::AuthorizationLevel;

/// Invitation token for QR code generation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InvitationToken {
    /// Gateway public key (hex-encoded)
    pub gateway_pubkey: String,

    /// Gateway network address
    pub gateway_address: String,

    /// Authorization level granted
    pub level: AuthorizationLevel,

    /// Token expiration timestamp (RFC 3339)
    pub expires_at: String,

    /// One-time use token (32 bytes hex)
    pub token: String,
}

/// QR code data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QRData {
    /// Protocol version (always "edwinpai-invite-v1")
    pub version: String,

    /// Serialized invitation token
    pub invitation: InvitationToken,

    /// Optional gateway petname for display
    pub petname: Option<String>,
}

impl QRData {
    /// Create new QR data from invitation
    pub fn new(invitation: InvitationToken, petname: Option<String>) -> Self {
        Self {
            version: "edwinpai-invite-v1".to_string(),
            invitation,
            petname,
        }
    }

    /// Serialize to JSON for QR encoding
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserialize from QR JSON
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

/// Invitation status tracking
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum InvitationStatus {
    /// Invitation created, awaiting acceptance
    Pending,

    /// Invitation accepted by recipient
    Accepted,

    /// Invitation expired (past expires_at)
    Expired,

    /// Invitation revoked by sender
    Revoked,
}

impl Default for InvitationStatus {
    fn default() -> Self {
        Self::Pending
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qr_data_serialization() {
        let token = InvitationToken {
            gateway_pubkey: "02abc123".to_string(),
            gateway_address: "192.168.1.100:18789".to_string(),
            level: AuthorizationLevel::Member,
            expires_at: "2026-02-11T12:00:00Z".to_string(),
            token: "a".repeat(64),
        };
        let qr = QRData::new(token, Some("alice-gateway".to_string()));

        let json = qr.to_json().unwrap();
        assert!(json.contains("edwinpai-invite-v1"));

        let parsed = QRData::from_json(&json).unwrap();
        assert_eq!(parsed.version, "edwinpai-invite-v1");
        assert_eq!(parsed.petname, Some("alice-gateway".to_string()));
    }

    #[test]
    fn test_invitation_status_default() {
        assert_eq!(InvitationStatus::default(), InvitationStatus::Pending);
    }

    #[test]
    fn test_invitation_token_equality() {
        let token1 = InvitationToken {
            gateway_pubkey: "02abc".to_string(),
            gateway_address: "192.168.1.1:18789".to_string(),
            level: AuthorizationLevel::Guest,
            expires_at: "2026-02-11T12:00:00Z".to_string(),
            token: "x".repeat(64),
        };
        let token2 = token1.clone();
        assert_eq!(token1, token2);
    }

    #[test]
    fn test_qr_data_without_petname() {
        let token = InvitationToken {
            gateway_pubkey: "02def456".to_string(),
            gateway_address: "10.0.0.1:18789".to_string(),
            level: AuthorizationLevel::Owner,
            expires_at: "2026-02-12T00:00:00Z".to_string(),
            token: "b".repeat(64),
        };
        let qr = QRData::new(token, None);

        assert!(qr.petname.is_none());
        assert_eq!(qr.version, "edwinpai-invite-v1");
    }

    #[test]
    fn test_invitation_status_serialization() {
        let status = InvitationStatus::Accepted;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"accepted\"");

        let parsed: InvitationStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, InvitationStatus::Accepted);
    }

    #[test]
    fn test_invitation_token_all_fields() {
        let token = InvitationToken {
            gateway_pubkey: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798".to_string(),
            gateway_address: "192.168.1.100:3117".to_string(),
            level: AuthorizationLevel::Member,
            expires_at: "2026-02-11T23:59:59Z".to_string(),
            token: "0".repeat(64),
        };

        assert_eq!(token.gateway_pubkey.len(), 66); // Compressed pubkey hex
        assert!(token.gateway_address.contains(":"));
        assert_eq!(token.level, AuthorizationLevel::Member);
        assert_eq!(token.token.len(), 64); // 32 bytes hex
    }
}
