/**
 * Crypto Domain IPC wrapper
 * Provides type-safe access to Tauri crypto commands
 */

import { invoke } from "@tauri-apps/api/core";

import type {
  TauriGetIdentityResponse,
  TauriGetAuthIdentityResponse,
  TauriSignChallengeResponse,
  TauriDeriveKeyResponse,
  TauriSignMessageResponse,
  TauriVerifyMessageResponse,
  TauriGenerateIdenticonResponse,
} from "@/types";

/**
 * Get the user's identity (public key, petname, avatar, short ID)
 * Calls Rust: get_identity()
 */
type IdentityWireResponse = TauriGetIdentityResponse & {
  publicKey?: string;
  avatarSvg?: string;
  shortId?: string;
};

type PublicKeyWireResponse = { public_key?: string; publicKey?: string };

function normalizePublicKeyResponse<T extends PublicKeyWireResponse>(
  response: T,
): T & { public_key: string } {
  return {
    ...response,
    public_key: response.public_key ?? response.publicKey ?? "",
  };
}

/**
 * Tauri serializes Rust snake_case fields as camelCase because the command
 * structs use `#[serde(rename_all = "camelCase")]`. Keep the frontend-facing
 * wrapper stable by normalizing responses back to the snake_case type used by
 * existing React code.
 */
export async function getIdentity(): Promise<TauriGetIdentityResponse> {
  const response = await invoke<IdentityWireResponse>("get_identity");
  return {
    public_key: response.public_key ?? response.publicKey ?? "",
    petname: response.petname,
    avatar_svg: response.avatar_svg ?? response.avatarSvg ?? "",
    short_id: response.short_id ?? response.shortId ?? "",
  };
}

/**
 * Get the current identity metadata used for auth headers / signed requests.
 * Calls Rust: get_auth_identity()
 */
export async function getAuthIdentity(): Promise<TauriGetAuthIdentityResponse> {
  return invoke<TauriGetAuthIdentityResponse>("get_auth_identity");
}

/**
 * Sign a challenge with the identity key.
 * Calls Rust: sign_challenge(challenge)
 */
export async function signChallenge(
  challenge: string,
): Promise<TauriSignChallengeResponse> {
  return invoke<TauriSignChallengeResponse>("sign_challenge", { challenge });
}

/**
 * Derive a public key using BRC-42
 * Calls Rust: derive_key(request)
 */
export async function deriveKey(
  protocolId: string,
  keyId: string,
  counterparty: string,
  securityLevel: number = 2,
): Promise<TauriDeriveKeyResponse> {
  const request = {
    protocolId,
    keyId,
    counterparty,
    securityLevel,
  };
  const response = await invoke<TauriDeriveKeyResponse & PublicKeyWireResponse>(
    "derive_key",
    { request },
  );
  return normalizePublicKeyResponse(response);
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
  const request = {
    data: Array.from(params.data),
    ...(params.protocolId !== undefined && { protocolId: params.protocolId }),
    ...(params.keyId !== undefined && { keyId: params.keyId }),
    ...(params.counterparty !== undefined && {
      counterparty: params.counterparty,
    }),
    ...(params.useIdentityKey !== undefined && {
      useIdentityKey: params.useIdentityKey,
    }),
  };
  const response = await invoke<
    TauriSignMessageResponse & PublicKeyWireResponse
  >("sign_message", { request });
  return normalizePublicKeyResponse(response);
}

/**
 * Verify a signature
 * Calls Rust: verify_message(request)
 */
export async function verifyMessage(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: string,
): Promise<TauriVerifyMessageResponse> {
  const request = {
    data: Array.from(data),
    signature: Array.from(signature),
    publicKey,
  };
  return invoke<TauriVerifyMessageResponse>("verify_message", { request });
}

/**
 * Generate an SVG identicon for a public key
 * Calls Rust: generate_identicon(request)
 */
export async function generateIdenticon(
  publicKey: string,
  size: number = 64,
): Promise<TauriGenerateIdenticonResponse> {
  const request = {
    publicKey,
    size,
  };
  return invoke<TauriGenerateIdenticonResponse>("generate_identicon", {
    request,
  });
}
