/**
 * Desktop Configuration - TypeScript Type Definitions
 *
 * Mirrors Rust types in src-tauri/src/commands/config.rs
 * Configuration persisted to ~/.edwinpai/desktop-config.json
 *
 * Phase 4 Updates:
 * - Added `mode` field (gateway/client operating mode)
 * - Added `lastClientSession` field (reconnection state)
 */

import { APP_VERSION } from "@/lib/app-version";

// ============================================================================
// Core Configuration Types
// ============================================================================

/**
 * Persisted operating mode.
 *
 * Runtime ontology note: the stored value `"client"` is historical Desktop
 * app-mode compatibility. Product/UI copy should call this Connect Mode. Do
 * not change the persisted value without a config migration.
 */
export type OperatingMode = "gateway" | "client";

/**
 * UI/product vocabulary for Desktop app mode.
 *
 * `"connect"` maps to the persisted compatibility value `"client"`.
 */
export type AppConnectionMode = "gateway" | "connect";

/**
 * Historical Client Mode session configuration for reconnection.
 *
 * Prefer the `ConnectSessionConfig` alias in new UI/domain code. The shape and
 * persisted `lastClientSession` field remain unchanged for beta compatibility.
 */
export interface ClientSessionConfig {
  /** Gateway's compressed secp256k1 public key (hex, 66 chars) */
  gatewayPubkey: string;

  /** Gateway network address (IP:port or hostname:port) */
  gatewayAddress: string;

  /** Gateway petname (BRC-42 derived or custom) */
  gatewayPetname: string;

  /** UTC timestamp when connection was established (ISO 8601) */
  connectedAt: string;

  /** Permission level for this session */
  permission: "owner" | "member" | "guest";
}

/**
 * Connect Mode session configuration for reconnection.
 *
 * Alias only: persisted config still uses `lastClientSession` and the same JSON
 * shape as `ClientSessionConfig`.
 */
export type ConnectSessionConfig = ClientSessionConfig;

/**
 * Gateway process configuration
 */
export interface GatewayConfig {
  /** Full gateway URL (overrides port if set, e.g., "http://localhost:18789") */
  url: string;

  /** HTTP port for REST API (default: 18789) — used when url is not set */
  port: number;

  /** Auto-start gateway on app launch (default: true) */
  autoStart: boolean;

  /** Auto-restart on crash (default: true) */
  autoRestart: boolean;

  /** Max restart attempts (default: 5) */
  maxRestarts: number;

  /** Health check interval in milliseconds (default: 30000) */
  healthCheckIntervalMs: number;

  /** Log level: "trace" | "debug" | "info" | "warn" | "error" (default: "info") */
  logLevel: string;
}

/**
 * mDNS discovery configuration
 */
export interface MdnsConfig {
  /** Enable mDNS advertising (default: true) */
  enabled: boolean;

  /** Custom service name (default: None, uses hostname) */
  serviceName?: string | null;

  /** Advertise on app startup (default: true) */
  advertiseOnStartup: boolean;
}

/**
 * UI preferences and window state
 */
export interface UiConfig {
  /** Theme preference: "light" | "dark" | "system" (default: "system") */
  theme: string;

  /** Minimize to system tray on close (default: true) */
  minimizeToTray: boolean;

  /** Start minimized on launch (default: false) */
  startMinimized: boolean;

  /** Window width in pixels (default: 1200) */
  windowWidth: number;

  /** Window height in pixels (default: 800) */
  windowHeight: number;

  /** Window X position (default: None, OS decides) */
  windowX?: number | null;

  /** Window Y position (default: None, OS decides) */
  windowY?: number | null;
}

/**
 * Subscription verification settings
 */
export interface SubscriptionConfig {
  /** Cache TTL in seconds (default: 3600 = 1 hour) */
  cacheTtlSeconds: number;

  /** Check subscription on app startup (default: true) */
  checkOnStartup: boolean;

  /** Auto-renew reminder N days before expiry (default: 7) */
  autoRenewReminderDays: number;
}

/**
 * Complete desktop application configuration
 *
 * Persisted to ~/.edwinpai/desktop-config.json
 */
export interface DesktopConfig {
  /** Configuration schema version (semver format) */
  version: string;

  /** Operating mode: gateway (local) or client (remote) */
  mode: OperatingMode;

  /** Gateway process settings */
  gateway: GatewayConfig;

  /** mDNS discovery settings */
  mdns: MdnsConfig;

  /** UI preferences */
  ui: UiConfig;

  /** Subscription caching settings */
  subscription: SubscriptionConfig;

  /** Last client session (for reconnection after restart) */
  lastClientSession?: ClientSessionConfig | null;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_GATEWAY_PORT = Number.parseInt(
  import.meta.env.VITE_EDWINPAI_GATEWAY_PORT ?? "18789",
  10,
);
const DEFAULT_GATEWAY_URL = `http://localhost:${DEFAULT_GATEWAY_PORT}`;

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  url: DEFAULT_GATEWAY_URL,
  port: DEFAULT_GATEWAY_PORT,
  autoStart: true,
  autoRestart: true,
  maxRestarts: 5,
  healthCheckIntervalMs: 30000,
  logLevel: "info",
};

/**
 * Default mDNS configuration
 */
export const DEFAULT_MDNS_CONFIG: MdnsConfig = {
  enabled: true,
  serviceName: null,
  advertiseOnStartup: true,
};

/**
 * Default UI configuration
 */
export const DEFAULT_UI_CONFIG: UiConfig = {
  theme: "system",
  minimizeToTray: true,
  startMinimized: false,
  windowWidth: 1200,
  windowHeight: 800,
  windowX: null,
  windowY: null,
};

/**
 * Default subscription configuration
 */
export const DEFAULT_SUBSCRIPTION_CONFIG: SubscriptionConfig = {
  cacheTtlSeconds: 3600,
  checkOnStartup: true,
  autoRenewReminderDays: 7,
};

/**
 * Default desktop configuration
 */
export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  version: APP_VERSION,
  mode: "gateway",
  gateway: DEFAULT_GATEWAY_CONFIG,
  mdns: DEFAULT_MDNS_CONFIG,
  ui: DEFAULT_UI_CONFIG,
  subscription: DEFAULT_SUBSCRIPTION_CONFIG,
  lastClientSession: null,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if persisted operating mode is valid.
 */
export function isValidOperatingMode(value: unknown): value is OperatingMode {
  return value === "gateway" || value === "client";
}

/**
 * Check if UI/product app connection mode is valid.
 */
export function isValidAppConnectionMode(
  value: unknown,
): value is AppConnectionMode {
  return value === "gateway" || value === "connect";
}

/**
 * Convert persisted config mode into product/UI app-mode vocabulary.
 */
export function toAppConnectionMode(mode: OperatingMode): AppConnectionMode {
  return mode === "client" ? "connect" : "gateway";
}

/**
 * Convert product/UI app-mode vocabulary into persisted config mode.
 */
export function toPersistedOperatingMode(mode: AppConnectionMode): OperatingMode {
  return mode === "connect" ? "client" : "gateway";
}

/**
 * Check if config is in gateway mode
 */
export function isGatewayMode(config: DesktopConfig): boolean {
  return config.mode === "gateway";
}

/**
 * Check if config is in historical Client Mode.
 *
 * Prefer `isConnectMode` in new UI/domain code.
 */
export function isClientMode(config: DesktopConfig): boolean {
  return config.mode === "client";
}

/**
 * Check if config is in Connect Mode.
 *
 * This intentionally checks the persisted compatibility value `"client"`.
 */
export function isConnectMode(config: DesktopConfig): boolean {
  return config.mode === "client";
}

/**
 * Check if client session exists
 */
export function hasClientSession(config: DesktopConfig): boolean {
  return (
    config.lastClientSession !== null && config.lastClientSession !== undefined
  );
}
