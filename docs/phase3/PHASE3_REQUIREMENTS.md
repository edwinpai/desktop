# Phase 3: Gateway Mode — Requirements Document

**Status**: Planning
**Phase**: 3 of 7
**Goal**: Bundle the EdwinPAI gateway into the desktop app, run it as a background service, and implement the core chat interface.

---

## Executive Summary

Phase 3 delivers the core functionality that makes EdwinPAI Desktop a functional AI assistant: gateway process management, system tray integration, chat interface with SSE streaming, local configuration storage, mDNS advertising for LAN discovery, and complete frontend layout with routing. This phase transforms EdwinPAI from a crypto/subscription system into a usable AI assistant application.

**Critical Constraint**: Phase 3 must NOT modify any Phase 1/2 deliverables (crypto_domain, subscription code). All crypto and subscription functionality is considered frozen and production-ready.

---

## Dependencies

### Required Phases
- **Phase 1** (COMPLETE): Crypto Domain, BSV identity system, BRC-42, BRC-103 authentication
- **Phase 2** (COMPLETE): Subscription system, SPV verification, UTXO management

### External Dependencies
- External `edwinpai` binary (gateway) — NOT embedded in codebase
- `secp256k1` crate v0.29 (locked version, no upgrades)
- Tauri v2 tray API (NOT v1)
- shadcn/ui component library
- React 19 + TypeScript

---

## Task Group 1: Gateway Process Management

### 1.1 Requirements (PLAN.md §3.1 + SPEC.md §6.5)

**Goal**: Start, monitor, restart, and stop the EdwinPAI gateway as a managed child process from the Tauri shell.

#### Functionality
- Spawn `edwinpai` binary as a child process on app launch
- Gateway binds to `127.0.0.1:3117` (configurable in `~/.edwinpai/config.json`)
- Process lifecycle:
  - Start on app launch (after subscription verification passes)
  - Restart automatically on crash (max 3 retries with exponential backoff: 1s, 2s, 4s)
  - Stop gracefully on app quit (SIGTERM with 5s timeout, then SIGKILL)
- Health checks via `GET /v1/edwinpai/health` endpoint (every 30 seconds)
- Status exposed to frontend: `Running`, `Starting`, `Stopped`, `Error`, `Crashed`

#### Technical Approach
- **Tauri Command**: `start_gateway`, `stop_gateway`, `restart_gateway`, `get_gateway_status`
- **Rust Implementation**: `src-tauri/src/commands/gateway.rs`
  - Use `std::process::Command` to spawn `edwinpai` binary
  - Store child PID for lifecycle management
  - Monitor stdout/stderr for error detection
  - Parse gateway logs for startup confirmation
- **Gateway Binary Path**: Read from environment variable `EDWINPAI_GATEWAY_PATH` or default to system PATH lookup
- **Port Configuration**: Read from `~/.edwinpai/config.json` → `gatewayPort` field

#### Error Handling
| Error | Behavior |
|-------|----------|
| Binary not found | Show error dialog with instructions to install `edwinpai` npm package globally |
| Port already in use | Try port + 1, up to 5 attempts; show error if all fail |
| Crash on startup | Log error, show notification, allow manual restart |
| Max retries exceeded | Enter degraded mode, show "Gateway offline" state |

#### Files to Create/Modify
- `src-tauri/src/commands/gateway.rs` — process management logic
- `src/lib/gateway.ts` — frontend IPC wrapper
- `src/hooks/useGateway.ts` — React hook for gateway status

---

## Task Group 2: System Tray Implementation

### 2.1 Requirements (PLAN.md §3.2 + SPEC.md §6.4)

**Goal**: Integrate EdwinPAI into the system tray with status indicators, menu, and background operation.

#### Functionality
- **Tray Icon**:
  - Running: green dot overlay
  - Paused: yellow dot overlay
  - Error: red dot overlay
  - Badge: channel count (e.g., "3" for 3 connected channels)
- **Tray Menu**:
  ```
  EdwinPAI (Swift Falcon)
  ────────────────────
  ● Running
  📡 Channels: 3 connected
  🟢 Subscription: Active
  ────────────────────
  Open EdwinPAI
  Pause / Resume
  Settings
  ────────────────────
  Quit EdwinPAI
  ```
- **Behavior**:
  - App minimizes to tray instead of quitting (configurable: `minimizeToTray` in config)
  - Clicking tray icon brings window to foreground
  - Close button minimizes to tray (unless user holds Shift = force quit)

#### Technical Approach
- **Tauri v2 Tray API** (NOT v1 API):
  - Use `tauri::tray::TrayIconBuilder` from Tauri v2.1+
  - Dynamic menu updates via `tray.set_menu()`
  - Icon overlay via `tray.set_icon()`
- **Implementation**: `src-tauri/src/commands/tray.rs`
  - `build_tray_menu()` — constructs menu from app state
  - `update_tray_status(status: GatewayStatus)` — updates icon + menu
  - `update_tray_channels(count: u8)` — updates channel count badge
  - `update_tray_subscription(active: bool)` — updates subscription status
- **Pause/Resume**: Toggle gateway process running state
  - Paused: SIGSTOP to gateway process (freezes execution)
  - Resumed: SIGCONT to gateway process

#### Platform-Specific Behavior
| Platform | Icon Location | Minimize Behavior |
|----------|---------------|-------------------|
| macOS | Menu bar (top-right) | Hidden from Dock |
| Windows | System tray (bottom-right) | Hidden from taskbar |
| Linux | Panel/tray (varies by DE) | Hidden from taskbar/dock |

#### Files to Create/Modify
- `src-tauri/src/commands/tray.rs` — tray management logic
- `src-tauri/assets/icons/tray-*.png` — icon variants (running, paused, error)
- `src/components/layout/SystemTray.tsx` — frontend tray configuration
- `src/hooks/useTray.ts` — React hook for tray state

---

## Task Group 3: Chat Interface Components

### 3.1 Requirements (PLAN.md §3.3 + SPEC.md §10.1, §11.1)

**Goal**: Build a functional chat interface with OpenAI-compatible API integration and SSE streaming for real-time token display.

#### Components

**3.1.1 ChatView** (`src/components/chat/ChatView.tsx`)
- Message list (virtualized for performance, using `react-window`)
- Auto-scroll to bottom on new messages
- Loading state during streaming
- Empty state: "Ask EdwinPAI anything..."

**3.1.2 MessageBubble** (`src/components/chat/MessageBubble.tsx`)
- User messages: right-aligned, blue background
- EdwinPAI messages: left-aligned, gray background
- Markdown rendering via `react-markdown`
- Code syntax highlighting via `prism-react-renderer`
- Timestamp (relative: "2 minutes ago")
- Copy button for code blocks

**3.1.3 InputBar** (`src/components/chat/InputBar.tsx`)
- Auto-resizing textarea (max 5 lines, then scroll)
- Submit on Enter, Shift+Enter for newline
- Disabled during streaming
- Character count indicator (optional, for UX context)
- "Stop generation" button during streaming

#### API Integration

**3.1.4 OpenAI-Compatible Endpoint** (SPEC.md §10.1)
```
POST http://127.0.0.1:3117/v1/chat/completions
Headers:
  X-BSV-Identity: <publicKey>
  X-BSV-Nonce: <nonce>
  X-BSV-Signature: <signature>
Body:
{
  "model": "edwinpai",
  "messages": [
    { "role": "user", "content": "Hello EdwinPAI" }
  ],
  "stream": true
}

Response (SSE):
data: {"id":"msg_1","choices":[{"delta":{"content":"Hi"},"index":0}]}
data: {"id":"msg_1","choices":[{"delta":{"content":" there"},"index":0}]}
data: [DONE]
```

**3.1.5 SSE Streaming Implementation**
- Use `EventSource` API for SSE connection
- Parse `data:` lines as JSON chunks
- Accumulate `delta.content` into message buffer
- Render partial message in real-time
- Close stream on `[DONE]` event

#### Message History Storage

**3.1.6 Local Storage** (PLAN.md §3.3)
- Path: `~/.edwinpai/chat_history.json`
- Format:
  ```json
  {
    "conversations": [
      {
        "id": "conv_1",
        "createdAt": "2026-02-11T10:00:00Z",
        "messages": [
          { "role": "user", "content": "...", "timestamp": "..." },
          { "role": "assistant", "content": "...", "timestamp": "..." }
        ]
      }
    ]
  }
  ```
- Max 1000 messages per conversation (rolling window)
- Load on app startup, write after each message

#### Technical Approach
- **API Client**: `src/lib/gateway.ts` — `sendChatMessage(content: string, onChunk: (token: string) => void)`
- **State Management**: React `useState` for message list, streaming state
- **Virtualization**: `react-window` for message list (handles 1000+ messages)
- **Markdown**: `react-markdown` + `remark-gfm` (GitHub-flavored markdown)

#### Files to Create/Modify
- `src/components/chat/ChatView.tsx`
- `src/components/chat/MessageBubble.tsx`
- `src/components/chat/InputBar.tsx`
- `src/lib/gateway.ts` — API client with SSE
- `src/hooks/useChat.ts` — chat state management
- `src/types/chat.ts` — message types

---

## Task Group 4: Configuration Storage

### 4.1 Requirements (PLAN.md §3.4 + SPEC.md §6.5)

**Goal**: Store and retrieve app configuration in `~/.edwinpai/config.json` via Tauri `fs` plugin.

#### Configuration Schema

```json
{
  "version": "1.0.0",
  "mode": "gateway",
  "gatewayPort": 3117,
  "gatewayUrl": null,
  "theme": "system",
  "minimizeToTray": true,
  "startOnLogin": false,
  "subscriptionCheckInterval": 3600,
  "preferences": {
    "notifications": true,
    "soundEffects": false,
    "autoUpdate": true
  }
}
```

#### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | string | "1.0.0" | Config schema version |
| `mode` | `"gateway" \| "client"` | "gateway" | Operating mode |
| `gatewayPort` | number | 3117 | Port for gateway to bind (gateway mode) |
| `gatewayUrl` | string \| null | null | Remote gateway URL (client mode) |
| `theme` | `"light" \| "dark" \| "system"` | "system" | UI theme |
| `minimizeToTray` | boolean | true | Minimize to tray instead of quit |
| `startOnLogin` | boolean | false | Launch on OS login |
| `subscriptionCheckInterval` | number | 3600 | Seconds between checks (1 hour) |
| `preferences.notifications` | boolean | true | Enable desktop notifications |
| `preferences.soundEffects` | boolean | false | Enable UI sounds |
| `preferences.autoUpdate` | boolean | true | Auto-download updates |

#### Technical Approach
- **Tauri Commands**: `read_config`, `write_config`, `update_config_field`
- **Rust Implementation**: `src-tauri/src/commands/config.rs`
  - Use `serde_json` for serialization
  - Create `~/.edwinpai/` directory if missing
  - Atomic writes via temp file + rename (prevents corruption)
- **Frontend Wrapper**: `src/lib/config.ts`
  ```typescript
  export const config = {
    read: async () => invoke<Config>('read_config'),
    write: async (cfg: Config) => invoke('write_config', { config: cfg }),
    update: async (key: string, value: any) => invoke('update_config_field', { key, value })
  }
  ```

#### Files to Create/Modify
- `src-tauri/src/commands/config.rs` — config read/write logic
- `src/lib/config.ts` — frontend wrapper
- `src/types/config.ts` — TypeScript config schema
- `src/stores/appStore.ts` — global config state (Zustand store)

---

## Task Group 5: mDNS Advertising

### 5.1 Requirements (PLAN.md §3.5 + SPEC.md §10.2)

**Goal**: Advertise EdwinPAI gateway on the local network via mDNS for zero-configuration client discovery.

#### Functionality
- Service type: `_edwinpai._tcp.local`
- Port: Read from `config.gatewayPort` (default 3117)
- TXT records:
  - `pubkey=<first 16 hex chars of public key>`
  - `version=<app version from package.json>`
  - `petname=<URL-encoded petname>`
- Lifecycle:
  - Start advertising when gateway starts (gateway mode only)
  - Stop advertising when app quits or pauses
  - Update TXT records if identity changes (rare, but handle for robustness)

#### Technical Approach
- **Crate**: `mdns-sd` v0.11+ (cross-platform mDNS library)
- **Implementation**: `src-tauri/src/commands/discovery.rs`
  ```rust
  use mdns_sd::{ServiceDaemon, ServiceInfo};

  pub fn advertise_gateway(port: u16, pubkey: &str, version: &str, petname: &str) -> Result<(), String> {
      let mdns = ServiceDaemon::new()?;
      let service_type = "_edwinpai._tcp.local.";
      let instance_name = format!("EdwinPAI-{}", &pubkey[0..8]);
      let host_name = format!("{}.local.", hostname::get()?.to_str().unwrap());

      let properties = [
          ("pubkey", &pubkey[0..16]),
          ("version", version),
          ("petname", petname),
      ];

      let service_info = ServiceInfo::new(
          service_type,
          &instance_name,
          &host_name,
          "",
          port,
          &properties[..],
      )?;

      mdns.register(service_info)?;
      Ok(())
  }
  ```
- **Tauri Command**: `start_mdns_advertising`, `stop_mdns_advertising`

#### Discovery (Client Mode)
- **Browse**: `mdns.browse("_edwinpai._tcp.local.")`
- **Parse Results**:
  ```typescript
  interface DiscoveredGateway {
    name: string;          // "EdwinPAI-a3f7b2c1"
    address: string;       // "192.168.1.100"
    port: number;          // 3117
    pubkey: string;        // "a3f7b2c1..." (first 16 chars)
    version: string;       // "1.0.0"
    petname: string;       // "Swift Falcon"
  }
  ```
- **Timeout**: 5-second scan, return all discovered gateways

#### Files to Create/Modify
- `src-tauri/src/commands/discovery.rs` — mDNS advertising + browsing
- `src/lib/discovery.ts` — frontend wrapper
- `src/hooks/useDiscovery.ts` — React hook for LAN scanning
- `src/components/onboarding/GatewayConnect.tsx` — display discovered gateways

---

## Task Group 6: Tauri Command Registration

### 6.1 Requirements

**Goal**: Register all Phase 3 Tauri commands for IPC between React frontend and Rust backend.

#### Commands to Register

**Gateway Process Management**
- `start_gateway(port: u16) -> Result<String, String>` — returns PID or error
- `stop_gateway() -> Result<(), String>`
- `restart_gateway() -> Result<String, String>`
- `get_gateway_status() -> GatewayStatus` — enum: Running, Starting, Stopped, Error, Crashed
- `get_gateway_logs(lines: u32) -> Vec<String>` — last N lines of stdout/stderr

**System Tray**
- `update_tray_status(status: GatewayStatus) -> Result<(), String>`
- `update_tray_channels(count: u8) -> Result<(), String>`
- `update_tray_subscription(active: bool) -> Result<(), String>`
- `set_minimize_to_tray(enabled: bool) -> Result<(), String>`

**Configuration**
- `read_config() -> Result<Config, String>`
- `write_config(config: Config) -> Result<(), String>`
- `update_config_field(key: String, value: serde_json::Value) -> Result<(), String>`
- `get_config_path() -> String` — returns `~/.edwinpai/config.json` path

**mDNS Discovery**
- `start_mdns_advertising() -> Result<(), String>`
- `stop_mdns_advertising() -> Result<(), String>`
- `discover_gateways(timeout_secs: u8) -> Vec<DiscoveredGateway>`

**Health Checks**
- `ping_gateway() -> Result<bool, String>` — calls `GET /v1/edwinpai/health`

#### Registration in `main.rs`

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Gateway commands
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::restart_gateway,
            commands::gateway::get_gateway_status,
            commands::gateway::get_gateway_logs,
            // Tray commands
            commands::tray::update_tray_status,
            commands::tray::update_tray_channels,
            commands::tray::update_tray_subscription,
            commands::tray::set_minimize_to_tray,
            // Config commands
            commands::config::read_config,
            commands::config::write_config,
            commands::config::update_config_field,
            commands::config::get_config_path,
            // Discovery commands
            commands::discovery::start_mdns_advertising,
            commands::discovery::stop_mdns_advertising,
            commands::discovery::discover_gateways,
            // Health commands
            commands::health::ping_gateway,
        ])
        .setup(|app| {
            // Initialize tray
            commands::tray::setup_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### Files to Create/Modify
- `src-tauri/src/main.rs` — command registration
- `src-tauri/src/commands/mod.rs` — module exports
- All command module files (gateway.rs, tray.rs, config.rs, discovery.rs, health.rs)

---

## Task Group 7: App Layout with Navigation Routing

### 7.1 Requirements (SPEC.md §6.2, §11)

**Goal**: Build the main application layout with sidebar navigation, top bar, and routing between screens.

#### Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ TopBar (Identity Badge + Status Indicators)                      │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  Sidebar   │                  Main Content Area                  │
│            │              (React Router Outlet)                  │
│  - Chat    │                                                     │
│  - Channels│                                                     │
│  - Settings│                                                     │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

#### Components

**7.1.1 TopBar** (`src/components/layout/TopBar.tsx`)
- Left: App title "EdwinPAI"
- Right:
  - Identity badge (petname + avatar + short ID) — click to copy public key
  - Subscription status indicator (green = active, yellow = cached, red = expired)
  - Gateway status indicator (green = running, gray = stopped, red = error)
  - Settings icon (click to open settings)

**7.1.2 Sidebar** (`src/components/layout/Sidebar.tsx`)
- Navigation items:
  - 💬 Chat
  - 📡 Channels (with count badge)
  - ⚙️ Settings
- Active item highlighted (border + background color)
- Collapsible on small screens (hamburger menu)

**7.1.3 Layout** (`src/components/layout/Layout.tsx`)
- Container for TopBar + Sidebar + content area
- Uses CSS Grid for responsive layout
- Handles window resize, tray minimize

#### Routing

**7.1.4 Routes** (`src/App.tsx`)
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" />} />
          <Route path="/chat" element={<ChatView />} />
          <Route path="/channels" element={<ChannelList />} />
          <Route path="/settings" element={<SettingsView />}>
            <Route index element={<GeneralSettings />} />
            <Route path="identity" element={<IdentitySettings />} />
            <Route path="subscription" element={<SubscriptionSettings />} />
            <Route path="access" element={<AccessControl />} />
          </Route>
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

**7.1.5 Settings Tabs** (`src/components/settings/SettingsView.tsx`)
- Tab navigation: General | Identity | Subscription | Access Control
- Each tab renders a sub-component
- Use `react-router-dom` nested routes

#### Files to Create/Modify
- `src/App.tsx` — main router
- `src/components/layout/Layout.tsx`
- `src/components/layout/TopBar.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/settings/SettingsView.tsx`
- `src/components/settings/GeneralSettings.tsx`
- `src/components/settings/IdentitySettings.tsx`
- `src/components/settings/SubscriptionSettings.tsx`
- `src/components/settings/AccessControl.tsx` (placeholder for Phase 4)

---

## Task Group 8: Test Suite

### 8.1 Requirements (PLAN.md §6.5)

**Goal**: Comprehensive test coverage for Phase 3 functionality.

#### Rust Unit Tests

**8.1.1 Gateway Process Management** (`src-tauri/src/commands/gateway.rs`)
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_start_gateway_success() {
        // Mock gateway binary, verify PID returned
    }

    #[test]
    fn test_stop_gateway_graceful() {
        // Start gateway, stop, verify SIGTERM sent
    }

    #[test]
    fn test_restart_on_crash() {
        // Simulate crash, verify restart logic
    }

    #[test]
    fn test_health_check_timeout() {
        // Simulate unresponsive gateway, verify timeout
    }
}
```

**8.1.2 Configuration** (`src-tauri/src/commands/config.rs`)
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_config_default() {
        // No config file, verify defaults
    }

    #[test]
    fn test_write_config_atomic() {
        // Write config, verify file atomicity (temp + rename)
    }

    #[test]
    fn test_update_config_field() {
        // Update single field, verify others unchanged
    }
}
```

**8.1.3 mDNS Discovery** (`src-tauri/src/commands/discovery.rs`)
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_advertise_gateway() {
        // Start advertising, verify service registered
    }

    #[test]
    fn test_discover_gateways_timeout() {
        // Browse with timeout, verify results returned
    }
}
```

#### Frontend Tests (Vitest)

**8.1.4 Chat Components** (`src/components/chat/__tests__/ChatView.test.tsx`)
```typescript
import { render, screen } from '@testing-library/react';
import { ChatView } from '../ChatView';

describe('ChatView', () => {
  test('renders empty state', () => {
    render(<ChatView />);
    expect(screen.getByText('Ask EdwinPAI anything...')).toBeInTheDocument();
  });

  test('displays messages', () => {
    const messages = [
      { role: 'user', content: 'Hello', timestamp: '2026-02-11T10:00:00Z' },
      { role: 'assistant', content: 'Hi there', timestamp: '2026-02-11T10:00:05Z' },
    ];
    render(<ChatView messages={messages} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  test('handles SSE streaming', async () => {
    // Mock EventSource, verify incremental rendering
  });
});
```

**8.1.5 Gateway API Client** (`src/lib/__tests__/gateway.test.ts`)
```typescript
import { sendChatMessage } from '../gateway';

describe('Gateway API Client', () => {
  test('sends chat message with auth headers', async () => {
    // Mock fetch, verify X-BSV-* headers
  });

  test('handles SSE streaming', async () => {
    // Mock EventSource, verify onChunk callbacks
  });

  test('retries on network error', async () => {
    // Mock network failure, verify exponential backoff
  });
});
```

**8.1.6 Configuration Store** (`src/stores/__tests__/appStore.test.ts`)
```typescript
import { appStore } from '../appStore';

describe('App Store', () => {
  test('loads config on init', async () => {
    // Mock read_config, verify store populated
  });

  test('updates config field', async () => {
    // Update field, verify invoke called
  });
});
```

#### Test Coverage Goals
- **Rust backend**: >80% line coverage
- **Frontend**: >60% line coverage
- **Critical paths**: 100% coverage (gateway lifecycle, auth headers, SSE streaming)

#### Files to Create
- `src-tauri/src/commands/gateway.rs` (unit tests)
- `src-tauri/src/commands/config.rs` (unit tests)
- `src-tauri/src/commands/discovery.rs` (unit tests)
- `src/components/chat/__tests__/ChatView.test.tsx`
- `src/components/chat/__tests__/MessageBubble.test.tsx`
- `src/components/chat/__tests__/InputBar.test.tsx`
- `src/lib/__tests__/gateway.test.ts`
- `src/lib/__tests__/config.test.ts`
- `src/stores/__tests__/appStore.test.ts`

---

## Constraints & Locked Dependencies

### Hard Constraints

1. **No Modifications to Phase 1/2 Code**:
   - `src-tauri/src/crypto_domain/` — FROZEN (10 modules, 58 tests)
   - All BRC-42, BRC-103, subscription, SPV code is production-ready
   - Phase 3 code must NOT touch crypto_domain imports or logic

2. **Locked Dependencies**:
   - `secp256k1` crate v0.29 — NO UPGRADES (crypto dependency freeze)
   - Tauri v2 API (NOT v1) — use `tauri::tray::TrayIconBuilder`, not legacy API
   - shadcn/ui for ALL UI components — no custom component libraries

3. **External Gateway Binary**:
   - EdwinPAI gateway is NOT embedded in the codebase
   - Spawned as external process via `std::process::Command`
   - Path: environment variable `EDWINPAI_GATEWAY_PATH` or system PATH

4. **Platform Support**:
   - All functionality must work on Linux, macOS, Windows
   - Tray API must handle platform-specific behavior (see Task Group 2)

### Recommended Dependencies

**Rust** (add to `src-tauri/Cargo.toml`):
```toml
[dependencies]
mdns-sd = "0.11"
hostname = "0.4"
```

**Frontend** (add to `package.json`):
```json
{
  "dependencies": {
    "react-router-dom": "^6.22.0",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "prism-react-renderer": "^2.3.1",
    "react-window": "^1.8.10",
    "zustand": "^4.5.0"
  }
}
```

---

## File Inventory

### Rust Backend (src-tauri/src/)

**New Files**:
- `commands/gateway.rs` — gateway process management (250 LOC)
- `commands/tray.rs` — system tray integration (180 LOC)
- `commands/config.rs` — configuration storage (120 LOC)
- `commands/discovery.rs` — mDNS advertising + browsing (200 LOC)
- `commands/health.rs` — health check utilities (50 LOC)
- `commands/mod.rs` — module exports (30 LOC)

**Modified Files**:
- `main.rs` — command registration, tray setup (add ~50 LOC)

**Total Rust LOC**: ~880 lines (excluding tests)

### Frontend (src/)

**New Files**:
- `components/chat/ChatView.tsx` (180 LOC)
- `components/chat/MessageBubble.tsx` (80 LOC)
- `components/chat/InputBar.tsx` (120 LOC)
- `components/layout/Layout.tsx` (60 LOC)
- `components/layout/TopBar.tsx` (100 LOC)
- `components/layout/Sidebar.tsx` (90 LOC)
- `components/settings/SettingsView.tsx` (70 LOC)
- `components/settings/GeneralSettings.tsx` (150 LOC)
- `components/settings/IdentitySettings.tsx` (80 LOC)
- `components/settings/SubscriptionSettings.tsx` (100 LOC)
- `lib/gateway.ts` — API client (200 LOC)
- `lib/config.ts` — config wrapper (60 LOC)
- `lib/discovery.ts` — discovery wrapper (80 LOC)
- `hooks/useGateway.ts` (70 LOC)
- `hooks/useChat.ts` (100 LOC)
- `hooks/useTray.ts` (50 LOC)
- `hooks/useDiscovery.ts` (60 LOC)
- `stores/appStore.ts` — Zustand store (120 LOC)
- `types/chat.ts` (40 LOC)
- `types/config.ts` (50 LOC)
- `types/gateway.ts` (30 LOC)

**Modified Files**:
- `App.tsx` — add router (add ~80 LOC)

**Total Frontend LOC**: ~1,800 lines (excluding tests)

### Test Files

**Rust Tests** (embedded in modules):
- `gateway.rs` tests (100 LOC)
- `config.rs` tests (80 LOC)
- `discovery.rs` tests (60 LOC)

**Frontend Tests**:
- `__tests__/ChatView.test.tsx` (120 LOC)
- `__tests__/MessageBubble.test.tsx` (60 LOC)
- `__tests__/InputBar.test.tsx` (80 LOC)
- `__tests__/gateway.test.ts` (100 LOC)
- `__tests__/config.test.ts` (60 LOC)
- `__tests__/appStore.test.ts` (80 LOC)

**Total Test LOC**: ~740 lines

### Total Phase 3 LOC Estimate
- **Rust**: 880 LOC (production) + 240 LOC (tests) = 1,120 LOC
- **Frontend**: 1,800 LOC (production) + 500 LOC (tests) = 2,300 LOC
- **Grand Total**: ~3,420 LOC

---

## Milestone Criteria

Phase 3 is complete when:

1. ✅ EdwinPAI gateway runs as a background service inside the Tauri app
2. ✅ Gateway starts on app launch, restarts on crash, stops on quit
3. ✅ System tray integration works on all 3 platforms with correct lifecycle
4. ✅ Chat interface sends messages and receives SSE streaming responses
5. ✅ Message history persists in `~/.edwinpai/chat_history.json`
6. ✅ Configuration stored in `~/.edwinpai/config.json`, editable in settings UI
7. ✅ Gateway advertises via mDNS, discoverable by client mode instances
8. ✅ All Tauri commands registered and callable from frontend
9. ✅ App layout with sidebar navigation and routing works
10. ✅ Test suite passes: Rust unit tests + frontend vitest tests
11. ✅ CI pipeline green: lint → typecheck → test → build on all platforms
12. ✅ No modifications to Phase 1/2 crypto_domain or subscription code

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Gateway binary not found on PATH | Medium | High | Clear error message with install instructions; env var fallback |
| Port conflict (3117 already in use) | Medium | Medium | Try ports 3118-3122, show conflict error if all fail |
| mDNS blocked by firewall | Low | Medium | Fallback to manual URL entry; show firewall instructions |
| SSE connection drops during streaming | Medium | Low | Auto-reconnect with exponential backoff; show "reconnecting" state |
| Tray icon rendering issues on Linux | Medium | Low | Test on Ubuntu/Fedora/Arch; fallback to window-based UI if tray unavailable |
| Gateway crashes exceed retry limit | Low | Medium | Show "Gateway offline" state; allow manual restart button |

---

## Next Steps (Phase 4 Preview)

Phase 3 delivers Gateway mode (single-user, local). Phase 4 adds:
- **Client Mode**: Connect to remote gateway over HTTP
- **LAN Discovery**: Browse for gateways on local network
- **Multi-User Authorization**: Owner/Member/Guest permission levels
- **Invitation System**: QR codes + deep links for access grants

Phase 4 will extend (not modify) Phase 3 components:
- `GatewayConnect.tsx` (client mode) uses `discover_gateways` from Phase 3
- `AccessControl.tsx` (user management) builds on Phase 3 settings layout
- Multi-user auth requires NO changes to Phase 1/2 crypto code (BRC-103 already handles it)

---

**End of Phase 3 Requirements Document**
