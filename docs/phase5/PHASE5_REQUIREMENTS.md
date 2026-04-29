# Phase 5: Channel Integration Wizards — Requirements Document

**Generated**: 2026-02-11
**Status**: Requirements extraction for Phase 5 implementation
**Sources**: PLAN.md §Phase 5, SPEC.md §9, existing Phase 0-4 code

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Functional Requirements](#2-functional-requirements)
3. [Integration Points](#3-integration-points)
4. [Encryption Requirements](#4-encryption-requirements)
5. [File Replacement List](#5-file-replacement-list)
6. [Backend CRUD Operations](#6-backend-crud-operations)
7. [Frontend Components](#7-frontend-components)
8. [Gateway Integration Points](#8-gateway-integration-points)
9. [Validation Requirements](#9-validation-requirements)
10. [Testing Requirements](#10-testing-requirements)

---

## 1. Executive Summary

Phase 5 implements guided setup wizards for 6 messaging channels (WhatsApp, Telegram, Matrix, Discord, Slack, Signal) with a unified wizard framework. All channel credentials are encrypted at rest using Phase 1 Crypto Domain encrypt/decrypt IPC commands. The implementation consists of:

- **Backend**: Channel config CRUD operations with credential encryption (Rust)
- **Frontend**: WizardShell framework + 6 channel wizards + ChannelList UI (React/TypeScript)
- **Integration**: Gateway validation endpoints, QR code generation for WhatsApp/Signal
- **Security**: BRC-42 derived keys for channel credential encryption

**Estimated scope** (from PLAN.md and SPEC.md):
- **LOC**: ~2,800 total (1,600 Rust + 1,200 TypeScript)
- **Tests**: ~140 total (~70 backend + ~70 frontend)
- **Files**: ~35 (10 Rust + 16 TypeScript + 6 wizards + 3 test files)

---

## 2. Functional Requirements

### 2.1 Channel Support Matrix

| Channel | Authentication Method | QR Flow | Validation Endpoint | Credentials Stored |
|---------|----------------------|---------|---------------------|-------------------|
| WhatsApp | WhatsApp Web QR scan | ✅ Desktop → Phone | Gateway WebSocket | Session data (encrypted) |
| Telegram | BotFather bot token | ❌ | `getMe` API | Bot token (encrypted) |
| Matrix | Homeserver login | ❌ | Matrix login API | Access token (encrypted) |
| Discord | Bot token OR OAuth | ❌ | `GET /users/@me` | Bot token OR OAuth token (encrypted) |
| Slack | OAuth install flow | ❌ | `auth.test` API | OAuth token (encrypted) |
| Signal | Signal linking QR | ✅ Desktop → Phone | Device pairing confirmation | Linked device credentials (encrypted) |

### 2.2 Common Wizard Pattern (SPEC §9.1)

All 6 wizards follow a 5-step pattern:

1. **Introduction** — brief explanation of what the channel does and what's needed
2. **Credential input** — channel-specific credential gathering (QR scan, token paste, OAuth flow)
3. **Validation** — test the connection to confirm credentials work
4. **Confirmation** — show success state, explain what happens next
5. **Save** — write config to `~/.edwinpai/channels/<channelName>.json`

**Wizard step state machine**:
```
intro → credentials → validation → confirmation → saved
         ↑______________|  (validation failed)
```

### 2.3 Channel Config Schema (SPEC §9.8)

Each channel writes a config file to `~/.edwinpai/channels/<name>.json`:

```json
{
  "channel": "telegram",
  "enabled": true,
  "configuredAt": "2026-02-15T10:30:00Z",
  "configuredBy": "02a1b2c3...",
  "credentials": {
    "botToken": "<encrypted with Crypto Domain>"
  },
  "settings": {
    "autoReply": true,
    "allowedChatIds": []
  }
}
```

**Key requirement**: `credentials` field values are **encrypted ciphertext**, not plaintext. Encryption uses Phase 1 Crypto Domain IPC commands (`EncryptRequest`/`DecryptRequest`).

---

## 3. Integration Points

### 3.1 Phase 1 Crypto Domain Integration

**Existing encrypt/decrypt stubs** (src-tauri/src/crypto_domain/domain.rs:205-218):

```rust
fn encrypt(&self, _request: &EncryptRequest) -> CryptoResult<EncryptResponse> {
    Err(CryptoError {
        code: CryptoErrorCode::EncryptionFailed,
        message: "Encryption not yet implemented".to_string(),
    })
}

fn decrypt(&self, _request: &DecryptRequest) -> CryptoResult<DecryptResponse> {
    Err(CryptoError {
        code: CryptoErrorCode::DecryptionFailed,
        message: "Decryption not yet implemented".to_string(),
    })
}
```

**Phase 5 must implement** (SPEC §3.2):
- **EncryptRequest/Response** — encrypt plaintext using BRC-42 derived key
- **DecryptRequest/Response** — decrypt ciphertext using BRC-42 derived key

**IPC types already defined** (src-tauri/src/crypto_domain/ipc_types.rs):
```rust
pub struct EncryptRequest {
    pub plaintext: Vec<u8>,
    pub protocol_id: String,
    pub key_id: String,
    pub counterparty: String,
}

pub struct DecryptRequest {
    pub ciphertext: Vec<u8>,
    pub protocol_id: String,
    pub key_id: String,
    pub counterparty: String,
}
```

**Encryption scheme**:
- Use BRC-42 key derivation with `protocolID = "edwinpai"`, `keyID = "channel-encryption"`, `counterparty = <gateway_pubkey>`
- Symmetric encryption: AES-256-GCM (authenticated encryption)
- Derivation path: `user_privkey + BRC-42(gateway_pubkey, "edwinpai", "channel-encryption")` → AES key

### 3.2 Phase 3 Gateway Integration

**Existing gateway types** (src/types/api.ts:125-147):

```typescript
export type ChannelStatus = "connected" | "disconnected" | "error";

export interface ChannelEntry {
  name: string;
  enabled: boolean;
  status: ChannelStatus;
}

export interface ChannelsResponse {
  channels: ChannelEntry[];
}

export interface UpdateChannelRequest {
  enabled: boolean;
}

export interface UpdateChannelResponse {
  ok: boolean;
}
```

**Gateway API endpoints** (SPEC §10.1):
```
GET /v1/edwinpai/channels
PUT /v1/edwinpai/channels/<name>
```

**Phase 5 must add**:
- **POST /v1/edwinpai/channels/<name>/validate** — validate channel credentials before saving
  - Input: `{ credentials: Record<string, string> }` (plaintext, decrypted by gateway)
  - Output: `{ valid: boolean, error?: string, metadata?: Record<string, unknown> }`
  - For WhatsApp: returns QR code data URI
  - For Telegram: returns bot username/name from `getMe`
  - For Matrix: returns homeserver name
  - For Discord: returns bot username/discriminator
  - For Slack: returns workspace name
  - For Signal: returns linking QR data URI

### 3.3 Phase 4 Authorization Integration

**Channel configuration requires Owner permission** (SPEC §8.1):
- Only users with `permissionLevel: "owner"` can configure channels
- Gateway must enforce this via existing `check_permission` middleware
- Channel wizards are hidden from Member/Guest users in the UI

---

## 4. Encryption Requirements

### 4.1 Credential Encryption Flow

**At configuration time** (Owner sets up channel):

1. User enters credentials in wizard (plaintext in React state)
2. React calls Tauri command `encrypt_channel_credential(plaintext, channel_name)`
3. Tauri command calls Crypto Domain IPC:
   ```rust
   EncryptRequest {
       plaintext: credential_value.as_bytes(),
       protocol_id: "edwinpai".to_string(),
       key_id: format!("channel-{}", channel_name),
       counterparty: gateway_pubkey.clone(),
   }
   ```
4. Crypto Domain derives BRC-42 key, encrypts with AES-256-GCM
5. Returns `EncryptResponse { ciphertext: Vec<u8> }`
6. Tauri command hex-encodes ciphertext, saves to `~/.edwinpai/channels/<name>.json`

**At runtime** (Gateway loads channel credentials):

1. Gateway reads `~/.edwinpai/channels/<name>.json`
2. Gateway calls Tauri command `decrypt_channel_credential(ciphertext_hex, channel_name)`
3. Tauri command calls Crypto Domain IPC:
   ```rust
   DecryptRequest {
       ciphertext: hex::decode(ciphertext_hex),
       protocol_id: "edwinpai".to_string(),
       key_id: format!("channel-{}", channel_name),
       counterparty: gateway_pubkey.clone(),
   }
   ```
4. Crypto Domain derives BRC-42 key, decrypts with AES-256-GCM
5. Returns `DecryptResponse { plaintext: Vec<u8> }`
6. Gateway uses plaintext credentials to initialize channel plugin

### 4.2 Encryption Implementation (BRC-2 + BRC-42)

**Algorithm**: AES-256-GCM (authenticated encryption with associated data)

**Key derivation**:
1. BRC-42 derive shared secret between user and gateway
2. Use HMAC-SHA256 over shared secret + `keyID = "channel-<name>"` to derive 32-byte AES key
3. Generate random 12-byte nonce (GCM standard)
4. Encrypt plaintext with AES-256-GCM (key, nonce, plaintext) → (ciphertext, tag)
5. Store: `nonce || ciphertext || tag` (12 + N + 16 bytes)

**Rust dependencies**:
```toml
aes-gcm = "0.10"
```

**Why BRC-42 + AES instead of ECIES**:
- BRC-42 provides deterministic key derivation (same counterparty → same key)
- AES-256-GCM provides authenticated encryption (prevents tampering)
- Simpler than ECIES (no ephemeral key management)
- Credentials are stored locally, not transmitted over network

---

## 5. File Replacement List

### 5.1 Existing Stubs to Replace (Phase 0)

| File | Current State | Lines | Replacement Scope |
|------|--------------|-------|------------------|
| `src/components/channels/ChannelList.tsx` | 4 LOC stub | 4 | 230 LOC (list, status, enable/disable) |
| `src/components/channels/wizards/WhatsAppWizard.tsx` | 4 LOC stub | 4 | 185 LOC (QR display, session validation) |
| `src/components/channels/wizards/TelegramWizard.tsx` | 4 LOC stub | 4 | 145 LOC (token input, getMe validation) |
| `src/components/channels/wizards/MatrixWizard.tsx` | 4 LOC stub | 4 | 175 LOC (homeserver, login, room list) |
| `src/components/channels/wizards/DiscordWizard.tsx` | 4 LOC stub | 4 | 195 LOC (token/OAuth toggle, validation) |
| `src/components/channels/wizards/SlackWizard.tsx` | 4 LOC stub | 4 | 165 LOC (OAuth flow, auth.test) |
| `src/components/channels/wizards/SignalWizard.tsx` | 4 LOC stub | 4 | 180 LOC (linking QR, pairing confirmation) |
| `src/hooks/useChannels.ts` | 4 LOC stub | 4 | 165 LOC (list, create, update, delete, validate) |
| `src/types/channels.ts` | 49 LOC types | 49 | 125 LOC (+76 LOC validation types, metadata) |

**Total stub replacement**: 9 files, 85 LOC → 1,565 LOC

### 5.2 New Files to Create

#### Backend (Rust)

| File | Purpose | Est. LOC |
|------|---------|---------|
| `src-tauri/src/channels/mod.rs` | Channel domain module exports | 25 |
| `src-tauri/src/channels/types.rs` | Channel config types, status enum | 145 |
| `src-tauri/src/channels/storage.rs` | File-based CRUD (read/write JSON) | 235 |
| `src-tauri/src/channels/encryption.rs` | Encrypt/decrypt wrapper for Crypto Domain | 125 |
| `src-tauri/src/channels/validation.rs` | Gateway validation proxy | 185 |
| `src-tauri/src/commands/channels.rs` | Tauri commands (list, create, update, delete, validate) | 385 |
| `src-tauri/src/tests/channels_tests.rs` | Unit tests (CRUD, encryption, validation) | 425 |

**Total backend**: 7 files, 1,525 LOC

#### Frontend (TypeScript)

| File | Purpose | Est. LOC |
|------|---------|---------|
| `src/components/channels/WizardShell.tsx` | Shared wizard framework component | 245 |
| `src/components/channels/ChannelStatusBadge.tsx` | Status indicator component | 65 |
| `src/lib/channels.ts` | Channel API client (gateway HTTP calls) | 195 |
| `src/lib/validation.ts` | Channel-specific validation helpers | 125 |

**Total new frontend**: 4 files, 630 LOC

#### Tests (TypeScript)

| File | Purpose | Est. LOC |
|------|---------|---------|
| `src/components/channels/__tests__/WizardShell.test.tsx` | Wizard framework tests | 145 |
| `src/components/channels/__tests__/ChannelList.test.tsx` | List component tests | 125 |
| `src/hooks/__tests__/useChannels.test.tsx` | Hook tests (CRUD operations) | 185 |

**Total frontend tests**: 3 files, 455 LOC

---

## 6. Backend CRUD Operations

### 6.1 Tauri Commands

**Command module**: `src-tauri/src/commands/channels.rs`

```rust
#[tauri::command]
pub async fn list_channels(state: State<'_, AppState>) -> Result<Vec<ChannelEntry>, IpcError>;

#[tauri::command]
pub async fn get_channel(name: String, state: State<'_, AppState>) -> Result<ChannelConfig, IpcError>;

#[tauri::command]
pub async fn create_channel(
    config: CreateChannelRequest,
    state: State<'_, AppState>
) -> Result<ChannelConfig, IpcError>;

#[tauri::command]
pub async fn update_channel(
    name: String,
    update: UpdateChannelRequest,
    state: State<'_, AppState>
) -> Result<ChannelConfig, IpcError>;

#[tauri::command]
pub async fn delete_channel(name: String, state: State<'_, AppState>) -> Result<(), IpcError>;

#[tauri::command]
pub async fn validate_channel_credentials(
    name: String,
    credentials: HashMap<String, String>,
    state: State<'_, AppState>
) -> Result<ValidationResult, IpcError>;

#[tauri::command]
pub async fn encrypt_channel_credential(
    value: String,
    channel_name: String,
    state: State<'_, AppState>
) -> Result<String, IpcError>; // Returns hex-encoded ciphertext

#[tauri::command]
pub async fn decrypt_channel_credential(
    ciphertext_hex: String,
    channel_name: String,
    state: State<'_, AppState>
) -> Result<String, IpcError>; // Returns plaintext
```

### 6.2 Storage Backend

**File paths**:
```
~/.edwinpai/
├── channels/
│   ├── whatsapp.json
│   ├── telegram.json
│   ├── matrix.json
│   ├── discord.json
│   ├── slack.json
│   └── signal.json
```

**Storage operations** (src-tauri/src/channels/storage.rs):
- `read_channel_config(name: &str) -> Result<ChannelConfig>`
- `write_channel_config(config: &ChannelConfig) -> Result<()>`
- `delete_channel_config(name: &str) -> Result<()>`
- `list_channel_names() -> Result<Vec<String>>`

**Atomic writes** (same pattern as Phase 3 config.rs):
1. Write to temp file: `~/.edwinpai/channels/.{name}.json.tmp`
2. Validate JSON
3. Rename to final path (atomic on POSIX/Windows)

### 6.3 Validation Backend

**Gateway validation proxy** (src-tauri/src/channels/validation.rs):

Calls gateway validation endpoint for each channel type:

```rust
pub struct ValidationResult {
    pub valid: bool,
    pub error: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

pub async fn validate_whatsapp(
    credentials: &HashMap<String, String>,
    gateway_url: &str
) -> Result<ValidationResult>;

pub async fn validate_telegram(
    credentials: &HashMap<String, String>,
    gateway_url: &str
) -> Result<ValidationResult>;

// ... (same for matrix, discord, slack, signal)
```

**HTTP client**: Use `reqwest` crate (already in Phase 4 dependencies)

**Validation flow**:
1. Desktop app calls `validate_channel_credentials(name, credentials)`
2. Tauri command decrypts stored credentials (if re-validating) OR uses plaintext (if configuring)
3. Calls gateway `POST /v1/edwinpai/channels/<name>/validate` with decrypted credentials
4. Gateway attempts connection to external service (Telegram API, Discord API, etc.)
5. Returns `ValidationResult` with success/failure + metadata

---

## 7. Frontend Components

### 7.1 WizardShell Framework

**Component**: `src/components/channels/WizardShell.tsx`

**Props**:
```typescript
interface WizardShellProps {
  channel: ChannelName;
  onComplete: (config: ChannelConfig) => void;
  onCancel: () => void;
}
```

**Features**:
- Step indicator (1/5 → 5/5)
- Back/Next/Skip buttons
- Validation error display
- Loading states during validation
- Keyboard navigation (Enter → next, Esc → cancel)

**Step rendering**:
```typescript
const steps = [
  <IntroStep channel={channel} />,
  <CredentialStep channel={channel} onChange={setCredentials} />,
  <ValidationStep channel={channel} credentials={credentials} onResult={setValidation} />,
  <ConfirmationStep channel={channel} validation={validation} />,
  <SaveStep channel={channel} config={finalConfig} onSave={handleSave} />
];
```

**State management**:
```typescript
const [currentStep, setCurrentStep] = useState<WizardStep>("intro");
const [credentials, setCredentials] = useState<Record<string, string>>({});
const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
const [error, setError] = useState<string | null>(null);
```

### 7.2 ChannelList Component

**Component**: `src/components/channels/ChannelList.tsx`

**Layout** (SPEC §11.2):
```
┌───────────────────────────────────────────────┐
│   Connected Channels                          │
│   ┌─────────────────────────────────────────┐ │
│   │ ✅ Telegram  @my_edwinpai_bot  [Configure] │ │
│   │ ✅ Discord   EdwinPAI#1234     [Configure] │ │
│   │ ❌ WhatsApp  Not connected  [Set up]    │ │
│   └─────────────────────────────────────────┘ │
│                                               │
│   Available Channels                          │
│   ┌─────────────────────────────────────────┐ │
│   │ Matrix     [Set up]                     │ │
│   │ Slack      [Set up]                     │ │
│   │ Signal     [Set up]                     │ │
│   └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

**Features**:
- List configured channels (read from `~/.edwinpai/channels/`)
- Show status badge (connected/disconnected/error)
- Enable/disable toggle per channel
- "Set up" button → launches wizard
- "Configure" button → re-opens wizard for editing

**Data fetching**:
```typescript
const { channels, isLoading, error, refetch } = useChannels();
```

### 7.3 Channel-Specific Wizards

Each wizard implements channel-specific credential input and validation steps.

#### 7.3.1 WhatsApp Wizard (SPEC §9.2)

**Credential step**:
- Display WhatsApp Web QR code (received from gateway validation endpoint)
- Show "Scan with your phone" instructions
- Poll gateway for session confirmation (WebSocket connected)

**Validation metadata**:
```json
{
  "qrDataUri": "data:image/png;base64,...",
  "phoneNumber": "+1234567890"
}
```

#### 7.3.2 Telegram Wizard (SPEC §9.3)

**Credential step**:
- Text input: "Bot Token" (with link to BotFather instructions)
- Placeholder: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

**Validation metadata**:
```json
{
  "botUsername": "my_edwinpai_bot",
  "botName": "EdwinPAI Assistant"
}
```

#### 7.3.3 Matrix Wizard (SPEC §9.4)

**Credential step**:
- Text input: "Homeserver URL" (e.g., `https://matrix.org`)
- Text input: "Username" (e.g., `@alice:matrix.org`)
- Password input: "Password" OR "Access Token" toggle

**Validation metadata**:
```json
{
  "homeserver": "matrix.org",
  "userId": "@alice:matrix.org"
}
```

#### 7.3.4 Discord Wizard (SPEC §9.5)

**Credential step**:
- Toggle: "Bot Token" OR "OAuth Install"
- If Bot Token: text input
- If OAuth: "Authorize EdwinPAI" button → system browser OAuth flow

**Validation metadata**:
```json
{
  "botUsername": "EdwinPAI",
  "botDiscriminator": "1234"
}
```

#### 7.3.5 Slack Wizard (SPEC §9.6)

**Credential step**:
- "Add to Slack" button → OAuth install flow in system browser
- OAuth redirect handling (deep link back to EdwinPAI app)

**Validation metadata**:
```json
{
  "workspaceName": "My Workspace",
  "teamId": "T1234567890"
}
```

#### 7.3.6 Signal Wizard (SPEC §9.7)

**Credential step**:
- Display Signal linking QR code (received from gateway validation endpoint)
- Show "Scan with Signal app → Linked Devices" instructions
- Poll gateway for pairing confirmation

**Validation metadata**:
```json
{
  "qrDataUri": "data:image/png;base64,...",
  "deviceId": "device-uuid"
}
```

---

## 8. Gateway Integration Points

### 8.1 Gateway Validation Endpoints

**Gateway must implement** (SPEC §10.1 extension):

```
POST /v1/edwinpai/channels/whatsapp/validate
POST /v1/edwinpai/channels/telegram/validate
POST /v1/edwinpai/channels/matrix/validate
POST /v1/edwinpai/channels/discord/validate
POST /v1/edwinpai/channels/slack/validate
POST /v1/edwinpai/channels/signal/validate
```

**Request format** (all endpoints):
```json
{
  "credentials": {
    "botToken": "1234567890:ABC...",
    "otherField": "value"
  }
}
```

**Response format**:
```json
{
  "valid": true,
  "metadata": {
    "botUsername": "my_edwinpai_bot",
    "qrDataUri": "data:image/png;base64,..."
  }
}
```

**Error response**:
```json
{
  "valid": false,
  "error": "Invalid bot token"
}
```

### 8.2 QR Code Flows

**WhatsApp QR flow**:
1. Desktop wizard calls `POST /v1/edwinpai/channels/whatsapp/validate` with empty credentials
2. Gateway initiates WhatsApp Web session via Baileys/whatsapp-web.js
3. Gateway generates QR code, returns as base64 data URI in `metadata.qrDataUri`
4. Desktop displays QR code in wizard
5. User scans QR with phone
6. Gateway detects session connection, returns `valid: true` + phone number in metadata
7. Desktop saves session credentials (encrypted)

**Signal QR flow**:
1. Desktop wizard calls `POST /v1/edwinpai/channels/signal/validate` with empty credentials
2. Gateway initiates Signal linking via Signal-CLI/libsignal
3. Gateway generates linking QR code, returns as data URI
4. Desktop displays QR code
5. User scans QR with Signal app → "Linked Devices"
6. Gateway confirms pairing, returns `valid: true` + device ID
7. Desktop saves linked device credentials (encrypted)

### 8.3 OAuth Flows

**Discord OAuth flow**:
1. Desktop wizard renders "Authorize EdwinPAI" button
2. User clicks → opens system browser to Discord OAuth URL
3. User authorizes → Discord redirects to `edwinpai://oauth/discord?code=ABC...`
4. Desktop catches deep link, extracts `code` parameter
5. Desktop calls `POST /v1/edwinpai/channels/discord/validate` with `{ "oauthCode": "ABC..." }`
6. Gateway exchanges code for access token (Discord OAuth)
7. Gateway validates token, returns `valid: true` + bot metadata
8. Desktop saves OAuth token (encrypted)

**Slack OAuth flow** (same pattern):
1. "Add to Slack" button → system browser
2. Slack OAuth install flow
3. Redirect to `edwinpai://oauth/slack?code=XYZ...`
4. Desktop catches deep link, validates with gateway
5. Gateway exchanges code for access token
6. Desktop saves token

**Deep link handling** (Tauri):
```rust
// src-tauri/src/main.rs
tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![...])
    .setup(|app| {
        #[cfg(any(windows, target_os = "linux"))]
        {
            use tauri_plugin_deep_link::DeepLinkExt;
            app.deep_link().register_all()?;
        }
        Ok(())
    })
```

**URL scheme**: `edwinpai://oauth/<channel>?code=<oauth_code>`

---

## 9. Validation Requirements

### 9.1 Frontend Validation

**Input validation** (before calling gateway):

| Channel | Field | Validation Rule |
|---------|-------|----------------|
| Telegram | Bot Token | Regex: `^\d+:[A-Za-z0-9_-]{35}$` |
| Matrix | Homeserver URL | Valid HTTPS URL |
| Matrix | Username | Regex: `^@[a-z0-9._=-]+:[a-z0-9.-]+$` |
| Discord | Bot Token | Min length: 50, starts with `MTA` OR `ODc` |
| Slack | OAuth code | Min length: 20 |
| Signal | (QR-based) | No input validation |
| WhatsApp | (QR-based) | No input validation |

**Validation helpers** (src/lib/validation.ts):
```typescript
export const VALIDATION_RULES: Record<ChannelName, Record<string, (value: string) => boolean>> = {
  telegram: {
    botToken: (v) => /^\d+:[A-Za-z0-9_-]{35}$/.test(v),
  },
  matrix: {
    homeserverUrl: (v) => /^https:\/\/.+/.test(v),
    username: (v) => /^@[a-z0-9._=-]+:[a-z0-9.-]+$/.test(v),
  },
  // ...
};
```

### 9.2 Backend Validation

**Gateway validation logic** (gateway must implement):

| Channel | Validation Method | Expected Response |
|---------|------------------|-------------------|
| WhatsApp | Initiate WhatsApp Web session | QR code + session status |
| Telegram | Call `GET https://api.telegram.org/bot<token>/getMe` | Bot username/name |
| Matrix | Call Matrix login API with credentials | User ID + access token |
| Discord | Call `GET https://discord.com/api/v10/users/@me` with token | Bot username/discriminator |
| Slack | Call `https://slack.com/api/auth.test` with token | Workspace name |
| Signal | Initiate Signal linking via Signal-CLI | Linking QR + pairing status |

**Validation timeout**: 30 seconds per channel

**Error handling**:
- Network errors → `{ valid: false, error: "Network error: <details>" }`
- Invalid credentials → `{ valid: false, error: "Invalid credentials: <details>" }`
- Timeout → `{ valid: false, error: "Validation timed out after 30s" }`

---

## 10. Testing Requirements

### 10.1 Backend Tests

**Test file**: `src-tauri/src/tests/channels_tests.rs`

**Test coverage** (~70 tests):

1. **CRUD operations** (20 tests):
   - `test_create_channel_success()`
   - `test_create_channel_duplicate_fails()`
   - `test_update_channel_enabled_flag()`
   - `test_delete_channel_removes_file()`
   - `test_list_channels_returns_all()`
   - `test_get_nonexistent_channel_fails()`
   - ... (14 more CRUD tests)

2. **Encryption/Decryption** (15 tests):
   - `test_encrypt_channel_credential()`
   - `test_decrypt_channel_credential()`
   - `test_encrypt_decrypt_roundtrip()`
   - `test_decrypt_invalid_ciphertext_fails()`
   - `test_encrypt_different_channels_different_keys()`
   - ... (10 more encryption tests)

3. **Validation proxy** (20 tests):
   - `test_validate_telegram_success()`
   - `test_validate_telegram_invalid_token()`
   - `test_validate_matrix_success()`
   - `test_validate_whatsapp_qr_generation()`
   - `test_validate_signal_linking_flow()`
   - ... (15 more validation tests)

4. **Storage** (15 tests):
   - `test_atomic_write_channel_config()`
   - `test_read_malformed_json_fails()`
   - `test_write_validates_schema()`
   - `test_delete_nonexistent_channel_idempotent()`
   - ... (11 more storage tests)

**Mock strategy**:
- **HTTP mocking**: Use `mockito` crate for gateway validation endpoints
- **File system**: Use temp directories for test configs
- **Crypto Domain**: Mock encrypt/decrypt calls with fixed test vectors

### 10.2 Frontend Tests

**Test files**:
- `src/components/channels/__tests__/WizardShell.test.tsx` (25 tests)
- `src/components/channels/__tests__/ChannelList.test.tsx` (20 tests)
- `src/hooks/__tests__/useChannels.test.tsx` (25 tests)

**Test coverage** (~70 tests):

1. **WizardShell** (25 tests):
   - `renders intro step initially`
   - `advances to next step on Next button`
   - `goes back to previous step on Back button`
   - `disables Next button during validation`
   - `displays validation errors`
   - `calls onComplete when wizard finishes`
   - `calls onCancel on Escape key`
   - ... (18 more wizard tests)

2. **ChannelList** (20 tests):
   - `renders empty state when no channels configured`
   - `displays configured channels with status badges`
   - `shows Set up button for unconfigured channels`
   - `opens wizard on Set up button click`
   - `toggles channel enabled state`
   - ... (15 more list tests)

3. **useChannels hook** (25 tests):
   - `fetches channel list on mount`
   - `creates new channel with encrypted credentials`
   - `updates channel settings`
   - `deletes channel and removes file`
   - `validates credentials before saving`
   - `handles validation errors`
   - ... (19 more hook tests)

**Mock strategy**:
- **Tauri IPC**: Mock `invoke` calls with MSW or vitest mocks
- **Gateway API**: Mock HTTP responses for validation endpoints
- **Crypto Domain**: Mock encrypt/decrypt with test vectors

### 10.3 Integration Tests

**E2E tests** (Playwright, src/e2e/channels.spec.ts):

1. `test("WhatsApp wizard flow", async ({ page }) => { ... })`
2. `test("Telegram wizard flow", async ({ page }) => { ... })`
3. `test("Channel enable/disable toggle", async ({ page }) => { ... })`
4. `test("Channel deletion", async ({ page }) => { ... })`
5. `test("Validation error handling", async ({ page }) => { ... })`

**Total E2E**: 5 scenarios (~150 LOC)

---

## Appendix A: Existing Type Definitions

### A.1 Current channels.ts (49 LOC)

```typescript
export type ChannelName =
  | "whatsapp"
  | "telegram"
  | "matrix"
  | "discord"
  | "slack"
  | "signal";

export interface ChannelSettings {
  autoReply: boolean;
  allowedChatIds: string[];
}

export interface ChannelConfig {
  channel: ChannelName;
  enabled: boolean;
  configuredAt: string;
  configuredBy: string;
  credentials: Record<string, string>; // Encrypted values
  settings: ChannelSettings;
}

export type WizardStep =
  | "intro"
  | "credentials"
  | "validation"
  | "confirmation"
  | "saved";

export interface WizardState {
  channel: ChannelName;
  currentStep: WizardStep;
  error?: string;
}
```

### A.2 Required Type Extensions (+76 LOC)

```typescript
// Validation types
export interface ValidationResult {
  valid: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Channel-specific metadata
export interface WhatsAppMetadata {
  qrDataUri?: string;
  phoneNumber?: string;
  sessionConnected: boolean;
}

export interface TelegramMetadata {
  botUsername?: string;
  botName?: string;
}

export interface MatrixMetadata {
  homeserver?: string;
  userId?: string;
}

export interface DiscordMetadata {
  botUsername?: string;
  botDiscriminator?: string;
}

export interface SlackMetadata {
  workspaceName?: string;
  teamId?: string;
}

export interface SignalMetadata {
  qrDataUri?: string;
  deviceId?: string;
}

// CRUD request types
export interface CreateChannelRequest {
  channel: ChannelName;
  credentials: Record<string, string>; // Plaintext, will be encrypted
  settings?: Partial<ChannelSettings>;
}

export interface UpdateChannelRequest {
  enabled?: boolean;
  settings?: Partial<ChannelSettings>;
  credentials?: Record<string, string>; // Plaintext, will be encrypted
}

// Hook return types
export interface UseChannelsReturn {
  channels: ChannelConfig[];
  isLoading: boolean;
  error: Error | null;
  createChannel: (req: CreateChannelRequest) => Promise<ChannelConfig>;
  updateChannel: (name: ChannelName, req: UpdateChannelRequest) => Promise<ChannelConfig>;
  deleteChannel: (name: ChannelName) => Promise<void>;
  validateCredentials: (name: ChannelName, credentials: Record<string, string>) => Promise<ValidationResult>;
  refetch: () => Promise<void>;
}
```

---

## Appendix B: Gateway Validation Endpoint Implementations

**Gateway must implement these endpoints** (not part of Desktop Phase 5, but required for integration):

### B.1 WhatsApp Validation

```typescript
// Gateway implementation (conceptual)
app.post('/v1/edwinpai/channels/whatsapp/validate', async (req, res) => {
  const { credentials } = req.body;

  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const sock = makeWASocket({ auth: state });

    // Generate QR code
    const qr = await sock.waitForConnectionUpdate((update) => update.qr);
    const qrDataUri = await QRCode.toDataURL(qr);

    // Wait for connection (with timeout)
    const connected = await sock.waitForConnectionUpdate(
      (update) => update.connection === 'open',
      { timeout: 30000 }
    );

    if (connected) {
      res.json({
        valid: true,
        metadata: {
          qrDataUri,
          phoneNumber: sock.user.id.split(':')[0]
        }
      });
    }
  } catch (err) {
    res.json({ valid: false, error: err.message });
  }
});
```

### B.2 Telegram Validation

```typescript
app.post('/v1/edwinpai/channels/telegram/validate', async (req, res) => {
  const { credentials } = req.body;
  const { botToken } = credentials;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();

    if (data.ok) {
      res.json({
        valid: true,
        metadata: {
          botUsername: data.result.username,
          botName: data.result.first_name
        }
      });
    } else {
      res.json({ valid: false, error: data.description });
    }
  } catch (err) {
    res.json({ valid: false, error: err.message });
  }
});
```

*Similar implementations required for Matrix, Discord, Slack, Signal.*

---

## Appendix C: Dependencies

### C.1 New Rust Dependencies

```toml
[dependencies]
# Encryption
aes-gcm = "0.10"

# Already in Phase 4 (no new deps needed):
# - reqwest (HTTP client for validation)
# - serde_json (JSON serialization)
# - tokio (async runtime)
```

### C.2 New TypeScript Dependencies

```json
{
  "dependencies": {
    "qrcode.react": "^4.1.0"  // Already in Phase 4
  }
}
```

**No new npm dependencies required** — QR code rendering already available from Phase 4.

---

**End of Requirements Document**

**Next steps**:
1. Implement Crypto Domain encrypt/decrypt (complete Phase 1 stubs)
2. Implement backend CRUD + validation proxy
3. Implement WizardShell framework
4. Implement 6 channel wizards
5. Implement ChannelList component
6. Write tests (140 total)
7. Gateway validation endpoints (separate task for gateway repo)
8. CI validation + E2E tests
