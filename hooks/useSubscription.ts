/**
 * useSubscription Hook
 *
 * React hook for managing subscription state and IPC communication with Tauri backend.
 * Provides unified interface for subscription operations, state management, and real-time updates.
 *
 * Features:
 * - Automatic status polling and updates
 * - Real-time event subscriptions
 * - Payment flow management
 * - Error handling and retry logic
 * - Optimistic UI updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  SubscriptionState,
  SubscriptionStatus,
  SubscriptionPlan,
  PaymentRequest,
  PaymentResult,
  DEFAULT_SUBSCRIPTION_PLANS,
} from '../types_contracts/subscription';
import {
  IPC_COMMANDS,
  IPC_EVENTS,
  GetSubscriptionStatusResult,
  RefreshSubscriptionResult,
  SubmitPaymentResult,
  InitiatePaymentResult,
  SubscriptionStateChangedEvent,
  SubscriptionStatusUpdatedEvent,
  PaymentSubmittedEvent,
  PaymentConfirmedEvent,
  GracePeriodStartedEvent,
  SubscriptionExpiredEvent,
} from '../types_contracts/ipc';

// ============================================================================
// Hook Configuration
// ============================================================================

export interface UseSubscriptionConfig {
  /** User's payment address */
  userAddress: string;
  /** Auto-refresh interval in milliseconds (default: 60 seconds) */
  refreshInterval?: number;
  /** Enable real-time event subscriptions */
  enableEvents?: boolean;
  /** Callback when subscription state changes */
  onStateChange?: (oldState: SubscriptionState, newState: SubscriptionState) => void;
  /** Callback when payment is confirmed */
  onPaymentConfirmed?: (txid: string) => void;
  /** Callback when subscription expires */
  onExpired?: () => void;
}

// ============================================================================
// Hook State
// ============================================================================

export interface UseSubscriptionState {
  /** Current subscription status */
  status: SubscriptionStatus | null;
  /** Available subscription plans */
  plans: SubscriptionPlan[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Payment in progress */
  paymentInProgress: boolean;
  /** Last refresh timestamp */
  lastRefresh: number | null;
}

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseSubscriptionReturn extends UseSubscriptionState {
  /** Refresh subscription status */
  refresh: (forceRefresh?: boolean) => Promise<void>;
  /** Check if subscription is active */
  isActive: boolean;
  /** Check if subscription is pending */
  isPending: boolean;
  /** Check if subscription is expiring soon (within 7 days) */
  isExpiringSoon: boolean;
  /** Submit a payment for subscription */
  submitPayment: (paymentRequest: PaymentRequest) => Promise<PaymentResult>;
  /** Reset subscription state */
  resetSubscription: () => Promise<void>;
  /** Get user-friendly status message */
  getStatusMessage: () => string;
  /** Get plan by ID */
  getPlan: (planId: string) => SubscriptionPlan | undefined;
}

// ============================================================================
// useSubscription Hook
// ============================================================================

export function useSubscription(config: UseSubscriptionConfig): UseSubscriptionReturn {
  const {
    userAddress,
    refreshInterval = 60 * 1000, // 60 seconds
    enableEvents = true,
    onStateChange,
    onPaymentConfirmed,
    onExpired,
  } = config;

  // State
  const [state, setState] = useState<UseSubscriptionState>({
    status: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    isLoading: true,
    error: null,
    paymentInProgress: false,
    lastRefresh: null,
  });

  // Refs for cleanup
  const unlistenFns = useRef<UnlistenFn[]>([]);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------------------------
  // Core Operations
  // --------------------------------------------------------------------------

  /**
   * Fetch subscription status from backend
   */
  const fetchStatus = useCallback(
    async (forceRefresh = false): Promise<SubscriptionStatus> => {
      try {
        const result = await invoke<RefreshSubscriptionResult>(IPC_COMMANDS.REFRESH_SUBSCRIPTION, {
          userAddress,
          forceRefresh,
        });
        return result.status;
      } catch (error) {
        throw new Error(`Failed to fetch subscription status: ${error}`);
      }
    },
    [userAddress]
  );

  /**
   * Refresh subscription status
   */
  const refresh = useCallback(
    async (forceRefresh = false) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const status = await fetchStatus(forceRefresh);
        setState((prev) => ({
          ...prev,
          status,
          isLoading: false,
          lastRefresh: Date.now(),
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    },
    [fetchStatus]
  );

  /**
   * Submit payment for subscription
   */
  const submitPayment = useCallback(
    async (paymentRequest: PaymentRequest): Promise<PaymentResult> => {
      setState((prev) => ({ ...prev, paymentInProgress: true, error: null }));

      try {
        // Step 1: Initiate payment (create transaction)
        const initResult = await invoke<InitiatePaymentResult>(IPC_COMMANDS.INITIATE_PAYMENT, {
          paymentRequest,
        });

        // Step 2: Submit payment (broadcast transaction)
        const submitResult = await invoke<SubmitPaymentResult>(IPC_COMMANDS.SUBMIT_PAYMENT, {
          rawTx: initResult.rawTx,
          userAddress,
        });

        if (submitResult.result.success) {
          // Optimistically update state to Pending
          setState((prev) => ({
            ...prev,
            paymentInProgress: false,
            status: prev.status
              ? {
                  ...prev.status,
                  state: SubscriptionState.Pending,
                  message: 'Payment submitted. Waiting for confirmation...',
                }
              : null,
          }));

          // Start polling for confirmation
          setTimeout(() => refresh(true), 30000); // Check after 30 seconds
        } else {
          setState((prev) => ({
            ...prev,
            paymentInProgress: false,
            error: submitResult.result.error || 'Payment failed',
          }));
        }

        return submitResult.result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          paymentInProgress: false,
          error: error instanceof Error ? error.message : 'Payment failed',
        }));

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Payment failed',
        };
      }
    },
    [userAddress, refresh]
  );

  /**
   * Reset subscription state
   */
  const resetSubscription = useCallback(async () => {
    try {
      await invoke(IPC_COMMANDS.RESET_SUBSCRIPTION, { userAddress });
      await refresh(true);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to reset subscription',
      }));
    }
  }, [userAddress, refresh]);

  // --------------------------------------------------------------------------
  // Computed Properties
  // --------------------------------------------------------------------------

  const isActive = state.status?.isActive ?? false;
  const isPending = state.status?.state === SubscriptionState.Pending;
  const isExpiringSoon =
    state.status?.state === SubscriptionState.Expiring ||
    (state.status?.daysUntilExpiry !== undefined && state.status.daysUntilExpiry <= 7);

  /**
   * Get user-friendly status message
   */
  const getStatusMessage = useCallback((): string => {
    if (!state.status) return 'Loading subscription status...';
    if (state.status.message) return state.status.message;

    switch (state.status.state) {
      case SubscriptionState.Unsubscribed:
        return 'No active subscription. Subscribe to activate EdwinPAI.';
      case SubscriptionState.Pending:
        return 'Payment submitted. Waiting for confirmation...';
      case SubscriptionState.Active:
        if (state.status.daysUntilExpiry !== undefined) {
          const days = Math.floor(state.status.daysUntilExpiry);
          return `Subscription active. ${days} day${days !== 1 ? 's' : ''} remaining.`;
        }
        return 'Subscription active.';
      case SubscriptionState.Expiring:
        if (state.status.daysUntilExpiry !== undefined) {
          const days = Math.floor(state.status.daysUntilExpiry);
          return `Subscription expiring soon. ${days} day${days !== 1 ? 's' : ''} remaining. Please renew.`;
        }
        return 'Subscription expiring soon. Please renew.';
      case SubscriptionState.Expired:
        return 'Subscription expired. Please renew to continue using EdwinPAI.';
      default:
        return 'Unknown subscription status.';
    }
  }, [state.status]);

  /**
   * Get plan by ID
   */
  const getPlan = useCallback(
    (planId: string): SubscriptionPlan | undefined => {
      return state.plans.find((plan) => plan.id === planId);
    },
    [state.plans]
  );

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!enableEvents) return;

    const setupEventListeners = async () => {
      // Subscription state changed
      const unlistenStateChange = await listen<SubscriptionStateChangedEvent>(
        IPC_EVENTS.SUBSCRIPTION_STATE_CHANGED,
        (event) => {
          if (event.payload.userAddress === userAddress) {
            onStateChange?.(event.payload.oldState, event.payload.newState);
            // Refresh status after state change
            refresh(false);
          }
        }
      );

      // Subscription status updated
      const unlistenStatusUpdate = await listen<SubscriptionStatusUpdatedEvent>(
        IPC_EVENTS.SUBSCRIPTION_STATUS_UPDATED,
        (event) => {
          setState((prev) => ({
            ...prev,
            status: event.payload.status,
            lastRefresh: Date.now(),
          }));
        }
      );

      // Payment submitted
      const unlistenPaymentSubmitted = await listen<PaymentSubmittedEvent>(
        IPC_EVENTS.PAYMENT_SUBMITTED,
        (event) => {
          if (event.payload.userAddress === userAddress) {
            setState((prev) => ({ ...prev, paymentInProgress: true }));
          }
        }
      );

      // Payment confirmed
      const unlistenPaymentConfirmed = await listen<PaymentConfirmedEvent>(
        IPC_EVENTS.PAYMENT_CONFIRMED,
        (event) => {
          setState((prev) => ({ ...prev, paymentInProgress: false }));
          onPaymentConfirmed?.(event.payload.txid);
          refresh(true);
        }
      );

      // Grace period started
      const unlistenGracePeriod = await listen<GracePeriodStartedEvent>(
        IPC_EVENTS.GRACE_PERIOD_STARTED,
        () => {
          refresh(false);
        }
      );

      // Subscription expired
      const unlistenExpired = await listen<SubscriptionExpiredEvent>(
        IPC_EVENTS.SUBSCRIPTION_EXPIRED,
        () => {
          onExpired?.();
          refresh(true);
        }
      );

      unlistenFns.current = [
        unlistenStateChange,
        unlistenStatusUpdate,
        unlistenPaymentSubmitted,
        unlistenPaymentConfirmed,
        unlistenGracePeriod,
        unlistenExpired,
      ];
    };

    setupEventListeners();

    return () => {
      unlistenFns.current.forEach((fn) => fn());
      unlistenFns.current = [];
    };
  }, [enableEvents, userAddress, onStateChange, onPaymentConfirmed, onExpired, refresh]);

  // --------------------------------------------------------------------------
  // Periodic Refresh
  // --------------------------------------------------------------------------

  useEffect(() => {
    // Initial fetch
    refresh(false);

    // Setup periodic refresh
    if (refreshInterval > 0) {
      refreshTimer.current = setInterval(() => {
        refresh(false);
      }, refreshInterval);
    }

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [refresh, refreshInterval]);

  // --------------------------------------------------------------------------
  // Return Hook Interface
  // --------------------------------------------------------------------------

  return {
    ...state,
    refresh,
    isActive,
    isPending,
    isExpiringSoon,
    submitPayment,
    resetSubscription,
    getStatusMessage,
    getPlan,
  };
}
