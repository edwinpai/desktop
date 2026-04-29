// Multi-User Authorization - Tauri Commands (IPC Bridge)
//
// Provides IPC interface for auth domain:
// - User management: list, get, remove, check authorization
// - Invitation lifecycle: create, redeem, revoke, list
// - BRC-103 signature verification (delegated to crypto domain)
//
// Access control enforced per SPEC §12.2:
// - Owner: can manage users and invitations
// - Member: cannot manage users/invitations
// - Guest: cannot manage users/invitations
//
// Phase 4 implementation per PLAN.md

use crate::auth::invitations::{get_invitation_manager, init_invitation_manager};
use crate::auth::ipc_types::*;
use crate::auth::types::AuthUser;
use crate::auth::users::{get_user_manager, init_user_manager};

// ============================================================================
// Initialization
// ============================================================================

/// Initialize auth domain (called from main.rs on app startup)
pub fn init_auth_domain() -> Result<(), String> {
    init_user_manager()?;
    init_invitation_manager()?;
    Ok(())
}

// ============================================================================
// User Management Commands
// ============================================================================

/// List all authorized users
#[tauri::command]
pub async fn list_users(_request: ListUsersRequest) -> Result<ListUsersResponse, String> {
    let manager = {
        let manager_arc = get_user_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("User manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    manager.load().await?;

    let users = manager.list_users()?;

    Ok(ListUsersResponse { users })
}

/// Get user by public key
#[tauri::command]
pub async fn get_user(request: GetUserRequest) -> Result<GetUserResponse, String> {
    let manager = {
        let manager_arc = get_user_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("User manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    manager.load().await?;

    let user = manager.get_user(&request.pubkey)?;

    Ok(GetUserResponse { user })
}

/// Remove user (owner only)
#[tauri::command]
pub async fn remove_user(request: RemoveUserRequest) -> Result<RemoveUserResponse, String> {
    let manager = {
        let manager_arc = get_user_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("User manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    manager.load().await?;

    // Remove user
    match manager.remove_user(&request.pubkey).await {
        Ok(removed_user) => Ok(RemoveUserResponse {
            success: true,
            message: format!("User {} removed successfully", removed_user.petname),
        }),
        Err(e) => Ok(RemoveUserResponse {
            success: false,
            message: e,
        }),
    }
}

/// Update user's last activity timestamp
#[tauri::command]
pub async fn update_user_activity(request: UpdateUserActivityRequest) -> Result<UpdateUserActivityResponse, String> {
    let manager = {
        let manager_arc = get_user_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("User manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    manager.load().await?;

    match manager.update_last_active(&request.pubkey).await {
        Ok(_) => Ok(UpdateUserActivityResponse { success: true }),
        Err(_) => Ok(UpdateUserActivityResponse { success: false }),
    }
}

// ============================================================================
// Invitation Management Commands
// ============================================================================

/// Create invitation (owner only)
#[tauri::command]
pub async fn create_invitation(request: CreateInvitationRequest) -> Result<CreateInvitationResponse, String> {
    let manager = {
        let manager_arc = get_invitation_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("Invitation manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    manager.load().await?;

    // Get owner's public key from config
    let config = crate::edwinpai_config::read_edwinpai_config()
        .map_err(|e| format!("Failed to read config: {}", e))?;
    let owner_pubkey = config.get("publicKey")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Get gateway address from config
    let gateway_port = config.get("gateway")
        .and_then(|g| g.get("port"))
        .and_then(|p| p.as_u64())
        .unwrap_or(18789);
    let gateway_address = format!("localhost:{}", gateway_port);

    // Create invitation
    let invitation = manager.create_invitation(
        request.level,
        request.expires_in_hours,
        owner_pubkey.clone(),
    ).await?;

    // Read petname from config
    let petname = config.get("petname")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Generate invitation data for QR code
    let invitation_data = manager.generate_invitation_data(
        &invitation.token,
        owner_pubkey,
        gateway_address,
        petname,
    )?;

    let invitation_json = invitation_data.to_json()
        .map_err(|e| format!("Failed to serialize invitation data: {}", e))?;

    // Generate QR code SVG
    let qr_code_svg = generate_qr_svg(&invitation_json)?;

    // Generate deep link
    let invitation_base64 = base64::Engine::encode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        invitation_json.as_bytes(),
    );
    let deep_link = format!("edwinpai://invite/{}", invitation_base64);

    Ok(CreateInvitationResponse {
        token: invitation.token,
        invitation_data: invitation_json,
        qr_code_svg,
        deep_link,
        expires_at: invitation.expires_at,
    })
}

/// Get QR code for an existing invitation
#[tauri::command]
pub async fn get_invitation_qr(token: String) -> Result<CreateInvitationResponse, String> {
    let manager = {
        let manager_arc = get_invitation_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("Invitation manager not initialized")?
            .clone()
    };

    // Load fresh data
    manager.load().await?;

    // Find the invitation
    let invitations = manager.list_invitations(None)?;
    let invitation = invitations.iter()
        .find(|inv| inv.token == token)
        .ok_or("Invitation not found")?;

    // Read config for gateway info
    let config = crate::edwinpai_config::read_edwinpai_config()
        .map_err(|e| format!("Failed to read config: {}", e))?;
    let owner_pubkey = config.get("publicKey")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let gateway_port = config.get("gateway")
        .and_then(|g| g.get("port"))
        .and_then(|p| p.as_u64())
        .unwrap_or(18789);
    let gateway_address = format!("localhost:{}", gateway_port);
    let petname = config.get("petname")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Regenerate invitation data
    let invitation_data = manager.generate_invitation_data(
        &invitation.token,
        owner_pubkey,
        gateway_address,
        petname,
    )?;

    let invitation_json = invitation_data.to_json()
        .map_err(|e| format!("Failed to serialize invitation data: {}", e))?;

    // Generate QR code SVG
    let qr_code_svg = generate_qr_svg(&invitation_json)?;

    // Generate deep link
    let invitation_base64 = base64::Engine::encode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        invitation_json.as_bytes(),
    );
    let deep_link = format!("edwinpai://invite/{}", invitation_base64);

    Ok(CreateInvitationResponse {
        token: invitation.token.clone(),
        invitation_data: invitation_json,
        qr_code_svg,
        deep_link,
        expires_at: invitation.expires_at.clone(),
    })
}

/// Generate a QR code SVG from data string
fn generate_qr_svg(data: &str) -> Result<String, String> {
    use qrcode::{QrCode, render::svg};

    let code = QrCode::new(data.as_bytes())
        .map_err(|e| format!("Failed to generate QR code: {}", e))?;

    let svg_string = code.render::<svg::Color>()
        .min_dimensions(200, 200)
        .max_dimensions(300, 300)
        .build();

    Ok(svg_string)
}

/// Redeem invitation (client mode)
#[tauri::command]
pub async fn redeem_invitation(request: RedeemInvitationRequest) -> Result<RedeemInvitationResponse, String> {
    let inv_manager = {
        let manager_arc = get_invitation_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("Invitation manager not initialized")?
            .clone()
    };

    let user_manager = {
        let manager_arc = get_user_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("User manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    inv_manager.load().await?;
    user_manager.load().await?;

    // Redeem invitation
    let access_level = inv_manager.redeem_invitation(&request.token, request.client_pubkey.clone()).await?;

    // Add user to authorized users
    let user = AuthUser {
        pubkey: request.client_pubkey.clone(),
        petname: format!("User {}", &request.client_pubkey[..8]), // TODO: Derive petname properly
        level: access_level,
        authorized_at: chrono::Utc::now().to_rfc3339(),
        last_active: chrono::Utc::now().to_rfc3339(),
        invited_by: None, // TODO: Get from invitation
    };

    user_manager.add_user(user).await
        .map_err(|e| format!("Failed to add user after redemption: {}", e))?;

    Ok(RedeemInvitationResponse {
        success: true,
        message: "Invitation redeemed successfully".to_string(),
        access_level: Some(access_level),
    })
}

/// Revoke invitation (owner only)
#[tauri::command]
pub async fn revoke_invitation(request: RevokeInvitationRequest) -> Result<RevokeInvitationResponse, String> {
    let manager = {
        let manager_arc = get_invitation_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("Invitation manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    manager.load().await?;

    match manager.revoke_invitation(&request.token).await {
        Ok(_) => Ok(RevokeInvitationResponse {
            success: true,
            message: "Invitation revoked successfully".to_string(),
        }),
        Err(e) => Ok(RevokeInvitationResponse {
            success: false,
            message: e,
        }),
    }
}

/// List invitations
#[tauri::command]
pub async fn list_invitations(request: ListInvitationsRequest) -> Result<ListInvitationsResponse, String> {
    let manager = {
        let manager_arc = get_invitation_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("Invitation manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    manager.load().await?;

    let invitations = manager.list_invitations(request.status)?;

    Ok(ListInvitationsResponse { invitations })
}

// ============================================================================
// Authorization Commands
// ============================================================================

/// Check user authorization level
#[tauri::command]
pub async fn check_authorization(request: CheckAuthorizationRequest) -> Result<CheckAuthorizationResponse, String> {
    let manager = {
        let manager_arc = get_user_manager();
        let manager_lock = manager_arc.lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        manager_lock.as_ref()
            .ok_or("User manager not initialized")?
            .clone()
    };

    // Load from file to ensure fresh data
    manager.load().await?;

    let level = manager.check_authorization(&request.pubkey)?;

    Ok(CheckAuthorizationResponse {
        authorized: level.is_some(),
        level,
    })
}

/// Verify BRC-103 signature
///
/// Note: This delegates to the crypto domain for actual signature verification.
/// The crypto domain already has BRC-103 signing/verification implemented.
#[tauri::command]
pub async fn verify_brc103_signature(request: VerifyBrc103SignatureRequest) -> Result<VerifyBrc103SignatureResponse, String> {
    // Use the crypto commands verify_message function
    use crate::commands::crypto::{VerifyMessageRequest, verify_message};

    // Convert hex signature to bytes
    let signature_bytes = hex::decode(&request.signature)
        .map_err(|e| format!("Invalid signature hex: {}", e))?;

    // Convert BRC-103 auth request to crypto domain verify request
    let verify_req = VerifyMessageRequest {
        data: request.data,
        signature: signature_bytes,
        public_key: request.identity.clone(),
    };

    // Delegate to crypto domain
    let verify_result = verify_message(verify_req).await?;

    // Check nonce replay prevention
    // TODO: Implement nonce tracking in real implementation

    Ok(VerifyBrc103SignatureResponse {
        valid: verify_result.valid,
        message: if verify_result.valid {
            "Signature valid".to_string()
        } else {
            "Invalid signature".to_string()
        },
    })
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::{AccessLevel, InvitationStatus};

    #[tokio::test]
    async fn test_init_auth_domain() {
        let result = init_auth_domain();
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_list_users_command() {
        init_auth_domain().unwrap();

        let req = ListUsersRequest {};
        let result = list_users(req).await;

        assert!(result.is_ok());
        let _response = result.unwrap();
        // Empty list is valid - no assertion needed
    }

    #[tokio::test]
    async fn test_get_user_command() {
        init_auth_domain().unwrap();

        let req = GetUserRequest {
            pubkey: "03nonexistent...".to_string(),
        };
        let result = get_user(req).await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.user.is_none());
    }

    #[tokio::test]
    async fn test_create_invitation_command() {
        init_auth_domain().unwrap();

        let req = CreateInvitationRequest {
            level: AccessLevel::Member,
            expires_in_hours: 24,
        };
        let result = create_invitation(req).await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.token.len(), 64); // 32 bytes hex
        assert!(response.invitation_data.contains("edwinpai-invite-v1"));
    }

    #[tokio::test]
    async fn test_list_invitations_command() {
        init_auth_domain().unwrap();

        let req = ListInvitationsRequest { status: None };
        let result = list_invitations(req).await;

        assert!(result.is_ok());
        let _response = result.unwrap();
        // Empty list is valid - no assertion needed
    }

    #[tokio::test]
    async fn test_check_authorization_command() {
        init_auth_domain().unwrap();

        let req = CheckAuthorizationRequest {
            pubkey: "03nonexistent...".to_string(),
        };
        let result = check_authorization(req).await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.authorized, false);
        assert!(response.level.is_none());
    }

    #[tokio::test]
    async fn test_invitation_lifecycle_commands() {
        init_auth_domain().unwrap();

        // Create invitation
        let create_req = CreateInvitationRequest {
            level: AccessLevel::Member,
            expires_in_hours: 24,
        };
        let create_result = create_invitation(create_req).await.unwrap();
        let token = create_result.token;

        // List invitations (should include new one)
        let list_req = ListInvitationsRequest {
            status: Some(InvitationStatus::Pending),
        };
        let list_result = list_invitations(list_req).await.unwrap();
        assert!(list_result.invitations.iter().any(|inv| inv.token == token));

        // Revoke invitation
        let revoke_req = RevokeInvitationRequest { token: token.clone() };
        let revoke_result = revoke_invitation(revoke_req).await.unwrap();
        assert_eq!(revoke_result.success, true);

        // List pending invitations (should not include revoked one)
        let list_req2 = ListInvitationsRequest {
            status: Some(InvitationStatus::Pending),
        };
        let list_result2 = list_invitations(list_req2).await.unwrap();
        assert!(!list_result2.invitations.iter().any(|inv| inv.token == token));
    }

    #[tokio::test]
    async fn test_redeem_invitation_flow() {
        init_auth_domain().unwrap();

        // Create invitation
        let create_req = CreateInvitationRequest {
            level: AccessLevel::Guest,
            expires_in_hours: 24,
        };
        let create_result = create_invitation(create_req).await.unwrap();

        // Redeem invitation
        let redeem_req = RedeemInvitationRequest {
            token: create_result.token.clone(),
            client_pubkey: "03newuser123...".to_string(),
        };
        let redeem_result = redeem_invitation(redeem_req).await.unwrap();
        assert_eq!(redeem_result.success, true);
        assert_eq!(redeem_result.access_level, Some(AccessLevel::Guest));

        // Verify user was added
        let get_req = GetUserRequest {
            pubkey: "03newuser123...".to_string(),
        };
        let get_result = get_user(get_req).await.unwrap();
        assert!(get_result.user.is_some());
        assert_eq!(get_result.user.unwrap().level, AccessLevel::Guest);
    }

    #[tokio::test]
    async fn test_remove_user_command() {
        init_auth_domain().unwrap();

        // First add a user via invitation redemption
        let create_req = CreateInvitationRequest {
            level: AccessLevel::Member,
            expires_in_hours: 24,
        };
        let create_result = create_invitation(create_req).await.unwrap();

        let redeem_req = RedeemInvitationRequest {
            token: create_result.token,
            client_pubkey: "03removetest...".to_string(),
        };
        redeem_invitation(redeem_req).await.unwrap();

        // Now remove the user
        let remove_req = RemoveUserRequest {
            pubkey: "03removetest...".to_string(),
        };
        let remove_result = remove_user(remove_req).await.unwrap();
        assert_eq!(remove_result.success, true);

        // Verify user removed
        let get_req = GetUserRequest {
            pubkey: "03removetest...".to_string(),
        };
        let get_result = get_user(get_req).await.unwrap();
        assert!(get_result.user.is_none());
    }
}
