/**
 * useSubscription Hook Test Suite
 *
 * Comprehensive tests for:
 * - Hook state management
 * - IPC command invocation
 * - Event listener subscriptions
 * - Polling mechanism
 * - Payment flow
 * - Error handling
 * - State transitions
 *
 * All types imported from types_contracts (type contract compliance)
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useSubscription, UseSubscriptionConfig } from '../hooks/useSubscription';
import {
  SubscriptionState,
  SubscriptionStatus,
  PaymentRequest,
} from '../types_contracts/subscription';
import {
  IPC_COMMANDS,
  IPC_EVENTS,
  RefreshSubscriptionResult,
  InitiatePaymentResult,
  SubmitPaymentResult,
} from '../types_contracts/ipc';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@tauri-apps/api/tauri');
jest.mock('@tauri-apps/api/event');

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;
const mockListen = listen as jest.MockedFunction<typeof listen>;

// ============================================================================
// Test Utilities
// ============================================================================

const createMockStatus = (state: SubscriptionState): SubscriptionStatus => ({
  state,
  isActive: state === SubscriptionState.Active,
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  daysUntilExpiry: 30,
  source: 'overlay',
  lastUpdated: Date.now(),
  message: undefined,
  error: undefined,
});

const defaultConfig: UseSubscriptionConfig = {
  userAddress: 'test_address',
  refreshInterval: 0, // Disable auto-refresh for tests
  enableEvents: false, // Disable events for most tests
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ============================================================================
// Hook State Tests
// ============================================================================

describe('useSubscription - State Management', () => {
  test('initializes with loading state', () => {
    mockInvoke.mockResolvedValue({
      status: createMockStatus(SubscriptionState.Unsubscribed),
    } as RefreshSubscriptionResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('loads initial subscription status', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.status).toEqual(mockStatus);
      expect(result.current.isActive).toBe(true);
    });

    expect(mockInvoke).toHaveBeenCalledWith(IPC_COMMANDS.REFRESH_SUBSCRIPTION, {
      userAddress: 'test_address',
      forceRefresh: false,
    });
  });

  test('handles loading error', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toContain('Network error');
    });
  });

  test('computes isActive correctly', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });
  });

  test('computes isPending correctly', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Pending);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
      expect(result.current.isActive).toBe(false);
    });
  });

  test('computes isExpiringSoon correctly', async () => {
    const mockStatus = {
      ...createMockStatus(SubscriptionState.Active),
      daysUntilExpiry: 5,
    };
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isExpiringSoon).toBe(true);
    });
  });
});

// ============================================================================
// Refresh Function Tests
// ============================================================================

describe('useSubscription - Refresh', () => {
  test('refresh updates status', async () => {
    const initialStatus = createMockStatus(SubscriptionState.Unsubscribed);
    const updatedStatus = createMockStatus(SubscriptionState.Active);

    mockInvoke
      .mockResolvedValueOnce({ status: initialStatus } as RefreshSubscriptionResult)
      .mockResolvedValueOnce({ status: updatedStatus } as RefreshSubscriptionResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.status?.state).toBe(SubscriptionState.Unsubscribed);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status?.state).toBe(SubscriptionState.Active);
  });

  test('refresh with forceRefresh flag', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh(true);
    });

    expect(mockInvoke).toHaveBeenLastCalledWith(IPC_COMMANDS.REFRESH_SUBSCRIPTION, {
      userAddress: 'test_address',
      forceRefresh: true,
    });
  });

  test('refresh handles errors', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        status: createMockStatus(SubscriptionState.Active),
      } as RefreshSubscriptionResult)
      .mockRejectedValueOnce(new Error('Refresh failed'));

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toContain('Refresh failed');
  });
});

// ============================================================================
// Polling Tests
// ============================================================================

describe('useSubscription - Polling', () => {
  test('polls at specified interval', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    renderHook(() =>
      useSubscription({
        ...defaultConfig,
        refreshInterval: 60000, // 60 seconds
      })
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1); // Initial call
    });

    // Advance time by 60 seconds
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    // Advance time again
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });

  test('disables polling when refreshInterval is 0', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    renderHook(() =>
      useSubscription({
        ...defaultConfig,
        refreshInterval: 0,
      })
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1); // Only initial call
    });

    act(() => {
      jest.advanceTimersByTime(120000); // 2 minutes
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1); // Still only 1 call
  });

  test('cleans up polling on unmount', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const { unmount } = renderHook(() =>
      useSubscription({
        ...defaultConfig,
        refreshInterval: 60000,
      })
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Should not call again after unmount
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Payment Flow Tests
// ============================================================================

describe('useSubscription - Payment', () => {
  test('submitPayment initiates and submits payment', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Unsubscribed);
    const mockInitResult: InitiatePaymentResult = {
      rawTx: '0100000001...',
      estimatedFee: 1000,
    };
    const mockSubmitResult: SubmitPaymentResult = {
      result: {
        success: true,
        txid: 'payment_txid_123',
      },
    };

    mockInvoke
      .mockResolvedValueOnce({ status: mockStatus } as RefreshSubscriptionResult)
      .mockResolvedValueOnce(mockInitResult)
      .mockResolvedValueOnce(mockSubmitResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const paymentRequest: PaymentRequest = {
      planId: 'basic',
      userAddress: 'test_address',
      amountSatoshis: 100000,
      recipientAddress: 'recipient_address',
    };

    let paymentResult;
    await act(async () => {
      paymentResult = await result.current.submitPayment(paymentRequest);
    });

    expect(paymentResult).toEqual({
      success: true,
      txid: 'payment_txid_123',
    });

    expect(mockInvoke).toHaveBeenCalledWith(IPC_COMMANDS.INITIATE_PAYMENT, {
      paymentRequest,
    });
    expect(mockInvoke).toHaveBeenCalledWith(IPC_COMMANDS.SUBMIT_PAYMENT, {
      rawTx: '0100000001...',
      userAddress: 'test_address',
    });
  });

  test('submitPayment sets paymentInProgress', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Unsubscribed);
    mockInvoke
      .mockResolvedValueOnce({ status: mockStatus } as RefreshSubscriptionResult)
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  rawTx: '0100000001...',
                } as InitiatePaymentResult),
              100
            );
          })
      );

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const paymentRequest: PaymentRequest = {
      planId: 'basic',
      userAddress: 'test_address',
      amountSatoshis: 100000,
      recipientAddress: 'recipient_address',
    };

    act(() => {
      result.current.submitPayment(paymentRequest);
    });

    // Should set paymentInProgress immediately
    expect(result.current.paymentInProgress).toBe(true);
  });

  test('submitPayment handles errors', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Unsubscribed);
    mockInvoke
      .mockResolvedValueOnce({ status: mockStatus } as RefreshSubscriptionResult)
      .mockRejectedValueOnce(new Error('Payment failed'));

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const paymentRequest: PaymentRequest = {
      planId: 'basic',
      userAddress: 'test_address',
      amountSatoshis: 100000,
      recipientAddress: 'recipient_address',
    };

    let paymentResult;
    await act(async () => {
      paymentResult = await result.current.submitPayment(paymentRequest);
    });

    expect(paymentResult).toEqual({
      success: false,
      error: 'Payment failed',
    });
    expect(result.current.paymentInProgress).toBe(false);
  });
});

// ============================================================================
// Event Listener Tests
// ============================================================================

describe('useSubscription - Events', () => {
  test('subscribes to events when enabled', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);
    mockListen.mockResolvedValue(jest.fn());

    renderHook(() =>
      useSubscription({
        ...defaultConfig,
        enableEvents: true,
      })
    );

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith(
        IPC_EVENTS.SUBSCRIPTION_STATE_CHANGED,
        expect.any(Function)
      );
      expect(mockListen).toHaveBeenCalledWith(
        IPC_EVENTS.SUBSCRIPTION_STATUS_UPDATED,
        expect.any(Function)
      );
      expect(mockListen).toHaveBeenCalledWith(
        IPC_EVENTS.PAYMENT_SUBMITTED,
        expect.any(Function)
      );
      expect(mockListen).toHaveBeenCalledWith(
        IPC_EVENTS.PAYMENT_CONFIRMED,
        expect.any(Function)
      );
    });
  });

  test('calls onStateChange callback', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const onStateChange = jest.fn();
    let stateChangeHandler: any;

    mockListen.mockImplementation((event, handler) => {
      if (event === IPC_EVENTS.SUBSCRIPTION_STATE_CHANGED) {
        stateChangeHandler = handler;
      }
      return Promise.resolve(jest.fn());
    });

    renderHook(() =>
      useSubscription({
        ...defaultConfig,
        enableEvents: true,
        onStateChange,
      })
    );

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalled();
    });

    // Simulate state change event
    act(() => {
      stateChangeHandler({
        payload: {
          userAddress: 'test_address',
          oldState: SubscriptionState.Pending,
          newState: SubscriptionState.Active,
        },
      });
    });

    expect(onStateChange).toHaveBeenCalledWith(
      SubscriptionState.Pending,
      SubscriptionState.Active
    );
  });

  test('calls onPaymentConfirmed callback', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const onPaymentConfirmed = jest.fn();
    let paymentConfirmedHandler: any;

    mockListen.mockImplementation((event, handler) => {
      if (event === IPC_EVENTS.PAYMENT_CONFIRMED) {
        paymentConfirmedHandler = handler;
      }
      return Promise.resolve(jest.fn());
    });

    renderHook(() =>
      useSubscription({
        ...defaultConfig,
        enableEvents: true,
        onPaymentConfirmed,
      })
    );

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalled();
    });

    // Simulate payment confirmed event
    act(() => {
      paymentConfirmedHandler({
        payload: {
          txid: 'confirmed_txid',
          userAddress: 'test_address',
        },
      });
    });

    expect(onPaymentConfirmed).toHaveBeenCalledWith('confirmed_txid');
  });

  test('cleans up event listeners on unmount', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const mockUnlisten = jest.fn();
    mockListen.mockResolvedValue(mockUnlisten);

    const { unmount } = renderHook(() =>
      useSubscription({
        ...defaultConfig,
        enableEvents: true,
      })
    );

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnlisten).toHaveBeenCalled();
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('useSubscription - Utilities', () => {
  test('getStatusMessage returns correct messages', async () => {
    const testCases = [
      {
        state: SubscriptionState.Unsubscribed,
        expected: 'No active subscription',
      },
      {
        state: SubscriptionState.Pending,
        expected: 'Payment submitted',
      },
      {
        state: SubscriptionState.Active,
        expected: 'Subscription active',
      },
      {
        state: SubscriptionState.Expired,
        expected: 'Subscription expired',
      },
    ];

    for (const testCase of testCases) {
      const mockStatus = createMockStatus(testCase.state);
      mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

      const { result } = renderHook(() => useSubscription(defaultConfig));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const message = result.current.getStatusMessage();
      expect(message).toContain(testCase.expected);
    }
  });

  test('getPlan returns correct plan', async () => {
    const mockStatus = createMockStatus(SubscriptionState.Active);
    mockInvoke.mockResolvedValue({ status: mockStatus } as RefreshSubscriptionResult);

    const { result } = renderHook(() => useSubscription(defaultConfig));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const basicPlan = result.current.getPlan('basic');
    expect(basicPlan).toBeDefined();
    expect(basicPlan?.id).toBe('basic');

    const unknownPlan = result.current.getPlan('unknown');
    expect(unknownPlan).toBeUndefined();
  });
});
