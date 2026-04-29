/**
 * Desktop Configuration Type Definitions
 *
 * Defines type contracts for:
 * - Application configuration schema
 * - User preferences (theme, models, etc.)
 * - Gateway configuration
 * - Chat configuration
 *
 * All implementation nodes MUST import from this contract.
 * Implementation in src/lib/config.ts
 */

// ============================================================================
// Desktop Configuration
// ============================================================================

/**
 * Theme preference
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Chat configuration
 */
export interface ChatConfig {
  /** Enable streaming responses */
  enableStreaming: boolean;

  /** Temperature (0.0-1.0) */
  temperature: number;

  /** Max tokens per response */
  maxTokens: number;
}

/**
 * Persisted gateway profile for multi-gateway desktop usage.
 */
export interface GatewayProfile {
  /** Stable profile identifier */
  id: string;

  /** User-visible profile name */
  name: string;

  /** Full gateway URL (e.g., "http://localhost:18789") */
  gatewayUrl: string;

  /** Gateway server port (derived from URL) */
  gatewayPort: number;

  /** Gateway auth token override */
  gatewayToken: string;

  /** SSH tunnel configuration (for remote gateways) */
  ssh?: {
    /** Whether this profile uses an SSH tunnel */
    enabled: boolean;

    /** SSH host from ~/.ssh/config (e.g., "hostinger-personal") */
    host: string;

    /** Remote port the gateway listens on (default: 18789) */
    remotePort: number;

    /** Local port for the tunnel endpoint (auto-assigned if 0) */
    localPort: number;
  };
}

/**
 * Gateway configuration subset (desktop-specific settings)
 */
export interface GatewayConfigSubset {
  /** Auto-restart on crash */
  autoRestart: boolean;

  /** Max restart attempts */
  maxRestarts: number;

  /** Health check interval (milliseconds) */
  healthCheckInterval: number;
}

/**
 * Complete desktop application configuration
 */
export interface DesktopConfig {
  /** Full gateway URL (e.g., "http://localhost:18789") */
  gatewayUrl: string;

  /** Gateway server port (derived from URL) */
  gatewayPort: number;

  /** Gateway auth token (overrides ~/.edwinpai/edwinpai.json token when set) */
  gatewayToken: string;

  /** Persisted gateway connection profiles */
  gatewayProfiles: GatewayProfile[];

  /** Active gateway profile identifier */
  activeGatewayProfileId: string;

  /** Auto-start gateway on app launch */
  autoStartGateway: boolean;

  /** Theme preference */
  theme: ThemePreference;

  /** Default model for chat */
  defaultModel: string;

  /** Chat configuration */
  chat: ChatConfig;

  /** Gateway configuration */
  gateway: GatewayConfigSubset;
}

/**
 * Partial desktop configuration (for updates)
 */
export type PartialDesktopConfig = Partial<
  Omit<DesktopConfig, 'chat' | 'gateway'>
> & {
  chat?: Partial<ChatConfig>;
  gateway?: Partial<GatewayConfigSubset>;
};

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_GATEWAY_PROFILE: GatewayProfile = {
  id: 'default',
  name: 'Default Gateway',
  gatewayUrl: 'http://localhost:18789',
  gatewayPort: 18789,
  gatewayToken: '',
};

/**
 * Default chat configuration
 */
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  enableStreaming: true,
  temperature: 0.7,
  maxTokens: 4096,
};

/**
 * Default gateway configuration subset
 */
export const DEFAULT_GATEWAY_CONFIG_SUBSET: GatewayConfigSubset = {
  autoRestart: true,
  maxRestarts: 5,
  healthCheckInterval: 30000, // 30 seconds
};

/**
 * Default desktop configuration
 */
export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  gatewayUrl: DEFAULT_GATEWAY_PROFILE.gatewayUrl,
  gatewayPort: DEFAULT_GATEWAY_PROFILE.gatewayPort,
  gatewayToken: DEFAULT_GATEWAY_PROFILE.gatewayToken,
  gatewayProfiles: [DEFAULT_GATEWAY_PROFILE],
  activeGatewayProfileId: DEFAULT_GATEWAY_PROFILE.id,
  autoStartGateway: true,
  theme: 'system',
  defaultModel: 'claude-sonnet-4-5',
  chat: DEFAULT_CHAT_CONFIG,
  gateway: DEFAULT_GATEWAY_CONFIG_SUBSET,
};

// ============================================================================
// Config Validation
// ============================================================================

/**
 * Validate theme preference
 */
export function isValidTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Validate chat config
 */
export function isValidChatConfig(value: unknown): value is ChatConfig {
  if (!value || typeof value !== 'object') return false;

  const c = value as Record<string, unknown>;
  return (
    typeof c.enableStreaming === 'boolean' &&
    typeof c.temperature === 'number' &&
    c.temperature >= 0 &&
    c.temperature <= 1 &&
    typeof c.maxTokens === 'number' &&
    c.maxTokens > 0
  );
}

/**
 * Validate gateway config subset
 */
export function isValidGatewayConfigSubset(
  value: unknown
): value is GatewayConfigSubset {
  if (!value || typeof value !== 'object') return false;

  const c = value as Record<string, unknown>;
  return (
    typeof c.autoRestart === 'boolean' &&
    typeof c.maxRestarts === 'number' &&
    c.maxRestarts >= 0 &&
    typeof c.healthCheckInterval === 'number' &&
    c.healthCheckInterval > 0
  );
}

/**
 * Validate gateway profile
 */
export function isValidGatewayProfile(value: unknown): value is GatewayProfile {
  if (!value || typeof value !== 'object') return false;

  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    c.id.length > 0 &&
    typeof c.name === 'string' &&
    c.name.length > 0 &&
    typeof c.gatewayUrl === 'string' &&
    c.gatewayUrl.length > 0 &&
    typeof c.gatewayPort === 'number' &&
    c.gatewayPort > 0 &&
    c.gatewayPort < 65536 &&
    typeof c.gatewayToken === 'string'
  );
}

/**
 * Validate desktop config
 */
export function isValidDesktopConfig(value: unknown): value is DesktopConfig {
  if (!value || typeof value !== 'object') return false;

  const c = value as Record<string, unknown>;
  return (
    typeof c.gatewayPort === 'number' &&
    c.gatewayPort > 0 &&
    c.gatewayPort < 65536 &&
    typeof c.gatewayToken === 'string' &&
    typeof c.autoStartGateway === 'boolean' &&
    isValidTheme(c.theme) &&
    typeof c.defaultModel === 'string' &&
    c.defaultModel.length > 0 &&
    isValidChatConfig(c.chat) &&
    isValidGatewayConfigSubset(c.gateway) &&
    (c.gatewayProfiles === undefined ||
      (Array.isArray(c.gatewayProfiles) && c.gatewayProfiles.every(isValidGatewayProfile))) &&
    (c.activeGatewayProfileId === undefined || typeof c.activeGatewayProfileId === 'string')
  );
}

function sanitizeGatewayProfile(profile: GatewayProfile): GatewayProfile {
  return {
    ...profile,
    name: profile.name.trim() || 'Unnamed Gateway',
    gatewayPort: Math.max(1, Math.min(65535, profile.gatewayPort)),
    gatewayToken: profile.gatewayToken ?? '',
  };
}

function createLegacyGatewayProfile(config: Pick<DesktopConfig, 'gatewayUrl' | 'gatewayPort' | 'gatewayToken'>): GatewayProfile {
  return sanitizeGatewayProfile({
    id: DEFAULT_GATEWAY_PROFILE.id,
    name: DEFAULT_GATEWAY_PROFILE.name,
    gatewayUrl: config.gatewayUrl || DEFAULT_GATEWAY_PROFILE.gatewayUrl,
    gatewayPort: config.gatewayPort || DEFAULT_GATEWAY_PROFILE.gatewayPort,
    gatewayToken: config.gatewayToken || '',
  });
}

export function getActiveGatewayProfile(config: DesktopConfig): GatewayProfile {
  const match = config.gatewayProfiles.find((profile) => profile.id === config.activeGatewayProfileId);
  return match ?? config.gatewayProfiles[0] ?? DEFAULT_GATEWAY_PROFILE;
}

// ============================================================================
// Config Utilities
// ============================================================================

/**
 * Merge partial config with defaults
 */
export function mergeWithDefaults(
  partial: PartialDesktopConfig
): DesktopConfig {
  const merged: DesktopConfig = {
    ...DEFAULT_DESKTOP_CONFIG,
    ...partial,
    chat: {
      ...DEFAULT_CHAT_CONFIG,
      ...(partial.chat || {}),
    },
    gateway: {
      ...DEFAULT_GATEWAY_CONFIG_SUBSET,
      ...(partial.gateway || {}),
    },
  };

  const rawProfiles =
    partial.gatewayProfiles?.filter(isValidGatewayProfile).map(sanitizeGatewayProfile) ?? [];

  const gatewayProfiles =
    rawProfiles.length > 0 ? rawProfiles : [createLegacyGatewayProfile(merged)];

  const activeGatewayProfile =
    gatewayProfiles.find((profile) => profile.id === partial.activeGatewayProfileId) ??
    gatewayProfiles[0] ??
    DEFAULT_GATEWAY_PROFILE;

  return {
    ...merged,
    gatewayProfiles,
    activeGatewayProfileId: activeGatewayProfile.id,
    gatewayUrl: activeGatewayProfile.gatewayUrl,
    gatewayPort: activeGatewayProfile.gatewayPort,
    gatewayToken: activeGatewayProfile.gatewayToken,
  };
}

/**
 * Sanitize config (ensure all values are within valid ranges)
 */
export function sanitizeConfig(config: DesktopConfig): DesktopConfig {
  const sanitizedProfiles = (config.gatewayProfiles.length > 0
    ? config.gatewayProfiles
    : [createLegacyGatewayProfile(config)]).map(sanitizeGatewayProfile);
  const activeGatewayProfile =
    sanitizedProfiles.find((profile) => profile.id === config.activeGatewayProfileId) ??
    sanitizedProfiles[0] ??
    DEFAULT_GATEWAY_PROFILE;

  return {
    ...config,
    gatewayUrl: activeGatewayProfile.gatewayUrl,
    gatewayPort: activeGatewayProfile.gatewayPort,
    gatewayToken: activeGatewayProfile.gatewayToken,
    gatewayProfiles: sanitizedProfiles,
    activeGatewayProfileId: activeGatewayProfile.id,
    chat: {
      ...config.chat,
      temperature: Math.max(0, Math.min(1, config.chat.temperature)),
      maxTokens: Math.max(1, config.chat.maxTokens),
    },
    gateway: {
      ...config.gateway,
      maxRestarts: Math.max(0, config.gateway.maxRestarts),
      healthCheckInterval: Math.max(1000, config.gateway.healthCheckInterval),
    },
  };
}

// All types are already exported inline above via interface/type declarations
