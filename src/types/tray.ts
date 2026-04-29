/**
 * System Tray Type Definitions
 *
 * Defines type contracts for:
 * - Tray menu structure
 * - Menu item states
 * - Menu actions
 * - Dynamic menu updates
 *
 * All implementation nodes MUST import from this contract.
 */

// ============================================================================
// Tray Menu Items
// ============================================================================

/**
 * Menu item types
 */
export type TrayMenuItemType =
  | 'normal'     // Standard clickable item
  | 'separator'  // Visual separator
  | 'submenu'    // Contains child items
  | 'checkbox';  // Toggle item with checked state

/**
 * Menu item identifier (for action routing)
 */
export type TrayMenuItemId =
  | 'show_window'
  | 'hide_window'
  | 'new_conversation'
  | 'gateway_status'
  | 'start_gateway'
  | 'stop_gateway'
  | 'restart_gateway'
  | 'subscription_status'
  | 'check_subscription'
  | 'settings'
  | 'about'
  | 'check_for_updates'
  | 'quit';

/**
 * Tray menu item definition
 */
export interface TrayMenuItem {
  id: TrayMenuItemId;
  type: TrayMenuItemType;
  label: string;
  enabled: boolean;
  checked?: boolean; // Only for checkbox type
  children?: TrayMenuItem[]; // Only for submenu type
  accelerator?: string; // Keyboard shortcut (e.g., "Ctrl+N")
  icon?: string; // Icon name or path
}

/**
 * Complete tray menu structure
 */
export interface TrayMenu {
  items: TrayMenuItem[];
}

// ============================================================================
// Tray Menu State
// ============================================================================

/**
 * Dynamic tray menu state (reflects app state)
 */
export interface TrayMenuState {
  windowVisible: boolean;
  gatewayRunning: boolean;
  gatewayHealthy: boolean;
  subscriptionActive: boolean;
  updateAvailable: boolean;
}

/**
 * Default tray menu state
 */
export const DEFAULT_TRAY_MENU_STATE: TrayMenuState = {
  windowVisible: true,
  gatewayRunning: false,
  gatewayHealthy: false,
  subscriptionActive: false,
  updateAvailable: false,
};

// ============================================================================
// Tray Actions (IPC)
// ============================================================================

/**
 * Update tray menu request
 */
export interface UpdateTrayMenuRequest {
  state: Partial<TrayMenuState>;
}

/**
 * Update tray menu response
 */
export interface UpdateTrayMenuResponse {
  success: boolean;
}

/**
 * Get tray menu state request
 */
export type GetTrayMenuStateRequest = Record<string, never>;

/**
 * Get tray menu state response
 */
export interface GetTrayMenuStateResponse {
  state: TrayMenuState;
}

/**
 * Set tray tooltip request
 */
export interface SetTrayTooltipRequest {
  tooltip: string;
}

/**
 * Set tray tooltip response
 */
export interface SetTrayTooltipResponse {
  success: boolean;
}

/**
 * Set tray icon request
 */
export interface SetTrayIconRequest {
  icon: 'default' | 'active' | 'warning' | 'error';
}

/**
 * Set tray icon response
 */
export interface SetTrayIconResponse {
  success: boolean;
}

// ============================================================================
// Tray Events
// ============================================================================

/**
 * Tray event types (for IPC event listeners)
 */
export type TrayEvent =
  | 'tray:menu_item_clicked'
  | 'tray:icon_clicked'
  | 'tray:icon_double_clicked'
  | 'tray:icon_right_clicked';

/**
 * Menu item clicked event payload
 */
export interface MenuItemClickedEventPayload {
  itemId: TrayMenuItemId;
  timestamp: string; // ISO 8601
}

/**
 * Tray icon clicked event payload
 */
export interface TrayIconClickedEventPayload {
  button: 'left' | 'right' | 'middle';
  timestamp: string; // ISO 8601
}

// ============================================================================
// Tray Menu Builder (Helper)
// ============================================================================

/**
 * Build tray menu based on current state
 * This is the canonical menu structure that Rust backend will implement
 */
export function buildTrayMenu(state: TrayMenuState): TrayMenu {
  return {
    items: [
      // Window visibility toggle
      {
        id: state.windowVisible ? 'hide_window' : 'show_window',
        type: 'normal',
        label: state.windowVisible ? 'Hide EdwinPAI' : 'Show EdwinPAI',
        enabled: true,
        accelerator: 'Ctrl+H',
      },

      // New conversation
      {
        id: 'new_conversation',
        type: 'normal',
        label: 'New Conversation',
        enabled: state.gatewayRunning && state.subscriptionActive,
        accelerator: 'Ctrl+N',
        icon: 'new',
      },

      // Separator
      {
        id: 'separator' as TrayMenuItemId,
        type: 'separator',
        label: '',
        enabled: true,
      },

      // Gateway submenu
      {
        id: 'gateway_status',
        type: 'submenu',
        label: `Gateway: ${state.gatewayRunning ? (state.gatewayHealthy ? 'Running' : 'Unhealthy') : 'Stopped'}`,
        enabled: true,
        children: [
          {
            id: 'start_gateway',
            type: 'normal',
            label: 'Start Gateway',
            enabled: !state.gatewayRunning,
          },
          {
            id: 'stop_gateway',
            type: 'normal',
            label: 'Stop Gateway',
            enabled: state.gatewayRunning,
          },
          {
            id: 'restart_gateway',
            type: 'normal',
            label: 'Restart Gateway',
            enabled: state.gatewayRunning,
          },
        ],
      },

      // Subscription submenu
      {
        id: 'subscription_status',
        type: 'submenu',
        label: `Subscription: ${state.subscriptionActive ? 'Active' : 'Inactive'}`,
        enabled: true,
        children: [
          {
            id: 'check_subscription',
            type: 'normal',
            label: 'Check Now',
            enabled: state.gatewayRunning,
          },
        ],
      },

      // Separator
      {
        id: 'separator' as TrayMenuItemId,
        type: 'separator',
        label: '',
        enabled: true,
      },

      // Settings
      {
        id: 'settings',
        type: 'normal',
        label: 'Settings',
        enabled: true,
        accelerator: 'Ctrl+,',
      },

      // About
      {
        id: 'about',
        type: 'normal',
        label: 'About EdwinPAI',
        enabled: true,
      },

      // Check for updates
      {
        id: 'check_for_updates',
        type: 'normal',
        label: state.updateAvailable ? 'Update Available!' : 'Check for Updates',
        enabled: true,
      },

      // Separator
      {
        id: 'separator' as TrayMenuItemId,
        type: 'separator',
        label: '',
        enabled: true,
      },

      // Quit
      {
        id: 'quit',
        type: 'normal',
        label: 'Quit EdwinPAI',
        enabled: true,
        accelerator: 'Ctrl+Q',
      },
    ],
  };
}

// ============================================================================
// Exports
// ============================================================================
// All types and functions are already exported inline above
