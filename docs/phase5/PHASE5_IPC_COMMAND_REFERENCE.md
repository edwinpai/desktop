# Phase 5 IPC Command Reference

**Date**: 2026-02-11
**Phase**: 5 - Channel Integration Wizards
**Total Commands**: 8 (create, read, read_decrypted, update, delete, list, validate, toggle)

---

## Command Index

| # | Command | Purpose | Permissions | Returns |
|---|---------|---------|-------------|---------|
| 1 | `create_channel` | Create new channel with encrypted credentials | Owner, Member | `()` |
| 2 | `read_channel` | Read channel (credentials encrypted) | All roles | `ChannelConfig` |
| 3 | `read_channel_decrypted` | Read channel (credentials plaintext) | Owner, Member | `ChannelConfig` |
| 4 | `update_channel` | Update channel properties | Owner, Member | `()` |
| 5 | `delete_channel` | Delete channel and file | Owner, Member | `()` |
| 6 | `list_channels` | List channels with filters | All roles | `Vec<ChannelConfig>` |
| 7 | `validate_channel` | Validate credentials format | All roles | `ValidationResult` |
| 8 | `toggle_channel` | Toggle enabled/disabled state | Owner, Member | `bool` |

---

## 1. create_channel

### Rust Signature

```rust
#[tauri::command]
pub async fn create_channel(
    name: String,
    platform: PlatformType,
    credentials: String,
    metadata: ChannelMetadata,
) -> Result<(), String>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `String` | ✅ | Unique channel identifier (alphanumeric + hyphens) |
| `platform` | `PlatformType` | ✅ | One of: `telegram`, `matrix`, `discord`, `slack`, `whatsapp`, `signal` |
| `credentials` | `String` | ✅ | Plaintext JSON credentials (will be encrypted server-side) |
| `metadata` | `ChannelMetadata` | ✅ | Display name, description, icon |

### Return Value

- **Success**: `Ok(())` - Channel created successfully
- **Error**: `Err(String)` - Error codes:
  - `"channel_exists"` - Channel with this name already exists
  - `"encryption_failed"` - BRC-42 encryption failed
  - `"invalid_credentials"` - Credentials JSON parse failed
  - `"permission_denied"` - Guest role attempted creation

### TypeScript Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { PlatformType, ChannelMetadata } from '@/types/channels';

const credentials = {
  bot_token: '123456:ABC-DEF1234567890',
};

const metadata: ChannelMetadata = {
  display_name: 'My Telegram Bot',
  description: 'Customer support bot',
  icon: null,
  last_message_at: null,
  message_count: 0,
  error_count: 0,
};

try {
  await invoke<void>('create_channel', {
    name: 'my-telegram-bot',
    platform: 'telegram' as PlatformType,
    credentials: JSON.stringify(credentials),
    metadata,
  });
  console.log('Channel created successfully');
} catch (error) {
  console.error('Failed to create channel:', error);
}
```

### Backend Workflow

1. **Permission Check**: Verify user has `UserPermission::ChannelWrite`
2. **Name Validation**: Check channel name is unique (not already in `~/.edwinpai/channels/`)
3. **Credential Encryption**: Call `encrypt_credentials(name, credentials)` using BRC-42
4. **File Creation**: Save to `~/.edwinpai/channels/{name}.json` (atomic write)
5. **Audit Log**: Append creation event to Phase 1 audit log

### File Created

```
~/.edwinpai/channels/my-telegram-bot.json
```

**Contents** (encrypted credentials):
```json
{
  "name": "my-telegram-bot",
  "platform": "telegram",
  "enabled": true,
  "credentials": "a3f8c2d1e4f5...",  // Encrypted hex
  "metadata": {
    "display_name": "My Telegram Bot",
    "description": "Customer support bot",
    "icon": null,
    "last_message_at": null,
    "message_count": 0,
    "error_count": 0
  },
  "created_at": 1707696000,
  "updated_at": 1707696000
}
```

### Test Coverage

- Unit tests: 5 (in `commands/channels.rs`)
- Integration tests: 3 (in `tests/phase5_integration.rs`)

---

## 2. read_channel

### Rust Signature

```rust
#[tauri::command]
pub async fn read_channel(
    name: String,
) -> Result<ChannelConfig, String>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `String` | ✅ | Channel name to read |

### Return Value

- **Success**: `Ok(ChannelConfig)` - Channel config with **encrypted** credentials
- **Error**: `Err(String)` - Error codes:
  - `"channel_not_found"` - No file at `~/.edwinpai/channels/{name}.json`
  - `"permission_denied"` - Guest role attempted read (should allow, but checks anyway)

### TypeScript Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { ChannelConfig } from '@/types/channels';

try {
  const channel = await invoke<ChannelConfig>('read_channel', {
    name: 'my-telegram-bot',
  });

  console.log('Display name:', channel.metadata.display_name);
  console.log('Enabled:', channel.enabled);
  console.log('Credentials (encrypted):', channel.credentials);  // Hex string

  // To display encrypted credentials is useless - use read_channel_decrypted instead
} catch (error) {
  console.error('Failed to read channel:', error);
}
```

### Use Cases

1. **Display List**: Show channel name, platform, enabled status (no decryption needed)
2. **Status Check**: Verify channel exists before operations
3. **Read-Only Access**: Guest users can see metadata but not credentials

### Performance

- **Fast**: No BRC-42 decryption overhead
- **Safe**: Credentials never exposed to frontend in plaintext

---

## 3. read_channel_decrypted

### Rust Signature

```rust
#[tauri::command]
pub async fn read_channel_decrypted(
    name: String,
) -> Result<ChannelConfig, String>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `String` | ✅ | Channel name to read |

### Return Value

- **Success**: `Ok(ChannelConfig)` - Channel config with **decrypted** credentials (plaintext JSON)
- **Error**: `Err(String)` - Error codes:
  - `"channel_not_found"` - No file at `~/.edwinpai/channels/{name}.json`
  - `"decryption_failed"` - BRC-42 decryption failed (corrupted file?)
  - `"permission_denied"` - Guest role attempted read

### TypeScript Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { ChannelConfig, TelegramCredentials } from '@/types/channels';

try {
  const channel = await invoke<ChannelConfig>('read_channel_decrypted', {
    name: 'my-telegram-bot',
  });

  // Credentials are plaintext JSON
  const creds = JSON.parse(channel.credentials) as TelegramCredentials;
  console.log('Bot token:', creds.bot_token);  // 123456:ABC-DEF1234567890

  // Use in edit wizard to pre-fill form
} catch (error) {
  if (error === 'permission_denied') {
    console.error('Guest users cannot read decrypted credentials');
  } else {
    console.error('Failed to read channel:', error);
  }
}
```

### Use Cases

1. **Edit Wizard**: Pre-fill form with existing credentials
2. **Credential Export**: Allow owner to export credentials (backup)
3. **Debug Mode**: Verify credentials are correct (testing only)

### Security Notes

- ⚠️ **Sensitive Data**: Always use HTTPS for transport (if remote)
- ⚠️ **Permission Check**: Only Owner/Member roles allowed
- ⚠️ **Audit Log**: Log all decryption requests (Phase 1 audit)

### Performance

- **Slower**: Requires BRC-42 decryption (~1-2ms overhead)
- **Use Sparingly**: Only call when editing credentials

---

## 4. update_channel

### Rust Signature

```rust
#[tauri::command]
pub async fn update_channel(
    name: String,
    credentials: Option<String>,
    metadata: Option<ChannelMetadata>,
    enabled: Option<bool>,
) -> Result<(), String>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `String` | ✅ | Channel name to update |
| `credentials` | `Option<String>` | ❌ | New plaintext credentials (will be re-encrypted) |
| `metadata` | `Option<ChannelMetadata>` | ❌ | New metadata (display name, description, icon) |
| `enabled` | `Option<bool>` | ❌ | New enabled state |

### Return Value

- **Success**: `Ok(())` - Channel updated successfully
- **Error**: `Err(String)` - Error codes:
  - `"channel_not_found"` - Channel doesn't exist
  - `"encryption_failed"` - Re-encryption failed
  - `"permission_denied"` - Guest role attempted update

### TypeScript Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Update credentials only
await invoke<void>('update_channel', {
  name: 'my-telegram-bot',
  credentials: JSON.stringify({ bot_token: 'new-token' }),
  metadata: null,
  enabled: null,
});

// Update metadata only
await invoke<void>('update_channel', {
  name: 'my-telegram-bot',
  credentials: null,
  metadata: {
    display_name: 'Updated Bot Name',
    description: 'New description',
    icon: null,
    last_message_at: null,
    message_count: 0,
    error_count: 0,
  },
  enabled: null,
});

// Update multiple fields
await invoke<void>('update_channel', {
  name: 'my-telegram-bot',
  credentials: JSON.stringify({ bot_token: 'new-token' }),
  metadata: { display_name: 'New Name', /* ... */ },
  enabled: true,
});
```

### Backend Workflow

1. **Load Existing**: Read `~/.edwinpai/channels/{name}.json`
2. **Apply Updates**:
   - If `credentials` provided: Re-encrypt with BRC-42
   - If `metadata` provided: Replace metadata object
   - If `enabled` provided: Update enabled boolean
3. **Update Timestamp**: Set `updated_at` to current Unix timestamp
4. **Atomic Write**: Save updated config (temp file + rename)

### Partial Updates

- **Null Parameters**: Fields with `null` are NOT updated (keep existing value)
- **Example**: Update only `display_name` without touching credentials

---

## 5. delete_channel

### Rust Signature

```rust
#[tauri::command]
pub async fn delete_channel(
    name: String,
) -> Result<(), String>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `String` | ✅ | Channel name to delete |

### Return Value

- **Success**: `Ok(())` - Channel deleted successfully
- **Error**: `Err(String)` - Error codes:
  - `"channel_not_found"` - Channel doesn't exist
  - `"permission_denied"` - Guest role attempted deletion

### TypeScript Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';

try {
  await invoke<void>('delete_channel', {
    name: 'my-telegram-bot',
  });
  console.log('Channel deleted successfully');
} catch (error) {
  console.error('Failed to delete channel:', error);
}
```

### Backend Workflow

1. **Permission Check**: Verify `UserPermission::ChannelWrite`
2. **File Deletion**: `fs::remove_file(~/.edwinpai/channels/{name}.json)`
3. **Audit Log**: Log deletion event

### File Deleted

```
~/.edwinpai/channels/my-telegram-bot.json  # Removed
```

### Data Recovery

- **No Soft Delete**: File is permanently removed (no recycle bin)
- **Recommendation**: Warn user before deletion (frontend confirmation dialog)

---

## 6. list_channels

### Rust Signature

```rust
#[tauri::command]
pub async fn list_channels(
    platform: Option<PlatformType>,
    enabled_only: bool,
) -> Result<Vec<ChannelConfig>, String>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | `Option<PlatformType>` | ❌ | Filter by platform (null = all platforms) |
| `enabled_only` | `bool` | ✅ | If true, return only enabled channels |

### Return Value

- **Success**: `Ok(Vec<ChannelConfig>)` - List of channels (credentials **encrypted**)
- **Error**: `Err(String)` - Rarely fails (returns empty array if directory missing)

### TypeScript Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { ChannelConfig, PlatformType } from '@/types/channels';

// List all channels
const allChannels = await invoke<ChannelConfig[]>('list_channels', {
  platform: null,
  enabled_only: false,
});
console.log(`Total channels: ${allChannels.length}`);

// List only Telegram channels
const telegramChannels = await invoke<ChannelConfig[]>('list_channels', {
  platform: 'telegram' as PlatformType,
  enabled_only: false,
});

// List only enabled channels (all platforms)
const enabledChannels = await invoke<ChannelConfig[]>('list_channels', {
  platform: null,
  enabled_only: true,
});

// List enabled Discord channels
const enabledDiscord = await invoke<ChannelConfig[]>('list_channels', {
  platform: 'discord' as PlatformType,
  enabled_only: true,
});
```

### Backend Workflow

1. **Read Directory**: Scan `~/.edwinpai/channels/` for `.json` files
2. **Parse Files**: Deserialize each file into `ChannelConfig`
3. **Apply Filters**:
   - If `platform` provided: Keep only matching platform
   - If `enabled_only=true`: Keep only `enabled=true`
4. **Return List**: Sorted by `created_at` (oldest first)

### Performance

- **Fast**: Reads directory (~10ms for 100 channels)
- **No Decryption**: Credentials remain encrypted (cheap)

### Use Cases

1. **Channel List View**: Display all channels with status
2. **Platform Filter**: Show only Telegram channels
3. **Active Channels**: Show only enabled channels for messaging

---

## 7. validate_channel

### Rust Signature

```rust
#[tauri::command]
pub async fn validate_channel(
    platform: PlatformType,
    credentials: String,
) -> Result<ValidationResult, String>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | `PlatformType` | ✅ | Platform to validate against |
| `credentials` | `String` | ✅ | Plaintext JSON credentials |

### Return Value

- **Success**: `Ok(ValidationResult)` - Validation result with errors/warnings
- **Error**: `Err(String)` - Error codes:
  - `"invalid_credentials"` - JSON parse failed
  - `"platform_unsupported"` - Unknown platform type

### ValidationResult Structure

```rust
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub metadata: serde_json::Value,
}
```

### TypeScript Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { ValidationResult, PlatformType } from '@/types/channels';

const credentials = {
  bot_token: '123456:ABC-DEF1234567890',
};

const result = await invoke<ValidationResult>('validate_channel', {
  platform: 'telegram' as PlatformType,
  credentials: JSON.stringify(credentials),
});

if (result.valid) {
  console.log('Credentials are valid!');
  console.log('Bot ID:', result.metadata.bot_id);  // Extracted from token
} else {
  console.error('Validation errors:', result.errors);
  // ["Invalid bot token format", "Token too short"]
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
  // ["This token format is deprecated"]
}
```

### Validation Rules by Platform

#### Telegram
- **Format**: `{BOT_ID}:{AUTH_TOKEN}`
- **Regex**: `^\d+:[A-Za-z0-9_-]{35}$`
- **Metadata**: `{ bot_id: string }`

#### Matrix
- **Required**: `homeserver` + (`access_token` OR `username`+`password`)
- **Homeserver Format**: Valid URL (https://)
- **Metadata**: `{ homeserver: string, auth_method: "token"|"password" }`

#### Discord
- **Required**: `bot_token` OR `oauth_token`
- **Bot Token Prefix**: `Bot ` (optional)
- **Metadata**: `{ auth_method: "bot"|"oauth" }`

#### Slack
- **Bot Token Prefix**: `xoxb-`
- **App Token Prefix**: `xoxp-` (optional)
- **Metadata**: `{ token_type: "bot"|"app" }`

#### WhatsApp
- **Format**: Valid JSON object
- **Metadata**: `{ session_keys_count: number }`

#### Signal
- **Format**: Valid JSON object
- **Metadata**: `{ device_id: string }` (if present)

### Use Cases

1. **Wizard Validation**: Real-time validation as user types
2. **Pre-Create Check**: Validate before calling `create_channel`
3. **Credential Testing**: Verify credentials without saving

### Backend Workflow

1. **Parse JSON**: Deserialize credentials string
2. **Platform Dispatch**: Call platform-specific validator
3. **Extract Metadata**: Parse bot IDs, homeservers, etc.
4. **Return Result**: Include errors, warnings, metadata

### Important Notes

- ⚠️ **No API Calls**: Validation is schema-only (no live authentication)
- ⚠️ **Fast**: Returns in <1ms (pure regex/JSON parsing)
- ✅ **Safe**: No rate limiting from third-party APIs

---

## 8. toggle_channel

### Rust Signature

```rust
#[tauri::command]
pub async fn toggle_channel(
    name: String,
) -> Result<bool, String>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `String` | ✅ | Channel name to toggle |

### Return Value

- **Success**: `Ok(bool)` - New enabled state (`true` = enabled, `false` = disabled)
- **Error**: `Err(String)` - Error codes:
  - `"channel_not_found"` - Channel doesn't exist
  - `"permission_denied"` - Guest role attempted toggle

### TypeScript Usage

```typescript
import { invoke } from '@tauri-apps/api/tauri';

try {
  const newState = await invoke<boolean>('toggle_channel', {
    name: 'my-telegram-bot',
  });

  console.log(`Channel is now ${newState ? 'enabled' : 'disabled'}`);

  // Update UI to reflect new state
  setChannelEnabled(newState);
} catch (error) {
  console.error('Failed to toggle channel:', error);
}
```

### Backend Workflow

1. **Load Channel**: Read `~/.edwinpai/channels/{name}.json`
2. **Toggle State**: `enabled = !enabled`
3. **Update Timestamp**: `updated_at = current_timestamp`
4. **Save**: Atomic write
5. **Return**: New `enabled` value

### Use Cases

1. **Quick Enable/Disable**: Single-click toggle in UI
2. **Bulk Operations**: Disable all channels, enable only one
3. **Status Management**: Temporary disable without deleting

### Equivalent to

```rust
update_channel(name, None, None, Some(!current_enabled))
```

**But faster**: No need to load + merge + save (just toggle boolean)

---

## Permission Matrix

| Command | Owner | Member | Guest | Notes |
|---------|-------|--------|-------|-------|
| `create_channel` | ✅ | ✅ | ❌ | Requires `ChannelWrite` |
| `read_channel` | ✅ | ✅ | ✅ | Credentials encrypted (safe) |
| `read_channel_decrypted` | ✅ | ✅ | ❌ | Requires `ChannelWrite` |
| `update_channel` | ✅ | ✅ | ❌ | Requires `ChannelWrite` |
| `delete_channel` | ✅ | ✅ | ❌ | Requires `ChannelWrite` |
| `list_channels` | ✅ | ✅ | ✅ | Credentials encrypted (safe) |
| `validate_channel` | ✅ | ✅ | ✅ | No persistent state change |
| `toggle_channel` | ✅ | ✅ | ❌ | Requires `ChannelWrite` |

**Permission Types** (Phase 4 `auth/users.rs`):
- `ChannelRead`: `read_channel`, `list_channels`, `validate_channel`
- `ChannelWrite`: `create_channel`, `update_channel`, `delete_channel`, `toggle_channel`, `read_channel_decrypted`

---

## Error Handling Best Practices

### Frontend Error Handling

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { ApiErrorCode } from '@/types/api';

async function createChannel(name: string, platform: PlatformType, credentials: string) {
  try {
    await invoke<void>('create_channel', {
      name,
      platform,
      credentials,
      metadata: { display_name: name, /* ... */ },
    });
    return { success: true };
  } catch (error) {
    const code = error as ApiErrorCode;

    switch (code) {
      case 'channel_exists':
        return { success: false, message: 'A channel with this name already exists' };
      case 'encryption_failed':
        return { success: false, message: 'Failed to encrypt credentials. Please try again.' };
      case 'invalid_credentials':
        return { success: false, message: 'Invalid credentials format' };
      case 'permission_denied':
        return { success: false, message: 'You do not have permission to create channels' };
      default:
        return { success: false, message: 'An unexpected error occurred' };
    }
  }
}
```

### Error Code Reference

| Error Code | HTTP Equivalent | Description |
|------------|-----------------|-------------|
| `channel_not_found` | 404 | Channel file doesn't exist |
| `channel_exists` | 409 | Channel name already taken |
| `invalid_credentials` | 400 | Credentials JSON parse failed |
| `encryption_failed` | 500 | BRC-42 encryption failed |
| `decryption_failed` | 500 | BRC-42 decryption failed |
| `platform_unsupported` | 400 | Unknown platform type |
| `permission_denied` | 403 | User lacks required permission |

---

## Performance Benchmarks

### Command Execution Times (Estimated)

| Command | Fast Path | Slow Path | Notes |
|---------|-----------|-----------|-------|
| `create_channel` | 5ms | 15ms | Encryption overhead |
| `read_channel` | 2ms | 5ms | File I/O only |
| `read_channel_decrypted` | 6ms | 18ms | Decryption overhead |
| `update_channel` | 7ms | 20ms | Re-encryption |
| `delete_channel` | 3ms | 8ms | File deletion |
| `list_channels` | 10ms | 50ms | Scales with channel count |
| `validate_channel` | <1ms | 2ms | Pure validation (no I/O) |
| `toggle_channel` | 4ms | 12ms | Read + write |

**Test Environment**: SSD, 10 channels, single-threaded
**Slow Path**: Directory traversal, file sync, error handling

---

## Testing Recommendations

### Unit Tests (Backend)

```rust
#[tokio::test]
async fn test_create_channel_encrypts_credentials() {
    let result = create_channel(
        "test-bot".to_string(),
        PlatformType::Telegram,
        r#"{"bot_token":"123:abc"}"#.to_string(),
        ChannelMetadata { /* ... */ },
    ).await;

    assert!(result.is_ok());

    // Verify file exists
    let path = get_channels_dir().unwrap().join("test-bot.json");
    assert!(path.exists());

    // Verify credentials are encrypted
    let contents = fs::read_to_string(path).unwrap();
    let config: ChannelConfig = serde_json::from_str(&contents).unwrap();
    assert_ne!(config.credentials, r#"{"bot_token":"123:abc"}"#);  // Not plaintext
    assert!(config.credentials.chars().all(|c| c.is_ascii_hexdigit()));  // Is hex
}
```

### Integration Tests (Frontend)

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/tauri';
import { ChannelList } from '@/components/channels/ChannelList';

vi.mock('@tauri-apps/api/tauri');

test('creates channel and updates list', async () => {
  const mockInvoke = vi.mocked(invoke);
  mockInvoke.mockImplementation((cmd) => {
    if (cmd === 'list_channels') return Promise.resolve([]);
    if (cmd === 'create_channel') return Promise.resolve();
    return Promise.reject('Unknown command');
  });

  render(<ChannelList />);

  fireEvent.click(screen.getByText('Add Channel'));
  // ... fill wizard form
  fireEvent.click(screen.getByText('Create'));

  await waitFor(() => {
    expect(mockInvoke).toHaveBeenCalledWith('create_channel', expect.any(Object));
    expect(mockInvoke).toHaveBeenCalledWith('list_channels', expect.any(Object));
  });
});
```

---

## Appendix: Type Definitions

### Rust Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfig {
    pub name: String,
    pub platform: PlatformType,
    pub enabled: bool,
    pub credentials: String,
    pub metadata: ChannelMetadata,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelMetadata {
    pub display_name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub last_message_at: Option<i64>,
    pub message_count: u64,
    pub error_count: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlatformType {
    Telegram,
    Matrix,
    Discord,
    Slack,
    WhatsApp,
    Signal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub metadata: serde_json::Value,
}
```

### TypeScript Types

```typescript
export interface ChannelConfig {
  name: string;
  platform: PlatformType;
  enabled: boolean;
  credentials: string;
  metadata: ChannelMetadata;
  created_at: number;
  updated_at: number;
}

export interface ChannelMetadata {
  display_name: string;
  description?: string;
  icon?: string;
  last_message_at?: number;
  message_count: number;
  error_count: number;
}

export type PlatformType =
  | "telegram"
  | "matrix"
  | "discord"
  | "slack"
  | "whatsapp"
  | "signal";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: Record<string, unknown>;
}
```

---

**Document Version**: 1.0
**Date**: 2026-02-11
**Total Commands**: 8
**Total LOC**: 350 (commands/channels.rs)
**Test Coverage**: 10 unit tests + 35 integration tests (planned)
