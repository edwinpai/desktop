# Phase 5 Type Export Index & Documentation Standards

**Generated**: 2026-02-11
**Purpose**: Complete export mapping with JSDoc/rustdoc annotation standards
**Related**: PHASE5_TYPE_CONTRACTS.md (main type contract documentation)

---

## Table of Contents

1. [TypeScript Export Mapping](#1-typescript-export-mapping)
2. [Rust Export Mapping](#2-rust-export-mapping)
3. [JSDoc Annotation Standards](#3-jsdoc-annotation-standards)
4. [Rustdoc Annotation Standards](#4-rustdoc-annotation-standards)
5. [Cross-Reference Index](#5-cross-reference-index)

---

## 1. TypeScript Export Mapping

### 1.1 Primary Type File: `src/types/channels.ts`

**Full export tree with line numbers:**

```typescript
// Location: src/types/channels.ts

// ============================================================================
// CORE CHANNEL TYPES (Lines 8-93)
// ============================================================================

/**
 * Channel platform identifier
 *
 * @remarks
 * Represents the 6 supported messaging platforms per SPEC §9.
 * Must match Rust `ChannelName` enum exactly (lowercase serialization).
 * Used as discriminator in configuration and validation.
 *
 * @see {@link ChannelConfig} for usage in channel configuration
 * @see {@link WizardState} for usage in wizard flow
 *
 * @example
 * ```typescript
 * const channel: ChannelName = "telegram";
 * const config = await invoke<ChannelConfig>('read_channel_cmd', { channel });
 * ```
 *
 * @public
 */
export type ChannelName =
  | "whatsapp"   // WhatsApp Business API
  | "telegram"   // Telegram Bot API
  | "matrix"     // Matrix homeserver
  | "discord"    // Discord Bot or OAuth
  | "slack"      // Slack OAuth
  | "signal";    // Signal linked device

/**
 * Per-channel behavior settings
 *
 * @remarks
 * Controls channel-specific automation and access control.
 * Persisted with ChannelConfig to ~/.edwinpai/channels/<name>.json.
 *
 * @property autoReply - Whether EdwinPAI auto-responds to messages
 * @property allowedChatIds - Whitelist of chat/user IDs (empty = all allowed)
 *
 * @see {@link ChannelConfig.settings}
 *
 * @example
 * ```typescript
 * const settings: ChannelSettings = {
 *   autoReply: true,
 *   allowedChatIds: [] // Allow all chats
 * };
 *
 * // Restrict to specific chats
 * const restrictedSettings: ChannelSettings = {
 *   autoReply: false,
 *   allowedChatIds: ["123456789", "987654321"]
 * };
 * ```
 *
 * @public
 */
export interface ChannelSettings {
  /** Enable automatic AI responses to incoming messages */
  autoReply: boolean;
  /** Allowed chat/user IDs (empty array = allow all) */
  allowedChatIds: string[];
}

/**
 * Channel configuration (as stored on disk)
 *
 * @remarks
 * Persisted to ~/.edwinpai/channels/<channel>.json with encrypted credentials.
 * Credentials are encrypted using BRC-42 with:
 * - protocolID: "channel-storage"
 * - keyID: <channel_name>
 * - counterparty: <configured_by>
 *
 * Each credential field is encrypted separately and hex-encoded.
 * Never expose plaintext credentials in this type.
 *
 * @property channel - Platform identifier
 * @property enabled - Whether channel is active
 * @property configuredAt - ISO 8601 timestamp of configuration
 * @property configuredBy - Public key (66 hex chars) of configuring user
 * @property credentials - Encrypted credential map (field → hex ciphertext)
 * @property settings - Channel-specific settings
 *
 * @see {@link WizardCredentials} for plaintext credential schemas
 * @see SPEC.md §9.8 for schema definition
 *
 * @example
 * ```typescript
 * // Creating a channel config
 * const config = await invoke<ChannelConfig>('create_channel_cmd', {
 *   channel: 'telegram',
 *   configuredBy: '02a1b2c3...',
 *   credentials: { botToken: '123456:ABC-DEF...' }, // Plaintext input
 *   settings: { autoReply: true, allowedChatIds: [] }
 * });
 *
 * // config.credentials.botToken is now hex-encoded ciphertext
 * console.log(config.credentials.botToken); // "a1b2c3d4e5f6..."
 * ```
 *
 * @public
 */
export interface ChannelConfig {
  /** Channel platform identifier */
  channel: ChannelName;
  /** Whether the channel is currently enabled */
  enabled: boolean;
  /** ISO 8601 timestamp (e.g., "2026-02-11T10:00:00Z") */
  configuredAt: string;
  /** Public key of user who configured this channel */
  configuredBy: string;
  /** Encrypted credentials (hex-encoded, opaque to frontend) */
  credentials: Record<string, string>;
  /** Per-channel behavior settings */
  settings: ChannelSettings;
}

/**
 * Wizard step identifier
 *
 * @remarks
 * Linear wizard flow: intro → credentials → validation → confirmation → saved.
 * Each step is a distinct UI screen in the wizard.
 *
 * @see {@link WizardState.currentStep}
 *
 * @public
 */
export type WizardStep =
  | "intro"        // Platform introduction and requirements
  | "credentials"  // Credential input form
  | "validation"   // Validating credentials (loading state)
  | "confirmation" // Show validation results and confirm
  | "saved";       // Success confirmation

/**
 * Wizard state (local component state)
 *
 * @remarks
 * Tracks current wizard progress for a specific channel.
 * Not persisted to backend - ephemeral UI state only.
 *
 * @property channel - Channel being configured
 * @property currentStep - Current wizard step
 * @property error - Error message if step failed
 *
 * @see {@link WizardStep} for step definitions
 *
 * @example
 * ```typescript
 * const [wizardState, setWizardState] = useState<WizardState>({
 *   channel: 'telegram',
 *   currentStep: 'intro',
 *   error: undefined
 * });
 *
 * // Advance to next step
 * setWizardState(prev => ({
 *   ...prev,
 *   currentStep: 'credentials',
 *   error: undefined
 * }));
 *
 * // Handle error
 * setWizardState(prev => ({
 *   ...prev,
 *   error: 'Invalid bot token format'
 * }));
 * ```
 *
 * @public
 */
export interface WizardState {
  /** Channel being configured */
  channel: ChannelName;
  /** Current step in wizard flow */
  currentStep: WizardStep;
  /** Error message (if current step failed) */
  error?: string;
}

// ============================================================================
// PLATFORM-SPECIFIC CREDENTIAL SCHEMAS (Lines 95-172)
// ============================================================================

/**
 * WhatsApp credential schema
 *
 * @remarks
 * Uses QR code pairing with WhatsApp Web protocol.
 * Session data obtained after scanning QR code in WhatsApp mobile app.
 *
 * @property sessionData - JSON session data from successful QR pairing
 *
 * @see SPEC.md §9.2 for WhatsApp integration requirements
 *
 * @example
 * ```typescript
 * const credentials: WhatsAppCredentials = {
 *   sessionData: JSON.stringify({
 *     clientId: "abc123",
 *     serverToken: "xyz789",
 *     // ... other session fields
 *   })
 * };
 * ```
 *
 * @public
 */
export interface WhatsAppCredentials {
  /** JSON session data from QR pairing */
  sessionData: string;
}

/**
 * Telegram credential schema
 *
 * @remarks
 * Uses BotFather-generated bot token.
 * Token format: numeric bot ID + colon + 30+ character auth token.
 *
 * @property botToken - Token in format "BOT_ID:AUTH_TOKEN"
 *
 * @see SPEC.md §9.3 for Telegram Bot API requirements
 *
 * @example
 * ```typescript
 * const credentials: TelegramCredentials = {
 *   botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
 * };
 *
 * // Obtain from @BotFather:
 * // 1. Message @BotFather on Telegram
 * // 2. Send /newbot
 * // 3. Follow prompts to get token
 * ```
 *
 * @public
 */
export interface TelegramCredentials {
  /** Bot token in format BOT_ID:AUTH_TOKEN */
  botToken: string;
}

/**
 * Matrix credential schema
 *
 * @remarks
 * Supports two authentication methods:
 * 1. Access token auth: homeserver + accessToken (preferred)
 * 2. Password auth: homeserver + username + password (login flow)
 *
 * Access tokens typically start with "syt_" (Synapse) or "mda_" (Dendrite).
 *
 * @property homeserver - Matrix homeserver URL (https://...)
 * @property accessToken - Pre-generated access token (preferred)
 * @property username - Matrix username (alternative auth)
 * @property password - Matrix password (alternative auth)
 *
 * @see SPEC.md §9.4 for Matrix homeserver requirements
 *
 * @example
 * ```typescript
 * // Method 1: Access token (preferred)
 * const tokenAuth: MatrixCredentials = {
 *   homeserver: "https://matrix.org",
 *   accessToken: "syt_abc123xyz"
 * };
 *
 * // Method 2: Password (performs login)
 * const passwordAuth: MatrixCredentials = {
 *   homeserver: "https://matrix.example.com",
 *   username: "@alice:example.com",
 *   password: "secret123"
 * };
 * ```
 *
 * @public
 */
export interface MatrixCredentials {
  /** Homeserver URL (e.g., https://matrix.org) */
  homeserver: string;
  /** Pre-generated access token (preferred auth method) */
  accessToken?: string;
  /** Matrix username (alternative auth) */
  username?: string;
  /** Matrix password (alternative auth) */
  password?: string;
}

/**
 * Discord credential schema
 *
 * @remarks
 * Supports two authentication methods:
 * 1. Bot token: 59-70 character token from Developer Portal (permanent)
 * 2. OAuth: access token + refresh token + expiration (user auth)
 *
 * Bot tokens preferred for automated channels.
 *
 * @property botToken - Bot token from Discord Developer Portal
 * @property accessToken - OAuth2 access token
 * @property refreshToken - OAuth2 refresh token
 * @property expiresAt - ISO 8601 expiration timestamp for OAuth tokens
 *
 * @see SPEC.md §9.5 for Discord Bot API requirements
 *
 * @example
 * ```typescript
 * // Method 1: Bot token (preferred)
 * const botAuth: DiscordCredentials = {
 *   botToken: "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKl.MnOpQrStUvWxYz..."
 * };
 *
 * // Method 2: OAuth (user authentication)
 * const oauthAuth: DiscordCredentials = {
 *   accessToken: "abc123xyz",
 *   refreshToken: "def456uvw",
 *   expiresAt: "2026-02-12T10:00:00Z"
 * };
 * ```
 *
 * @public
 */
export interface DiscordCredentials {
  /** Bot token from Developer Portal (permanent auth) */
  botToken?: string;
  /** OAuth2 access token (temporary auth) */
  accessToken?: string;
  /** OAuth2 refresh token */
  refreshToken?: string;
  /** OAuth token expiration timestamp */
  expiresAt?: string;
}

/**
 * Slack credential schema
 *
 * @remarks
 * Uses OAuth2 access tokens with specific prefixes:
 * - Bot tokens: "xoxb-" prefix (app-level authentication)
 * - User tokens: "xoxp-" prefix (user-level authentication)
 *
 * Typically 40+ characters after prefix.
 *
 * @property accessToken - OAuth access token with xoxb-/xoxp- prefix
 *
 * @see SPEC.md §9.6 for Slack OAuth requirements
 *
 * @example
 * ```typescript
 * // Bot token
 * const botAuth: SlackCredentials = {
 *   accessToken: "xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz"
 * };
 *
 * // User token
 * const userAuth: SlackCredentials = {
 *   accessToken: "xoxp-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz"
 * };
 * ```
 *
 * @public
 */
export interface SlackCredentials {
  /** OAuth access token (xoxb- or xoxp- prefix) */
  accessToken: string;
}

/**
 * Signal credential schema
 *
 * @remarks
 * Uses QR code pairing for linked devices.
 * Device data obtained after scanning QR code in Signal mobile app.
 *
 * @property deviceData - JSON device data from successful pairing
 *
 * @see SPEC.md §9.7 for Signal linked device requirements
 *
 * @example
 * ```typescript
 * const credentials: SignalCredentials = {
 *   deviceData: JSON.stringify({
 *     deviceId: 1,
 *     registrationId: 12345,
 *     // ... other device fields
 *   })
 * };
 * ```
 *
 * @public
 */
export interface SignalCredentials {
  /** JSON device data from QR pairing */
  deviceData: string;
}

/**
 * Discriminated union of all credential types
 *
 * @remarks
 * Used in wizard forms before encryption.
 * Each platform has distinct credential requirements.
 *
 * @see {@link WhatsAppCredentials}
 * @see {@link TelegramCredentials}
 * @see {@link MatrixCredentials}
 * @see {@link DiscordCredentials}
 * @see {@link SlackCredentials}
 * @see {@link SignalCredentials}
 *
 * @public
 */
export type WizardCredentials =
  | WhatsAppCredentials
  | TelegramCredentials
  | MatrixCredentials
  | DiscordCredentials
  | SlackCredentials
  | SignalCredentials;

// ============================================================================
// VALIDATION TYPES (Lines 174-227)
// ============================================================================

/**
 * Validation metadata returned from backend
 *
 * @remarks
 * Platform-specific information extracted during credential validation.
 * Used for display in wizard confirmation step.
 * All fields optional - only populated fields relevant to platform.
 *
 * @property botId - Telegram bot ID (numeric)
 * @property homeserver - Matrix homeserver URL
 * @property authMethod - Authentication method used (matrix, discord)
 * @property tokenType - Token type (slack: "bot" or "user")
 * @property status - Connection status (whatsapp, signal: "paired", "linked")
 * @property username - Matrix username (if password auth)
 *
 * @see {@link WizardValidationResult.metadata}
 *
 * @example
 * ```typescript
 * // Telegram metadata
 * const telegramMeta: ValidationMetadata = {
 *   botId: "123456"
 * };
 *
 * // Matrix metadata (access token auth)
 * const matrixMeta: ValidationMetadata = {
 *   homeserver: "https://matrix.org",
 *   authMethod: "accessToken"
 * };
 *
 * // Slack metadata
 * const slackMeta: ValidationMetadata = {
 *   tokenType: "bot"
 * };
 * ```
 *
 * @public
 */
export interface ValidationMetadata {
  /** Telegram: extracted bot ID */
  botId?: string;
  /** Matrix: homeserver URL */
  homeserver?: string;
  /** Matrix/Discord: authentication method used */
  authMethod?: string;
  /** Slack: token type (bot or user) */
  tokenType?: string;
  /** WhatsApp/Signal: connection status */
  status?: string;
  /** Matrix: username (if password auth) */
  username?: string;
}

/**
 * Validation result from backend
 *
 * @remarks
 * Returned by validate_channel_credentials_cmd without persisting data.
 * Validation is schema-based only (no live API calls).
 *
 * @property valid - Whether credentials passed validation
 * @property errorMessage - Error description (only if valid=false)
 * @property metadata - Platform-specific metadata (only if valid=true)
 *
 * @see {@link ValidationMetadata} for metadata structure
 *
 * @example
 * ```typescript
 * const result = await invoke<WizardValidationResult>(
 *   'validate_channel_credentials_cmd',
 *   {
 *     channel: 'telegram',
 *     credentials: { botToken: '123456:ABC-DEF...' }
 *   }
 * );
 *
 * if (result.valid) {
 *   console.log('Bot ID:', result.metadata?.botId);
 * } else {
 *   console.error('Error:', result.errorMessage);
 * }
 * ```
 *
 * @public
 */
export interface WizardValidationResult {
  /** Whether credentials passed validation */
  valid: boolean;
  /** Error description (only if valid=false) */
  errorMessage?: string;
  /** Platform-specific metadata (only if valid=true) */
  metadata?: ValidationMetadata;
}
```

---

### 1.2 Component Store: `src/stores/channelStore.ts`

**Export tree:**

```typescript
/**
 * Channel wizard Zustand store
 *
 * @remarks
 * Manages wizard state, channel CRUD operations, and permission checks.
 * Global state accessible from all channel components.
 *
 * @see {@link ChannelConfig} for channel configuration structure
 * @see {@link WizardState} for wizard state structure
 *
 * @example
 * ```typescript
 * import { useChannelStore } from '@/stores/channelStore';
 *
 * function ChannelList() {
 *   const { channels, loadChannels } = useChannelStore();
 *
 *   useEffect(() => {
 *     loadChannels();
 *   }, [loadChannels]);
 *
 *   return (
 *     <div>
 *       {channels.map(ch => (
 *         <div key={ch.channel}>{ch.channel}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @public
 */
export const useChannelStore = create<ChannelStore>((set, get) => ({ /* ... */ }));

/**
 * Channel store state interface
 *
 * @internal
 */
interface ChannelStore {
  // State
  channels: ChannelConfig[];
  wizardState: WizardState | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadChannels: () => Promise<void>;
  createChannel: (config: Partial<ChannelConfig>) => Promise<void>;
  updateChannel: (channel: ChannelName, updates: Partial<ChannelConfig>) => Promise<void>;
  deleteChannel: (channel: ChannelName) => Promise<void>;
  toggleChannel: (channel: ChannelName, enabled: boolean) => Promise<void>;
  validateCredentials: (channel: ChannelName, credentials: Record<string, string>) => Promise<WizardValidationResult>;

  // Wizard actions
  startWizard: (channel: ChannelName) => void;
  cancelWizard: () => void;
  updateWizardStep: (step: WizardStep) => void;
  setWizardError: (error: string | null) => void;
}
```

---

## 2. Rust Export Mapping

### 2.1 Module: `src-tauri/src/channel_domain/mod.rs`

**Full export tree:**

```rust
// Channel Domain (SPEC §9)
//
// Manages channel integration wizards, credential encryption, and config persistence.

// ============================================================================
// Module Declarations
// ============================================================================

/// Channel configuration storage and CRUD operations
pub mod config;

/// BRC-42 credential encryption/decryption
pub mod encryption;

/// Platform-specific credential validation
pub mod validation;

// ============================================================================
// Configuration Types and Functions
// ============================================================================

pub use config::{
    /// Creates a new channel configuration
    ///
    /// # Arguments
    /// * `channel` - Channel platform to configure
    /// * `configured_by` - Public key of configuring user
    /// * `plaintext_credentials` - Map of credential field names → plaintext values
    /// * `settings` - Per-channel behavior settings
    ///
    /// # Returns
    /// Created configuration with encrypted credentials
    ///
    /// # Errors
    /// * Channel already configured
    /// * BRC-42 encryption failure
    /// * File I/O error
    ///
    /// # Example
    /// ```rust
    /// let config = create_channel(
    ///     ChannelName::Telegram,
    ///     "02a1b2c3...".to_string(),
    ///     HashMap::from([("botToken".to_string(), "123456:ABC...".to_string())]),
    ///     ChannelSettings::default()
    /// ).await?;
    /// ```
    create_channel,

    /// Deletes a channel configuration
    ///
    /// # Arguments
    /// * `channel` - Channel to delete
    ///
    /// # Returns
    /// Success (idempotent - no error if channel doesn't exist)
    ///
    /// # Errors
    /// * File I/O error
    ///
    /// # File System
    /// Deletes ~/.edwinpai/channels/<channel>.json
    delete_channel,

    /// Lists all configured channels
    ///
    /// # Returns
    /// Array of all channel configurations (empty if none configured)
    ///
    /// # Errors
    /// * Directory read error
    list_channels,

    /// Reads a channel configuration (encrypted)
    ///
    /// # Arguments
    /// * `channel` - Channel to read
    ///
    /// # Returns
    /// Configuration with encrypted credentials
    ///
    /// # Errors
    /// * Channel not configured
    /// * File I/O error
    /// * JSON parse error
    read_channel,

    /// Reads a channel configuration with decrypted credentials
    ///
    /// # Arguments
    /// * `channel` - Channel to read
    ///
    /// # Returns
    /// Configuration with plaintext credentials (in-memory only)
    ///
    /// # Security
    /// Credentials are decrypted in-memory only, never logged or persisted
    ///
    /// # Errors
    /// * Channel not configured
    /// * BRC-42 decryption failure
    read_channel_decrypted,

    /// Updates an existing channel configuration
    ///
    /// # Arguments
    /// * `channel` - Channel to update
    /// * `enabled` - New enabled state (None = no change)
    /// * `plaintext_credentials` - New credentials (None = no change)
    /// * `settings` - New settings (None = no change)
    ///
    /// # Returns
    /// Updated configuration
    ///
    /// # Errors
    /// * Channel not configured
    /// * BRC-42 encryption failure (if updating credentials)
    /// * File I/O error
    update_channel,

    /// Channel configuration struct
    ///
    /// Persisted to ~/.edwinpai/channels/<channel>.json with encrypted credentials.
    ///
    /// # Fields
    /// * `channel` - Platform identifier (serializes to lowercase string)
    /// * `enabled` - Whether channel is active
    /// * `configured_at` - ISO 8601 timestamp
    /// * `configured_by` - Public key (66 hex chars)
    /// * `credentials` - Encrypted credential map (field → hex ciphertext)
    /// * `settings` - Per-channel behavior settings
    ///
    /// # Encryption
    /// Each credential field encrypted with BRC-42:
    /// * protocolID: "channel-storage"
    /// * keyID: <channel_name>
    /// * counterparty: <configured_by>
    ///
    /// # Example JSON
    /// ```json
    /// {
    ///   "channel": "telegram",
    ///   "enabled": true,
    ///   "configuredAt": "2026-02-11T10:00:00Z",
    ///   "configuredBy": "02a1b2c3...",
    ///   "credentials": {
    ///     "botToken": "a1b2c3d4e5f6..." // hex-encoded ciphertext
    ///   },
    ///   "settings": {
    ///     "autoReply": true,
    ///     "allowedChatIds": []
    ///   }
    /// }
    /// ```
    ChannelConfig,

    /// Channel platform identifier enum
    ///
    /// Represents the 6 supported messaging platforms (SPEC §9).
    ///
    /// # Serialization
    /// Serializes to lowercase string ("whatsapp", "telegram", etc.)
    /// Deserializes case-insensitively
    ///
    /// # Variants
    /// * `WhatsApp` - WhatsApp Business API
    /// * `Telegram` - Telegram Bot API
    /// * `Matrix` - Matrix homeserver
    /// * `Discord` - Discord Bot or OAuth
    /// * `Slack` - Slack OAuth
    /// * `Signal` - Signal linked device
    ChannelName,

    /// Per-channel behavior settings
    ///
    /// Controls channel automation and access control.
    ///
    /// # Fields
    /// * `auto_reply` - Enable automatic AI responses (default: true)
    /// * `allowed_chat_ids` - Whitelist of chat/user IDs (default: empty = all)
    ///
    /// # Serialization
    /// Uses camelCase for JSON compatibility with TypeScript
    ChannelSettings,

    /// Channel configuration with decrypted credentials (in-memory only)
    ///
    /// **Security**: No Serialize/Deserialize derive - prevents accidental export
    ///
    /// # Fields
    /// Same as ChannelConfig but credentials are plaintext HashMap<String, String>
    ///
    /// # Usage
    /// Only exists during read_channel_decrypted() call for wizard editing
    DecryptedChannelConfig,
};

// ============================================================================
// Encryption Functions
// ============================================================================

pub use encryption::{
    /// Decrypts channel credentials
    ///
    /// # Arguments
    /// * `channel_name` - Channel identifier (used as BRC-42 keyID)
    /// * `encrypted_credentials` - Map of field names → hex ciphertext
    /// * `counterparty` - Optional counterparty public key
    ///
    /// # Returns
    /// Map of field names → plaintext values
    ///
    /// # Errors
    /// * Invalid hex encoding
    /// * BRC-42 decryption failure
    /// * Missing keychain entry
    ///
    /// # Security
    /// Uses BRC-42 with protocolID="channel-storage"
    decrypt_credentials,

    /// Encrypts channel credentials
    ///
    /// # Arguments
    /// * `channel_name` - Channel identifier (used as BRC-42 keyID)
    /// * `plaintext_credentials` - Map of field names → plaintext values
    /// * `counterparty` - Optional counterparty public key
    ///
    /// # Returns
    /// Map of field names → hex-encoded ciphertext
    ///
    /// # Errors
    /// * BRC-42 encryption failure
    /// * Missing keychain entry
    ///
    /// # Security
    /// Uses BRC-42 with protocolID="channel-storage"
    /// Each field encrypted separately (field name → hex ciphertext)
    encrypt_credentials,
};

// ============================================================================
// Validation Types and Functions
// ============================================================================

pub use validation::{
    /// Validates channel credentials
    ///
    /// # Arguments
    /// * `channel` - Channel platform
    /// * `credentials` - Map of credential field names → plaintext values
    ///
    /// # Returns
    /// Validation result with success/failure and optional metadata
    ///
    /// # Validation Strategy
    /// Schema validation only (no live API calls):
    /// * Format checks (token formats, URL validation)
    /// * JSON parsing (WhatsApp/Signal session data)
    /// * Metadata extraction (bot IDs, homeservers, token types)
    ///
    /// # Platform-Specific Validation
    /// * **WhatsApp**: JSON parse check for sessionData
    /// * **Telegram**: Bot token format (BOT_ID:AUTH_TOKEN)
    /// * **Matrix**: Dual-auth (accessToken OR username+password)
    /// * **Discord**: Dual-auth (botToken OR OAuth)
    /// * **Slack**: Token prefix (xoxb-/xoxp-)
    /// * **Signal**: JSON parse check for deviceData
    ///
    /// # Example
    /// ```rust
    /// let result = validate_credentials(
    ///     ChannelName::Telegram,
    ///     HashMap::from([("botToken".to_string(), "123456:ABC...".to_string())])
    /// ).await?;
    ///
    /// if result.valid {
    ///     println!("Bot ID: {}", result.metadata.unwrap().get("botId").unwrap());
    /// }
    /// ```
    validate_credentials,

    /// Validation result struct
    ///
    /// Returned by platform-specific validation functions.
    ///
    /// # Fields
    /// * `valid` - Whether credentials passed validation
    /// * `error_message` - Error description (only if valid=false)
    /// * `metadata` - Platform-specific metadata (only if valid=true)
    ///
    /// # Serialization
    /// Uses camelCase for JSON compatibility with TypeScript
    /// Maps to TypeScript `WizardValidationResult` type
    ///
    /// # Example
    /// ```rust
    /// let success = ValidationResult::success(Some(HashMap::from([
    ///     ("botId".to_string(), "123456".to_string()),
    /// ])));
    ///
    /// let failure = ValidationResult::failure(
    ///     "Invalid bot token format".to_string()
    /// );
    /// ```
    ValidationResult,
};
```

---

### 2.2 Module: `src-tauri/src/commands/channels.rs`

**Command exports (8 total):**

```rust
/// Export all channel commands to lib.rs for registration
pub use {
    create_channel_cmd,
    read_channel_cmd,
    read_channel_decrypted_cmd,
    update_channel_cmd,
    delete_channel_cmd,
    list_channels_cmd,
    validate_channel_credentials_cmd,
    toggle_channel_cmd,
    DecryptedChannelConfigResponse,
};
```

---

## 3. JSDoc Annotation Standards

### 3.1 JSDoc Tags Reference

**Required tags for all exported types:**

```typescript
/**
 * [Brief one-line description]
 *
 * @remarks
 * [Detailed description, usage context, constraints]
 * [Integration points with other types]
 * [Security considerations (if applicable)]
 *
 * @property field1 - [Field description]
 * @property field2 - [Field description]
 *
 * @see {@link RelatedType1}
 * @see {@link RelatedType2}
 * @see SPEC.md §X.Y for requirements
 *
 * @example
 * ```typescript
 * [Complete, runnable example]
 * ```
 *
 * @public | @internal
 */
```

**Tag usage guidelines:**

| Tag | Usage | Required? | Example |
|-----|-------|-----------|---------|
| `@remarks` | Detailed description, context | ✅ Yes (public) | `@remarks Persisted to ~/.edwinpai/channels/` |
| `@property` | Field description | ✅ Yes (interfaces) | `@property enabled - Whether channel is active` |
| `@see` | Cross-references | ⚠️ Optional | `@see {@link ChannelConfig}` |
| `@example` | Usage example | ✅ Yes (public) | `@example const cfg: ChannelConfig = ...` |
| `@public` | Public API | ✅ Yes | `@public` |
| `@internal` | Internal use only | ⚠️ As needed | `@internal` |
| `@deprecated` | Deprecated API | ⚠️ As needed | `@deprecated Use XYZ instead` |
| `@throws` | Error conditions | ⚠️ As needed | `@throws {Error} If channel not found` |

---

### 3.2 JSDoc Examples

**Interface documentation:**

```typescript
/**
 * Channel configuration (as stored on disk)
 *
 * @remarks
 * Persisted to ~/.edwinpai/channels/<channel>.json with encrypted credentials.
 * Credentials are encrypted using BRC-42 with protocolID="channel-storage".
 * Each credential field is encrypted separately and hex-encoded.
 * Never expose plaintext credentials in this type.
 *
 * @property channel - Platform identifier
 * @property enabled - Whether channel is active
 * @property configuredAt - ISO 8601 timestamp of configuration
 * @property configuredBy - Public key (66 hex chars) of configuring user
 * @property credentials - Encrypted credential map (field → hex ciphertext)
 * @property settings - Channel-specific settings
 *
 * @see {@link WizardCredentials} for plaintext credential schemas
 * @see SPEC.md §9.8 for schema definition
 *
 * @example
 * ```typescript
 * const config = await invoke<ChannelConfig>('create_channel_cmd', {
 *   channel: 'telegram',
 *   configuredBy: '02a1b2c3...',
 *   credentials: { botToken: '123456:ABC...' },
 *   settings: { autoReply: true, allowedChatIds: [] }
 * });
 * ```
 *
 * @public
 */
export interface ChannelConfig {
  channel: ChannelName;
  enabled: boolean;
  configuredAt: string;
  configuredBy: string;
  credentials: Record<string, string>;
  settings: ChannelSettings;
}
```

**Function documentation:**

```typescript
/**
 * Validates channel credentials without persisting
 *
 * @remarks
 * Performs schema-based validation only (no live API calls).
 * Fast, works offline, no rate limiting.
 * Returns platform-specific metadata on success.
 *
 * @param channel - Channel platform to validate
 * @param credentials - Plaintext credentials to validate
 * @returns Validation result with success/failure + metadata
 *
 * @throws {Error} If invoke command fails (network error, backend crash)
 *
 * @see {@link WizardValidationResult} for return type structure
 *
 * @example
 * ```typescript
 * const result = await validateChannelCredentials('telegram', {
 *   botToken: '123456:ABC-DEF...'
 * });
 *
 * if (result.valid) {
 *   console.log('Bot ID:', result.metadata?.botId);
 * } else {
 *   console.error('Error:', result.errorMessage);
 * }
 * ```
 *
 * @public
 */
export async function validateChannelCredentials(
  channel: ChannelName,
  credentials: Record<string, string>
): Promise<WizardValidationResult> {
  return invoke('validate_channel_credentials_cmd', {
    channel,
    credentials
  });
}
```

---

## 4. Rustdoc Annotation Standards

### 4.1 Rustdoc Markdown Reference

**Required sections for all exported items:**

```rust
/// [Brief one-line description]
///
/// [Detailed description paragraph]
///
/// # Arguments
/// * `param1` - Description
/// * `param2` - Description
///
/// # Returns
/// Description of return value
///
/// # Errors
/// * Error condition 1
/// * Error condition 2
///
/// # Panics
/// (Only if function can panic)
///
/// # Safety
/// (Only for unsafe functions)
///
/// # Example
/// ```rust
/// [Complete, runnable example]
/// ```
///
/// # See also
/// * [`RelatedType`]
/// * SPEC.md §X.Y
pub fn example() -> Result<(), String> { /* ... */ }
```

---

### 4.2 Rustdoc Examples

**Struct documentation:**

```rust
/// Channel configuration (persisted to disk)
///
/// Stored at ~/.edwinpai/channels/<channel>.json with encrypted credentials.
///
/// # Fields
/// * `channel` - Platform identifier (serializes to lowercase string)
/// * `enabled` - Whether channel is active
/// * `configured_at` - ISO 8601 timestamp
/// * `configured_by` - Public key (66 hex chars)
/// * `credentials` - Encrypted credential map (field → hex ciphertext)
/// * `settings` - Per-channel behavior settings
///
/// # Encryption
/// Each credential field encrypted with BRC-42:
/// * protocolID: "channel-storage"
/// * keyID: <channel_name>
/// * counterparty: <configured_by>
///
/// # Example JSON
/// ```json
/// {
///   "channel": "telegram",
///   "enabled": true,
///   "configuredAt": "2026-02-11T10:00:00Z",
///   "configuredBy": "02a1b2c3...",
///   "credentials": {
///     "botToken": "a1b2c3d4e5f6..."
///   },
///   "settings": {
///     "autoReply": true,
///     "allowedChatIds": []
///   }
/// }
/// ```
///
/// # See also
/// * [`ChannelName`] - Platform identifier enum
/// * [`ChannelSettings`] - Per-channel settings
/// * SPEC.md §9.8 - Schema definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelConfig {
    pub channel: ChannelName,
    pub enabled: bool,
    pub configured_at: String,
    pub configured_by: String,
    pub credentials: HashMap<String, String>,
    pub settings: ChannelSettings,
}
```

**Function documentation:**

```rust
/// Creates a new channel configuration
///
/// Encrypts credentials using BRC-42 and writes config to disk atomically.
///
/// # Arguments
/// * `channel` - Channel platform to configure
/// * `configured_by` - Public key of configuring user
/// * `plaintext_credentials` - Map of credential field names → plaintext values
/// * `settings` - Per-channel behavior settings
///
/// # Returns
/// Created configuration with encrypted credentials
///
/// # Errors
/// * `"Channel <name> is already configured"` - Config file exists
/// * `"Failed to encrypt credentials: <reason>"` - BRC-42 error
/// * `"Failed to write config: <reason>"` - File I/O error
///
/// # File System
/// Writes to ~/.edwinpai/channels/<channel>.json using atomic write:
/// 1. Write to <name>.json.tmp
/// 2. Rename to <name>.json (atomic on Unix/Windows)
///
/// # Example
/// ```rust
/// use std::collections::HashMap;
///
/// let config = create_channel(
///     ChannelName::Telegram,
///     "02a1b2c3...".to_string(),
///     HashMap::from([
///         ("botToken".to_string(), "123456:ABC-DEF...".to_string())
///     ]),
///     ChannelSettings::default()
/// ).await?;
///
/// assert_eq!(config.channel, ChannelName::Telegram);
/// assert!(config.credentials.contains_key("botToken"));
/// ```
///
/// # See also
/// * [`encrypt_credentials`] - BRC-42 encryption function
/// * [`ChannelConfig`] - Return type structure
pub async fn create_channel(
    channel: ChannelName,
    configured_by: String,
    plaintext_credentials: HashMap<String, String>,
    settings: ChannelSettings,
) -> Result<ChannelConfig, String> {
    // Implementation...
}
```

---

## 5. Cross-Reference Index

### 5.1 TypeScript ↔ Rust Type Mapping

| TypeScript Type | Rust Type | IPC Flow | Notes |
|----------------|-----------|----------|-------|
| `ChannelName` | `ChannelName` | Both | Lowercase serialization |
| `ChannelSettings` | `ChannelSettings` | TS → Rust | camelCase serde |
| `ChannelConfig` | `ChannelConfig` | Rust → TS | Encrypted credentials |
| `WizardValidationResult` | `ValidationResult` | Rust → TS | Different names, same fields |
| `WizardStep` | N/A | TS only | UI state only |
| `WhatsAppCredentials` | `HashMap<String, String>` | TS → Rust | Platform-specific schema |
| `TelegramCredentials` | `HashMap<String, String>` | TS → Rust | Platform-specific schema |
| `MatrixCredentials` | `HashMap<String, String>` | TS → Rust | Platform-specific schema |
| `DiscordCredentials` | `HashMap<String, String>` | TS → Rust | Platform-specific schema |
| `SlackCredentials` | `HashMap<String, String>` | TS → Rust | Platform-specific schema |
| `SignalCredentials` | `HashMap<String, String>` | TS → Rust | Platform-specific schema |

---

### 5.2 IPC Command → Type Mapping

| Command | Request Types | Response Type | Errors |
|---------|--------------|---------------|--------|
| `create_channel_cmd` | `String`, `String`, `HashMap<String, String>`, `ChannelSettings` | `ChannelConfig` | "Invalid channel name", "Channel already exists", "Encryption failed" |
| `read_channel_cmd` | `String` | `ChannelConfig` | "Invalid channel name", "Channel not found" |
| `read_channel_decrypted_cmd` | `String` | `DecryptedChannelConfigResponse` | "Invalid channel name", "Channel not found", "Decryption failed" |
| `update_channel_cmd` | `String`, `Option<bool>`, `Option<HashMap<String, String>>`, `Option<ChannelSettings>` | `ChannelConfig` | "Invalid channel name", "Channel not found", "Encryption failed" |
| `delete_channel_cmd` | `String` | `()` | "Invalid channel name" (idempotent) |
| `list_channels_cmd` | None | `Vec<ChannelConfig>` | None (returns empty array) |
| `validate_channel_credentials_cmd` | `String`, `HashMap<String, String>` | `ValidationResult` | "Invalid channel name" |
| `toggle_channel_cmd` | `String`, `bool` | `ChannelConfig` | "Invalid channel name", "Channel not found" |

---

### 5.3 Validation Metadata Keys

**Platform-specific metadata keys returned in ValidationResult.metadata:**

| Platform | Metadata Keys | Example Values |
|----------|--------------|----------------|
| WhatsApp | `status` | `"paired"` |
| Telegram | `botId` | `"123456"` |
| Matrix | `homeserver`, `authMethod`, `username` | `"https://matrix.org"`, `"accessToken"`, `"@alice:matrix.org"` |
| Discord | `authMethod` | `"botToken"` or `"oauth"` |
| Slack | `tokenType` | `"bot"` or `"user"` |
| Signal | `status` | `"linked"` |

---

**End of Phase 5 Type Export Index & Documentation Standards**
