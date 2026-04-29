/**
 * Phase 4 Frontend Type Definitions
 * Client Mode & Multi-User Authorization
 *
 * This module exports all TypeScript contracts for Phase 4 features:
 * - Gateway Discovery (mDNS peer discovery with UI state)
 * - Access Control (invitations, user management, permissions)
 * - General Settings (mode selection)
 * - App Routing (navigation structure)
 */

import type { DiscoveredPeer as BaseDiscoveredPeer } from './api';

// ============================================================================
// Gateway Discovery Types
// ============================================================================

/**
 * Scan status for mDNS discovery operations
 */
export type DiscoveryScanStatus =
  | 'idle'       // No active scan
  | 'scanning'   // Currently scanning
  | 'error'      // Scan failed
  | 'complete';  // Scan completed successfully

/**
 * Extended DiscoveredPeer with UI-specific state for client mode
 * Combines backend discovery data with frontend interaction state
 */
export interface DiscoveredPeerUI extends Omit<BaseDiscoveredPeer, 'lastSeen'> {
  /** Whether this peer is currently selected in the UI */
  selected: boolean;
  /** Whether connection attempt is in progress */
  connecting: boolean;
  /** Connection error message (if any) */
  connectionError?: string;
  /** Timestamp when peer was last seen (Unix ms timestamp for staleness detection) */
  lastSeen: number;
  /** Whether this peer has been verified via BRC-103 auth */
  verified: boolean;
}

/**
 * Discovery scan state for the useDiscovery hook
 */
export interface DiscoveryScanState {
  /** Current scan status */
  status: DiscoveryScanStatus;
  /** List of discovered peers with UI state */
  peers: DiscoveredPeerUI[];
  /** Error message if status is 'error' */
  error?: string;
  /** Timestamp when scan was initiated */
  scanStartedAt?: number;
  /** Timestamp when scan completed */
  scanCompletedAt?: number;
}

/**
 * Actions for the useDiscovery hook
 */
export interface DiscoveryActions {
  /** Start mDNS scan for local gateways */
  startScan: () => Promise<void>;
  /** Stop active scan */
  stopScan: () => void;
  /** Select a peer for connection */
  selectPeer: (peerId: string) => void;
  /** Attempt to connect to selected peer */
  connectToPeer: (peerId: string) => Promise<void>;
  /** Clear scan results */
  clearResults: () => void;
  /** Refresh peer list (re-scan) */
  refresh: () => Promise<void>;
}

// ============================================================================
// Access Control Types
// ============================================================================

/**
 * Permission level for multi-user access
 * Maps to backend AccessLevel enum
 */
export type PermissionLevel = 'owner' | 'member' | 'guest';

/**
 * Form data for invitation creation
 */
export interface InviteFormData {
  /** Recipient's display name (for UI only, not verified) */
  displayName: string;
  /** Permission level to grant */
  permissionLevel: PermissionLevel;
  /** Optional expiration time in seconds (null = no expiration) */
  expiresIn?: number | null;
  /** Optional usage limit (null = unlimited) */
  maxUses?: number | null;
  /** Optional note/description for invitation */
  note?: string;
}

/**
 * Invitation token with metadata
 * Returned after creating invitation via IPC
 */
export interface InvitationToken {
  /** Base64-encoded invitation token */
  token: string;
  /** Permission level this token grants */
  permissionLevel: PermissionLevel;
  /** Expiration timestamp (ISO 8601, null if no expiration) */
  expiresAt: string | null;
  /** Maximum number of uses (null if unlimited) */
  maxUses: number | null;
  /** Number of times this token has been used */
  usedCount: number;
  /** Timestamp when token was created (ISO 8601) */
  createdAt: string;
  /** Whether token is still valid */
  isValid: boolean;
}

/**
 * User with permission metadata
 * Extends base user info with access control details
 */
export interface UserWithPermissions {
  /** User's BSV public key (identity) */
  publicKey: string;
  /** User's petname (derived from pubkey) */
  petname: string;
  /** Permission level */
  permissionLevel: PermissionLevel;
  /** Timestamp when user was added (ISO 8601) */
  addedAt: string;
  /** Whether user is currently active */
  isActive: boolean;
  /** Last activity timestamp (ISO 8601, null if never active) */
  lastActivityAt: string | null;
  /** Display name (if provided during invitation) */
  displayName?: string;
}

/**
 * Action for revoking user access
 */
export interface RevokeAction {
  /** User's public key to revoke */
  publicKey: string;
  /** Reason for revocation (for audit log) */
  reason?: string;
}

/**
 * State for the useAccessControl hook
 */
export interface AccessControlState {
  /** List of authorized users with permissions */
  users: UserWithPermissions[];
  /** List of active invitation tokens */
  invitations: InvitationToken[];
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message (if any) */
  error?: string;
}

/**
 * Actions for the useAccessControl hook
 */
export interface AccessControlActions {
  /** Create new invitation token */
  createInvitation: (data: InviteFormData) => Promise<InvitationToken>;
  /** Revoke user access */
  revokeAccess: (action: RevokeAction) => Promise<void>;
  /** Invalidate invitation token */
  revokeInvitation: (token: string) => Promise<void>;
  /** Update user permission level */
  updatePermission: (publicKey: string, level: PermissionLevel) => Promise<void>;
  /** Refresh user/invitation lists */
  refresh: () => Promise<void>;
}

// ============================================================================
// General Settings Types
// ============================================================================

/**
 * Operating mode for EdwinPAI Desktop
 * Determines whether app runs as gateway or client
 */
export type OperatingMode = 'gateway' | 'client';

/**
 * Mode selection data for GeneralSettings
 */
export interface ModeSettings {
  /** Current operating mode */
  mode: OperatingMode;
  /** Whether mode can be changed (false if gateway has active connections) */
  canChangeMode: boolean;
  /** Warning message if mode change is restricted */
  modeChangeWarning?: string;
}

/**
 * Actions for mode management in GeneralSettings
 */
export interface ModeActions {
  /** Switch operating mode */
  setMode: (mode: OperatingMode) => Promise<void>;
  /** Check if mode change is allowed */
  validateModeChange: (targetMode: OperatingMode) => Promise<boolean>;
}

// ============================================================================
// App Routing Types
// ============================================================================

/**
 * Available routes in the application
 */
export type Route =
  | '/'                    // Welcome/onboarding
  | '/chat'                // Main chat interface
  | '/settings'            // General settings
  | '/settings/identity'   // Identity management
  | '/settings/subscription' // Subscription settings
  | '/settings/access'     // Access control (gateway mode only)
  | '/settings/channels'   // Channel configuration
  | '/discovery'           // Gateway discovery (client mode only)
  | '/onboarding/gateway'  // Gateway setup wizard
  | '/onboarding/client';  // Client setup wizard

/**
 * Navigation item for sidebar/menu
 */
export interface NavigationItem {
  /** Display label */
  label: string;
  /** Target route */
  route: Route;
  /** Icon name (lucide-react icon) */
  icon: string;
  /** Whether item is only available in specific mode */
  modeRestriction?: OperatingMode;
  /** Whether item requires active subscription */
  requiresSubscription?: boolean;
  /** Badge text (e.g., "Beta", "New") */
  badge?: string;
}

/**
 * Routing context state
 */
export interface RoutingState {
  /** Current route */
  currentRoute: Route;
  /** Navigation history */
  history: Route[];
  /** Whether user can navigate back */
  canGoBack: boolean;
}

/**
 * Routing actions
 */
export interface RoutingActions {
  /** Navigate to route */
  navigateTo: (route: Route) => void;
  /** Navigate back */
  goBack: () => void;
  /** Replace current route (no history entry) */
  replace: (route: Route) => void;
}

// ============================================================================
// Wizard/Onboarding Types
// ============================================================================

/**
 * Step in client mode setup wizard
 */
export type ClientSetupStep =
  | 'welcome'           // Introduction
  | 'discovery'         // mDNS gateway discovery
  | 'auth'              // BRC-103 authentication
  | 'complete';         // Setup complete

/**
 * Wizard step state
 */
export interface WizardStepState {
  /** Current step index */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether user can proceed to next step */
  canProceed: boolean;
  /** Error message blocking progress */
  blockingError?: string;
}

/**
 * Wizard navigation actions
 */
export interface WizardActions {
  /** Proceed to next step */
  nextStep: () => void;
  /** Return to previous step */
  previousStep: () => void;
  /** Jump to specific step (if allowed) */
  goToStep: (step: number) => void;
  /** Complete wizard */
  complete: () => Promise<void>;
  /** Cancel wizard and return to welcome */
  cancel: () => void;
}

// ============================================================================
// Combined Export Types
// ============================================================================

/**
 * Combined discovery hook return type
 */
export interface UseDiscoveryReturn {
  state: DiscoveryScanState;
  actions: DiscoveryActions;
}

/**
 * Combined access control hook return type
 */
export interface UseAccessControlReturn {
  state: AccessControlState;
  actions: AccessControlActions;
}

/**
 * Combined mode management return type
 */
export interface UseModeReturn {
  settings: ModeSettings;
  actions: ModeActions;
}

/**
 * Combined routing hook return type
 */
export interface UseRoutingReturn {
  state: RoutingState;
  actions: RoutingActions;
}

/**
 * Combined wizard hook return type
 */
export interface UseWizardReturn {
  step: WizardStepState;
  actions: WizardActions;
}

// ============================================================================
// Re-exports from other modules (for convenience)
// ============================================================================

// From api.ts (base types)
export type {
  DiscoveredPeer
} from './api';

// From gateway.ts
export type {
  GatewayStatus,
  HealthCheckResponse
} from './gateway';

// From identity.ts
export type {
  Identity,
  Petname
} from './identity';

// From subscription.ts
export type {
  SubscriptionState,
  SubscriptionStatus
} from './subscription';
