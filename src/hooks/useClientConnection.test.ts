import { renderHook, act, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useClientConnection, useConnectModeConnection } from "./useClientConnection";

import type { ClientConnectionStatus } from "@/types/api";

interface ConnectionEventPayload {
  payload: {
    status: ClientConnectionStatus;
    error?: string;
  };
}

interface ConnectResponse {
  success: boolean;
  state: ClientConnectionStatus;
  error?: string;
  gatewayPetname?: string;
}

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("useClientConnection", () => {
  const mockInvoke = invoke as ReturnType<typeof vi.fn>;
  const mockListen = listen as ReturnType<typeof vi.fn>;

  let eventListeners: Map<string, (event: ConnectionEventPayload) => void>;
  let unlistenFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    eventListeners = new Map();
    unlistenFn = vi.fn();

    // Mock event listener registration
    mockListen.mockImplementation(
      (eventName: string, handler: (event: ConnectionEventPayload) => void) => {
        eventListeners.set(eventName, handler);
        return Promise.resolve(unlistenFn);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to emit events
  const emitEvent = (
    eventName: string,
    payload: ConnectionEventPayload["payload"],
  ) => {
    const handler = eventListeners.get(eventName);
    if (handler) {
      handler({ payload });
    }
  };

  describe("initialization", () => {
    it("exposes Connect Mode alias without removing legacy hook export", () => {
      expect(useConnectModeConnection).toBe(useClientConnection);
    });

    it("initializes with disconnected status", () => {
      const { result } = renderHook(() => useClientConnection());

      expect(result.current.connectionStatus).toBe("disconnected");
      expect(result.current.error).toBeNull();
    });

    it("provides all required functions", () => {
      const { result } = renderHook(() => useClientConnection());

      expect(typeof result.current.connect).toBe("function");
      expect(typeof result.current.disconnect).toBe("function");
      expect(typeof result.current.getStatus).toBe("function");
    });

    it("registers connection-status event listener", () => {
      renderHook(() => useClientConnection());

      expect(mockListen).toHaveBeenCalledWith(
        "connection-status",
        expect.any(Function),
      );
    });
  });

  describe("connect", () => {
    it("successfully connects to gateway", async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        state: "connected" as ClientConnectionStatus,
        gatewayPetname: "alice-gateway",
      });

      const { result } = renderHook(() => useClientConnection());

      let success: boolean = false;

      await act(async () => {
        success = await result.current.connect({
          gatewayAddress: "192.168.1.100:3000",
          gatewayPubkey:
            "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        });
      });

      expect(success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("connect_to_gateway", {
        request: {
          gatewayAddress: "192.168.1.100:3000",
          gatewayPubkey:
            "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        },
      });
      expect(result.current.connectionStatus).toBe("connected");
      expect(result.current.error).toBeNull();
    });

    it("connects without explicit pubkey", async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        state: "connected" as ClientConnectionStatus,
      });

      const { result } = renderHook(() => useClientConnection());

      await act(async () => {
        await result.current.connect({
          gatewayAddress: "192.168.1.100:3000",
        });
      });

      expect(mockInvoke).toHaveBeenCalledWith("connect_to_gateway", {
        request: {
          gatewayAddress: "192.168.1.100:3000",
          gatewayPubkey: null,
        },
      });
    });

    it("sets connecting status during connection", async () => {
      let resolveConnect: (value: ConnectResponse) => void;
      const connectPromise = new Promise((resolve) => {
        resolveConnect = resolve;
      });

      mockInvoke.mockReturnValue(connectPromise);

      const { result } = renderHook(() => useClientConnection());

      act(() => {
        result.current.connect({ gatewayAddress: "192.168.1.100:3000" });
      });

      // Status should be connecting immediately
      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connecting");
      });

      // Resolve the connection
      await act(async () => {
        resolveConnect!({
          success: true,
          state: "connected" as ClientConnectionStatus,
        });
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connected");
      });
    });

    it("handles connection failure from response", async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        state: "failed" as ClientConnectionStatus,
        error: "Gateway unreachable",
      });

      const { result } = renderHook(() => useClientConnection());

      let success: boolean = true;

      await act(async () => {
        success = await result.current.connect({
          gatewayAddress: "192.168.1.100:3000",
        });
      });

      expect(success).toBe(false);
      expect(result.current.connectionStatus).toBe("failed");
      expect(result.current.error).toBe("Gateway unreachable");
    });

    it("handles connection exception", async () => {
      mockInvoke.mockRejectedValue(new Error("Network timeout"));

      const { result } = renderHook(() => useClientConnection());

      let success: boolean = true;

      await act(async () => {
        success = await result.current.connect({
          gatewayAddress: "192.168.1.100:3000",
        });
      });

      expect(success).toBe(false);
      expect(result.current.connectionStatus).toBe("failed");
      expect(result.current.error).toBe("Network timeout");
    });

    it("handles non-Error exceptions", async () => {
      mockInvoke.mockRejectedValue("String error");

      const { result } = renderHook(() => useClientConnection());

      let success: boolean = true;

      await act(async () => {
        success = await result.current.connect({
          gatewayAddress: "192.168.1.100:3000",
        });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Connection failed");
    });
  });

  describe("disconnect", () => {
    it("disconnects from gateway", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useClientConnection());

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockInvoke).toHaveBeenCalledWith("disconnect", {
        request: { disableReconnect: false },
      });
      expect(result.current.connectionStatus).toBe("disconnected");
      expect(result.current.error).toBeNull();
    });

    it("disconnects with reconnect disabled", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useClientConnection());

      await act(async () => {
        await result.current.disconnect(true);
      });

      expect(mockInvoke).toHaveBeenCalledWith("disconnect", {
        request: { disableReconnect: true },
      });
    });

    it("handles disconnect error", async () => {
      mockInvoke.mockRejectedValue(new Error("Disconnect failed"));

      const { result } = renderHook(() => useClientConnection());

      await act(async () => {
        await result.current.disconnect();
      });

      expect(result.current.error).toBe("Disconnect failed");
    });

    it("handles non-Error exceptions", async () => {
      mockInvoke.mockRejectedValue("String error");

      const { result } = renderHook(() => useClientConnection());

      await act(async () => {
        await result.current.disconnect();
      });

      expect(result.current.error).toBe("Disconnect failed");
    });
  });

  describe("getStatus", () => {
    it("fetches current connection status", async () => {
      mockInvoke.mockResolvedValue("connected" as ClientConnectionStatus);

      const { result } = renderHook(() => useClientConnection());

      let status: ClientConnectionStatus = "disconnected";

      await act(async () => {
        status = await result.current.getStatus();
      });

      expect(mockInvoke).toHaveBeenCalledWith("get_connection_status");
      expect(status).toBe("connected");
      expect(result.current.connectionStatus).toBe("connected");
    });

    it("returns disconnected on error", async () => {
      mockInvoke.mockRejectedValue(new Error("Status check failed"));

      const { result } = renderHook(() => useClientConnection());

      let status: ClientConnectionStatus = "connected";

      await act(async () => {
        status = await result.current.getStatus();
      });

      expect(status).toBe("disconnected");
      expect(result.current.error).toBe("Status check failed");
    });

    it("handles non-Error exceptions", async () => {
      mockInvoke.mockRejectedValue("String error");

      const { result } = renderHook(() => useClientConnection());

      let status: ClientConnectionStatus = "connected";

      await act(async () => {
        status = await result.current.getStatus();
      });

      expect(status).toBe("disconnected");
      expect(result.current.error).toBe("Failed to get status");
    });
  });

  describe("event handling", () => {
    it("updates status from connection-status event", () => {
      const { result } = renderHook(() => useClientConnection());

      act(() => {
        emitEvent("connection-status", {
          status: "reconnecting" as ClientConnectionStatus,
        });
      });

      expect(result.current.connectionStatus).toBe("reconnecting");
      expect(result.current.error).toBeNull();
    });

    it("updates error from connection-status event", () => {
      const { result } = renderHook(() => useClientConnection());

      act(() => {
        emitEvent("connection-status", {
          status: "failed" as ClientConnectionStatus,
          error: "Authentication failed",
        });
      });

      expect(result.current.connectionStatus).toBe("failed");
      expect(result.current.error).toBe("Authentication failed");
    });

    it("clears error when event has no error field", () => {
      const { result } = renderHook(() => useClientConnection());

      // First set an error
      act(() => {
        emitEvent("connection-status", {
          status: "failed" as ClientConnectionStatus,
          error: "Some error",
        });
      });

      expect(result.current.error).toBe("Some error");

      // Then receive event without error
      act(() => {
        emitEvent("connection-status", {
          status: "connected" as ClientConnectionStatus,
        });
      });

      expect(result.current.error).toBeNull();
    });

    it("handles multiple status transitions", () => {
      const { result } = renderHook(() => useClientConnection());

      act(() => {
        emitEvent("connection-status", {
          status: "connecting" as ClientConnectionStatus,
        });
      });
      expect(result.current.connectionStatus).toBe("connecting");

      act(() => {
        emitEvent("connection-status", {
          status: "connected" as ClientConnectionStatus,
        });
      });
      expect(result.current.connectionStatus).toBe("connected");

      act(() => {
        emitEvent("connection-status", {
          status: "reconnecting" as ClientConnectionStatus,
        });
      });
      expect(result.current.connectionStatus).toBe("reconnecting");

      act(() => {
        emitEvent("connection-status", {
          status: "disconnected" as ClientConnectionStatus,
        });
      });
      expect(result.current.connectionStatus).toBe("disconnected");
    });
  });

  describe("cleanup", () => {
    it("unregisters event listener on unmount", async () => {
      const { unmount } = renderHook(() => useClientConnection());

      // Wait for listener to be registered
      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      unmount();

      // Wait for unlisten to be called
      await waitFor(() => {
        expect(unlistenFn).toHaveBeenCalled();
      });
    });
  });
});
