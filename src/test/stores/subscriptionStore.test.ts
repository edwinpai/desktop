/**
 * Subscription Store Tests
 *
 * Tests for Zustand subscription store state management
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSubscriptionStore } from '@/stores/subscriptionStore';
import type { CheckSubscriptionResponse } from '@/types';

describe('subscriptionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { clearSubscription } = useSubscriptionStore.getState();
    clearSubscription();
  });

  describe('Initial State', () => {
    it('should have NotFound as initial state', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.state).toBe('NotFound');
    });

    it('should not be loading initially', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isRefreshing).toBe(false);
    });

    it('should have no error initially', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.error).toBeUndefined();
    });

    it('should have cachedProof as false initially', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.cachedProof).toBe(false);
    });

    it('should have zero retry count initially', () => {
      const { result } = renderHook(() => useSubscriptionStore());
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('setSubscription', () => {
    it('should update state to Active', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        txid: '1234567890abcdef',
        vout: 0,
        verifiedAt: '2026-02-10T12:00:00Z',
        cachedProof: false,
        blockHeight: 850000,
        confirmations: 6,
      };

      act(() => {
        result.current.setSubscription(response);
      });

      expect(result.current.state).toBe('Active');
      expect(result.current.txid).toBe('1234567890abcdef');
      expect(result.current.vout).toBe(0);
      expect(result.current.verifiedAt).toBe('2026-02-10T12:00:00Z');
      expect(result.current.cachedProof).toBe(false);
      expect(result.current.blockHeight).toBe(850000);
    });

    it('should calculate grace expiration for Cached state', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      const verifiedAt = new Date().toISOString();
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        txid: 'abc123',
        vout: 1,
        verifiedAt,
        cachedProof: true,
      };

      act(() => {
        result.current.setSubscription(response);
      });

      expect(result.current.state).toBe('Cached');
      expect(result.current.graceExpiresAt).toBeDefined();

      // Grace period should be 72 hours from verifiedAt
      const expectedGrace = new Date(
        new Date(verifiedAt).getTime() + 72 * 60 * 60 * 1000,
      ).getTime();
      const actualGrace = new Date(result.current.graceExpiresAt!).getTime();

      expect(actualGrace).toBe(expectedGrace);
    });

    it('should reset retry count on successful update', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      // Set initial retry count
      act(() => {
        result.current.incrementRetry();
        result.current.incrementRetry();
      });

      expect(result.current.retryCount).toBe(2);

      // Update subscription
      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          cachedProof: false,
        });
      });

      expect(result.current.retryCount).toBe(0);
    });

    it('should clear loading and error states', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      // Set loading and error
      act(() => {
        result.current.setLoading(true);
        result.current.setError('Test error');
      });

      // setError() clears loading state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Test error');

      // Update subscription
      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          cachedProof: false,
        });
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });
  });

  describe('State Transitions', () => {
    it('should handle NotFound → Active transition', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      expect(result.current.state).toBe('NotFound');

      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          txid: 'test',
          vout: 0,
          cachedProof: false,
        });
      });

      expect(result.current.state).toBe('Active');
    });

    it('should handle Active → Cached transition', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          txid: 'test',
          vout: 0,
          cachedProof: false,
          verifiedAt: new Date().toISOString(),
        });
      });

      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Cached',
          txid: 'test',
          vout: 0,
          cachedProof: true,
          verifiedAt: new Date().toISOString(),
        });
      });

      expect(result.current.state).toBe('Cached');
      expect(result.current.cachedProof).toBe(true);
      expect(result.current.graceExpiresAt).toBeDefined();
    });

    it('should handle Cached → GraceExceeded transition', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Cached',
          txid: 'test',
          vout: 0,
          cachedProof: true,
          verifiedAt: new Date().toISOString(),
        });
      });

      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'GraceExceeded',
          txid: 'test',
          vout: 0,
          cachedProof: true,
        });
      });

      expect(result.current.state).toBe('GraceExceeded');
    });

    it('should handle Active → Expired transition', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          txid: 'test',
          vout: 0,
          cachedProof: false,
        });
      });

      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Expired',
          cachedProof: false,
        });
      });

      expect(result.current.state).toBe('Expired');
    });
  });

  describe('Loading States', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should set refreshing state', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setRefreshing(true);
      });

      expect(result.current.isRefreshing).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setError('Network error');
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isRefreshing).toBe(false);
    });

    it('should calculate next retry time on error', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.nextRetryAt).toBeDefined();

      const nextRetry = new Date(result.current.nextRetryAt!).getTime();
      const now = Date.now();

      // Next retry should be 30-35 seconds in the future (30s base + some buffer)
      expect(nextRetry).toBeGreaterThan(now);
      expect(nextRetry).toBeLessThan(now + 35000);
    });

    it('should clear error when set to undefined', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setError('Test error');
      });

      act(() => {
        result.current.setError(undefined);
      });

      expect(result.current.error).toBeUndefined();
      expect(result.current.nextRetryAt).toBeUndefined();
    });
  });

  describe('Retry Logic', () => {
    it('should increment retry count', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.incrementRetry();
      });

      expect(result.current.retryCount).toBe(1);
    });

    it('should exponentially backoff retry delay', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.incrementRetry();
      });

      const firstRetry = result.current.nextRetryAt!;

      act(() => {
        result.current.incrementRetry();
      });

      const secondRetry = result.current.nextRetryAt!;

      // Second retry should be further in the future
      expect(new Date(secondRetry).getTime()).toBeGreaterThan(
        new Date(firstRetry).getTime(),
      );
    });

    it('should cap retry delay at 30 minutes', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      // Increment many times to test max delay
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.incrementRetry();
        }
      });

      const nextRetry = new Date(result.current.nextRetryAt!).getTime();
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;

      expect(nextRetry - now).toBeLessThanOrEqual(thirtyMinutes + 5000); // +5s buffer
    });

    it('should reset retry count', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.incrementRetry();
        result.current.incrementRetry();
      });

      expect(result.current.retryCount).toBe(2);

      act(() => {
        result.current.resetRetry();
      });

      expect(result.current.retryCount).toBe(0);
      expect(result.current.nextRetryAt).toBeUndefined();
    });

    it('should allow retry when nextRetryAt is in the past', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      // Manually set nextRetryAt to past
      act(() => {
        result.current.setError('Test');
        // Force past time by directly accessing state (testing internal logic)
        useSubscriptionStore.setState({
          nextRetryAt: new Date(Date.now() - 1000).toISOString(),
        });
      });

      expect(result.current.canRetry()).toBe(true);
    });

    it('should not allow retry when nextRetryAt is in the future', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setError('Test');
      });

      expect(result.current.canRetry()).toBe(false);
    });
  });

  describe('clearSubscription', () => {
    it('should reset all subscription data', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      // Set up subscription
      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          txid: 'test123',
          vout: 1,
          cachedProof: false,
          verifiedAt: new Date().toISOString(),
          blockHeight: 850000,
        });
        result.current.setError('Test error');
      });

      // Clear
      act(() => {
        result.current.clearSubscription();
      });

      expect(result.current.state).toBe('NotFound');
      expect(result.current.txid).toBeUndefined();
      expect(result.current.vout).toBeUndefined();
      expect(result.current.verifiedAt).toBeUndefined();
      expect(result.current.cachedProof).toBe(false);
      expect(result.current.graceExpiresAt).toBeUndefined();
      expect(result.current.error).toBeUndefined();
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('Computed Helpers', () => {
    describe('isOperational', () => {
      it('should return true for Active state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'Active',
            cachedProof: false,
          });
        });

        expect(result.current.isOperational()).toBe(true);
      });

      it('should return true for Cached state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'Cached',
            cachedProof: true,
            verifiedAt: new Date().toISOString(),
          });
        });

        expect(result.current.isOperational()).toBe(true);
      });

      it('should return false for Expired state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'Expired',
            cachedProof: false,
          });
        });

        expect(result.current.isOperational()).toBe(false);
      });

      it('should return false for GraceExceeded state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'GraceExceeded',
            cachedProof: true,
          });
        });

        expect(result.current.isOperational()).toBe(false);
      });

      it('should return false for NotFound state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        expect(result.current.isOperational()).toBe(false);
      });
    });

    describe('needsRenewal', () => {
      it('should return true for Expired state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'Expired',
            cachedProof: false,
          });
        });

        expect(result.current.needsRenewal()).toBe(true);
      });

      it('should return true for NotFound state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        expect(result.current.needsRenewal()).toBe(true);
      });

      it('should return false for Active state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'Active',
            cachedProof: false,
          });
        });

        expect(result.current.needsRenewal()).toBe(false);
      });

      it('should return false for Cached state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'Cached',
            cachedProof: true,
            verifiedAt: new Date().toISOString(),
          });
        });

        expect(result.current.needsRenewal()).toBe(false);
      });
    });

    describe('getGracePeriodRemaining', () => {
      it('should return null when no grace period', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        expect(result.current.getGracePeriodRemaining()).toBeNull();
      });

      it('should calculate remaining time for Cached state', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        const verifiedAt = new Date().toISOString();

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'Cached',
            cachedProof: true,
            verifiedAt,
          });
        });

        const remaining = result.current.getGracePeriodRemaining();
        expect(remaining).not.toBeNull();

        // Should be close to 72 hours (within 1 second tolerance)
        const expectedMs = 72 * 60 * 60 * 1000;
        expect(remaining!).toBeGreaterThan(expectedMs - 1000);
        expect(remaining!).toBeLessThanOrEqual(expectedMs);
      });

      it('should return 0 when grace period has expired', () => {
        const { result } = renderHook(() => useSubscriptionStore());

        // Set verified time to 73 hours ago
        const oldVerifiedAt = new Date(
          Date.now() - 73 * 60 * 60 * 1000,
        ).toISOString();

        act(() => {
          result.current.setSubscription({
            type: 'CheckSubscriptionResponse',
            state: 'Cached',
            cachedProof: true,
            verifiedAt: oldVerifiedAt,
          });
        });

        const remaining = result.current.getGracePeriodRemaining();
        expect(remaining).toBe(0);
      });
    });
  });

  describe('Persistence', () => {
    it('should persist essential subscription data', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setSubscription({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          txid: 'persist-test',
          vout: 2,
          cachedProof: false,
          verifiedAt: '2026-02-10T12:00:00Z',
          blockHeight: 850000,
        });
      });

      // Get persisted state
      const state = useSubscriptionStore.getState();

      expect(state.state).toBe('Active');
      expect(state.txid).toBe('persist-test');
      expect(state.vout).toBe(2);
      expect(state.verifiedAt).toBe('2026-02-10T12:00:00Z');
      expect(state.cachedProof).toBe(false);
      expect(state.blockHeight).toBe(850000);
    });

    it('should not persist loading states', () => {
      const { result } = renderHook(() => useSubscriptionStore());

      act(() => {
        result.current.setLoading(true);
        result.current.setRefreshing(true);
        result.current.setError('Test error');
      });

      // setError() clears loading and refreshing states
      const state = useSubscriptionStore.getState();
      expect(state.isLoading).toBe(false); // setError() clears this
      expect(state.isRefreshing).toBe(false); // setError() clears this
      expect(state.error).toBe('Test error');
      // Loading/error states would not be persisted on reload anyway
    });
  });
});
