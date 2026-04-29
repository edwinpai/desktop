# Phase 5 Frontend Integration Checklist

**Date**: 2026-02-11
**Status**: Backend COMPLETE, Frontend PENDING
**Estimated Frontend LOC**: ~2,400 (1,200 production + 1,200 tests)
**Estimated Duration**: 6-8 hours

---

## Overview

This checklist defines the frontend implementation requirements to integrate with the Phase 5 backend (channel domain + 8 CRUD commands). All backend commands are tested and ready for frontend consumption.

---

## 1. Type Definitions (~200 LOC)

### 1.1 Type Extensions: `src/types/channels.ts`
**Purpose**: TypeScript definitions for Rust types from backend

**Required Types**:
```typescript
// Core channel types
export type ChannelPlatform = 'WhatsApp' | 'Telegram' | 'Matrix' | 'Discord' | 'Slack' | 'Signal';

export interface ChannelConfig {
  name: string;
  platform: ChannelPlatform;
  enabled: boolean;
  credentials: PlatformCredentials;
  created_at: number;
  updated_at: number;
}

// Platform credential schemas (6 variants)
export type PlatformCredentials =
  | { type: 'WhatsApp'; session_data: string }
  | { type: 'Telegram'; bot_token: string }
  | { type: 'Matrix'; homeserver: string; access_token?: string; username?: string; password?: string }
  | { type: 'Discord'; bot_token?: string; client_id?: string; client_secret?: string }
  | { type: 'Slack'; access_token: string; refresh_token?: string }
  | { type: 'Signal'; device_data: string };

// Wizard state
export interface ChannelWizardState {
  step: 'platform' | 'credentials' | 'confirmation';
  platform?: ChannelPlatform;
  config?: Partial<ChannelConfig>;
  errors?: Record<string, string>;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: Record<string, string>;
}

// Update payload
export interface ChannelConfigUpdate {
  enabled?: boolean;
  credentials?: PlatformCredentials;
}
```

**Tests** (~30 tests):
- Type guards for `PlatformCredentials` variants
- Wizard state transitions
- Validation result parsing

---

## 2. IPC Command Wrappers (~180 LOC)

### 2.1 Library: `src/lib/channels.ts`
**Purpose**: Type-safe wrappers for 8 backend commands

**Required Functions**:
```typescript
import { invoke } from '@tauri-apps/api/core';
import type { ChannelConfig, ChannelConfigUpdate, ValidationResult } from '@/types/channels';

export async function createChannel(config: ChannelConfig): Promise<void> {
  return invoke('create_channel_cmd', { config });
}

export async function readChannel(name: string): Promise<ChannelConfig> {
  return invoke('read_channel_cmd', { name });
}

export async function readChannelDecrypted(name: string): Promise<ChannelConfig> {
  return invoke('read_channel_decrypted_cmd', { name });
}

export async function updateChannel(name: string, updates: ChannelConfigUpdate): Promise<void> {
  return invoke('update_channel_cmd', { name, updates });
}

export async function deleteChannel(name: string): Promise<void> {
  return invoke('delete_channel_cmd', { name });
}

export async function listChannels(): Promise<ChannelConfig[]> {
  return invoke('list_channels_cmd');
}

export async function validateChannel(config: ChannelConfig): Promise<ValidationResult> {
  return invoke('validate_channel_cmd', { config });
}

export async function toggleChannel(name: string): Promise<boolean> {
  return invoke('toggle_channel_cmd', { name });
}
```

**Error Handling**:
- Wrap all `invoke()` calls with try-catch
- Map Rust errors to user-friendly messages
- Handle permission denied (guest users)

**Tests** (~20 tests):
- Mock invoke calls per command
- Error mapping
- Permission denied handling

---

## 3. State Management (~150 LOC)

### 3.1 Zustand Store: `src/stores/channelStore.ts`
**Purpose**: Global channel state + wizard orchestration

**Required State**:
```typescript
import { create } from 'zustand';
import type { ChannelConfig, ChannelWizardState } from '@/types/channels';

interface ChannelStore {
  // Channel list
  channels: ChannelConfig[];
  loading: boolean;
  error: string | null;

  // Wizard state
  wizard: ChannelWizardState;

  // Actions
  fetchChannels: () => Promise<void>;
  createChannel: (config: ChannelConfig) => Promise<void>;
  updateChannel: (name: string, updates: ChannelConfigUpdate) => Promise<void>;
  deleteChannel: (name: string) => Promise<void>;
  toggleChannel: (name: string) => Promise<void>;

  // Wizard actions
  startWizard: (platform?: ChannelPlatform) => void;
  updateWizard: (updates: Partial<ChannelWizardState>) => void;
  resetWizard: () => void;
  submitWizard: () => Promise<void>;
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channels: [],
  loading: false,
  error: null,
  wizard: { step: 'platform' },

  fetchChannels: async () => {
    set({ loading: true });
    try {
      const channels = await listChannels();
      set({ channels, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  // ... other actions
}));
```

**Tests** (~25 tests):
- CRUD operations
- Wizard state machine
- Error handling
- Loading states

---

## 4. Channel List UI (~180 LOC)

### 4.1 Component: `src/components/channels/ChannelList.tsx`
**Purpose**: Display all channels with CRUD actions

**Required Features**:
- Card-based layout (shadcn/ui Card component)
- Platform icons (WhatsApp/Telegram/Matrix/Discord/Slack/Signal)
- Status badges (enabled/disabled)
- Actions per channel:
  - Edit (opens wizard with decrypted credentials)
  - Toggle (enable/disable)
  - Delete (with confirmation dialog)
- Create button (opens wizard)
- Empty state (no channels configured)

**UI Structure**:
```tsx
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function ChannelList() {
  const { channels, loading, fetchChannels, toggleChannel, deleteChannel } = useChannelStore();

  useEffect(() => {
    fetchChannels();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2>Channels</h2>
        <Button onClick={() => startWizard()}>Add Channel</Button>
      </div>

      {channels.map(channel => (
        <Card key={channel.name}>
          <div className="flex items-center gap-4">
            <PlatformIcon platform={channel.platform} />
            <div className="flex-1">
              <h3>{channel.name}</h3>
              <Badge variant={channel.enabled ? 'success' : 'secondary'}>
                {channel.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <Button variant="ghost" onClick={() => editChannel(channel.name)}>Edit</Button>
            <Button variant="ghost" onClick={() => toggleChannel(channel.name)}>
              {channel.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button variant="destructive" onClick={() => deleteChannel(channel.name)}>Delete</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

**Tests** (~20 tests):
- Channel list rendering
- Empty state
- CRUD button clicks
- Loading/error states
- Permission checks (guest users)

---

## 5. Channel Creation Wizards (~1,200 LOC)

### 5.1 Platform Selection: `src/components/channels/wizards/PlatformSelector.tsx` (~60 LOC)
**Purpose**: Step 1 - Choose platform (WhatsApp/Telegram/Matrix/Discord/Slack/Signal)

**UI**:
- 6 platform cards with icons
- One-click selection
- Next button (disabled until selection)

**Tests** (~8 tests):
- Platform selection
- Next button state
- Wizard state update

---

### 5.2 Telegram Wizard: `src/components/channels/wizards/TelegramWizard.tsx` (~180 LOC)
**Purpose**: Bot token input + validation

**Form Fields**:
- Channel name (text input, required, unique)
- Bot token (text input, required, format: `<BOT_ID>:<AUTH_TOKEN>`)
- Real-time validation feedback

**Validation**:
- Bot token format: 10+ digit ID, 35+ char token, colon separator
- Unique channel name check
- Calls `validateChannel()` before submit

**UI**:
```tsx
export function TelegramWizard() {
  const [name, setName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleValidate = async () => {
    const result = await validateChannel({
      name,
      platform: 'Telegram',
      credentials: { type: 'Telegram', bot_token: botToken },
      enabled: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    if (!result.valid) {
      setErrors(result.errors.reduce((acc, err) => ({ ...acc, [err.field]: err.message }), {}));
    }
  };

  return (
    <Form>
      <Input label="Channel Name" value={name} onChange={setName} error={errors.name} />
      <Input label="Bot Token" value={botToken} onChange={setBotToken} error={errors.bot_token} />
      <Button onClick={handleValidate}>Validate</Button>
      <Button onClick={submitWizard} disabled={!name || !botToken}>Create</Button>
    </Form>
  );
}
```

**Tests** (~25 tests):
- Form input
- Real-time validation
- Format validation (valid/invalid tokens)
- Submit flow
- Error display

---

### 5.3 Matrix Wizard: `src/components/channels/wizards/MatrixWizard.tsx` (~220 LOC)
**Purpose**: Dual auth (access token OR username+password) + homeserver

**Form Fields**:
- Channel name (text input, required)
- Homeserver (text input, required, URL format)
- **Tab 1: Access Token**
  - Access token (text input)
- **Tab 2: Username + Password**
  - Username (text input)
  - Password (password input)

**Validation**:
- Homeserver must be valid URL (https://matrix.org)
- Exactly one auth method (access_token XOR username+password)
- Calls `validateChannel()` before submit

**UI**:
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function MatrixWizard() {
  const [authMethod, setAuthMethod] = useState<'token' | 'password'>('token');

  return (
    <Form>
      <Input label="Channel Name" />
      <Input label="Homeserver" placeholder="https://matrix.org" />

      <Tabs value={authMethod} onValueChange={setAuthMethod}>
        <TabsList>
          <TabsTrigger value="token">Access Token</TabsTrigger>
          <TabsTrigger value="password">Username + Password</TabsTrigger>
        </TabsList>

        <TabsContent value="token">
          <Input label="Access Token" />
        </TabsContent>

        <TabsContent value="password">
          <Input label="Username" />
          <Input label="Password" type="password" />
        </TabsContent>
      </Tabs>

      <Button onClick={submitWizard}>Create</Button>
    </Form>
  );
}
```

**Tests** (~30 tests):
- Tab switching
- Dual auth validation (XOR logic)
- Homeserver URL validation
- Submit flow per auth method
- Error display

---

### 5.4 Discord Wizard: `src/components/channels/wizards/DiscordWizard.tsx` (~220 LOC)
**Purpose**: Dual auth (bot token OR OAuth client ID+secret)

**Form Fields**:
- Channel name (text input, required)
- **Tab 1: Bot Token**
  - Bot token (text input)
- **Tab 2: OAuth**
  - Client ID (text input)
  - Client Secret (password input)

**Validation**:
- Bot token format: 3 base64 segments separated by dots
- Exactly one auth method (bot_token XOR client_id+client_secret)
- Calls `validateChannel()` before submit

**UI**: Similar to MatrixWizard (Tabs component)

**Tests** (~30 tests):
- Tab switching
- Dual auth validation
- Bot token format validation
- Submit flow per auth method
- Error display

---

### 5.5 Slack Wizard: `src/components/channels/wizards/SlackWizard.tsx` (~180 LOC)
**Purpose**: OAuth access token + optional refresh token

**Form Fields**:
- Channel name (text input, required)
- Access token (text input, required, prefix: `xoxb-` or `xoxp-`)
- Refresh token (text input, optional)

**Validation**:
- Access token prefix: `xoxb-` (bot) or `xoxp-` (user)
- Calls `validateChannel()` before submit

**Tests** (~25 tests):
- Form input
- Token prefix validation
- Optional refresh token
- Submit flow
- Error display

---

### 5.6 WhatsApp Wizard: `src/components/channels/wizards/WhatsAppWizard.tsx` (~180 LOC)
**Purpose**: JSON session data input

**Form Fields**:
- Channel name (text input, required)
- Session data (textarea, required, valid JSON)

**Validation**:
- JSON syntax validation
- Schema validation (via backend `validateChannel()`)

**UI**:
```tsx
export function WhatsAppWizard() {
  const [sessionData, setSessionData] = useState('');
  const [jsonError, setJsonError] = useState('');

  const handleSessionDataChange = (value: string) => {
    setSessionData(value);
    try {
      JSON.parse(value);
      setJsonError('');
    } catch (error) {
      setJsonError('Invalid JSON syntax');
    }
  };

  return (
    <Form>
      <Input label="Channel Name" />
      <Textarea
        label="Session Data (JSON)"
        value={sessionData}
        onChange={handleSessionDataChange}
        error={jsonError}
        rows={10}
      />
      <Button onClick={submitWizard} disabled={!!jsonError}>Create</Button>
    </Form>
  );
}
```

**Tests** (~25 tests):
- JSON input
- Syntax validation
- Schema validation
- Submit flow
- Error display

---

### 5.7 Signal Wizard: `src/components/channels/wizards/SignalWizard.tsx` (~180 LOC)
**Purpose**: JSON device data input

**Form Fields**:
- Channel name (text input, required)
- Device data (textarea, required, valid JSON)

**Validation**:
- JSON syntax validation
- Schema validation (via backend `validateChannel()`)

**UI**: Similar to WhatsAppWizard (Textarea for JSON input)

**Tests** (~25 tests):
- JSON input
- Syntax validation
- Schema validation
- Submit flow
- Error display

---

## 6. Shared UI Components (~120 LOC)

### 6.1 Platform Icon: `src/components/channels/PlatformIcon.tsx` (~40 LOC)
**Purpose**: Display platform-specific icons

**Required Icons** (use lucide-react):
- WhatsApp: `<MessageCircle />`
- Telegram: `<Send />`
- Matrix: `<Grid />`
- Discord: `<Hash />`
- Slack: `<Hash />`
- Signal: `<Lock />`

**Tests** (~6 tests):
- Render per platform
- Fallback for unknown platform

---

### 6.2 Validation Feedback: `src/components/channels/ValidationFeedback.tsx` (~40 LOC)
**Purpose**: Real-time validation status display

**UI**:
- Loading spinner during validation
- Green checkmark + metadata on success
- Red X + error list on failure

**Tests** (~8 tests):
- Loading state
- Success state
- Error state
- Metadata display

---

### 6.3 Confirmation Dialog: `src/components/channels/ConfirmDeleteDialog.tsx` (~40 LOC)
**Purpose**: Confirm channel deletion

**UI**:
- shadcn/ui AlertDialog
- "Are you sure?" message
- Channel name display
- Cancel + Delete buttons

**Tests** (~6 tests):
- Dialog open/close
- Confirm action
- Cancel action

---

## 7. Routing Integration (~20 LOC)

### 7.1 App Router: `src/App.tsx`
**Add Route**:
```tsx
import { ChannelList } from '@/components/channels/ChannelList';

function App() {
  return (
    <Router>
      <Routes>
        {/* ... existing routes ... */}
        <Route path="/channels" element={<ChannelList />} />
      </Routes>
    </Router>
  );
}
```

### 7.2 Sidebar Navigation
**Add Link**:
- Icon: `<Hash />`
- Label: "Channels"
- Path: `/channels`
- Badge: Channel count (from store)

**Tests** (~4 tests):
- Route navigation
- Sidebar link active state
- Badge count

---

## 8. Testing Strategy

### 8.1 Unit Tests (~70 tests)
**Coverage**:
- Type definitions (30 tests)
- IPC wrappers (20 tests)
- Zustand store (25 tests)

**Tools**: Vitest + @testing-library/react

---

### 8.2 Component Tests (~150 tests)
**Coverage**:
- ChannelList (20 tests)
- PlatformSelector (8 tests)
- TelegramWizard (25 tests)
- MatrixWizard (30 tests)
- DiscordWizard (30 tests)
- SlackWizard (25 tests)
- WhatsAppWizard (25 tests)
- SignalWizard (25 tests)
- PlatformIcon (6 tests)
- ValidationFeedback (8 tests)
- ConfirmDeleteDialog (6 tests)

**Tools**: Vitest + @testing-library/react + @testing-library/user-event

---

### 8.3 Integration Tests (~10 tests)
**Coverage**:
- Full wizard flows (create → validate → submit)
- Channel CRUD operations
- Permission checks (guest users)
- Error handling (backend failures)

**Tools**: Playwright (E2E)

---

## 9. Dependency Requirements

### 9.1 New npm Packages
```json
{
  "dependencies": {
    "@radix-ui/react-tabs": "^1.1.3",  // Matrix/Discord auth tabs
    "lucide-react": "^0.469.0"          // Platform icons (if not installed)
  }
}
```

### 9.2 Existing Dependencies
- shadcn/ui: Card, Button, Badge, Input, Textarea, Tabs, AlertDialog
- Zustand: State management
- @tauri-apps/api: IPC invoke

---

## 10. Quality Metrics

### 10.1 Test Coverage Targets
- **Unit tests**: >90%
- **Component tests**: >85%
- **Integration tests**: 100% critical paths

### 10.2 Performance Targets
- Channel list render: <100ms for 50 channels
- Wizard validation: <200ms per validation
- Toggle action: <50ms response time

### 10.3 Accessibility Targets
- WCAG 2.1 Level AA compliance
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader labels (ARIA)

---

## 11. Implementation Order

### Phase 5.1: Types + IPC (~1 hour)
1. ✅ Create `src/types/channels.ts` (200 LOC)
2. ✅ Create `src/lib/channels.ts` (180 LOC)
3. ✅ Write tests (50 tests)

### Phase 5.2: State Management (~1 hour)
1. ✅ Create `src/stores/channelStore.ts` (150 LOC)
2. ✅ Write tests (25 tests)

### Phase 5.3: Channel List (~1.5 hours)
1. ✅ Create `src/components/channels/ChannelList.tsx` (180 LOC)
2. ✅ Create `src/components/channels/PlatformIcon.tsx` (40 LOC)
3. ✅ Create `src/components/channels/ConfirmDeleteDialog.tsx` (40 LOC)
4. ✅ Write tests (26 tests)

### Phase 5.4: Wizards (~3-4 hours)
1. ✅ Create `PlatformSelector.tsx` (60 LOC, 8 tests)
2. ✅ Create `TelegramWizard.tsx` (180 LOC, 25 tests)
3. ✅ Create `MatrixWizard.tsx` (220 LOC, 30 tests)
4. ✅ Create `DiscordWizard.tsx` (220 LOC, 30 tests)
5. ✅ Create `SlackWizard.tsx` (180 LOC, 25 tests)
6. ✅ Create `WhatsAppWizard.tsx` (180 LOC, 25 tests)
7. ✅ Create `SignalWizard.tsx` (180 LOC, 25 tests)
8. ✅ Create `ValidationFeedback.tsx` (40 LOC, 8 tests)

### Phase 5.5: Routing + Polish (~0.5 hours)
1. ✅ Update `src/App.tsx` (20 LOC)
2. ✅ Update sidebar navigation (10 LOC)
3. ✅ Write route tests (4 tests)

---

## 12. Acceptance Criteria

### 12.1 Functional Requirements
- ✅ Users can view all channels (encrypted credentials)
- ✅ Users can create channels via 6 platform wizards
- ✅ Users can edit channels (decrypted credentials pre-filled)
- ✅ Users can toggle channels (enable/disable)
- ✅ Users can delete channels (with confirmation)
- ✅ Wizards validate credentials before submission
- ✅ Real-time validation feedback (format, schema)
- ✅ Permission checks block guest users from CRUD

### 12.2 Non-Functional Requirements
- ✅ Test coverage >85%
- ✅ All commands integrated (8/8)
- ✅ No breaking changes to Phase 1-4 functionality
- ✅ Responsive UI (mobile + desktop)
- ✅ Keyboard navigation
- ✅ ARIA labels

### 12.3 Documentation
- ✅ Inline JSDoc comments
- ✅ Storybook stories for shared components (optional)
- ✅ Update README.md with channel setup instructions

---

## 13. CI Validation

### 13.1 Frontend Tests
```bash
npm run test              # 110 tests, >85% coverage
npm run test:coverage     # Generate coverage report
npm run lint              # ESLint passes
npm run typecheck         # TypeScript passes
```

### 13.2 Backend Tests (Regression)
```bash
cargo test                # 249 tests (180 Phase 1-4 + 69 Phase 5)
cargo clippy -- -D warnings
cargo fmt -- --check
```

### 13.3 E2E Tests
```bash
npm run test:e2e          # Playwright integration tests
```

---

## 14. Phase 5 Complete Criteria

**Backend**: ✅ COMPLETE
- ✅ 5 files (1,869 LOC)
- ✅ 69 tests (53.8% coverage)
- ✅ 8 commands integrated
- ✅ 6 platform validators
- ✅ BRC-42 encryption
- ✅ Deviations documented

**Frontend**: ⏳ PENDING
- [ ] 18 files (~2,400 LOC)
- [ ] 110 tests (>85% coverage)
- [ ] 8 commands integrated
- [ ] 6 platform wizards
- [ ] Channel list + CRUD UI
- [ ] Routing integrated

**Total Progress**: 50% (Backend complete, Frontend pending)

---

## 15. Next: Phase 6 (Real-Time Channel Messaging)

**Prerequisites**:
- ✅ Phase 5 backend complete
- ⏳ Phase 5 frontend complete
- ⏳ CI validation (249 tests pass)

**Scope**:
- WebSocket connections per channel
- Message queuing + delivery
- BRC-103 auth for channel access
- Real-time UI updates

**Estimated Duration**: 12-16 hours
