/**
 * Subscription Store (Zustand)
 *
 * Manages subscription state machine per SPEC §5.6:
 * - Active: UTXO unspent, verified <72h
 * - Cached: UTXO unspent, offline <72h
 * - Expired: UTXO spent on-chain
 * - GraceExceeded: Cannot verify, offline >72h
 * - NotFound: No subscription UTXO exists
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CheckSubscriptionResponse, SubscriptionState } from '@/types';

export interface SubscriptionStoreState {
  // Current subscription state
  state: SubscriptionState;

  // UTXO details
  txid?: string;
  vout?: number;
  blockHeight?: number;
  confirmations?: number;

  // Verification timestamps
  verifiedAt?: string;
  cachedProof: boolean;
  graceExpiresAt?: string;

  // Loading & error state
  isLoading: boolean;
  isRefreshing: boolean;
  error?: string;

  // Retry logic
  retryCount: number;
  nextRetryAt?: string;

  // Actions
  setSubscription: (response: CheckSubscriptionResponse) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | undefined) => void;
  resetRetry: () => void;
  incrementRetry: () => void;
  clearSubscription: () => void;

  // Computed helpers
  isOperational: () => boolean;
  needsRenewal: () => boolean;
  getGracePeriodRemaining: () => number | null;
  canRetry: () => boolean;
}

/**
 * Calculate grace period expiration (72 hours from last verification)
 */
function calculateGraceExpiration(verifiedAt: string): string {
  const verified = new Date(verifiedAt);
  const grace = new Date(verified.getTime() + 72 * 60 * 60 * 1000);
  return grace.toISOString();
}

/**
 * Calculate next retry time with exponential backoff
 */
function calculateNextRetry(retryCount: number): string {
  const baseDelay = 30000; // 30 seconds
  const maxDelay = 1800000; // 30 minutes
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  return new Date(Date.now() + delay).toISOString();
}

export const useSubscriptionStore = create<SubscriptionStoreState>()(
  persist(
    (set, get) => ({
      // Initial state: NotFound until first check
      state: 'NotFound',
      cachedProof: false,
      isLoading: false,
      isRefreshing: false,
      retryCount: 0,

      setSubscription: (response: CheckSubscriptionResponse) => {
        // Calculate grace expiration for Cached state
        let graceExpiresAt: string | undefined;
        if (response.state === 'Cached' && response.verifiedAt) {
          graceExpiresAt = calculateGraceExpiration(response.verifiedAt);
        }

        set({
          state: response.state,
          txid: response.txid,
          vout: response.vout,
          blockHeight: response.blockHeight,
          confirmations: response.confirmations,
          verifiedAt: response.verifiedAt,
          cachedProof: response.cachedProof,
          graceExpiresAt,
          isLoading: false,
          isRefreshing: false,
          error: undefined,
          retryCount: 0, // Reset on successful check
          nextRetryAt: undefined,
        });
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setRefreshing: (refreshing: boolean) => set({ isRefreshing: refreshing }),

      setError: (error: string | undefined) => {
        const state = get();
        set({
          error,
          isLoading: false,
          isRefreshing: false,
          nextRetryAt: error ? calculateNextRetry(state.retryCount) : undefined,
        });
      },

      resetRetry: () => set({ retryCount: 0, nextRetryAt: undefined }),

      incrementRetry: () => {
        const state = get();
        const newRetryCount = state.retryCount + 1;
        set({
          retryCount: newRetryCount,
          nextRetryAt: calculateNextRetry(newRetryCount),
        });
      },

      clearSubscription: () => set({
        state: 'NotFound',
        txid: undefined,
        vout: undefined,
        blockHeight: undefined,
        confirmations: undefined,
        verifiedAt: undefined,
        cachedProof: false,
        graceExpiresAt: undefined,
        error: undefined,
        retryCount: 0,
        nextRetryAt: undefined,
      }),

      // Computed: is subscription operational?
      isOperational: () => {
        const state = get().state;
        return state === 'Active' || state === 'Cached';
      },

      // Computed: does subscription need renewal?
      needsRenewal: () => {
        const state = get().state;
        return state === 'Expired' || state === 'NotFound';
      },

      // Computed: grace period remaining in milliseconds
      getGracePeriodRemaining: () => {
        const state = get();
        if (!state.graceExpiresAt) return null;

        const now = Date.now();
        const expiry = new Date(state.graceExpiresAt).getTime();
        return Math.max(0, expiry - now);
      },

      // Computed: can we retry now?
      canRetry: () => {
        const state = get();
        if (!state.nextRetryAt) return true;
        return Date.now() >= new Date(state.nextRetryAt).getTime();
      },
    }),
    {
      name: 'edwinpai-subscription',
      version: 1,

      // Only persist essential subscription data
      partialize: (state) => ({
        state: state.state,
        txid: state.txid,
        vout: state.vout,
        blockHeight: state.blockHeight,
        verifiedAt: state.verifiedAt,
        cachedProof: state.cachedProof,
        graceExpiresAt: state.graceExpiresAt,
      }),
    }
  )
);
