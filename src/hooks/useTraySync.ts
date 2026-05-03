import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TrayMenuState {
  window_visible: boolean;
  gateway_running: boolean;
  gateway_healthy: boolean;
  subscription_active: boolean;
  update_available: boolean;
  channel_count: number;
}

interface UseTrayOptions {
  isConnected: boolean;
  activeProfileName?: string;
  sshTunnelStatus?: string | null;
  channelCount?: number;
}

/**
 * Syncs app state to the system tray menu.
 * Debounced to avoid rapid menu rebuilds that steal focus.
 */
export function useTraySync({
  isConnected,
  activeProfileName,
  sshTunnelStatus,
  channelCount = 0,
}: UseTrayOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStateRef = useRef<string>("");
  const hasSkippedInitialSyncRef = useRef(false);

  useEffect(() => {
    // Build a state key to deduplicate — skip if nothing changed
    const stateKey = `${isConnected}|${activeProfileName}|${sshTunnelStatus}|${channelCount}`;
    if (stateKey === lastStateRef.current) return;

    // Skip the initial frontend sync. The Rust side already creates the tray,
    // and pushing an immediate native menu rebuild during startup can cause
    // focus-stealing/flicker on macOS.
    if (!hasSkippedInitialSyncRef.current) {
      hasSkippedInitialSyncRef.current = true;
      lastStateRef.current = stateKey;
      return;
    }

    // Debounce: wait 500ms before pushing to tray to avoid rapid flicker
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastStateRef.current = stateKey;

      const state: TrayMenuState = {
        window_visible: true,
        gateway_running: isConnected,
        gateway_healthy: isConnected,
        subscription_active: true,
        update_available: false,
        channel_count: channelCount,
      };

      invoke("update_tray_state", { state }).catch((err) => {
        console.debug("[Tray] Failed to update state:", err);
      });

      const profileLabel = activeProfileName ?? "Local";
      const tunnelLabel = sshTunnelStatus === "connected" ? " (SSH)" : "";
      const statusLabel = isConnected ? "Connected" : "Disconnected";
      const tooltip = `EdwinPAI — ${profileLabel}${tunnelLabel} — ${statusLabel}`;

      invoke("set_tray_tooltip", { tooltip }).catch(() => {});
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isConnected, activeProfileName, sshTunnelStatus, channelCount]);
}
