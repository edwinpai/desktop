/**
 * Gateway Store - Zustand store for gateway state
 *
 * Manages:
 * - Gateway process status
 * - Health check polling
 * - Auto-restart logic
 * - Process lifecycle (start/stop)
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { create } from "zustand";

import type {
  GatewayStatus,
  GatewayProcessEventPayload,
} from "@/types/gateway";

// ============================================================================
// Store State
// ============================================================================

interface GatewayState {
  // State
  status: GatewayStatus;
  pid: number | null;
  port: number;
  startedAt: string | null;
  lastHealthCheck: string | null;
  restartCount: number;
  uptime: number;
  error: string | null;

  // Health check polling
  isPolling: boolean;
  pollInterval: NodeJS.Timeout | null;

  // Event listeners
  unlisteners: UnlistenFn[];

  // Actions
  startGateway: (port?: number) => Promise<void>;
  stopGateway: (force?: boolean) => Promise<void>;
  refreshStatus: () => Promise<void>;
  performHealthCheck: () => Promise<void>;
  startPolling: (interval?: number) => void;
  stopPolling: () => void;
  setupEventListeners: () => Promise<void>;
  cleanup: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useGatewayStore = create<GatewayState>((set, get) => ({
  // Initial state
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

  // ========================================================================
  // Start Gateway
  // ========================================================================
  startGateway: async (port = 18789) => {
    try {
      set({ status: "starting", error: null, port });

      const pid = await invoke<number>("start_gateway_real", { port });

      set({
        status: "running",
        pid,
        port,
        startedAt: new Date().toISOString(),
      });

      get().startPolling();
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Failed to start gateway";
      console.error("Failed to start gateway:", err);
      set({ status: "stopped", error });
      throw err;
    }
  },

  // ========================================================================
  // Stop Gateway
  // ========================================================================
  stopGateway: async () => {
    try {
      set({ status: "stopping", error: null });

      get().stopPolling();
      await invoke("stop_gateway_real");

      set({
        status: "stopped",
        pid: null,
        startedAt: null,
        uptime: 0,
      });
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Failed to stop gateway";
      console.error("Failed to stop gateway:", err);
      set({ status: "unhealthy", error });
      throw err;
    }
  },

  // ========================================================================
  // Refresh Status
  // ========================================================================
  refreshStatus: async () => {
    try {
      const info = await invoke<{
        status: GatewayStatus;
        pid: number | null;
        port: number;
        startedAt?: string | null;
        started_at?: string | null;
        lastHealthCheck?: string | null;
        last_health_check?: string | null;
        restartCount?: number;
        restart_count?: number;
        uptime: number;
      }>("get_gateway_status_real");

      if (
        info.status === "running" ||
        info.status === "starting" ||
        info.status === "unhealthy"
      ) {
        set({
          status: info.status,
          pid: info.pid,
          port: info.port,
          startedAt: info.startedAt ?? info.started_at ?? null,
          lastHealthCheck:
            info.lastHealthCheck ?? info.last_health_check ?? null,
          restartCount: info.restartCount ?? info.restart_count ?? 0,
          uptime: info.uptime,
        });
        return;
      }
    } catch {
      // Internal manager not available
    }

    // Fallback: probe for externally-managed gateway (systemd, etc.)
    try {
      const probe = await invoke<{ found: boolean; url: string | null }>(
        "probe_gateway",
      );
      if (probe.found) {
        const port = probe.url
          ? parseInt(new URL(probe.url).port || "18789")
          : 18789;
        set({
          status: "running",
          port,
          pid: null,
          startedAt: null,
          lastHealthCheck: new Date().toISOString(),
          restartCount: 0,
          uptime: 0,
        });
        return;
      }
    } catch {
      // Probe failed
    }

    // Nothing running
    if (get().status !== "stopped") {
      set({ status: "stopped" });
    }
  },

  // ========================================================================
  // Perform Health Check
  // ========================================================================
  performHealthCheck: async () => {
    try {
      const probe = await invoke<{ found: boolean }>("probe_gateway");
      set({
        status: probe.found ? "running" : "unhealthy",
        lastHealthCheck: new Date().toISOString(),
        error: probe.found ? null : "Health check failed",
      });
    } catch (err) {
      console.error("Health check failed:", err);
      set({
        status: "unhealthy",
        lastHealthCheck: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Health check failed",
      });
    }
  },

  // ========================================================================
  // Start Polling
  // ========================================================================
  startPolling: (interval = 30000) => {
    // Stop existing polling
    get().stopPolling();

    // Start new polling interval
    const pollInterval = setInterval(() => {
      get().performHealthCheck();
    }, interval);

    set({ isPolling: true, pollInterval });

    // Perform initial health check
    get().performHealthCheck();
  },

  // ========================================================================
  // Stop Polling
  // ========================================================================
  stopPolling: () => {
    const { pollInterval } = get();

    if (pollInterval) {
      clearInterval(pollInterval);
      set({ isPolling: false, pollInterval: null });
    }
  },

  // ========================================================================
  // Setup Event Listeners
  // ========================================================================
  setupEventListeners: async () => {
    try {
      // Listen for gateway started event
      const unlistenStarted = await listen<GatewayProcessEventPayload>(
        "gateway:started",
        (event) => {
          const { status, pid } = event.payload;
          set({
            status,
            pid,
            startedAt: new Date().toISOString(),
          });
          get().startPolling();
        },
      );

      // Listen for gateway stopped event
      const unlistenStopped = await listen<GatewayProcessEventPayload>(
        "gateway:stopped",
        (event) => {
          const { status } = event.payload;
          set({
            status,
            pid: null,
            startedAt: null,
            uptime: 0,
          });
          get().stopPolling();
        },
      );

      // Listen for gateway crashed event
      const unlistenCrashed = await listen<GatewayProcessEventPayload>(
        "gateway:crashed",
        (event) => {
          const { status, message } = event.payload;
          set({
            status,
            pid: null,
            error: message || "Gateway crashed",
          });
          get().stopPolling();
        },
      );

      // Listen for gateway healthy event
      const unlistenHealthy = await listen<GatewayProcessEventPayload>(
        "gateway:healthy",
        (event) => {
          const { status } = event.payload;
          set({ status, error: null });
        },
      );

      // Listen for gateway unhealthy event
      const unlistenUnhealthy = await listen<GatewayProcessEventPayload>(
        "gateway:unhealthy",
        (event) => {
          const { status, message } = event.payload;
          set({ status, error: message || "Gateway unhealthy" });
        },
      );

      set({
        unlisteners: [
          unlistenStarted,
          unlistenStopped,
          unlistenCrashed,
          unlistenHealthy,
          unlistenUnhealthy,
        ],
      });
    } catch (err) {
      console.error("Failed to setup gateway event listeners:", err);
    }
  },

  // ========================================================================
  // Cleanup
  // ========================================================================
  cleanup: () => {
    // Stop polling
    get().stopPolling();

    // Cleanup event listeners
    const { unlisteners } = get();
    unlisteners.forEach((unlisten) => unlisten());
    set({ unlisteners: [] });
  },
}));

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to initialize gateway store on mount
 */
export function useGatewayInit() {
  const store = useGatewayStore();

  // Initialize on mount
  if (typeof window !== "undefined") {
    store.setupEventListeners();
    store.refreshStatus();

    // Cleanup on unmount
    return () => {
      store.cleanup();
    };
  }
}
