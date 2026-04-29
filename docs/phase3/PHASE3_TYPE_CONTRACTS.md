# Phase 3 Type Contracts Documentation

**Generated**: 2026-02-11
**Status**: Phase 3 type definitions for Gateway Mode implementation
**Purpose**: Define all TypeScript and Rust type contracts for gateway process management, tray integration, chat streaming, config storage, and mDNS discovery

---

## Table of Contents

1. [Gateway Process Management Types](#1-gateway-process-management-types)
2. [System Tray Types](#2-system-tray-types)
3. [Chat Streaming Types (SSE)](#3-chat-streaming-types-sse)
4. [Configuration Schema](#4-configuration-schema)
5. [mDNS Service Discovery Types](#5-mdns-service-discovery-types)
6. [Type Export Index](#6-type-export-index)
7. [Import Resolution from Phase 1](#7-import-resolution-from-phase-1)
8. [IPC Command Signatures](#8-ipc-command-signatures)

---

## 1. Gateway Process Management Types

### 1.1 Rust Types (src-tauri/src/commands/gateway.rs)

```rust
use serde::{Deserialize, Serialize};

/// Gateway process status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum GatewayStatus {
    /// Gateway is running and healthy
    Running,
    /// Gateway is starting up
    Starting,
    /// Gateway stopped gracefully
    Stopped,
    /// Gateway encountered an error
    Error,
    /// Gateway crashed and is awaiting restart
    Crashed,
}

/// Gateway start request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartGatewayRequest {
    /// Port to bind gateway (default: 3117)
    pub port: Option<u16>,
    /// Optional gateway binary path override
    #[serde(rename = "binaryPath")]
    pub binary_path: Option<String>,
}

/// Gateway start response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartGatewayResponse {
    /// Process ID of spawned gateway
    pub pid: u32,
    /// Port gateway is listening on
    pub port: u16,
    /// Gateway status
    pub status: GatewayStatus,
}

/// Gateway status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayStatusResponse {
    /// Current status
    pub status: GatewayStatus,
    /// Process ID (if running)
    pub pid: Option<u32>,
    /// Port (if running)
    pub port: Option<u16>,
    /// Uptime in seconds (if running)
    pub uptime: Option<u64>,
    /// Error message (if status = Error or Crashed)
    pub error: Option<String>,
    /// Number of restart attempts since last successful start
    #[serde(rename = "restartCount")]
    pub restart_count: u8,
}

/// Gateway logs request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetGatewayLogsRequest {
    /// Number of lines to return from end of log
    pub lines: Option<u32>,
    /// Filter by log level (info, warn, error)
    pub level: Option<String>,
}

/// Gateway logs response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetGatewayLogsResponse {
    /// Log lines (newest last)
    pub logs: Vec<String>,
    /// Total log line count available
    pub total: usize,
}
```

### 1.2 TypeScript Types (src/types/gateway.ts)

```typescript
/**
 * Gateway process status
 */
export type GatewayStatus =
  | "Running"
  | "Starting"
  | "Stopped"
  | "Error"
  | "Crashed";

/**
 * Gateway start request
 */
export interface StartGatewayRequest {
  port?: number;
  binaryPath?: string;
}

/**
 * Gateway start response
 */
export interface StartGatewayResponse {
  pid: number;
  port: number;
  status: GatewayStatus;
}

/**
 * Gateway status response
 */
export interface GatewayStatusResponse {
  status: GatewayStatus;
  pid?: number;
  port?: number;
  uptime?: number;
  error?: string;
  restartCount: number;
}

/**
 * Gateway logs request
 */
export interface GetGatewayLogsRequest {
  lines?: number;
  level?: "info" | "warn" | "error";
}

/**
 * Gateway logs response
 */
export interface GetGatewayLogsResponse {
  logs: string[];
  total: number;
}

/**
 * Gateway health check result
 */
export interface GatewayHealthResponse {
  status: "ok" | "unhealthy";
  uptime: number;
  version: string;
  mode: "gateway" | "client";
}
```

---

## 2. System Tray Types

### 2.1 Rust Types (src-tauri/src/commands/tray.rs)

```rust
use serde::{Deserialize, Serialize};
use super::gateway::GatewayStatus;

/// Tray menu event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrayMenuEvent {
    /// User clicked "Open EdwinPAI"
    Open,
    /// User clicked "Pause" or "Resume"
    TogglePause,
    /// User clicked "Settings"
    OpenSettings,
    /// User clicked "Quit"
    Quit,
}

/// Tray status update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTrayStatusRequest {
    /// Gateway status for icon/menu
    pub status: GatewayStatus,
    /// Number of connected channels
    #[serde(rename = "channelCount")]
    pub channel_count: Option<u8>,
    /// Subscription active state
    #[serde(rename = "subscriptionActive")]
    pub subscription_active: Option<bool>,
}

/// Tray icon state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrayIconState {
    /// Running - green indicator
    Running,
    /// Paused - yellow indicator
    Paused,
    /// Error - red indicator
    Error,
    /// Stopped - gray indicator
    Stopped,
}

/// Tray menu state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenuState {
    /// Icon state
    pub icon: TrayIconState,
    /// Gateway status text
    #[serde(rename = "statusText")]
    pub status_text: String,
    /// Channel count badge
    #[serde(rename = "channelBadge")]
    pub channel_badge: Option<String>,
    /// Subscription status text
    #[serde(rename = "subscriptionText")]
    pub subscription_text: Option<String>,
    /// Whether pause/resume is enabled
    #[serde(rename = "pauseEnabled")]
    pub pause_enabled: bool,
    /// Pause/Resume button text
    #[serde(rename = "pauseButtonText")]
    pub pause_button_text: String,
}
```

### 2.2 TypeScript Types (src/types/tray.ts)

```typescript
import type { GatewayStatus } from './gateway';

/**
 * Tray menu event types
 */
export type TrayMenuEvent =
  | "open"
  | "toggle_pause"
  | "open_settings"
  | "quit";

/**
 * Tray status update request
 */
export interface UpdateTrayStatusRequest {
  status: GatewayStatus;
  channelCount?: number;
  subscriptionActive?: boolean;
}

/**
 * Tray icon state
 */
export type TrayIconState =
  | "running"
  | "paused"
  | "error"
  | "stopped";

/**
 * Tray menu state
 */
export interface TrayMenuState {
  icon: TrayIconState;
  statusText: string;
  channelBadge?: string;
  subscriptionText?: string;
  pauseEnabled: boolean;
  pauseButtonText: string;
}

/**
 * Minimize to tray config
 */
export interface MinimizeToTrayConfig {
  enabled: boolean;
  showNotification?: boolean;
}
```

---

## 3. Chat Streaming Types (SSE)

### 3.1 OpenAI-Compatible Types (src/types/chat.ts)

```typescript
/**
 * Chat message role
 */
export type ChatRole = "user" | "assistant" | "system";

/**
 * Chat message
 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: string; // ISO 8601
  id?: string;
}

/**
 * Chat completion request (OpenAI-compatible)
 */
export interface ChatCompletionRequest {
  model: string; // "edwinpai"
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
}

/**
 * SSE message chunk (delta)
 */
export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: ChatRole;
      content?: string;
    };
    finish_reason?: "stop" | "length" | "error" | null;
  }>;
}

/**
 * Non-streaming completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: "stop" | "length" | "error";
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * SSE streaming state
 */
export interface StreamingState {
  active: boolean;
  messageId?: string;
  buffer: string;
  source?: EventSource;
}

/**
 * Chat history storage format
 */
export interface ChatHistoryStorage {
  conversations: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    messages: ChatMessage[];
  }>;
  activeConversationId?: string;
}
```

### 3.2 SSE Event Types

```typescript
/**
 * SSE message format
 */
export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * SSE parser result
 */
export type SSEParseResult =
  | { type: "chunk"; data: ChatCompletionChunk }
  | { type: "done" }
  | { type: "error"; error: string };

/**
 * Streaming callbacks
 */
export interface StreamCallbacks {
  onChunk: (chunk: ChatCompletionChunk) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}
```

---

## 4. Configuration Schema

### 4.1 Rust Types (src-tauri/src/commands/config.rs)

```rust
use serde::{Deserialize, Serialize};

/// App configuration schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Config schema version
    pub version: String,
    /// Operating mode
    pub mode: AppMode,
    /// Gateway configuration
    pub gateway: GatewayConfig,
    /// UI preferences
    pub ui: UiConfig,
    /// Feature flags
    pub features: FeatureConfig,
}

/// Operating mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    /// Run gateway locally
    Gateway,
    /// Connect to remote gateway
    Client,
}

/// Gateway-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    /// Port to bind (default: 3117)
    pub port: u16,
    /// Gateway binary path (None = use PATH)
    #[serde(rename = "binaryPath")]
    pub binary_path: Option<String>,
    /// Auto-start on app launch
    #[serde(rename = "autoStart")]
    pub auto_start: bool,
    /// Max restart attempts
    #[serde(rename = "maxRestarts")]
    pub max_restarts: u8,
}

/// Client-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    /// Remote gateway URL
    #[serde(rename = "gatewayUrl")]
    pub gateway_url: Option<String>,
    /// Auto-discover on LAN
    #[serde(rename = "autoDiscover")]
    pub auto_discover: bool,
    /// Connection timeout (seconds)
    #[serde(rename = "connectionTimeout")]
    pub connection_timeout: u16,
}

/// UI preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    /// Theme: "light", "dark", "system"
    pub theme: String,
    /// Minimize to tray instead of quit
    #[serde(rename = "minimizeToTray")]
    pub minimize_to_tray: bool,
    /// Start on OS login
    #[serde(rename = "startOnLogin")]
    pub start_on_login: bool,
    /// Enable desktop notifications
    pub notifications: bool,
    /// Enable sound effects
    #[serde(rename = "soundEffects")]
    pub sound_effects: bool,
}

/// Feature flags
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureConfig {
    /// Subscription check interval (seconds)
    #[serde(rename = "subscriptionCheckInterval")]
    pub subscription_check_interval: u64,
    /// Auto-update enabled
    #[serde(rename = "autoUpdate")]
    pub auto_update: bool,
    /// mDNS advertising enabled (gateway mode)
    #[serde(rename = "mdnsEnabled")]
    pub mdns_enabled: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: "1.0.0".to_string(),
            mode: AppMode::Gateway,
            gateway: GatewayConfig::default(),
            ui: UiConfig::default(),
            features: FeatureConfig::default(),
        }
    }
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            port: 3117,
            binary_path: None,
            auto_start: true,
            max_restarts: 3,
        }
    }
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            minimize_to_tray: true,
            start_on_login: false,
            notifications: true,
            sound_effects: false,
        }
    }
}

impl Default for FeatureConfig {
    fn default() -> Self {
        Self {
            subscription_check_interval: 3600, // 1 hour
            auto_update: true,
            mdns_enabled: true,
        }
    }
}
```

### 4.2 TypeScript Types (src/types/config.ts)

```typescript
/**
 * App configuration schema
 */
export interface Config {
  version: string;
  mode: AppMode;
  gateway: GatewayConfig;
  client?: ClientConfig;
  ui: UiConfig;
  features: FeatureConfig;
}

/**
 * Operating mode
 */
export type AppMode = "gateway" | "client";

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  port: number;
  binaryPath?: string;
  autoStart: boolean;
  maxRestarts: number;
}

/**
 * Client configuration
 */
export interface ClientConfig {
  gatewayUrl?: string;
  autoDiscover: boolean;
  connectionTimeout: number;
}

/**
 * UI preferences
 */
export interface UiConfig {
  theme: "light" | "dark" | "system";
  minimizeToTray: boolean;
  startOnLogin: boolean;
  notifications: boolean;
  soundEffects: boolean;
}

/**
 * Feature flags
 */
export interface FeatureConfig {
  subscriptionCheckInterval: number;
  autoUpdate: boolean;
  mdnsEnabled: boolean;
}

/**
 * Config update request (partial updates)
 */
export interface UpdateConfigRequest {
  path: string; // dot-notation path (e.g., "gateway.port")
  value: unknown;
}

/**
 * Default configuration factory
 */
export const DEFAULT_CONFIG: Config = {
  version: "1.0.0",
  mode: "gateway",
  gateway: {
    port: 3117,
    autoStart: true,
    maxRestarts: 3,
  },
  ui: {
    theme: "system",
    minimizeToTray: true,
    startOnLogin: false,
    notifications: true,
    soundEffects: false,
  },
  features: {
    subscriptionCheckInterval: 3600,
    autoUpdate: true,
    mdnsEnabled: true,
  },
};
```

---

## 5. mDNS Service Discovery Types

### 5.1 Rust Types (src-tauri/src/commands/discovery.rs)

```rust
use serde::{Deserialize, Serialize};

/// mDNS service descriptor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MdnsServiceDescriptor {
    /// Service type: "_edwinpai._tcp.local"
    #[serde(rename = "serviceType")]
    pub service_type: String,
    /// Instance name (e.g., "EdwinPAI-a3f7b2c1")
    #[serde(rename = "instanceName")]
    pub instance_name: String,
    /// Host name (e.g., "macbook.local")
    #[serde(rename = "hostName")]
    pub host_name: String,
    /// Port number
    pub port: u16,
    /// TXT record properties
    pub properties: MdnsTxtRecords,
}

/// mDNS TXT records
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MdnsTxtRecords {
    /// Public key (first 16 hex chars)
    pub pubkey: String,
    /// App version
    pub version: String,
    /// Petname (URL-encoded)
    pub petname: String,
}

/// Discovered gateway on LAN
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredGateway {
    /// Display name (petname or instance name)
    pub name: String,
    /// IP address (IPv4)
    pub address: String,
    /// Port
    pub port: u16,
    /// Public key prefix (first 16 chars)
    pub pubkey: String,
    /// App version
    pub version: String,
    /// Petname
    pub petname: String,
    /// Full service URL
    pub url: String,
}

/// Discovery scan request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverGatewaysRequest {
    /// Scan timeout in seconds (default: 5)
    #[serde(rename = "timeoutSecs")]
    pub timeout_secs: Option<u8>,
    /// Filter by version (optional)
    pub version: Option<String>,
}

/// Discovery scan response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverGatewaysResponse {
    /// Discovered gateways
    pub gateways: Vec<DiscoveredGateway>,
    /// Scan duration (milliseconds)
    #[serde(rename = "scanDuration")]
    pub scan_duration: u64,
}

/// mDNS advertising request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartMdnsAdvertisingRequest {
    /// Port to advertise
    pub port: u16,
    /// Public key (for TXT record)
    #[serde(rename = "publicKey")]
    pub public_key: String,
    /// Petname (for TXT record)
    pub petname: String,
    /// App version (for TXT record)
    pub version: String,
}
```

### 5.2 TypeScript Types (src/types/discovery.ts)

```typescript
/**
 * mDNS service descriptor
 */
export interface MdnsServiceDescriptor {
  serviceType: string; // "_edwinpai._tcp.local"
  instanceName: string;
  hostName: string;
  port: number;
  properties: MdnsTxtRecords;
}

/**
 * mDNS TXT records
 */
export interface MdnsTxtRecords {
  pubkey: string; // first 16 hex chars
  version: string;
  petname: string;
}

/**
 * Discovered gateway on LAN
 */
export interface DiscoveredGateway {
  name: string;
  address: string;
  port: number;
  pubkey: string;
  version: string;
  petname: string;
  url: string; // http://{address}:{port}
}

/**
 * Discovery scan request
 */
export interface DiscoverGatewaysRequest {
  timeoutSecs?: number;
  version?: string;
}

/**
 * Discovery scan response
 */
export interface DiscoverGatewaysResponse {
  gateways: DiscoveredGateway[];
  scanDuration: number;
}

/**
 * mDNS advertising request
 */
export interface StartMdnsAdvertisingRequest {
  port: number;
  publicKey: string;
  petname: string;
  version: string;
}

/**
 * mDNS advertising state
 */
export interface MdnsAdvertisingState {
  active: boolean;
  service?: MdnsServiceDescriptor;
  error?: string;
}
```

---

## 6. Type Export Index

### 6.1 Rust Module Exports (src-tauri/src/commands/mod.rs)

```rust
pub mod gateway;
pub mod tray;
pub mod config;
pub mod discovery;
pub mod health;

// Re-export commonly used types
pub use gateway::{
    GatewayStatus, StartGatewayRequest, StartGatewayResponse,
    GatewayStatusResponse, GetGatewayLogsRequest, GetGatewayLogsResponse,
};

pub use tray::{
    TrayMenuEvent, UpdateTrayStatusRequest, TrayIconState, TrayMenuState,
};

pub use config::{
    Config, AppMode, GatewayConfig, ClientConfig, UiConfig, FeatureConfig,
};

pub use discovery::{
    MdnsServiceDescriptor, MdnsTxtRecords, DiscoveredGateway,
    DiscoverGatewaysRequest, DiscoverGatewaysResponse,
    StartMdnsAdvertisingRequest,
};
```

### 6.2 TypeScript Barrel Export (src/types/index.ts)

```typescript
// Phase 1 types (existing)
export * from './ipc';
export * from './identity';
export * from './audit';
export * from './access';

// Phase 2 types (existing)
export * from './overlay';

// Phase 3 types (new)
export * from './gateway';
export * from './tray';
export * from './chat';
export * from './config';
export * from './discovery';

// Re-export commonly used types
export type {
  // Gateway
  GatewayStatus,
  StartGatewayRequest,
  GatewayStatusResponse,

  // Tray
  TrayMenuEvent,
  TrayIconState,
  TrayMenuState,

  // Chat
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionChunk,
  StreamingState,

  // Config
  Config,
  AppMode,
  GatewayConfig,
  UiConfig,

  // Discovery
  DiscoveredGateway,
  MdnsServiceDescriptor,
} from './index';
```

---

## 7. Import Resolution from Phase 1

### 7.1 Phase 1 Crypto Types Import (TypeScript)

```typescript
// src/lib/gateway.ts
import { invoke } from '@tauri-apps/api/core';
import type { GetIdentityResponse } from '@/types/ipc'; // Phase 1
import type { ChatMessage, ChatCompletionRequest } from '@/types/chat'; // Phase 3

/**
 * Get identity from crypto domain (Phase 1)
 */
export async function getIdentity(): Promise<GetIdentityResponse> {
  return invoke<GetIdentityResponse>('get_identity');
}

/**
 * Send chat message with BSV identity headers (Phase 1 + Phase 3)
 */
export async function sendChatMessage(
  message: ChatMessage,
  identity: GetIdentityResponse
): Promise<Response> {
  // BRC-103 authentication uses Phase 1 crypto types
  const nonce = generateNonce();
  const signature = await signMessage(message.content, nonce);

  return fetch('http://localhost:3117/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BSV-Identity': identity.publicKey, // Phase 1 type
      'X-BSV-Nonce': nonce,
      'X-BSV-Signature': signature,
    },
    body: JSON.stringify({
      model: 'edwinpai',
      messages: [message],
      stream: true,
    } as ChatCompletionRequest),
  });
}
```

### 7.2 Phase 1 Crypto Types Import (Rust)

```rust
// src-tauri/src/commands/gateway.rs
use crate::crypto_domain::{
    // Phase 1 types (DO NOT MODIFY)
    Identity,
    GetPublicKeyRequest,
    GetPublicKeyResponse,
};
use super::config::Config;

/// Start gateway with identity from crypto domain
pub async fn start_gateway_with_identity(
    config: Config,
) -> Result<StartGatewayResponse, String> {
    // Use Phase 1 crypto domain to get identity
    let identity = crate::crypto_domain::domain::get_identity()
        .map_err(|e| format!("Failed to get identity: {}", e))?;

    // Start gateway process (Phase 3)
    start_gateway_process(config.gateway.port, &identity.public_key)
}
```

### 7.3 Subscription State Import (Phase 2 → Phase 3)

```typescript
// src/components/layout/TopBar.tsx
import { useSubscription } from '@/hooks/useSubscription'; // Phase 2
import { useGateway } from '@/hooks/useGateway'; // Phase 3
import { IdentityBadge } from '@/components/shared/IdentityBadge'; // Phase 1

export function TopBar() {
  const { status: subscriptionStatus } = useSubscription(); // Phase 2
  const { status: gatewayStatus } = useGateway(); // Phase 3

  return (
    <div className="top-bar">
      <IdentityBadge /> {/* Phase 1 component */}
      <SubscriptionIndicator status={subscriptionStatus} /> {/* Phase 2 */}
      <GatewayIndicator status={gatewayStatus} /> {/* Phase 3 */}
    </div>
  );
}
```

---

## 8. IPC Command Signatures

### 8.1 Gateway Commands

```rust
// src-tauri/src/commands/gateway.rs

#[tauri::command]
pub async fn start_gateway(
    request: StartGatewayRequest,
) -> Result<StartGatewayResponse, String>

#[tauri::command]
pub async fn stop_gateway() -> Result<(), String>

#[tauri::command]
pub async fn restart_gateway() -> Result<StartGatewayResponse, String>

#[tauri::command]
pub async fn get_gateway_status() -> Result<GatewayStatusResponse, String>

#[tauri::command]
pub async fn get_gateway_logs(
    request: GetGatewayLogsRequest,
) -> Result<GetGatewayLogsResponse, String>

#[tauri::command]
pub async fn ping_gateway() -> Result<bool, String>
```

### 8.2 Tray Commands

```rust
// src-tauri/src/commands/tray.rs

#[tauri::command]
pub async fn update_tray_status(
    request: UpdateTrayStatusRequest,
) -> Result<(), String>

#[tauri::command]
pub async fn update_tray_channels(count: u8) -> Result<(), String>

#[tauri::command]
pub async fn update_tray_subscription(active: bool) -> Result<(), String>

#[tauri::command]
pub async fn set_minimize_to_tray(enabled: bool) -> Result<(), String>

#[tauri::command]
pub async fn get_tray_state() -> Result<TrayMenuState, String>
```

### 8.3 Config Commands

```rust
// src-tauri/src/commands/config.rs

#[tauri::command]
pub async fn read_config() -> Result<Config, String>

#[tauri::command]
pub async fn write_config(config: Config) -> Result<(), String>

#[tauri::command]
pub async fn update_config_field(
    path: String,
    value: serde_json::Value,
) -> Result<(), String>

#[tauri::command]
pub async fn get_config_path() -> Result<String, String>
```

### 8.4 Discovery Commands

```rust
// src-tauri/src/commands/discovery.rs

#[tauri::command]
pub async fn start_mdns_advertising(
    request: StartMdnsAdvertisingRequest,
) -> Result<(), String>

#[tauri::command]
pub async fn stop_mdns_advertising() -> Result<(), String>

#[tauri::command]
pub async fn discover_gateways(
    request: DiscoverGatewaysRequest,
) -> Result<DiscoverGatewaysResponse, String>
```

### 8.5 TypeScript IPC Wrappers

```typescript
// src/lib/gateway.ts
import { invoke } from '@tauri-apps/api/core';
import type {
  StartGatewayRequest,
  StartGatewayResponse,
  GatewayStatusResponse,
  GetGatewayLogsRequest,
  GetGatewayLogsResponse,
} from '@/types/gateway';

export const gatewayApi = {
  start: (req: StartGatewayRequest) =>
    invoke<StartGatewayResponse>('start_gateway', { request: req }),

  stop: () =>
    invoke<void>('stop_gateway'),

  restart: () =>
    invoke<StartGatewayResponse>('restart_gateway'),

  getStatus: () =>
    invoke<GatewayStatusResponse>('get_gateway_status'),

  getLogs: (req: GetGatewayLogsRequest) =>
    invoke<GetGatewayLogsResponse>('get_gateway_logs', { request: req }),

  ping: () =>
    invoke<boolean>('ping_gateway'),
};

// src/lib/tray.ts
export const trayApi = {
  updateStatus: (req: UpdateTrayStatusRequest) =>
    invoke<void>('update_tray_status', { request: req }),

  updateChannels: (count: number) =>
    invoke<void>('update_tray_channels', { count }),

  updateSubscription: (active: boolean) =>
    invoke<void>('update_tray_subscription', { active }),

  setMinimizeToTray: (enabled: boolean) =>
    invoke<void>('set_minimize_to_tray', { enabled }),

  getState: () =>
    invoke<TrayMenuState>('get_tray_state'),
};

// src/lib/config.ts
export const configApi = {
  read: () =>
    invoke<Config>('read_config'),

  write: (config: Config) =>
    invoke<void>('write_config', { config }),

  updateField: (path: string, value: unknown) =>
    invoke<void>('update_config_field', { path, value }),

  getPath: () =>
    invoke<string>('get_config_path'),
};

// src/lib/discovery.ts
export const discoveryApi = {
  startAdvertising: (req: StartMdnsAdvertisingRequest) =>
    invoke<void>('start_mdns_advertising', { request: req }),

  stopAdvertising: () =>
    invoke<void>('stop_mdns_advertising'),

  discoverGateways: (req: DiscoverGatewaysRequest) =>
    invoke<DiscoverGatewaysResponse>('discover_gateways', { request: req }),
};
```

---

## 9. Type Alignment Verification

### 9.1 Naming Convention Matrix

| Context | Rust | TypeScript | JSON (Wire) |
|---------|------|------------|-------------|
| Struct/Interface | `PascalCase` | `PascalCase` | N/A |
| Field | `snake_case` | `camelCase` | `camelCase` |
| Enum variant | `PascalCase` | `PascalCase` | `PascalCase` |
| Type discriminator | `#[serde(rename_all)]` | `type` field | `camelCase` |

### 9.2 Serde Annotation Requirements

All Rust structs crossing IPC boundary MUST use:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatusResponse { ... }
```

### 9.3 Binary Data Handling

| Rust | TypeScript | Wire Format |
|------|------------|-------------|
| `Vec<u8>` | `Uint8Array` | Base64 string (Tauri auto-converts) |
| `String` | `string` | UTF-8 string |
| `Option<T>` | `T \| undefined` | null or value |

---

## 10. Critical Constraints

### 10.1 Phase 1/2 Isolation

**MUST NOT MODIFY**:
- `src-tauri/src/crypto_domain/` (any file)
- `src/types/ipc.ts` (Phase 1 types)
- `src/types/overlay.ts` (Phase 2 types)

**ALLOWED**:
- Import Phase 1/2 types
- Call Phase 1/2 functions
- Extend Phase 1/2 components (composition, not modification)

### 10.2 Gateway Binary Path

- Gateway binary is EXTERNAL to codebase
- Path resolution order:
  1. `Config.gateway.binaryPath` (if set)
  2. `EDWINPAI_GATEWAY_PATH` env var
  3. System PATH lookup (`which edwinpai` / `where edwinpai`)

### 10.3 Port Configuration

- Default port: `3117`
- Conflict resolution: try `port + 1` up to 5 times
- Store actual port in `GatewayStatusResponse.port`

### 10.4 SSE Streaming

- Use `EventSource` API (NOT `fetch` with manual parsing)
- Message format: `data: {JSON}\n\n`
- Termination: `data: [DONE]\n\n`
- Error handling: close stream, show retry UI

### 10.5 Config File Location

- Path: `~/.edwinpai/config.json`
- Atomic writes: temp file + rename (prevent corruption)
- Validation: reject invalid JSON, reject unknown `mode` values
- Migration: handle version upgrades (future Phase 6)

---

## 11. Test Type Contracts

### 11.1 Mock Types (TypeScript)

```typescript
// src/__tests__/mocks/gateway.ts
export const mockGatewayStatus: GatewayStatusResponse = {
  status: "Running",
  pid: 12345,
  port: 3117,
  uptime: 3600,
  restartCount: 0,
};

export const mockDiscoveredGateway: DiscoveredGateway = {
  name: "Swift Falcon",
  address: "192.168.1.100",
  port: 3117,
  pubkey: "02a3f7b2c1d4e5f6",
  version: "1.0.0",
  petname: "Swift Falcon",
  url: "http://192.168.1.100:3117",
};

export const mockChatMessage: ChatMessage = {
  role: "user",
  content: "Hello EdwinPAI",
  timestamp: "2026-02-11T10:00:00Z",
  id: "msg_1",
};
```

---

**End of Phase 3 Type Contracts Documentation**

**Related Documents**:
- `PHASE3_REQUIREMENTS.md` — Implementation scope
- `PHASE1_TYPE_CONTRACTS.md` — Phase 1 crypto types reference
- `src/types/ipc.ts` — Phase 1/2 IPC types
- `SPEC.md` §10 — API Contracts

**Version**: 1.0
**Last Updated**: 2026-02-11
