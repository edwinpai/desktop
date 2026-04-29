# Phase 3 Type Requirements Summary

**Generated**: 2026-02-11
**Purpose**: Comprehensive extraction of Phase 3 type requirements from PLAN.md and SPEC.md
**Status**: Requirements documentation for Gateway Mode implementation

---

## Executive Summary

Phase 3 ("Gateway Mode") introduces 5 major type categories:

1. **Gateway Lifecycle Types** — Process management, health monitoring, restart logic
2. **Chat Types** — OpenAI-compatible streaming, SSE parsing, message history
3. **System Tray Types** — Menu state, status indicators, user events
4. **Configuration Types** — App settings, mode selection, preferences storage
5. **mDNS Discovery Types** — LAN service advertising, gateway discovery

All types follow strict Rust-TypeScript alignment with `serde` annotations for camelCase conversion.

---

## 1. Gateway Lifecycle Types

### 1.1 Overview (SPEC §6.5)

The EdwinPAI gateway runs as a **managed child process** spawned by the Tauri shell. Gateway lifecycle includes:

- Start/stop/restart operations
- Health monitoring with auto-restart (max 3 attempts)
- Log streaming for debugging
- Port binding with conflict resolution
- Subscription verification before start

### 1.2 Core Types

#### GatewayStatus Enum

```rust
// Rust (src-tauri/src/commands/gateway.rs)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum GatewayStatus {
    Running,   // Gateway healthy and accepting requests
    Starting,  // Spawning process, awaiting health check
    Stopped,   // Clean shutdown
    Error,     // Unrecoverable error (subscription expired, port conflict)
    Crashed,   // Process exited unexpectedly, awaiting restart
}
```

```typescript
// TypeScript (src/types/gateway.ts)
export type GatewayStatus =
  | "Running"
  | "Starting"
  | "Stopped"
  | "Error"
  | "Crashed";
```

**Rationale**: PascalCase for enum variants per SPEC §12 error handling convention.

#### StartGatewayRequest/Response

```rust
pub struct StartGatewayRequest {
    pub port: Option<u16>,              // Default: 3117
    pub binary_path: Option<String>,    // Override PATH resolution
}

pub struct StartGatewayResponse {
    pub pid: u32,
    pub port: u16,
    pub status: GatewayStatus,
}
```

**Critical Constraint**: Gateway binary is EXTERNAL. Resolution order:
1. `StartGatewayRequest.binary_path`
2. `Config.gateway.binaryPath`
3. `EDWINPAI_GATEWAY_PATH` env var
4. System PATH lookup (`which edwinpai`)

#### GatewayStatusResponse

```rust
pub struct GatewayStatusResponse {
    pub status: GatewayStatus,
    pub pid: Option<u32>,
    pub port: Option<u16>,
    pub uptime: Option<u64>,            // Seconds since start
    pub error: Option<String>,          // If status = Error/Crashed
    pub restart_count: u8,              // Auto-restart attempts
}
```

**Auto-Restart Logic** (PLAN §3, Task 1):
- Max 3 restart attempts (configurable via `Config.gateway.max_restarts`)
- Exponential backoff: 1s, 2s, 4s
- Reset counter on successful 60s uptime

#### GetGatewayLogsRequest/Response

```rust
pub struct GetGatewayLogsRequest {
    pub lines: Option<u32>,     // Tail last N lines (default: 100)
    pub level: Option<String>,  // Filter: "info" | "warn" | "error"
}

pub struct GetGatewayLogsResponse {
    pub logs: Vec<String>,
    pub total: usize,
}
```

**Log Storage**: `~/.edwinpai/logs/gateway.log` (JSON Lines format, per Phase 1 audit pattern)

### 1.3 IPC Command Contracts

```rust
// src-tauri/src/commands/gateway.rs

#[tauri::command]
pub async fn start_gateway(request: StartGatewayRequest)
    -> Result<StartGatewayResponse, String>

#[tauri::command]
pub async fn stop_gateway() -> Result<(), String>

#[tauri::command]
pub async fn restart_gateway() -> Result<StartGatewayResponse, String>

#[tauri::command]
pub async fn get_gateway_status() -> Result<GatewayStatusResponse, String>

#[tauri::command]
pub async fn get_gateway_logs(request: GetGatewayLogsRequest)
    -> Result<GetGatewayLogsResponse, String>

#[tauri::command]
pub async fn ping_gateway() -> Result<bool, String>
```

**TypeScript Wrapper** (src/lib/gateway.ts):

```typescript
import { invoke } from '@tauri-apps/api/core';

export const gatewayApi = {
  start: (req: StartGatewayRequest) =>
    invoke<StartGatewayResponse>('start_gateway', { request: req }),

  stop: () => invoke<void>('stop_gateway'),

  restart: () => invoke<StartGatewayResponse>('restart_gateway'),

  getStatus: () => invoke<GatewayStatusResponse>('get_gateway_status'),

  getLogs: (req: GetGatewayLogsRequest) =>
    invoke<GetGatewayLogsResponse>('get_gateway_logs', { request: req }),

  ping: () => invoke<boolean>('ping_gateway'),
};
```

### 1.4 Integration with Phase 1/2

**Subscription Check Before Start** (SPEC §6.5):

```rust
// Pseudo-code: gateway start flow
pub async fn start_gateway(request: StartGatewayRequest)
    -> Result<StartGatewayResponse, String>
{
    // 1. Check subscription (Phase 2 IPC)
    let sub_check = crypto_domain::check_subscription(false).await?;
    if sub_check.state != SubscriptionState::Active &&
       sub_check.state != SubscriptionState::Cached {
        return Err("Subscription required to start gateway".into());
    }

    // 2. Get identity (Phase 1 IPC)
    let identity = crypto_domain::get_identity().await?;

    // 3. Spawn gateway process with env vars
    let child = Command::new(resolve_gateway_binary(&request)?)
        .env("EDWINPAI_IDENTITY_PUBLIC_KEY", identity.public_key)
        .env("PORT", request.port.unwrap_or(3117).to_string())
        .spawn()?;

    // 4. Poll health endpoint
    wait_for_health_check(child.id(), 10_000).await?;

    Ok(StartGatewayResponse { ... })
}
```

**Critical Import**: Gateway command module MUST import Phase 1 types read-only:

```rust
use crate::crypto_domain::{
    CheckSubscriptionRequest,
    CheckSubscriptionResponse,
    GetIdentityRequest,
    GetIdentityResponse,
};
```

---

## 2. Chat Types (OpenAI-Compatible SSE)

### 2.1 Overview (SPEC §10.1, PLAN §3 Task 3)

Chat interface uses OpenAI-compatible `/v1/chat/completions` endpoint with **Server-Sent Events (SSE)** for streaming. All messages are stored locally in `~/.edwinpai/chat_history.json`.

### 2.2 Core Types

#### ChatMessage

```typescript
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: string;  // ISO 8601
  id?: string;        // UUID, server-generated
}
```

**Storage Format** (`~/.edwinpai/chat_history.json`):

```typescript
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

#### ChatCompletionRequest (Outgoing)

```typescript
export interface ChatCompletionRequest {
  model: string;              // "edwinpai"
  messages: ChatMessage[];
  stream: boolean;            // MUST be true for SSE
  temperature?: number;       // Optional (0.0 - 2.0)
  max_tokens?: number;        // Optional
}
```

**Example**:

```json
{
  "model": "edwinpai",
  "messages": [
    { "role": "user", "content": "Hello EdwinPAI", "timestamp": "2026-02-11T10:00:00Z" }
  ],
  "stream": true
}
```

#### ChatCompletionChunk (Incoming SSE)

```typescript
export interface ChatCompletionChunk {
  id: string;                 // Message ID
  object: "chat.completion.chunk";
  created: number;            // Unix timestamp
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
```

**SSE Wire Format** (SPEC §10.1):

```
data: {"id":"msg_1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hi"}}]}

data: {"id":"msg_1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" there"}}]}

data: {"id":"msg_1","object":"chat.completion.chunk","choices":[{"index":0,"finish_reason":"stop"}]}

data: [DONE]
```

### 2.3 Streaming State Management

```typescript
export interface StreamingState {
  active: boolean;
  messageId?: string;
  buffer: string;             // Accumulated content
  source?: EventSource;       // SSE connection
}
```

**React Hook Pattern** (src/hooks/useChat.ts):

```typescript
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<StreamingState>({
    active: false,
    buffer: "",
  });

  const sendMessage = async (content: string) => {
    const userMsg: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Create SSE connection
    const url = new URL("http://localhost:3117/v1/chat/completions");
    const eventSource = new EventSource(url.toString());

    setStreaming({ active: true, buffer: "", source: eventSource });

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        // Finalize assistant message
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: streaming.buffer,
            timestamp: new Date().toISOString(),
          },
        ]);
        setStreaming({ active: false, buffer: "" });
        return;
      }

      const chunk: ChatCompletionChunk = JSON.parse(event.data);
      const content = chunk.choices[0]?.delta?.content || "";
      setStreaming((prev) => ({ ...prev, buffer: prev.buffer + content }));
    };

    eventSource.onerror = () => {
      eventSource.close();
      setStreaming({ active: false, buffer: "" });
    };
  };

  return { messages, streaming, sendMessage };
}
```

### 2.4 BRC-103 Authentication in Chat Requests

**Critical**: Chat requests MUST include BRC-103 headers (SPEC §4.4, §10.1):

```typescript
// src/lib/gateway.ts
export async function sendChatCompletion(
  request: ChatCompletionRequest,
  identity: GetIdentityResponse // Phase 1 type
): Promise<Response> {
  const nonce = generateNonce(); // 32 random bytes, hex
  const bodyJson = JSON.stringify(request);
  const signature = await signMessage(bodyJson + nonce); // Phase 1 IPC

  return fetch("http://localhost:3117/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BSV-Identity": identity.publicKey,
      "X-BSV-Nonce": nonce,
      "X-BSV-Signature": signature,
    },
    body: bodyJson,
  });
}
```

**Import Dependency**: `GetIdentityResponse` from `@/types/ipc` (Phase 1, read-only).

### 2.5 SSE Parsing Types

```typescript
export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

export type SSEParseResult =
  | { type: "chunk"; data: ChatCompletionChunk }
  | { type: "done" }
  | { type: "error"; error: string };

export interface StreamCallbacks {
  onChunk: (chunk: ChatCompletionChunk) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}
```

**Critical Constraint** (PHASE3_TYPE_CONTRACTS.md §10.4):

> Use `EventSource` API (NOT `fetch` with manual parsing). Message format: `data: {JSON}\n\n`. Termination: `data: [DONE]\n\n`.

---

## 3. System Tray Types

### 3.1 Overview (SPEC §6.4, PLAN §3 Task 2)

In Gateway mode, EdwinPAI runs as a background service with a system tray icon. The tray displays:

- Gateway status (running/paused/error)
- Channel count badge
- Subscription status
- Quick actions (Open, Pause/Resume, Settings, Quit)

### 3.2 Core Types

#### TrayMenuEvent

```typescript
export type TrayMenuEvent =
  | "open"
  | "toggle_pause"
  | "open_settings"
  | "quit";
```

**Event Handling** (Rust side):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrayMenuEvent {
    Open,
    TogglePause,
    OpenSettings,
    Quit,
}

// Tauri event listener
app.on_system_tray_event(|app, event| {
    match event {
        SystemTrayEvent::MenuItemClick { id, .. } => {
            let event = match id.as_str() {
                "open" => TrayMenuEvent::Open,
                "toggle_pause" => TrayMenuEvent::TogglePause,
                "settings" => TrayMenuEvent::OpenSettings,
                "quit" => TrayMenuEvent::Quit,
                _ => return,
            };
            // Emit to frontend
            app.emit_all("tray-event", event).ok();
        }
        _ => {}
    }
});
```

#### TrayIconState

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrayIconState {
    Running,  // Green icon
    Paused,   // Yellow icon
    Error,    // Red icon
    Stopped,  // Gray icon
}
```

**Icon Mapping**:
- `Running` → `icons/tray-running.png` (green)
- `Paused` → `icons/tray-paused.png` (yellow)
- `Error` → `icons/tray-error.png` (red)
- `Stopped` → `icons/tray-stopped.png` (gray)

#### UpdateTrayStatusRequest

```rust
pub struct UpdateTrayStatusRequest {
    pub status: GatewayStatus,
    pub channel_count: Option<u8>,
    pub subscription_active: Option<bool>,
}
```

**TypeScript Call**:

```typescript
import { trayApi } from '@/lib/tray';

// Update tray when gateway status changes
await trayApi.updateStatus({
  status: "Running",
  channelCount: 3,
  subscriptionActive: true,
});
```

#### TrayMenuState

```rust
pub struct TrayMenuState {
    pub icon: TrayIconState,
    pub status_text: String,            // "Status: Running"
    pub channel_badge: Option<String>,  // "Channels: 3 connected"
    pub subscription_text: Option<String>, // "Subscription: Active"
    pub pause_enabled: bool,
    pub pause_button_text: String,      // "Pause" or "Resume"
}
```

### 3.3 IPC Command Contracts

```rust
// src-tauri/src/commands/tray.rs

#[tauri::command]
pub async fn update_tray_status(request: UpdateTrayStatusRequest)
    -> Result<(), String>

#[tauri::command]
pub async fn update_tray_channels(count: u8) -> Result<(), String>

#[tauri::command]
pub async fn update_tray_subscription(active: bool) -> Result<(), String>

#[tauri::command]
pub async fn set_minimize_to_tray(enabled: bool) -> Result<(), String>

#[tauri::command]
pub async fn get_tray_state() -> Result<TrayMenuState, String>
```

### 3.4 Minimize-to-Tray Behavior

**Config Option** (SPEC §6.4):

```typescript
export interface MinimizeToTrayConfig {
  enabled: boolean;
  showNotification?: boolean;
}
```

**Implementation** (Tauri window event handler):

```rust
window.on_close_requested(|event| {
    let config = read_config()?;
    if config.ui.minimize_to_tray {
        event.window().hide()?;
        event.prevent_close(); // Prevent actual quit
        if config.ui.notifications {
            show_notification("EdwinPAI is still running in the system tray");
        }
    }
});
```

**Frontend Hook** (src/hooks/useTray.ts):

```typescript
export function useTray() {
  const [trayState, setTrayState] = useState<TrayMenuState | null>(null);

  useEffect(() => {
    const unlisten = listen<TrayMenuEvent>("tray-event", (event) => {
      switch (event.payload) {
        case "open":
          window.show();
          break;
        case "toggle_pause":
          // Toggle gateway pause state
          break;
        case "open_settings":
          navigate("/settings");
          break;
        case "quit":
          // Confirm quit dialog
          break;
      }
    });

    return () => { unlisten.then((fn) => fn()); };
  }, []);

  return { trayState };
}
```

---

## 4. Configuration Schema

### 4.1 Overview (SPEC §6.4, PLAN §3 Task 4)

App configuration stored in `~/.edwinpai/config.json`. Schema includes:

- Mode selection (gateway vs client)
- Gateway process settings
- UI preferences (theme, tray behavior)
- Feature flags (subscription check interval, auto-update, mDNS)

### 4.2 Core Types

#### Config (Root Schema)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub version: String,        // Schema version (e.g., "1.0.0")
    pub mode: AppMode,
    pub gateway: GatewayConfig,
    pub client: Option<ClientConfig>,
    pub ui: UiConfig,
    pub features: FeatureConfig,
}
```

#### AppMode

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    Gateway,
    Client,
}
```

**Validation**: Must be one of `"gateway"` or `"client"`. Unknown values rejected.

#### GatewayConfig

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    pub port: u16,                          // Default: 3117
    pub binary_path: Option<String>,        // Override PATH resolution
    pub auto_start: bool,                   // Start on app launch
    pub max_restarts: u8,                   // Max crash restarts (default: 3)
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
```

#### ClientConfig

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientConfig {
    pub gateway_url: Option<String>,        // e.g., "http://192.168.1.100:3117"
    pub auto_discover: bool,                // Enable mDNS LAN discovery
    pub connection_timeout: u16,            // Seconds (default: 10)
}
```

**Phase 4 Scope**: Client mode types defined now, implemented in Phase 4.

#### UiConfig

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    pub theme: String,                      // "light" | "dark" | "system"
    pub minimize_to_tray: bool,
    pub start_on_login: bool,
    pub notifications: bool,
    pub sound_effects: bool,
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
```

#### FeatureConfig

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureConfig {
    pub subscription_check_interval: u64,   // Seconds (default: 3600 = 1 hour)
    pub auto_update: bool,
    pub mdns_enabled: bool,
}

impl Default for FeatureConfig {
    fn default() -> Self {
        Self {
            subscription_check_interval: 3600,
            auto_update: true,
            mdns_enabled: true,
        }
    }
}
```

### 4.3 IPC Command Contracts

```rust
// src-tauri/src/commands/config.rs

#[tauri::command]
pub async fn read_config() -> Result<Config, String>

#[tauri::command]
pub async fn write_config(config: Config) -> Result<(), String>

#[tauri::command]
pub async fn update_config_field(path: String, value: serde_json::Value)
    -> Result<(), String>

#[tauri::command]
pub async fn get_config_path() -> Result<String, String>
```

**TypeScript Wrapper**:

```typescript
export const configApi = {
  read: () => invoke<Config>('read_config'),

  write: (config: Config) => invoke<void>('write_config', { config }),

  updateField: (path: string, value: unknown) =>
    invoke<void>('update_config_field', { path, value }),

  getPath: () => invoke<string>('get_config_path'),
};
```

### 4.4 Partial Update Pattern

**Dot-notation paths** for granular updates:

```typescript
// Update single field
await configApi.updateField("gateway.port", 3118);
await configApi.updateField("ui.theme", "dark");
await configApi.updateField("features.mdnsEnabled", false);
```

**Rust Implementation** (pseudo-code):

```rust
pub fn update_config_field(path: String, value: Value) -> Result<()> {
    let mut config = read_config()?;

    // Parse dot-notation path
    let parts: Vec<&str> = path.split('.').collect();
    match parts.as_slice() {
        ["gateway", "port"] => {
            config.gateway.port = value.as_u64()? as u16;
        }
        ["ui", "theme"] => {
            config.ui.theme = value.as_str()?.to_string();
        }
        _ => return Err("Unknown config path".into()),
    }

    write_config(config)?;
    Ok(())
}
```

### 4.5 Critical Constraints

**Atomic Writes** (PHASE3_TYPE_CONTRACTS.md §10.5):

```rust
pub fn write_config(config: Config) -> Result<()> {
    let path = config_path()?;
    let temp_path = path.with_extension("tmp");

    // Write to temp file
    let json = serde_json::to_string_pretty(&config)?;
    fs::write(&temp_path, json)?;

    // Atomic rename
    fs::rename(temp_path, path)?;
    Ok(())
}
```

**Validation**:

```rust
pub fn validate_config(config: &Config) -> Result<()> {
    // Check port range
    if config.gateway.port < 1024 || config.gateway.port > 65535 {
        return Err("Port must be between 1024 and 65535".into());
    }

    // Check theme
    if !["light", "dark", "system"].contains(&config.ui.theme.as_str()) {
        return Err("Invalid theme".into());
    }

    // Check mode
    match config.mode {
        AppMode::Gateway | AppMode::Client => {}
    }

    Ok(())
}
```

---

## 5. mDNS Service Discovery Types

### 5.1 Overview (SPEC §6.5, §10.2, PLAN §3 Task 5)

Gateway mode advertises itself on LAN via mDNS for zero-config discovery. Service type: `_edwinpai._tcp.local`.

### 5.2 Core Types

#### MdnsServiceDescriptor

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MdnsServiceDescriptor {
    pub service_type: String,       // "_edwinpai._tcp.local"
    pub instance_name: String,      // "EdwinPAI-<short-id>"
    pub host_name: String,          // e.g., "macbook.local"
    pub port: u16,
    pub properties: MdnsTxtRecords,
}
```

#### MdnsTxtRecords

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MdnsTxtRecords {
    pub pubkey: String,     // First 16 hex chars of public key
    pub version: String,    // App version (e.g., "1.0.0")
    pub petname: String,    // URL-encoded petname
}
```

**Example TXT Record** (SPEC §10.2):

```
pubkey=02a3f7b2c1d4e5f6
version=1.0.0
petname=Swift%20Falcon
```

#### DiscoveredGateway

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredGateway {
    pub name: String,       // Display name (petname or instance name)
    pub address: String,    // IPv4 address
    pub port: u16,
    pub pubkey: String,     // First 16 chars
    pub version: String,
    pub petname: String,
    pub url: String,        // Full URL: http://{address}:{port}
}
```

**TypeScript Usage**:

```typescript
const { gateways } = await discoveryApi.discoverGateways({ timeoutSecs: 5 });
// [
//   {
//     name: "Swift Falcon",
//     address: "192.168.1.100",
//     port: 3117,
//     pubkey: "02a3f7b2c1d4e5f6",
//     version: "1.0.0",
//     petname: "Swift Falcon",
//     url: "http://192.168.1.100:3117"
//   }
// ]
```

### 5.3 IPC Command Contracts

```rust
// src-tauri/src/commands/discovery.rs

#[tauri::command]
pub async fn start_mdns_advertising(request: StartMdnsAdvertisingRequest)
    -> Result<(), String>

#[tauri::command]
pub async fn stop_mdns_advertising() -> Result<(), String>

#[tauri::command]
pub async fn discover_gateways(request: DiscoverGatewaysRequest)
    -> Result<DiscoverGatewaysResponse, String>
```

#### StartMdnsAdvertisingRequest

```rust
pub struct StartMdnsAdvertisingRequest {
    pub port: u16,
    pub public_key: String,     // Full public key (compressed, 66 hex)
    pub petname: String,
    pub version: String,
}
```

**Gateway Start Integration**:

```rust
pub async fn start_gateway(request: StartGatewayRequest) -> Result<...> {
    // ... spawn gateway process ...

    // Start mDNS advertising
    let identity = crypto_domain::get_identity().await?;
    start_mdns_advertising(StartMdnsAdvertisingRequest {
        port: response.port,
        public_key: identity.public_key,
        petname: identity.petname,
        version: env!("CARGO_PKG_VERSION").to_string(),
    }).await?;

    Ok(response)
}
```

#### DiscoverGatewaysRequest/Response

```rust
pub struct DiscoverGatewaysRequest {
    pub timeout_secs: Option<u8>,   // Default: 5
    pub version: Option<String>,    // Filter by version
}

pub struct DiscoverGatewaysResponse {
    pub gateways: Vec<DiscoveredGateway>,
    pub scan_duration: u64,         // Milliseconds
}
```

### 5.4 React Hook Pattern

```typescript
// src/hooks/useDiscovery.ts
export function useDiscovery() {
  const [gateways, setGateways] = useState<DiscoveredGateway[]>([]);
  const [scanning, setScanning] = useState(false);

  const scan = async (timeoutSecs = 5) => {
    setScanning(true);
    try {
      const result = await discoveryApi.discoverGateways({ timeoutSecs });
      setGateways(result.gateways);
    } finally {
      setScanning(false);
    }
  };

  return { gateways, scanning, scan };
}
```

---

## 6. Rust-to-TypeScript Type Mapping Strategy

### 6.1 Naming Convention Matrix

| Context | Rust | TypeScript | JSON (Wire) |
|---------|------|------------|-------------|
| Struct/Interface | `PascalCase` | `PascalCase` | N/A |
| Field | `snake_case` | `camelCase` | `camelCase` |
| Enum variant | `PascalCase` | `PascalCase` | `PascalCase` |
| Enum tag | `#[serde(rename_all)]` | string literal | varies |

### 6.2 Serde Annotation Requirements

**All Rust structs crossing IPC boundary MUST use**:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MyStruct {
    pub my_field: String,  // Serializes as "myField"
}
```

**Enums**:

```rust
// PascalCase enum variants
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum MyEnum {
    VariantOne,   // Serializes as "VariantOne"
    VariantTwo,
}

// lowercase enum variants (for strings like "gateway" | "client")
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    Gateway,  // Serializes as "gateway"
    Client,   // Serializes as "client"
}
```

### 6.3 Binary Data Handling

| Rust | TypeScript | Wire Format | Notes |
|------|------------|-------------|-------|
| `Vec<u8>` | `Uint8Array` | Base64 string | Tauri auto-converts |
| `String` | `string` | UTF-8 string | Direct |
| `Option<T>` | `T \| undefined` | null or value | `undefined` serializes as null |
| `u32` | `number` | JSON number | Max safe int: 2^53-1 |
| `u64` | `number` | JSON number | **Warning**: Precision loss above 2^53 |

**Critical**: Use `u32` for process IDs, ports. Avoid `u64` in IPC types unless necessary.

### 6.4 Type Generation Tools

**Manual Alignment** (current approach):
- Write Rust types in `src-tauri/src/commands/*.rs`
- Write TypeScript types in `src/types/*.ts`
- Verify alignment via integration tests

**Future (Phase 6)**: Consider `ts-rs` or `specta` for codegen.

### 6.5 Validation Strategy

**Rust Side**:

```rust
impl TryFrom<StartGatewayRequest> for ValidatedStartRequest {
    type Error = String;

    fn try_from(req: StartGatewayRequest) -> Result<Self, Self::Error> {
        if let Some(port) = req.port {
            if port < 1024 || port > 65535 {
                return Err("Invalid port".into());
            }
        }
        Ok(Self { ... })
    }
}
```

**TypeScript Side**:

```typescript
import { z } from 'zod';

const StartGatewayRequestSchema = z.object({
  port: z.number().min(1024).max(65535).optional(),
  binaryPath: z.string().optional(),
});

export function validateStartRequest(req: unknown): StartGatewayRequest {
  return StartGatewayRequestSchema.parse(req);
}
```

---

## 7. Critical Constraints & Integration Points

### 7.1 Phase 1/2 Isolation

**MUST NOT MODIFY** (PHASE3_TYPE_CONTRACTS.md §10.1):
- `src-tauri/src/crypto_domain/` (any file)
- `src/types/ipc.ts` (Phase 1 crypto types)
- `src/types/overlay.ts` (Phase 2 subscription types)

**ALLOWED**:
- Import Phase 1/2 types (read-only)
- Call Phase 1/2 Tauri commands
- Extend Phase 1/2 React components via composition

### 7.2 Import Patterns

**TypeScript**:

```typescript
// Phase 1 imports (READ-ONLY)
import type {
  GetIdentityResponse,
  CheckSubscriptionResponse
} from '@/types/ipc';

// Phase 3 imports
import type { GatewayStatus, StartGatewayRequest } from '@/types/gateway';

// Mixing phases in components
import { IdentityBadge } from '@/components/shared/IdentityBadge'; // Phase 1
import { GatewayStatusIndicator } from '@/components/gateway/StatusIndicator'; // Phase 3
```

**Rust**:

```rust
// Phase 1 imports (READ-ONLY)
use crate::crypto_domain::{
    GetIdentityRequest,
    GetIdentityResponse,
    CheckSubscriptionRequest,
    CheckSubscriptionResponse,
};

// Phase 3 types
use super::gateway::{GatewayStatus, StartGatewayRequest};
```

### 7.3 Gateway Binary Resolution Order

1. `StartGatewayRequest.binary_path` (if provided)
2. `Config.gateway.binary_path` (if set)
3. `EDWINPAI_GATEWAY_PATH` environment variable
4. System PATH lookup (`which edwinpai` on Unix, `where edwinpai` on Windows)

**Error if not found**: `ERR_GATEWAY_BINARY_NOT_FOUND`

### 7.4 Port Conflict Resolution

```rust
pub fn bind_gateway_port(requested_port: u16) -> Result<u16, String> {
    for attempt in 0..5 {
        let port = requested_port + attempt;
        match TcpListener::bind(("127.0.0.1", port)) {
            Ok(_) => return Ok(port),
            Err(_) => continue,
        }
    }
    Err(format!("No available port near {}", requested_port))
}
```

**Store actual port** in `GatewayStatusResponse.port`.

### 7.5 SSE Streaming Requirements

**Use `EventSource` API** (NOT manual fetch parsing):

```typescript
// ✅ CORRECT
const eventSource = new EventSource(url);
eventSource.onmessage = (event) => { ... };

// ❌ INCORRECT
const response = await fetch(url);
const reader = response.body.getReader();
// ... manual parsing
```

**Message Format**:
- `data: {JSON}\n\n` (chunk)
- `data: [DONE]\n\n` (termination)

**Error Handling**: Close stream, show retry UI with exponential backoff.

### 7.6 Config File Atomicity

**Location**: `~/.edwinpai/config.json`

**Write Pattern**:

```rust
pub fn write_config(config: Config) -> Result<()> {
    let path = config_path()?;
    let temp = path.with_extension("tmp");

    fs::write(&temp, serde_json::to_string_pretty(&config)?)?;
    fs::rename(temp, path)?; // Atomic on POSIX, near-atomic on Windows

    Ok(())
}
```

**Migration** (Phase 6): Handle schema version upgrades.

---

## 8. Test Coverage Requirements

### 8.1 Rust Unit Tests

**Required Tests** (src-tauri/src/commands/gateway.rs):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gateway_status_serialization() {
        let status = GatewayStatusResponse {
            status: GatewayStatus::Running,
            pid: Some(12345),
            port: Some(3117),
            uptime: Some(3600),
            error: None,
            restart_count: 0,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"restartCount\":0")); // camelCase

        let parsed: GatewayStatusResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, GatewayStatus::Running);
    }

    #[test]
    fn test_port_conflict_resolution() {
        let port = bind_gateway_port(3117).unwrap();
        assert!(port >= 3117 && port <= 3121);
    }
}
```

### 8.2 TypeScript Unit Tests

**Required Tests** (src/__tests__/lib/gateway.test.ts):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { gatewayApi } from '@/lib/gateway';
import type { GatewayStatusResponse } from '@/types/gateway';

describe('gatewayApi', () => {
  it('should parse GatewayStatusResponse correctly', () => {
    const mockResponse: GatewayStatusResponse = {
      status: "Running",
      pid: 12345,
      port: 3117,
      uptime: 3600,
      restartCount: 0,
    };

    expect(mockResponse.status).toBe("Running");
    expect(mockResponse.restartCount).toBe(0); // camelCase
  });

  it('should handle optional fields', () => {
    const mockResponse: GatewayStatusResponse = {
      status: "Stopped",
      restartCount: 0,
    };

    expect(mockResponse.pid).toBeUndefined();
    expect(mockResponse.error).toBeUndefined();
  });
});
```

### 8.3 Integration Tests

**E2E Gateway Lifecycle** (src-tauri/tests/gateway_lifecycle.rs):

```rust
#[tokio::test]
async fn test_gateway_start_stop() {
    // Start gateway
    let start_req = StartGatewayRequest {
        port: Some(3117),
        binary_path: Some("/path/to/test/gateway".into()),
    };
    let start_resp = start_gateway(start_req).await.unwrap();
    assert_eq!(start_resp.status, GatewayStatus::Running);

    // Check status
    let status = get_gateway_status().await.unwrap();
    assert_eq!(status.status, GatewayStatus::Running);
    assert!(status.uptime.is_some());

    // Stop gateway
    stop_gateway().await.unwrap();
    let status = get_gateway_status().await.unwrap();
    assert_eq!(status.status, GatewayStatus::Stopped);
}
```

---

## 9. Documentation References

### 9.1 Source Documents

- **PLAN.md** — Phase 3 tasks and milestones (§3)
- **SPEC.md** — Technical architecture (§6.4, §6.5, §10.1, §10.2)
- **PHASE3_TYPE_CONTRACTS.md** — Complete type definitions (this document's source)
- **PHASE3_REQUIREMENTS.md** — Implementation scope and deliverables

### 9.2 Related Phase 1/2 Docs

- **PHASE1_TYPE_ALIGNMENT_SUMMARY.md** — Crypto domain types reference
- **PHASE1_TEST_MANIFEST.md** — Crypto domain test patterns
- **src/types/ipc.ts** — Phase 1/2 IPC types (read-only reference)

### 9.3 External References

- **BRC-103** — BSV request signing (authentication headers)
- **OpenAI Chat Completions API** — `/v1/chat/completions` compatibility
- **Server-Sent Events (SSE)** — [MDN EventSource docs](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- **mDNS/DNS-SD** — RFC 6763 (service discovery)

---

## 10. Summary Checklist

### 10.1 Type Definition Completion

- [x] Gateway lifecycle types (5 structs, 1 enum)
- [x] System tray types (4 structs, 2 enums)
- [x] Chat streaming types (6 interfaces, 2 enums)
- [x] Configuration schema (6 structs, 1 enum)
- [x] mDNS discovery types (5 structs)

### 10.2 IPC Command Contracts

- [x] Gateway commands (6 commands)
- [x] Tray commands (5 commands)
- [x] Config commands (4 commands)
- [x] Discovery commands (3 commands)

### 10.3 Integration Points

- [x] Phase 1 crypto domain imports documented
- [x] Phase 2 subscription integration documented
- [x] BRC-103 authentication in chat requests
- [x] Subscription check before gateway start

### 10.4 Type Mapping Strategy

- [x] Rust-TypeScript naming conventions
- [x] Serde annotation requirements
- [x] Binary data handling (Uint8Array ↔ Vec<u8>)
- [x] Optional field mapping (Option<T> ↔ T | undefined)

### 10.5 Critical Constraints

- [x] Phase 1/2 isolation (no modifications)
- [x] Gateway binary external resolution
- [x] Port conflict resolution (5 attempts)
- [x] SSE EventSource API requirement
- [x] Atomic config file writes

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Phase**: 3 (Gateway Mode)
**Status**: Requirements extraction complete, ready for implementation

**Next Steps**:
1. Implement Rust command modules (`src-tauri/src/commands/*.rs`)
2. Implement TypeScript type files (`src/types/*.ts`)
3. Write React hooks (`src/hooks/useGateway.ts`, etc.)
4. Build UI components (ChatView, System Tray integration)
5. Write unit tests (Rust + TypeScript)
6. Write integration tests (E2E gateway lifecycle)

**Related Files**:
- `PHASE3_TYPE_CONTRACTS.md` — Detailed type definitions with examples
- `PHASE3_REQUIREMENTS.md` — Implementation scope and deliverables
- `PHASE3_COMPLETION_CHECKLIST.md` — Task breakdown for execution
