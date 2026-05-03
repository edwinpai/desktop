import { act, renderHook } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDiscovery } from "./useDiscovery";

import type { DiscoveredPeer } from "@/types/api";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("useDiscovery", () => {
  const mockInvoke = invoke as ReturnType<typeof vi.fn>;

  const mockPeer1: DiscoveredPeer = {
    pubkey:
      "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    petname: "alice-gateway",
    address: "192.168.1.100:3000",
    isOnline: true,
    lastSeen: "2026-02-11T10:00:00Z",
    authorizationLevel: "owner",
  };

  const mockPeer2: DiscoveredPeer = {
    pubkey:
      "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5",
    petname: "bob-gateway",
    address: "192.168.1.101:3000",
    isOnline: false,
    lastSeen: "2026-02-11T09:55:00Z",
    authorizationLevel: "member",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("initializes with empty peers and scanning disabled", () => {
      const { result } = renderHook(() => useDiscovery());

      expect(result.current.peers).toEqual([]);
      expect(result.current.isScanning).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("provides all required functions", () => {
      const { result } = renderHook(() => useDiscovery());

      expect(typeof result.current.startScan).toBe("function");
      expect(typeof result.current.stopScan).toBe("function");
      expect(typeof result.current.refreshPeers).toBe("function");
    });
  });

  describe("refreshPeers", () => {
    it("fetches peers from scan_network command", async () => {
      mockInvoke.mockResolvedValue([mockPeer1, mockPeer2]);

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.refreshPeers();
        await vi.advanceTimersByTimeAsync(500); // debounce delay
      });

      expect(mockInvoke).toHaveBeenCalledWith("scan_network");
      expect(result.current.peers).toEqual([mockPeer1, mockPeer2]);
      expect(result.current.error).toBeNull();
    });

    it("handles empty peer list", async () => {
      mockInvoke.mockResolvedValue([]);

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.refreshPeers();
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(result.current.peers).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("sets error on scan failure", async () => {
      mockInvoke.mockRejectedValue(new Error("Network scan failed"));

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.refreshPeers();
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(result.current.error).toBe("Network scan failed");
      expect(result.current.peers).toEqual([]);
    });

    it("clears previous error on successful scan", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("First scan failed"));
      mockInvoke.mockResolvedValueOnce([mockPeer1]);

      const { result } = renderHook(() => useDiscovery());

      // First scan fails
      await act(async () => {
        result.current.refreshPeers();
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(result.current.error).toBe("First scan failed");

      // Second scan succeeds
      await act(async () => {
        result.current.refreshPeers();
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(result.current.error).toBeNull();
      expect(result.current.peers).toEqual([mockPeer1]);
    });

    it("handles non-Error exceptions", async () => {
      mockInvoke.mockRejectedValue("String error");

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.refreshPeers();
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(result.current.error).toBe("Failed to scan network");
      expect(result.current.peers).toEqual([]);
    });
  });

  describe("startScan", () => {
    it("triggers initial scan immediately", async () => {
      mockInvoke.mockResolvedValue([mockPeer1]);

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.startScan();
        // startScan calls refreshPeersInternal directly (no debounce)
        // but need to flush the resolved promise
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isScanning).toBe(true);
      expect(result.current.peers).toEqual([mockPeer1]);
      expect(mockInvoke).toHaveBeenCalledWith("scan_network");
    });

    it("sets up polling interval of 5 seconds", async () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      mockInvoke.mockResolvedValue([mockPeer1]);

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.startScan();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Verify interval was set with 5000ms
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

      setIntervalSpy.mockRestore();
    });

    it("continues polling with updated peer lists", async () => {
      mockInvoke
        .mockResolvedValueOnce([mockPeer1])
        .mockResolvedValueOnce([mockPeer1, mockPeer2])
        .mockResolvedValueOnce([mockPeer2]);

      const { result } = renderHook(() => useDiscovery());

      // First scan (immediate via startScan)
      await act(async () => {
        result.current.startScan();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.peers).toEqual([mockPeer1]);

      // Second poll via interval (5000ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(result.current.peers).toEqual([mockPeer1, mockPeer2]);

      // Third poll via interval (5000ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(result.current.peers).toEqual([mockPeer2]);
    });

    it("does not restart scan if already scanning", async () => {
      mockInvoke.mockResolvedValue([mockPeer1]);

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.startScan();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      const firstCallCount = mockInvoke.mock.calls.length;

      act(() => {
        result.current.startScan();
      });

      // Should not trigger additional scan immediately
      expect(mockInvoke).toHaveBeenCalledTimes(firstCallCount);
    });
  });

  describe("stopScan", () => {
    it("stops scanning and clears interval", async () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      mockInvoke.mockResolvedValue([mockPeer1]);

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.startScan();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isScanning).toBe(true);

      act(() => {
        result.current.stopScan();
      });

      expect(result.current.isScanning).toBe(false);
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it("can be called multiple times safely", () => {
      const { result } = renderHook(() => useDiscovery());

      act(() => {
        result.current.stopScan();
        result.current.stopScan();
        result.current.stopScan();
      });

      expect(result.current.isScanning).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("clears interval on unmount", async () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      mockInvoke.mockResolvedValue([mockPeer1]);

      const { result, unmount } = renderHook(() => useDiscovery());

      await act(async () => {
        result.current.startScan();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isScanning).toBe(true);

      unmount();

      // Verify interval was cleared on unmount
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });
  });

  describe("scan and stop workflow", () => {
    it("supports start-stop-start cycle", async () => {
      mockInvoke.mockResolvedValue([mockPeer1]);

      const { result } = renderHook(() => useDiscovery());

      // First scan cycle
      await act(async () => {
        result.current.startScan();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isScanning).toBe(true);
      expect(mockInvoke).toHaveBeenCalled();

      act(() => {
        result.current.stopScan();
      });
      expect(result.current.isScanning).toBe(false);

      // Second scan cycle
      mockInvoke.mockClear();
      await act(async () => {
        result.current.startScan();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isScanning).toBe(true);
      expect(mockInvoke).toHaveBeenCalled();
    });
  });
});
