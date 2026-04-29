// Multi-User Authorization - IPC Type Definitions
//
// Defines Tauri IPC message contracts for auth domain.
// Frontend sends these request types, backend responds with response types.
//
// IMPORTANT: This module MUST import types from auth/types.rs (single source of truth).
// DO NOT redefine domain types here.

use serde::{Deserialize, Serialize};
use super::types::{AccessLevel, AuthUser, Invitation, InvitationStatus};

// ============================================================================
// User Management IPC
// ============================================================================

/// Request: List all authorized users
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListUsersRequest {
    // No parameters needed
}

/// Response: List of authorized users
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListUsersResponse {
    pub users: Vec<AuthUser>,
}

/// Request: Get user by public key
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetUserRequest {
    pub pubkey: String,
}

/// Response: User details
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetUserResponse {
    pub user: Option<AuthUser>,
}

/// Request: Remove user (owner only)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveUserRequest {
    pub pubkey: String,
}

/// Response: User removal result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveUserResponse {
    pub success: bool,
    pub message: String,
}

/// Request: Update user's last activity timestamp
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserActivityRequest {
    pub pubkey: String,
}

/// Response: Activity update result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserActivityResponse {
    pub success: bool,
}

// ============================================================================
// Invitation IPC
// ============================================================================

/// Request: Create invitation (owner only)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvitationRequest {
    /// Access level to grant
    pub level: AccessLevel,

    /// Expiration time in hours
    pub expires_in_hours: u64,
}

/// Response: Created invitation with QR code and deep link
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvitationResponse {
    /// Invitation token (64 hex chars)
    pub token: String,

    /// Full invitation data (JSON-encoded for QR code)
    pub invitation_data: String,

    /// QR code as SVG string
    pub qr_code_svg: String,

    /// Deep link URL (edwinpai://invite/...)
    pub deep_link: String,

    /// Expiration timestamp (ISO 8601)
    pub expires_at: String,
}

/// Request: Redeem invitation (client mode)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemInvitationRequest {
    /// Invitation token
    pub token: String,

    /// Client's public key
    pub client_pubkey: String,
}

/// Response: Redemption result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemInvitationResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_level: Option<AccessLevel>,
}

/// Request: Revoke invitation (owner only)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeInvitationRequest {
    pub token: String,
}

/// Response: Revocation result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeInvitationResponse {
    pub success: bool,
    pub message: String,
}

/// Request: List all invitations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListInvitationsRequest {
    /// Optional status filter
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<InvitationStatus>,
}

/// Response: List of invitations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListInvitationsResponse {
    pub invitations: Vec<Invitation>,
}

// ============================================================================
// Authorization IPC
// ============================================================================

/// Request: Check user authorization level
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckAuthorizationRequest {
    pub pubkey: String,
}

/// Response: Authorization details
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckAuthorizationResponse {
    pub authorized: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<AccessLevel>,
}

/// Request: Verify BRC-103 signature
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyBrc103SignatureRequest {
    /// User's public key (X-BSV-Identity)
    pub identity: String,

    /// Nonce (X-BSV-Nonce)
    pub nonce: String,

    /// Signature (X-BSV-Signature)
    pub signature: String,

    /// Original signed data
    pub data: Vec<u8>,
}

/// Response: Signature verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyBrc103SignatureResponse {
    pub valid: bool,
    pub message: String,
}

// ============================================================================
// Event Types (Backend -> Frontend notifications)
// ============================================================================

/// Event: User added
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAddedEvent {
    pub user: AuthUser,
}

/// Event: User removed
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRemovedEvent {
    pub pubkey: String,
}

/// Event: Invitation created
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationCreatedEvent {
    pub token: String,
    pub level: AccessLevel,
    pub expires_at: String,
}

/// Event: Invitation redeemed
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationRedeemedEvent {
    pub token: String,
    pub redeemed_by: String,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_invitation_request_serialization() {
        let request = CreateInvitationRequest {
            level: AccessLevel::Member,
            expires_in_hours: 24,
        };
        let json = serde_json::to_string(&request).unwrap();
        // camelCase: expiresInHours
        assert!(json.contains("\"level\":\"member\""));
        assert!(json.contains("\"expiresInHours\":24"));
    }

    #[test]
    fn test_create_invitation_request_deserialization() {
        // Frontend sends camelCase
        let json = r#"{"level":"member","expiresInHours":24}"#;
        let request: CreateInvitationRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.level, AccessLevel::Member);
        assert_eq!(request.expires_in_hours, 24);
    }

    #[test]
    fn test_redeem_invitation_request_serialization() {
        let request = RedeemInvitationRequest {
            token: "abc123".to_string(),
            client_pubkey: "03def".to_string(),
        };
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"token\":"));
        assert!(json.contains("\"clientPubkey\":"));
    }

    #[test]
    fn test_check_authorization_response() {
        let response = CheckAuthorizationResponse {
            authorized: true,
            level: Some(AccessLevel::Member),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"authorized\":true"));
        assert!(json.contains("\"level\":\"member\""));
    }

    #[test]
    fn test_user_added_event_serialization() {
        let event = UserAddedEvent {
            user: AuthUser {
                pubkey: "03abc".to_string(),
                petname: "Swift Falcon".to_string(),
                level: AccessLevel::Member,
                authorized_at: "2026-02-11T00:00:00Z".to_string(),
                last_active: "2026-02-11T00:00:00Z".to_string(),
                invited_by: None,
            },
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"pubkey\":"));
        assert!(json.contains("\"level\":\"member\""));
    }
}
