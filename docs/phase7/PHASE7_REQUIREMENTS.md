# Phase 7 Requirements: AI Integration & Production Deployment

**Version:** 1.0
**Date:** 2026-02-12
**Status:** Implementation Ready
**Dependencies:** Phases 0-6 Complete

---

## 1. Gateway API Contract

### 1.1 Functional Requirements

**REQ-7.1.1**: Gateway REST API must expose all endpoints defined in SPEC §8.1-8.9
- **Acceptance Criteria**:
  - All 27 endpoints respond with correct status codes (200/201/400/401/403/404/500)
  - Request/response schemas match `types/api.ts` type definitions
  - CORS enabled for `tauri://localhost` origin
  - Error responses include `error_code` and `message` fields per §8.10

**REQ-7.1.2**: Server-Sent Events (SSE) streaming for chat completions
- **Acceptance Criteria**:
  - `/api/chat/completions` endpoint accepts `stream: true` parameter
  - SSE events use `data:` prefix with JSON payload per §8.2
  - Events: `chunk` (token), `tool_call` (structured), `done` (final metadata)
  - Client receives events <100ms latency on localhost
  - Graceful error handling with `error` event type

**REQ-7.1.3**: BRC-103 authentication flow for client connections
- **Acceptance Criteria**:
  - Initial connection validates `pubkey` against authorized users (Phase 4)
  - Nonce challenge uses 32-byte random hex string
  - Signature verification delegates to `crypto_domain/signing.rs` (Phase 1)
  - Session token valid for 24 hours, stored in-memory HashMap
  - Unauthorized requests return 401 with `UNAUTHORIZED` error code

**REQ-7.1.4**: Chat history persistence via gateway API
- **Acceptance Criteria**:
  - `POST /api/chat/history` saves messages to SQLite database
  - `GET /api/chat/history` returns paginated results (limit=50 default)
  - Filters: `user_id`, `start_date`, `end_date` query parameters
  - Database migration creates `chat_history` table with schema per §8.2
  - Encrypted storage option using BRC-42 (Phase 1) for PII compliance

### 1.2 Type/Contract References

```typescript
// types/api.ts - Gateway REST API Types (Phase 3+4 baseline)
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion" | "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: TokenUsage;
}

export interface SSEEvent {
  event: "chunk" | "tool_call" | "done" | "error";
  data: string; // JSON-encoded payload
}

export interface BRC103AuthRequest {
  pubkey: string; // 66-char hex (compressed secp256k1)
  nonce?: string; // Server-provided challenge
  signature?: string; // DER-encoded ECDSA signature
}

export interface SessionToken {
  token: string; // 64-char hex
  expires_at: number; // Unix timestamp
  user_id: string; // Petname from Phase 4
}

export interface ChatHistoryEntry {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

### 1.3 Integration Points

- **Phase 1 (Crypto Domain)**:
  - BRC-103 signature verification: `VerifyRequest` IPC command
  - Session token storage: BRC-42 encryption with `keyID="session-tokens"`

- **Phase 2 (SPV)**:
  - Transaction verification for BSV-based authentication
  - BUMP proofs for subscription validation

- **Phase 3 (Gateway Mode)**:
  - Gateway process lifecycle: `start_gateway` command spawns HTTP server
  - Health checks: `/api/health` endpoint polled every 5s by system tray

- **Phase 4 (Multi-User)**:
  - User authorization: `check_permission` query before API requests
  - Invitation redemption: `POST /api/auth/redeem` endpoint

- **Phase 5 (Channels)**:
  - Channel configuration read from encrypted config files
  - Tool calls route to channel-specific handlers

### 1.4 SPEC Cross-References

- **§8.1**: Gateway HTTP server requirements (port 3000, localhost-only binding)
- **§8.2**: Chat completions endpoint specification (SSE format, tool calling)
- **§8.3**: Identity endpoints (`/api/identity/petname`, `/api/identity/avatar`)
- **§8.4**: Subscription endpoints (`/api/subscription/check`, `/api/subscription/renew`)
- **§8.10**: Error code taxonomy (15 codes: INVALID_REQUEST, UNAUTHORIZED, etc.)

### 1.5 Test Scenarios

**TS-7.1.1**: Basic chat completion (non-streaming)
```rust
#[tokio::test]
async fn test_chat_completion_basic() {
    let response = client
        .post("http://localhost:3000/api/chat/completions")
        .json(&ChatCompletionRequest {
            model: "gpt-4".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            stream: Some(false),
        })
        .send()
        .await?;

    assert_eq!(response.status(), 200);
    let body: ChatCompletionResponse = response.json().await?;
    assert_eq!(body.object, "chat.completion");
    assert!(!body.choices.is_empty());
}
```

**TS-7.1.2**: SSE streaming with tool calls
```typescript
// e2e/gateway-api.spec.ts
test('SSE streaming with tool calls', async ({ page }) => {
  const events: SSEEvent[] = [];

  await page.goto('http://localhost:3000/api/chat/completions?stream=true');
  const eventSource = new EventSource('/api/chat/completions');

  eventSource.onmessage = (event) => {
    events.push(JSON.parse(event.data));
  };

  await page.waitForTimeout(5000);

  expect(events).toContainEqual({ event: 'chunk', data: expect.any(String) });
  expect(events).toContainEqual({ event: 'tool_call', data: expect.any(Object) });
  expect(events[events.length - 1].event).toBe('done');
});
```

**TS-7.1.3**: BRC-103 authentication flow
```rust
#[tokio::test]
async fn test_brc103_auth_flow() {
    // Step 1: Initial request
    let init_response = client.post("/api/auth/challenge")
        .json(&BRC103AuthRequest { pubkey: "02abc123...".to_string(), nonce: None, signature: None })
        .send().await?;
    let nonce: String = init_response.json::<Value>().await?["nonce"].as_str().unwrap().to_string();

    // Step 2: Sign nonce
    let signature = sign_message(&nonce, &private_key)?;

    // Step 3: Verify signature
    let verify_response = client.post("/api/auth/verify")
        .json(&BRC103AuthRequest { pubkey: "02abc123...".to_string(), nonce: Some(nonce), signature: Some(signature) })
        .send().await?;

    assert_eq!(verify_response.status(), 200);
    let session: SessionToken = verify_response.json().await?;
    assert_eq!(session.token.len(), 64);
}
```

**TS-7.1.4**: Chat history pagination
```rust
#[tokio::test]
async fn test_chat_history_pagination() {
    // Insert 100 messages
    for i in 0..100 {
        client.post("/api/chat/history")
            .json(&ChatHistoryEntry { content: format!("Message {}", i), ..Default::default() })
            .send().await?;
    }

    // Fetch first page
    let page1 = client.get("/api/chat/history?limit=50&offset=0").send().await?.json::<Vec<ChatHistoryEntry>>().await?;
    assert_eq!(page1.len(), 50);

    // Fetch second page
    let page2 = client.get("/api/chat/history?limit=50&offset=50").send().await?.json::<Vec<ChatHistoryEntry>>().await?;
    assert_eq!(page2.len(), 50);
    assert_ne!(page1[0].id, page2[0].id);
}
```

---

## 2. Config Schema & Persistence

### 2.1 Functional Requirements

**REQ-7.2.1**: Gateway config file must store all user preferences
- **Acceptance Criteria**:
  - JSON schema matches `GatewayConfig` type in `types/api.ts`
  - Atomic writes via temp file + rename (Phase 3 pattern)
  - Platform-specific paths: `$XDG_CONFIG_HOME/edwinpai/gateway.json` (Linux), `~/Library/Application Support/com.edwinpai.desktop/gateway.json` (macOS), `%APPDATA%\edwinpai\gateway.json` (Windows)
  - File permissions: 0600 (owner read/write only)
  - Validation on load with schema version migration

**REQ-7.2.2**: AI provider credentials storage
- **Acceptance Criteria**:
  - API keys encrypted using BRC-42 with `keyID="ai-provider-{provider_name}"`
  - Supported providers: OpenAI, Anthropic, OpenRouter, Local (Ollama/LMStudio)
  - Schema fields: `provider`, `api_key_encrypted`, `base_url`, `model`, `temperature`, `max_tokens`
  - Key rotation: `update_api_key` command re-encrypts with new nonce
  - Validation: API key format regex per provider (e.g., `sk-[A-Za-z0-9]{48}` for OpenAI)

**REQ-7.2.3**: Config versioning and migration
- **Acceptance Criteria**:
  - Config file includes `version` field (current: `2`)
  - Migration functions: `migrate_v1_to_v2`, `migrate_v2_to_v3`, etc.
  - Backwards compatibility: v1 configs auto-migrate on first load
  - Migration logs stored in audit log (Phase 1 pattern)
  - Rollback support: backup created before migration

### 2.2 Type/Contract References

```typescript
// types/api.ts - Config Schema
export interface GatewayConfig {
  version: number; // Current: 2
  identity: {
    petname: string;
    avatar_seed?: string;
  };
  ai_provider: AIProviderConfig;
  gateway: {
    port: number; // Default: 3000
    host: string; // Default: "127.0.0.1"
    cors_origins: string[];
  };
  channels: {
    enabled_platforms: Platform[];
    default_channel?: string;
  };
  subscription: {
    cached_status?: SubscriptionStatus;
    last_check?: number; // Unix timestamp
  };
  preferences: {
    theme: "light" | "dark" | "system";
    minimize_to_tray: boolean;
    auto_start_gateway: boolean;
  };
}

export interface AIProviderConfig {
  provider: "openai" | "anthropic" | "openrouter" | "local";
  api_key_encrypted?: string; // Hex-encoded BRC-42 ciphertext
  base_url?: string; // For local providers (e.g., http://localhost:11434)
  model: string; // e.g., "gpt-4-turbo", "claude-sonnet-4.5"
  temperature?: number; // 0.0-2.0, default 0.7
  max_tokens?: number; // Default 4096
}
```

**JSON Example** (`gateway.json`):
```json
{
  "version": 2,
  "identity": {
    "petname": "friendly_falcon_42",
    "avatar_seed": "8f3a9b2c..."
  },
  "ai_provider": {
    "provider": "anthropic",
    "api_key_encrypted": "04a1b2c3...",
    "model": "claude-sonnet-4.5",
    "temperature": 0.7,
    "max_tokens": 8192
  },
  "gateway": {
    "port": 3000,
    "host": "127.0.0.1",
    "cors_origins": ["tauri://localhost"]
  },
  "channels": {
    "enabled_platforms": ["whatsapp", "telegram"],
    "default_channel": "personal_whatsapp"
  },
  "subscription": {
    "cached_status": "Active",
    "last_check": 1707753600
  },
  "preferences": {
    "theme": "dark",
    "minimize_to_tray": true,
    "auto_start_gateway": false
  }
}
```

### 2.3 Integration Points

- **Phase 1 (Crypto Domain)**:
  - API key encryption: `EncryptRequest { protocol_id: "ai-provider-config", key_id: provider_name, plaintext }`
  - Decryption on gateway startup: `DecryptRequest` IPC command

- **Phase 3 (Config Persistence)**:
  - Reuse `config.rs` module (Phase 3) for file I/O
  - Extend `Config` struct with `ai_provider` field
  - Migration: `migrate_config` function handles v1→v2→v3 chain

- **Phase 4 (Multi-User)**:
  - Per-user configs stored in `~/.edwinpai/users/{user_id}/gateway.json`
  - Owner-only write permissions enforced via `check_permission("config:write")`

- **Phase 5 (Channels)**:
  - Channel list populated from `channels.enabled_platforms` array
  - Default channel used for unspecified tool calls

### 2.4 SPEC Cross-References

- **§7.1**: Config file location and structure
- **§7.2**: API provider credential management
- **§9.7**: AI provider integration (OpenAI, Anthropic, OpenRouter)
- **§9.8**: Channel configuration schema

### 2.5 Test Scenarios

**TS-7.2.1**: Config load and validation
```rust
#[test]
fn test_config_load_valid() {
    let config_path = PathBuf::from("test_fixtures/valid_config.json");
    let config = Config::load(&config_path).unwrap();

    assert_eq!(config.version, 2);
    assert_eq!(config.ai_provider.provider, "anthropic");
    assert!(config.ai_provider.api_key_encrypted.is_some());
}

#[test]
fn test_config_load_invalid_schema() {
    let config_path = PathBuf::from("test_fixtures/invalid_config.json");
    let result = Config::load(&config_path);

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Invalid schema"));
}
```

**TS-7.2.2**: API key encryption/decryption
```rust
#[tokio::test]
async fn test_api_key_encryption() {
    let plaintext_key = "sk-1234567890abcdef...";

    // Encrypt
    let encrypt_req = EncryptRequest {
        protocol_id: "ai-provider-config".to_string(),
        key_id: "anthropic".to_string(),
        plaintext: plaintext_key.to_string(),
    };
    let encrypted = encrypt_data(encrypt_req).await?;

    // Decrypt
    let decrypt_req = DecryptRequest {
        protocol_id: "ai-provider-config".to_string(),
        key_id: "anthropic".to_string(),
        ciphertext: encrypted,
    };
    let decrypted = decrypt_data(decrypt_req).await?;

    assert_eq!(decrypted, plaintext_key);
}
```

**TS-7.2.3**: Config migration v1 → v2
```rust
#[test]
fn test_config_migration_v1_to_v2() {
    let v1_config = r#"{
        "version": 1,
        "petname": "old_user",
        "api_key": "sk-plaintext-key"
    }"#;

    let migrated = migrate_v1_to_v2(v1_config).unwrap();

    assert_eq!(migrated.version, 2);
    assert_eq!(migrated.identity.petname, "old_user");
    assert!(migrated.ai_provider.api_key_encrypted.is_some());
    assert_ne!(migrated.ai_provider.api_key_encrypted.unwrap(), "sk-plaintext-key"); // Should be encrypted
}
```

---

## 3. Gateway Lifecycle Management

### 3.1 Functional Requirements

**REQ-7.3.1**: Gateway binary detection and validation
- **Acceptance Criteria**:
  - Detect bundled gateway binary in `resources/` directory (production) or `../gateway/target/release/` (development)
  - Verify binary hash against known-good checksum (SHA256)
  - Platform-specific binary names: `edwinpai-gateway` (Linux/macOS), `edwinpai-gateway.exe` (Windows)
  - Executable permission check: ensure binary has `+x` flag (Unix)
  - Fallback to system PATH if bundled binary missing (development mode)

**REQ-7.3.2**: Gateway process spawning and monitoring
- **Acceptance Criteria**:
  - Spawn gateway via `tokio::process::Command` (Phase 3 pattern)
  - Environment variables: `EDWINPAI_MODE=gateway`, `EDWINPAI_CONFIG_PATH=<path>`, `RUST_LOG=info`
  - Process ID stored in `gateway_process.pid` file for crash recovery
  - Health polling: send `/api/health` request every 5s
  - Auto-restart on crash (max 3 retries in 60s window)
  - Startup timeout: fail if health check doesn't succeed within 10s

**REQ-7.3.3**: Graceful shutdown sequence
- **Acceptance Criteria**:
  - SIGTERM signal sent to gateway process
  - Wait up to 10s for graceful shutdown (increased from Phase 3's 5s)
  - SIGKILL if not terminated after timeout
  - Close all active SSE connections before shutdown
  - Flush chat history database writes
  - System tray icon updates to "Stopped" state

**REQ-7.3.4**: Error handling and diagnostics
- **Acceptance Criteria**:
  - Gateway stderr/stdout captured to log file (`~/.edwinpai/gateway.log`)
  - Log rotation: max 10 MB per file, keep 5 recent files
  - Error codes: `GATEWAY_SPAWN_FAILED`, `GATEWAY_HEALTH_CHECK_FAILED`, `GATEWAY_CRASHED`
  - Crash dump: save last 100 log lines to `~/.edwinpai/crash_dump.txt`
  - User notification via system tray tooltip on failures

### 3.2 Type/Contract References

```rust
// src-tauri/src/gateway_domain/lifecycle.rs
#[derive(Debug, Clone)]
pub struct GatewayBinary {
    pub path: PathBuf,
    pub version: String,
    pub checksum: String, // SHA256 hex
}

#[derive(Debug, Clone)]
pub struct GatewayProcess {
    pub pid: u32,
    pub status: ProcessStatus,
    pub started_at: i64, // Unix timestamp
    pub last_health_check: Option<i64>,
    pub restart_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProcessStatus {
    Starting,
    Running,
    Stopping,
    Stopped,
    Crashed,
}

#[derive(Debug)]
pub struct HealthCheckResponse {
    pub status: String, // "ok" | "degraded" | "down"
    pub uptime: u64, // Seconds
    pub version: String,
    pub active_connections: u32,
}
```

### 3.3 Integration Points

- **Phase 1 (Crypto Domain)**:
  - Gateway binary signature verification using secp256k1
  - Checksum validation delegates to `crypto_domain/signing.rs`

- **Phase 2 (SPV)**:
  - Subscription check before gateway start (Phase 2 pattern)
  - Block `start_gateway` if subscription expired

- **Phase 3 (Gateway Mode)**:
  - Reuse `gateway_domain/process.rs` spawn logic
  - Extend health check to include AI provider status
  - System tray updates via `tray::update_menu` IPC

- **Phase 4 (Multi-User)**:
  - Only Owner/Member can start/stop gateway
  - Guest users receive read-only access to gateway status

### 3.4 SPEC Cross-References

- **§6.3**: Gateway process architecture (HTTP server, background workers)
- **§8.1**: Health check endpoint specification
- **§10.1**: Installer bundling strategy (embed gateway binary in resources)

### 3.5 Test Scenarios

**TS-7.3.1**: Gateway binary detection
```rust
#[test]
fn test_detect_bundled_gateway() {
    let binary = detect_gateway_binary().unwrap();

    assert!(binary.path.exists());
    assert_eq!(binary.path.file_name().unwrap(), "edwinpai-gateway");
    assert!(!binary.checksum.is_empty());
}

#[test]
fn test_verify_binary_checksum() {
    let binary = GatewayBinary {
        path: PathBuf::from("test_fixtures/edwinpai-gateway"),
        version: "0.1.0".to_string(),
        checksum: "a1b2c3d4...".to_string(),
    };

    let is_valid = verify_checksum(&binary).unwrap();
    assert!(is_valid);
}
```

**TS-7.3.2**: Gateway spawn and health check
```rust
#[tokio::test]
async fn test_spawn_gateway_success() {
    let mut manager = GatewayManager::new();
    manager.start().await.unwrap();

    // Wait for startup
    tokio::time::sleep(Duration::from_secs(2)).await;

    let status = manager.get_status().await;
    assert_eq!(status, ProcessStatus::Running);

    // Verify health check
    let health = manager.health_check().await.unwrap();
    assert_eq!(health.status, "ok");

    manager.stop().await.unwrap();
}

#[tokio::test]
async fn test_auto_restart_on_crash() {
    let mut manager = GatewayManager::new();
    manager.start().await.unwrap();

    // Simulate crash
    std::process::Command::new("kill")
        .args(&["-9", &manager.get_pid().unwrap().to_string()])
        .output()
        .unwrap();

    // Wait for auto-restart
    tokio::time::sleep(Duration::from_secs(6)).await;

    let status = manager.get_status().await;
    assert_eq!(status, ProcessStatus::Running);
}
```

**TS-7.3.3**: Graceful shutdown
```rust
#[tokio::test]
async fn test_graceful_shutdown() {
    let mut manager = GatewayManager::new();
    manager.start().await.unwrap();

    tokio::time::sleep(Duration::from_secs(2)).await;

    let start = Instant::now();
    manager.stop().await.unwrap();
    let elapsed = start.elapsed();

    assert!(elapsed < Duration::from_secs(11)); // Should shutdown within 10s + margin
    assert_eq!(manager.get_status().await, ProcessStatus::Stopped);
}
```

**TS-7.3.4**: Error handling
```rust
#[tokio::test]
async fn test_spawn_failure_invalid_binary() {
    let mut manager = GatewayManager::new();
    manager.binary_path = PathBuf::from("/nonexistent/path");

    let result = manager.start().await;

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("GATEWAY_SPAWN_FAILED"));
}
```

---

## 4. Chat UI Integration

### 4.1 Functional Requirements

**REQ-7.4.1**: SSE event parsing and rendering
- **Acceptance Criteria**:
  - `EventSource` connection to `/api/chat/completions?stream=true`
  - Parse `data:` prefixed JSON events (chunk, tool_call, done, error)
  - Incremental text rendering: append chunks to message buffer
  - Tool call UI: display function name, arguments in expandable card
  - Error events: show error message in red banner with retry button
  - Connection auto-reconnect on disconnect (max 3 retries)

**REQ-7.4.2**: Chat history persistence and loading
- **Acceptance Criteria**:
  - Save messages to localStorage after each completion (Phase 3 pattern)
  - Key format: `edwinpai:chat:history:{user_id}` (JSON array)
  - Max storage: 10 MB (~1000 messages, auto-prune oldest)
  - Load history on component mount with pagination (50 messages per page)
  - Scroll to bottom on new message, preserve scroll on history load
  - Search functionality: filter by content/role with debounced input

**REQ-7.4.3**: Tool call UI components
- **Acceptance Criteria**:
  - Tool call card displays: function name, arguments JSON, execution status
  - Collapsible details: arguments pretty-printed with syntax highlighting
  - Status indicators: pending (spinner), success (green check), error (red X)
  - Tool result rendering: structured data in table format, text in markdown
  - Action buttons: "Re-run", "Edit Arguments", "Copy JSON"

**REQ-7.4.4**: Markdown rendering with code highlighting
- **Acceptance Criteria**:
  - Use `react-markdown` + `remark-gfm` (Phase 3 dependencies)
  - Syntax highlighting via `react-syntax-highlighter` with GitHub Dark theme
  - Supported languages: JavaScript, TypeScript, Python, Rust, JSON, SQL, Bash
  - Code block copy button (top-right corner)
  - Inline code styling: monospace font, gray background
  - LaTeX math rendering via `remark-math` + `rehype-katex` (optional)

### 4.2 Type/Contract References

```typescript
// types/api.ts - Chat UI Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  tool_calls?: ToolCall[];
  tool_result?: ToolResult;
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string; // JSON string
  };
  status: "pending" | "success" | "error";
}

export interface ToolResult {
  tool_call_id: string;
  output: string; // JSON or plain text
  error?: string;
}

export interface SSEChunkEvent {
  event: "chunk";
  data: {
    delta: string;
    message_id: string;
  };
}

export interface SSEToolCallEvent {
  event: "tool_call";
  data: ToolCall;
}

export interface SSEDoneEvent {
  event: "done";
  data: {
    message_id: string;
    finish_reason: "stop" | "length" | "tool_calls";
    usage: TokenUsage;
  };
}
```

### 4.3 Integration Points

- **Phase 1 (Crypto Domain)**:
  - Message encryption for privacy mode: `EncryptRequest` with `keyID="chat-history"`
  - Decrypt on history load for display

- **Phase 3 (Chat UI)**:
  - Reuse `ChatView`, `MessageBubble`, `InputBar` components
  - Extend `useChat` hook with SSE event handling
  - localStorage persistence pattern from Phase 3

- **Phase 4 (Multi-User)**:
  - Per-user chat history: localStorage key includes `user_id`
  - Shared chat rooms: fetch history from gateway API (multi-user context)

- **Phase 5 (Channels)**:
  - Tool call routing: match function name to channel platform
  - Channel context injection: prepend channel config to system message

### 4.4 SPEC Cross-References

- **§8.2**: Chat completions API specification (SSE format)
- **§9.5**: Tool calling system (function schemas, execution flow)
- **§9.6**: Chat UI requirements (markdown, syntax highlighting, history)

### 4.5 Test Scenarios

**TS-7.4.1**: SSE event parsing
```typescript
// src/hooks/useChat.test.ts
test('parses SSE chunk events', async () => {
  const { result } = renderHook(() => useChat());

  const mockEventSource = new MockEventSource();
  mockEventSource.emit('message', {
    data: JSON.stringify({ event: 'chunk', data: { delta: 'Hello', message_id: '123' } })
  });

  await waitFor(() => {
    expect(result.current.messages).toContainEqual(
      expect.objectContaining({ content: 'Hello' })
    );
  });
});

test('parses SSE tool call events', async () => {
  const { result } = renderHook(() => useChat());

  const mockEventSource = new MockEventSource();
  mockEventSource.emit('message', {
    data: JSON.stringify({
      event: 'tool_call',
      data: { id: 'tc_1', function: { name: 'search', arguments: '{"query":"test"}' }, status: 'pending' }
    })
  });

  await waitFor(() => {
    expect(result.current.messages[0].tool_calls).toHaveLength(1);
  });
});
```

**TS-7.4.2**: Chat history persistence
```typescript
// src/components/chat/ChatView.test.tsx
test('saves messages to localStorage', async () => {
  render(<ChatView userId="test_user" />);

  const input = screen.getByPlaceholderText('Type a message...');
  fireEvent.change(input, { target: { value: 'Hello AI' } });
  fireEvent.submit(input);

  await waitFor(() => {
    const history = JSON.parse(localStorage.getItem('edwinpai:chat:history:test_user') || '[]');
    expect(history).toContainEqual(
      expect.objectContaining({ role: 'user', content: 'Hello AI' })
    );
  });
});

test('loads history on mount', async () => {
  const mockHistory = [
    { id: '1', role: 'user', content: 'Previous message', timestamp: Date.now() }
  ];
  localStorage.setItem('edwinpai:chat:history:test_user', JSON.stringify(mockHistory));

  render(<ChatView userId="test_user" />);

  expect(await screen.findByText('Previous message')).toBeInTheDocument();
});
```

**TS-7.4.3**: Tool call UI rendering
```typescript
// src/components/chat/ToolCallCard.test.tsx
test('renders tool call with collapsible arguments', async () => {
  const toolCall = {
    id: 'tc_1',
    function: { name: 'search', arguments: '{"query":"test","limit":10}' },
    status: 'success' as const
  };

  render(<ToolCallCard toolCall={toolCall} />);

  expect(screen.getByText('search')).toBeInTheDocument();
  expect(screen.getByText(/success/i)).toBeInTheDocument();

  // Expand arguments
  fireEvent.click(screen.getByText(/show arguments/i));
  expect(await screen.findByText(/"query": "test"/)).toBeInTheDocument();
});
```

**TS-7.4.4**: Code block syntax highlighting
```typescript
// src/components/chat/MessageBubble.test.tsx
test('renders code blocks with syntax highlighting', () => {
  const message = {
    id: '1',
    role: 'assistant' as const,
    content: '```typescript\nconst x: number = 42;\n```',
    timestamp: Date.now()
  };

  render(<MessageBubble message={message} />);

  const codeBlock = screen.getByText(/const x: number = 42;/);
  expect(codeBlock).toHaveClass('language-typescript');
});
```

---

## 5. BSV Identity Integration

### 5.1 Functional Requirements

**REQ-7.5.1**: BRC-42 keypair generation flow
- **Acceptance Criteria**:
  - Onboarding step prompts user to generate new identity or import existing
  - Generate uses `GenerateKeypairRequest` IPC (Phase 1)
  - Import accepts WIF private key or 12/24-word mnemonic (BIP39)
  - Mnemonic validation: checksum verification, supported wordlist (English)
  - Display public key (compressed hex) and petname after generation
  - Store private key in system keychain (Phase 1 pattern)

**REQ-7.5.2**: Petname derivation and display
- **Acceptance Criteria**:
  - Petname format: `<adjective>_<animal>_<number>` (e.g., "friendly_falcon_42")
  - Derivation: first 4 bytes of SHA256(pubkey) map to word indices
  - Wordlists: 256 adjectives, 256 animals (from Phase 1 test fixtures)
  - Number: last 2 digits of pubkey hash (00-99)
  - Display in system tray, settings page, and gateway API responses
  - Editing: users can override petname (custom string, max 32 chars)

**REQ-7.5.3**: Avatar generation (identicon)
- **Acceptance Criteria**:
  - SVG identicon generated from pubkey seed
  - 8×8 grid with symmetric pattern (mirror horizontally)
  - Color scheme: 5 colors derived from pubkey hash (HSL space)
  - Background: white (light theme) or dark gray (dark theme)
  - Render in 64×64, 128×128, 256×256 sizes for different UI contexts
  - Export as data URL for embedding in API responses

**REQ-7.5.4**: Identity backup and recovery
- **Acceptance Criteria**:
  - Export identity: encrypted JSON file with private key, petname, avatar seed
  - Encryption: BRC-42 with user-provided password (PBKDF2 key derivation)
  - Import identity: decrypt JSON, restore to keychain, update config
  - Backup reminder: prompt every 30 days if not backed up
  - Recovery flow: detect missing keychain entry on startup, prompt import

### 5.2 Type/Contract References

```typescript
// types/identity.ts - Identity Types (Phase 1 baseline)
export interface Identity {
  pubkey: string; // 66-char hex (compressed secp256k1)
  petname: string;
  avatar_seed: string; // Hex seed for identicon
  created_at: number; // Unix timestamp
}

export interface IdentityBackup {
  version: number; // Current: 1
  identity: Identity;
  private_key_encrypted: string; // BRC-42 ciphertext (password-derived key)
  salt: string; // PBKDF2 salt (hex)
  iterations: number; // PBKDF2 iterations (100000)
}

export interface MnemonicImport {
  mnemonic: string; // 12 or 24 words (space-separated)
  passphrase?: string; // Optional BIP39 passphrase
}
```

```rust
// src-tauri/src/crypto_domain/types.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateKeypairRequest {
    pub master_key: Option<Vec<u8>>, // Optional seed for deterministic generation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeypairResponse {
    pub private_key: String, // WIF format
    pub public_key: String, // Compressed hex
    pub petname: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportMnemonicRequest {
    pub mnemonic: String,
    pub passphrase: Option<String>,
}
```

### 5.3 Integration Points

- **Phase 1 (Crypto Domain)**:
  - Keypair generation: `GenerateKeypairRequest` IPC command
  - Keychain storage: `StorePrivateKeyRequest` with `keyID="master-identity"`
  - Petname derivation: `DerivePetnameRequest` using pubkey
  - Signature generation: `SignRequest` for BRC-103 auth (Phase 4)

- **Phase 2 (SPV)**:
  - Identity verification: SPV proof of pubkey ownership via signed transaction
  - Subscription tied to pubkey: check payment status

- **Phase 3 (Config)**:
  - Identity stored in `gateway.json` config file
  - Avatar seed cached for offline rendering

- **Phase 4 (Multi-User)**:
  - Owner identity: first user to complete onboarding
  - Member/Guest identities: imported via invitation redemption

### 5.4 SPEC Cross-References

- **§4.1**: BRC-42 key derivation specification
- **§4.2**: Petname system requirements
- **§4.3**: Identicon avatar generation
- **§7.3**: Identity backup and recovery flows

### 5.5 Test Scenarios

**TS-7.5.1**: Keypair generation
```rust
#[tokio::test]
async fn test_generate_keypair() {
    let request = GenerateKeypairRequest { master_key: None };
    let response = generate_keypair(request).await.unwrap();

    assert_eq!(response.public_key.len(), 66); // Compressed hex
    assert!(response.private_key.starts_with("L") || response.private_key.starts_with("K")); // WIF format
    assert!(response.petname.contains("_"));
}
```

**TS-7.5.2**: Mnemonic import
```rust
#[tokio::test]
async fn test_import_mnemonic_valid() {
    let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    let request = ImportMnemonicRequest {
        mnemonic: mnemonic.to_string(),
        passphrase: None,
    };

    let response = import_mnemonic(request).await.unwrap();
    assert_eq!(response.public_key, "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5");
}

#[tokio::test]
async fn test_import_mnemonic_invalid_checksum() {
    let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invalid";
    let request = ImportMnemonicRequest {
        mnemonic: mnemonic.to_string(),
        passphrase: None,
    };

    let result = import_mnemonic(request).await;
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Invalid checksum"));
}
```

**TS-7.5.3**: Petname derivation
```typescript
// src/lib/identity/petname.test.ts
test('derives petname from pubkey', () => {
  const pubkey = '02abc123...';
  const petname = derivePetname(pubkey);

  expect(petname).toMatch(/^[a-z]+_[a-z]+_\d{2}$/);
});

test('petname is deterministic', () => {
  const pubkey = '02abc123...';
  const petname1 = derivePetname(pubkey);
  const petname2 = derivePetname(pubkey);

  expect(petname1).toBe(petname2);
});
```

**TS-7.5.4**: Identicon generation
```typescript
// src/lib/identity/identicon.test.ts
test('generates SVG identicon from pubkey', () => {
  const pubkey = '02abc123...';
  const svg = generateIdenticon(pubkey, 64);

  expect(svg).toContain('<svg');
  expect(svg).toContain('width="64"');
  expect(svg).toContain('height="64"');
});

test('identicon is symmetric', () => {
  const pubkey = '02abc123...';
  const svg = generateIdenticon(pubkey, 64);

  // Parse SVG and check left/right symmetry
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const rects = Array.from(doc.querySelectorAll('rect'));

  // Check that for each rect at (x, y), there's a mirrored rect at (7-x, y)
  rects.forEach(rect => {
    const x = parseInt(rect.getAttribute('x') || '0');
    const y = parseInt(rect.getAttribute('y') || '0');
    const mirrorX = 7 - x;

    const mirror = rects.find(r =>
      parseInt(r.getAttribute('x') || '0') === mirrorX &&
      parseInt(r.getAttribute('y') || '0') === y
    );
    expect(mirror).toBeDefined();
  });
});
```

**TS-7.5.5**: Identity backup/restore
```typescript
// e2e/identity-backup.spec.ts
test('exports and imports identity backup', async ({ page }) => {
  await page.goto('/settings/identity');

  // Export
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Export Backup")')
  ]);

  const downloadPath = await download.path();
  const backupData = JSON.parse(fs.readFileSync(downloadPath, 'utf-8'));

  expect(backupData.version).toBe(1);
  expect(backupData.identity.pubkey).toMatch(/^02[0-9a-f]{64}$/);

  // Import
  await page.click('button:has-text("Import Backup")');
  await page.setInputFiles('input[type="file"]', downloadPath);
  await page.fill('input[placeholder="Password"]', 'test_password');
  await page.click('button:has-text("Restore")');

  await expect(page.locator('text=Identity restored successfully')).toBeVisible();
});
```

---

## 6. Onboarding Wizard

### 6.1 Functional Requirements

**REQ-7.6.1**: 6-step onboarding flow
- **Acceptance Criteria**:
  - Steps: (1) Welcome, (2) Mode Selection, (3) Identity Setup, (4) Subscription Check, (5) AI Provider Config, (6) Channel Setup
  - Linear progression: must complete step N before accessing step N+1
  - Validation gates: block "Next" button if step incomplete
  - Progress indicator: 1/6, 2/6, ... 6/6 with visual bar
  - Skip options: "Skip for now" available for steps 5-6 (optional config)
  - Completion: redirect to main app on step 6 finish

**REQ-7.6.2**: Mode selection (Gateway vs Client)
- **Acceptance Criteria**:
  - Radio buttons: "Gateway Mode" (default), "Client Mode"
  - Descriptions: Gateway (host your own), Client (connect to existing)
  - Visual: icons (server icon for gateway, network icon for client)
  - Validation: must select one mode to proceed
  - Mode stored in config: `config.mode = "gateway" | "client"`

**REQ-7.6.3**: Identity setup wizard
- **Acceptance Criteria**:
  - Options: "Generate New Identity", "Import Existing"
  - Generate flow: click → call `GenerateKeypairRequest` → display petname + avatar
  - Import flow: paste WIF or mnemonic → validate → display petname + avatar
  - Confirmation: "I have backed up my private key" checkbox (required)
  - Stored in keychain: private key via `StorePrivateKeyRequest` (Phase 1)

**REQ-7.6.4**: Subscription check and payment
- **Acceptance Criteria**:
  - Check: call `CheckSubscriptionRequest` IPC (Phase 2)
  - Status display: Active (green), Cached (yellow), Expired (red)
  - Payment flow: if expired, show payment QR code (BSV address)
  - Auto-refresh: poll subscription status every 10s during payment
  - Skip: allow "Continue without subscription" (grace period)

**REQ-7.6.5**: AI provider configuration
- **Acceptance Criteria**:
  - Provider dropdown: OpenAI, Anthropic, OpenRouter, Local (Ollama)
  - API key input: masked text field (password type)
  - Validation: test API key via provider health check endpoint
  - Model selection: populate dropdown from provider models list
  - Advanced settings: temperature, max_tokens (collapsible)

**REQ-7.6.6**: Channel setup (optional)
- **Acceptance Criteria**:
  - Platform checkboxes: WhatsApp, Telegram, Matrix, Discord, Slack, Signal
  - "Configure Later" option (skips step)
  - For each selected platform: mini-wizard (2-3 fields per platform)
  - Validation: offline schema check per platform (Phase 5 pattern)
  - Summary: display configured channels count before completion

### 6.2 Type/Contract References

```typescript
// types/onboarding.ts - Onboarding Wizard Types
export interface OnboardingState {
  current_step: number; // 1-6
  completed_steps: number[];
  mode: "gateway" | "client" | null;
  identity: Identity | null;
  subscription: SubscriptionStatus | null;
  ai_provider: AIProviderConfig | null;
  channels: ChannelConfig[];
}

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  required: boolean;
  component: React.ComponentType;
  validation: () => Promise<boolean>;
}
```

### 6.3 Integration Points

- **Phase 1 (Crypto Domain)**:
  - Identity generation: `GenerateKeypairRequest` IPC
  - Mnemonic import: `ImportMnemonicRequest` IPC
  - Keychain storage: `StorePrivateKeyRequest` IPC

- **Phase 2 (SPV)**:
  - Subscription check: `CheckSubscriptionRequest` IPC
  - Payment monitoring: poll transaction status via SPV

- **Phase 3 (Gateway Mode)**:
  - Mode selection: update `config.mode` field
  - Gateway auto-start: if `mode=gateway` and `auto_start_gateway=true`

- **Phase 4 (Client Mode)**:
  - Client onboarding: add discovery step (scan for gateways)
  - Connection wizard: BRC-103 handshake flow

- **Phase 5 (Channels)**:
  - Channel wizards: reuse platform-specific wizard components
  - Bulk configuration: create multiple channels in one pass

### 6.4 SPEC Cross-References

- **§5.1**: Onboarding flow requirements (6 steps)
- **§5.2**: Mode selection UI specification
- **§5.3**: Identity setup wizard
- **§5.4**: Subscription verification flow
- **§5.5**: AI provider configuration

### 6.5 Test Scenarios

**TS-7.6.1**: Complete onboarding flow (Gateway mode)
```typescript
// e2e/onboarding.spec.ts
test('complete onboarding as gateway', async ({ page }) => {
  await page.goto('/onboarding');

  // Step 1: Welcome
  await expect(page.locator('h1:has-text("Welcome to EdwinPAI")')).toBeVisible();
  await page.click('button:has-text("Get Started")');

  // Step 2: Mode Selection
  await page.click('input[value="gateway"]');
  await page.click('button:has-text("Next")');

  // Step 3: Identity Setup
  await page.click('button:has-text("Generate New Identity")');
  await page.waitForTimeout(1000); // Wait for generation
  await page.check('input[type="checkbox"]:has-text("I have backed up")');
  await page.click('button:has-text("Next")');

  // Step 4: Subscription Check
  await page.click('button:has-text("Skip for now")');

  // Step 5: AI Provider Config
  await page.selectOption('select[name="provider"]', 'anthropic');
  await page.fill('input[name="api_key"]', 'sk-test-key-123');
  await page.click('button:has-text("Next")');

  // Step 6: Channel Setup
  await page.click('button:has-text("Configure Later")');

  // Verify redirect to main app
  await expect(page).toHaveURL('/chat');
});
```

**TS-7.6.2**: Identity import validation
```typescript
// src/components/onboarding/IdentitySetup.test.tsx
test('validates mnemonic checksum', async () => {
  render(<IdentitySetup />);

  fireEvent.click(screen.getByText('Import Existing'));

  const input = screen.getByPlaceholderText('Enter mnemonic...');
  fireEvent.change(input, { target: { value: 'invalid mnemonic words' } });

  fireEvent.click(screen.getByText('Import'));

  await waitFor(() => {
    expect(screen.getByText(/invalid checksum/i)).toBeInTheDocument();
  });
});

test('imports valid mnemonic', async () => {
  render(<IdentitySetup />);

  fireEvent.click(screen.getByText('Import Existing'));

  const input = screen.getByPlaceholderText('Enter mnemonic...');
  fireEvent.change(input, { target: { value: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' } });

  fireEvent.click(screen.getByText('Import'));

  await waitFor(() => {
    expect(screen.getByText(/Identity imported/i)).toBeInTheDocument();
  });
});
```

**TS-7.6.3**: Subscription check flow
```typescript
// src/components/onboarding/SubscriptionCheck.test.tsx
test('displays active subscription', async () => {
  mockCheckSubscription.mockResolvedValue({ status: 'Active' });

  render(<SubscriptionCheck />);

  await waitFor(() => {
    expect(screen.getByText(/subscription active/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });
});

test('shows payment QR for expired subscription', async () => {
  mockCheckSubscription.mockResolvedValue({ status: 'Expired' });

  render(<SubscriptionCheck />);

  await waitFor(() => {
    expect(screen.getByText(/subscription expired/i)).toBeInTheDocument();
    expect(screen.getByTestId('payment-qr-code')).toBeInTheDocument();
  });
});
```

**TS-7.6.4**: AI provider validation
```typescript
// src/components/onboarding/AIProviderConfig.test.tsx
test('validates API key format', async () => {
  render(<AIProviderConfig />);

  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } });
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'invalid-key' } });

  fireEvent.click(screen.getByText('Next'));

  await waitFor(() => {
    expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument();
  });
});

test('tests API key with health check', async () => {
  mockHealthCheck.mockResolvedValue({ status: 'ok' });

  render(<AIProviderConfig />);

  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'anthropic' } });
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-ant-valid-key' } });

  fireEvent.click(screen.getByText('Test Connection'));

  await waitFor(() => {
    expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
  });
});
```

---

## 7. Channel Platform Wizards

### 7.1 Functional Requirements

**REQ-7.7.1**: 7 platform-specific configuration wizards
- **Acceptance Criteria**:
  - Platforms: WhatsApp, Telegram, Matrix, Discord, Slack, Signal, Custom Webhook
  - Each wizard: 2-4 steps (auth, config, test, save)
  - Reusable `WizardShell` component (Phase 5 pattern)
  - Field validation: offline schema checks (Phase 5 pattern)
  - Test connection: send test message to verify credentials
  - Config write: encrypt with BRC-42, save to `~/.edwinpai/channels/{platform}_{name}.json`

**REQ-7.7.2**: WhatsApp wizard (2 steps)
- **Acceptance Criteria**:
  - Step 1: QR code scan (display QR for WhatsApp Web pairing)
  - Step 2: Session data JSON upload (from WhatsApp Web DevTools)
  - Validation: check for `WABrowserId`, `WASecretBundle`, `WAToken1` keys
  - Test: attempt to fetch chat list via WhatsApp API
  - Storage: encrypted session JSON in `whatsapp_{name}.json`

**REQ-7.7.3**: Telegram wizard (2 steps)
- **Acceptance Criteria**:
  - Step 1: Bot token input (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)
  - Step 2: Chat ID input (numeric, optional negative prefix for groups)
  - Validation: regex check token format, numeric chat ID
  - Test: send "EdwinPAI connected" message via Telegram Bot API
  - Storage: encrypted `{ bot_token, chat_id }` in `telegram_{name}.json`

**REQ-7.7.4**: Matrix wizard (3 steps)
- **Acceptance Criteria**:
  - Step 1: Homeserver URL (e.g., `https://matrix.org`)
  - Step 2: Auth method (password or access token)
  - Step 3: Room ID (e.g., `!abc123:matrix.org`)
  - Validation: check homeserver reachability, validate room ID format
  - Test: send message to room, verify echo via `/sync` endpoint
  - Storage: encrypted `{ homeserver, access_token, room_id }` in `matrix_{name}.json`

**REQ-7.7.5**: Discord wizard (3 steps)
- **Acceptance Criteria**:
  - Step 1: Auth type (Bot Token or OAuth2)
  - Step 2: Token/credentials input (Bot: single field, OAuth: client ID + secret)
  - Step 3: Channel ID (numeric, 18 digits)
  - Validation: check token prefix (`Bot ` or `Bearer `), numeric channel ID
  - Test: fetch channel info via Discord API
  - Storage: encrypted `{ auth_type, token, channel_id }` in `discord_{name}.json`

**REQ-7.7.6**: Slack wizard (3 steps)
- **Acceptance Criteria**:
  - Step 1: OAuth flow (redirect to Slack, capture code)
  - Step 2: Workspace and channel selection (dropdowns)
  - Step 3: Scopes verification (ensure `chat:write`, `channels:read`)
  - Validation: check token prefix (`xoxb-` or `xoxp-`), verify scopes
  - Test: post message to selected channel
  - Storage: encrypted `{ access_token, workspace_id, channel_id }` in `slack_{name}.json`

**REQ-7.7.7**: Signal wizard (2 steps)
- **Acceptance Criteria**:
  - Step 1: Phone number input (E.164 format, e.g., `+1234567890`)
  - Step 2: Session data JSON upload (from signal-cli or Signal Desktop)
  - Validation: check for `deviceId`, `registrationId`, `signedPreKey` keys
  - Test: send message to self (loopback verification)
  - Storage: encrypted session JSON in `signal_{name}.json`

**REQ-7.7.8**: Custom Webhook wizard (2 steps)
- **Acceptance Criteria**:
  - Step 1: Webhook URL (must be HTTPS, validate SSL cert)
  - Step 2: Headers and authentication (key-value pairs, bearer token option)
  - Validation: URL format check, HTTPS enforcement
  - Test: POST test payload `{ "type": "test", "message": "EdwinPAI connected" }`
  - Storage: encrypted `{ url, headers, auth }` in `webhook_{name}.json`

### 7.2 Type/Contract References

```typescript
// types/channels.ts - Platform-Specific Schemas (Phase 5 baseline + Custom Webhook)
export interface WhatsAppConfig {
  platform: "whatsapp";
  name: string;
  session_data: string; // JSON string (encrypted)
}

export interface TelegramConfig {
  platform: "telegram";
  name: string;
  bot_token: string; // Encrypted
  chat_id: string;
}

export interface MatrixConfig {
  platform: "matrix";
  name: string;
  homeserver: string;
  access_token: string; // Encrypted
  room_id: string;
}

export interface DiscordConfig {
  platform: "discord";
  name: string;
  auth_type: "bot" | "oauth";
  token: string; // Encrypted
  channel_id: string;
}

export interface SlackConfig {
  platform: "slack";
  name: string;
  access_token: string; // Encrypted (xoxb- or xoxp-)
  workspace_id: string;
  channel_id: string;
}

export interface SignalConfig {
  platform: "signal";
  name: string;
  phone_number: string;
  session_data: string; // JSON string (encrypted)
}

export interface WebhookConfig {
  platform: "webhook";
  name: string;
  url: string;
  headers: Record<string, string>;
  auth?: {
    type: "bearer" | "basic" | "custom";
    token?: string; // Encrypted
  };
}

export type ChannelConfig =
  | WhatsAppConfig
  | TelegramConfig
  | MatrixConfig
  | DiscordConfig
  | SlackConfig
  | SignalConfig
  | WebhookConfig;
```

### 7.3 Integration Points

- **Phase 1 (Crypto Domain)**:
  - Credential encryption: `EncryptRequest` with `keyID="channel-{platform}-{name}"`
  - Decryption on use: `DecryptRequest` before sending messages

- **Phase 3 (Config)**:
  - Atomic file writes: temp file + rename pattern
  - Platform-specific paths: `~/.edwinpai/channels/{platform}_{name}.json`

- **Phase 4 (Multi-User)**:
  - Permission checks: Owner/Member can create channels, Guest read-only
  - Per-user channels: scope channel configs to `user_id`

- **Phase 5 (Channels)**:
  - Reuse validation logic from `channel_domain/validation.rs`
  - Extend `ChannelList` component with "Add Channel" button → wizard modal

### 7.4 SPEC Cross-References

- **§9.8**: Channel configuration schema (7 platforms)
- **§9.9**: Channel wizard UI requirements
- **§9.10**: Credential encryption and storage

### 7.5 Test Scenarios

**TS-7.7.1**: WhatsApp wizard flow
```typescript
// e2e/channels/whatsapp-wizard.spec.ts
test('completes WhatsApp wizard', async ({ page }) => {
  await page.goto('/settings/channels');
  await page.click('button:has-text("Add Channel")');
  await page.click('text=WhatsApp');

  // Step 1: QR Code
  await expect(page.locator('canvas#whatsapp-qr')).toBeVisible();
  await page.click('button:has-text("I scanned the QR code")');

  // Step 2: Session Data
  const sessionData = JSON.stringify({ WABrowserId: 'test', WASecretBundle: 'test', WAToken1: 'test' });
  await page.fill('textarea[name="session_data"]', sessionData);
  await page.click('button:has-text("Save")');

  await expect(page.locator('text=WhatsApp channel created')).toBeVisible();
});
```

**TS-7.7.2**: Telegram wizard validation
```typescript
// src/components/channels/TelegramWizard.test.tsx
test('validates bot token format', async () => {
  render(<TelegramWizard />);

  fireEvent.change(screen.getByLabelText('Bot Token'), { target: { value: 'invalid-token' } });
  fireEvent.click(screen.getByText('Next'));

  await waitFor(() => {
    expect(screen.getByText(/invalid bot token format/i)).toBeInTheDocument();
  });
});

test('accepts valid bot token', async () => {
  render(<TelegramWizard />);

  fireEvent.change(screen.getByLabelText('Bot Token'), { target: { value: '1234567890:ABCdefGHI' } });
  fireEvent.change(screen.getByLabelText('Chat ID'), { target: { value: '-1001234567890' } });
  fireEvent.click(screen.getByText('Next'));

  await waitFor(() => {
    expect(screen.getByText(/test connection/i)).toBeInTheDocument();
  });
});
```

**TS-7.7.3**: Matrix wizard homeserver check
```rust
#[tokio::test]
async fn test_matrix_homeserver_reachable() {
    let config = MatrixConfig {
        platform: "matrix".to_string(),
        name: "test".to_string(),
        homeserver: "https://matrix.org".to_string(),
        access_token: "syt_test123".to_string(),
        room_id: "!abc:matrix.org".to_string(),
    };

    let is_reachable = check_matrix_homeserver(&config.homeserver).await.unwrap();
    assert!(is_reachable);
}
```

**TS-7.7.4**: Discord wizard test message
```rust
#[tokio::test]
async fn test_discord_send_test_message() {
    let config = DiscordConfig {
        platform: "discord".to_string(),
        name: "test".to_string(),
        auth_type: "bot".to_string(),
        token: "Bot test_token_123".to_string(),
        channel_id: "123456789012345678".to_string(),
    };

    let mock_server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(format!("/channels/{}/messages", config.channel_id)))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "id": "msg_123" })))
        .mount(&mock_server)
        .await;

    let result = send_discord_test_message(&config, &mock_server.uri()).await;
    assert!(result.is_ok());
}
```

**TS-7.7.5**: Custom Webhook wizard HTTPS enforcement
```typescript
// src/components/channels/WebhookWizard.test.tsx
test('rejects HTTP URLs', async () => {
  render(<WebhookWizard />);

  fireEvent.change(screen.getByLabelText('Webhook URL'), { target: { value: 'http://insecure.com/webhook' } });
  fireEvent.click(screen.getByText('Next'));

  await waitFor(() => {
    expect(screen.getByText(/must use https/i)).toBeInTheDocument();
  });
});

test('accepts HTTPS URLs', async () => {
  render(<WebhookWizard />);

  fireEvent.change(screen.getByLabelText('Webhook URL'), { target: { value: 'https://secure.com/webhook' } });
  fireEvent.click(screen.getByText('Next'));

  await waitFor(() => {
    expect(screen.getByText(/configure headers/i)).toBeInTheDocument();
  });
});
```

---

## 8. Installer & Bundling Strategy

### 8.1 Functional Requirements

**REQ-7.8.1**: Multi-platform installer generation
- **Acceptance Criteria**:
  - Linux: `.deb`, `.AppImage`, `.rpm` (via `tauri build`)
  - macOS: `.dmg`, `.app` bundle with code signing (optional)
  - Windows: `.msi`, `.exe` installer with Wix toolchain
  - Installer size: <50 MB (target: 18-24 MB per Phase 6)
  - Auto-updater integration: Ed25519 signature verification
  - Desktop integration: system tray, file associations, protocol handlers

**REQ-7.8.2**: Gateway binary bundling decision
- **Acceptance Criteria**:
  - **Decision Matrix**:
    - Development: Gateway binary NOT bundled, loaded from `../gateway/target/release/`
    - CI/Release: Gateway binary bundled in `resources/` directory
    - Platform-specific bundling: Linux (embed in AppImage), macOS (embed in app bundle), Windows (embed in installer)
  - Binary detection logic: check `resources/edwinpai-gateway` first, fallback to PATH
  - Version matching: verify gateway version matches desktop version (SemVer)
  - Auto-download: if bundled binary missing in dev mode, download from GitHub Releases

**REQ-7.8.3**: Dependency bundling and licensing
- **Acceptance Criteria**:
  - Rust dependencies: statically linked in final binary (no external .so/.dll)
  - System dependencies: document required packages in installer README
    - Linux: `libwebkit2gtk-4.1`, `libgtk-3-0`, `libsoup-3.0`
    - macOS: none (bundled in .app)
    - Windows: WebView2 runtime (auto-install via installer)
  - License compliance: include `LICENSES.txt` with all dependency licenses
  - Attribution: "About" dialog lists key dependencies (React, Tauri, secp256k1, etc.)

**REQ-7.8.4**: Auto-updater configuration
- **Acceptance Criteria**:
  - Update check endpoint: `https://releases.edwinpai.com/updates/{platform}/{current_version}`
  - Signature verification: Ed25519 pubkey embedded in `tauri.conf.json`
  - Update strategy: prompt user (default), silent install (opt-in)
  - Rollback: backup previous version before update, allow manual rollback
  - Update frequency: check daily on startup, manual check in settings

**REQ-7.8.5**: Installer customization
- **Acceptance Criteria**:
  - Install location: default (`/usr/local/bin` Linux, `/Applications` macOS, `C:\Program Files` Windows), user-customizable
  - Start menu shortcuts: "EdwinPAI Desktop" (main app), "EdwinPAI Settings" (settings page)
  - Uninstaller: remove app files, preserve user data in `~/.edwinpai/` (prompt to delete)
  - Installer UI: custom banner, logo, EULA acceptance (optional)

### 8.2 Type/Contract References

```json
// tauri.conf.json - Installer Configuration
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["deb", "appimage", "rpm", "dmg", "msi", "nsis"],
    "identifier": "com.edwinpai.desktop",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/256x256.png",
      "icons/icon.ico",
      "icons/icon.icns"
    ],
    "resources": [
      "resources/edwinpai-gateway",
      "resources/edwinpai-gateway.exe"
    ],
    "externalBin": [],
    "copyright": "Copyright © 2026 EdwinPAI Project",
    "category": "Productivity",
    "shortDescription": "AI-powered desktop assistant with BSV identity",
    "longDescription": "EdwinPAI Desktop is a Tauri-based desktop application that integrates AI assistants with Bitcoin SV identity and multi-channel communication.",
    "deb": {
      "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0", "libsoup-3.0-0"]
    },
    "macOS": {
      "entitlements": null,
      "exceptionDomain": "",
      "frameworks": [],
      "providerShortName": null,
      "signingIdentity": null
    },
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "wix": {
        "language": "en-US"
      }
    }
  },
  "updater": {
    "active": true,
    "endpoints": [
      "https://releases.edwinpai.com/updates/{{target}}/{{current_version}}"
    ],
    "dialog": true,
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6PLACEHOLDER"
  }
}
```

### 8.3 Integration Points

- **Phase 1 (Crypto Domain)**:
  - Binary signature verification: `VerifyRequest` with bundled pubkey
  - Auto-updater signature check: Ed25519 verification

- **Phase 3 (Gateway Mode)**:
  - Gateway binary detection: check `resources/` then PATH
  - Version matching: compare `gateway --version` output to desktop version

- **Phase 6 (Test Suite)**:
  - Installer smoke tests: install on fresh VM, launch app, verify UI loads
  - CI builds: GitHub Actions generates installers for all platforms

### 8.4 SPEC Cross-References

- **§10.1**: Installer requirements and platform targets
- **§10.2**: Auto-updater specification
- **§10.3**: Dependency bundling and licensing

### 8.5 Test Scenarios

**TS-7.8.1**: Installer size validation
```bash
# CI workflow step
- name: Check installer size
  run: |
    for file in target/release/bundle/**/edwinpai-desktop*; do
      size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
      max_size=$((50 * 1024 * 1024)) # 50 MB
      if [ $size -gt $max_size ]; then
        echo "Installer too large: $file ($size bytes)"
        exit 1
      fi
    done
```

**TS-7.8.2**: Gateway binary bundling check
```rust
#[test]
fn test_gateway_binary_bundled_in_release() {
    let bundled_path = PathBuf::from("resources/edwinpai-gateway");

    #[cfg(debug_assertions)]
    {
        // Dev mode: binary may not be bundled
        if !bundled_path.exists() {
            let dev_path = PathBuf::from("../gateway/target/release/edwinpai-gateway");
            assert!(dev_path.exists(), "Gateway binary not found in dev location");
        }
    }

    #[cfg(not(debug_assertions))]
    {
        // Release mode: binary MUST be bundled
        assert!(bundled_path.exists(), "Gateway binary not bundled in release");
    }
}
```

**TS-7.8.3**: Auto-updater signature verification
```rust
#[tokio::test]
async fn test_update_signature_verification() {
    let update_manifest = r#"{
        "version": "0.2.0",
        "url": "https://releases.edwinpai.com/v0.2.0/edwinpai-desktop.tar.gz",
        "signature": "valid_ed25519_signature_here"
    }"#;

    let pubkey = "embedded_pubkey_from_tauri_conf";
    let is_valid = verify_update_signature(update_manifest, pubkey).await.unwrap();

    assert!(is_valid);
}
```

**TS-7.8.4**: Installer smoke test (E2E)
```typescript
// e2e/installer.spec.ts
test('fresh install launches successfully', async ({ page }) => {
  // Assumes installer has been run and app is launched
  await page.goto('tauri://localhost');

  // Should show onboarding for fresh install
  await expect(page.locator('h1:has-text("Welcome to EdwinPAI")')).toBeVisible({ timeout: 10000 });

  // Verify system tray integration
  const trayVisible = await page.evaluate(() => {
    return window.__TAURI__.tray !== undefined;
  });
  expect(trayVisible).toBe(true);
});
```

**TS-7.8.5**: Dependency licensing check
```bash
# CI workflow step
- name: Verify license compliance
  run: |
    cargo install cargo-license
    cargo license --json > licenses.json

    # Check for non-permissive licenses
    if grep -q "GPL" licenses.json; then
      echo "GPL license detected - review required"
      exit 1
    fi

    # Generate LICENSES.txt
    cargo license --authors > LICENSES.txt
```

---

## Decision Matrix: Gateway Binary Bundling

| Environment | Bundle Gateway? | Binary Location | Version Check | Auto-Download |
|-------------|----------------|-----------------|---------------|---------------|
| **Development** | ❌ No | `../gateway/target/release/` | Warn if mismatch | ✅ Yes (from GitHub Releases) |
| **CI Build** | ✅ Yes | `resources/edwinpai-gateway` | Fail if mismatch | ❌ No (build fails) |
| **Production Release** | ✅ Yes | Embedded in installer | Enforced (SemVer) | ❌ No (use auto-updater) |
| **User Install** | ✅ Yes | `/usr/local/bin` (Linux), `/Applications/EdwinPAI.app/Contents/MacOS` (macOS), `C:\Program Files\EdwinPAI` (Windows) | Runtime check on startup | ❌ No (prompt user to update) |

**Decision Rationale**:
- **Development**: Separate builds allow independent gateway/desktop iteration, auto-download avoids manual build step
- **CI**: Bundling ensures release integrity, version mismatch fails build (prevents shipping incompatible versions)
- **Production**: Single installer simplifies user experience, auto-updater handles future updates
- **User Install**: System paths enable CLI access (`edwinpai-gateway` command), runtime check warns of version drift

---

## Summary

This document provides comprehensive Phase 7 requirements across 8 subsections:

1. **Gateway API Contract**: 27 REST endpoints, SSE streaming, BRC-103 auth, chat history persistence
2. **Config Schema**: Gateway config JSON, AI provider credentials (encrypted), versioned migrations
3. **Gateway Lifecycle**: Binary detection, process spawning, health polling, graceful shutdown
4. **Chat UI Integration**: SSE parsing, history persistence, tool call UI, markdown rendering
5. **BSV Identity**: BRC-42 keypair generation, petname derivation, identicon avatars, backup/recovery
6. **Onboarding Wizard**: 6-step flow (mode selection, identity, subscription, AI config, channels)
7. **Channel Wizards**: 7 platform-specific wizards (WhatsApp, Telegram, Matrix, Discord, Slack, Signal, Webhook)
8. **Installer Strategy**: Multi-platform installers, gateway bundling matrix, auto-updater, licensing

**Total Requirements**: 44 functional requirements across 8 domains
**Test Scenarios**: 50+ test cases (Rust unit/integration + TypeScript component + E2E)
**Estimated LOC**: ~8,500 (3,200 Rust backend + 4,100 TypeScript frontend + 1,200 tests)

All requirements include explicit acceptance criteria, type/contract references, integration points with Phases 1-6, SPEC cross-references, and comprehensive test scenarios ready for implementation.
