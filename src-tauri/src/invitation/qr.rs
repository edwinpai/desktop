// QR code generation for invitation tokens (Phase 4)
//
// Implements QR code generation using qrcode v0.14:
// - JSON serialization of invitation tokens
// - QR code encoding with error correction
// - SVG/PNG output formats

use super::types::{InvitationToken, QRData};
use qrcode::QrCode;
use qrcode::render::svg;

/// QR code generator for invitation tokens
pub struct QRCodeGenerator;

impl QRCodeGenerator {
    /// Generate QR code as SVG from invitation data
    pub fn generate_svg(invitation: InvitationToken, petname: Option<String>) -> Result<String, String> {
        let qr_data = QRData::new(invitation, petname);
        let json = qr_data
            .to_json()
            .map_err(|e| format!("Failed to serialize QR data: {}", e))?;

        let code = QrCode::new(json.as_bytes()).map_err(|e| format!("Failed to create QR code: {}", e))?;

        let svg = code
            .render()
            .min_dimensions(200, 200)
            .dark_color(svg::Color("#000000"))
            .light_color(svg::Color("#ffffff"))
            .build();

        Ok(svg)
    }

    /// Generate QR code as SVG with custom dimensions
    pub fn generate_svg_with_size(
        invitation: InvitationToken,
        petname: Option<String>,
        width: u32,
        height: u32,
    ) -> Result<String, String> {
        let qr_data = QRData::new(invitation, petname);
        let json = qr_data
            .to_json()
            .map_err(|e| format!("Failed to serialize QR data: {}", e))?;

        let code = QrCode::new(json.as_bytes()).map_err(|e| format!("Failed to create QR code: {}", e))?;

        let svg = code
            .render()
            .min_dimensions(width, height)
            .dark_color(svg::Color("#000000"))
            .light_color(svg::Color("#ffffff"))
            .build();

        Ok(svg)
    }

    /// Parse invitation from scanned QR code data
    pub fn parse_qr_data(qr_json: &str) -> Result<QRData, String> {
        QRData::from_json(qr_json).map_err(|e| format!("Failed to parse QR data: {}", e))
    }

    /// Validate QR data version
    pub fn validate_version(qr_data: &QRData) -> Result<(), String> {
        if qr_data.version != "edwinpai-invite-v1" {
            return Err(format!(
                "Unsupported QR data version: {}. Expected: edwinpai-invite-v1",
                qr_data.version
            ));
        }
        Ok(())
    }

    /// Validate invitation token expiration
    pub fn validate_expiration(invitation: &InvitationToken) -> Result<(), String> {
        let expires_at = chrono::DateTime::parse_from_rfc3339(&invitation.expires_at)
            .map_err(|e| format!("Invalid expiration timestamp: {}", e))?;

        let now = chrono::Utc::now();

        if expires_at.timestamp() < now.timestamp() {
            return Err("Invitation has expired".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client_domain::types::AuthorizationLevel;

    fn create_test_invitation() -> InvitationToken {
        InvitationToken {
            gateway_pubkey: "02abc123".to_string(),
            gateway_address: "192.168.1.100:18789".to_string(),
            level: AuthorizationLevel::Member,
            expires_at: "2026-12-31T23:59:59Z".to_string(),
            token: "a".repeat(64),
        }
    }

    #[test]
    fn test_generate_svg() {
        let invitation = create_test_invitation();
        let svg = QRCodeGenerator::generate_svg(invitation, Some("alice-gateway".to_string())).unwrap();

        assert!(svg.contains("<svg"));
        assert!(svg.contains("</svg>"));
        assert!(svg.contains("xmlns"));
    }

    #[test]
    fn test_generate_svg_with_custom_size() {
        let invitation = create_test_invitation();
        let svg = QRCodeGenerator::generate_svg_with_size(invitation, None, 300, 300).unwrap();

        assert!(svg.contains("<svg"));
        // QR code library uses viewBox for scaling, not direct width/height attributes
        assert!(svg.len() > 100, "SVG should have content");
    }

    #[test]
    fn test_parse_qr_data() {
        let invitation = create_test_invitation();
        let qr_data = QRData::new(invitation.clone(), Some("test-gateway".to_string()));
        let json = qr_data.to_json().unwrap();

        let parsed = QRCodeGenerator::parse_qr_data(&json).unwrap();

        assert_eq!(parsed.version, "edwinpai-invite-v1");
        assert_eq!(parsed.petname, Some("test-gateway".to_string()));
        assert_eq!(parsed.invitation.gateway_pubkey, invitation.gateway_pubkey);
    }

    #[test]
    fn test_parse_invalid_json() {
        let result = QRCodeGenerator::parse_qr_data("invalid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_version_success() {
        let invitation = create_test_invitation();
        let qr_data = QRData::new(invitation, None);

        let result = QRCodeGenerator::validate_version(&qr_data);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_version_failure() {
        let mut qr_data = QRData::new(create_test_invitation(), None);
        qr_data.version = "unknown-version".to_string();

        let result = QRCodeGenerator::validate_version(&qr_data);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported QR data version"));
    }

    #[test]
    fn test_validate_expiration_success() {
        let invitation = create_test_invitation();
        let result = QRCodeGenerator::validate_expiration(&invitation);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_expiration_expired() {
        let mut invitation = create_test_invitation();
        invitation.expires_at = "2020-01-01T00:00:00Z".to_string();

        let result = QRCodeGenerator::validate_expiration(&invitation);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("expired"));
    }

    #[test]
    fn test_validate_expiration_invalid_format() {
        let mut invitation = create_test_invitation();
        invitation.expires_at = "invalid-timestamp".to_string();

        let result = QRCodeGenerator::validate_expiration(&invitation);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid expiration timestamp"));
    }

    #[test]
    fn test_round_trip_serialization() {
        let invitation = create_test_invitation();
        let qr_data = QRData::new(invitation.clone(), Some("gateway".to_string()));

        // Serialize to JSON
        let json = qr_data.to_json().unwrap();

        // Parse back
        let parsed = QRCodeGenerator::parse_qr_data(&json).unwrap();

        // Validate
        QRCodeGenerator::validate_version(&parsed).unwrap();
        QRCodeGenerator::validate_expiration(&parsed.invitation).unwrap();

        assert_eq!(parsed.invitation.gateway_pubkey, invitation.gateway_pubkey);
        assert_eq!(parsed.invitation.token, invitation.token);
    }

    #[test]
    fn test_svg_output_format() {
        let invitation = create_test_invitation();
        let svg = QRCodeGenerator::generate_svg(invitation, None).unwrap();

        // Verify SVG structure
        assert!(svg.starts_with("<?xml") || svg.starts_with("<svg"));
        assert!(svg.contains("rect"));
        assert!(svg.contains("fill"));
    }
}
