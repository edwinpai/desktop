// IPC Bridge Types for Crypto Domain (SPEC §3.3)
//
// Serde-compatible request/response structs matching src/types/ipc.ts
// These types form the contract between the frontend and Rust backend.

use serde::{Deserialize, Serialize};

// --- Request Types (AI Domain → Crypto Domain) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct SignRequest {
    #[serde(with = "serde_bytes")]
    pub payload: Vec<u8>,
    #[serde(rename = "protocolID")]
    pub protocol_id: String,
    #[serde(rename = "keyID")]
    pub key_id: String,
    pub counterparty: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct VerifyRequest {
    #[serde(with = "serde_bytes")]
    pub payload: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub signature: Vec<u8>,
    #[serde(rename = "publicKey")]
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct GetPublicKeyRequest {
    #[serde(rename = "identityKey")]
    pub identity_key: Option<bool>,
    #[serde(rename = "protocolID")]
    pub protocol_id: Option<String>,
    #[serde(rename = "keyID")]
    pub key_id: Option<String>,
    pub counterparty: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct CheckSubscriptionRequest {
    #[serde(rename = "forceRefresh")]
    pub force_refresh: Option<bool>,
}

// --- Phase 2: SPV Verification ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct SpvVerifyRequest {
    pub txid: String,
    pub beef: Option<String>, // hex-encoded BEEF
    #[serde(rename = "useCache")]
    pub use_cache: Option<bool>,
}

// --- Phase 2: Overlay/Arcade Submission ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct SubmitToArcadeRequest {
    pub beef: String, // hex-encoded BEEF
    pub topics: Vec<String>,
    pub mode: Option<String>, // "current-tx" | "historical-tx" | "historical-tx-no-spv"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct EncryptRequest {
    #[serde(with = "serde_bytes")]
    pub plaintext: Vec<u8>,
    #[serde(rename = "protocolID")]
    pub protocol_id: String,
    #[serde(rename = "keyID")]
    pub key_id: String,
    pub counterparty: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct DecryptRequest {
    #[serde(with = "serde_bytes")]
    pub ciphertext: Vec<u8>,
    #[serde(rename = "protocolID")]
    pub protocol_id: String,
    #[serde(rename = "keyID")]
    pub key_id: String,
    pub counterparty: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct DeriveKeyRequest {
    #[serde(rename = "protocolID")]
    pub protocol_id: String,
    #[serde(rename = "keyID")]
    pub key_id: String,
    pub counterparty: String,
    #[serde(rename = "securityLevel")]
    pub security_level: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct SignMessageRequest {
    #[serde(with = "serde_bytes")]
    pub data: Vec<u8>,
    #[serde(rename = "protocolID")]
    pub protocol_id: Option<String>,
    #[serde(rename = "keyID")]
    pub key_id: Option<String>,
    #[serde(rename = "useIdentityKey")]
    pub use_identity_key: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct GetIdentityRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct GenerateIdenticonRequest {
    #[serde(rename = "publicKey")]
    pub public_key: String,
    pub size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct GetAuditLogRequest {
    pub operation: Option<String>,
    #[serde(rename = "startTime")]
    pub start_time: Option<String>,
    #[serde(rename = "endTime")]
    pub end_time: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct AuthorizeSpendRequest {
    pub txid: String,
    pub vout: u32,
    pub amount: u64,
    pub description: String,
}

// --- Response Types (Crypto Domain → AI Domain) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct SignResponse {
    #[serde(with = "serde_bytes")]
    pub signature: Vec<u8>,
    #[serde(rename = "publicKey")]
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct VerifyResponse {
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct GetPublicKeyResponse {
    #[serde(rename = "publicKey")]
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct CheckSubscriptionResponse {
    // Phase 2: Enhanced with subscription state machine (SPEC §5.6)
    pub state: String, // "Active" | "Cached" | "Expired" | "GraceExceeded" | "NotFound"
    pub txid: Option<String>,
    pub vout: Option<u32>,
    #[serde(rename = "verifiedAt")]
    pub verified_at: Option<String>,
    #[serde(rename = "cachedProof")]
    pub cached_proof: bool,
    #[serde(rename = "blockHeight")]
    pub block_height: Option<u32>,
    pub confirmations: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct EncryptResponse {
    #[serde(with = "serde_bytes")]
    pub ciphertext: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct DecryptResponse {
    #[serde(with = "serde_bytes")]
    pub plaintext: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct DeriveKeyResponse {
    #[serde(rename = "publicKey")]
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct SignMessageResponse {
    #[serde(with = "serde_bytes")]
    pub signature: Vec<u8>,
    #[serde(rename = "publicKey")]
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct GetIdentityResponse {
    #[serde(rename = "publicKey")]
    pub public_key: String,
    pub petname: String,
    #[serde(rename = "avatarSvg")]
    pub avatar_svg: String,
    #[serde(rename = "shortId")]
    pub short_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct GenerateIdenticonResponse {
    pub svg: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub timestamp: String,
    pub operation: String,
    #[serde(rename = "protocolId", skip_serializing_if = "Option::is_none")]
    pub protocol_id: Option<String>,
    #[serde(rename = "keyId", skip_serializing_if = "Option::is_none")]
    pub key_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty: Option<String>,
    #[serde(rename = "payloadHash", skip_serializing_if = "Option::is_none")]
    pub payload_hash: Option<String>,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct GetAuditLogResponse {
    pub entries: Vec<AuditLogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct AuthorizeSpendResponse {
    pub authorized: bool,
}

// --- Phase 2: SPV Verification Response ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct SpvVerifyResponse {
    pub valid: bool,
    pub txid: String,
    #[serde(rename = "blockHeight")]
    pub block_height: Option<u32>,
    pub confirmations: Option<u32>,
    pub cached: bool,
    pub error: Option<String>,
}

// --- Phase 2: Arcade Submission Response ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct SubmitToArcadeResponse {
    pub accepted: bool,
    pub txid: String,
    pub topics: Vec<String>,
    pub receipt: Option<SteakReceiptData>,
    pub rejection: Option<RejectionData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteakReceiptData {
    #[serde(rename = "acceptedAt")]
    pub accepted_at: String,
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectionData {
    pub code: String,
    pub message: String,
}

// --- Union Types (for dispatching) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CryptoRequest {
    SignRequest(SignRequest),
    VerifyRequest(VerifyRequest),
    GetPublicKeyRequest(GetPublicKeyRequest),
    CheckSubscriptionRequest(CheckSubscriptionRequest),
    EncryptRequest(EncryptRequest),
    DecryptRequest(DecryptRequest),
    DeriveKeyRequest(DeriveKeyRequest),
    SignMessageRequest(SignMessageRequest),
    GetIdentityRequest(GetIdentityRequest),
    GenerateIdenticonRequest(GenerateIdenticonRequest),
    GetAuditLogRequest(GetAuditLogRequest),
    SpvVerifyRequest(SpvVerifyRequest), // Phase 2
    SubmitToArcadeRequest(SubmitToArcadeRequest), // Phase 2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CryptoResponse {
    SignResponse(SignResponse),
    VerifyResponse(VerifyResponse),
    GetPublicKeyResponse(GetPublicKeyResponse),
    CheckSubscriptionResponse(CheckSubscriptionResponse),
    EncryptResponse(EncryptResponse),
    DecryptResponse(DecryptResponse),
    DeriveKeyResponse(DeriveKeyResponse),
    SignMessageResponse(SignMessageResponse),
    GetIdentityResponse(GetIdentityResponse),
    GenerateIdenticonResponse(GenerateIdenticonResponse),
    GetAuditLogResponse(GetAuditLogResponse),
    SpvVerifyResponse(SpvVerifyResponse), // Phase 2
    SubmitToArcadeResponse(SubmitToArcadeResponse), // Phase 2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CryptoMessage {
    // Requests
    SignRequest(SignRequest),
    VerifyRequest(VerifyRequest),
    GetPublicKeyRequest(GetPublicKeyRequest),
    CheckSubscriptionRequest(CheckSubscriptionRequest),
    EncryptRequest(EncryptRequest),
    DecryptRequest(DecryptRequest),
    DeriveKeyRequest(DeriveKeyRequest),
    SignMessageRequest(SignMessageRequest),
    GetIdentityRequest(GetIdentityRequest),
    GenerateIdenticonRequest(GenerateIdenticonRequest),
    GetAuditLogRequest(GetAuditLogRequest),
    AuthorizeSpendRequest(AuthorizeSpendRequest),
    SpvVerifyRequest(SpvVerifyRequest), // Phase 2
    SubmitToArcadeRequest(SubmitToArcadeRequest), // Phase 2

    // Responses
    SignResponse(SignResponse),
    VerifyResponse(VerifyResponse),
    GetPublicKeyResponse(GetPublicKeyResponse),
    CheckSubscriptionResponse(CheckSubscriptionResponse),
    EncryptResponse(EncryptResponse),
    DecryptResponse(DecryptResponse),
    DeriveKeyResponse(DeriveKeyResponse),
    SignMessageResponse(SignMessageResponse),
    GetIdentityResponse(GetIdentityResponse),
    GenerateIdenticonResponse(GenerateIdenticonResponse),
    GetAuditLogResponse(GetAuditLogResponse),
    AuthorizeSpendResponse(AuthorizeSpendResponse),
    SpvVerifyResponse(SpvVerifyResponse), // Phase 2
    SubmitToArcadeResponse(SubmitToArcadeResponse), // Phase 2
}

// --- Error Serialization ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl IpcError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    // Common error constructors
    pub fn keychain_unavailable() -> Self {
        Self::new("ERR_KEYCHAIN_UNAVAILABLE", "OS keychain is unavailable")
    }

    pub fn key_not_found(key_id: &str) -> Self {
        Self::new("ERR_KEY_NOT_FOUND", format!("Key not found: {}", key_id))
    }

    pub fn invalid_key(reason: &str) -> Self {
        Self::new("ERR_INVALID_KEY", format!("Invalid key: {}", reason))
    }

    pub fn invalid_signature() -> Self {
        Self::new("ERR_INVALID_SIGNATURE", "Signature verification failed")
    }

    pub fn derivation_failed(reason: &str) -> Self {
        Self::new("ERR_DERIVATION_FAILED", format!("Key derivation failed: {}", reason))
    }

    pub fn signing_failed(reason: &str) -> Self {
        Self::new("ERR_SIGNING_FAILED", format!("Signing failed: {}", reason))
    }

    pub fn verification_failed(reason: &str) -> Self {
        Self::new("ERR_VERIFICATION_FAILED", format!("Verification failed: {}", reason))
    }

    pub fn encryption_failed(reason: &str) -> Self {
        Self::new("ERR_ENCRYPTION_FAILED", format!("Encryption failed: {}", reason))
    }

    pub fn decryption_failed(reason: &str) -> Self {
        Self::new("ERR_DECRYPTION_FAILED", format!("Decryption failed: {}", reason))
    }

    pub fn invalid_counterparty(reason: &str) -> Self {
        Self::new("ERR_INVALID_COUNTERPARTY", format!("Invalid counterparty: {}", reason))
    }

    pub fn subscription_expired() -> Self {
        Self::new("ERR_SUBSCRIPTION_EXPIRED", "Subscription has expired")
    }

    pub fn subscription_check_failed(reason: &str) -> Self {
        Self::new("ERR_SUBSCRIPTION_CHECK_FAILED", format!("Subscription check failed: {}", reason))
    }

    // Phase 2: SPV/Overlay errors
    pub fn spv_verification_failed(reason: &str) -> Self {
        Self::new("ERR_SPV_VERIFICATION_FAILED", format!("SPV verification failed: {}", reason))
    }

    pub fn beef_parse_failed(reason: &str) -> Self {
        Self::new("ERR_BEEF_PARSE_FAILED", format!("BEEF parsing failed: {}", reason))
    }

    pub fn overlay_submission_failed(reason: &str) -> Self {
        Self::new("ERR_OVERLAY_SUBMISSION_FAILED", format!("Overlay submission failed: {}", reason))
    }

    pub fn internal_error(reason: &str) -> Self {
        Self::new("ERR_INTERNAL", format!("Internal error: {}", reason))
    }
}

impl std::fmt::Display for IpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for IpcError {}

pub type IpcResult<T> = Result<T, IpcError>;

// --- Conversion helpers for internal types → IPC types ---

impl From<crate::types::CryptoError> for IpcError {
    fn from(err: crate::types::CryptoError) -> Self {
        let code = match err.code {
            crate::types::CryptoErrorCode::KeychainUnavailable => "ERR_KEYCHAIN_UNAVAILABLE",
            crate::types::CryptoErrorCode::KeyNotFound => "ERR_KEY_NOT_FOUND",
            crate::types::CryptoErrorCode::InvalidKey => "ERR_INVALID_KEY",
            crate::types::CryptoErrorCode::InvalidSignature => "ERR_INVALID_SIGNATURE",
            crate::types::CryptoErrorCode::DerivationFailed => "ERR_DERIVATION_FAILED",
            crate::types::CryptoErrorCode::SigningFailed => "ERR_SIGNING_FAILED",
            crate::types::CryptoErrorCode::VerificationFailed => "ERR_VERIFICATION_FAILED",
            crate::types::CryptoErrorCode::EncryptionFailed => "ERR_ENCRYPTION_FAILED",
            crate::types::CryptoErrorCode::DecryptionFailed => "ERR_DECRYPTION_FAILED",
            crate::types::CryptoErrorCode::InvalidCounterparty => "ERR_INVALID_COUNTERPARTY",
        };
        Self::new(code, err.message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_request_serialization() {
        let req = SignRequest {
            payload: vec![1, 2, 3, 4],
            protocol_id: "edwinpai".to_string(),
            key_id: "session-1".to_string(),
            counterparty: Some("03abc123...".to_string()),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""protocolID":"edwinpai""#));
        assert!(json.contains(r#""keyID":"session-1""#));
    }

    #[test]
    fn test_get_identity_response_serialization() {
        let resp = GetIdentityResponse {
            public_key: "03abc123".to_string(),
            petname: "Swift Falcon".to_string(),
            avatar_svg: "<svg>...</svg>".to_string(),
            short_id: "edw:a3f7".to_string(),
        };

        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains(r#""publicKey":"03abc123""#));
        assert!(json.contains(r#""avatarSvg":"<svg>...</svg>""#));
        assert!(json.contains(r#""shortId":"edw:a3f7""#));
    }

    #[test]
    fn test_ipc_error_construction() {
        let err = IpcError::keychain_unavailable();
        assert_eq!(err.code, "ERR_KEYCHAIN_UNAVAILABLE");

        let err2 = IpcError::derivation_failed("invalid protocol ID");
        assert!(err2.message.contains("invalid protocol ID"));
    }

    #[test]
    fn test_audit_log_entry_serialization() {
        let entry = AuditLogEntry {
            timestamp: "2026-02-09T12:00:00Z".to_string(),
            operation: "sign".to_string(),
            protocol_id: Some("edwinpai".to_string()),
            key_id: Some("session-1".to_string()),
            counterparty: None,
            payload_hash: Some("abcd1234".to_string()),
            success: true,
            error: None,
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains(r#""protocolId":"edwinpai""#));
        assert!(json.contains(r#""keyId":"session-1""#));
        assert!(!json.contains("counterparty")); // omitted when None
    }
}
