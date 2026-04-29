// Invitation Tauri commands (Phase 4)
//
// Implements IPC command handlers for invitation management:
// - create_invitation: Generate invitation token and QR code
// - scan_qr_code: Parse scanned QR code data
// - accept_invitation: Redeem invitation and connect to gateway

use crate::client_domain::types::AuthorizationLevel;
use crate::invitation::{InvitationToken, QRCodeGenerator, QRData};
use rand::Rng;
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

/// Request to create an invitation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvitationRequest {
    /// Gateway public key
    pub gateway_pubkey: String,

    /// Gateway address
    pub gateway_address: String,

    /// Authorization level to grant
    pub level: AuthorizationLevel,

    /// Expiration time in seconds from now
    pub expires_in_secs: u64,

    /// Optional gateway petname
    pub petname: Option<String>,
}

/// Response with invitation QR code
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvitationResponse {
    /// Generated invitation token
    pub invitation: InvitationToken,

    /// QR code as SVG
    pub qr_code_svg: String,

    /// Deep link URL (edwinpai://invite/...)
    pub deep_link: String,
}

/// Request to scan and parse QR code
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanQRCodeRequest {
    /// QR code JSON data
    pub qr_data_json: String,
}

/// Response with parsed invitation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanQRCodeResponse {
    /// Parsed QR data
    pub qr_data: QRData,

    /// Whether the invitation is valid (not expired)
    pub is_valid: bool,

    /// Error message if invalid
    pub error: Option<String>,
}

/// Request to accept an invitation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptInvitationRequest {
    /// Invitation token
    pub invitation: InvitationToken,
}

/// Response after accepting invitation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptInvitationResponse {
    /// Whether invitation was accepted
    pub success: bool,

    /// Error message if failed
    pub error: Option<String>,

    /// Gateway petname if successful
    pub gateway_petname: Option<String>,
}

/// Generate a cryptographically secure random token
fn generate_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: [u8; 32] = rng.gen();
    hex::encode(bytes)
}

/// Create invitation with QR code
#[tauri::command]
pub fn create_invitation_qr(request: CreateInvitationRequest) -> Result<CreateInvitationResponse, String> {
    // Generate expiration timestamp
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(request.expires_in_secs as i64);

    // Generate one-time use token
    let token = generate_token();

    // Create invitation token
    let invitation = InvitationToken {
        gateway_pubkey: request.gateway_pubkey,
        gateway_address: request.gateway_address,
        level: request.level,
        expires_at: expires_at.to_rfc3339(),
        token,
    };

    // Generate QR code
    let qr_code_svg = QRCodeGenerator::generate_svg(invitation.clone(), request.petname)?;

    // Generate deep link
    let invitation_json = serde_json::to_string(&invitation)
        .map_err(|e| format!("Failed to serialize invitation: {}", e))?;
    let invitation_base64 = general_purpose::URL_SAFE_NO_PAD.encode(invitation_json.as_bytes());
    let deep_link = format!("edwinpai://invite/{}", invitation_base64);

    Ok(CreateInvitationResponse {
        invitation,
        qr_code_svg,
        deep_link,
    })
}

/// Scan and parse QR code data
#[tauri::command]
pub fn scan_qr_code(request: ScanQRCodeRequest) -> Result<ScanQRCodeResponse, String> {
    // Parse QR data
    let qr_data = QRCodeGenerator::parse_qr_data(&request.qr_data_json)?;

    // Validate version
    if let Err(e) = QRCodeGenerator::validate_version(&qr_data) {
        return Ok(ScanQRCodeResponse {
            qr_data,
            is_valid: false,
            error: Some(e),
        });
    }

    // Validate expiration
    let is_valid = QRCodeGenerator::validate_expiration(&qr_data.invitation).is_ok();
    let error = if !is_valid {
        Some("Invitation has expired".to_string())
    } else {
        None
    };

    Ok(ScanQRCodeResponse {
        qr_data,
        is_valid,
        error,
    })
}

/// Accept invitation and prepare for connection
#[tauri::command]
pub async fn accept_invitation(request: AcceptInvitationRequest) -> Result<AcceptInvitationResponse, String> {
    // Validate expiration
    if let Err(e) = QRCodeGenerator::validate_expiration(&request.invitation) {
        return Ok(AcceptInvitationResponse {
            success: false,
            error: Some(e),
            gateway_petname: None,
        });
    }

    // The actual connection will be handled by connect_to_gateway command
    // This command just validates the invitation and returns the gateway info

    Ok(AcceptInvitationResponse {
        success: true,
        error: None,
        gateway_petname: Some(format!("Gateway at {}", request.invitation.gateway_address)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_token() {
        let token1 = generate_token();
        let token2 = generate_token();

        // Tokens should be 64 hex chars (32 bytes)
        assert_eq!(token1.len(), 64);
        assert_eq!(token2.len(), 64);

        // Tokens should be different
        assert_ne!(token1, token2);
    }

    #[test]
    fn test_create_invitation_qr() {
        let request = CreateInvitationRequest {
            gateway_pubkey: "02abc123".to_string(),
            gateway_address: "192.168.1.100:18789".to_string(),
            level: AuthorizationLevel::Member,
            expires_in_secs: 3600, // 1 hour
            petname: Some("alice-gateway".to_string()),
        };

        let response = create_invitation_qr(request).unwrap();

        assert_eq!(response.invitation.gateway_pubkey, "02abc123");
        assert_eq!(response.invitation.level, AuthorizationLevel::Member);
        assert!(!response.qr_code_svg.is_empty());
        assert!(response.qr_code_svg.contains("<svg"));
        assert!(response.deep_link.starts_with("edwinpai://invite/"));
        assert_eq!(response.invitation.token.len(), 64);
    }

    #[test]
    fn test_scan_qr_code_valid() {
        // Create invitation first
        let create_request = CreateInvitationRequest {
            gateway_pubkey: "02def456".to_string(),
            gateway_address: "10.0.0.1:18789".to_string(),
            level: AuthorizationLevel::Guest,
            expires_in_secs: 7200, // 2 hours
            petname: None,
        };

        let create_response = create_invitation_qr(create_request).unwrap();

        // Serialize invitation to QR data JSON
        let qr_data = QRData::new(create_response.invitation, None);
        let qr_json = qr_data.to_json().unwrap();

        // Scan QR code
        let scan_request = ScanQRCodeRequest {
            qr_data_json: qr_json,
        };

        let scan_response = scan_qr_code(scan_request).unwrap();

        assert!(scan_response.is_valid);
        assert!(scan_response.error.is_none());
        assert_eq!(scan_response.qr_data.version, "edwinpai-invite-v1");
    }

    #[test]
    fn test_scan_qr_code_expired() {
        let expired_invitation = InvitationToken {
            gateway_pubkey: "02ghi789".to_string(),
            gateway_address: "172.16.0.1:18789".to_string(),
            level: AuthorizationLevel::Owner,
            expires_at: "2020-01-01T00:00:00Z".to_string(), // Expired
            token: "x".repeat(64),
        };

        let qr_data = QRData::new(expired_invitation, None);
        let qr_json = qr_data.to_json().unwrap();

        let scan_request = ScanQRCodeRequest {
            qr_data_json: qr_json,
        };

        let scan_response = scan_qr_code(scan_request).unwrap();

        assert!(!scan_response.is_valid);
        assert!(scan_response.error.is_some());
    }

    #[test]
    fn test_scan_qr_code_invalid_json() {
        let scan_request = ScanQRCodeRequest {
            qr_data_json: "invalid json".to_string(),
        };

        let result = scan_qr_code(scan_request);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_accept_invitation_valid() {
        let invitation = InvitationToken {
            gateway_pubkey: "02jkl012".to_string(),
            gateway_address: "192.168.1.200:18789".to_string(),
            level: AuthorizationLevel::Member,
            expires_at: "2026-12-31T23:59:59Z".to_string(),
            token: "y".repeat(64),
        };

        let request = AcceptInvitationRequest { invitation };

        let response = accept_invitation(request).await.unwrap();

        assert!(response.success);
        assert!(response.error.is_none());
        assert!(response.gateway_petname.is_some());
    }

    #[tokio::test]
    async fn test_accept_invitation_expired() {
        let invitation = InvitationToken {
            gateway_pubkey: "02mno345".to_string(),
            gateway_address: "10.10.10.10:18789".to_string(),
            level: AuthorizationLevel::Guest,
            expires_at: "2020-01-01T00:00:00Z".to_string(), // Expired
            token: "z".repeat(64),
        };

        let request = AcceptInvitationRequest { invitation };

        let response = accept_invitation(request).await.unwrap();

        assert!(!response.success);
        assert!(response.error.is_some());
        assert!(response.error.unwrap().contains("expired"));
    }
}
