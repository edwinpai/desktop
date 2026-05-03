/**
 * Client Mode - TypeScript Type Definitions
 *
 * Defines type contracts for:
 * - Client connection management
 * - Gateway discovery and peer management
 * - Client session lifecycle
 * - Connection state machine
 *
 * Mirrors Rust types in src-tauri/src/client/types.rs
 */

import type { AccessLevel } from "./auth";

// ============================================================================
// Client Connection Types
// ============================================================================

/**
 * Client connection states
 */
export type ClientConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

/**
 * Client connection information
 */
export interface ClientConnection {
  /** Current connection status */
  status: ClientConnectionStatus;

  /** Gateway public key (hex-encoded secp256k1) */
  gatewayPubkey: string;

  /** Gateway network address (IP:port or hostname:port) */
  gatewayAddress: string;

  /** Gateway petname */
  gatewayPetname: string;

  /** Connected since (ISO 8601 timestamp) */
  connectedAt?: string;

  /** Last successful message timestamp */
  lastActivity?: string;

  /** Current authorization level */
  accessLevel: AccessLevel;

  /** Reconnect attempts count */
  reconnectAttempts: number;
}

// ============================================================================
// Peer Discovery Types
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

  /** Current authorization level (for this client) */
  authorizationLevel: AccessLevel;
}

/**
 * Peer discovery result
 */
export interface PeerDiscoveryResult {
  /** List of discovered peers */
  peers: DiscoveredPeer[];

  /** Discovery method used */
  method: PeerDiscoveryMethod;

  /** Discovery timestamp (ISO 8601) */
  discoveredAt: string;
}

/**
 * Peer discovery method
 */
export type PeerDiscoveryMethod = "mdns" | "manual" | "invitation";

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Client mode configuration
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
 * Default client configuration
 */
export const DEFAULT_CLIENT_CONFIG: Partial<ClientConfig> = {
  autoReconnect: true,
  reconnectIntervalSecs: 5,
  connectionTimeoutSecs: 10,
};

// ============================================================================
// Client IPC Request/Response Types
// ============================================================================

/**
 * Request: Connect to gateway
 */
export interface ConnectToGatewayRequest {
  gatewayAddress: string;
  gatewayPubkey: string;
  gatewayPetname: string;
}

/**
 * Response: Connection result
 */
export interface ConnectToGatewayResponse {
  success: boolean;
  message: string;
  connection?: ClientConnection;
}

/**
 * Request: Disconnect from gateway
 */
export type DisconnectFromGatewayRequest = Record<string, never>;

/**
 * Response: Disconnection result
 */
export interface DisconnectFromGatewayResponse {
  success: boolean;
  message: string;
}

/**
 * Request: Get current connection status
 */
export type GetClientConnectionRequest = Record<string, never>;

/**
 * Response: Connection status
 */
export interface GetClientConnectionResponse {
  connection?: ClientConnection;
}

/**
 * Request: Discover peers via mDNS
 */
export interface DiscoverPeersRequest {
  /** Timeout in seconds */
  timeoutSecs: number;
}

/**
 * Response: Discovered peers
 */
export interface DiscoverPeersResponse {
  result: PeerDiscoveryResult;
}

/**
 * Request: Add peer manually
 */
export interface AddPeerManuallyRequest {
  address: string;
  pubkey: string;
  petname: string;
}

/**
 * Response: Add peer result
 */
export interface AddPeerManuallyResponse {
  success: boolean;
  message: string;
  peer?: DiscoveredPeer;
}

// ============================================================================
// Client Event Types (Backend -> Frontend notifications)
// ============================================================================

/**
 * Event: Connection status changed
 */
export interface ConnectionStatusChangedEvent {
  status: ClientConnectionStatus;
  connection: ClientConnection;
}

/**
 * Event: Peer discovered
 */
export interface PeerDiscoveredEvent {
  peer: DiscoveredPeer;
}

/**
 * Event: Reconnection attempt
 */
export interface ReconnectionAttemptEvent {
  attempt: number;
  maxAttempts: number;
}

/**
 * Event: Connection error
 */
export interface ConnectionErrorEvent {
  error: string;
  details?: Record<string, unknown>;
}
