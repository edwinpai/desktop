/**
 * useDiscovery Hook Tests
 *
 * Tests mDNS discovery, polling, debouncing
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDiscovery } from "@/hooks/useDiscovery";
import type { DiscoveredPeer } from "@/types/api";

type MockHandler = unknown | ((args?: unknown) => unknown | Promise<unknown>);

// Create mock handlers in vi.hoisted()
const { mockHandlers, mockInvoke } = vi.hoisted(() => {
  const mockHandlers = new Map<string, MockHandler>();

  return {
    mockHandlers,
    mockInvoke: vi.fn(async (command: string, args?: unknown) => {
      const handler = mockHandlers.get(command);
      if (!handler) {
        throw new Error(`No mock handler for command: ${command}`);
      }
      return typeof handler === "function" ? handler(args) : handler;
    }),
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
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

// Mock debounce utility
vi.mock("@/lib/debounce", () => ({
  useDebouncedCallback: <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
  ) => fn,
}));

describe("useDiscovery", () => {
  const mockPeers: DiscoveredPeer[] = [
    {
      address: "http://192.168.1.100:3000",
      pubkey: "pubkey1",
      petname: "gateway-1",
      isOnline: true,
      lastSeen: new Date().toISOString(),
      authorizationLevel: "guest",
    },
    {
      address: "http://192.168.1.101:3000",
      pubkey: "pubkey2",
      petname: "gateway-2",
      isOnline: true,
      lastSeen: new Date().toISOString(),
      authorizationLevel: "guest",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIPC.mock("scan_network", mockPeers);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should initialize with empty state", () => {
    const { result } = renderHook(() => useDiscovery());

    expect(result.current.peers).toEqual([]);
    expect(result.current.isScanning).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should start scanning and discover peers", async () => {
    const { result } = renderHook(() => useDiscovery());

    await act(async () => {
      result.current.startScan();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isScanning).toBe(true);
    expect(result.current.peers).toHaveLength(2);
  });

  it("should stop scanning", async () => {
    const { result } = renderHook(() => useDiscovery());

    await act(async () => {
      result.current.startScan();
    });

    act(() => {
      result.current.stopScan();
    });

    expect(result.current.isScanning).toBe(false);
  });

  it("should poll every 5 seconds while scanning", async () => {
    const { result } = renderHook(() => useDiscovery());

    await act(async () => {
      result.current.startScan();
      await vi.advanceTimersByTimeAsync(0);
    });

    mockIPC.clearCommand("scan_network");
    mockIPC.mock("scan_network", [mockPeers[0]]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.peers).toHaveLength(1);
  });

  it("should not start scan if already scanning", async () => {
    const { result } = renderHook(() => useDiscovery());

    await act(async () => {
      result.current.startScan();
    });

    const invokeCalls = mockIPC.getInvokeMock().mock.calls.length;

    await act(async () => {
      result.current.startScan();
    });

    expect(mockIPC.getInvokeMock().mock.calls.length).toBe(invokeCalls);
  });

  it("should manually refresh peers", async () => {
    const { result } = renderHook(() => useDiscovery());

    await act(async () => {
      await result.current.refreshPeers();
    });

    expect(result.current.peers).toHaveLength(2);
  });

  it("should handle scan errors", async () => {
    mockIPC.clear();
    mockIPC.mock("scan_network", () => {
      throw new Error("Network error");
    });

    const { result } = renderHook(() => useDiscovery());

    await act(async () => {
      result.current.startScan();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.peers).toEqual([]);
  });

  it("should cleanup interval on unmount", async () => {
    const { result, unmount } = renderHook(() => useDiscovery());

    await act(async () => {
      result.current.startScan();
    });

    unmount();

    const callsBefore = mockIPC.getInvokeMock().mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockIPC.getInvokeMock().mock.calls.length).toBe(callsBefore);
  });
});
