pub mod api;
pub mod types;
pub mod traits;
pub mod keypair;
pub mod signing;
pub mod subscription;
pub mod audit;
pub mod brc42;
pub mod identity;
pub mod keychain;
pub mod domain;
pub mod ipc_types;

pub use api::{fingerprint_for_public_key, get_auth_identity, sign_challenge, AuthIdentity, ChallengeSignature};

pub use types::{
    AuditEvent, AuditLogEntry, AuditOperation, Brc103IdenticonParams, Brc42DerivationParams,
    Brc42Params, CryptoError, CryptoErrorCode, CryptoResult, DecryptRequest, DecryptResponse,
    EncryptRequest, EncryptResponse, Identity, Keychain, Keypair, Petname, SignRequest,
    SignResponse, VerifyRequest, VerifyResponse,
};

pub use traits::{
    AuditLogger, Brc42KeyDerivation, CryptoDomain, IdentityGenerator, KeychainAccess,
};

pub use domain::EdwinPAICryptoDomain;

pub use ipc_types::{
    AuthorizeSpendRequest, AuthorizeSpendResponse, CheckSubscriptionRequest,
    CheckSubscriptionResponse, CryptoMessage, CryptoRequest, CryptoResponse, DecryptRequest as IpcDecryptRequest,
    DecryptResponse as IpcDecryptResponse, DeriveKeyRequest, DeriveKeyResponse, EncryptRequest as IpcEncryptRequest,
    EncryptResponse as IpcEncryptResponse, GenerateIdenticonRequest, GenerateIdenticonResponse,
    GetAuditLogRequest, GetAuditLogResponse, GetIdentityRequest, GetIdentityResponse,
    GetPublicKeyRequest, GetPublicKeyResponse, IpcError, IpcResult, RejectionData, SignMessageRequest,
    SignMessageResponse, SignRequest as IpcSignRequest, SignResponse as IpcSignResponse,
    SpvVerifyRequest, SpvVerifyResponse, SteakReceiptData, SubmitToArcadeRequest, SubmitToArcadeResponse,
    VerifyRequest as IpcVerifyRequest, VerifyResponse as IpcVerifyResponse,
};
