/**
 * Crypto Domain IPC message types (SPEC §3.3)
 *
 * Messages between the AI Domain and the Crypto Domain daemon.
 * Every call is logged for audit.
 */

import type { EdwinPAIConfig, ConfigValidationError } from './api';

// --- AI Domain → Crypto Domain ---

export interface SignRequest {
  type: "SignRequest";
  payload: Uint8Array;
  protocolID: string;
  keyID: string;
  counterparty?: string;
}

export interface SignResponse {
  type: "SignResponse";
  signature: Uint8Array;
  publicKey: string;
}

export interface VerifyRequest {
  type: "VerifyRequest";
  payload: Uint8Array;
  signature: Uint8Array;
  publicKey: string;
}

export interface VerifyResponse {
  type: "VerifyResponse";
  valid: boolean;
}

export interface GetPublicKeyRequest {
  type: "GetPublicKeyRequest";
  identityKey?: boolean;
  protocolID?: string;
  keyID?: string;
  counterparty?: string;
}

export interface GetPublicKeyResponse {
  type: "GetPublicKeyResponse";
  publicKey: string;
}

export interface CheckSubscriptionRequest {
  type: "CheckSubscriptionRequest";
  /** Force refresh from overlay (default: false, uses cache if <72h) */
  forceRefresh?: boolean;
}

export interface CheckSubscriptionResponse {
  type: "CheckSubscriptionResponse";
  /** Subscription state per SPEC §5.6 */
  state: "Active" | "Cached" | "Expired" | "GraceExceeded" | "NotFound";
  /** TXID of subscription UTXO (if known) */
  txid?: string;
  /** Output index */
  vout?: number;
  /** Last verified timestamp (ISO 8601) */
  verifiedAt?: string;
  /** Whether proof is from cache */
  cachedProof: boolean;
  /** Block height of UTXO confirmation */
  blockHeight?: number;
  /** Number of confirmations */
  confirmations?: number;
}

export interface EncryptRequest {
  type: "EncryptRequest";
  plaintext: Uint8Array;
  protocolID: string;
  keyID: string;
  counterparty: string;
}

export interface EncryptResponse {
  type: "EncryptResponse";
  ciphertext: Uint8Array;
}

export interface DecryptRequest {
  type: "DecryptRequest";
  ciphertext: Uint8Array;
  protocolID: string;
  keyID: string;
  counterparty: string;
}

export interface DecryptResponse {
  type: "DecryptResponse";
  plaintext: Uint8Array;
}

// --- EdwinPAI Config IPC (Phase 7) ---

export interface GetEdwinPAIConfigRequest {
  type: "GetEdwinPAIConfigRequest";
}

export interface GetEdwinPAIConfigResponse {
  type: "GetEdwinPAIConfigResponse";
  config: EdwinPAIConfig;
}

export interface UpdateEdwinPAIConfigRequest {
  type: "UpdateEdwinPAIConfigRequest";
  config: EdwinPAIConfig;
}

export interface UpdateEdwinPAIConfigResponse {
  type: "UpdateEdwinPAIConfigResponse";
  success: boolean;
  error?: string;
}

export interface ValidateEdwinPAIConfigRequest {
  type: "ValidateEdwinPAIConfigRequest";
  config: EdwinPAIConfig;
}

export interface ValidateEdwinPAIConfigResponse {
  type: "ValidateEdwinPAIConfigResponse";
  valid: boolean;
  errors: ConfigValidationError[];
}

export interface ResetEdwinPAIConfigRequest {
  type: "ResetEdwinPAIConfigRequest";
}

export interface ResetEdwinPAIConfigResponse {
  type: "ResetEdwinPAIConfigResponse";
  config: EdwinPAIConfig;
}

// --- BRC-42 Key Derivation (Phase 1) ---

export interface DeriveKeyRequest {
  type: "DeriveKeyRequest";
  protocolID: string;
  keyID: string;
  counterparty: string;
  /** Security level (default: 2) */
  securityLevel?: number;
}

export interface DeriveKeyResponse {
  type: "DeriveKeyResponse";
  /** Derived public key (compressed, hex-encoded) */
  publicKey: string;
}

// --- BRC-103 Message Signing (Phase 1) ---

export interface SignMessageRequest {
  type: "SignMessageRequest";
  /** Raw data to sign */
  data: Uint8Array;
  /** Protocol ID for BRC-43 invoice number */
  protocolID?: string;
  /** Key ID for BRC-43 invoice number */
  keyID?: string;
  /** If true, sign with identity key; otherwise derive key */
  useIdentityKey?: boolean;
}

export interface SignMessageResponse {
  type: "SignMessageResponse";
  signature: Uint8Array;
  publicKey: string;
}

// --- SPV Verification (Phase 2) ---

export interface SpvVerifyRequest {
  type: "SpvVerifyRequest";
  /** Transaction ID to verify */
  txid: string;
  /** BEEF envelope containing transaction and proofs */
  beef?: string; // hex-encoded BEEF
  /** Whether to use cached proof (default: true) */
  useCache?: boolean;
}

export interface SpvVerifyResponse {
  type: "SpvVerifyResponse";
  /** Whether transaction is valid */
  valid: boolean;
  /** Transaction ID */
  txid: string;
  /** Block height (if confirmed) */
  blockHeight?: number;
  /** Number of confirmations */
  confirmations?: number;
  /** Whether proof was from cache */
  cached: boolean;
  /** Error message if validation failed */
  error?: string;
}

// --- Overlay/Arcade Submission (Phase 2) ---

export interface SubmitToArcadeRequest {
  type: "SubmitToArcadeRequest";
  /** BEEF envelope (hex-encoded) */
  beef: string;
  /** Topics to submit to */
  topics: string[];
  /** Submission mode */
  mode?: 'current-tx' | 'historical-tx' | 'historical-tx-no-spv';
}

export interface SubmitToArcadeResponse {
  type: "SubmitToArcadeResponse";
  /** Whether submission was accepted */
  accepted: boolean;
  /** Transaction ID */
  txid: string;
  /** Topics accepted */
  topics: string[];
  /** STEAK receipt (if accepted) */
  receipt?: {
    acceptedAt: string;
    signature?: string;
  };
  /** Rejection reason (if not accepted) */
  rejection?: {
    code: string;
    message: string;
  };
}

// --- Identity Operations (Phase 1) ---

export interface GetIdentityRequest {
  type: "GetIdentityRequest";
}

export interface GetIdentityResponse {
  type: "GetIdentityResponse";
  publicKey: string;
  petname: string;
  avatarSvg: string;
  shortId: string;
}

export interface GenerateIdenticonRequest {
  type: "GenerateIdenticonRequest";
  /** Public key to generate identicon from */
  publicKey: string;
  /** Size in pixels (default: 64) */
  size?: number;
}

export interface GenerateIdenticonResponse {
  type: "GenerateIdenticonResponse";
  /** SVG markup for identicon */
  svg: string;
}

// --- Audit Log Operations (Phase 1) ---

export interface GetAuditLogRequest {
  type: "GetAuditLogRequest";
  /** Filter by operation type */
  operation?: string;
  /** Start timestamp (ISO 8601) */
  startTime?: string;
  /** End timestamp (ISO 8601) */
  endTime?: string;
  /** Maximum number of entries to return */
  limit?: number;
}

export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  protocolId?: string;
  keyId?: string;
  counterparty?: string;
  payloadHash?: string;
  success: boolean;
  error?: string;
}

export interface GetAuditLogResponse {
  type: "GetAuditLogResponse";
  entries: AuditLogEntry[];
}

// --- Crypto Domain → Tauri Shell (user authorization) ---

export interface AuthorizeSpendRequest {
  type: "AuthorizeSpendRequest";
  txid: string;
  vout: number;
  amount: number;
  description: string;
}

export interface AuthorizeSpendResponse {
  type: "AuthorizeSpendResponse";
  authorized: boolean;
}

// --- Union types ---

export type CryptoRequest =
  | SignRequest
  | VerifyRequest
  | GetPublicKeyRequest
  | CheckSubscriptionRequest
  | EncryptRequest
  | DecryptRequest
  | DeriveKeyRequest
  | SignMessageRequest
  | GetIdentityRequest
  | GenerateIdenticonRequest
  | GetAuditLogRequest
  | SpvVerifyRequest
  | SubmitToArcadeRequest;

export type CryptoResponse =
  | SignResponse
  | VerifyResponse
  | GetPublicKeyResponse
  | CheckSubscriptionResponse
  | EncryptResponse
  | DecryptResponse
  | DeriveKeyResponse
  | SignMessageResponse
  | GetIdentityResponse
  | GenerateIdenticonResponse
  | GetAuditLogResponse
  | SpvVerifyResponse
  | SubmitToArcadeResponse;

export type CryptoMessage =
  | CryptoRequest
  | CryptoResponse
  | AuthorizeSpendRequest
  | AuthorizeSpendResponse;
