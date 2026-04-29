import type { ClientSessionConfig } from './desktop-config';

/**
 * Gateway REST API types (SPEC §10)
 *
 * OpenAI-compatible chat API + EdwinPAI-specific endpoints.
 */

// --- Authentication headers (SPEC §10.1) ---

export interface BsvAuthHeaders {
  "X-BSV-Identity": string;
  "X-BSV-Nonce": string;
  "X-BSV-Signature": string;
}

// --- Chat completions (OpenAI-compatible) ---

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  tool_use?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  max_tokens?: number;
}

export interface ChatCompletionChunkChoice {
  delta: { content?: string; role?: ChatRole };
  index: number;
  finish_reason?: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created?: number;
  choices: ChatCompletionChunkChoice[];
}

export interface ChatCompletionChoice {
  message: ChatMessage;
  index: number;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  choices: ChatCompletionChoice[];
}

// --- Identity endpoint ---

export interface IdentityResponse {
  publicKey: string;
  petname: string;
  version: string;
  mode: "gateway" | "client";
  channels: string[];
}

// --- Subscription endpoint ---

export interface SubscriptionUtxo {
  txid: string;
  vout: number;
}

export interface SubscriptionResponse {
  active: boolean;
  utxo?: SubscriptionUtxo;
  verifiedAt?: string;
  method: "spv" | "cached";
}

export type SubscriptionStatusResponse = SubscriptionResponse;

// --- User management (owner only) ---

export interface UserEntry {
  publicKey: string;
  permissionLevel: "owner" | "member" | "guest";
  petname: string;
  addedAt?: string;
  invitedBy?: string | null;
}

export type UserRecord = UserEntry;

export interface UsersResponse {
  users: UserEntry[];
}

export interface InviteRequest {
  permissionLevel: "member" | "guest";
  expiresInHours: number;
}

export interface InviteResponse {
  inviteToken: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface DeleteUserResponse {
  ok: boolean;
}

// --- Invitation redemption ---

export interface RedeemInviteRequest {
  inviteToken: string;
  publicKey: string;
}

export interface RedeemInviteResponse {
  permissionLevel: "member" | "guest";
  gatewayPublicKey: string;
}

// --- Channel management (owner only) ---

export type ChannelStatus = "connected" | "disconnected" | "error";

export interface ChannelEntry {
  name: string;
  enabled: boolean;
  status: ChannelStatus;
}

export interface ChannelsResponse {
  channels: ChannelEntry[];
}

export interface UpdateChannelRequest {
  enabled: boolean;
}

export type ChannelUpdateRequest = UpdateChannelRequest;

export interface UpdateChannelResponse {
  ok: boolean;
}

// --- Health / Discovery ---

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  uptime: number;
  version: string;
}

// --- Error response format (SPEC §12.1, §12.2) ---

export enum ErrorCodeEnum {
  AuthMissingHeaders = "ERR_AUTH_MISSING_HEADERS",
  AuthInvalidSignature = "ERR_AUTH_INVALID_SIGNATURE",
  AuthNonceReused = "ERR_AUTH_NONCE_REUSED",
  AuthTimingAnomaly = "ERR_AUTH_TIMING_ANOMALY",
  AuthUnauthorized = "ERR_AUTH_UNAUTHORIZED",
  AuthInsufficientPermission = "ERR_AUTH_INSUFFICIENT_PERMISSION",
  SubscriptionInactive = "ERR_SUBSCRIPTION_INACTIVE",
  SubscriptionGraceExceeded = "ERR_SUBSCRIPTION_GRACE_EXCEEDED",
  InviteInvalid = "ERR_INVITE_INVALID",
  InviteUsed = "ERR_INVITE_USED",
  ChannelNotConfigured = "ERR_CHANNEL_NOT_CONFIGURED",
  ChannelDisconnected = "ERR_CHANNEL_DISCONNECTED",
  GatewayUnavailable = "ERR_GATEWAY_UNAVAILABLE",
  CryptoSigningFailed = "ERR_CRYPTO_SIGNING_FAILED",
  CryptoKeychainUnavailable = "ERR_CRYPTO_KEYCHAIN_UNAVAILABLE",
}

export type ErrorCode =
  | "ERR_AUTH_MISSING_HEADERS"
  | "ERR_AUTH_INVALID_SIGNATURE"
  | "ERR_AUTH_NONCE_REUSED"
  | "ERR_AUTH_TIMING_ANOMALY"
  | "ERR_AUTH_UNAUTHORIZED"
  | "ERR_AUTH_INSUFFICIENT_PERMISSION"
  | "ERR_SUBSCRIPTION_INACTIVE"
  | "ERR_SUBSCRIPTION_GRACE_EXCEEDED"
  | "ERR_INVITE_INVALID"
  | "ERR_INVITE_USED"
  | "ERR_CHANNEL_NOT_CONFIGURED"
  | "ERR_CHANNEL_DISCONNECTED"
  | "ERR_GATEWAY_UNAVAILABLE"
  | "ERR_CRYPTO_SIGNING_FAILED"
  | "ERR_CRYPTO_KEYCHAIN_UNAVAILABLE";

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ErrorResponse = ApiError;

// --- HTTP status mapping ---

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  ERR_AUTH_MISSING_HEADERS: 401,
  ERR_AUTH_INVALID_SIGNATURE: 401,
  ERR_AUTH_NONCE_REUSED: 401,
  ERR_AUTH_TIMING_ANOMALY: 401,
  ERR_AUTH_UNAUTHORIZED: 403,
  ERR_AUTH_INSUFFICIENT_PERMISSION: 403,
  ERR_SUBSCRIPTION_INACTIVE: 402,
  ERR_SUBSCRIPTION_GRACE_EXCEEDED: 402,
  ERR_INVITE_INVALID: 400,
  ERR_INVITE_USED: 400,
  ERR_CHANNEL_NOT_CONFIGURED: 404,
  ERR_CHANNEL_DISCONNECTED: 503,
  ERR_GATEWAY_UNAVAILABLE: 503,
  ERR_CRYPTO_SIGNING_FAILED: 500,
  ERR_CRYPTO_KEYCHAIN_UNAVAILABLE: 500,
} as const;

// ============================================================================
// PHASE 4: CLIENT MODE & AUTHORIZATION TYPES
// ============================================================================

/**
 * Discovered peer from mDNS or manual entry
 */
export interface DiscoveredPeer {
  /** Peer public key (hex-encoded secp256k1) */
  pubkey: string;

  /** Peer petname (derived or custom) */
  petname: string;

  /** Network address (IP:port) */
  address: string;

  /** Whether peer is currently reachable */
  isOnline: boolean;

  /** Last seen timestamp (ISO 8601) */
  lastSeen: string;

  /** Current authorization level */
  authorizationLevel: AccessLevel;
}

/**
 * Client connection status
 */
export type ClientConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

/**
 * Invitation data for QR code generation
 */
export interface InvitationData {
  /** Protocol version */
  version: 'edwinpai-invite-v1';

  /** Invitation token */
  invitation: {
    /** Gateway public key */
    gatewayPubkey: string;

    /** Gateway network address */
    gatewayAddress: string;

    /** Authorization level granted */
    level: AccessLevel;

    /** Expiration timestamp (ISO 8601) */
    expiresAt: string;

    /** One-time use token (64 hex chars) */
    token: string;
  };

  /** Optional gateway petname */
  petname?: string;
}

/**
 * User authorization record
 */
export interface UserAuthorization {
  /** User's public key */
  pubkey: string;

  /** User's petname */
  petname: string;

  /** Access level granted */
  level: AccessLevel;

  /** Authorization timestamp (ISO 8601) */
  authorizedAt: string;

  /** Last activity timestamp (ISO 8601) */
  lastActive: string;
}

/**
 * Access level for multi-user authorization
 */
export type AccessLevel = 'owner' | 'member' | 'guest';

/**
 * Access level capability matrix
 */
export const ACCESS_CAPABILITIES: Record<AccessLevel, {
  canManageUsers: boolean;
  canWrite: boolean;
  canRead: boolean;
}> = {
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

/**
 * Client configuration
 */
export interface ClientConfig {
  /** Gateway address */
  gatewayAddress: string;

  /** Gateway public key */
  gatewayPubkey: string;

  /** Gateway petname */
  gatewayPetname: string;

  /** Auto-reconnect on disconnect */
  autoReconnect: boolean;

  /** Reconnect interval (seconds) */
  reconnectIntervalSecs: number;

  /** Connection timeout (seconds) */
  connectionTimeoutSecs: number;
}

/**
 * Invitation status
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

// ============================================================================
// PHASE 6: ONBOARDING & UPDATES TYPES
// ============================================================================

/**
 * IPC request to check for updates.
 *
 * Maps to `check_for_updates` Tauri command.
 */
export interface CheckForUpdatesRequest {
  /** Force check even if within checkInterval */
  force?: boolean;
}

/**
 * Update check result.
 */
export interface UpdateCheckResult {
  /** Whether an update is available */
  available: boolean;

  /** Current installed version */
  currentVersion: string;

  /** Latest available version (if available) */
  latestVersion?: string;

  /** Update metadata (if available) */
  updateInfo?: {
    version: string;
    date: string;
    body: string;
    signature: string;
    pubkey: string;
    downloadUrl: string;
    size: number;
  };

  /** Error message (if check failed) */
  error?: string;
}

/**
 * IPC response for update check.
 */
export interface CheckForUpdatesResponse {
  result: UpdateCheckResult;
}

/**
 * IPC request to apply downloaded update.
 *
 * This will restart the application.
 * Maps to `apply_update` Tauri command.
 */
export interface ApplyUpdateRequest {
  /** Update version to apply */
  version: string;
}

/**
 * IPC response for apply update request.
 */
export interface ApplyUpdateResponse {
  success: boolean;
  error?: string;
}

// ============================================================================
// PHASE 7: EDWINPAI CONFIG TYPES
// ============================================================================

/**
 * EdwinPAI Desktop complete configuration
 */
export interface EdwinPAIConfig {
  /** Config schema version */
  version: string;

  /** Gateway settings */
  gateway: GatewayConfigFull;

  /** AI memory settings */
  memory: MemoryConfig;

  /** User identity settings */
  identity: IdentityConfig;

  /** UI preferences */
  ui: UiConfig;

  /** Operating mode */
  mode: 'gateway' | 'client';

  /** Last client session */
  lastClientSession?: ClientSessionConfig;
}

/**
 * Gateway process and server settings (full version)
 */
export interface GatewayConfigFull {
  /** HTTP server port */
  port: number;

  /** Auto-start gateway on app launch */
  autoStart: boolean;

  /** Auto-restart gateway on crash */
  autoRestart: boolean;

  /** Max restart attempts */
  maxRestarts: number;

  /** Health check interval (ms) */
  healthCheckIntervalMs: number;

  /** Health check timeout (ms) */
  healthCheckTimeoutMs: number;

  /** Log level */
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';

  /** AI provider settings */
  aiProvider: AiProviderConfig;

  /** mDNS settings */
  mdns: MdnsConfig;

  /** Subscription settings */
  subscription: SubscriptionConfigFull;

  /** Channel configurations */
  channels?: Record<string, {
    enabled: boolean;
    credentials: Record<string, string>;
    settings: Record<string, unknown>;
  }>;
}

/**
 * AI provider configuration
 */
export interface AiProviderConfig {
  /** Default model identifier */
  defaultModel: string;

  /** Temperature (0.0-1.0) */
  temperature: number;

  /** Max tokens per response */
  maxTokens: number;

  /** Enable streaming responses */
  enableStreaming: boolean;
}

/**
 * AI memory and context management settings
 */
export interface MemoryConfig {
  /** Enable conversation memory */
  enabled: boolean;

  /** Max conversation history messages */
  maxHistoryMessages: number;

  /** Context window size (tokens) */
  contextWindowSize: number;

  /** Auto-summarize when context exceeds threshold */
  autoSummarize: boolean;

  /** Summarization threshold (0.0-1.0) */
  summarizationThreshold: number;

  /** Persist conversations to disk */
  persistConversations: boolean;

  /** Conversation retention days (0 = forever) */
  retentionDays: number;
}

/**
 * User identity and subscription settings
 */
export interface IdentityConfig {
  /** User's public key (66 hex chars) */
  publicKey?: string;

  /** User's petname */
  petname?: string;

  /** Subscription UTXO */
  subscriptionUtxo?: SubscriptionUtxoRef;

  /** Subscription cache TTL (seconds) */
  subscriptionCacheTtl: number;

  /** Check subscription on startup */
  checkSubscriptionOnStartup: boolean;
}

/**
 * Subscription UTXO reference
 */
export interface SubscriptionUtxoRef {
  /** Transaction ID (64 hex chars) */
  txid: string;

  /** Output index */
  vout: number;
}

/**
 * mDNS configuration
 */
export interface MdnsConfig {
  /** Enable mDNS advertising */
  enabled: boolean;

  /** Custom service name (null = use hostname) */
  serviceName: string | null;

  /** Advertise on startup */
  advertiseOnStartup: boolean;
}

/**
 * Subscription configuration (full version)
 */
export interface SubscriptionConfigFull {
  /** Cache TTL (seconds) */
  cacheTtlSeconds: number;

  /** Check on startup */
  checkOnStartup: boolean;

  /** Auto-renew reminder days */
  autoRenewReminderDays: number;
}

/**
 * UI preferences
 */
export interface UiConfig {
  /** Theme */
  theme: 'light' | 'dark' | 'system';

  /** Minimize to tray */
  minimizeToTray: boolean;

  /** Start minimized */
  startMinimized: boolean;

  /** Window dimensions */
  windowWidth: number;
  windowHeight: number;
  windowX?: number;
  windowY?: number;

  /** Onboarding completion status */
  onboardingComplete?: boolean;
}

/**
 * Config validation error
 */
export interface ConfigValidationError {
  field: string;
  message: string;
}

/**
 * Config error types
 */
export type ConfigErrorType =
  | 'FILE_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'MIGRATION_ERROR'
  | 'LOCK_ERROR';

/**
 * Config error detail
 */
export interface ConfigErrorDetail {
  type: ConfigErrorType;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Default EdwinPAI configuration
 */
export const DEFAULT_EDWINPAI_CONFIG: EdwinPAIConfig = {
  version: '1.0.0',
  gateway: {
    port: 18789,
    autoStart: true,
    autoRestart: true,
    maxRestarts: 5,
    healthCheckIntervalMs: 30_000,
    healthCheckTimeoutMs: 5_000,
    logLevel: 'info',
    aiProvider: {
      defaultModel: 'claude-sonnet-4-5',
      temperature: 0.7,
      maxTokens: 4096,
      enableStreaming: true,
    },
    mdns: {
      enabled: true,
      serviceName: null,
      advertiseOnStartup: true,
    },
    subscription: {
      cacheTtlSeconds: 3600,
      checkOnStartup: true,
      autoRenewReminderDays: 7,
    },
  },
  memory: {
    enabled: true,
    maxHistoryMessages: 100,
    contextWindowSize: 200_000,
    autoSummarize: true,
    summarizationThreshold: 0.8,
    persistConversations: true,
    retentionDays: 30,
  },
  identity: {
    subscriptionCacheTtl: 3600,
    checkSubscriptionOnStartup: true,
  },
  ui: {
    theme: 'system',
    minimizeToTray: true,
    startMinimized: false,
    windowWidth: 1200,
    windowHeight: 800,
  },
  mode: 'gateway',
};
