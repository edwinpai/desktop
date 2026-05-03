/**
 * Phase 7: Gateway Process Lifecycle Type Definitions
 *
 * Defines type contracts for:
 * - Gateway process state management (starting, running, stopping, crashed)
 * - Binary discovery (find gateway executable in bundle or PATH)
 * - Process info (PID tracking, uptime, restart count)
 * - Health check orchestration
 *
 * These types are used by the Tauri backend to manage the gateway child process.
 * Mirrors Rust types in src-tauri/src/gateway/types.rs.
 *
 * @module types/gateway-lifecycle
 */

// ============================================================================
// Gateway Process State
// ============================================================================

/**
 * Gateway process lifecycle states.
 *
 * State machine transitions:
 * ```
 * Stopped → Starting → Running → Stopping → Stopped
 *                  ↓
 *             Unhealthy → Crashed (auto-restart) → Starting
 * ```
 */
export type GatewayState =
  | "stopped" // Not running
  | "starting" // Launch initiated, awaiting first health check
  | "running" // Process healthy and responding to requests
  | "stopping" // Shutdown initiated (SIGTERM sent)
  | "unhealthy" // Process exists but failing health checks
  | "crashed"; // Unexpected termination detected

/**
 * Gateway process information.
 *
 * Includes PID tracking, uptime, restart count, and health check status.
 *
 * @example
 * ```ts
 * const processInfo: ProcessInfo = {
 *   state: 'running',
 *   pid: 12345,
 *   port: 18789,
 *   binaryPath: '/usr/local/bin/edwinpai',
 *   startedAt: '2026-02-12T10:00:00Z',
 *   lastHealthCheck: '2026-02-12T10:05:00Z',
 *   restartCount: 0,
 *   uptime: 300
 * };
 * ```
 */
export interface ProcessInfo {
  /** Current process state */
  state: GatewayState;

  /** Process ID (null if not running) */
  pid: number | null;

  /** Gateway HTTP port */
  port: number;

  /** Path to gateway binary executable */
  binaryPath: string | null;

  /** Process start timestamp (ISO 8601, null if not running) */
  startedAt: string | null;

  /** Last health check timestamp (ISO 8601, null if never checked) */
  lastHealthCheck: string | null;

  /** Number of automatic restarts since last manual start */
  restartCount: number;

  /** Process uptime in seconds (0 if not running) */
  uptime: number;
}

// ============================================================================
// Binary Discovery
// ============================================================================

/**
 * Binary discovery strategy.
 */
export type BinaryDiscoveryStrategy =
  | "bundled" // Use bundled gateway binary in Tauri resources
  | "path" // Search system PATH for `edwinpai` executable
  | "explicit"; // Use explicit path from config

/**
 * Binary discovery result.
 *
 * @example
 * ```ts
 * const discovery: BinaryDiscovery = {
 *   strategy: 'bundled',
 *   path: '/Applications/EdwinPAI.app/Contents/Resources/bin/edwinpai',
 *   version: '1.0.0',
 *   valid: true
 * };
 * ```
 */
export interface BinaryDiscovery {
  /** Discovery strategy used */
  strategy: BinaryDiscoveryStrategy;

  /** Absolute path to binary */
  path: string;

  /** Gateway version (from `edwinpai --version`) */
  version: string | null;

  /** Whether binary is valid and executable */
  valid: boolean;

  /** Error message if discovery failed */
  error?: string;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check result.
 *
 * Obtained by polling /v1/status endpoint.
 *
 * @example
 * ```ts
 * const health: HealthCheck = {
 *   healthy: true,
 *   timestamp: '2026-02-12T10:05:00Z',
 *   responseTimeMs: 45,
 *   status: {
 *     status: 'ok',
 *     uptime: 300,
 *     version: '1.0.0',
 *     // ... (GatewayStatus fields)
 *   }
 * };
 * ```
 */
export interface HealthCheck {
  /** Whether health check passed (HTTP 200 + status="ok") */
  healthy: boolean;

  /** Health check timestamp (ISO 8601) */
  timestamp: string;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Gateway status response (if healthy) */
  status?: {
    status: "ok" | "degraded" | "error";
    uptime: number;
    version: string;
    mode: "gateway" | "client";
    subscription: {
      active: boolean;
      method: "spv" | "cached" | "offline";
    };
    services: {
      chat: boolean;
      identity: boolean;
      subscription: boolean;
      mdns: boolean;
    };
  };

  /** Error message (if unhealthy) */
  error?: string;
}

/**
 * Health check configuration.
 *
 * Controls polling interval and failure thresholds.
 */
export interface HealthCheckConfig {
  /** Polling interval in milliseconds (default: 30000 = 30s) */
  intervalMs: number;

  /** HTTP request timeout in milliseconds (default: 5000 = 5s) */
  timeoutMs: number;

  /** Max consecutive failures before marking unhealthy (default: 3) */
  maxFailures: number;

  /** Whether to auto-restart on unhealthy (default: true) */
  autoRestart: boolean;
}

// ============================================================================
// Process Lifecycle Commands
// ============================================================================

/**
 * Start gateway process options.
 */
export interface StartGatewayOptions {
  /** HTTP port (default: 18789) */
  port?: number;

  /** Binary discovery strategy (default: 'bundled') */
  binaryStrategy?: BinaryDiscoveryStrategy;

  /** Explicit binary path (required if strategy='explicit') */
  binaryPath?: string;

  /** Auto-restart on crash (default: true) */
  autoRestart?: boolean;

  /** Max restart attempts before giving up (default: 5) */
  maxRestarts?: number;

  /** Health check configuration */
  healthCheck?: HealthCheckConfig;

  /** Additional environment variables */
  env?: Record<string, string>;
}

/**
 * Stop gateway process options.
 */
export interface StopGatewayOptions {
  /** Force kill (SIGKILL) instead of graceful shutdown (SIGTERM) */
  force?: boolean;

  /** Timeout in milliseconds before force kill (default: 10000 = 10s) */
  timeoutMs?: number;
}

// ============================================================================
// Process Events
// ============================================================================

/**
 * Gateway process event types.
 *
 * Emitted to frontend via Tauri event system.
 */
export type GatewayProcessEvent =
  | "gateway:starting"
  | "gateway:started"
  | "gateway:stopping"
  | "gateway:stopped"
  | "gateway:healthy"
  | "gateway:unhealthy"
  | "gateway:crashed"
  | "gateway:restarting";

/**
 * Gateway process event payload.
 */
export interface GatewayProcessEventPayload {
  /** Process state */
  state: GatewayState;

  /** Process ID (null if not running) */
  pid: number | null;

  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Optional message or error */
  message?: string;

  /** Restart count (for crashed/restarting events) */
  restartCount?: number;
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default health check configuration.
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  intervalMs: 30_000, // 30 seconds
  timeoutMs: 5_000, // 5 seconds
  maxFailures: 3,
  autoRestart: true,
};

/**
 * Default start gateway options.
 */
export const DEFAULT_START_OPTIONS: Required<StartGatewayOptions> = {
  port: 18789,
  binaryStrategy: "bundled",
  binaryPath: "",
  autoRestart: true,
  maxRestarts: 5,
  healthCheck: DEFAULT_HEALTH_CHECK_CONFIG,
  env: {},
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if gateway is in a running state.
 */
export function isRunning(state: GatewayState): boolean {
  return state === "running" || state === "unhealthy";
}

/**
 * Check if gateway can be started.
 */
export function canStart(state: GatewayState): boolean {
  return state === "stopped" || state === "crashed";
}

/**
 * Check if gateway can be stopped.
 */
export function canStop(state: GatewayState): boolean {
  return state === "running" || state === "unhealthy" || state === "starting";
}

/**
 * Check if process is in a transitional state.
 */
export function isTransitioning(state: GatewayState): boolean {
  return state === "starting" || state === "stopping";
}

/**
 * Check if process needs restart.
 */
export function needsRestart(
  state: GatewayState,
  restartCount: number,
  maxRestarts: number,
): boolean {
  return (
    (state === "crashed" || state === "unhealthy") && restartCount < maxRestarts
  );
}

/**
 * Calculate next restart delay (exponential backoff).
 *
 * @param restartCount - Number of restarts so far
 * @returns Delay in milliseconds
 */
export function calculateRestartDelay(restartCount: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
  const baseDelay = 1000;
  const maxDelay = 16000;
  const delay = baseDelay * Math.pow(2, restartCount);
  return Math.min(delay, maxDelay);
}

/**
 * Format uptime as human-readable string.
 *
 * @example
 * formatUptime(3665) // "1h 1m 5s"
 */
export function formatUptime(seconds: number): string {
  if (seconds === 0) return "0s";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * Validate binary path (check exists and is executable).
 *
 * Note: This is a client-side validation. Full validation
 * requires backend fs access.
 */
export function validateBinaryPath(path: string): {
  valid: boolean;
  error?: string;
} {
  if (!path || path.trim() === "") {
    return { valid: false, error: "Binary path is empty" };
  }

  // Basic path validation (platform-specific checks in backend)
  const isAbsolute = path.startsWith("/") || /^[A-Z]:\\/.test(path);
  if (!isAbsolute) {
    return { valid: false, error: "Binary path must be absolute" };
  }

  return { valid: true };
}
