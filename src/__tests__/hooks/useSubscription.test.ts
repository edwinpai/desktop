/**
 * useSubscription Hook Tests
 *
 * Tests subscription state management, polling, retry logic
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubscription } from '@/hooks/useSubscription';
import type { CheckSubscriptionResponse, SubscriptionState } from '@/types';

// createMockIPC replaced with vi.hoisted inline mock

type IPCResponse = unknown | (() => unknown);

// Mock Tauri IPC - use vi.hoisted to avoid hoisting issues
const { mockInvoke } = vi.hoisted(() => {
  const mockInvoke = vi.fn<(cmd: string) => Promise<unknown>>(async () => null);
  return { mockInvoke };
});
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Helper to set up invoke responses
const mockIPC = {
  mock: (command: string, response: IPCResponse) => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === command) return typeof response === 'function' ? response() : response;
      return null;
    });
  },
  clear: () => mockInvoke.mockReset(),
  getInvokeMock: () => mockInvoke,
};

// Mock subscription store
interface MockSubscriptionStore {
  state: SubscriptionState;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | undefined;
  txid: string | undefined;
  vout: number | undefined;
  verifiedAt: string | undefined;
  cachedProof: boolean;
  graceExpiresAt: string | undefined;
  blockHeight: number | undefined;
  retryCount: number;
  setLoading: ReturnType<typeof vi.fn>;
  setRefreshing: ReturnType<typeof vi.fn>;
  setError: ReturnType<typeof vi.fn>;
  setSubscription: ReturnType<typeof vi.fn>;
  incrementRetry: ReturnType<typeof vi.fn>;
  clearSubscription: ReturnType<typeof vi.fn>;
  isOperational: ReturnType<typeof vi.fn>;
  needsRenewal: ReturnType<typeof vi.fn>;
  getGracePeriodRemaining: ReturnType<typeof vi.fn>;
  canRetry: ReturnType<typeof vi.fn>;
}

const mockStore: MockSubscriptionStore = {
  state: 'NotFound',
  isLoading: false,
  isRefreshing: false,
  error: undefined,
  txid: undefined,
  vout: undefined,
  verifiedAt: undefined,
  cachedProof: false,
  graceExpiresAt: undefined,
  blockHeight: undefined,
  retryCount: 0,
  setLoading: vi.fn(),
  setRefreshing: vi.fn(),
  setError: vi.fn(),
  setSubscription: vi.fn(),
  incrementRetry: vi.fn(),
  clearSubscription: vi.fn(),
  isOperational: vi.fn(() => false),
  needsRenewal: vi.fn(() => true),
  getGracePeriodRemaining: vi.fn(() => null),
  canRetry: vi.fn(() => true),
};

vi.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: () => mockStore,
}));

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset mockStore state
    mockStore.state = 'NotFound';
    mockStore.isLoading = false;
    mockStore.isRefreshing = false;
    mockStore.error = undefined;
    mockStore.graceExpiresAt = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with NotFound state', () => {
    const { result } = renderHook(() => useSubscription({ autoCheck: false }));

    expect(result.current.state).toBe('NotFound');
    expect(result.current.isLoading).toBe(false);
  });

  it('should auto-check on mount when enabled', async () => {
    const response: CheckSubscriptionResponse = {
      type: 'CheckSubscriptionResponse',
      state: 'Active',
      txid: 'abc123',
      vout: 0,
      cachedProof: false,
    };

    mockIPC.mock('check_subscription', response);

    await act(async () => {
      renderHook(() => useSubscription({ autoCheck: true }));
      // Flush the async check call
      await vi.advanceTimersByTimeAsync(0);
    });

    // Verify the subscription was set
    expect(mockStore.setSubscription).toHaveBeenCalledWith(response);
  });

  it('should skip auto-check when disabled', () => {
    renderHook(() => useSubscription({ autoCheck: false }));

    expect(mockStore.setLoading).not.toHaveBeenCalled();
  });

  it('should check subscription status', async () => {
    const response: CheckSubscriptionResponse = {
      type: 'CheckSubscriptionResponse',
      state: 'Active',
      txid: 'abc123',
      vout: 0,
      cachedProof: false,
    };

    mockIPC.mock('check_subscription', response);

    const { result } = renderHook(() => useSubscription({ autoCheck: false }));

    await act(async () => {
      await result.current.check();
    });

    expect(mockStore.setSubscription).toHaveBeenCalledWith(response);
  });

  it('should force refresh from overlay', async () => {
    const response: CheckSubscriptionResponse = {
      type: 'CheckSubscriptionResponse',
      state: 'Active',
      txid: 'abc123',
      vout: 0,
      cachedProof: false,
    };

    mockIPC.mock('check_subscription', response);

    const { result } = renderHook(() => useSubscription({ autoCheck: false }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockStore.setRefreshing).toHaveBeenCalledWith(true);
    expect(mockStore.setRefreshing).toHaveBeenCalledWith(false);
  });

  it('should clear subscription state', () => {
    const { result } = renderHook(() => useSubscription({ autoCheck: false }));

    act(() => {
      result.current.clear();
    });

    expect(mockStore.clearSubscription).toHaveBeenCalled();
  });

  it('should handle errors and retry', async () => {
    mockIPC.mock('check_subscription', () => {
      throw new Error('Network error');
    });

    mockStore.canRetry.mockReturnValue(true);

    const { result } = renderHook(() =>
      useSubscription({ autoCheck: false, autoRetry: true, maxRetries: 3 })
    );

    await act(async () => {
      await result.current.check();
    });

    expect(mockStore.setError).toHaveBeenCalledWith('Network error');
    expect(mockStore.incrementRetry).toHaveBeenCalled();
  });

  it('should setup polling for Cached state', async () => {
    const cachedResponse: CheckSubscriptionResponse = {
      type: 'CheckSubscriptionResponse',
      state: 'Cached',
      txid: 'abc123',
      vout: 0,
      cachedProof: true,
      verifiedAt: new Date().toISOString(),
    };

    mockIPC.mock('check_subscription', cachedResponse);

    const { result } = renderHook(() => useSubscription({ autoCheck: false, pollingInterval: 1000 }));

    // Manually trigger check to setup polling
    await act(async () => {
      await result.current.check(false);
    });

    // Verify initial call
    expect(mockStore.setSubscription).toHaveBeenCalledTimes(1);

    // Reset mock to verify poll happens
    mockStore.setSubscription.mockClear();

    // Advance timers to trigger poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Should have polled again
    expect(mockStore.setSubscription).toHaveBeenCalledTimes(1);
  });

  it('should not start new check if already loading', async () => {
    const response: CheckSubscriptionResponse = {
      type: 'CheckSubscriptionResponse',
      state: 'Active',
      txid: 'abc123',
      vout: 0,
      cachedProof: false,
    };

    mockIPC.mock('check_subscription', response);
    mockStore.isLoading = true;

    const { result } = renderHook(() => useSubscription({ autoCheck: false }));

    await act(async () => {
      await result.current.check();
    });

    // invoke should not be called because isLoading was already true
    expect(mockIPC.getInvokeMock()).not.toHaveBeenCalled();
  });

  it('should transition from Cached to GraceExceeded after 72 hours', async () => {
    mockStore.state = 'Cached';
    mockStore.graceExpiresAt = new Date().toISOString(); // Set a grace expiry
    mockStore.getGracePeriodRemaining.mockReturnValue(0); // Grace period has expired
    mockStore.txid = 'test-txid';
    mockStore.vout = 0;
    mockStore.verifiedAt = new Date().toISOString();
    mockStore.blockHeight = 12345;

    renderHook(() => useSubscription({ autoCheck: false }));

    // Grace period check should run immediately when the effect mounts
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // Flush microtasks
    });

    // Verify that setSubscription was called with GraceExceeded state
    expect(mockStore.setSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'GraceExceeded' })
    );
  });
});
