// Signed Request - BSV identity-signed gateway requests
//
// Security model:
// - All sensitive gateway operations require a BSV signature
// - Desktop signs with identity key (from keychain/file)
// - Gateway verifies signature before executing
// - AI agent can REQUEST actions but cannot AUTHORIZE them
// - This is the "authorization separation" layer
//
// Signature format (BRC-42 compatible):
// {
//   "kid": "<pubkey fingerprint>",
//   "alg": "BSV-ECDSA",
//   "iat": <timestamp>,
//   "exp": <timestamp + 30s>,
//   "nonce": "<random>",
//   "payload_hash": "<SHA-256 of request body>",
//   "sig": "<DER-encoded ECDSA signature>"
// }

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::crypto_domain::{
    get_auth_identity as core_get_auth_identity, sign_challenge as core_sign_challenge, AuthIdentity as CoreAuthIdentity,
    ChallengeSignature as CoreChallengeSignature, CryptoDomain, EdwinPAICryptoDomain, SignRequest,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedEnvelope {
    /// Public key fingerprint (first 8 hex of SHA-256(pubkey))
    pub kid: String,
    /// Algorithm identifier
    pub alg: String,
    /// Issued-at timestamp (seconds since epoch)
    pub iat: u64,
    /// Expiry timestamp (30 seconds from iat)
    pub exp: u64,
    /// Random nonce (prevents replay)
    pub nonce: String,
    /// SHA-256 of the request payload
    pub payload_hash: String,
    /// DER-encoded ECDSA signature (hex)
    pub sig: String,
    /// Signing public key (compressed, hex)
    pub pub_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedRequest {
    /// The original request payload (JSON string)
    pub payload: String,
    /// The cryptographic envelope
    pub envelope: SignedEnvelope,
}

/// Create a signed envelope for a request payload
fn create_signed_envelope(payload: &str) -> Result<SignedEnvelope, String> {
    let domain = EdwinPAICryptoDomain::new().map_err(|e| e.message)?;
    let identity = domain.get_identity().map_err(|e| e.message)?;

    // Compute payload hash
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    let payload_hash = hex::encode(hasher.finalize());

    // Generate nonce
    let nonce = hex::encode(rand::random::<[u8; 16]>());

    // Timestamps
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let exp = now + 30; // 30 second window

    // Key fingerprint (first 8 hex of SHA-256(pubkey))
    let mut kid_hasher = Sha256::new();
    kid_hasher.update(hex::decode(&identity.public_key).map_err(|e| e.to_string())?);
    let kid = hex::encode(kid_hasher.finalize())[..8].to_string();

    // Build signing data: kid|iat|exp|nonce|payload_hash
    let signing_data = format!("{}|{}|{}|{}|{}", kid, now, exp, nonce, payload_hash);

    // Sign with identity key
    let sign_request = SignRequest {
        data: signing_data.as_bytes().to_vec(),
        derivation: None, // Use master identity key
    };

    let sign_response = domain.sign(&sign_request).map_err(|e| e.message)?;

    Ok(SignedEnvelope {
        kid,
        alg: "BSV-ECDSA".to_string(),
        iat: now,
        exp,
        nonce,
        payload_hash,
        sig: hex::encode(sign_response.signature),
        pub_key: sign_response.public_key,
    })
}

/// Sign a request payload and return the signed request
#[tauri::command]
pub async fn sign_request(payload: String) -> Result<SignedRequest, String> {
    let envelope = create_signed_envelope(&payload)?;
    Ok(SignedRequest { payload, envelope })
}

/// Sign arbitrary data with identity key (for WebSocket handshake auth)
#[tauri::command]
pub async fn sign_challenge(challenge: String) -> Result<ChallengeResponse, String> {
    let response = core_sign_challenge(&challenge).map_err(|e| e.message)?;
    Ok(build_challenge_response(response))
}

/// Get the current identity for auth headers
#[tauri::command]
pub async fn get_auth_identity() -> Result<AuthIdentity, String> {
    let identity = core_get_auth_identity().map_err(|e| e.message)?;
    Ok(build_auth_identity(identity))
}

fn build_challenge_response(response: CoreChallengeSignature) -> ChallengeResponse {
    ChallengeResponse {
        public_key: response.public_key,
        signature: response.signature,
        short_id: response.short_id,
    }
}

fn build_auth_identity(identity: CoreAuthIdentity) -> AuthIdentity {
    AuthIdentity {
        public_key: identity.public_key,
        short_id: identity.short_id,
        petname: identity.petname,
        fingerprint: identity.fingerprint,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChallengeResponse {
    pub public_key: String,
    pub signature: String,
    pub short_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthIdentity {
    pub public_key: String,
    pub short_id: String,
    pub petname: String,
    pub fingerprint: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto_domain::VerifyRequest;

    #[tokio::test]
    async fn test_sign_challenge_returns_verifiable_signature() {
        let challenge = "gateway-auth-challenge".to_string();
        let response = sign_challenge(challenge.clone()).await.unwrap();

        assert_eq!(response.public_key.len(), 66);
        assert!(response.public_key.starts_with("02") || response.public_key.starts_with("03"));
        assert!(response.short_id.starts_with("edw:"));
        assert!(!response.signature.is_empty());

        let domain = EdwinPAICryptoDomain::new().unwrap();
        let verify = domain
            .verify(&VerifyRequest {
                data: challenge.into_bytes(),
                signature: hex::decode(&response.signature).unwrap(),
                public_key: response.public_key.clone(),
            })
            .unwrap();

        assert!(verify.valid);
    }

    #[test]
    fn test_build_auth_identity_maps_core_identity() {
        let auth = build_auth_identity(CoreAuthIdentity {
            public_key: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798".to_string(),
            short_id: "edw:deadbeef".to_string(),
            petname: "Swift Falcon".to_string(),
            fingerprint: "0f715baf5d4c2ed3".to_string(),
        });

        assert_eq!(auth.public_key, "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
        assert_eq!(auth.short_id, "edw:deadbeef");
        assert_eq!(auth.petname, "Swift Falcon");
        assert_eq!(auth.fingerprint, "0f715baf5d4c2ed3");
    }

    #[test]
    fn test_build_challenge_response_maps_core_signature() {
        let response = build_challenge_response(CoreChallengeSignature {
            public_key: "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string(),
            signature: "deadbeef".to_string(),
            short_id: "edw:12345678".to_string(),
        });

        assert_eq!(response.public_key, "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assert_eq!(response.short_id, "edw:12345678");
        assert_eq!(response.signature, "deadbeef");
    }
}
