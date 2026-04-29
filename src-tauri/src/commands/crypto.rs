// Crypto Domain Tauri commands (Phase 1)
//
// IPC layer between React frontend and Rust crypto_domain.
// All commands are logged via the audit system.

use crate::crypto_domain::{
    Brc42Params, CryptoDomain, EdwinPAICryptoDomain, SignRequest, VerifyRequest,
};

use serde::{Deserialize, Serialize};

// --- Command Request/Response Types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetIdentityResponse {
    pub public_key: String,
    pub petname: String,
    pub avatar_svg: String,
    pub short_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeriveKeyRequest {
    pub protocol_id: String,
    pub key_id: String,
    pub counterparty: String,
    pub security_level: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeriveKeyResponse {
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignMessageRequest {
    pub data: Vec<u8>,
    pub protocol_id: Option<String>,
    pub key_id: Option<String>,
    pub counterparty: Option<String>,
    pub use_identity_key: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignMessageResponse {
    pub signature: Vec<u8>,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyMessageRequest {
    pub data: Vec<u8>,
    pub signature: Vec<u8>,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyMessageResponse {
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateIdenticonRequest {
    pub public_key: String,
    pub size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateIdenticonResponse {
    pub svg: String,
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn get_identity() -> Result<GetIdentityResponse, String> {
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.to_string())?;
    let identity = domain.get_identity().map_err(|e| e.to_string())?;

    Ok(GetIdentityResponse {
        public_key: identity.public_key,
        petname: identity.petname,
        avatar_svg: identity.avatar_svg,
        short_id: identity.short_id,
    })
}

#[tauri::command]
pub async fn derive_key(request: DeriveKeyRequest) -> Result<DeriveKeyResponse, String> {
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.to_string())?;

    let params = Brc42Params {
        security_level: request.security_level.unwrap_or(2),
        protocol_id: request.protocol_id,
        key_id: request.key_id,
        counterparty: request.counterparty,
    };

    let public_key = domain.derive_public_key(&params).map_err(|e| e.to_string())?;

    Ok(DeriveKeyResponse { public_key })
}

#[tauri::command]
pub async fn sign_message(request: SignMessageRequest) -> Result<SignMessageResponse, String> {
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.to_string())?;

    let derivation = if request.use_identity_key == Some(true) {
        None
    } else if let (Some(protocol_id), Some(key_id), Some(counterparty)) =
        (request.protocol_id, request.key_id, request.counterparty)
    {
        Some(Brc42Params {
            security_level: 2,
            protocol_id,
            key_id,
            counterparty,
        })
    } else {
        None
    };

    let sign_request = SignRequest {
        data: request.data,
        derivation,
    };

    let response = domain.sign(&sign_request).map_err(|e| e.to_string())?;

    Ok(SignMessageResponse {
        signature: response.signature,
        public_key: response.public_key,
    })
}

#[tauri::command]
pub async fn verify_message(request: VerifyMessageRequest) -> Result<VerifyMessageResponse, String> {
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.to_string())?;

    let verify_request = VerifyRequest {
        data: request.data,
        signature: request.signature,
        public_key: request.public_key,
    };

    let response = domain.verify(&verify_request).map_err(|e| e.to_string())?;

    Ok(VerifyMessageResponse {
        valid: response.valid,
    })
}

#[tauri::command]
pub async fn generate_identicon(request: GenerateIdenticonRequest) -> Result<GenerateIdenticonResponse, String> {
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.to_string())?;
    let svg = domain
        .generate_identicon(&request.public_key, request.size.unwrap_or(64))
        .map_err(|e| e.to_string())?;

    Ok(GenerateIdenticonResponse { svg })
}

// TODO: Phase 2 — Implement check_subscription command (UTXO/SPV verification)
// TODO: Phase 2 — Implement encrypt/decrypt commands
