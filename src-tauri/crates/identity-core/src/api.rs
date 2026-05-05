use sha2::{Digest, Sha256};

use crate::{CryptoDomain, CryptoError, CryptoErrorCode, CryptoResult, EdwinPAICryptoDomain, SignRequest};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthIdentity {
    pub public_key: String,
    pub short_id: String,
    pub petname: String,
    pub fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChallengeSignature {
    pub public_key: String,
    pub signature: String,
    pub short_id: String,
}

pub fn get_auth_identity() -> CryptoResult<AuthIdentity> {
    let domain = EdwinPAICryptoDomain::new()?;
    let identity = domain.get_identity()?;
    let fingerprint = fingerprint_for_public_key(&identity.public_key)?;

    Ok(AuthIdentity {
        public_key: identity.public_key,
        short_id: identity.short_id,
        petname: identity.petname,
        fingerprint,
    })
}

pub fn sign_challenge(challenge: &str) -> CryptoResult<ChallengeSignature> {
    let domain = EdwinPAICryptoDomain::new()?;
    let identity = domain.get_identity()?;
    let sign_response = domain.sign(&SignRequest {
        data: challenge.as_bytes().to_vec(),
        derivation: None,
    })?;

    Ok(ChallengeSignature {
        public_key: identity.public_key,
        signature: hex::encode(sign_response.signature),
        short_id: identity.short_id,
    })
}

pub fn fingerprint_for_public_key(public_key: &str) -> CryptoResult<String> {
    let public_key_bytes = hex::decode(public_key).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid public key hex: {}", e),
    })?;
    let mut hasher = Sha256::new();
    hasher.update(public_key_bytes);
    Ok(hex::encode(hasher.finalize())[..16].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{VerifyRequest, VerifyResponse};

    #[test]
    fn test_fingerprint_for_public_key() {
        let fingerprint = fingerprint_for_public_key(
            "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        )
        .unwrap();
        assert_eq!(fingerprint, "0f715baf5d4c2ed3");
    }

    #[test]
    fn test_get_auth_identity() {
        let identity = get_auth_identity().unwrap();
        assert_eq!(identity.public_key.len(), 66);
        assert!(identity.public_key.starts_with("02") || identity.public_key.starts_with("03"));
        assert!(identity.short_id.starts_with("edw:"));
        assert!(!identity.petname.is_empty());
        assert_eq!(identity.fingerprint.len(), 16);
    }

    #[test]
    fn test_sign_challenge_roundtrip() {
        let challenge = "gateway-auth-challenge";
        let signature = sign_challenge(challenge).unwrap();

        let domain = EdwinPAICryptoDomain::new().unwrap();
        let verify: VerifyResponse = domain
            .verify(&VerifyRequest {
                data: challenge.as_bytes().to_vec(),
                signature: hex::decode(signature.signature).unwrap(),
                public_key: signature.public_key.clone(),
            })
            .unwrap();

        assert!(verify.valid);
        assert!(signature.short_id.starts_with("edw:"));
    }
}
