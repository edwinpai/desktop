/**
 * Tauri Command Types
 *
 * These types match the Rust backend serde serialization.
 * Used for invoke() calls to Tauri commands.
 */

// --- Identity Operations ---

export interface GetIdentityResponse {
  public_key: string;
  petname: string;
  avatar_svg: string;
  short_id: string;
}

export interface GetAuthIdentityResponse {
  publicKey: string;
  shortId: string;
  petname: string;
  fingerprint: string;
}

export interface SignChallengeResponse {
  publicKey: string;
  signature: string;
  shortId: string;
}

// --- BRC-42 Key Derivation ---

export interface DeriveKeyRequest {
  protocol_id: string;
  key_id: string;
  counterparty: string;
  security_level?: number;
}

export interface DeriveKeyResponse {
  public_key: string;
}

// --- Message Signing ---

export interface SignMessageRequest {
  data: number[];
  protocol_id?: string;
  key_id?: string;
  counterparty?: string;
  use_identity_key?: boolean;
}

export interface SignMessageResponse {
  signature: number[];
  public_key: string;
}

export interface VerifyMessageRequest {
  data: number[];
  signature: number[];
  public_key: string;
}

export interface VerifyMessageResponse {
  valid: boolean;
}

// --- Identicon Generation ---

export interface GenerateIdenticonRequest {
  public_key: string;
  size?: number;
}

export interface GenerateIdenticonResponse {
  svg: string;
}
