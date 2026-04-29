# Phase 3 Completion Checklist
## Gateway Mode Implementation

**Status**: Ready to implement
**Target LOC**: 2,687 lines (823 Rust + 1,258 TypeScript + 606 tests)
**Files**: 24 total (7 Rust backend + 12 TypeScript frontend + 5 test files)
**Estimated Time**: 34-43 hours

---

## Overview

Phase 3 delivers the core EdwinPAI Desktop experience: bundling the EdwinPAI gateway as a background service, implementing the chat interface, system tray integration, configuration persistence, and LAN discoverability via mDNS.

**Key deliverables**:
1. Gateway process lifecycle management (start/stop/restart/health checks)
2. System tray with status indicators and menu
3. Chat UI with SSE streaming and markdown rendering
4. Config persistence in `~/.edwinpai/config.json`
5. mDNS advertising for LAN discovery (`_edwinpai._tcp.local`)

---

## Integration with Previous Phases

### Phase 1 (Crypto Domain & BSV Identity)
- ✅ **Reuses identity system**: Gateway uses Phase 1's `GetPublicKeyRequest` for mDNS TXT records and BRC-103 auth
- ✅ **Reuses signing**: Gateway API calls signed via Phase 1's `SignRequest` IPC
- ✅ **Reuses petname/avatar**: mDNS advertises petname derived from Phase 1 identity logic
- ✅ **No new keychain integration needed**: Phase 1 Crypto Domain handles all key operations

### Phase 2 (Subscription System)
- ✅ **Subscription gating**: Gateway start blocked if `CheckSubscriptionRequest` returns `active=false`
- ✅ **Status sync**: System tray displays Phase 2 subscription state (Active/Cached/Expired)
- ✅ **Runtime enforcement**: Gateway pauses if subscription expires during operation
- ✅ **UI integration**: Settings page shows subscription status via `useSubscription` hook

---

## File-by-File Breakdown

### Rust Backend (7 files, 823 LOC)

#### 1. `src-tauri/src/commands/gateway.rs` (180 LOC)
**Purpose**: Gateway process lifecycle management

**Key functions**:
- `start_gateway(config: GatewayConfig) -> Result<GatewayHandle>`
  - Checks subscription via Phase 2 `check_subscription` command
  - Spawns EdwinPAI gateway as child process with `tokio::process::Command`
  - Binds to `127.0.0.1:<port>` (default: 3117)
  - Returns handle with PID, port, start time
- `stop_gateway(handle: GatewayHandle) -> Result<()>`
  - Sends SIGTERM to gateway process
  - Waits up to 5s for graceful shutdown, then SIGKILL
- `restart_gateway(handle: GatewayHandle) -> Result<GatewayHandle>`
  - Stops existing gateway, starts new one with same config
- `check_gateway_health(port: u16) -> Result<HealthStatus>`
  - HTTP GET to `http://127.0.0.1:<port>/v1/edwinpai/health`
  - Parses response: `{ status, uptime, version }`
- `monitor_gateway_process(handle: GatewayHandle) -> impl Stream<ProcessStatus>`
  - Polls gateway health every 30s
  - Emits `Healthy | Crashed(ExitStatus) | Unresponsive`

**Dependencies**:
- `tokio::process::Command` for child process management
- `commands::crypto::check_subscription` for Phase 2 integration
- `commands::tray::update_tray_status` for UI sync

**Tests covered by**: `tests/gateway_lifecycle.rs`

---

#### 2. `src-tauri/src/commands/tray.rs` (145 LOC)
**Purpose**: System tray icon and menu management

**Key functions**:
- `init_system_tray() -> SystemTray`
  - Creates tray with icon, menu items: Open, Pause/Resume, Settings, Quit
  - Platform-specific icon paths (`.ico` for Windows, `.png` for Linux/macOS)
- `update_tray_status(status: GatewayStatus)`
  - Changes tray icon based on status (running=green, paused=yellow, error=red)
  - Updates menu text ("Pause" ↔ "Resume")
- `update_tray_badge(count: u32)`
  - Shows channel count badge on tray icon (macOS/Windows only, Linux no-op)
- `handle_tray_event(event: SystemTrayEvent)`
  - Dispatches clicks: Open→show_main_window, Pause→pause_gateway, etc.
- `set_tray_menu(menu: TrayMenuConfig)`
  - Rebuilds menu dynamically (e.g., adds "Subscription Expired" warning)

**Dependencies**:
- `tauri::SystemTray, SystemTrayMenu, SystemTrayEvent`
- `commands::gateway::get_gateway_status`
- `crypto_domain::subscription::get_subscription_status` (Phase 2)

**Tests covered by**: `tests/e2e/gateway_mode.spec.ts` (E2E tray interactions)

---

#### 3. `src-tauri/src/commands/discovery.rs` (168 LOC)
**Purpose**: mDNS service advertising and discovery for LAN

**Key functions**:
- `advertise_gateway(port: u16, public_key: String, petname: String) -> Result<MdnsHandle>`
  - Registers `_edwinpai._tcp.local` service with `mdns-sd` crate
  - TXT records: `pubkey=<first16chars>`, `version=<appVersion>`, `petname=<urlencoded>`
  - Returns handle for later stop
- `stop_advertising(handle: MdnsHandle) -> Result<()>`
  - Unregisters mDNS service
- `discover_gateways(timeout_ms: u64) -> Result<Vec<DiscoveredGateway>>`
  - Browses for `_edwinpai._tcp.local` services
  - Returns list of: `{ petname, publicKeyPrefix, ip, port, version }`
- `parse_txt_records(txt: &HashMap<String, String>) -> GatewayInfo`
  - Extracts `pubkey`, `version`, `petname` from TXT records

**Dependencies**:
- `mdns-sd` crate (v0.11) for Bonjour/Avahi/mDNS-SD
- `commands::gateway::get_gateway_port`
- `crypto_domain::identity::get_public_key` (Phase 1)

**Tests covered by**: `tests/mdns_discovery.rs`

---

#### 4. `src-tauri/src/commands/config.rs` (112 LOC)
**Purpose**: Configuration file persistence and validation

**Key functions**:
- `read_config() -> Result<AppConfig>`
  - Reads `~/.edwinpai/config.json`
  - Returns default config if file doesn't exist
- `write_config(config: AppConfig) -> Result<()>`
  - Validates config (port range, valid mode, etc.)
  - Writes atomically (tmp file + rename)
- `get_config_path() -> Result<PathBuf>`
  - Resolves platform-specific path (Linux: `~/.edwinpai/`, macOS: `~/Library/Application Support/com.edwinpai.desktop/`, Windows: `%APPDATA%/com.edwinpai.desktop/`)
- `validate_config(config: &AppConfig) -> Result<()>`
  - Checks: port 1024-65535, mode is 'gateway' or 'client', theme is valid
- `migrate_config(old_version: u32, new_version: u32) -> Result<AppConfig>`
  - Handles config schema upgrades (v1→v2 adds `checkUpdates` field with default `true`)

**Dependencies**:
- `serde_json` for serialization
- `tauri::api::path::app_data_dir`
- `std::fs` for file I/O

**Tests covered by**: `tests/config_persistence.rs`

---

#### 5-7. Type Definition Files (218 LOC total)

**`src-tauri/src/gateway_types.rs`** (88 LOC)
- `struct GatewayConfig { mode: Mode, port: u16, auto_start: bool, channels: Vec<String> }`
- `struct GatewayHandle { process: Child, pid: u32, port: u16, started_at: SystemTime }`
- `enum GatewayStatus { Running, Paused, Stopped, Error(String) }`
- `struct HealthStatus { uptime_secs: u64, version: String, active_channels: u32 }`
- `enum ProcessStatus { Healthy, Crashed(ExitStatus), Unresponsive }`

**`src-tauri/src/mdns_types.rs`** (65 LOC)
- `struct DiscoveredGateway { petname: String, public_key_prefix: String, ip: IpAddr, port: u16, version: String }`
- `struct MdnsHandle { service_name: String, registration: ServiceRegistration }`
- `struct GatewayInfo { pubkey: String, version: String, petname: String }`
- `const SERVICE_TYPE: &str = "_edwinpai._tcp.local"`

**`src-tauri/src/config_types.rs`** (65 LOC)
- `struct AppConfig { version: u32, mode: Mode, gateway: GatewaySettings, ui: UiSettings }`
- `struct GatewaySettings { port: u16, auto_start: bool, minimize_to_tray: bool, check_updates: bool }`
- `struct UiSettings { theme: Theme, chat_history_limit: u32, notifications_enabled: bool }`
- `enum Mode { Gateway, Client }`
- `enum Theme { System, Light, Dark }`

---

### TypeScript Frontend (12 files, 1,258 LOC)

#### 8. `src/lib/gateway.ts` (145 LOC)
**Purpose**: Gateway REST API client with BRC-103 authentication

**Key exports**:
```typescript
class GatewayClient {
  constructor(baseUrl: string, identityKey: string)

  // OpenAI-compatible chat endpoint
  async chat(messages: Message[], stream: boolean): Promise<ChatResponse | AsyncIterator<ChatChunk>>

  // EdwinPAI-specific endpoints
  async getIdentity(): Promise<GatewayIdentity>
  async getSubscriptionStatus(): Promise<SubscriptionStatus>
  async getHealth(): Promise<HealthStatus>

  // BRC-103 authentication (uses Phase 1 SignRequest IPC)
  private async signRequest(payload: string): Promise<AuthHeaders>
}
```

**Dependencies**:
- `@/lib/crypto` for `signRequest` IPC wrapper
- `@/types/api` for response types
- `EventSource` for SSE streaming

**Authentication flow**:
1. Serializes request body to JSON
2. Calls Phase 1 `SignRequest` IPC with payload
3. Adds headers: `X-BSV-Identity`, `X-BSV-Nonce`, `X-BSV-Signature`
4. Sends HTTP request to gateway

**Tests covered by**: `tests/e2e/chat_flow.spec.ts`

---

#### 9. `src/lib/discovery.ts` (92 LOC)
**Purpose**: LAN gateway discovery wrapper for Tauri IPC

**Key exports**:
```typescript
// Scans LAN for gateways via mDNS
async function discoverGateways(timeoutMs: number = 5000): Promise<DiscoveredGateway[]>

// Starts mDNS advertising (Gateway mode)
async function startAdvertising(port: number): Promise<void>

// Stops mDNS advertising
async function stopAdvertising(): Promise<void>

// Formats gateway URL from discovery result
function formatGatewayUrl(gateway: DiscoveredGateway): string
```

**Example usage**:
```typescript
const gateways = await discoverGateways(5000)
// [{ petname: "Swift Falcon", publicKeyPrefix: "02a1b2c3", ip: "192.168.1.100", port: 3117, version: "1.0.0" }]

const url = formatGatewayUrl(gateways[0])
// "http://192.168.1.100:3117"
```

---

#### 10. `src/lib/config.ts` (78 LOC)
**Purpose**: Config persistence layer (Tauri IPC wrapper)

**Key exports**:
```typescript
// Reads config from ~/.edwinpai/config.json
async function readConfig(): Promise<AppConfig>

// Writes entire config
async function writeConfig(config: AppConfig): Promise<void>

// Updates partial config (merges with existing)
async function updateConfig(partial: Partial<AppConfig>): Promise<AppConfig>

// Default config values
const DEFAULT_CONFIG: AppConfig
```

**Default config**:
```json
{
  "version": 1,
  "mode": "gateway",
  "gateway": {
    "port": 3117,
    "autoStart": true,
    "minimizeToTray": true,
    "checkUpdates": true
  },
  "ui": {
    "theme": "system",
    "chatHistoryLimit": 1000,
    "notificationsEnabled": true
  }
}
```

---

#### 11. `src/hooks/useGateway.ts` (118 LOC)
**Purpose**: React hook for gateway lifecycle management

**API**:
```typescript
function useGateway(): {
  status: GatewayStatus          // 'running' | 'paused' | 'stopped' | 'error'
  health: HealthStatus | null    // { uptime, version, activeChannels }
  start: () => Promise<void>
  stop: () => Promise<void>
  restart: () => Promise<void>
  error: string | null
}
```

**Auto health polling**:
- Polls `/v1/edwinpai/health` every 30s when `status === 'running'`
- Updates `health` state with response
- Detects crashes (health check fails 3x in a row → status='error')

**Example usage**:
```tsx
function GatewayControls() {
  const { status, start, stop, restart } = useGateway()

  return (
    <div>
      <p>Status: {status}</p>
      {status === 'stopped' && <button onClick={start}>Start</button>}
      {status === 'running' && <button onClick={stop}>Stop</button>}
      <button onClick={restart}>Restart</button>
    </div>
  )
}
```

---

#### 12. `src/hooks/useDiscovery.ts` (85 LOC)
**Purpose**: React hook for LAN gateway discovery

**API**:
```typescript
function useDiscovery(autoRefresh: boolean = false): {
  gateways: DiscoveredGateway[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}
```

**Auto-refresh**:
- If `autoRefresh=true`, re-scans every 10s
- Useful for real-time discovery UI

**Example usage**:
```tsx
function GatewayDiscovery() {
  const { gateways, loading, refresh } = useDiscovery(true)

  return (
    <div>
      <button onClick={refresh}>Refresh</button>
      {loading && <p>Scanning...</p>}
      {gateways.map(g => (
        <div key={g.publicKeyPrefix}>
          {g.petname} - {g.ip}:{g.port}
        </div>
      ))}
    </div>
  )
}
```

---

#### 13. `src/components/chat/ChatView.tsx` (186 LOC)
**Purpose**: Main chat interface with message history and streaming

**Props**: `{ gatewayUrl: string }`

**State**:
- `messages: Message[]` - chat history (loaded from localStorage)
- `streaming: boolean` - true during SSE streaming
- `error: string | null` - error message for toast

**Key features**:
- Auto-scroll to bottom on new message
- SSE streaming: displays tokens character-by-character
- Markdown rendering in messages (via `MessageBubble`)
- Persists history to localStorage (key: `edwinpai.chatHistory`)
- Error handling with retry button

**Message flow**:
1. User types in `InputBar`, presses Enter
2. `ChatView` adds user message to `messages` array
3. `ChatView` calls `gatewayClient.chat(messages, stream=true)`
4. For each SSE chunk, appends text to last message (role='assistant')
5. On stream end, saves `messages` to localStorage

---

#### 14. `src/components/chat/MessageBubble.tsx` (94 LOC)
**Purpose**: Single message display with markdown rendering

**Props**: `{ message: Message, streaming?: boolean }`

**Features**:
- Role-based styling:
  - User messages: right-aligned, blue background
  - Assistant messages: left-aligned, gray background
- Markdown rendering:
  - Bold, italic, code blocks, lists
  - Syntax highlighting for code (via `react-markdown` + `prism.js`)
- Timestamp display (e.g., "2 minutes ago")
- Streaming cursor animation (blinking `|` when `streaming=true`)

---

#### 15. `src/components/chat/InputBar.tsx` (102 LOC)
**Purpose**: Chat input with keyboard shortcuts

**Props**: `{ onSend: (content: string) => Promise<void>, disabled?: boolean }`

**Features**:
- Textarea with auto-resize (up to 5 lines)
- Keyboard shortcuts:
  - **Enter**: Send message (unless Shift held)
  - **Shift+Enter**: Insert newline
- Send button (disabled when empty or `disabled=true`)
- Loading spinner during send
- Clear input after successful send

---

#### 16. `src/components/layout/SystemTray.tsx` (67 LOC)
**Purpose**: System tray menu setup (Tauri-side)

**Exports**: `function setupSystemTray(): Promise<void>`

**Menu structure**:
```
EdwinPAI
├─ Status: Running
├─ Subscription: Active
├─ Channels: 3 connected
├─────────────────────
├─ Open EdwinPAI
├─ Pause / Resume
├─ Settings
├─ Quit EdwinPAI
```

**Status sync**:
- Uses `useGateway()` hook to get current gateway status
- Uses `useSubscription()` hook (Phase 2) for subscription status
- Updates tray menu text dynamically

---

#### 17. `src/components/settings/GeneralSettings.tsx` (128 LOC)
**Purpose**: General settings UI

**Sections**:

1. **Mode** (read-only after onboarding)
   - Display: "Gateway Mode" or "Client Mode"
   - Change requires re-running onboarding

2. **Gateway Settings** (only visible in Gateway mode)
   - Port: `<input type="number" min="1024" max="65535">`
   - Auto-start: `<Switch>` (start gateway on app launch)
   - Minimize to tray: `<Switch>` (minimize instead of quit)

3. **UI Settings**
   - Theme: `<Select>` (System / Light / Dark)
   - Chat history limit: `<input type="number">` (messages to keep)
   - Notifications: `<Switch>` (enable desktop notifications)

4. **Updates** (Gateway mode only)
   - Check for updates: `<Switch>` (auto-check on startup)

**Save behavior**:
- Debounced auto-save (500ms after change)
- Toast on successful save
- Validation errors shown inline

---

#### 18. `src/components/onboarding/GatewayModeFlow.tsx` (143 LOC)
**Purpose**: Gateway mode onboarding orchestrator

**Steps**:
1. **Identity Setup** (from Phase 1)
   - Displays: "You are Swift Falcon"
   - Shows avatar + petname
   - Continues automatically

2. **Subscription Setup** (from Phase 2)
   - User initiates payment
   - Waits for UTXO confirmation
   - Shows "Subscription active!"

3. **Channels** (optional, skippable)
   - "Want to connect EdwinPAI to your messaging apps?"
   - Deferred to Phase 5 (wizard framework)
   - For now, just shows "You can add channels later"

4. **Complete**
   - Starts gateway service
   - Enables system tray
   - Transitions to main chat interface

**State machine**:
```typescript
type Step = 'identity' | 'subscription' | 'channels' | 'complete'
const [step, setStep] = useState<Step>('identity')
```

---

#### 19. `src/types/api.ts` (120 LOC)
**Purpose**: Extended API type definitions for Phase 3

**New types** (additions to Phase 0/1/2 types):
```typescript
interface HealthStatus {
  status: 'ok' | 'degraded'
  uptime: number        // seconds since gateway start
  version: string
}

interface GatewayStatus {
  state: 'running' | 'paused' | 'stopped' | 'error'
  port: number
  pid?: number
  error?: string
}

interface DiscoveredGateway {
  petname: string
  publicKeyPrefix: string    // first 16 hex chars
  ip: string
  port: number
  version: string
}

interface AppConfig {
  version: number
  mode: 'gateway' | 'client'
  gateway: GatewaySettings
  ui: UiSettings
}

interface GatewaySettings {
  port: number
  autoStart: boolean
  minimizeToTray: boolean
  checkUpdates: boolean
}

interface UiSettings {
  theme: 'system' | 'light' | 'dark'
  chatHistoryLimit: number
  notificationsEnabled: boolean
}

interface AuthHeaders {
  'X-BSV-Identity': string
  'X-BSV-Nonce': string
  'X-BSV-Signature': string
}

// Error codes from SPEC §12.2
type ErrorCode =
  | 'ERR_AUTH_MISSING_HEADERS'
  | 'ERR_AUTH_INVALID_SIGNATURE'
  | 'ERR_AUTH_NONCE_REUSED'
  | 'ERR_AUTH_TIMING_ANOMALY'
  | 'ERR_AUTH_UNAUTHORIZED'
  | 'ERR_AUTH_INSUFFICIENT_PERMISSION'
  | 'ERR_SUBSCRIPTION_INACTIVE'
  | 'ERR_SUBSCRIPTION_GRACE_EXCEEDED'
  | 'ERR_INVITE_INVALID'
  | 'ERR_INVITE_USED'
  | 'ERR_CHANNEL_NOT_CONFIGURED'
  | 'ERR_CHANNEL_DISCONNECTED'
  | 'ERR_GATEWAY_UNAVAILABLE'
  | 'ERR_CRYPTO_SIGNING_FAILED'
  | 'ERR_CRYPTO_KEYCHAIN_UNAVAILABLE'
```

---

### Tests (5 files, 606 LOC)

#### 20. `src-tauri/tests/gateway_lifecycle.rs` (148 LOC)
**Integration tests for gateway process management**

**Tests**:
1. ✅ `test_start_gateway_success()`
   - Starts gateway with `start_gateway(config)`
   - Verifies process spawned (PID > 0)
   - Checks health endpoint responds: `GET /v1/edwinpai/health → { status: "ok" }`

2. ✅ `test_stop_gateway_clean_shutdown()`
   - Starts gateway, then stops with `stop_gateway(handle)`
   - Verifies process exits within 5s
   - Checks port is released (no longer bound)

3. ✅ `test_restart_gateway_preserves_config()`
   - Starts gateway on port 3117
   - Restarts with `restart_gateway(handle)`
   - Verifies new PID, same port

4. ✅ `test_gateway_crash_detection()`
   - Starts gateway
   - Kills process with `kill -9 <pid>`
   - Verifies `monitor_gateway_process()` emits `Crashed(exitStatus)`

5. ✅ `test_gateway_health_check_timeout()`
   - Starts gateway
   - Blocks port 3117 with external process
   - Verifies `check_gateway_health()` returns timeout error

6. ✅ `test_subscription_blocks_gateway_start()`
   - Mocks `check_subscription()` to return `active=false`
   - Calls `start_gateway(config)`
   - Verifies error: `"Subscription inactive - cannot start gateway"`

---

#### 21. `src-tauri/tests/mdns_discovery.rs` (122 LOC)
**Integration tests for mDNS advertising and discovery**

**Tests**:
1. ✅ `test_advertise_gateway_publishes_service()`
   - Calls `advertise_gateway(3117, "02a1b2c3...", "Swift Falcon")`
   - Queries mDNS with `mdns-sd` browser
   - Verifies service `_edwinpai._tcp.local` found

2. ✅ `test_stop_advertising_removes_service()`
   - Advertises gateway
   - Calls `stop_advertising(handle)`
   - Queries mDNS again, verifies service NOT found

3. ✅ `test_discover_gateways_finds_local()`
   - Starts local gateway with mDNS enabled
   - Calls `discover_gateways(5000)`
   - Verifies returned list includes local gateway

4. ✅ `test_parse_txt_records_valid()`
   - Mocks TXT records: `{ pubkey: "02a1b2c3...", version: "1.0.0", petname: "Swift+Falcon" }`
   - Calls `parse_txt_records(txt)`
   - Verifies: `pubkey="02a1b2c3"`, `petname="Swift Falcon"` (URL-decoded)

5. ✅ `test_discover_gateways_timeout()`
   - Calls `discover_gateways(1000)` (1s timeout)
   - Verifies function returns within 1.5s
   - No panic on timeout

---

#### 22. `src-tauri/tests/config_persistence.rs` (98 LOC)
**Unit tests for config read/write/validation**

**Tests**:
1. ✅ `test_read_config_default()`
   - Deletes `~/.edwinpai/config.json` if exists
   - Calls `read_config()`
   - Verifies returns `DEFAULT_CONFIG`

2. ✅ `test_write_config_persists()`
   - Creates custom config: `{ mode: 'client', gateway: { port: 5000 } }`
   - Calls `write_config(config)`
   - Calls `read_config()`
   - Verifies values match

3. ✅ `test_validate_config_invalid_port()`
   - Creates config with `port: 0`
   - Calls `validate_config(&config)`
   - Verifies error: `"Port must be between 1024 and 65535"`

4. ✅ `test_validate_config_invalid_mode()`
   - Creates config with `mode: "invalid"`
   - Calls `validate_config(&config)`
   - Verifies error: `"Mode must be 'gateway' or 'client'"`

5. ✅ `test_migrate_config_v1_to_v2()`
   - Loads v1 config: `{ version: 1, ... }` (missing `checkUpdates` field)
   - Calls `migrate_config(1, 2)`
   - Verifies v2 config has `checkUpdates: true`

6. ✅ `test_config_path_resolution()`
   - Calls `get_config_path()`
   - Verifies path contains `edwinpai` or `com.edwinpai.desktop`
   - Checks platform-specific locations

---

#### 23. `tests/e2e/chat_flow.spec.ts` (134 LOC)
**E2E tests for chat interface (Playwright)**

**Tests**:
1. ✅ `test('send message and receive response')`
   - Opens chat interface
   - Types "Hello EdwinPAI" in input bar
   - Clicks Send button
   - Waits for assistant message bubble to appear
   - Verifies message content contains "Hello" or "Hi"

2. ✅ `test('streaming displays tokens incrementally')`
   - Sends message "Tell me a long story"
   - Mocks SSE stream with 100ms delay per token
   - Verifies message bubble updates character-by-character (not all at once)

3. ✅ `test('error handling displays toast')`
   - Mocks gateway to return 500 error
   - Sends message
   - Verifies error toast appears with text "Failed to send message"
   - Clicks "Retry" button, verifies re-sends

4. ✅ `test('keyboard shortcuts work')`
   - Types "Test message"
   - Presses Enter (without Shift)
   - Verifies message sent, input cleared

5. ✅ `test('multiline input with Shift+Enter')`
   - Types "Line 1"
   - Presses Shift+Enter
   - Types "Line 2"
   - Verifies input has 2 lines, message NOT sent yet
   - Presses Enter (without Shift)
   - Verifies message sent with "Line 1\nLine 2"

6. ✅ `test('message history persists across reload')`
   - Sends 3 messages
   - Reloads browser
   - Verifies all 3 messages still visible in chat

---

#### 24. `tests/e2e/gateway_mode.spec.ts` (104 LOC)
**E2E tests for gateway mode lifecycle**

**Tests**:
1. ✅ `test('gateway mode onboarding completes')`
   - Clicks "Set up a new EdwinPAI (Gateway)"
   - Verifies identity screen shows petname + avatar
   - Mocks subscription payment flow (auto-complete)
   - Skips channel setup
   - Verifies chat interface appears, gateway status = "Running"

2. ✅ `test('system tray shows running status')`
   - Starts gateway
   - Opens system tray (platform-specific: click icon)
   - Verifies menu shows "Status: Running"

3. ✅ `test('minimize to tray works')`
   - Enables "Minimize to tray" in settings
   - Closes main window
   - Verifies app still running (tray icon visible)
   - Opens from tray, verifies window restored

4. ✅ `test('pause/resume gateway from tray')`
   - Opens tray menu
   - Clicks "Pause"
   - Verifies gateway status changes to "Paused"
   - Clicks "Resume"
   - Verifies status back to "Running"

5. ✅ `test('mDNS advertising visible from client')`
   - Starts gateway in Gateway mode
   - Switches to Client mode in separate app instance
   - Clicks "Scan for gateways"
   - Verifies gateway discovered in list (matches petname)

---

## Completion Checklist

### ✅ Gateway Lifecycle
- [ ] Gateway process starts on app launch (if `mode=gateway` and subscription active)
- [ ] Gateway stops cleanly on app quit (SIGTERM → 5s wait → SIGKILL)
- [ ] Gateway restarts automatically if crash detected (max 3 restarts within 5 minutes)
- [ ] Health check endpoint (`/v1/edwinpai/health`) responds within 5s
- [ ] Gateway port configurable via settings (default: 3117, range: 1024-65535)
- [ ] Subscription check blocks gateway start if `active=false` (Phase 2 integration)

### ✅ System Tray
- [ ] System tray icon visible on all platforms (Linux/macOS/Windows)
- [ ] Tray menu shows: Open, Pause/Resume, Settings, Quit
- [ ] Tray status indicator syncs with gateway state (running/paused/stopped/error)
- [ ] Minimize to tray works (configurable in settings)
- [ ] App remains in tray after window close (if `minimizeToTray=true`)
- [ ] Tray icon badge shows channel count (stretch goal for Phase 5)

### ✅ Chat UI
- [ ] Chat interface renders message history from localStorage (max 1000 messages)
- [ ] Send button and Enter key send messages
- [ ] Shift+Enter inserts newline (does not send)
- [ ] SSE streaming displays tokens incrementally (no buffering, <100ms latency)
- [ ] Markdown rendering works (bold, italic, code blocks, lists, syntax highlighting)
- [ ] Auto-scroll to bottom on new message (with "scroll to bottom" button if user scrolled up)
- [ ] Loading spinner during message send
- [ ] Error toast on API failure with retry button

### ✅ Config Persistence
- [ ] Config writes to platform-specific path:
  - Linux: `~/.edwinpai/config.json`
  - macOS: `~/Library/Application Support/com.edwinpai.desktop/config.json`
  - Windows: `%APPDATA%/com.edwinpai.desktop/config.json`
- [ ] Config validation rejects invalid values (port out of range, invalid mode)
- [ ] Config migration handles version upgrades (v1→v2 adds `checkUpdates` field with default `true`)
- [ ] Settings UI updates config on change (debounced 500ms auto-save)
- [ ] Settings UI reflects current config on load

### ✅ mDNS Discoverable
- [ ] Gateway advertises `_edwinpai._tcp.local` service when running
- [ ] TXT records include: `pubkey` (first 16 hex chars), `version`, `petname` (URL-encoded)
- [ ] Service stops advertising when gateway pauses or quits
- [ ] Client mode discovers gateways via LAN scan (5s timeout)
- [ ] Discovered gateways display: petname, IP, port, version
- [ ] Manual URL entry fallback works if mDNS fails

### ✅ Integration with Phase 1
- [ ] Gateway uses Phase 1 identity for BRC-103 auth headers (`X-BSV-Identity`, `X-BSV-Signature`)
- [ ] mDNS TXT record `pubkey` derived from Phase 1 `GetPublicKeyRequest`
- [ ] Petname in mDNS derived from Phase 1 identity.rs petname logic
- [ ] Gateway API calls signed with Phase 1 `SignRequest` IPC

### ✅ Integration with Phase 2
- [ ] Gateway start blocked if `CheckSubscriptionRequest` returns `active=false`
- [ ] System tray subscription status syncs with Phase 2 state (Active/Cached/Expired)
- [ ] Settings UI subscription section displays Phase 2 subscription status
- [ ] Gateway pauses if subscription expires during runtime

### ✅ All Tests Passing
- [ ] Rust tests: 23 tests (6 gateway_lifecycle + 5 mdns_discovery + 6 config_persistence + 6 Phase 1/2 carryover)
- [ ] E2E tests: 11 tests (6 chat_flow + 5 gateway_mode)
- [ ] CI passes on ubuntu/macos/windows runners
- [ ] No clippy warnings (Rust)
- [ ] No ESLint errors (TypeScript)
- [ ] No TypeScript compile errors

---

## Dependencies

**Rust crates** (add to `Cargo.toml`):
```toml
mdns-sd = "0.11"
tokio = { version = "1.35", features = ["process", "time", "sync"] }
serde_json = "1.0"
reqwest = { version = "0.11", features = ["json"] }
```

**npm packages** (add to `package.json`):
```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "prism-react-renderer": "^2.3.1",
    "edwinpai": "^1.0.0"
  }
}
```

---

## Critical Path Tasks

1. ✅ **Implement `gateway.rs`** - Process management (start/stop/health)
2. ✅ **Implement `config.rs`** - Config persistence layer
3. ✅ **Build `ChatView` + `MessageBubble` + `InputBar`** - Core UI
4. ✅ **Integrate Phase 2 subscription check** - Gateway startup gating
5. ✅ **Build system tray** - Status sync, menu handling
6. ✅ **Implement mDNS advertising** - LAN discovery with TXT records
7. ✅ **Write `gateway_lifecycle.rs`** - Integration tests
8. ✅ **Write `chat_flow.spec.ts`** - E2E tests
9. ✅ **CI validation** - All platforms (ubuntu/macos/windows)

---

## Known Deviations from SPEC

### 1. EdwinPAI gateway bundled as npm dependency (not git submodule)
**Rationale**: Simpler dependency management, version pinning via `package.json`, faster CI builds
**Impact**: Low - gateway can still be updated independently via npm version bump

### 2. Chat history in localStorage (not `~/.edwinpai/chat_history.json`)
**Rationale**: Simpler implementation, no Tauri fs permission needed, 10MB localStorage limit sufficient for ~1000 messages
**Impact**: Low - can migrate to file-based storage in Phase 6 if needed

### 3. mDNS uses `mdns-sd` crate (not Tauri plugin)
**Rationale**: No official Tauri mDNS plugin, `mdns-sd` is well-maintained and cross-platform
**Impact**: None - `mdns-sd` handles all 3 platforms correctly

---

## Post-Phase 3 State

**What works**:
- ✅ Full chat interface with streaming AI responses
- ✅ Gateway runs as background service with system tray
- ✅ LAN discovery finds local gateways via mDNS
- ✅ Config persists across restarts
- ✅ Subscription check gates gateway startup (Phase 2 integration)
- ✅ Identity system used for auth (Phase 1 integration)

**What's next (Phase 4)**:
- Client mode connection to remote gateways
- Multi-user authorization (Owner/Member/Guest)
- Invitation system with QR codes
- Access control UI

---

## Validation Criteria

Phase 3 is **COMPLETE** when:
1. All 24 files written (2,687 LOC)
2. All 34 tests passing (23 Rust + 11 E2E)
3. CI green on ubuntu/macos/windows
4. Onboarding flow works end-to-end (Gateway mode → Identity → Subscription → Chat)
5. System tray displays correct status
6. Chat interface sends/receives messages with streaming
7. mDNS discovery finds local gateway from client mode
8. No ESLint/clippy/tsc errors

---

**Last updated**: 2026-02-11
**Status**: Ready to implement
**Blocked by**: None (Phase 1 & 2 complete)
**Blocks**: Phase 4 (Client Mode & Multi-User)
