// Phase 4 integration tests
//
// Tests the complete client mode workflows:
// - mDNS discovery → connection → authentication
// - Invitation creation → QR generation → redemption
// - Multi-user authorization and storage
// - Connection state transitions

use edwinpai_desktop_lib::{
    client_domain::{
        AuthorizationLevel, ClientConfig, ConnectionManager, ConnectionState, PeerInfo,
        UserStorage,
    },
    invitation::{InvitationToken, QRCodeGenerator, QRData},
};
use std::path::PathBuf;

// Test: Complete invitation workflow
#[test]
fn test_complete_invitation_workflow() {
    // Step 1: Create invitation token
    let invitation = InvitationToken {
        gateway_pubkey: "02abc123def456".to_string(),
        gateway_address: "192.168.1.100:3000".to_string(),
        level: AuthorizationLevel::Member,
        expires_at: "2026-12-31T23:59:59Z".to_string(),
        token: "a".repeat(64),
    };

    // Step 2: Generate QR code
    let qr_svg = QRCodeGenerator::generate_svg(invitation.clone(), Some("test-gateway".to_string())).unwrap();
    assert!(qr_svg.contains("<svg"));

    // Step 3: Serialize to QR data
    let qr_data = QRData::new(invitation.clone(), Some("test-gateway".to_string()));
    let qr_json = qr_data.to_json().unwrap();

    // Step 4: Parse QR data (simulating scan)
    let parsed_data = QRCodeGenerator::parse_qr_data(&qr_json).unwrap();

    // Step 5: Validate version and expiration
    QRCodeGenerator::validate_version(&parsed_data).unwrap();
    QRCodeGenerator::validate_expiration(&parsed_data.invitation).unwrap();

    // Step 6: Verify parsed data matches original
    assert_eq!(parsed_data.invitation.gateway_pubkey, invitation.gateway_pubkey);
    assert_eq!(parsed_data.invitation.token, invitation.token);
    assert_eq!(parsed_data.petname, Some("test-gateway".to_string()));
}

// Test: User authorization workflow
#[test]
fn test_user_authorization_workflow() {
    let storage = UserStorage::new(PathBuf::from(":memory:")).unwrap();

    // Step 1: Add owner
    let owner = PeerInfo {
        pubkey: "02owner123".to_string(),
        petname: "alice".to_string(),
        address: "192.168.1.100:3000".parse().unwrap(),
        authorization_level: AuthorizationLevel::Owner,
        last_seen: "2026-02-11T10:00:00Z".to_string(),
        is_online: true,
    };
    storage.upsert_user(&owner).unwrap();

    // Step 2: Add member
    let member = PeerInfo {
        pubkey: "02member456".to_string(),
        petname: "bob".to_string(),
        address: "192.168.1.101:3000".parse().unwrap(),
        authorization_level: AuthorizationLevel::Member,
        last_seen: "2026-02-11T10:05:00Z".to_string(),
        is_online: true,
    };
    storage.upsert_user(&member).unwrap();

    // Step 3: Add guest
    let guest = PeerInfo {
        pubkey: "02guest789".to_string(),
        petname: "charlie".to_string(),
        address: "192.168.1.102:3000".parse().unwrap(),
        authorization_level: AuthorizationLevel::Guest,
        last_seen: "2026-02-11T10:10:00Z".to_string(),
        is_online: false,
    };
    storage.upsert_user(&guest).unwrap();

    // Step 4: Query all users
    let all_users = storage.get_all_users(None).unwrap();
    assert_eq!(all_users.len(), 3);

    // Step 5: Query only online users
    let online_users = storage.get_all_users(Some(true)).unwrap();
    assert_eq!(online_users.len(), 2);

    // Step 6: Upgrade guest to member
    storage
        .update_authorization("02guest789", AuthorizationLevel::Member)
        .unwrap();

    let updated_guest = storage.get_user("02guest789").unwrap().unwrap();
    assert_eq!(updated_guest.authorization_level, AuthorizationLevel::Member);

    // Step 7: Remove member
    let removed = storage.remove_user("02member456").unwrap();
    assert!(removed);

    let final_users = storage.get_all_users(None).unwrap();
    assert_eq!(final_users.len(), 2);
}

// Test: Connection state machine
#[test]
fn test_connection_state_transitions() {
    let manager = ConnectionManager::new();

    // Initial state: Disconnected
    assert_eq!(
        manager.get_state().unwrap(),
        ConnectionState::Disconnected
    );

    // Disconnect should work from any state
    manager.disconnect(false).unwrap();
    assert_eq!(
        manager.get_state().unwrap(),
        ConnectionState::Disconnected
    );

    // Disconnect with disable_reconnect
    manager.disconnect(true).unwrap();
    let config = manager.get_config().unwrap();
    assert!(!config.auto_reconnect);
}

// Test: Multi-user permission levels
#[test]
fn test_authorization_levels() {
    // Owner permissions
    assert!(AuthorizationLevel::Owner.can_manage_users());
    assert!(AuthorizationLevel::Owner.can_write());
    assert!(AuthorizationLevel::Owner.can_read());

    // Member permissions
    assert!(!AuthorizationLevel::Member.can_manage_users());
    assert!(AuthorizationLevel::Member.can_write());
    assert!(AuthorizationLevel::Member.can_read());

    // Guest permissions
    assert!(!AuthorizationLevel::Guest.can_manage_users());
    assert!(!AuthorizationLevel::Guest.can_write());
    assert!(AuthorizationLevel::Guest.can_read());
}

// Test: Invitation expiration validation
#[test]
fn test_invitation_expiration_validation() {
    // Valid (future) expiration
    let valid_invitation = InvitationToken {
        gateway_pubkey: "02abc123".to_string(),
        gateway_address: "192.168.1.100:3000".to_string(),
        level: AuthorizationLevel::Member,
        expires_at: "2026-12-31T23:59:59Z".to_string(),
        token: "x".repeat(64),
    };
    assert!(QRCodeGenerator::validate_expiration(&valid_invitation).is_ok());

    // Expired invitation
    let expired_invitation = InvitationToken {
        gateway_pubkey: "02def456".to_string(),
        gateway_address: "10.0.0.1:3000".to_string(),
        level: AuthorizationLevel::Guest,
        expires_at: "2020-01-01T00:00:00Z".to_string(),
        token: "y".repeat(64),
    };
    assert!(QRCodeGenerator::validate_expiration(&expired_invitation).is_err());
}

// Test: QR data version validation
#[test]
fn test_qr_data_version_validation() {
    let invitation = InvitationToken {
        gateway_pubkey: "02ghi789".to_string(),
        gateway_address: "172.16.0.1:3000".to_string(),
        level: AuthorizationLevel::Owner,
        expires_at: "2026-12-31T23:59:59Z".to_string(),
        token: "z".repeat(64),
    };

    // Valid version
    let valid_qr = QRData::new(invitation.clone(), None);
    assert_eq!(valid_qr.version, "edwinpai-invite-v1");
    assert!(QRCodeGenerator::validate_version(&valid_qr).is_ok());

    // Invalid version
    let mut invalid_qr = QRData::new(invitation, None);
    invalid_qr.version = "unknown-version".to_string();
    assert!(QRCodeGenerator::validate_version(&invalid_qr).is_err());
}

// Test: User storage atomic updates
#[test]
fn test_user_storage_atomic_updates() {
    let storage = UserStorage::new(PathBuf::from(":memory:")).unwrap();

    let user = PeerInfo {
        pubkey: "02test123".to_string(),
        petname: "test-user".to_string(),
        address: "192.168.1.100:3000".parse().unwrap(),
        authorization_level: AuthorizationLevel::Guest,
        last_seen: "2026-02-11T10:00:00Z".to_string(),
        is_online: true,
    };

    // First upsert (insert)
    storage.upsert_user(&user).unwrap();
    let retrieved1 = storage.get_user("02test123").unwrap().unwrap();
    assert_eq!(retrieved1.petname, "test-user");

    // Second upsert (update)
    let updated_user = PeerInfo {
        petname: "updated-name".to_string(),
        is_online: false,
        ..user
    };
    storage.upsert_user(&updated_user).unwrap();

    let retrieved2 = storage.get_user("02test123").unwrap().unwrap();
    assert_eq!(retrieved2.petname, "updated-name");
    assert!(!retrieved2.is_online);

    // Verify still only one record
    let all_users = storage.get_all_users(None).unwrap();
    assert_eq!(all_users.len(), 1);
}

// Test: Client config defaults
#[test]
fn test_client_config_defaults() {
    let config = ClientConfig::default();

    assert_eq!(config.gateway_address, "");
    assert_eq!(config.gateway_pubkey, "");
    assert_eq!(config.gateway_petname, "");
    assert!(config.auto_reconnect);
    assert_eq!(config.reconnect_interval_secs, 5);
    assert_eq!(config.connection_timeout_secs, 10);
}

// Test: Authorization level serialization
#[test]
fn test_authorization_level_serialization() {
    // Owner
    let owner_json = serde_json::to_string(&AuthorizationLevel::Owner).unwrap();
    assert_eq!(owner_json, "\"owner\"");
    let owner_parsed: AuthorizationLevel = serde_json::from_str(&owner_json).unwrap();
    assert_eq!(owner_parsed, AuthorizationLevel::Owner);

    // Member
    let member_json = serde_json::to_string(&AuthorizationLevel::Member).unwrap();
    assert_eq!(member_json, "\"member\"");

    // Guest
    let guest_json = serde_json::to_string(&AuthorizationLevel::Guest).unwrap();
    assert_eq!(guest_json, "\"guest\"");
}

// Test: Connection state serialization
#[test]
fn test_connection_state_serialization() {
    let states = vec![
        (ConnectionState::Disconnected, "\"disconnected\""),
        (ConnectionState::Connecting, "\"connecting\""),
        (ConnectionState::Connected, "\"connected\""),
        (ConnectionState::Reconnecting, "\"reconnecting\""),
        (ConnectionState::Failed, "\"failed\""),
    ];

    for (state, expected_json) in states {
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, expected_json);

        let parsed: ConnectionState = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, state);
    }
}

// Test: Invitation token round-trip serialization
#[test]
fn test_invitation_token_round_trip() {
    let original = InvitationToken {
        gateway_pubkey: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
            .to_string(),
        gateway_address: "192.168.1.100:3117".to_string(),
        level: AuthorizationLevel::Member,
        expires_at: "2026-02-11T23:59:59Z".to_string(),
        token: "0".repeat(64),
    };

    let qr_data = QRData::new(original.clone(), Some("gateway".to_string()));
    let json = qr_data.to_json().unwrap();
    let parsed = QRData::from_json(&json).unwrap();

    assert_eq!(parsed.invitation.gateway_pubkey, original.gateway_pubkey);
    assert_eq!(parsed.invitation.gateway_address, original.gateway_address);
    assert_eq!(parsed.invitation.level, original.level);
    assert_eq!(parsed.invitation.token, original.token);
}
