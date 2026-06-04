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
export type ThemePreference = "light" | "dark" | "system";

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

  /** Stable vault namespace. Display names may change; this should not. */
  vaultNamespace?: string;

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
export interface WorkspaceProfile {
  /** Stable workspace id/slug used for UI/session grouping */
  id: string;
  /** Human-readable workspace name */
  name: string;
  /** Workspace directory path used by the gateway/runtime */
  path: string;
  /** Optional focus/description for the workspace */
  description?: string;
}

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

  /** Focused workspaces available in Desktop */
  workspaces?: WorkspaceProfile[];

  /** Currently selected workspace id */
  activeWorkspaceId?: string;
}

/**
 * Partial desktop configuration (for updates)
 */
export type PartialDesktopConfig = Partial<
  Omit<DesktopConfig, "chat" | "gateway">
> & {
  chat?: Partial<ChatConfig>;
  gateway?: Partial<GatewayConfigSubset>;
};

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_GATEWAY_PORT = Number.parseInt(
  import.meta.env.VITE_EDWINPAI_GATEWAY_PORT ?? "18789",
  10,
);
const DEFAULT_GATEWAY_URL = `http://localhost:${DEFAULT_GATEWAY_PORT}`;

export const DEFAULT_WORKSPACE_PROFILE: WorkspaceProfile = {
  id: "main",
  name: "Main",
  path: "~/.edwinpai/workspace",
  description: "Default EdwinPAI workspace",
};

export const DEFAULT_GATEWAY_PROFILE: GatewayProfile = {
  id: "default",
  name: "Default Gateway",
  vaultNamespace: "default",
  gatewayUrl: DEFAULT_GATEWAY_URL,
  gatewayPort: DEFAULT_GATEWAY_PORT,
  gatewayToken: "",
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
  theme: "system",
  defaultModel: "claude-sonnet-4-5",
  chat: DEFAULT_CHAT_CONFIG,
  gateway: DEFAULT_GATEWAY_CONFIG_SUBSET,
  workspaces: [DEFAULT_WORKSPACE_PROFILE],
  activeWorkspaceId: DEFAULT_WORKSPACE_PROFILE.id,
};

// ============================================================================
// Config Validation
// ============================================================================

/**
 * Validate theme preference
 */
export function isValidTheme(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Validate chat config
 */
export function isValidChatConfig(value: unknown): value is ChatConfig {
  if (!value || typeof value !== "object") return false;

  const c = value as Record<string, unknown>;
  return (
    typeof c.enableStreaming === "boolean" &&
    typeof c.temperature === "number" &&
    c.temperature >= 0 &&
    c.temperature <= 1 &&
    typeof c.maxTokens === "number" &&
    c.maxTokens > 0
  );
}

/**
 * Validate gateway config subset
 */
export function isValidGatewayConfigSubset(
  value: unknown,
): value is GatewayConfigSubset {
  if (!value || typeof value !== "object") return false;

  const c = value as Record<string, unknown>;
  return (
    typeof c.autoRestart === "boolean" &&
    typeof c.maxRestarts === "number" &&
    c.maxRestarts >= 0 &&
    typeof c.healthCheckInterval === "number" &&
    c.healthCheckInterval > 0
  );
}

/**
 * Validate gateway profile
 */
export function isValidWorkspaceProfile(value: unknown): value is WorkspaceProfile {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    c.id.length > 0 &&
    typeof c.name === "string" &&
    c.name.length > 0 &&
    typeof c.path === "string" &&
    c.path.length > 0 &&
    (c.description === undefined || typeof c.description === "string")
  );
}

export function isValidGatewayProfile(value: unknown): value is GatewayProfile {
  if (!value || typeof value !== "object") return false;

  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    c.id.length > 0 &&
    typeof c.name === "string" &&
    c.name.length > 0 &&
    (c.vaultNamespace === undefined || typeof c.vaultNamespace === "string") &&
    typeof c.gatewayUrl === "string" &&
    c.gatewayUrl.length > 0 &&
    typeof c.gatewayPort === "number" &&
    c.gatewayPort > 0 &&
    c.gatewayPort < 65536 &&
    typeof c.gatewayToken === "string"
  );
}

/**
 * Validate desktop config
 */
export function isValidDesktopConfig(value: unknown): value is DesktopConfig {
  if (!value || typeof value !== "object") return false;

  const c = value as Record<string, unknown>;
  return (
    typeof c.gatewayPort === "number" &&
    c.gatewayPort > 0 &&
    c.gatewayPort < 65536 &&
    typeof c.gatewayToken === "string" &&
    typeof c.autoStartGateway === "boolean" &&
    isValidTheme(c.theme) &&
    typeof c.defaultModel === "string" &&
    c.defaultModel.length > 0 &&
    isValidChatConfig(c.chat) &&
    isValidGatewayConfigSubset(c.gateway) &&
    (c.gatewayProfiles === undefined ||
      (Array.isArray(c.gatewayProfiles) &&
        c.gatewayProfiles.every(isValidGatewayProfile))) &&
    (c.activeGatewayProfileId === undefined ||
      typeof c.activeGatewayProfileId === "string") &&
    (c.workspaces === undefined ||
      (Array.isArray(c.workspaces) && c.workspaces.every(isValidWorkspaceProfile))) &&
    (c.activeWorkspaceId === undefined || typeof c.activeWorkspaceId === "string")
  );
}

function sanitizeWorkspaceId(value: string | undefined, fallback: string): string {
  const raw = (value || fallback || "workspace").trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "workspace";
}

function sanitizeWorkspaceProfile(profile: WorkspaceProfile): WorkspaceProfile {
  const id = sanitizeWorkspaceId(profile.id, profile.name);
  return {
    ...profile,
    id,
    name: profile.name.trim() || id,
    path: profile.path.trim() || DEFAULT_WORKSPACE_PROFILE.path,
    description: profile.description?.trim() || undefined,
  };
}

function sanitizeVaultNamespace(
  value: string | undefined,
  fallback: string,
): string {
  const raw = (value || fallback || "default").trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "default";
}

export function getVaultNamespace(profile: GatewayProfile): string {
  return sanitizeVaultNamespace(profile.vaultNamespace, profile.id);
}

function sanitizeGatewayProfile(profile: GatewayProfile): GatewayProfile {
  return {
    ...profile,
    name: profile.name.trim() || "Unnamed Gateway",
    vaultNamespace: sanitizeVaultNamespace(profile.vaultNamespace, profile.id),
    gatewayPort: Math.max(1, Math.min(65535, profile.gatewayPort)),
    gatewayToken: profile.gatewayToken ?? "",
  };
}

function createLegacyGatewayProfile(
  config: Pick<DesktopConfig, "gatewayUrl" | "gatewayPort" | "gatewayToken">,
): GatewayProfile {
  return sanitizeGatewayProfile({
    id: DEFAULT_GATEWAY_PROFILE.id,
    name: DEFAULT_GATEWAY_PROFILE.name,
    gatewayUrl: config.gatewayUrl || DEFAULT_GATEWAY_PROFILE.gatewayUrl,
    gatewayPort: config.gatewayPort || DEFAULT_GATEWAY_PROFILE.gatewayPort,
    gatewayToken: config.gatewayToken || "",
  });
}

export function getActiveGatewayProfile(config: DesktopConfig): GatewayProfile {
  const match = config.gatewayProfiles.find(
    (profile) => profile.id === config.activeGatewayProfileId,
  );
  return match ?? config.gatewayProfiles[0] ?? DEFAULT_GATEWAY_PROFILE;
}

// ============================================================================
// Config Utilities
// ============================================================================

/**
 * Merge partial config with defaults
 */
export function mergeWithDefaults(
  partial: PartialDesktopConfig,
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

  const rawWorkspaces =
    partial.workspaces
      ?.filter(isValidWorkspaceProfile)
      .map(sanitizeWorkspaceProfile) ?? [];
  const workspaces = rawWorkspaces.length > 0 ? rawWorkspaces : [DEFAULT_WORKSPACE_PROFILE];
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === partial.activeWorkspaceId) ??
    workspaces[0] ??
    DEFAULT_WORKSPACE_PROFILE;

  const rawProfiles =
    partial.gatewayProfiles
      ?.filter(isValidGatewayProfile)
      .map(sanitizeGatewayProfile) ?? [];

  const gatewayProfiles =
    rawProfiles.length > 0 ? rawProfiles : [createLegacyGatewayProfile(merged)];

  const activeGatewayProfile =
    gatewayProfiles.find(
      (profile) => profile.id === partial.activeGatewayProfileId,
    ) ??
    gatewayProfiles[0] ??
    DEFAULT_GATEWAY_PROFILE;

  return {
    ...merged,
    gatewayProfiles,
    activeGatewayProfileId: activeGatewayProfile.id,
    workspaces,
    activeWorkspaceId: activeWorkspace.id,
    gatewayUrl: activeGatewayProfile.gatewayUrl,
    gatewayPort: activeGatewayProfile.gatewayPort,
    gatewayToken: activeGatewayProfile.gatewayToken,
  };
}

/**
 * Sanitize config (ensure all values are within valid ranges)
 */
export function sanitizeConfig(config: DesktopConfig): DesktopConfig {
  const configuredWorkspaces = config.workspaces ?? [];
  const sanitizedWorkspaces = (
    configuredWorkspaces.length > 0 ? configuredWorkspaces : [DEFAULT_WORKSPACE_PROFILE]
  ).filter(isValidWorkspaceProfile).map(sanitizeWorkspaceProfile);
  const activeWorkspace =
    sanitizedWorkspaces.find((workspace) => workspace.id === config.activeWorkspaceId) ??
    sanitizedWorkspaces[0] ??
    DEFAULT_WORKSPACE_PROFILE;

  const sanitizedProfiles = (
    config.gatewayProfiles.length > 0
      ? config.gatewayProfiles
      : [createLegacyGatewayProfile(config)]
  ).map(sanitizeGatewayProfile);
  const activeGatewayProfile =
    sanitizedProfiles.find(
      (profile) => profile.id === config.activeGatewayProfileId,
    ) ??
    sanitizedProfiles[0] ??
    DEFAULT_GATEWAY_PROFILE;

  return {
    ...config,
    gatewayUrl: activeGatewayProfile.gatewayUrl,
    gatewayPort: activeGatewayProfile.gatewayPort,
    gatewayToken: activeGatewayProfile.gatewayToken,
    gatewayProfiles: sanitizedProfiles,
    activeGatewayProfileId: activeGatewayProfile.id,
    workspaces: sanitizedWorkspaces.length > 0 ? sanitizedWorkspaces : [DEFAULT_WORKSPACE_PROFILE],
    activeWorkspaceId: activeWorkspace.id,
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
