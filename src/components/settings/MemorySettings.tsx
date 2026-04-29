/**
 * MemorySettings - Subscription and cache configuration
 *
 * Features:
 * - Subscription cache TTL
 * - Auto-check on startup
 * - Renewal reminder settings
 * - Reads/writes via IPC get_config/save_config commands
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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

export function MemorySettings() {
  const [config, setConfig] = useState<BackendDesktopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load config on mount
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

  const updateConfig = async (updates: Partial<BackendDesktopConfig['subscription']>) => {
    if (!config) return;
    try {
      const updated = {
        ...config,
        subscription: { ...config.subscription, ...updates },
      };
      await invoke('save_config', { config: updated });
      setConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
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
        <h2 className="text-2xl font-bold">Memory & Subscription Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure subscription caching and validation behavior
        </p>
      </div>

      {/* Cache Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Subscription Cache</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cache-ttl">Cache TTL (seconds)</Label>
            <Input
              id="cache-ttl"
              type="number"
              min={60}
              max={86400}
              step={60}
              value={config.subscription.cacheTtlSeconds}
              onChange={(e) =>
                updateConfig({ cacheTtlSeconds: parseInt(e.target.value) })
              }
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              How long to cache subscription proofs before re-verifying (60-86400 seconds)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current: {Math.floor(config.subscription.cacheTtlSeconds / 60)} minutes
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="check-startup">Check on startup</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Verify subscription status when the app launches
              </p>
            </div>
            <Switch
              id="check-startup"
              checked={config.subscription.checkOnStartup}
              onCheckedChange={(checked) => updateConfig({ checkOnStartup: checked })}
            />
          </div>
        </div>
      </Card>

      {/* Renewal Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Renewal Reminders</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reminder-days">Reminder days before expiry</Label>
            <Input
              id="reminder-days"
              type="number"
              min={1}
              max={30}
              value={config.subscription.autoRenewReminderDays}
              onChange={(e) =>
                updateConfig({ autoRenewReminderDays: parseInt(e.target.value) })
              }
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Show renewal reminder this many days before subscription expires (1-30)
            </p>
          </div>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
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
            className="text-blue-600 shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-blue-900">
              <strong>About Subscription Memory:</strong> EdwinPAI uses SPV (Simplified
              Payment Verification) to verify your subscription on the Bitcoin SV blockchain.
              Caching reduces network requests while maintaining security through cryptographic
              proof verification.
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
