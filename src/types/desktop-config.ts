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
 * Operating mode (gateway or client)
 */
export type OperatingMode = "gateway" | "client";

/**
 * Client session configuration for reconnection
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

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  url: "http://localhost:18789",
  port: 18789,
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
 * Check if operating mode is valid
 */
export function isValidOperatingMode(value: unknown): value is OperatingMode {
  return value === "gateway" || value === "client";
}

/**
 * Check if config is in gateway mode
 */
export function isGatewayMode(config: DesktopConfig): boolean {
  return config.mode === "gateway";
}

/**
 * Check if config is in client mode
 */
export function isClientMode(config: DesktopConfig): boolean {
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
