/**
 * GeneralSettings - General application settings
 *
 * Features:
 * - Mode selector (Gateway vs Client)
 * - Conditional settings based on mode
 * - Theme preference
 * - Gateway-specific settings (port, auto-start)
 * - Client-specific settings (auto-reconnect, timeout)
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Backend config structure from Phase 4
interface BackendDesktopConfig {
  version: string;
  mode: 'gateway' | 'client';
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
    theme: 'light' | 'dark' | 'system';
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

export function GeneralSettings() {
  const [config, setConfig] = useState<BackendDesktopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [modeChangeError, setModeChangeError] = useState<string | null>(null);

  // Load config from backend on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const backendConfig = await invoke<BackendDesktopConfig>('get_config');
        setConfig(backendConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleModeChange = async (newMode: 'gateway' | 'client') => {
    if (!config || newMode === config.mode) return;

    setIsSwitchingMode(true);
    setModeChangeError(null);

    try {
      if (config.mode === 'gateway') {
        // Stop gateway before switching to client mode
        await invoke('stop_gateway_real');
      }

      // Use set_mode command
      const updatedConfig = await invoke<BackendDesktopConfig>('set_mode', { mode: newMode });
      setConfig(updatedConfig);

      if (newMode === 'gateway' && updatedConfig.gateway.autoStart) {
        // Auto-start gateway if configured
        await invoke('start_gateway_real', { port: updatedConfig.gateway.port });
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to switch mode';
      setModeChangeError(errorMsg);
    } finally {
      setIsSwitchingMode(false);
    }
  };

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    if (!config) return;
    try {
      const updated = { ...config, ui: { ...config.ui, theme } };
      await invoke('save_config', { config: updated });
      setConfig(updated);
      // Apply theme to document
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update theme');
    }
  };

  const handleGatewayPortChange = async (port: number) => {
    if (!config || port < 1024 || port > 65535) return;
    try {
      const updated = { ...config, gateway: { ...config.gateway, port } };
      await invoke('save_config', { config: updated });
      setConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update port');
    }
  };

  const handleAutoStartChange = async (enabled: boolean) => {
    if (!config) return;
    try {
      const updated = { ...config, gateway: { ...config.gateway, autoStart: enabled } };
      await invoke('save_config', { config: updated });
      setConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auto-start');
    }
  };

  const handleAutoReconnectChange = async (enabled: boolean) => {
    // Client config - placeholder for future implementation
    console.log('Auto-reconnect:', enabled);
  };

  if (loading || !config) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">General Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure application behavior and preferences
        </p>
      </div>

      {/* Mode Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Operating Mode</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose how you want to use EdwinPAI Desktop
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Gateway Mode Card */}
          <button
            onClick={() => handleModeChange('gateway')}
            disabled={isSwitchingMode}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              config.mode === 'gateway'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${isSwitchingMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg ${
                  config.mode === 'gateway' ? 'bg-blue-100' : 'bg-muted'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={config.mode === 'gateway' ? 'text-blue-600' : 'text-muted-foreground'}
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1">Gateway Mode</div>
                <p className="text-xs text-muted-foreground">
                  Run your own AI gateway and allow others to connect
                </p>
              </div>
              {config.mode === 'gateway' && (
                <div className="text-blue-600">
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
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          </button>

          {/* Client Mode Card */}
          <button
            onClick={() => handleModeChange('client')}
            disabled={isSwitchingMode}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              config.mode === 'client'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${isSwitchingMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg ${
                  config.mode === 'client' ? 'bg-blue-100' : 'bg-muted'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={config.mode === 'client' ? 'text-blue-600' : 'text-muted-foreground'}
                >
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1">Client Mode</div>
                <p className="text-xs text-muted-foreground">
                  Connect to someone else's gateway on your network
                </p>
              </div>
              {config.mode === 'client' && (
                <div className="text-blue-600">
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
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        </div>

        {modeChangeError && (
          <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200">
            <p className="text-sm text-red-900">{modeChangeError}</p>
          </div>
        )}
      </Card>

      {/* Appearance */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Appearance</h3>
        <div className="space-y-4">
          <div>
            <Label>Theme</Label>
            <Select
              value={config.ui.theme}
              onValueChange={(value) =>
                handleThemeChange(value as 'light' | 'dark' | 'system')
              }
            >
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">
              Choose your preferred color theme
            </p>
          </div>
        </div>
      </Card>

      {/* Gateway-Specific Settings */}
      {config.mode === 'gateway' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Gateway Settings</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gateway-port">Gateway Port</Label>
              <Input
                id="gateway-port"
                type="number"
                min={1024}
                max={65535}
                value={config.gateway.port}
                onChange={(e) => handleGatewayPortChange(parseInt(e.target.value))}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Port number for the gateway server (1024-65535)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="auto-start">Auto-start gateway</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically start the gateway when the app launches
                </p>
              </div>
              <Switch
                id="auto-start"
                checked={config.gateway.autoStart}
                onCheckedChange={handleAutoStartChange}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Client-Specific Settings */}
      {config.mode === 'client' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Client Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="auto-reconnect">Auto-reconnect</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically reconnect to gateway if connection is lost
                </p>
              </div>
              <Switch
                id="auto-reconnect"
                checked={true}
                onCheckedChange={handleAutoReconnectChange}
              />
            </div>

            <div>
              <Label>Connection Timeout</Label>
              <Select defaultValue="10">
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                How long to wait before timing out a connection attempt
              </p>
            </div>
          </div>
        </Card>
      )}

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
