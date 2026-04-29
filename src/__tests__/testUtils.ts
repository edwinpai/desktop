/**
 * Test Utilities - Mock IPC and common test helpers
 */

import { vi } from 'vitest';

type MockIpcResult = unknown;
type MockIpcHandler = MockIpcResult | ((args?: unknown) => MockIpcResult | Promise<MockIpcResult>);
type MockEvent<T = unknown> = { payload: T };
type MockListener<T = unknown> = (event: MockEvent<T>) => void;

/**
 * Create a mock IPC handler for Tauri commands
 *
 * @example
 * ```ts
 * const mockIPC = createMockIPC();
 * mockIPC.mock('check_subscription', { state: 'Active', cachedProof: false });
 * ```
 */
export function createMockIPC() {
  const handlers = new Map<string, MockIpcHandler>();

  return {
    /**
     * Register a mock response for a specific command
     */
    mock: (command: string, response: MockIpcHandler) => {
      handlers.set(command, response);
    },

    /**
     * Clear all mock handlers
     */
    clear: () => {
      handlers.clear();
    },

    /**
     * Clear a specific command handler
     */
    clearCommand: (command: string) => {
      handlers.delete(command);
    },

    /**
     * Get the invoke mock that can be used with vi.mocked()
     */
    getInvokeMock: () => {
      return vi.fn(async (command: string, args?: unknown) => {
        const handler = handlers.get(command);

        if (!handler) {
          throw new Error(`No mock handler for command: ${command}`);
        }

        if (typeof handler === 'function') {
          return handler(args);
        }

        return handler;
      });
    },

    /**
     * Get the listen mock for Tauri events
     */
    getListenMock: () => {
      const listeners = new Map<string, MockListener[]>();

      return {
        listen: vi.fn((event: string, callback: MockListener) => {
          const callbacks = listeners.get(event) ?? [];
          callbacks.push(callback);
          listeners.set(event, callbacks);

          return Promise.resolve(() => {
            const registeredCallbacks = listeners.get(event);
            if (registeredCallbacks) {
              const index = registeredCallbacks.indexOf(callback);
              if (index > -1) {
                registeredCallbacks.splice(index, 1);
              }
            }
          });
        }),

        // Trigger an event (for testing)
        trigger: (event: string, payload: unknown) => {
          const callbacks = listeners.get(event);
          if (callbacks) {
            callbacks.forEach((listener) => listener({ payload }));
          }
        },

        // Clear all listeners
        clear: () => {
          listeners.clear();
        },
      };
    },
  };
}

/**
 * Create a mock ReadableStream for SSE testing
 */
export function createMockSSEStream(
  events: ReadonlyArray<Record<string, unknown>>,
) {
  const encoder = new TextEncoder();
  let eventIndex = 0;

  return new ReadableStream({
    start(controller) {
      const sendNext = () => {
        if (eventIndex >= events.length) {
          controller.close();
          return;
        }

        const event = events[eventIndex++];
        const sseData = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(sseData));

        // Send next event after a short delay
        setTimeout(sendNext, 10);
      };

      sendNext();
    },
  });
}

/**
 * Wait for async state updates
 */
export async function waitFor(callback: () => boolean | Promise<boolean>, timeout = 3000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const result = await callback();
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Flush all pending promises and timers
 */
export async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Mock localStorage for testing
 */
export function createMockLocalStorage() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => Array.from(store.keys())[index] || null),
  };
}

/**
 * Mock Zustand store for testing
 */
export function createMockZustandStore<T extends object>(initialState: T) {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((currentState: T) => Partial<T>)) => {
      const updates = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...updates } as T;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      listeners.clear();
    },
  };
}
