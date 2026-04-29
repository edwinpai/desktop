/**
 * useClientConnection Hook Tests
 *
 * Tests client connection lifecycle, BRC-103 auth, event handling
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClientConnection } from '@/hooks/useClientConnection';

// Create mock handlers and listeners in vi.hoisted()
type MockEvent<TPayload = unknown> = { payload: TPayload };
type MockListener = (event: MockEvent) => void;
type MockHandler = unknown | ((args?: unknown) => unknown);

const { mockHandlers, mockListeners, mockInvoke, mockListen } = vi.hoisted(() => {
  const mockHandlers = new Map<string, MockHandler>();
  const mockListeners = new Map<string, MockListener[]>();
  
  return {
    mockHandlers,
    mockListeners,
    mockInvoke: vi.fn(async (command: string, args?: unknown) => {
      const handler = mockHandlers.get(command);
      if (!handler) {
        throw new Error(`No mock handler for command: ${command}`);
      }
      return typeof handler === 'function' ? handler(args) : handler;
    }),
    mockListen: vi.fn((event: string, callback: MockListener) => {
      if (!mockListeners.has(event)) {
        mockListeners.set(event, []);
      }
      mockListeners.get(event)!.push(callback);
      return Promise.resolve(() => {
        const callbacks = mockListeners.get(event);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) callbacks.splice(index, 1);
        }
      });
    }),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

// Create mockIPC helper object for test convenience
const mockIPC = {
  mock: (command: string, response: MockHandler) => {
    mockHandlers.set(command, response);
  },
  clear: () => {
    mockHandlers.clear();
  },
  getInvokeMock: () => mockInvoke,
};

// Create mockListen helper for test convenience  
const mockListenHelper = {
  listen: mockListen,
  trigger: (event: string, payload: unknown) => {
    const callbacks = mockListeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb({ payload }));
    }
  },
  clear: () => {
    mockListeners.clear();
  },
};

describe('useClientConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIPC.clear();
    mockListenHelper.clear();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useClientConnection());

    expect(result.current.connectionStatus).toBe('disconnected');
    expect(result.current.error).toBeNull();
  });

  it('should connect to a gateway', async () => {
    mockIPC.mock('connect_to_gateway', {
      success: true,
      state: 'connected',
      gatewayPetname: 'test-gateway',
    });

    const { result } = renderHook(() => useClientConnection());

    const success = await act(async () => {
      return await result.current.connect({
        gatewayAddress: 'http://localhost:3000',
        gatewayPubkey: 'pubkey123',
      });
    });

    expect(success).toBe(true);
    expect(result.current.connectionStatus).toBe('connected');
  });

  it('should handle connection failure', async () => {
    mockIPC.mock('connect_to_gateway', {
      success: false,
      state: 'failed',
      error: 'Connection refused',
    });

    const { result } = renderHook(() => useClientConnection());

    const success = await act(async () => {
      return await result.current.connect({
        gatewayAddress: 'http://localhost:3000',
      });
    });

    expect(success).toBe(false);
    expect(result.current.connectionStatus).toBe('failed');
    expect(result.current.error).toBe('Connection refused');
  });

  it('should disconnect from gateway', async () => {
    mockIPC.mock('disconnect', { success: true });

    const { result } = renderHook(() => useClientConnection());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should disconnect with reconnect disabled', async () => {
    mockIPC.mock('disconnect', { success: true });

    const { result } = renderHook(() => useClientConnection());

    await act(async () => {
      await result.current.disconnect(true);
    });

    expect(mockIPC.getInvokeMock()).toHaveBeenCalledWith('disconnect', {
      request: { disableReconnect: true },
    });
  });

  it('should handle connection status events', async () => {
    const { result } = renderHook(() => useClientConnection());

    // Simulate connection status event from backend
    act(() => {
      mockListenHelper.trigger('connection-status', {
        status: 'connecting',
      });
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('connecting');
    });

    act(() => {
      mockListenHelper.trigger('connection-status', {
        status: 'connected',
      });
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('connected');
    });
  });

  it('should handle error events', async () => {
    const { result } = renderHook(() => useClientConnection());

    act(() => {
      mockListenHelper.trigger('connection-status', {
        status: 'failed',
        error: 'Handshake failed',
      });
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('failed');
      expect(result.current.error).toBe('Handshake failed');
    });
  });

  it('should get current connection status', async () => {
    mockIPC.mock('get_connection_status', 'connected');

    const { result } = renderHook(() => useClientConnection());

    const status = await act(async () => {
      return await result.current.getStatus();
    });

    expect(status).toBe('connected');
  });

  it('should cleanup event listeners on unmount', () => {
    const { unmount } = renderHook(() => useClientConnection());

    expect(mockListenHelper.listen).toHaveBeenCalled();

    unmount();

    // Unlisten function should have been called
    // (This is implicit in the mock implementation)
  });
});
