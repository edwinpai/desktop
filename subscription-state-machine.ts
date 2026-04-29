/**
 * Subscription State Machine
 *
 * Implements 5-state FSM for EdwinPAI subscription lifecycle management.
 * Based on spec.md subscription verification requirements.
 *
 * States:
 * 1. Unsubscribed - No active subscription
 * 2. Pending - Payment submitted, awaiting confirmation
 * 3. Active - Subscription verified and valid
 * 4. Expiring - Grace period (7 days before expiry)
 * 5. Expired - Subscription no longer valid
 *
 * Features:
 * - Transition guards prevent invalid state changes
 * - Grace period timer for expiring subscriptions
 * - Event emission for state changes
 * - Type-safe state transitions
 */

import { SubscriptionUtxo } from './overlay-services-client';
import { SpvVerificationResult } from './types_contracts/spv';

// ============================================================================
// State Definitions
// ============================================================================

export enum SubscriptionState {
  Unsubscribed = 'unsubscribed',
  Pending = 'pending',
  Active = 'active',
  Expiring = 'expiring',
  Expired = 'expired',
}

export interface StateContext {
  /** Current subscription state */
  state: SubscriptionState;
  /** User's payment address */
  userAddress: string;
  /** Active subscription UTXOs (empty for Unsubscribed/Expired) */
  utxos: SubscriptionUtxo[];
  /** SPV verification result */
  verification?: SpvVerificationResult;
  /** Subscription expiry timestamp (Unix seconds) */
  expiresAt?: number;
  /** When state was last updated */
  lastUpdated: number;
  /** Grace period start timestamp (for Expiring state) */
  gracePeriodStart?: number;
  /** Error message if transition failed */
  error?: string;
}

export enum StateEvent {
  /** User initiates subscription payment */
  PaymentSubmitted = 'payment_submitted',
  /** Payment confirmed on-chain */
  PaymentConfirmed = 'payment_confirmed',
  /** SPV verification succeeded */
  VerificationSucceeded = 'verification_succeeded',
  /** Subscription enters grace period */
  GracePeriodStarted = 'grace_period_started',
  /** Subscription expired */
  SubscriptionExpired = 'subscription_expired',
  /** User cancels or fails verification */
  VerificationFailed = 'verification_failed',
  /** Manual state reset */
  Reset = 'reset',
}

// ============================================================================
// Transition Guards
// ============================================================================

/**
 * Defines allowed state transitions with guard conditions.
 */
const TRANSITION_MATRIX: Record<
  SubscriptionState,
  Partial<Record<StateEvent, SubscriptionState>>
> = {
  [SubscriptionState.Unsubscribed]: {
    [StateEvent.PaymentSubmitted]: SubscriptionState.Pending,
  },
  [SubscriptionState.Pending]: {
    [StateEvent.PaymentConfirmed]: SubscriptionState.Pending, // Stay pending until verified
    [StateEvent.VerificationSucceeded]: SubscriptionState.Active,
    [StateEvent.VerificationFailed]: SubscriptionState.Unsubscribed,
    [StateEvent.Reset]: SubscriptionState.Unsubscribed,
  },
  [SubscriptionState.Active]: {
    [StateEvent.GracePeriodStarted]: SubscriptionState.Expiring,
    [StateEvent.SubscriptionExpired]: SubscriptionState.Expired,
    [StateEvent.Reset]: SubscriptionState.Unsubscribed,
  },
  [SubscriptionState.Expiring]: {
    [StateEvent.PaymentSubmitted]: SubscriptionState.Pending, // Allow renewal
    [StateEvent.SubscriptionExpired]: SubscriptionState.Expired,
    [StateEvent.Reset]: SubscriptionState.Unsubscribed,
  },
  [SubscriptionState.Expired]: {
    [StateEvent.PaymentSubmitted]: SubscriptionState.Pending,
    [StateEvent.Reset]: SubscriptionState.Unsubscribed,
  },
};

/**
 * Guard functions for conditional transitions.
 */
const TRANSITION_GUARDS: Partial<
  Record<StateEvent, (context: StateContext) => boolean>
> = {
  [StateEvent.VerificationSucceeded]: (context) => {
    return !!context.verification && context.verification.isValid === true;
  },
  [StateEvent.GracePeriodStarted]: (context) => {
    if (!context.expiresAt) return false;
    const now = Date.now() / 1000;
    const gracePeriodThreshold = 7 * 24 * 60 * 60; // 7 days in seconds
    return context.expiresAt - now <= gracePeriodThreshold;
  },
  [StateEvent.SubscriptionExpired]: (context) => {
    if (!context.expiresAt) return false;
    const now = Date.now() / 1000;
    return now >= context.expiresAt;
  },
};

// ============================================================================
// State Machine
// ============================================================================

export type StateChangeListener = (
  oldState: SubscriptionState,
  newState: SubscriptionState,
  context: StateContext
) => void;

export class SubscriptionStateMachine {
  private context: StateContext;
  private listeners: StateChangeListener[] = [];
  private gracePeriodTimer?: NodeJS.Timeout;

  /** Grace period: 7 days before expiry */
  private readonly GRACE_PERIOD_DAYS = 7;

  constructor(userAddress: string, initialState?: StateContext) {
    this.context = initialState || {
      state: SubscriptionState.Unsubscribed,
      userAddress,
      utxos: [],
      lastUpdated: Date.now(),
    };

    this.startGracePeriodTimer();
  }

  // --------------------------------------------------------------------------
  // State Accessors
  // --------------------------------------------------------------------------

  getState(): SubscriptionState {
    return this.context.state;
  }

  getContext(): Readonly<StateContext> {
    return { ...this.context };
  }

  isActive(): boolean {
    return (
      this.context.state === SubscriptionState.Active ||
      this.context.state === SubscriptionState.Expiring
    );
  }

  isExpired(): boolean {
    return this.context.state === SubscriptionState.Expired;
  }

  isPending(): boolean {
    return this.context.state === SubscriptionState.Pending;
  }

  // --------------------------------------------------------------------------
  // State Transitions
  // --------------------------------------------------------------------------

  /**
   * Attempt to transition to a new state based on an event.
   * Returns success status and updated context.
   */
  transition(
    event: StateEvent,
    updates?: Partial<StateContext>
  ): { success: boolean; context: StateContext; error?: string } {
    const currentState = this.context.state;
    const allowedTransitions = TRANSITION_MATRIX[currentState];

    // Check if transition is allowed
    if (!allowedTransitions || !(event in allowedTransitions)) {
      return {
        success: false,
        context: this.context,
        error: `Invalid transition: ${event} not allowed from ${currentState}`,
      };
    }

    const nextState = allowedTransitions[event]!;

    // Apply guard conditions
    const guard = TRANSITION_GUARDS[event];
    const tempContext = { ...this.context, ...updates };
    if (guard && !guard(tempContext)) {
      return {
        success: false,
        context: this.context,
        error: `Guard condition failed for ${event}`,
      };
    }

    // Execute transition
    const oldState = this.context.state;
    this.context = {
      ...this.context,
      ...updates,
      state: nextState,
      lastUpdated: Date.now(),
      error: undefined,
    };

    // Handle state-specific logic
    this.onStateEntered(nextState);

    // Notify listeners
    this.notifyListeners(oldState, nextState, this.context);

    return {
      success: true,
      context: this.context,
    };
  }

  /**
   * Convenience methods for common transitions.
   */

  submitPayment(txid: string): { success: boolean; error?: string } {
    const result = this.transition(StateEvent.PaymentSubmitted, {
      utxos: [],
    });
    return { success: result.success, error: result.error };
  }

  confirmPayment(utxos: SubscriptionUtxo[]): { success: boolean; error?: string } {
    const result = this.transition(StateEvent.PaymentConfirmed, { utxos });
    return { success: result.success, error: result.error };
  }

  verifySubscription(
    verification: SpvVerificationResult,
    utxos: SubscriptionUtxo[]
  ): { success: boolean; error?: string } {
    if (!verification.isValid) {
      const result = this.transition(StateEvent.VerificationFailed, {
        verification,
        error: 'SPV verification failed',
      });
      return { success: result.success, error: result.error };
    }

    const expiresAt = this.calculateExpiry(utxos);
    const result = this.transition(StateEvent.VerificationSucceeded, {
      verification,
      utxos,
      expiresAt,
    });
    return { success: result.success, error: result.error };
  }

  startGracePeriod(): { success: boolean; error?: string } {
    const result = this.transition(StateEvent.GracePeriodStarted, {
      gracePeriodStart: Date.now(),
    });
    return { success: result.success, error: result.error };
  }

  expire(): { success: boolean; error?: string } {
    const result = this.transition(StateEvent.SubscriptionExpired, {
      utxos: [],
      verification: undefined,
    });
    return { success: result.success, error: result.error };
  }

  reset(): { success: boolean; error?: string } {
    const result = this.transition(StateEvent.Reset, {
      utxos: [],
      verification: undefined,
      expiresAt: undefined,
      gracePeriodStart: undefined,
      error: undefined,
    });
    return { success: result.success, error: result.error };
  }

  // --------------------------------------------------------------------------
  // State-Specific Logic
  // --------------------------------------------------------------------------

  private onStateEntered(state: SubscriptionState): void {
    switch (state) {
      case SubscriptionState.Active:
        this.startGracePeriodTimer();
        break;
      case SubscriptionState.Expiring:
        this.startExpirationTimer();
        break;
      case SubscriptionState.Expired:
      case SubscriptionState.Unsubscribed:
        this.clearTimers();
        break;
    }
  }

  /**
   * Start timer to check for grace period.
   * Runs every 6 hours to check if subscription is within 7 days of expiry.
   */
  private startGracePeriodTimer(): void {
    this.clearTimers();

    if (this.context.state !== SubscriptionState.Active) {
      return;
    }

    this.gracePeriodTimer = setInterval(() => {
      if (this.context.expiresAt) {
        const now = Date.now() / 1000;
        const daysUntilExpiry = (this.context.expiresAt - now) / (24 * 60 * 60);

        if (daysUntilExpiry <= this.GRACE_PERIOD_DAYS) {
          this.startGracePeriod();
        }
      }
    }, 6 * 60 * 60 * 1000); // Check every 6 hours
  }

  /**
   * Start timer to expire subscription.
   * Checks every hour once in grace period.
   */
  private startExpirationTimer(): void {
    this.clearTimers();

    this.gracePeriodTimer = setInterval(() => {
      if (this.context.expiresAt) {
        const now = Date.now() / 1000;
        if (now >= this.context.expiresAt) {
          this.expire();
        }
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  private clearTimers(): void {
    if (this.gracePeriodTimer) {
      clearInterval(this.gracePeriodTimer);
      this.gracePeriodTimer = undefined;
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(
    oldState: SubscriptionState,
    newState: SubscriptionState,
    context: StateContext
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(oldState, newState, context);
      } catch (error) {
        console.error('[StateMachine] Listener error:', error);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Calculate expiry timestamp from UTXOs.
   * Uses the latest expiry time from all UTXOs.
   */
  private calculateExpiry(utxos: SubscriptionUtxo[]): number | undefined {
    if (utxos.length === 0) return undefined;

    return Math.max(...utxos.map(utxo => utxo.expiresAt));
  }

  /**
   * Serialize state machine for persistence.
   */
  serialize(): string {
    return JSON.stringify(this.context);
  }

  /**
   * Restore state machine from serialized context.
   */
  static deserialize(userAddress: string, serialized: string): SubscriptionStateMachine {
    try {
      const context = JSON.parse(serialized) as StateContext;
      return new SubscriptionStateMachine(userAddress, context);
    } catch (error) {
      console.error('[StateMachine] Deserialization error:', error);
      return new SubscriptionStateMachine(userAddress);
    }
  }

  /**
   * Cleanup timers on disposal.
   */
  dispose(): void {
    this.clearTimers();
    this.listeners = [];
  }
}

// ============================================================================
// State Machine Factory
// ============================================================================

/**
 * Create a new subscription state machine.
 */
export function createStateMachine(
  userAddress: string,
  initialState?: StateContext
): SubscriptionStateMachine {
  return new SubscriptionStateMachine(userAddress, initialState);
}
