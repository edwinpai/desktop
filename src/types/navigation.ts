/**
 * Navigation & Routing Type Definitions
 *
 * Defines type contracts for:
 * - Application routes
 * - Navigation state
 * - Route parameters
 * - Deep linking
 *
 * All implementation nodes MUST import from this contract.
 */

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * Application routes (without parameters)
 */
export type AppRoute =
  | "/welcome" // Initial setup wizard
  | "/identity/new" // Create new identity
  | "/identity/import" // Import existing identity
  | "/subscription/setup" // Subscription setup
  | "/subscription/status" // Subscription details
  | "/chat" // Main chat interface
  | "/chat/new" // New conversation
  | "/settings" // Settings page
  | "/settings/identity" // Identity settings
  | "/settings/gateway" // Gateway configuration
  | "/settings/appearance" // UI preferences
  | "/settings/advanced" // Advanced settings
  | "/about"; // About/version info

/**
 * Parameterized routes (with dynamic segments)
 */
export type ParameterizedRoute =
  | `/chat/${string}` // Specific conversation: /chat/:conversationId
  | `/subscription/invoice/${string}`; // Invoice detail: /subscription/invoice/:invoiceId

/**
 * All valid routes (union of static and parameterized)
 */
export type Route = AppRoute | ParameterizedRoute;

// ============================================================================
// Route Parameters
// ============================================================================

/**
 * Route parameter extraction
 */
export interface RouteParams {
  conversationId?: string;
  invoiceId?: string;
}

/**
 * Navigation state (passed with navigation actions)
 */
export interface NavigationState {
  from?: Route;
  replace?: boolean; // Replace current history entry
  timestamp: string; // ISO 8601
}

// ============================================================================
// Deep Linking
// ============================================================================

/**
 * Deep link URL schemes
 * Format: edwinpai://[action]/[parameters]
 */
export type DeepLinkScheme =
  | "edwinpai://chat" // Open chat
  | "edwinpai://chat/new" // New conversation
  | "edwinpai://chat/:conversationId" // Open specific conversation
  | "edwinpai://subscription/setup" // Start subscription setup
  | "edwinpai://settings" // Open settings
  | "edwinpai://settings/:section"; // Open specific settings section

/**
 * Parse deep link URL into route
 */
export interface DeepLinkParams {
  scheme: string; // "edwinpai"
  action: string; // "chat", "subscription", etc.
  params?: Record<string, string>;
}

/**
 * Deep link handler result
 */
export interface DeepLinkHandlerResult {
  handled: boolean;
  route?: Route;
  error?: string;
}

// ============================================================================
// Navigation Guards
// ============================================================================

/**
 * Navigation guard result
 */
export interface NavigationGuardResult {
  allowed: boolean;
  redirect?: Route;
  reason?: string;
}

/**
 * Navigation guard context
 */
export interface NavigationGuardContext {
  from: Route;
  to: Route;
  hasIdentity: boolean;
  hasSubscription: boolean;
  gatewayRunning: boolean;
}

// ============================================================================
// IPC Commands (Navigation)
// ============================================================================

/**
 * Navigate to route request
 */
export interface NavigateToRequest {
  route: Route;
  state?: NavigationState;
  params?: RouteParams;
}

/**
 * Navigate to route response
 */
export interface NavigateToResponse {
  success: boolean;
  currentRoute: Route;
}

/**
 * Navigate back request
 */
export interface NavigateBackRequest {
  steps?: number; // Default: 1
}

/**
 * Navigate back response
 */
export interface NavigateBackResponse {
  success: boolean;
  currentRoute: Route;
}

/**
 * Navigate forward request
 */
export interface NavigateForwardRequest {
  steps?: number; // Default: 1
}

/**
 * Navigate forward response
 */
export interface NavigateForwardResponse {
  success: boolean;
  currentRoute: Route;
}

/**
 * Get current route request
 */
export type GetCurrentRouteRequest = Record<string, never>;

/**
 * Get current route response
 */
export interface GetCurrentRouteResponse {
  route: Route;
  params?: RouteParams;
  canGoBack: boolean;
  canGoForward: boolean;
}

/**
 * Handle deep link request
 */
export interface HandleDeepLinkRequest {
  url: string; // Full URL (e.g., "edwinpai://chat/123")
}

/**
 * Handle deep link response
 */
export interface HandleDeepLinkResponse {
  handled: boolean;
  route?: Route;
  error?: string;
}

// ============================================================================
// Navigation Events
// ============================================================================

/**
 * Navigation event types (for IPC event listeners)
 */
export type NavigationEvent =
  | "navigation:route_changed"
  | "navigation:deep_link_received"
  | "navigation:guard_blocked";

/**
 * Route changed event payload
 */
export interface RouteChangedEventPayload {
  from: Route;
  to: Route;
  params?: RouteParams;
  timestamp: string; // ISO 8601
}

/**
 * Deep link received event payload
 */
export interface DeepLinkReceivedEventPayload {
  url: string;
  timestamp: string; // ISO 8601
}

/**
 * Navigation guard blocked event payload
 */
export interface GuardBlockedEventPayload {
  from: Route;
  to: Route;
  reason: string;
  timestamp: string; // ISO 8601
}

// ============================================================================
// Route Metadata
// ============================================================================

/**
 * Route metadata (for navigation guards and breadcrumbs)
 */
export interface RouteMetadata {
  title: string;
  requiresIdentity: boolean;
  requiresSubscription: boolean;
  requiresGateway: boolean;
  showInBreadcrumbs: boolean;
  icon?: string;
}

/**
 * Route metadata map
 */
export const ROUTE_METADATA: Record<AppRoute, RouteMetadata> = {
  "/welcome": {
    title: "Welcome",
    requiresIdentity: false,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: false,
  },
  "/identity/new": {
    title: "Create Identity",
    requiresIdentity: false,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: true,
  },
  "/identity/import": {
    title: "Import Identity",
    requiresIdentity: false,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: true,
  },
  "/subscription/setup": {
    title: "Subscription Setup",
    requiresIdentity: true,
    requiresSubscription: false,
    requiresGateway: true,
    showInBreadcrumbs: true,
  },
  "/subscription/status": {
    title: "Subscription Status",
    requiresIdentity: true,
    requiresSubscription: true,
    requiresGateway: true,
    showInBreadcrumbs: true,
  },
  "/chat": {
    title: "Chat",
    requiresIdentity: true,
    requiresSubscription: true,
    requiresGateway: true,
    showInBreadcrumbs: true,
    icon: "chat",
  },
  "/chat/new": {
    title: "New Conversation",
    requiresIdentity: true,
    requiresSubscription: true,
    requiresGateway: true,
    showInBreadcrumbs: true,
    icon: "new",
  },
  "/settings": {
    title: "Settings",
    requiresIdentity: false,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: true,
    icon: "settings",
  },
  "/settings/identity": {
    title: "Identity Settings",
    requiresIdentity: true,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: true,
  },
  "/settings/gateway": {
    title: "Gateway Settings",
    requiresIdentity: false,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: true,
  },
  "/settings/appearance": {
    title: "Appearance",
    requiresIdentity: false,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: true,
  },
  "/settings/advanced": {
    title: "Advanced Settings",
    requiresIdentity: false,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: true,
  },
  "/about": {
    title: "About EdwinPAI",
    requiresIdentity: false,
    requiresSubscription: false,
    requiresGateway: false,
    showInBreadcrumbs: true,
  },
};

// ============================================================================
// Exports
// ============================================================================
// All types are already exported inline above
