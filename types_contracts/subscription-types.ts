/**
 * EdwinPAI Desktop - Subscription Type Contracts
 * TypeScript type definitions for subscription state management
 *
 * Reference: qmd://edwinpai-ux/spec.md, qmd://edwinpai-ux/edwinpai-desktop/type-contract-manifest.md
 */

// ============================================================================
// Core Subscription State Types
// ============================================================================

/**
 * Subscription lifecycle states
 */
export enum SubscriptionState {
  UNINITIALIZED = 'uninitialized',
  CHECKING = 'checking',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  PAYMENT_PENDING = 'payment_pending',
  ERROR = 'error',
}

/**
 * Complete subscription status information
 */
export interface SubscriptionStatus {
  state: SubscriptionState;
  expiresAt?: number; // Unix timestamp in seconds
  utxoId?: string; // Subscription UTXO identifier
  lastChecked?: number; // Unix timestamp in seconds
  fiatEquivalent?: string; // e.g., "$9.99 USD"
  error?: SubscriptionError;
}

/**
 * Subscription error details
 */
export interface SubscriptionError {
  code: SubscriptionErrorCode;
  message: string;
  recoverable: boolean;
  retryAfter?: number; // Seconds until retry is allowed
}

export enum SubscriptionErrorCode {
  NETWORK_ERROR = 'network_error',
  UTXO_NOT_FOUND = 'utxo_not_found',
  INVALID_UTXO = 'invalid_utxo',
  GATEWAY_UNAVAILABLE = 'gateway_unavailable',
  PAYMENT_FAILED = 'payment_failed',
  UNKNOWN = 'unknown',
}

// ============================================================================
// IPC Command Payloads - Frontend to Backend
// ============================================================================

export type SubscriptionCommand =
  | CheckSubscriptionCommand
  | InitiatePaymentCommand
  | ConfirmPaymentCommand
  | CancelPaymentCommand;

export interface CheckSubscriptionCommand {
  type: 'check_subscription';
  payload: {
    forceRefresh?: boolean; // Skip cache and check blockchain
  };
}

export interface InitiatePaymentCommand {
  type: 'initiate_payment';
  payload: {
    durationMonths: number; // 1, 3, 6, 12
    paymentMethod?: 'bitcoin' | 'auto'; // Default: auto
  };
}

export interface ConfirmPaymentCommand {
  type: 'confirm_payment';
  payload: {
    txid: string; // Bitcoin transaction ID
    utxoIndex: number;
  };
}

export interface CancelPaymentCommand {
  type: 'cancel_payment';
  payload: {
    reason?: string;
  };
}

// ============================================================================
// IPC Response Payloads - Backend to Frontend
// ============================================================================

export type SubscriptionResponse =
  | CheckSubscriptionResponse
  | InitiatePaymentResponse
  | ConfirmPaymentResponse
  | CancelPaymentResponse;

export interface CheckSubscriptionResponse {
  type: 'check_subscription_response';
  success: boolean;
  data?: SubscriptionStatus;
  error?: SubscriptionError;
}

export interface InitiatePaymentResponse {
  type: 'initiate_payment_response';
  success: boolean;
  data?: PaymentDetails;
  error?: SubscriptionError;
}

export interface ConfirmPaymentResponse {
  type: 'confirm_payment_response';
  success: boolean;
  data?: SubscriptionStatus;
  error?: SubscriptionError;
}

export interface CancelPaymentResponse {
  type: 'cancel_payment_response';
  success: boolean;
}

/**
 * Payment initiation details returned to frontend
 */
export interface PaymentDetails {
  paymentAddress: string; // Bitcoin address to pay
  amountSatoshis: number;
  fiatEquivalent: string; // e.g., "$9.99 USD"
  durationMonths: number;
  expiresAt: number; // Payment window expiration (Unix timestamp)
  qrCode?: string; // Base64-encoded QR code image
}

// ============================================================================
// React Hook Return Type
// ============================================================================

/**
 * Return type for useSubscription() hook
 */
export interface UseSubscriptionReturn {
  // State
  status: SubscriptionStatus;
  isLoading: boolean;
  isActive: boolean;

  // Actions
  checkSubscription: (forceRefresh?: boolean) => Promise<void>;
  initiatePayment: (durationMonths: number) => Promise<PaymentDetails>;
  confirmPayment: (txid: string, utxoIndex: number) => Promise<void>;
  cancelPayment: (reason?: string) => Promise<void>;

  // Computed values
  daysRemaining: number | null;
  formattedExpiry: string | null; // e.g., "Expires Feb 10, 2027"
  renewalRecommended: boolean; // True if < 7 days remaining
}

// ============================================================================
// Subscription Cache Types
// ============================================================================

/**
 * Cached subscription data with TTL
 */
export interface SubscriptionCache {
  status: SubscriptionStatus;
  cachedAt: number; // Unix timestamp
  ttl: number; // Seconds until cache expires
}

export interface SubscriptionCacheOptions {
  ttlSeconds?: number; // Default: 300 (5 minutes)
  enablePersistence?: boolean; // Save to localStorage
}

// ============================================================================
// Event Types for Subscription Updates
// ============================================================================

export type SubscriptionEvent =
  | SubscriptionStatusChangedEvent
  | SubscriptionErrorEvent
  | PaymentInitiatedEvent
  | PaymentConfirmedEvent;

export interface SubscriptionStatusChangedEvent {
  type: 'subscription_status_changed';
  payload: {
    oldState: SubscriptionState;
    newState: SubscriptionState;
    status: SubscriptionStatus;
  };
}

export interface SubscriptionErrorEvent {
  type: 'subscription_error';
  payload: {
    error: SubscriptionError;
  };
}

export interface PaymentInitiatedEvent {
  type: 'payment_initiated';
  payload: {
    paymentDetails: PaymentDetails;
  };
}

export interface PaymentConfirmedEvent {
  type: 'payment_confirmed';
  payload: {
    txid: string;
    newStatus: SubscriptionStatus;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isActiveSubscription(status: SubscriptionStatus): boolean {
  return status.state === SubscriptionState.ACTIVE &&
         status.expiresAt !== undefined &&
         status.expiresAt > Date.now() / 1000;
}

export function isExpiredSubscription(status: SubscriptionStatus): boolean {
  return status.state === SubscriptionState.EXPIRED ||
         (status.expiresAt !== undefined && status.expiresAt <= Date.now() / 1000);
}

export function needsRenewal(status: SubscriptionStatus, daysThreshold = 7): boolean {
  if (!status.expiresAt) return false;
  const secondsRemaining = status.expiresAt - Date.now() / 1000;
  return secondsRemaining > 0 && secondsRemaining < daysThreshold * 86400;
}
