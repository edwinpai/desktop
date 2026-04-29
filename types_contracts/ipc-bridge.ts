/**
 * EdwinPAI Desktop - IPC Bridge Type Definitions
 * Shared type definitions ensuring TypeScript/Rust contract alignment
 *
 * This file provides type-safe wrappers for IPC communication between
 * the React frontend (TypeScript) and Tauri backend (Rust).
 *
 * Reference: qmd://edwinpai-ux/spec.md, qmd://edwinpai-ux/edwinpai-desktop/type-contract-manifest.md
 */

import type {
  SubscriptionCommand,
  SubscriptionResponse,
  SubscriptionStatus,
  SubscriptionError,
  PaymentDetails,
} from './subscription-types';

// ============================================================================
// Tauri IPC Command Names
// ============================================================================

/**
 * IPC command names matching Rust #[tauri::command] exports
 */
export const IPC_COMMANDS = {
  CHECK_SUBSCRIPTION: 'check_subscription',
  INITIATE_PAYMENT: 'initiate_payment',
  CONFIRM_PAYMENT: 'confirm_payment',
  CANCEL_PAYMENT: 'cancel_payment',
} as const;

/**
 * IPC event names for subscription updates
 */
export const IPC_EVENTS = {
  SUBSCRIPTION_STATUS_CHANGED: 'subscription://status-changed',
  SUBSCRIPTION_ERROR: 'subscription://error',
  PAYMENT_INITIATED: 'subscription://payment-initiated',
  PAYMENT_CONFIRMED: 'subscription://payment-confirmed',
} as const;

// ============================================================================
// Type-Safe IPC Invocation Wrappers
// ============================================================================

/**
 * Type-safe wrapper for Tauri invoke()
 * Ensures command payloads and responses match Rust type contracts
 */
export interface TauriInvoke {
  <T>(command: string, payload?: unknown): Promise<T>;
}

/**
 * Subscription-specific IPC client with full type safety
 */
export class SubscriptionIPC {
  constructor(private invoke: TauriInvoke) {}

  /**
   * Check subscription status
   */
  async checkSubscription(
    forceRefresh = false
  ): Promise<SubscriptionStatus> {
    const response = await this.invoke<SubscriptionResponse>(
      IPC_COMMANDS.CHECK_SUBSCRIPTION,
      { force_refresh: forceRefresh }
    );

    if (response.type !== 'check_subscription_response') {
      throw new Error('Invalid response type');
    }

    if (!response.success) {
      throw new IPCError(
        response.error?.message || 'Unknown error',
        response.error
      );
    }

    if (!response.data) {
      throw new Error('Missing response data');
    }

    return response.data;
  }

  /**
   * Initiate subscription payment
   */
  async initiatePayment(
    durationMonths: number,
    paymentMethod: 'bitcoin' | 'auto' = 'auto'
  ): Promise<PaymentDetails> {
    const response = await this.invoke<SubscriptionResponse>(
      IPC_COMMANDS.INITIATE_PAYMENT,
      {
        duration_months: durationMonths,
        payment_method: paymentMethod,
      }
    );

    if (response.type !== 'initiate_payment_response') {
      throw new Error('Invalid response type');
    }

    if (!response.success) {
      throw new IPCError(
        response.error?.message || 'Payment initiation failed',
        response.error
      );
    }

    if (!response.data) {
      throw new Error('Missing payment details');
    }

    return response.data;
  }

  /**
   * Confirm payment transaction
   */
  async confirmPayment(
    txid: string,
    utxoIndex: number
  ): Promise<SubscriptionStatus> {
    const response = await this.invoke<SubscriptionResponse>(
      IPC_COMMANDS.CONFIRM_PAYMENT,
      {
        txid,
        utxo_index: utxoIndex,
      }
    );

    if (response.type !== 'confirm_payment_response') {
      throw new Error('Invalid response type');
    }

    if (!response.success) {
      throw new IPCError(
        response.error?.message || 'Payment confirmation failed',
        response.error
      );
    }

    if (!response.data) {
      throw new Error('Missing subscription status');
    }

    return response.data;
  }

  /**
   * Cancel pending payment
   */
  async cancelPayment(reason?: string): Promise<void> {
    const response = await this.invoke<SubscriptionResponse>(
      IPC_COMMANDS.CANCEL_PAYMENT,
      { reason }
    );

    if (response.type !== 'cancel_payment_response') {
      throw new Error('Invalid response type');
    }

    if (!response.success) {
      throw new Error('Payment cancellation failed');
    }
  }
}

// ============================================================================
// IPC Error Handling
// ============================================================================

/**
 * IPC-specific error class with subscription error details
 */
export class IPCError extends Error {
  constructor(
    message: string,
    public readonly details?: SubscriptionError
  ) {
    super(message);
    this.name = 'IPCError';
  }

  get isRecoverable(): boolean {
    return this.details?.recoverable ?? false;
  }

  get retryAfter(): number | undefined {
    return this.details?.retry_after;
  }

  get errorCode(): string | undefined {
    return this.details?.code;
  }
}

// ============================================================================
// Event Listener Types
// ============================================================================

/**
 * Type-safe event listener for subscription events
 */
export interface SubscriptionEventListener {
  (event: SubscriptionEventData): void;
}

export type SubscriptionEventData =
  | { type: 'status_changed'; oldState: string; newState: string; status: SubscriptionStatus }
  | { type: 'error'; error: SubscriptionError }
  | { type: 'payment_initiated'; paymentDetails: PaymentDetails }
  | { type: 'payment_confirmed'; txid: string; newStatus: SubscriptionStatus };

/**
 * Event listener registration helper
 */
export interface EventUnlisten {
  (): void;
}

export interface TauriEvent<T> {
  payload: T;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate subscription response structure
 */
export function validateSubscriptionResponse(
  response: unknown
): response is SubscriptionResponse {
  if (typeof response !== 'object' || response === null) {
    return false;
  }

  const r = response as Record<string, unknown>;

  return (
    typeof r.type === 'string' &&
    typeof r.success === 'boolean' &&
    (r.type === 'check_subscription_response' ||
     r.type === 'initiate_payment_response' ||
     r.type === 'confirm_payment_response' ||
     r.type === 'cancel_payment_response')
  );
}

/**
 * Validate payment details structure
 */
export function validatePaymentDetails(
  data: unknown
): data is PaymentDetails {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    typeof d.paymentAddress === 'string' &&
    typeof d.amountSatoshis === 'number' &&
    typeof d.fiatEquivalent === 'string' &&
    typeof d.durationMonths === 'number' &&
    typeof d.expiresAt === 'number'
  );
}

/**
 * Validate subscription status structure
 */
export function validateSubscriptionStatus(
  data: unknown
): data is SubscriptionStatus {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    typeof d.state === 'string' &&
    ['uninitialized', 'checking', 'active', 'expired', 'payment_pending', 'error'].includes(
      d.state as string
    )
  );
}

// ============================================================================
// Type Conversion Helpers
// ============================================================================

/**
 * Convert snake_case backend response to camelCase frontend format
 */
export function normalizeSubscriptionStatus(
  backendStatus: Record<string, unknown>
): SubscriptionStatus {
  return {
    state: backendStatus.state as any,
    expiresAt: backendStatus.expires_at as number | undefined,
    utxoId: backendStatus.utxo_id as string | undefined,
    lastChecked: backendStatus.last_checked as number | undefined,
    fiatEquivalent: backendStatus.fiat_equivalent as string | undefined,
    error: backendStatus.error as SubscriptionError | undefined,
  };
}

/**
 * Convert camelCase frontend command to snake_case backend format
 */
export function serializeCommandPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }

  return result;
}

// ============================================================================
// Mock IPC for Testing
// ============================================================================

/**
 * Mock IPC client for unit tests
 */
export class MockSubscriptionIPC extends SubscriptionIPC {
  private mockResponses = new Map<string, unknown>();

  constructor() {
    super(async (command: string) => {
      const response = this.mockResponses.get(command);
      if (!response) {
        throw new Error(`No mock response for command: ${command}`);
      }
      return response;
    });
  }

  setMockResponse(command: string, response: unknown): void {
    this.mockResponses.set(command, response);
  }

  clearMocks(): void {
    this.mockResponses.clear();
  }
}
