/**
 * Tauri IPC Type Contracts
 *
 * Type definitions for Tauri IPC communication between
 * frontend (React/TypeScript) and backend (Rust).
 *
 * Commands follow Tauri's invoke pattern with type-safe payloads.
 */

import {
  SubscriptionState,
  SubscriptionStatus,
  PaymentRequest,
  PaymentResult,
  SubscriptionPlan,
} from './subscription';

// ============================================================================
// IPC Command Names
// ============================================================================

/**
 * Tauri command names for subscription operations
 */
export const IPC_COMMANDS = {
  // Query operations
  GET_SUBSCRIPTION_STATUS: 'get_subscription_status',
  GET_SUBSCRIPTION_PLANS: 'get_subscription_plans',
  REFRESH_SUBSCRIPTION: 'refresh_subscription',

  // Payment operations
  INITIATE_PAYMENT: 'initiate_payment',
  SUBMIT_PAYMENT: 'submit_payment',
  GET_PAYMENT_STATUS: 'get_payment_status',

  // State management
  RESET_SUBSCRIPTION: 'reset_subscription',
  SET_OFFLINE_MODE: 'set_offline_mode',

  // Utilities
  GET_USER_ADDRESS: 'get_user_address',
  GENERATE_PAYMENT_ADDRESS: 'generate_payment_address',
} as const;

// ============================================================================
// Command Payloads
// ============================================================================

/**
 * Get subscription status
 * Command: get_subscription_status
 */
export interface GetSubscriptionStatusPayload {
  /** User's payment address */
  userAddress: string;
}

export interface GetSubscriptionStatusResult {
  status: SubscriptionStatus;
}

/**
 * Get available subscription plans
 * Command: get_subscription_plans
 */
export interface GetSubscriptionPlansPayload {
  // No parameters needed
}

export interface GetSubscriptionPlansResult {
  plans: SubscriptionPlan[];
}

/**
 * Refresh subscription status
 * Command: refresh_subscription
 */
export interface RefreshSubscriptionPayload {
  /** User's payment address */
  userAddress: string;
  /** Force overlay query (ignore cache) */
  forceRefresh?: boolean;
}

export interface RefreshSubscriptionResult {
  status: SubscriptionStatus;
}

/**
 * Initiate payment for subscription
 * Command: initiate_payment
 */
export interface InitiatePaymentPayload {
  /** Payment request details */
  paymentRequest: PaymentRequest;
}

export interface InitiatePaymentResult {
  /** Raw transaction hex */
  rawTx: string;
  /** Transaction ID (pre-broadcast) */
  txid: string;
  /** Estimated fee in satoshis */
  feeSatoshis: number;
}

/**
 * Submit payment transaction
 * Command: submit_payment
 */
export interface SubmitPaymentPayload {
  /** Raw transaction hex to broadcast */
  rawTx: string;
  /** User's payment address */
  userAddress: string;
}

export interface SubmitPaymentResult {
  result: PaymentResult;
}

/**
 * Get payment status
 * Command: get_payment_status
 */
export interface GetPaymentStatusPayload {
  /** Transaction ID to check */
  txid: string;
}

export interface GetPaymentStatusResult {
  /** Whether transaction is confirmed */
  confirmed: boolean;
  /** Number of confirmations */
  confirmations: number;
  /** Block height where confirmed */
  blockHeight?: number;
  /** Error if status check failed */
  error?: string;
}

/**
 * Reset subscription state
 * Command: reset_subscription
 */
export interface ResetSubscriptionPayload {
  /** User's payment address */
  userAddress: string;
}

export interface ResetSubscriptionResult {
  success: boolean;
}

/**
 * Set offline mode
 * Command: set_offline_mode
 */
export interface SetOfflineModePayload {
  /** Enable or disable offline mode */
  enabled: boolean;
}

export interface SetOfflineModeResult {
  success: boolean;
}

/**
 * Get user's payment address
 * Command: get_user_address
 */
export interface GetUserAddressPayload {
  // No parameters needed
}

export interface GetUserAddressResult {
  /** User's payment address */
  address: string;
}

/**
 * Generate new payment address
 * Command: generate_payment_address
 */
export interface GeneratePaymentAddressPayload {
  // No parameters needed
}

export interface GeneratePaymentAddressResult {
  /** Newly generated payment address */
  address: string;
  /** Private key (WIF format) */
  privateKey: string;
}

// ============================================================================
// IPC Events
// ============================================================================

/**
 * Tauri event names for subscription updates
 */
export const IPC_EVENTS = {
  // Subscription state changes
  SUBSCRIPTION_STATE_CHANGED: 'subscription://state_changed',
  SUBSCRIPTION_STATUS_UPDATED: 'subscription://status_updated',

  // Payment events
  PAYMENT_SUBMITTED: 'subscription://payment_submitted',
  PAYMENT_CONFIRMED: 'subscription://payment_confirmed',
  PAYMENT_FAILED: 'subscription://payment_failed',

  // Grace period and expiration
  GRACE_PERIOD_STARTED: 'subscription://grace_period_started',
  SUBSCRIPTION_EXPIRED: 'subscription://subscription_expired',
  SUBSCRIPTION_EXPIRING_SOON: 'subscription://expiring_soon',

  // Error events
  SUBSCRIPTION_ERROR: 'subscription://error',
} as const;

// ============================================================================
// Event Payloads
// ============================================================================

/**
 * Subscription state changed event
 */
export interface SubscriptionStateChangedEvent {
  oldState: SubscriptionState;
  newState: SubscriptionState;
  timestamp: number;
  userAddress: string;
}

/**
 * Subscription status updated event
 */
export interface SubscriptionStatusUpdatedEvent {
  status: SubscriptionStatus;
  timestamp: number;
}

/**
 * Payment submitted event
 */
export interface PaymentSubmittedEvent {
  txid: string;
  amountSatoshis: number;
  userAddress: string;
  timestamp: number;
}

/**
 * Payment confirmed event
 */
export interface PaymentConfirmedEvent {
  txid: string;
  blockHeight: number;
  confirmations: number;
  timestamp: number;
}

/**
 * Payment failed event
 */
export interface PaymentFailedEvent {
  txid?: string;
  error: string;
  timestamp: number;
}

/**
 * Grace period started event
 */
export interface GracePeriodStartedEvent {
  expiresAt: number;
  daysRemaining: number;
  timestamp: number;
}

/**
 * Subscription expired event
 */
export interface SubscriptionExpiredEvent {
  expiredAt: number;
  timestamp: number;
}

/**
 * Subscription expiring soon event
 */
export interface SubscriptionExpiringSoonEvent {
  expiresAt: number;
  daysRemaining: number;
  timestamp: number;
}

/**
 * Subscription error event
 */
export interface SubscriptionErrorEvent {
  error: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Type-safe IPC command invoker
 */
export type IpcCommand<P, R> = (payload: P) => Promise<R>;

/**
 * Type-safe IPC event listener
 */
export type IpcEventListener<T> = (event: T) => void;

/**
 * Union type of all IPC command names
 */
export type IpcCommandName = typeof IPC_COMMANDS[keyof typeof IPC_COMMANDS];

/**
 * Union type of all IPC event names
 */
export type IpcEventName = typeof IPC_EVENTS[keyof typeof IPC_EVENTS];

// ============================================================================
// Error Types
// ============================================================================

/**
 * IPC error response
 */
export interface IpcError {
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Type guard for IPC errors
 */
export function isIpcError(result: unknown): result is IpcError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'message' in result &&
    typeof (result as IpcError).message === 'string'
  );
}
