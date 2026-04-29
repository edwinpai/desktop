/**
 * Gateway Store Tests
 *
 * Tests gateway process lifecycle, health checks, event handling
 */

import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGatewayStore } from '@/stores/gateway';

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
  clearCommand: (command: string) => {
    mockHandlers.delete(command);
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

describe('gateway store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIPC.clear();
    mockListenHelper.clear();

    // Reset store
    const store = useGatewayStore.getState();
    store.stopPolling();
    store.cleanup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with stopped state', () => {
    const state = useGatewayStore.getState();

    expect(state.status).toBe('stopped');
    expect(state.pid).toBeNull();
    expect(state.port).toBe(18789);
    expect(state.error).toBeNull();
    expect(state.isPolling).toBe(false);
  });

  it('should start gateway successfully', async () => {
    mockIPC.mock('start_gateway_real', 12345);

    mockIPC.mock('probe_gateway', { found: true });

    await act(async () => {
      await useGatewayStore.getState().startGateway(18789);
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe('running');
    expect(state.pid).toBe(12345);
    expect(state.port).toBe(18789);
    expect(state.isPolling).toBe(true);
  });

  it('should handle start gateway errors', async () => {
    mockIPC.mock('start_gateway_real', () => {
      throw new Error('Port in use');
    });

    await expect(async () => {
      await act(async () => {
        await useGatewayStore.getState().startGateway(18789);
      });
    }).rejects.toThrow();

    const state = useGatewayStore.getState();
    expect(state.status).toBe('stopped');
    expect(state.error).toBeTruthy();
  });

  it('should stop gateway successfully', async () => {
    mockIPC.mock('stop_gateway_real', undefined);

    await act(async () => {
      await useGatewayStore.getState().stopGateway();
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe('stopped');
    expect(state.pid).toBeNull();
    expect(state.isPolling).toBe(false);
  });

  it('should force stop gateway', async () => {
    mockIPC.mock('stop_gateway_real', undefined);

    await act(async () => {
      await useGatewayStore.getState().stopGateway(true);
    });

    expect(mockIPC.getInvokeMock()).toHaveBeenCalledWith('stop_gateway_real');
  });

  it('should refresh gateway status', async () => {
    mockIPC.mock('get_gateway_status_real', {
      status: 'running',
      pid: 12345,
      port: 18789,
      startedAt: new Date().toISOString(),
      lastHealthCheck: new Date().toISOString(),
      restartCount: 0,
      uptime: 1000,
    });

    await act(async () => {
      await useGatewayStore.getState().refreshStatus();
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe('running');
    expect(state.pid).toBe(12345);
    expect(state.uptime).toBe(1000);
  });

  it('should perform health check', async () => {
    mockIPC.mock('probe_gateway', { found: true });

    await act(async () => {
      await useGatewayStore.getState().performHealthCheck();
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe('running');
    expect(state.error).toBeNull();
    expect(state.lastHealthCheck).toBeTruthy();
  });

  it('should handle unhealthy status', async () => {
    mockIPC.mock('probe_gateway', { found: false });

    await act(async () => {
      await useGatewayStore.getState().performHealthCheck();
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe('unhealthy');
    expect(state.error).toBe('Health check failed');
  });

  it('should start and stop polling', async () => {
    mockIPC.mock('probe_gateway', { found: true });

    await act(async () => {
      useGatewayStore.getState().startPolling(5000);
    });

    expect(useGatewayStore.getState().isPolling).toBe(true);

    // Initial health check
    expect(mockIPC.getInvokeMock()).toHaveBeenCalledWith('probe_gateway');

    mockIPC.clearCommand('probe_gateway');
    mockIPC.mock('probe_gateway', { found: true });

    // Advance timer by 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Should have polled again
    expect(mockIPC.getInvokeMock()).toHaveBeenCalledWith('probe_gateway');

    act(() => {
      useGatewayStore.getState().stopPolling();
    });

    expect(useGatewayStore.getState().isPolling).toBe(false);
  });

  it('should setup event listeners', async () => {
    await act(async () => {
      await useGatewayStore.getState().setupEventListeners();
    });

    expect(mockListenHelper.listen).toHaveBeenCalledWith('gateway:started', expect.any(Function));
    expect(mockListenHelper.listen).toHaveBeenCalledWith('gateway:stopped', expect.any(Function));
    expect(mockListenHelper.listen).toHaveBeenCalledWith('gateway:crashed', expect.any(Function));
    expect(mockListenHelper.listen).toHaveBeenCalledWith('gateway:healthy', expect.any(Function));
    expect(mockListenHelper.listen).toHaveBeenCalledWith('gateway:unhealthy', expect.any(Function));
  });

  it('should handle gateway started event', async () => {
    await act(async () => {
      await useGatewayStore.getState().setupEventListeners();
    });

    mockIPC.mock('probe_gateway', { found: true });

    act(() => {
      mockListenHelper.trigger('gateway:started', {
        status: 'running',
        pid: 12345,
      });
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe('running');
    expect(state.pid).toBe(12345);
    expect(state.isPolling).toBe(true);
  });

  it('should handle gateway stopped event', async () => {
    await act(async () => {
      await useGatewayStore.getState().setupEventListeners();
    });

    act(() => {
      mockListenHelper.trigger('gateway:stopped', {
        status: 'stopped',
      });
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe('stopped');
    expect(state.pid).toBeNull();
    expect(state.isPolling).toBe(false);
  });

  it('should handle gateway crashed event', async () => {
    await act(async () => {
      await useGatewayStore.getState().setupEventListeners();
    });

    act(() => {
      mockListenHelper.trigger('gateway:crashed', {
        status: 'crashed',
        message: 'Unexpected exit',
      });
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe('crashed');
    expect(state.error).toBe('Unexpected exit');
    expect(state.isPolling).toBe(false);
  });

  it('should cleanup event listeners', async () => {
    await act(async () => {
      await useGatewayStore.getState().setupEventListeners();
    });

    const unlistenerCount = useGatewayStore.getState().unlisteners.length;
    expect(unlistenerCount).toBe(5);

    act(() => {
      useGatewayStore.getState().cleanup();
    });

    expect(useGatewayStore.getState().unlisteners).toEqual([]);
  });
});
