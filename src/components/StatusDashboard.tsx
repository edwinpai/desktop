/**
 * StatusDashboard — Gateway health, channels, and usage overview.
 *
 * Calls gateway health, status, channels.status, and usage.status methods.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Radio,
  Cpu,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  callGatewayMethod,
  resolveToken,
  inferGatewayKind,
  type GatewayTarget,
} from '@/lib/gateway-context';
import { readConfig } from '@/lib/config';

interface DashboardData {
  health: Record<string, unknown> | null;
  status: Record<string, unknown> | null;
  channels: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
}


export function StatusDashboard() {
  const [data, setData] = useState<DashboardData>({
    health: null,
    status: null,
    channels: null,
    usage: null,
  });
  const [sectionErrors, setSectionErrors] = useState<Record<keyof DashboardData, string | null>>({
    health: null,
    status: null,
    channels: null,
    usage: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const buildTarget = useCallback(async (): Promise<GatewayTarget> => {
    const cfg = await readConfig();
    const url = cfg.gatewayUrl || 'http://localhost:18789';
    const token = cfg.gatewayToken || (await resolveToken());
    return { url, token: token || undefined, kind: inferGatewayKind(url) };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const target = await buildTarget();
      const call = (method: string, params: Record<string, unknown> = {}) =>
        callGatewayMethod(target, method, params, 15_000, `${method} timed out`) as Promise<Record<string, unknown>>;

      const [health, status, channels, usage] = await Promise.allSettled([
        call('health', { probe: true }),
        call('status'),
        call('channels.status'),
        call('usage.status'),
      ]);

      setData({
        health: health.status === 'fulfilled' ? health.value : null,
        status: status.status === 'fulfilled' ? status.value : null,
        channels: channels.status === 'fulfilled' ? channels.value : null,
        usage: usage.status === 'fulfilled' ? usage.value : null,
      });
      setSectionErrors({
        health: health.status === 'rejected' ? String(health.reason instanceof Error ? health.reason.message : health.reason) : null,
        status: status.status === 'rejected' ? String(status.reason instanceof Error ? status.reason.message : status.reason) : null,
        channels: channels.status === 'rejected' ? String(channels.reason instanceof Error ? channels.reason.message : channels.reason) : null,
        usage: usage.status === 'rejected' ? String(usage.reason instanceof Error ? usage.reason.message : usage.reason) : null,
      });
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSectionErrors({ health: null, status: null, channels: null, usage: null });
    } finally {
      setLoading(false);
    }
  }, [buildTarget]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Status</h2>
          <p className="text-sm text-muted-foreground">
            Gateway health, channels, and usage overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Health Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.health ? (
              <div className="space-y-2 text-sm">
                {Object.entries(data.health).slice(0, 8).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono text-xs">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <SectionFallback label="Health" error={sectionErrors.health} />
            )}
          </CardContent>
        </Card>

        {/* Channels Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.channels ? (
              <div className="space-y-2">
                {renderChannels(data.channels)}
              </div>
            ) : (
              <SectionFallback label="Channels" error={sectionErrors.channels} />
            )}
          </CardContent>
        </Card>

        {/* Usage Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.usage ? (
              <div className="space-y-2 text-sm">
                {Object.entries(data.usage).slice(0, 8).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono text-xs">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <SectionFallback label="Usage" error={sectionErrors.usage} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full status dump */}
      {data.status && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Full Status</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/40 rounded p-3 overflow-auto max-h-64">
              {JSON.stringify(data.status, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function renderChannels(channels: Record<string, unknown>) {
  const channelOrder = channels.channelOrder as string[] | undefined;
  const channelLabels = channels.channelLabels as Record<string, string> | undefined;
  const channelData = channels.channels as Record<string, unknown> | undefined;

  if (!channelOrder || channelOrder.length === 0) {
    return <p className="text-sm text-muted-foreground">No channels configured</p>;
  }

  return channelOrder.map((ch) => {
    const label = channelLabels?.[ch] ?? ch;
    const info = (channelData?.[ch] ?? {}) as Record<string, unknown>;
    const status = info.status as string | undefined;
    const isOk = status === 'ok' || status === 'connected' || status === 'running';
    const isWarn = status === 'degraded' || status === 'reconnecting';

    return (
      <div key={ch} className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          {isOk ? (
            <CheckCircle className="h-3 w-3 text-green-500" />
          ) : isWarn ? (
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
          ) : (
            <XCircle className="h-3 w-3 text-gray-400" />
          )}
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{status ?? 'unknown'}</span>
      </div>
    );
  });
}


function SectionFallback({ label, error }: { label: string; error: string | null }) {
  if (error) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium">{label} unavailable</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">No data available yet.</p>;
}
