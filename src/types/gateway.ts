/**
 * Gateway Process & IPC Type Definitions
 *
 * Defines type contracts for:
 * - Gateway process lifecycle (start, stop, health checks)
 * - mDNS service advertising
 * - Gateway status monitoring
 * - Process management (PID tracking, auto-restart)
 *
 * All implementation nodes MUST import from this contract.
 */

// ============================================================================
// Gateway Process Lifecycle
// ============================================================================

/**
 * Gateway process states
 */
export type GatewayStatus =
  | 'stopped'      // Not running
  | 'starting'     // Launch initiated, awaiting health check
  | 'running'      // Healthy and responding
  | 'unhealthy'    // Process exists but health check failing
  | 'stopping'     // Shutdown initiated
  | 'crashed';     // Unexpected termination detected

/**
 * Gateway process information
 */
export interface GatewayProcessInfo {
  status: GatewayStatus;
  pid: number | null;
  port: number;
  startedAt: string | null; // ISO 8601 timestamp
  lastHealthCheck: string | null; // ISO 8601 timestamp
  restartCount: number;
  uptime: number; // seconds
}

/**
 * Start gateway process request
 */
export interface StartGatewayRequest {
  port?: number; // Default: 18789
  autoRestart?: boolean; // Default: true
}

/**
 * Start gateway response
 */
export interface StartGatewayResponse {
  success: boolean;
  pid: number;
  port: number;
  message?: string;
}

/**
 * Stop gateway request
 */
export interface StopGatewayRequest {
  force?: boolean; // SIGKILL if true, SIGTERM if false
  timeout?: number; // Milliseconds to wait before force kill
}

/**
 * Stop gateway response
 */
export interface StopGatewayResponse {
  success: boolean;
  message?: string;
}

/**
 * Get gateway status request
 */
export type GetGatewayStatusRequest = Record<string, never>;

/**
 * Get gateway status response
 */
export interface GetGatewayStatusResponse {
  info: GatewayProcessInfo;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check endpoint response format (from gateway HTTP endpoint)
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string; // ISO 8601
  uptime: number; // seconds
  version: string;
  services: {
    chat: boolean;
    identity: boolean;
    subscription: boolean;
  };
}

/**
 * Perform health check request (IPC command)
 */
export interface PerformHealthCheckRequest {
  timeout?: number; // Milliseconds, default: 5000
}

/**
 * Perform health check response
 */
export interface PerformHealthCheckResponse {
  success: boolean;
  health?: HealthCheckResponse;
  error?: string;
}

// ============================================================================
// mDNS Service Advertising
// ============================================================================

/**
 * mDNS service configuration
 */
export interface MDnsConfig {
  enabled: boolean;
  serviceName: string; // e.g., "EdwinPAI Gateway"
  serviceType: string; // e.g., "_edwinpai._tcp"
  domain: string; // e.g., "local."
  port: number;
  txtRecords?: Record<string, string>; // Additional metadata
}

/**
 * Start mDNS advertising request
 */
export interface StartMDnsRequest {
  config: MDnsConfig;
}

/**
 * Start mDNS advertising response
 */
export interface StartMDnsResponse {
  success: boolean;
  message?: string;
}

/**
 * Stop mDNS advertising request
 */
export type StopMDnsRequest = Record<string, never>;

/**
 * Stop mDNS advertising response
 */
export interface StopMDnsResponse {
  success: boolean;
  message?: string;
}

/**
 * mDNS status
 */
export interface MDnsStatus {
  active: boolean;
  serviceName: string | null;
  port: number | null;
}

/**
 * Get mDNS status request
 */
export type GetMDnsStatusRequest = Record<string, never>;

/**
 * Get mDNS status response
 */
export interface GetMDnsStatusResponse {
  status: MDnsStatus;
}

// ============================================================================
// Gateway Configuration
// ============================================================================

/**
 * Gateway configuration schema
 */
export interface GatewayConfig {
  /** HTTP port for gateway server */
  port: number;

  /** Auto-start gateway on app launch */
  autoStart: boolean;

  /** Auto-restart on crash */
  autoRestart: boolean;

  /** Max restart attempts before giving up */
  maxRestarts: number;

  /** Health check interval (milliseconds) */
  healthCheckInterval: number;

  /** Health check timeout (milliseconds) */
  healthCheckTimeout: number;

  /** mDNS advertising configuration */
  mdns: MDnsConfig;
}

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  port: 18789,
  autoStart: true,
  autoRestart: true,
  maxRestarts: 5,
  healthCheckInterval: 30000, // 30 seconds
  healthCheckTimeout: 5000, // 5 seconds
  mdns: {
    enabled: true,
    serviceName: 'EdwinPAI Gateway',
    serviceType: '_edwinpai._tcp',
    domain: 'local.',
    port: 18789,
  },
};

// ============================================================================
// Process Events
// ============================================================================

/**
 * Gateway process event types (for IPC event listeners)
 */
export type GatewayProcessEvent =
  | 'gateway:started'
  | 'gateway:stopped'
  | 'gateway:crashed'
  | 'gateway:healthy'
  | 'gateway:unhealthy'
  | 'gateway:restarting';

/**
 * Gateway process event payload
 */
export interface GatewayProcessEventPayload {
  status: GatewayStatus;
  pid: number | null;
  timestamp: string; // ISO 8601
  message?: string;
}

// All types are already exported inline above via interface/type declarations
