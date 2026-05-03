/**
 * GatewaySettings - Gateway-specific configuration
 *
 * Features:
 * - Gateway process configuration (port, auto-start, auto-restart)
 * - Health check settings
 * - Log level configuration
 * - Reads/writes via IPC get_config/save_config commands
 */

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BackendDesktopConfig {
  version: string;
  mode: "gateway" | "client";
  gateway: {
    port: number;
    autoStart: boolean;
    autoRestart: boolean;
    maxRestarts: number;
    healthCheckIntervalMs: number;
    logLevel: string;
  };
  mdns: {
    enabled: boolean;
    serviceName: string | null;
    advertiseOnStartup: boolean;
  };
  ui: {
    theme: "light" | "dark" | "system";
    minimizeToTray: boolean;
    startMinimized: boolean;
    windowWidth: number;
    windowHeight: number;
    windowX: number | null;
    windowY: number | null;
  };
  subscription: {
    cacheTtlSeconds: number;
    checkOnStartup: boolean;
    autoRenewReminderDays: number;
  };
  lastClientSession: {
    gatewayPubkey: string;
    gatewayAddress: string;
    gatewayPetname: string;
    connectedAt: string;
    permission: string;
  } | null;
}

export function GatewaySettings() {
  const [config, setConfig] = useState<BackendDesktopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const backendConfig = await invoke<BackendDesktopConfig>("get_config");
        setConfig(backendConfig);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load configuration",
        );
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const updateConfig = async (
    updates: Partial<BackendDesktopConfig["gateway"]>,
  ) => {
    if (!config) return;
    try {
      const updated = {
        ...config,
        gateway: { ...config.gateway, ...updates },
      };
      await invoke("save_config", { config: updated });
      setConfig(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update configuration",
      );
    }
  };

  if (loading || !config) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Gateway Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure gateway process behavior and performance
        </p>
      </div>

      {/* Process Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Process Configuration</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="port">Gateway Port</Label>
            <Input
              id="port"
              type="number"
              min={1024}
              max={65535}
              value={config.gateway.port}
              onChange={(e) => updateConfig({ port: parseInt(e.target.value) })}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Port number for the gateway server (1024-65535)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="auto-start">Auto-start on launch</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Start gateway automatically when the app launches
              </p>
            </div>
            <Switch
              id="auto-start"
              checked={config.gateway.autoStart}
              onCheckedChange={(checked) =>
                updateConfig({ autoStart: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="auto-restart">Auto-restart on crash</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically restart the gateway if it crashes
              </p>
            </div>
            <Switch
              id="auto-restart"
              checked={config.gateway.autoRestart}
              onCheckedChange={(checked) =>
                updateConfig({ autoRestart: checked })
              }
            />
          </div>

          <div>
            <Label htmlFor="max-restarts">Max restart attempts</Label>
            <Input
              id="max-restarts"
              type="number"
              min={0}
              max={20}
              value={config.gateway.maxRestarts}
              onChange={(e) =>
                updateConfig({ maxRestarts: parseInt(e.target.value) })
              }
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Maximum number of automatic restart attempts (0-20)
            </p>
          </div>
        </div>
      </Card>

      {/* Health Check Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Health Monitoring</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="health-interval">Health check interval (ms)</Label>
            <Input
              id="health-interval"
              type="number"
              min={1000}
              max={300000}
              step={1000}
              value={config.gateway.healthCheckIntervalMs}
              onChange={(e) =>
                updateConfig({
                  healthCheckIntervalMs: parseInt(e.target.value),
                })
              }
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Interval between health checks in milliseconds (1000-300000)
            </p>
          </div>
        </div>
      </Card>

      {/* Logging Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Logging</h3>
        <div className="space-y-4">
          <div>
            <Label>Log level</Label>
            <Select
              value={config.gateway.logLevel}
              onValueChange={(value) => updateConfig({ logLevel: value })}
            >
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="trace">Trace</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">
              Minimum log level for gateway process output
            </p>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-600 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">{error}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
