# Phase 4 Frontend Requirements

**Document Version**: 1.0
**Date**: 2026-02-11
**Phase**: 4 - Client Mode & Multi-User Authorization
**Status**: Requirements Definition

---

## Overview

Phase 4 frontend delivers three new components and updates to GeneralSettings to support Client Mode discovery, multi-user access control, and gateway mode switching. This builds on the Phase 4 backend implementation (24 files, 3,182 LOC) that provides mDNS discovery, invitation system, and authorization enforcement.

**Key Dependencies**:
- Phase 4 Backend: Complete (2,056 LOC Rust + 1,126 LOC tests)
- Phase 3 Components: ChatView, MessageBubble, InputBar, GeneralSettings
- shadcn/ui: Table, Button, Input, Card, Select, Dialog (existing + new)
- External: `qrcode.react` ^4.1.0 (new dependency)

---

## 1. Component Requirements

### 1.1 GatewayDiscovery Component

**File**: `src/components/discovery/GatewayDiscovery.tsx`
**Estimated LOC**: 280-320
**Purpose**: Client mode dashboard for discovering and connecting to EdwinPAI gateways on LAN

#### State Management
```typescript
interface GatewayDiscoveryState {
  peers: DiscoveredPeer[];           // From backend mDNS scan
  selectedPeerId: string | null;     // For detail view
  isScanning: boolean;               // Auto-refresh state
  lastScan: Date | null;             // Timestamp display
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'error';
  error: string | null;
}
```

#### Backend Integration (IPC Commands)
- `start_mdns_discovery()` - Initiates 5s mDNS scan
- `stop_mdns_discovery()` - Manual stop (rarely used)
- `connect_to_gateway(peerId: string)` - Establishes client connection
- `disconnect_from_gateway()` - Cleanup on mode switch

**Type Contract** (from Phase 4 backend `src-tauri/src/discovery/types.rs`):
```typescript
// src/types/discovery.ts
export interface DiscoveredPeer {
  id: string;              // SHA-256(pubkey) for deduplication
  petname: string;         // Human-readable from TXT record
  pubkey: string;          // Hex-encoded secp256k1 public key
  ip_address: string;      // IPv4/IPv6
  port: number;            // Advertised port (default 3000)
  last_seen: number;       // Unix timestamp (ms)
  version: string;         // Gateway version from TXT
}
```

#### UX Flow
1. **Auto-Refresh**: 10-second polling while component mounted
   - Use `useEffect` with interval cleanup
   - Display countdown timer: "Next scan in 7s..."
   - Pause on user interaction (detail view open)

2. **Empty State**:
   ```
   No Gateways Found
   Make sure you're on the same network as an EdwinPAI gateway.
   [Scan Again]
   ```

3. **Table View** (shadcn/ui Table):
   | Petname | Public Key | IP Address | Version | Last Seen | Actions |
   |---------|-----------|------------|---------|-----------|---------|
   | alice-mbp | 03a1b2... | 192.168.1.10 | 0.4.0 | 3s ago | [Connect] |
   | bob-linux | 02c3d4... | 192.168.1.15 | 0.4.0 | 8s ago | [Connect] |

4. **Detail Modal** (shadcn/ui Dialog):
   - Full public key with copy button
   - Identicon visualization
   - Connection history (localStorage)
   - Trust indicator (first-time vs. known peer)

5. **Session Persistence**:
   - Save connected gateway ID to localStorage: `edwinpai.client.lastGateway`
   - Auto-reconnect on app restart if peer still discoverable
   - Clear on manual disconnect

#### Dependencies
- shadcn/ui: Table, Button, Dialog, Card, Badge
- Custom hooks: `useGatewayDiscovery()` (new)
- Types: `DiscoveredPeer` (new), `ConnectionStatus` (new)
- Icons: lucide-react (Wifi, RefreshCw, CheckCircle, AlertCircle)

#### Accessibility
- Table has proper ARIA labels
- Loading states announced to screen readers
- Keyboard navigation for Connect buttons (Tab + Enter)
- Error messages use role="alert"

---

### 1.2 AccessControl Component

**File**: `src/components/access/AccessControl.tsx`
**Estimated LOC**: 350-400
**Purpose**: Owner-only interface for managing user invitations and access levels

#### State Management
```typescript
interface AccessControlState {
  invitations: InvitationToken[];    // Pending invitations
  connectedUsers: ConnectedUser[];   // Active sessions
  selectedInvitation: string | null; // For QR display
  isCreating: boolean;               // Create invitation flow
  newInvitation: {
    role: 'Member' | 'Guest';
    expiresIn: number;               // Hours (1-168)
  };
}
```

#### Backend Integration (IPC Commands)
- `create_invitation(role: AccessLevel, expiresIn: number)` → InvitationToken
- `list_invitations()` → InvitationToken[]
- `revoke_invitation(token: string)` → Result<void>
- `list_connected_users()` → ConnectedUser[]
- `revoke_user_access(userId: string)` → Result<void>

**Type Contracts** (from Phase 4 backend):
```typescript
// src/types/access.ts (extended)
export interface InvitationToken {
  token: string;              // Base64-encoded 32-byte random
  role: 'Member' | 'Guest';   // AccessLevel enum
  created_at: number;         // Unix timestamp (ms)
  expires_at: number;         // Unix timestamp (ms)
  used: boolean;              // Redemption status
  redeemed_by?: string;       // User petname if used
}

export interface ConnectedUser {
  id: string;                 // SHA-256(pubkey)
  petname: string;            // Derived from pubkey
  pubkey: string;             // Hex-encoded
  role: 'Owner' | 'Member' | 'Guest';
  connected_at: number;       // Unix timestamp (ms)
  last_active: number;        // Unix timestamp (ms)
  session_id: string;         // JWT session token ID
}
```

#### UX Flow

**Tab 1: Invitations**
1. **Create Invitation Form**:
   ```
   Role: [Member ▼] [Guest ▼]
   Expires In: [24 hours ▼] (1h, 6h, 24h, 7d options)
   [Generate Invitation Link]
   ```

2. **QR Code Display** (qrcode.react):
   - Modal with 256x256 QR code
   - Scannable URL: `edwinpai://invite?token=<base64>&role=<Member|Guest>`
   - Copy link button
   - Expiration countdown: "Expires in 23h 45m"

3. **Invitations Table**:
   | Token (truncated) | Role | Created | Expires | Status | Actions |
   |-------------------|------|---------|---------|--------|---------|
   | abc123...xyz | Member | 2h ago | in 22h | Pending | [QR] [Revoke] |
   | def456...uvw | Guest | 1d ago | Expired | Expired | [Delete] |

**Tab 2: Connected Users**
1. **Users Table**:
   | Petname | Public Key | Role | Connected | Last Active | Actions |
   |---------|-----------|------|-----------|-------------|---------|
   | alice (You) | 03a1b2... | Owner | 3d ago | Just now | — |
   | bob | 02c3d4... | Member | 1h ago | 5m ago | [Change Role] [Revoke] |
   | charlie | 04e5f6... | Guest | 30m ago | 2m ago | [Change Role] [Revoke] |

2. **Revoke Confirmation** (shadcn/ui Dialog):
   ```
   Revoke Access for bob?
   This will immediately disconnect them and invalidate their session.
   [Cancel] [Revoke Access]
   ```

#### Owner-Only Access Control
- Component renders `<PermissionDenied />` if current user role !== 'Owner'
- Backend enforces via `#[owner_only]` Tauri command attribute
- Error handling: Display user-friendly message for 403 errors

#### Dependencies
- shadcn/ui: Table, Button, Dialog, Card, Select, Tabs, Input
- qrcode.react: ^4.1.0 (QRCodeSVG component)
- Custom hooks: `useAccessControl()` (new), `useAuth()` (existing)
- Types: `InvitationToken`, `ConnectedUser`, `AccessLevel`
- Icons: lucide-react (QrCode, UserPlus, UserMinus, Shield)

#### Accessibility
- Tabs use proper ARIA roles
- QR code has alt text with invitation link
- Role select uses semantic `<select>` with labels
- Revoke actions require confirmation (prevent accidental clicks)

---

### 1.3 GeneralSettings Component Updates

**File**: `src/components/settings/GeneralSettings.tsx` (existing, Phase 3)
**Estimated LOC**: +80-120 (total ~220-260)
**Purpose**: Add Gateway/Client mode switcher, preserve existing config UI

#### Existing Features (Phase 3)
- Gateway process control (Start/Stop/Restart)
- Gateway port configuration
- mDNS petname override
- Storage path display
- Theme toggle (light/dark)

#### New Features (Phase 4)

**1. Mode Switcher**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Operating Mode</CardTitle>
    <CardDescription>
      Choose how EdwinPAI Desktop operates on this device
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Select value={currentMode} onValueChange={handleModeChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="gateway">
          Gateway Mode
          <span className="text-muted-foreground">
            Run your own AI assistant with local gateway
          </span>
        </SelectItem>
        <SelectItem value="client">
          Client Mode
          <span className="text-muted-foreground">
            Connect to a gateway on your network
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  </CardContent>
</Card>
```

**2. Conditional UI**
- **Gateway Mode**: Show existing gateway controls (port, process controls)
- **Client Mode**: Show "Connected to: alice-mbp (192.168.1.10)" with [Disconnect] button
- Hide irrelevant settings based on mode (e.g., gateway port in client mode)

**3. Mode Switching Flow**
1. User selects new mode → Confirmation dialog:
   ```
   Switch to Client Mode?
   This will stop the local gateway and close all active chats.
   [Cancel] [Switch Mode]
   ```
2. Backend IPC: `set_gateway_mode(mode: GatewayMode)` → triggers cleanup
3. Success: Show toast notification, update UI
4. Error: Revert select value, show error alert

#### Backend Integration
```typescript
// src/types/config.ts (extended)
export type GatewayMode = 'Gateway' | 'Client';

export interface AppConfig {
  // Existing Phase 3 fields
  gateway_port: number;
  mdns_petname_override?: string;
  theme: 'light' | 'dark';

  // New Phase 4 fields
  mode: GatewayMode;
  client_gateway_id?: string;      // Connected peer ID (client mode only)
  client_last_connection?: number; // Unix timestamp (ms)
}
```

#### IPC Commands
- `set_gateway_mode(mode: GatewayMode)` - Mode switch with cleanup
- `get_current_mode()` → GatewayMode - Current operating mode
- Existing Phase 3 commands remain unchanged

#### Dependencies
- shadcn/ui: Select, Card, AlertDialog (new usage)
- Existing hooks: `useConfig()` (Phase 3), `useToast()` (shadcn/ui)
- Types: `GatewayMode` (new), `AppConfig` (extended)

---

## 2. App.tsx Routing Updates

**File**: `src/App.tsx` (existing)
**Changes**: +60-80 LOC
**Purpose**: Add routes for GatewayDiscovery and AccessControl

### New Routes

```tsx
import { GatewayDiscovery } from '@/components/discovery/GatewayDiscovery';
import { AccessControl } from '@/components/access/AccessControl';

// Inside router configuration
const routes = [
  // Existing Phase 3 routes
  { path: '/', element: <ChatView /> },
  { path: '/settings', element: <GeneralSettings /> },
  { path: '/onboarding', element: <GatewayModeFlow /> },

  // New Phase 4 routes
  {
    path: '/discovery',
    element: <GatewayDiscovery />,
    // Only accessible in Client mode
    loader: requireClientMode
  },
  {
    path: '/access',
    element: <AccessControl />,
    // Only accessible for Owner role
    loader: requireOwnerRole
  },
];
```

### Conditional Navigation (Sidebar)

**Gateway Mode Sidebar**:
```
🏠 Chat
👥 Access Control    ← NEW (owner only)
⚙️  Settings
```

**Client Mode Sidebar**:
```
🏠 Chat
🔍 Discovery         ← NEW
⚙️  Settings
```

### Route Guards

```typescript
// src/lib/routeGuards.ts (new file, ~40 LOC)
export async function requireClientMode() {
  const mode = await invoke<GatewayMode>('get_current_mode');
  if (mode !== 'Client') {
    throw redirect('/settings?error=client_mode_required');
  }
  return null;
}

export async function requireOwnerRole() {
  const user = await invoke<ConnectedUser>('get_current_user');
  if (user.role !== 'Owner') {
    throw new Response('Forbidden', { status: 403 });
  }
  return null;
}
```

### Error Boundaries
- 403 errors → Show "Permission Denied" component with "Contact gateway owner" message
- Mode mismatch → Redirect to /settings with error query param

---

## 3. Component Dependencies

### 3.1 shadcn/ui Components

**Existing** (from Phase 3):
- ✅ Button
- ✅ Card
- ✅ Input
- ✅ Dialog

**New Installs Required**:
```bash
npx shadcn@latest add table
npx shadcn@latest add select
npx shadcn@latest add tabs
npx shadcn@latest add badge
npx shadcn@latest add alert-dialog
```

**Component Usage Matrix**:
| Component | GatewayDiscovery | AccessControl | GeneralSettings |
|-----------|------------------|---------------|-----------------|
| Table     | ✅ Peers list    | ✅ Users/Invites | —             |
| Button    | ✅ Connect/Scan  | ✅ Create/Revoke | ✅ Mode switch |
| Dialog    | ✅ Peer details  | ✅ QR display | ✅ Confirm switch |
| Card      | ✅ Main container | ✅ Main container | ✅ Existing |
| Select    | —                | ✅ Role picker | ✅ Mode picker |
| Tabs      | —                | ✅ Invites/Users | —            |
| Badge     | ✅ Status (online) | ✅ Role badges | —            |
| AlertDialog | —              | ✅ Revoke confirm | ✅ Mode switch |

### 3.2 External Dependencies

**qrcode.react** ^4.1.0:
```bash
npm install qrcode.react
npm install -D @types/qrcode.react
```

**Usage** (AccessControl component):
```tsx
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={`edwinpai://invite?token=${token}&role=${role}`}
  size={256}
  level="H"  // High error correction
  includeMargin={true}
/>
```

---

## 4. Type System Integration

### 4.1 New Type Files

**src/types/discovery.ts** (~60 LOC):
```typescript
export interface DiscoveredPeer {
  id: string;
  petname: string;
  pubkey: string;
  ip_address: string;
  port: number;
  last_seen: number;
  version: string;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface DiscoveryState {
  peers: DiscoveredPeer[];
  isScanning: boolean;
  lastScan: Date | null;
  error: string | null;
}
```

**src/types/access.ts** (extended from Phase 3, +80 LOC):
```typescript
// Existing from Phase 3
export type AccessLevel = 'Owner' | 'Member' | 'Guest';

// New for Phase 4
export interface InvitationToken {
  token: string;
  role: 'Member' | 'Guest';
  created_at: number;
  expires_at: number;
  used: boolean;
  redeemed_by?: string;
}

export interface ConnectedUser {
  id: string;
  petname: string;
  pubkey: string;
  role: AccessLevel;
  connected_at: number;
  last_active: number;
  session_id: string;
}
```

**src/types/config.ts** (extended, +20 LOC):
```typescript
export type GatewayMode = 'Gateway' | 'Client';

export interface AppConfig {
  // Existing Phase 3
  gateway_port: number;
  mdns_petname_override?: string;
  theme: 'light' | 'dark';

  // New Phase 4
  mode: GatewayMode;
  client_gateway_id?: string;
  client_last_connection?: number;
}
```

### 4.2 IPC Type Extensions

**src/types/ipc.ts** (extended, +120 LOC):
```typescript
// Discovery commands
export interface StartMdnsDiscoveryRequest {
  type: 'start_mdns_discovery';
}

export interface StopMdnsDiscoveryRequest {
  type: 'stop_mdns_discovery';
}

export interface ConnectToGatewayRequest {
  type: 'connect_to_gateway';
  peer_id: string;
}

// Access control commands
export interface CreateInvitationRequest {
  type: 'create_invitation';
  role: 'Member' | 'Guest';
  expires_in_hours: number;
}

export interface RevokeInvitationRequest {
  type: 'revoke_invitation';
  token: string;
}

export interface RevokeUserAccessRequest {
  type: 'revoke_user_access';
  user_id: string;
}

// Config commands
export interface SetGatewayModeRequest {
  type: 'set_gateway_mode';
  mode: 'Gateway' | 'Client';
}
```

---

## 5. UX Flows

### 5.1 Gateway Discovery Flow (Client Mode)

**Step 1: Initial Load**
1. User opens GatewayDiscovery component (`/discovery`)
2. Auto-scan initiated: `start_mdns_discovery()` → 5s timeout
3. Loading state: "Scanning for gateways on your network..."
4. Results populate table in real-time as peers respond

**Step 2: Auto-Refresh**
1. 10-second interval starts after first scan completes
2. Countdown displayed: "Next scan in 7s..."
3. Silent background scans (no loading spinner)
4. Table updates with new/removed peers (smooth animations)
5. Pause auto-refresh when detail modal open (prevent disruption)

**Step 3: Connection**
1. User clicks [Connect] on peer row
2. Confirmation for first-time peers:
   ```
   Connect to alice-mbp?
   Public Key: 03a1b2c3...
   [Show Full Key] [Cancel] [Trust & Connect]
   ```
3. Known peers: Direct connection (no confirmation)
4. IPC call: `connect_to_gateway(peerId)`
5. Loading state on button: [Connecting...]
6. Success: Navigate to `/` (ChatView), show toast "Connected to alice-mbp"
7. Persist to localStorage: `edwinpai.client.lastGateway = peerId`

**Step 4: Session Persistence**
1. App restart in Client mode → Check localStorage
2. If `lastGateway` exists → Auto-scan for that peer ID
3. Found → Auto-reconnect silently
4. Not found → Show "Previous gateway (alice-mbp) not found" notification
5. User can manually connect to different gateway

### 5.2 Invitation Creation Flow (Gateway Mode, Owner Only)

**Step 1: Access Control UI**
1. Owner navigates to `/access` (sidebar: "Access Control")
2. Default tab: "Invitations"
3. Existing invitations table shows pending/expired tokens

**Step 2: Create New Invitation**
1. User clicks [+ New Invitation] button
2. Form appears:
   ```
   Role: [Member ▼]
   Expires In: [24 hours ▼]
   [Generate Invitation]
   ```
3. User selects role (Member/Guest) and expiration (1h-7d)
4. Click [Generate Invitation] → IPC: `create_invitation(role, hours)`
5. Backend generates 32-byte random token, stores in DB

**Step 3: QR Code Display**
1. Modal opens with:
   - QR code (256x256, error correction level H)
   - Invitation link: `edwinpai://invite?token=abc123&role=Member`
   - Copy link button
   - Expiration countdown: "Expires in 23h 59m"
2. User shares QR code or link with invitee

**Step 4: Token Lifecycle**
1. Invitations table shows new token with "Pending" status
2. Auto-refresh every 30s to update status (if redeemed)
3. Expired tokens show "Expired" badge, [Delete] action
4. Used tokens show "Used by bob" status, redeemed_at timestamp

### 5.3 Mode Switching Flow

**Step 1: User Initiates Switch** (Settings → Operating Mode)
1. User selects "Client Mode" from dropdown (currently in Gateway)
2. Dropdown value updates temporarily (optimistic UI)

**Step 2: Confirmation Dialog**
```
Switch to Client Mode?

This will:
• Stop the local gateway process
• Close all active chat sessions
• Disconnect connected users
• Save gateway data (preserved for later)

[Cancel] [Switch to Client Mode]
```

**Step 3: Backend Processing**
1. User clicks [Switch to Client Mode]
2. IPC: `set_gateway_mode('Client')`
3. Backend cleanup sequence:
   - Revoke all active sessions (notify users)
   - Stop gateway process (SIGTERM → 5s → SIGKILL)
   - Save config with mode='Client'
   - Stop mDNS advertising

**Step 4: UI Update**
1. Settings page reloads with Client mode UI
2. Gateway controls hidden
3. "Connected to: —" shown (no gateway yet)
4. Sidebar updates: "Discovery" replaces "Access Control"
5. Toast notification: "Switched to Client Mode. Visit Discovery to connect."

**Step 5: Reverse Flow** (Client → Gateway)
1. Similar confirmation: "Start local gateway?"
2. Backend: Initialize gateway process, restore owner identity
3. UI: Gateway controls shown, auto-navigate to ChatView

---

## 6. Testing Requirements

### 6.1 Component Tests (Vitest + React Testing Library)

**GatewayDiscovery.test.tsx** (~180 tests):
- ✅ Empty state rendering
- ✅ Auto-refresh interval (10s timer)
- ✅ Peer table population from IPC
- ✅ Connect button click → IPC invocation
- ✅ Detail modal open/close
- ✅ Session persistence (localStorage)
- ✅ Error states (scan timeout, connection failure)
- ✅ Loading states (scanning, connecting)
- ✅ Accessibility (ARIA labels, keyboard nav)

**AccessControl.test.tsx** (~220 tests):
- ✅ Owner-only access (permission denied for Member/Guest)
- ✅ Invitation creation form submission
- ✅ QR code generation with correct URL
- ✅ Invitation revocation with confirmation
- ✅ Connected users table rendering
- ✅ User role change flow
- ✅ User revoke access with confirmation
- ✅ Tab switching (Invitations ↔ Connected Users)
- ✅ Expiration countdown updates
- ✅ Token truncation display

**GeneralSettings.test.tsx** (extended, +80 tests):
- ✅ Mode switcher rendering
- ✅ Gateway → Client switch with confirmation
- ✅ Client → Gateway switch with confirmation
- ✅ Conditional UI (gateway controls hidden in client mode)
- ✅ Config persistence after mode change
- ✅ Error handling (mode switch failure)
- ✅ Toast notifications on success

### 6.2 Integration Tests

**Phase4Integration.test.tsx** (~40 tests):
- ✅ GatewayDiscovery → ConnectToGateway → ChatView navigation
- ✅ AccessControl invitation → Client redemption flow
- ✅ Mode switch → Sidebar update → Route guard enforcement
- ✅ Session persistence across app restart

### 6.3 E2E Tests (Playwright)

**gateway-discovery.spec.ts** (~15 tests):
- ✅ Full discovery flow with mocked mDNS responses
- ✅ Auto-refresh behavior over 30s period
- ✅ Connection flow with real IPC calls (mocked backend)

**access-control.spec.ts** (~20 tests):
- ✅ Invitation creation → QR display → Copy link
- ✅ User revocation flow with confirmation
- ✅ Permission denied for non-owner users

**mode-switching.spec.ts** (~12 tests):
- ✅ Gateway → Client switch with process cleanup
- ✅ Client → Gateway switch with initialization
- ✅ UI state updates across mode changes

---

## 7. File Manifest

**New Files** (14 total, ~1,420 LOC):

### Components (3 files, ~750 LOC)
1. `src/components/discovery/GatewayDiscovery.tsx` - 300 LOC
2. `src/components/access/AccessControl.tsx` - 380 LOC
3. `src/components/settings/GeneralSettings.tsx` - +70 LOC (updated)

### Component Tests (3 files, ~480 LOC)
4. `src/components/discovery/__tests__/GatewayDiscovery.test.tsx` - 180 LOC
5. `src/components/access/__tests__/AccessControl.test.tsx` - 220 LOC
6. `src/components/settings/__tests__/GeneralSettings.test.tsx` - +80 LOC (updated)

### Hooks (2 files, ~160 LOC)
7. `src/hooks/useGatewayDiscovery.ts` - 80 LOC
8. `src/hooks/useAccessControl.ts` - 80 LOC

### Types (3 files, ~160 LOC)
9. `src/types/discovery.ts` - 60 LOC
10. `src/types/access.ts` - +80 LOC (extended)
11. `src/types/config.ts` - +20 LOC (extended)

### Routing (2 files, ~110 LOC)
12. `src/App.tsx` - +70 LOC (route updates)
13. `src/lib/routeGuards.ts` - 40 LOC

### Integration Tests (1 file, ~80 LOC)
14. `src/__tests__/Phase4Integration.test.tsx` - 80 LOC

**Updated Files** (5 existing):
- `src/components/layout/Sidebar.tsx` - +30 LOC (conditional nav items)
- `src/types/ipc.ts` - +120 LOC (discovery/access commands)
- `package.json` - +2 dependencies (qrcode.react, @types/qrcode.react)
- `src/index.css` - +15 LOC (QR modal styles)
- `src/lib/storage.ts` - +20 LOC (session persistence helpers)

**Total Frontend Implementation**: ~1,420 new LOC + ~240 LOC updates = **1,660 LOC**

---

## 8. Dependencies Summary

### npm Packages (2 new)
```json
{
  "dependencies": {
    "qrcode.react": "^4.1.0"
  },
  "devDependencies": {
    "@types/qrcode.react": "^4.0.0"
  }
}
```

### shadcn/ui Components (5 new)
```bash
npx shadcn@latest add table
npx shadcn@latest add select
npx shadcn@latest add tabs
npx shadcn@latest add badge
npx shadcn@latest add alert-dialog
```

### Backend Dependencies (already in Phase 4 backend)
- ✅ `mdns-sd` - mDNS discovery (Rust)
- ✅ `tokio` - Async runtime (Rust)
- ✅ `serde` - Serialization (Rust)
- ✅ `tauri` - IPC bridge (Rust)

---

## 9. Acceptance Criteria

### Component Functionality
- [ ] GatewayDiscovery auto-refreshes every 10s
- [ ] GatewayDiscovery connects to gateway and persists session
- [ ] AccessControl creates invitations with QR codes
- [ ] AccessControl revokes users with confirmation
- [ ] GeneralSettings switches modes with cleanup
- [ ] All components render correctly in light/dark themes

### Type Safety
- [ ] All IPC commands have TypeScript definitions
- [ ] DiscoveredPeer, InvitationToken, ConnectedUser types match backend
- [ ] No `any` types in new code
- [ ] Route guards properly typed with loaders

### Testing
- [ ] 480+ new component tests pass (Vitest)
- [ ] 40+ integration tests pass
- [ ] E2E tests cover critical flows (Playwright)
- [ ] Test coverage >85% for new components

### UX/Accessibility
- [ ] Auto-refresh doesn't disrupt user interactions
- [ ] QR codes are scannable (tested with real phone)
- [ ] All forms have proper labels and validation
- [ ] Keyboard navigation works for all interactive elements
- [ ] Error messages are clear and actionable
- [ ] Loading states prevent double-clicks

### Integration
- [ ] All Phase 4 backend IPC commands callable from frontend
- [ ] Mode switching persists across app restarts
- [ ] Session persistence works in client mode
- [ ] Owner-only routes enforce permissions
- [ ] Sidebar updates based on mode/role

---

## 10. Implementation Timeline

**Estimated Total**: 18-24 hours

### Day 1 (8 hours): Types + GatewayDiscovery
- Types setup: discovery.ts, access.ts extensions (1h)
- GatewayDiscovery component (4h)
- useGatewayDiscovery hook (1h)
- Component tests (2h)

### Day 2 (8 hours): AccessControl
- AccessControl component (5h)
- useAccessControl hook (1h)
- Component tests (2h)

### Day 3 (6-8 hours): GeneralSettings + Routing + Integration
- GeneralSettings mode switcher (2h)
- App.tsx routing + guards (2h)
- Integration tests (2h)
- E2E tests setup (2-4h)

---

## 11. Open Questions / Decisions Needed

1. **Auto-refresh behavior**: Pause on ANY user interaction or just detail modals?
   - **Recommendation**: Only pause when detail modal open (less disruptive)

2. **Session persistence**: How long to retain `lastGateway` if peer not found?
   - **Recommendation**: Clear after 7 days of failed reconnects

3. **QR code size**: 256x256 sufficient or offer 512x512 for print?
   - **Recommendation**: 256x256 for modal, add "Download Large QR" button for 512x512 PNG

4. **Invitation link scheme**: `edwinpai://` custom protocol or HTTPS fallback?
   - **Recommendation**: Custom protocol primary, add HTTPS deep link for web gateway UI (future)

5. **Role change confirmation**: Require re-authentication for Owner → Member demotions?
   - **Recommendation**: Yes, show warning + require password confirmation (Phase 5 feature)

---

## 12. References

- **Phase 4 Backend**: 24 files, 3,182 LOC (2,056 Rust + 1,126 tests)
- **SPEC.md**: §9 Multi-User Authorization, §10 Client Mode
- **PLAN.md**: Phase 4 requirements
- **Phase 3 Deliverables**: ChatView, GeneralSettings baseline
- **shadcn/ui Docs**: https://ui.shadcn.com/docs/components
- **qrcode.react**: https://github.com/zpao/qrcode.react
- **BRC-103**: Authentication standard (referenced in Phase 1)

---

**Document Status**: ✅ COMPLETE - Ready for implementation
**Next Step**: Begin Day 1 implementation (Types + GatewayDiscovery)
