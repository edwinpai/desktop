/**
 * Crypto Domain IPC wrapper
 * Provides type-safe access to Tauri crypto commands
 */

import { invoke } from '@tauri-apps/api/core';

import type {
  TauriGetIdentityResponse,
  TauriGetAuthIdentityResponse,
  TauriSignChallengeResponse,
  TauriDeriveKeyRequest,
  TauriDeriveKeyResponse,
  TauriSignMessageRequest,
  TauriSignMessageResponse,
  TauriVerifyMessageRequest,
  TauriVerifyMessageResponse,
  TauriGenerateIdenticonRequest,
  TauriGenerateIdenticonResponse,
} from '@/types';

/**
 * Get the user's identity (public key, petname, avatar, short ID)
 * Calls Rust: get_identity()
 */
export async function getIdentity(): Promise<TauriGetIdentityResponse> {
  return invoke<TauriGetIdentityResponse>('get_identity');
}

/**
 * Get the current identity metadata used for auth headers / signed requests.
 * Calls Rust: get_auth_identity()
 */
export async function getAuthIdentity(): Promise<TauriGetAuthIdentityResponse> {
  return invoke<TauriGetAuthIdentityResponse>('get_auth_identity');
}

/**
 * Sign a challenge with the identity key.
 * Calls Rust: sign_challenge(challenge)
 */
export async function signChallenge(challenge: string): Promise<TauriSignChallengeResponse> {
  return invoke<TauriSignChallengeResponse>('sign_challenge', { challenge });
}

/**
 * Derive a public key using BRC-42
 * Calls Rust: derive_key(request)
 */
export async function deriveKey(
  protocolId: string,
  keyId: string,
  counterparty: string,
  securityLevel: number = 2
): Promise<TauriDeriveKeyResponse> {
  const request: TauriDeriveKeyRequest = {
    protocol_id: protocolId,
    key_id: keyId,
    counterparty,
    security_level: securityLevel,
  };
  return invoke<TauriDeriveKeyResponse>('derive_key', { request });
}

/**
 * Sign a message with identity key or derived key
 * Calls Rust: sign_message(request)
 */
export async function signMessage(params: {
  data: Uint8Array;
  protocolId?: string;
  keyId?: string;
  counterparty?: string;
  useIdentityKey?: boolean;
}): Promise<TauriSignMessageResponse> {
  const request: TauriSignMessageRequest = {
    data: Array.from(params.data),
    ...(params.protocolId !== undefined && { protocol_id: params.protocolId }),
    ...(params.keyId !== undefined && { key_id: params.keyId }),
    ...(params.counterparty !== undefined && { counterparty: params.counterparty }),
    ...(params.useIdentityKey !== undefined && { use_identity_key: params.useIdentityKey }),
  };
  return invoke<TauriSignMessageResponse>('sign_message', { request });
}

/**
 * Verify a signature
 * Calls Rust: verify_message(request)
 */
export async function verifyMessage(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: string
): Promise<TauriVerifyMessageResponse> {
  const request: TauriVerifyMessageRequest = {
    data: Array.from(data),
    signature: Array.from(signature),
    public_key: publicKey,
  };
  return invoke<TauriVerifyMessageResponse>('verify_message', { request });
}

/**
 * Generate an SVG identicon for a public key
 * Calls Rust: generate_identicon(request)
 */
export async function generateIdenticon(
  publicKey: string,
  size: number = 64
): Promise<TauriGenerateIdenticonResponse> {
  const request: TauriGenerateIdenticonRequest = {
    public_key: publicKey,
    size,
  };
  return invoke<TauriGenerateIdenticonResponse>('generate_identicon', { request });
}
