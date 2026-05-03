/**
 * Channel config types (SPEC §9.8)
 *
 * Each channel writes a config file to ~/.edwinpai/channels/<name>.json
 * Credentials are encrypted at rest using the Crypto Domain.
 */

export type ChannelName =
  | "whatsapp"
  | "telegram"
  | "matrix"
  | "discord"
  | "slack"
  | "signal";

export interface ChannelSettings {
  autoReply: boolean;
  allowedChatIds: string[];
}

export interface ChannelConfig {
  /** Channel identifier */
  channel: ChannelName;
  /** Whether the channel is enabled */
  enabled: boolean;
  /** ISO 8601 timestamp of when the channel was configured */
  configuredAt: string;
  /** Public key of the user who configured this channel */
  configuredBy: string;
  /** Encrypted credentials (opaque to the AI Domain) */
  credentials: Record<string, string>;
  /** Per-channel settings */
  settings: ChannelSettings;
}

/** Wizard step state */
export type WizardStep =
  | "intro"
  | "credentials"
  | "validation"
  | "confirmation"
  | "saved";

export interface WizardState {
  channel: ChannelName;
  currentStep: WizardStep;
  error?: string;
}

/**
 * Platform-specific credential schemas
 */
export interface WhatsAppCredentials {
  sessionData: string; // JSON session data
}

export interface TelegramCredentials {
  botToken: string; // Format: BOT_ID:AUTH_TOKEN
}

export interface MatrixCredentials {
  homeserver: string;
  accessToken?: string;
  username?: string;
  password?: string;
}

export interface DiscordCredentials {
  botToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface SlackCredentials {
  accessToken: string; // xoxb- or xoxp- prefix
}

export interface SignalCredentials {
  deviceData: string; // JSON device data
}

/**
 * Wizard form data (before encryption)
 */
export type WizardCredentials =
  | WhatsAppCredentials
  | TelegramCredentials
  | MatrixCredentials
  | DiscordCredentials
  | SlackCredentials
  | SignalCredentials;

/**
 * Validation metadata returned from backend
 */
export interface ValidationMetadata {
  botId?: string; // Telegram
  homeserver?: string; // Matrix
  authMethod?: string; // Matrix, Discord
  tokenType?: string; // Slack
  status?: string; // WhatsApp, Signal
  username?: string; // Matrix
}

/**
 * Wizard validation result
 */
export interface WizardValidationResult {
  valid: boolean;
  errorMessage?: string;
  metadata?: ValidationMetadata;
}

/**
 * Channel status enum
 */
export enum ChannelStatus {
  /** Channel is not configured */
  NotConfigured = "not_configured",
  /** Channel is configured but disabled */
  Disabled = "disabled",
  /** Channel is enabled and operational */
  Enabled = "enabled",
  /** Channel has validation errors */
  Error = "error",
}

/**
 * Props for channel wizard components
 */
export interface ChannelWizardProps {
  /** Channel being configured (optional - wizards know their own channel type) */
  channel?: ChannelName;
  /** Called when wizard completes successfully */
  onComplete?: (config: ChannelConfig) => void;
  /** Called when user cancels wizard */
  onCancel?: () => void;
  /** Existing config (for edit mode) */
  existingConfig?: DecryptedChannelConfig;
}

/**
 * Decrypted channel config (used in wizard edit mode)
 */
export interface DecryptedChannelConfig {
  channel: string;
  enabled: boolean;
  configuredAt: string;
  configuredBy: string;
  credentials: Record<string, string>;
  settings: ChannelSettings;
}

/**
 * QR code response for WhatsApp/Signal pairing
 */
export interface QRCodeResponse {
  /** Base64-encoded QR code image data URI */
  qrDataUri: string;
  /** Session ID for tracking pairing status */
  sessionId: string;
  /** Timestamp when QR code was generated */
  generatedAt: string;
  /** Expiration time for QR code (typically 60 seconds) */
  expiresAt: string;
}

/**
 * WhatsApp/Signal session status
 */
export interface SessionStatusResponse {
  /** Session ID */
  sessionId: string;
  /** Connection status: "pending", "connected", "expired", "failed" */
  status: string;
  /** Optional phone number (if connected) */
  phoneNumber?: string;
  /** Optional error message (if failed) */
  error?: string;
}

// --- Backend IPC Request/Response Types ---
// These match the Tauri command signatures in commands/channels.rs

/**
 * Request to create a new channel configuration
 */
export interface CreateChannelRequest {
  channel: string;
  configuredBy: string;
  credentials: Record<string, string>;
  settings: ChannelSettings;
}

/**
 * Request to update an existing channel configuration
 */
export interface UpdateChannelRequest {
  channel: string;
  enabled?: boolean;
  credentials?: Record<string, string>;
  settings?: ChannelSettings;
}

/**
 * Request to validate channel credentials
 */
export interface ValidateChannelRequest {
  channel: string;
  credentials: Record<string, string>;
}

/**
 * Validation result from backend
 */
export interface ValidationResult {
  valid: boolean;
  errorMessage?: string;
  metadata?: Record<string, string>;
}

/**
 * Request to toggle channel enabled status
 */
export interface ToggleChannelRequest {
  channel: string;
  enabled: boolean;
}

// --- useChannels Hook Return Type ---

/**
 * Channel list item with computed status
 */
export interface ChannelListItem {
  config: ChannelConfig;
  status: ChannelStatus;
  lastError?: string;
}

/**
 * Return type for useChannels hook
 */
export interface UseChannelsReturn {
  /** All configured channels */
  channels: ChannelListItem[];
  /** Currently selected channel */
  selectedChannel: ChannelName | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Create a new channel */
  createChannel: (request: CreateChannelRequest) => Promise<ChannelConfig>;
  /** Update an existing channel */
  updateChannel: (request: UpdateChannelRequest) => Promise<ChannelConfig>;
  /** Delete a channel */
  deleteChannel: (channel: string) => Promise<void>;
  /** Toggle channel enabled status */
  toggleChannel: (channel: string, enabled: boolean) => Promise<ChannelConfig>;
  /** Validate credentials without saving */
  validateCredentials: (
    request: ValidateChannelRequest,
  ) => Promise<ValidationResult>;
  /** Refresh channel list */
  refresh: () => Promise<void>;
  /** Select a channel */
  setSelectedChannel: (channel: ChannelName | null) => void;
}

// --- channelStore State Interface ---

/**
 * Wizard state in Zustand store
 */
export interface ChannelWizardState {
  /** Currently active wizard (null if no wizard open) */
  activeWizard: ChannelName | null;
  /** Current step in wizard */
  currentStep: WizardStep;
  /** Form data (plaintext credentials) */
  formData: Record<string, string>;
  /** Validation state */
  validation: {
    isValidating: boolean;
    result: WizardValidationResult | null;
  };
  /** Error message */
  error: string | null;
}

/**
 * Channel store state interface
 */
export interface ChannelStoreState {
  /** All configured channels */
  channels: ChannelConfig[];
  /** Currently selected channel */
  selectedChannel: ChannelName | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Wizard state */
  wizard: ChannelWizardState;

  // --- Actions ---

  /** Load all channels from backend */
  loadChannels: () => Promise<void>;
  /** Create a new channel */
  createChannel: (request: CreateChannelRequest) => Promise<ChannelConfig>;
  /** Update an existing channel */
  updateChannel: (request: UpdateChannelRequest) => Promise<ChannelConfig>;
  /** Delete a channel */
  deleteChannel: (channel: string) => Promise<void>;
  /** Toggle channel enabled status */
  toggleChannel: (channel: string, enabled: boolean) => Promise<ChannelConfig>;
  /** Validate credentials without saving */
  validateCredentials: (
    request: ValidateChannelRequest,
  ) => Promise<ValidationResult>;
  /** Select a channel */
  setSelectedChannel: (channel: ChannelName | null) => void;

  // --- Wizard Actions ---

  /** Open wizard for a channel */
  openWizard: (
    channel: ChannelName,
    existingConfig?: DecryptedChannelConfig,
  ) => void;
  /** Close wizard and reset state */
  closeWizard: () => void;
  /** Navigate to a specific step */
  setWizardStep: (step: WizardStep) => void;
  /** Update wizard form data */
  updateWizardFormData: (data: Record<string, string>) => void;
  /** Trigger validation */
  validateWizardCredentials: () => Promise<void>;
  /** Save wizard (create or update channel) */
  saveWizard: () => Promise<void>;
}

// --- Export Index ---
// All types are exported above. This section documents the contract with backend IPC types.

/**
 * Backend IPC Type Mapping (Phase 5 backend)
 *
 * Frontend Type → Backend Rust Type
 * ─────────────────────────────────────────────────────────────────
 * ChannelName → channel_domain::config::ChannelName
 * ChannelConfig → channel_domain::config::ChannelConfig
 * ChannelSettings → channel_domain::config::ChannelSettings
 * DecryptedChannelConfig → commands::channels::DecryptedChannelConfigResponse
 * ValidationResult → channel_domain::validation::ValidationResult
 * QRCodeResponse → commands::channels::QRCodeResponse
 * SessionStatusResponse → commands::channels::SessionStatusResponse
 *
 * Backend Commands (src-tauri/src/commands/channels.rs):
 * ─────────────────────────────────────────────────────────────────
 * create_channel_cmd(channel, configuredBy, credentials, settings) → ChannelConfig
 * read_channel_cmd(channel) → ChannelConfig
 * read_channel_decrypted_cmd(channel) → DecryptedChannelConfigResponse
 * update_channel_cmd(channel, enabled?, credentials?, settings?) → ChannelConfig
 * delete_channel_cmd(channel) → void
 * list_channels_cmd() → ChannelConfig[]
 * validate_channel_credentials_cmd(channel, credentials) → ValidationResult
 * toggle_channel_cmd(channel, enabled) → ChannelConfig
 * request_whatsapp_qr_cmd() → QRCodeResponse
 * check_whatsapp_status_cmd(sessionId) → SessionStatusResponse
 *
 * Validation Contract (SPEC §9.8):
 * ─────────────────────────────────────────────────────────────────
 * ✅ All 6 platform credential schemas defined (WhatsApp, Telegram, Matrix, Discord, Slack, Signal)
 * ✅ WizardStep state machine: intro → credentials → validation → confirmation → saved
 * ✅ ChannelStatus enum matches backend enabled/disabled states
 * ✅ Request/Response types mirror Tauri command signatures
 * ✅ useChannels hook return type provides complete CRUD interface
 * ✅ channelStore state interface includes wizard state management
 */
