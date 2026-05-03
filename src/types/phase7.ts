/**
 * Phase 7: Polish, Testing & Distribution - TypeScript Type Definitions
 *
 * Defines type contracts for:
 * - Gateway process management (lifecycle, logs, health checks)
 * - Configuration persistence (EdwinPAI config, UI preferences)
 * - Onboarding flow state (step tracking, progress persistence)
 * - Sidebar/navigation status indicators
 * - Error boundaries and recovery
 * - Auto-updater integration (from Phase 6, extended)
 *
 * Mirrors Rust types in:
 * - src-tauri/src/gateway/types.rs (GatewayProcessInfo, HealthCheckResponse)
 * - src-tauri/src/commands/config.rs (DesktopConfig, OperatingMode)
 * - src-tauri/src/gateway/log.rs (LogEntry - NEW in Phase 7)
 */

import { APP_VERSION } from "@/lib/app-version";

// ============================================================================
// Gateway Process Management (SPEC §7.1, §7.2)
// ============================================================================

/**
 * Gateway process lifecycle states
 */
export type GatewayProcessStatus =
  | "stopped"
  | "starting"
  | "running"
  | "unhealthy"
  | "stopping"
  | "crashed";

/**
 * Gateway process information
 *
 * Includes PID tracking, status monitoring, uptime, and restart count.
 */
export interface GatewayProcess {
  /** Current process status */
  status: GatewayProcessStatus;

  /** Process ID (null if not running) */
  pid: number | null;

  /** Gateway HTTP port */
  port: number;

  /** Process start timestamp (ISO 8601, null if not running) */
  startedAt: string | null;

  /** Last health check timestamp (ISO 8601) */
  lastHealthCheck: string | null;

  /** Number of automatic restarts since last manual start */
  restartCount: number;

  /** Process uptime in seconds (0 if not running) */
  uptime: number;
}

/**
 * Health check status (from gateway HTTP /health endpoint)
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Service health indicators
 */
export interface ServiceHealth {
  /** Chat API availability */
  chat: boolean;

  /** Identity endpoints availability */
  identity: boolean;

  /** Subscription verification availability */
  subscription: boolean;
}

/**
 * Gateway health check response
 */
export interface GatewayHealth {
  /** Overall health status */
  status: HealthStatus;

  /** Health check timestamp (ISO 8601) */
  timestamp: string;

  /** Gateway uptime in seconds */
  uptime: number;

  /** Gateway version string */
  version: string;

  /** Individual service health indicators */
  services: ServiceHealth;
}

// ============================================================================
// Gateway Logging (NEW in Phase 7)
// ============================================================================

/**
 * Log level severity
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

/**
 * Gateway log entry
 */
export interface GatewayLog {
  /** Log timestamp (ISO 8601) */
  timestamp: string;

  /** Log severity level */
  level: LogLevel;

  /** Log message */
  message: string;

  /** Optional structured metadata (JSON) */
  metadata?: Record<string, unknown>;

  /** Source module/component (e.g., "gateway.chat", "gateway.auth") */
  source?: string;
}

/**
 * Log query filters
 */
export interface LogQueryFilters {
  /** Start timestamp (ISO 8601, inclusive) */
  since?: string;

  /** End timestamp (ISO 8601, exclusive) */
  until?: string;

  /** Filter by log level (inclusive, e.g., "warn" includes warn+error) */
  minLevel?: LogLevel;

  /** Filter by source module */
  source?: string;

  /** Maximum number of log entries to return */
  limit?: number;
}

// ============================================================================
// EdwinPAI Configuration (SPEC §7.3, §7.4)
// ============================================================================

/**
 * Operating mode (gateway or client)
 */
export type OperatingMode = "gateway" | "client";

/**
 * Theme preference
 */
export type ThemePreference = "light" | "dark" | "system";

/**
 * Gateway configuration subset
 */
export interface GatewayConfigOptions {
  /** Gateway HTTP port */
  port: number;

  /** Auto-start gateway on app launch */
  autoStart: boolean;

  /** Auto-restart gateway on crash */
  autoRestart: boolean;

  /** Maximum consecutive restart attempts */
  maxRestarts: number;

  /** Health check interval (milliseconds) */
  healthCheckIntervalMs: number;

  /** Log level (trace, debug, info, warn, error) */
  logLevel: LogLevel;

  /** Memory limit (MB, 0 = unlimited) */
  memoryLimitMb: number;
}

/**
 * mDNS advertising configuration
 */
export interface MdnsConfigOptions {
  /** Enable mDNS service advertising */
  enabled: boolean;

  /** Custom service name (null = use hostname-based default) */
  serviceName: string | null;

  /** Advertise on app startup (only if gateway mode) */
  advertiseOnStartup: boolean;
}

/**
 * UI preferences
 */
export interface UiPreferences {
  /** Theme preference */
  theme: ThemePreference;

  /** Minimize to system tray instead of quitting */
  minimizeToTray: boolean;

  /** Start app minimized to tray */
  startMinimized: boolean;

  /** Window width (pixels) */
  windowWidth: number;

  /** Window height (pixels) */
  windowHeight: number;

  /** Window X position (null = centered) */
  windowX: number | null;

  /** Window Y position (null = centered) */
  windowY: number | null;
}

/**
 * Subscription verification settings
 */
export interface SubscriptionSettings {
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;

  /** Check subscription status on app startup */
  checkOnStartup: boolean;

  /** Days before expiration to show renewal reminder */
  autoRenewReminderDays: number;
}

/**
 * Client session configuration (for reconnection)
 */
export interface ClientSessionInfo {
  /** Gateway public key (hex, 66 chars) */
  gatewayPubkey: string;

  /** Gateway network address (IP:port or hostname:port) */
  gatewayAddress: string;

  /** Gateway petname */
  gatewayPetname: string;

  /** Connection timestamp (ISO 8601) */
  connectedAt: string;

  /** Permission level granted to this client */
  permission: "owner" | "member" | "guest";
}

/**
 * Complete EdwinPAI desktop configuration
 */
export interface EdwinPAIConfig {
  /** Config schema version (semver) */
  version: string;

  /** Operating mode (gateway or client) */
  mode: OperatingMode;

  /** Gateway configuration */
  gateway: GatewayConfigOptions;

  /** mDNS configuration */
  mdns: MdnsConfigOptions;

  /** UI preferences */
  ui: UiPreferences;

  /** Subscription settings */
  subscription: SubscriptionSettings;

  /** Last client session (null if never connected) */
  lastClientSession: ClientSessionInfo | null;
}

// ============================================================================
// Onboarding Flow State (SPEC §6.1)
// ============================================================================

/**
 * Onboarding step identifier
 */
export type OnboardingStepId =
  | "welcome"
  | "identity"
  | "backup"
  | "mode-select"
  | "gateway-setup"
  | "client-discovery"
  | "subscription"
  | "complete";

/**
 * Onboarding step status
 */
export type OnboardingStepStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "skipped";

/**
 * Individual onboarding step state
 */
export interface OnboardingStep {
  /** Step identifier */
  id: OnboardingStepId;

  /** Display title */
  title: string;

  /** Step status */
  status: OnboardingStepStatus;

  /** Step-specific data (JSON-serializable) */
  data?: Record<string, unknown>;

  /** Timestamp when step was completed (ISO 8601, null if not completed) */
  completedAt: string | null;
}

/**
 * Complete onboarding flow state
 */
export interface OnboardingProgress {
  /** Current step being worked on */
  currentStep: OnboardingStepId;

  /** All steps in order */
  steps: OnboardingStep[];

  /** Overall completion percentage (0-100) */
  completionPercent: number;

  /** Whether onboarding flow has been fully completed */
  isComplete: boolean;

  /** Onboarding start timestamp (ISO 8601) */
  startedAt: string;

  /** Onboarding completion timestamp (ISO 8601, null if not complete) */
  completedAt: string | null;
}

// ============================================================================
// Sidebar Status Indicators (SPEC §7.5)
// ============================================================================

/**
 * Connection status for sidebar indicator
 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

/**
 * Subscription status for sidebar indicator
 */
export type SubscriptionStatusIndicator =
  | "active"
  | "cached"
  | "expired"
  | "grace-exceeded"
  | "not-found"
  | "checking";

/**
 * Sidebar status aggregation (visible in navigation)
 */
export interface SidebarStatus {
  /** Current operating mode */
  mode: OperatingMode;

  /** Connection status (client mode only) */
  connection: ConnectionStatus;

  /** Subscription verification status */
  subscription: SubscriptionStatusIndicator;

  /** Gateway process status (gateway mode only) */
  gatewayStatus?: GatewayProcessStatus;

  /** Number of configured channels */
  activeChannels: number;

  /** Unread notification count (future use) */
  unreadCount: number;
}

// ============================================================================
// IPC Request/Response Types (Phase 7 Commands)
// ============================================================================

/**
 * Request: Start gateway process
 */
export interface StartGatewayProcessRequest {
  /** Force restart if already running */
  forceRestart?: boolean;
}

/**
 * Response: Gateway process started
 */
export interface StartGatewayProcessResponse {
  success: boolean;
  message: string;
  process?: GatewayProcess;
}

/**
 * Request: Stop gateway process
 */
export interface StopGatewayProcessRequest {
  /** Force kill (SIGKILL) instead of graceful shutdown (SIGTERM) */
  forceKill?: boolean;
}

/**
 * Response: Gateway process stopped
 */
export interface StopGatewayProcessResponse {
  success: boolean;
  message: string;
}

/**
 * Request: Restart gateway process
 */
export type RestartGatewayProcessRequest = Record<string, never>;

/**
 * Response: Gateway process restarted
 */
export interface RestartGatewayProcessResponse {
  success: boolean;
  message: string;
  process?: GatewayProcess;
}

/**
 * Request: Get gateway process info
 */
export type GetGatewayProcessRequest = Record<string, never>;

/**
 * Response: Gateway process info
 */
export interface GetGatewayProcessResponse {
  process: GatewayProcess;
}

/**
 * Request: Get gateway health status
 */
export interface GetGatewayHealthRequest {
  /** Perform fresh health check instead of using cached result */
  forceCheck?: boolean;
}

/**
 * Response: Gateway health status
 */
export interface GetGatewayHealthResponse {
  health: GatewayHealth;
}

/**
 * Request: Get gateway logs
 */
export interface GetGatewayLogsRequest {
  /** Query filters */
  filters?: LogQueryFilters;
}

/**
 * Response: Gateway logs
 */
export interface GetGatewayLogsResponse {
  logs: GatewayLog[];
  totalCount: number;
}

/**
 * Request: Get EdwinPAI configuration
 */
export type GetEdwinPAIConfigRequest = Record<string, never>;

/**
 * Response: EdwinPAI configuration
 */
export interface GetEdwinPAIConfigResponse {
  config: EdwinPAIConfig;
}

/**
 * Request: Update EdwinPAI configuration
 */
export interface UpdateEdwinPAIConfigRequest {
  /** Partial config update (deep merge with existing) */
  config: Partial<EdwinPAIConfig>;
}

/**
 * Response: Updated EdwinPAI configuration
 */
export interface UpdateEdwinPAIConfigResponse {
  success: boolean;
  message: string;
  config: EdwinPAIConfig;
}

/**
 * Request: Reset EdwinPAI configuration to defaults
 */
export type ResetEdwinPAIConfigRequest = Record<string, never>;

/**
 * Response: Reset EdwinPAI configuration
 */
export interface ResetEdwinPAIConfigResponse {
  success: boolean;
  config: EdwinPAIConfig;
}

/**
 * Request: Get onboarding progress
 */
export type GetOnboardingProgressRequest = Record<string, never>;

/**
 * Response: Onboarding progress
 */
export interface GetOnboardingProgressResponse {
  progress: OnboardingProgress;
}

/**
 * Request: Update onboarding progress
 */
export interface UpdateOnboardingProgressRequest {
  /** Step ID to update */
  stepId: OnboardingStepId;

  /** New status */
  status: OnboardingStepStatus;

  /** Optional step-specific data */
  data?: Record<string, unknown>;
}

/**
 * Response: Updated onboarding progress
 */
export interface UpdateOnboardingProgressResponse {
  success: boolean;
  progress: OnboardingProgress;
}

/**
 * Request: Reset onboarding progress
 */
export type ResetOnboardingProgressRequest = Record<string, never>;

/**
 * Response: Reset onboarding progress
 */
export interface ResetOnboardingProgressResponse {
  success: boolean;
  progress: OnboardingProgress;
}

/**
 * Request: Get sidebar status
 */
export type GetSidebarStatusRequest = Record<string, never>;

/**
 * Response: Sidebar status
 */
export interface GetSidebarStatusResponse {
  status: SidebarStatus;
}

// ============================================================================
// Event Types (Backend -> Frontend notifications)
// ============================================================================

/**
 * Event: Gateway process status changed
 */
export interface GatewayProcessStatusChangedEvent {
  process: GatewayProcess;
  previousStatus: GatewayProcessStatus;
}

/**
 * Event: Gateway health status changed
 */
export interface GatewayHealthChangedEvent {
  health: GatewayHealth;
  previousStatus: HealthStatus;
}

/**
 * Event: New gateway log entry
 */
export interface GatewayLogEvent {
  log: GatewayLog;
}

/**
 * Event: Configuration changed
 */
export interface ConfigChangedEvent {
  config: EdwinPAIConfig;
  changedKeys: string[];
}

/**
 * Event: Onboarding progress updated
 */
export interface OnboardingProgressUpdatedEvent {
  progress: OnboardingProgress;
}

// ============================================================================
// Default Values & Constants
// ============================================================================

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfigOptions = {
  port: 18789,
  autoStart: true,
  autoRestart: true,
  maxRestarts: 5,
  healthCheckIntervalMs: 30_000, // 30 seconds
  logLevel: "info",
  memoryLimitMb: 0, // unlimited
};

/**
 * Default mDNS configuration
 */
export const DEFAULT_MDNS_CONFIG: MdnsConfigOptions = {
  enabled: true,
  serviceName: null, // hostname-based default
  advertiseOnStartup: true,
};

/**
 * Default UI preferences
 */
export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: "system",
  minimizeToTray: true,
  startMinimized: false,
  windowWidth: 1200,
  windowHeight: 800,
  windowX: null,
  windowY: null,
};

/**
 * Default subscription settings
 */
export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  cacheTtlSeconds: 3600, // 1 hour
  checkOnStartup: true,
  autoRenewReminderDays: 7,
};

/**
 * Default EdwinPAI configuration
 */
export const DEFAULT_EDWINPAI_CONFIG: EdwinPAIConfig = {
  version: APP_VERSION,
  mode: "gateway",
  gateway: DEFAULT_GATEWAY_CONFIG,
  mdns: DEFAULT_MDNS_CONFIG,
  ui: DEFAULT_UI_PREFERENCES,
  subscription: DEFAULT_SUBSCRIPTION_SETTINGS,
  lastClientSession: null,
};

/**
 * Log level severity ordering (lowest to highest)
 */
export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

/**
 * Onboarding step order
 */
export const ONBOARDING_STEP_ORDER: OnboardingStepId[] = [
  "welcome",
  "identity",
  "backup",
  "mode-select",
  "gateway-setup",
  "client-discovery",
  "subscription",
  "complete",
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if gateway is in a running state
 */
export function isGatewayRunning(status: GatewayProcessStatus): boolean {
  return status === "running" || status === "unhealthy";
}

/**
 * Check if gateway can be started
 */
export function canStartGateway(status: GatewayProcessStatus): boolean {
  return status === "stopped" || status === "crashed";
}

/**
 * Check if gateway can be stopped
 */
export function canStopGateway(status: GatewayProcessStatus): boolean {
  return (
    status === "running" || status === "unhealthy" || status === "starting"
  );
}

/**
 * Compare log levels (returns true if level1 >= level2)
 */
export function isLogLevelAtLeast(level1: LogLevel, level2: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level1] >= LOG_LEVEL_ORDER[level2];
}

/**
 * Calculate onboarding completion percentage
 */
export function calculateOnboardingCompletion(steps: OnboardingStep[]): number {
  const completedCount = steps.filter(
    (s) => s.status === "completed" || s.status === "skipped",
  ).length;
  return Math.round((completedCount / steps.length) * 100);
}

/**
 * Get next onboarding step
 */
export function getNextOnboardingStep(
  currentStep: OnboardingStepId,
): OnboardingStepId | null {
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(currentStep);
  if (
    currentIndex === -1 ||
    currentIndex === ONBOARDING_STEP_ORDER.length - 1
  ) {
    return null;
  }
  return ONBOARDING_STEP_ORDER[currentIndex + 1] ?? null;
}

/**
 * Get previous onboarding step
 */
export function getPreviousOnboardingStep(
  currentStep: OnboardingStepId,
): OnboardingStepId | null {
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(currentStep);
  if (currentIndex <= 0) {
    return null;
  }
  return ONBOARDING_STEP_ORDER[currentIndex - 1] ?? null;
}
