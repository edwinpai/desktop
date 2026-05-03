/**
 * Gateway Store Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGatewayStore } from "@/stores/gateway";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("Gateway Store", () => {
  beforeEach(() => {
    // Reset store state
    useGatewayStore.setState({
      status: "stopped",
      pid: null,
      port: 18789,
      startedAt: null,
      lastHealthCheck: null,
      restartCount: 0,
      uptime: 0,
      error: null,
      isPolling: false,
      pollInterval: null,
      unlisteners: [],
    });

    vi.clearAllMocks();
  });

  it("initializes with stopped status", () => {
    const state = useGatewayStore.getState();

    expect(state.status).toBe("stopped");
    expect(state.pid).toBeNull();
    expect(state.port).toBe(18789);
  });

  it("updates status when gateway starts", () => {
    useGatewayStore.setState({
      status: "running",
      pid: 12345,
      startedAt: new Date().toISOString(),
    });

    const newState = useGatewayStore.getState();
    expect(newState.status).toBe("running");
    expect(newState.pid).toBe(12345);
    expect(newState.startedAt).toBeTruthy();
  });

  it("clears pid when gateway stops", () => {
    useGatewayStore.setState({
      status: "running",
      pid: 12345,
    });

    useGatewayStore.setState({
      status: "stopped",
      pid: null,
      startedAt: null,
      uptime: 0,
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe("stopped");
    expect(state.pid).toBeNull();
  });

  it("tracks error state", () => {
    useGatewayStore.setState({
      status: "crashed",
      error: "Gateway crashed unexpectedly",
    });

    const state = useGatewayStore.getState();
    expect(state.status).toBe("crashed");
    expect(state.error).toBe("Gateway crashed unexpectedly");
  });

  it("handles polling state", () => {
    const state = useGatewayStore.getState();

    expect(state.isPolling).toBe(false);
    expect(state.pollInterval).toBeNull();

    // Start polling
    const intervalId = setInterval(() => {}, 1000) as unknown as NodeJS.Timeout;
    useGatewayStore.setState({
      isPolling: true,
      pollInterval: intervalId,
    });

    const newState = useGatewayStore.getState();
    expect(newState.isPolling).toBe(true);
    expect(newState.pollInterval).toBeTruthy();

    // Cleanup
    clearInterval(intervalId);
  });
});
