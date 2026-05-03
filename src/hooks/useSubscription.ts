/**
 * useSubscription Hook
 *
 * Manages subscription verification lifecycle:
 * - Calls check_subscription IPC command
 * - Handles 5 subscription states (Active/Cached/Expired/GraceExceeded/NotFound)
 * - Automatic retry with exponential backoff
 * - Grace period countdown for Cached state
 */

import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useSubscriptionStore } from "@/stores/subscriptionStore";
import type { CheckSubscriptionResponse, SubscriptionState } from "@/types";

export interface UseSubscriptionOptions {
  /** Auto-check on mount (default: true) */
  autoCheck?: boolean;
  /** Polling interval in ms for Cached state (default: 5 minutes) */
  pollingInterval?: number;
  /** Enable automatic retry on error (default: true) */
  autoRetry?: boolean;
  /** Max retry attempts before giving up (default: 5) */
  maxRetries?: number;
}

export interface UseSubscriptionReturn {
  // State
  state: SubscriptionState;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: string;

  // Subscription details
  txid?: string;
  vout?: number;
  verifiedAt?: string;
  cachedProof: boolean;
  graceExpiresAt?: string;

  // Computed values
  isOperational: boolean;
  needsRenewal: boolean;
  gracePeriodRemaining: number | null;

  // Actions
  check: (forceRefresh?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

/**
 * Hook for managing subscription state
 */
export function useSubscription(
  options: UseSubscriptionOptions = {},
): UseSubscriptionReturn {
  const {
    autoCheck = true,
    pollingInterval = 5 * 60 * 1000, // 5 minutes
    autoRetry = true,
    maxRetries = 5,
  } = options;

  // Zustand store
  const store = useSubscriptionStore();

  // Refs for intervals/timeouts
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Check subscription status via IPC
   */
  const check = useCallback(
    async (forceRefresh = false) => {
      try {
        // Don't start new check if already loading
        if (store.isLoading) return;

        store.setLoading(true);
        store.setError(undefined);

        // Call Tauri IPC command
        const response = await invoke<CheckSubscriptionResponse>(
          "check_subscription",
          { forceRefresh },
        );

        // Update store with response
        store.setSubscription(response as CheckSubscriptionResponse);

        // Setup polling for Cached state
        if (pollingTimerRef.current !== null) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }

        if (response.state === "Cached") {
          pollingTimerRef.current = setInterval(() => {
            check(false).catch(console.error);
          }, pollingInterval);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        store.setError(errorMessage);

        // Setup retry if enabled
        if (autoRetry && store.retryCount < maxRetries) {
          store.incrementRetry();

          // Schedule retry
          const retryDelay = Math.min(
            30000 * Math.pow(2, store.retryCount),
            1800000, // max 30 min
          );

          if (retryTimerRef.current !== null) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }

          retryTimerRef.current = setTimeout(() => {
            if (store.canRetry()) {
              check(false).catch(console.error);
            }
          }, retryDelay);
        }
      } finally {
        store.setLoading(false);
      }
    },
    [store, pollingInterval, autoRetry, maxRetries],
  );

  /**
   * Force refresh from overlay (bypasses cache)
   */
  const refresh = useCallback(async () => {
    store.setRefreshing(true);
    try {
      await check(true);
    } finally {
      store.setRefreshing(false);
    }
  }, [check, store]);

  /**
   * Clear subscription state (for logout/reset)
   */
  const clear = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    store.clearSubscription();
  }, [store]);

  /**
   * Auto-check on mount
   */
  useEffect(() => {
    if (autoCheck) {
      check(false).catch(console.error);
    }

    return () => {
      if (pollingTimerRef.current !== null) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [autoCheck, check]);

  /**
   * Monitor grace period and transition to GraceExceeded
   */
  useEffect(() => {
    if (store.state !== "Cached" || !store.graceExpiresAt) return;

    const checkGracePeriod = () => {
      const remaining = store.getGracePeriodRemaining();
      if (remaining !== null && remaining <= 0) {
        // Grace period expired, force transition to GraceExceeded
        store.setSubscription({
          type: "CheckSubscriptionResponse",
          state: "GraceExceeded",
          cachedProof: true,
          txid: store.txid ?? undefined,
          vout: store.vout ?? undefined,
          verifiedAt: store.verifiedAt ?? undefined,
          blockHeight: store.blockHeight ?? undefined,
        });
      }
    };

    // Check immediately
    checkGracePeriod();

    // Check every 10 seconds
    const graceTimer = setInterval(checkGracePeriod, 10000);

    return () => clearInterval(graceTimer);
  }, [store, store.state, store.graceExpiresAt]);

  return {
    // State
    state: store.state,
    isLoading: store.isLoading,
    isRefreshing: store.isRefreshing,
    error: store.error,

    // Details
    txid: store.txid,
    vout: store.vout,
    verifiedAt: store.verifiedAt,
    cachedProof: store.cachedProof,
    graceExpiresAt: store.graceExpiresAt,

    // Computed
    isOperational: store.isOperational(),
    needsRenewal: store.needsRenewal(),
    gracePeriodRemaining: store.getGracePeriodRemaining(),

    // Actions
    check,
    refresh,
    clear,
  };
}

/**
 * Hook for subscription status badge
 * Returns user-friendly status display
 */
export function useSubscriptionStatus() {
  const subscription = useSubscription({ autoCheck: false });

  const getStatusBadge = useCallback(() => {
    const { state, gracePeriodRemaining } = subscription;

    switch (state) {
      case "Active":
        return {
          label: "Active",
          variant: "success" as const,
          description: "Subscription verified and operational",
        };

      case "Cached": {
        const hoursRemaining = gracePeriodRemaining
          ? Math.ceil(gracePeriodRemaining / (1000 * 60 * 60))
          : 0;
        return {
          label: "Cached",
          variant: "warning" as const,
          description: `Operating from cache (${hoursRemaining}h grace remaining)`,
        };
      }

      case "Expired":
        return {
          label: "Expired",
          variant: "destructive" as const,
          description: "Subscription has ended. Renew to continue.",
        };

      case "GraceExceeded":
        return {
          label: "Limited",
          variant: "secondary" as const,
          description: "Local-only mode. Connect to internet to verify.",
        };

      case "NotFound":
        return {
          label: "No Subscription",
          variant: "outline" as const,
          description: "Subscribe to unlock full features",
        };

      default:
        return {
          label: "Unknown",
          variant: "outline" as const,
          description: "Unknown subscription state",
        };
    }
  }, [subscription]);

  return {
    ...subscription,
    badge: getStatusBadge(),
  };
}
