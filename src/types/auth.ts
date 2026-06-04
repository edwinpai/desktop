/**
 * Multi-User Authorization - TypeScript Type Definitions
 *
 * Defines type contracts for:
 * - BRC-103 authentication and authorization
 * - User management and access control
 * - Invitation lifecycle
 * - Nonce tracking and replay prevention
 *
 * Mirrors Rust types in src-tauri/src/auth/types.rs
 */

// ============================================================================
// Access Control Types
// ============================================================================

/**
 * Desktop user-facing authorization level.
 *
 * This is an actor access level, not an interface/app mode and not a chat channel.
 * Rough mapping: owner = owner/admin, member = read/write restricted Client,
 * guest = read-only restricted Client.
 */
export type AccessLevel = "owner" | "member" | "guest";

/**
 * Access level capability matrix
 */
export interface AccessCapabilities {
  canManageUsers: boolean;
  canWrite: boolean;
  canRead: boolean;
}

export const ACCESS_CAPABILITIES: Record<AccessLevel, AccessCapabilities> = {
  owner: {
    canManageUsers: true,
    canWrite: true,
    canRead: true,
  },
  member: {
    canManageUsers: false,
    canWrite: true,
    canRead: true,
  },
  guest: {
    canManageUsers: false,
    canWrite: false,
    canRead: true,
  },
};

// ============================================================================
// User Management Types
// ============================================================================

/**
 * Authorized user record
 */
export interface AuthUser {
  /** User's public key (hex-encoded secp256k1) */
  pubkey: string;

  /** User's petname */
  petname: string;

  /** Access level granted */
  level: AccessLevel;

  /** Authorization timestamp (ISO 8601) */
  authorizedAt: string;

  /** Last activity timestamp (ISO 8601) */
  lastActive: string;

  /** Invited by (public key, null if owner) */
  invitedBy?: string | null;
}

// ============================================================================
// Invitation Types
// ============================================================================

/**
 * Invitation status
 */
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

/**
 * Invitation record
 */
export interface Invitation {
  /** One-time use token (64 hex chars) */
  token: string;

  /** Access level to grant */
  level: AccessLevel;

  /** Expiration timestamp (ISO 8601) */
  expiresAt: string;

  /** Current status */
  status: InvitationStatus;

  /** Created by (public key) */
  createdBy: string;

  /** Created at timestamp (ISO 8601) */
  createdAt: string;

  /** Redeemed by (public key, undefined if not redeemed) */
  redeemedBy?: string;

  /** Redeemed at timestamp (ISO 8601, undefined if not redeemed) */
  redeemedAt?: string;
}

// ============================================================================
// BRC-103 Authentication Types
// ============================================================================

/**
 * BRC-103 authentication headers
 */
export interface Brc103AuthHeaders {
  /** User's public key (X-BSV-Identity) */
  "X-BSV-Identity": string;

  /** Nonce (X-BSV-Nonce) */
  "X-BSV-Nonce": string;

  /** Signature (X-BSV-Signature) */
  "X-BSV-Signature": string;
}

// ============================================================================
// Invitation Data (for QR codes)
// ============================================================================

/**
 * Invitation details
 */
export interface InvitationDetails {
  /** Gateway public key */
  gatewayPubkey: string;

  /** Gateway network address */
  gatewayAddress: string;

  /** Authorization level granted */
  level: AccessLevel;

  /** Expiration timestamp (ISO 8601) */
  expiresAt: string;

  /** One-time use token */
  token: string;
}

/**
 * Invitation data for QR code encoding
 */
export interface InvitationData {
  /** Protocol version */
  version: "edwinpai-invite-v1";

  /** Invitation details */
  invitation: InvitationDetails;

  /** Optional gateway petname */
  petname?: string;
}

// ============================================================================
// IPC Request/Response Types
// ============================================================================

/**
 * Request: List all authorized users
 */
export type ListUsersRequest = Record<string, never>;

/**
 * Response: List of authorized users
 */
export interface ListUsersResponse {
  users: AuthUser[];
}

/**
 * Request: Get user by public key
 */
export interface GetUserRequest {
  pubkey: string;
}

/**
 * Response: User details
 */
export interface GetUserResponse {
  user?: AuthUser;
}

/**
 * Request: Remove user (owner only)
 */
export interface RemoveUserRequest {
  pubkey: string;
}

/**
 * Response: User removal result
 */
export interface RemoveUserResponse {
  success: boolean;
  message: string;
}

/**
 * Request: Update user's last activity timestamp
 */
export interface UpdateUserActivityRequest {
  pubkey: string;
}

/**
 * Response: Activity update result
 */
export interface UpdateUserActivityResponse {
  success: boolean;
}

/**
 * Request: Create invitation (owner only)
 */
export interface CreateInvitationRequest {
  /** Access level to grant */
  level: AccessLevel;

  /** Expiration time in hours */
  expiresInHours: number;
}

/**
 * Response: Created invitation with token and URL
 */
export interface CreateInvitationResponse {
  /** Invitation token (64 hex chars) */
  token: string;

  /** Full invitation data (JSON-encoded for QR code) */
  invitationData: string;

  /** Expiration timestamp (ISO 8601) */
  expiresAt: string;
}

/**
 * Request: Redeem invitation (client mode)
 */
export interface RedeemInvitationRequest {
  /** Invitation token */
  token: string;

  /** Client's public key */
  clientPubkey: string;
}

/**
 * Response: Redemption result
 */
export interface RedeemInvitationResponse {
  success: boolean;
  message: string;
  accessLevel?: AccessLevel;
}

/**
 * Request: Revoke invitation (owner only)
 */
export interface RevokeInvitationRequest {
  token: string;
}

/**
 * Response: Revocation result
 */
export interface RevokeInvitationResponse {
  success: boolean;
  message: string;
}

/**
 * Request: List all invitations
 */
export interface ListInvitationsRequest {
  /** Optional status filter */
  status?: InvitationStatus;
}

/**
 * Response: List of invitations
 */
export interface ListInvitationsResponse {
  invitations: Invitation[];
}

/**
 * Request: Check user authorization level
 */
export interface CheckAuthorizationRequest {
  pubkey: string;
}

/**
 * Response: Authorization details
 */
export interface CheckAuthorizationResponse {
  authorized: boolean;
  level?: AccessLevel;
}

/**
 * Request: Verify BRC-103 signature
 */
export interface VerifyBrc103SignatureRequest {
  /** User's public key (X-BSV-Identity) */
  identity: string;

  /** Nonce (X-BSV-Nonce) */
  nonce: string;

  /** Signature (X-BSV-Signature) */
  signature: string;

  /** Original signed data */
  data: number[];
}

/**
 * Response: Signature verification result
 */
export interface VerifyBrc103SignatureResponse {
  valid: boolean;
  message: string;
}

// ============================================================================
// Event Types (Backend -> Frontend notifications)
// ============================================================================

/**
 * Event: User added
 */
export interface UserAddedEvent {
  user: AuthUser;
}

/**
 * Event: User removed
 */
export interface UserRemovedEvent {
  pubkey: string;
}

/**
 * Event: Invitation created
 */
export interface InvitationCreatedEvent {
  token: string;
  level: AccessLevel;
  expiresAt: string;
}

/**
 * Event: Invitation redeemed
 */
export interface InvitationRedeemedEvent {
  token: string;
  redeemedBy: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if user has permission to manage users
 */
export function canManageUsers(level: AccessLevel): boolean {
  return ACCESS_CAPABILITIES[level].canManageUsers;
}

/**
 * Check if user has write permission
 */
export function canWrite(level: AccessLevel): boolean {
  return ACCESS_CAPABILITIES[level].canWrite;
}

/**
 * Check if user has read permission
 */
export function canRead(level: AccessLevel): boolean {
  return ACCESS_CAPABILITIES[level].canRead;
}

/**
 * Parse invitation data from JSON string
 */
export function parseInvitationData(json: string): InvitationData {
  return JSON.parse(json) as InvitationData;
}

/**
 * Encode invitation data to JSON string
 */
export function encodeInvitationData(data: InvitationData): string {
  return JSON.stringify(data);
}
