/**
 * Crypto types for BRC-42/43 operations (Phase 1)
 *
 * Types for key derivation, signing, encryption, and verification.
 */

// --- BRC-42 Key Derivation Parameters ---

export interface Brc42DerivationParams {
  /** Protocol ID (BRC-43 invoice number component) */
  protocolID: string;

  /** Key ID (BRC-43 invoice number component) */
  keyID: string;

  /** Counterparty public key (33 bytes, compressed, hex-encoded) */
  counterparty: string;

  /** Security level (default: 2 for EdwinPAI) */
  securityLevel?: number;
}

export interface InvoiceNumber {
  /** Full invoice number: "<securityLevel>-<protocolID>-<keyID>" */
  full: string;
  securityLevel: number;
  protocolID: string;
  keyID: string;
}

// --- Signing Types ---

export interface SigningRequest {
  /** Data to sign (UTF-8 string or raw bytes) */
  data: string | Uint8Array;

  /** If provided, use derived key; otherwise use identity key */
  derivation?: Brc42DerivationParams;

  /** Protocol context (e.g., "edwinpai-auth", "brc-103") */
  protocol?: string;
}

export interface SigningResponse {
  /** DER-encoded ECDSA signature */
  signature: Uint8Array;

  /** Public key used for signing (compressed, hex-encoded) */
  publicKey: string;

  /** Whether identity key or derived key was used */
  keyType: "identity" | "derived";
}

export interface VerificationRequest {
  /** Original data that was signed */
  data: string | Uint8Array;

  /** DER-encoded ECDSA signature */
  signature: Uint8Array;

  /** Public key to verify against (compressed, hex-encoded) */
  publicKey: string;
}

export interface VerificationResponse {
  /** Whether the signature is valid */
  valid: boolean;

  /** Optional error message if verification fails */
  error?: string;
}

// --- Encryption Types (BRC-2) ---

export interface EncryptionRequest {
  /** Plaintext to encrypt */
  plaintext: string | Uint8Array;

  /** BRC-42 derivation parameters for encryption key */
  derivation: Brc42DerivationParams;

  /** Algorithm (default: "aes-256-gcm") */
  algorithm?: string;
}

export interface EncryptionResponse {
  /** Encrypted ciphertext */
  ciphertext: Uint8Array;

  /** Initialization vector / nonce */
  iv: Uint8Array;

  /** Authentication tag (for AEAD modes) */
  authTag?: Uint8Array;

  /** Algorithm used */
  algorithm: string;
}

export interface DecryptionRequest {
  /** Ciphertext to decrypt */
  ciphertext: Uint8Array;

  /** Initialization vector / nonce */
  iv: Uint8Array;

  /** Authentication tag (for AEAD modes) */
  authTag?: Uint8Array;

  /** BRC-42 derivation parameters for decryption key */
  derivation: Brc42DerivationParams;

  /** Algorithm (default: "aes-256-gcm") */
  algorithm?: string;
}

export interface DecryptionResponse {
  /** Decrypted plaintext */
  plaintext: Uint8Array;

  /** Whether authentication succeeded (for AEAD modes) */
  authenticated: boolean;
}

// --- Public Key Types ---

export interface PublicKeyInfo {
  /** Compressed public key (33 bytes, hex-encoded) */
  key: string;

  /** Key type: identity or derived */
  type: "identity" | "derived";

  /** If derived, the derivation parameters used */
  derivation?: Brc42DerivationParams;
}

// --- Error Types ---

export interface CryptoError {
  code:
    | "ERR_KEYCHAIN_UNAVAILABLE"
    | "ERR_KEY_NOT_FOUND"
    | "ERR_INVALID_KEY"
    | "ERR_INVALID_SIGNATURE"
    | "ERR_DERIVATION_FAILED"
    | "ERR_SIGNING_FAILED"
    | "ERR_VERIFICATION_FAILED"
    | "ERR_ENCRYPTION_FAILED"
    | "ERR_DECRYPTION_FAILED"
    | "ERR_INVALID_COUNTERPARTY";
  message: string;
  details?: Record<string, unknown>;
}
