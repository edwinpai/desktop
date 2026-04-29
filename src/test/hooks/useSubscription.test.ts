/**
 * useSubscription Hook Tests
 *
 * Tests for subscription hook IPC integration and lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSubscription, useSubscriptionStatus } from '@/hooks/useSubscription';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import type { CheckSubscriptionResponse } from '@/types';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset store
    const { clearSubscription } = useSubscriptionStore.getState();
    clearSubscription();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should auto-check on mount by default', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      };

      mockInvoke.mockResolvedValue(response);

      renderHook(() => useSubscription());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('check_subscription', {
          forceRefresh: false,
        });
      });
    });

    it('should not auto-check when autoCheck is false', () => {
      renderHook(() => useSubscription({ autoCheck: false }));

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should cleanup timers on unmount', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        cachedProof: true,
        verifiedAt: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(response);

      const { unmount } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Unmount should clear intervals
      unmount();

      // Advance timers - no new calls should be made
      const callCount = mockInvoke.mock.calls.length;
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(mockInvoke).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('check()', () => {
    it('should call IPC with forceRefresh=false by default', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      };

      mockInvoke.mockResolvedValue(response);

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.check();
      });

      expect(mockInvoke).toHaveBeenCalledWith('check_subscription', {
        forceRefresh: false,
      });
    });

    it('should call IPC with forceRefresh=true when specified', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      };

      mockInvoke.mockResolvedValue(response);

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.check(true);
      });

      expect(mockInvoke).toHaveBeenCalledWith('check_subscription', {
        forceRefresh: true,
      });
    });

    it('should update store with IPC response', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        txid: 'test-txid',
        vout: 0,
        cachedProof: false,
        verifiedAt: '2026-02-10T12:00:00Z',
        blockHeight: 850000,
      };

      mockInvoke.mockResolvedValue(response);

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.check();
      });

      await waitFor(() => {
        expect(result.current.state).toBe('Active');
        expect(result.current.txid).toBe('test-txid');
        expect(result.current.vout).toBe(0);
      });
    });

    it('should handle IPC errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.check();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });

    it('should not start new check if already loading', async () => {
      // Make first call slow
      mockInvoke.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      // Start first check
      act(() => {
        result.current.check();
      });

      // Try to start second check while first is loading
      await act(async () => {
        await result.current.check();
      });

      // Should only be called once
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh()', () => {
    it('should call check with forceRefresh=true', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      };

      mockInvoke.mockResolvedValue(response);

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockInvoke).toHaveBeenCalledWith('check_subscription', {
        forceRefresh: true,
      });
    });

    it('should set isRefreshing during refresh', async () => {
      let resolveInvoke: (value: CheckSubscriptionResponse) => void;
      const invokePromise = new Promise<CheckSubscriptionResponse>(
        (resolve) => {
          resolveInvoke = resolve;
        },
      );
      mockInvoke.mockReturnValue(invokePromise);

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      act(() => {
        result.current.refresh();
      });

      // Should be refreshing
      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(true);
      });

      // Complete the refresh
      await act(async () => {
        resolveInvoke!({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          cachedProof: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(false);
      });
    });
  });

  describe('clear()', () => {
    it('should clear subscription state', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        txid: 'test',
        vout: 0,
        cachedProof: false,
      };

      mockInvoke.mockResolvedValue(response);

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      // Set up subscription
      await act(async () => {
        await result.current.check();
      });

      await waitFor(() => {
        expect(result.current.state).toBe('Active');
      });

      // Clear
      act(() => {
        result.current.clear();
      });

      expect(result.current.state).toBe('NotFound');
      expect(result.current.txid).toBeUndefined();
    });

    it('should clear timers', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        cachedProof: true,
        verifiedAt: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(response);

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.check();
      });

      const callCount = mockInvoke.mock.calls.length;

      // Clear should stop polling
      act(() => {
        result.current.clear();
      });

      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(mockInvoke).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Polling (Cached state)', () => {
    it('should poll when state is Cached', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        cachedProof: true,
        verifiedAt: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(response);

      renderHook(() =>
        useSubscription({
          autoCheck: false,
          pollingInterval: 60000, // 1 minute for testing
        }),
      );

      // Initial check
      await act(async () => {
        await useSubscriptionStore.getState().setSubscription(response);
      });

      const callCount = mockInvoke.mock.calls.length;

      // Advance 1 minute - should poll
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(callCount + 1);
      });
    });

    it('should not poll when state is Active', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      };

      mockInvoke.mockResolvedValue(response);

      const { result } = renderHook(() =>
        useSubscription({
          autoCheck: false,
          pollingInterval: 60000,
        }),
      );

      await act(async () => {
        await result.current.check();
      });

      const callCount = mockInvoke.mock.calls.length;

      // Advance time - no polling for Active state
      vi.advanceTimersByTime(60000);
      expect(mockInvoke).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Auto-retry', () => {
    it('should retry on error when autoRetry is true', async () => {
      mockInvoke
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          type: 'CheckSubscriptionResponse',
          state: 'Active',
          cachedProof: false,
        });

      renderHook(() =>
        useSubscription({
          autoCheck: false,
          autoRetry: true,
          maxRetries: 5,
        }),
      );

      // First call fails
      await act(async () => {
        await useSubscriptionStore.getState().setError('Network error');
        useSubscriptionStore.getState().incrementRetry();
      });

      expect(mockInvoke).toHaveBeenCalledTimes(0);

      // Advance to retry time (30s base delay)
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Should have retried
      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledTimes(1);
        },
        { timeout: 2000 },
      );
    });

    it('should not retry when autoRetry is false', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useSubscription({
          autoCheck: false,
          autoRetry: false,
        }),
      );

      await act(async () => {
        await result.current.check();
      });

      const callCount = mockInvoke.mock.calls.length;

      // Advance time - no retry
      vi.advanceTimersByTime(60000);
      expect(mockInvoke).toHaveBeenCalledTimes(callCount);
    });

    it('should stop retrying after maxRetries', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useSubscription({
          autoCheck: false,
          autoRetry: true,
          maxRetries: 2,
        }),
      );

      // First attempt
      await act(async () => {
        await result.current.check();
      });

      // Retry 1
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Retry 2 (max reached)
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      const callCount = mockInvoke.mock.calls.length;

      // No more retries
      vi.advanceTimersByTime(120000);
      expect(mockInvoke).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Grace Period Monitoring', () => {
    it('should transition to GraceExceeded when grace period expires', async () => {
      // Set verified time to 72 hours ago
      const oldVerifiedAt = new Date(
        Date.now() - 72 * 60 * 60 * 1000,
      ).toISOString();

      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        txid: 'test',
        vout: 0,
        cachedProof: true,
        verifiedAt: oldVerifiedAt,
      };

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        result.current.check();
      });

      // Set the Cached state
      await act(async () => {
        useSubscriptionStore.getState().setSubscription(response);
      });

      // Advance grace check timer (10s)
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(result.current.state).toBe('GraceExceeded');
      });
    });
  });

  describe('Computed Values', () => {
    it('should return isOperational=true for Active', async () => {
      mockInvoke.mockResolvedValue({
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      });

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.check();
      });

      await waitFor(() => {
        expect(result.current.isOperational).toBe(true);
      });
    });

    it('should return needsRenewal=true for Expired', async () => {
      mockInvoke.mockResolvedValue({
        type: 'CheckSubscriptionResponse',
        state: 'Expired',
        cachedProof: false,
      });

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.check();
      });

      await waitFor(() => {
        expect(result.current.needsRenewal).toBe(true);
      });
    });

    it('should calculate gracePeriodRemaining for Cached', async () => {
      const response: CheckSubscriptionResponse = {
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        cachedProof: true,
        verifiedAt: new Date().toISOString(),
      };

      mockInvoke.mockResolvedValue(response);

      const { result } = renderHook(() => useSubscription({ autoCheck: false }));

      await act(async () => {
        await result.current.check();
      });

      await waitFor(() => {
        expect(result.current.gracePeriodRemaining).not.toBeNull();
        // Should be close to 72 hours
        expect(result.current.gracePeriodRemaining!).toBeGreaterThan(
          71 * 60 * 60 * 1000,
        );
      });
    });
  });
});

describe('useSubscriptionStatus', () => {
  beforeEach(() => {
    const { clearSubscription } = useSubscriptionStore.getState();
    clearSubscription();
  });

  it('should return correct badge for Active state', () => {
    const { result } = renderHook(() => useSubscriptionStatus());

    act(() => {
      useSubscriptionStore.getState().setSubscription({
        type: 'CheckSubscriptionResponse',
        state: 'Active',
        cachedProof: false,
      });
    });

    expect(result.current.badge.label).toBe('Active');
    expect(result.current.badge.variant).toBe('success');
  });

  it('should return correct badge for Cached state with time remaining', () => {
    const { result } = renderHook(() => useSubscriptionStatus());

    act(() => {
      useSubscriptionStore.getState().setSubscription({
        type: 'CheckSubscriptionResponse',
        state: 'Cached',
        cachedProof: true,
        verifiedAt: new Date().toISOString(),
      });
    });

    expect(result.current.badge.label).toBe('Cached');
    expect(result.current.badge.variant).toBe('warning');
    expect(result.current.badge.description).toContain('72h grace remaining');
  });

  it('should return correct badge for Expired state', () => {
    const { result } = renderHook(() => useSubscriptionStatus());

    act(() => {
      useSubscriptionStore.getState().setSubscription({
        type: 'CheckSubscriptionResponse',
        state: 'Expired',
        cachedProof: false,
      });
    });

    expect(result.current.badge.label).toBe('Expired');
    expect(result.current.badge.variant).toBe('destructive');
  });

  it('should return correct badge for GraceExceeded state', () => {
    const { result } = renderHook(() => useSubscriptionStatus());

    act(() => {
      useSubscriptionStore.getState().setSubscription({
        type: 'CheckSubscriptionResponse',
        state: 'GraceExceeded',
        cachedProof: true,
      });
    });

    expect(result.current.badge.label).toBe('Limited');
    expect(result.current.badge.variant).toBe('secondary');
  });

  it('should return correct badge for NotFound state', () => {
    const { result } = renderHook(() => useSubscriptionStatus());

    expect(result.current.badge.label).toBe('No Subscription');
    expect(result.current.badge.variant).toBe('outline');
  });
});
