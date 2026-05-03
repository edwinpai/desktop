/**
 * GatewayStatusIndicator Component
 *
 * Displays the current gateway status as a colored dot with tooltip.
 * Checks both internal process manager AND actual network reachability.
 * Green = running, Red = stopped, Yellow = starting/error
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { readConfig } from "@/lib/config";

interface GatewayStatus {
  isRunning: boolean;
  status: "running" | "stopped" | "starting" | "error";
  url?: string;
}

interface ProbeResult {
  found: boolean;
  url: string | null;
  error: string | null;
}

export function GatewayStatusIndicator() {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({
    isRunning: false,
    status: "stopped",
  });

  const checkGatewayStatus = useCallback(async () => {
    // First check internal process manager
    try {
      const response = await invoke<{ running: boolean }>("get_gateway_status");
      if (response.running) {
        setGatewayStatus({ isRunning: true, status: "running" });
        return;
      }
    } catch {
      // Internal manager not available — fall through to probe
    }

    // Fallback: probe for externally-managed gateway (systemd, manual, etc.)
    try {
      const probe = await invoke<ProbeResult>("probe_gateway");
      if (probe.found) {
        setGatewayStatus({
          isRunning: true,
          status: "running",
          url: probe.url ?? undefined,
        });
        return;
      }
    } catch {
      // Probe failed
    }

    // Also check configured URL from desktop config (may be non-default port)
    try {
      const desktopConfig = await readConfig();
      if (
        desktopConfig.gatewayUrl &&
        desktopConfig.gatewayUrl !== "http://localhost:18789"
      ) {
        // Use Rust-side probe (JS fetch blocked by Tauri CSP)
        const customProbe = await invoke<ProbeResult>("probe_gateway", {
          url: desktopConfig.gatewayUrl,
        });
        if (customProbe.found) {
          setGatewayStatus({
            isRunning: true,
            status: "running",
            url: desktopConfig.gatewayUrl,
          });
          return;
        }
      }
    } catch {
      // Config read or probe failed
    }

    setGatewayStatus({ isRunning: false, status: "stopped" });
  }, []);

  useEffect(() => {
    const initialTimeout = setTimeout(() => {
      void checkGatewayStatus();
    }, 0);

    const interval = setInterval(() => {
      void checkGatewayStatus();
    }, 5000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkGatewayStatus]);

  const getStatusColor = () => {
    switch (gatewayStatus.status) {
      case "running":
        return "bg-green-500";
      case "stopped":
        return "bg-red-500";
      case "starting":
        return "bg-yellow-500";
      case "error":
        return "bg-orange-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    switch (gatewayStatus.status) {
      case "running":
        return gatewayStatus.url && !gatewayStatus.url.includes("18789")
          ? `Connected (${new URL(gatewayStatus.url).host})`
          : "Gateway Running";
      case "stopped":
        return "Gateway Stopped";
      case "starting":
        return "Gateway Starting...";
      case "error":
        return "Gateway Error";
      default:
        return "Unknown Status";
    }
  };

  return (
    <div className="flex items-center gap-2" title={getStatusText()}>
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs text-muted-foreground">{getStatusText()}</span>
    </div>
  );
}
