import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, Clock, Calendar, RefreshCw } from "lucide-react";
import {
  callGatewayMethod,
  inferGatewayKind,
  resolveToken,
  type GatewayTarget,
} from "@/lib/gateway-context";
import { readConfig } from "@/lib/config";

type DateRange = "today" | "7d" | "30d" | "all";

type ProviderWindow = {
  label: string;
  usedPercent: number;
  resetAt?: number;
};

type ProviderUsageSnapshot = {
  provider: string;
  displayName: string;
  windows: ProviderWindow[];
  plan?: string;
  error?: string;
};

type UsageStatusSummary = {
  updatedAt: number;
  providers: ProviderUsageSnapshot[];
};

type CostUsageSummary = {
  updatedAt: number;
  days: number;
  daily: Array<{
    date: string;
    input: number;
    output: number;
    totalTokens: number;
    totalCost: number;
    missingCostEntries?: number;
  }>;
  totals: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    totalCost: number;
    missingCostEntries: number;
  };
};

const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

const formatCost = (n: number) => `$${n.toFixed(3)}`;

const rangeLabel: Record<DateRange, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  all: "All",
};

const rangeDays: Record<DateRange, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  all: 3650,
};

async function buildTarget(): Promise<GatewayTarget> {
  const cfg = await readConfig();
  const url = cfg.gatewayUrl || "http://localhost:18789";
  const token = cfg.gatewayToken || (await resolveToken());
  return { url, token: token || undefined, kind: inferGatewayKind(url) };
}

export function UsagePanel() {
  const [range, setRange] = useState<DateRange>("30d");
  const [statusSummary, setStatusSummary] = useState<UsageStatusSummary | null>(null);
  const [costSummary, setCostSummary] = useState<CostUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const target = await buildTarget();
      const [status, cost] = await Promise.allSettled([
        callGatewayMethod(target, "usage.status", {}, 15_000, "usage.status timed out") as Promise<UsageStatusSummary>,
        callGatewayMethod(
          target,
          "usage.cost",
          { days: rangeDays[range] },
          15_000,
          "usage.cost timed out",
        ) as Promise<CostUsageSummary>,
      ]);

      setStatusSummary(status.status === "fulfilled" ? status.value : null);
      setCostSummary(cost.status === "fulfilled" ? cost.value : null);
      setLastRefresh(new Date());

      if (status.status === "rejected" && cost.status === "rejected") {
        throw new Error(
          [status.reason, cost.reason]
            .map((reason) => (reason instanceof Error ? reason.message : String(reason)))
            .join(" | "),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totals = costSummary?.totals ?? {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    totalCost: 0,
    missingCostEntries: 0,
  };

  const providerCount = statusSummary?.providers.length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Usage</h2>
          <p className="text-sm text-muted-foreground">
            Real gateway usage totals plus provider quota windows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {(Object.keys(rangeLabel) as DateRange[]).map((key) => (
          <Button
            key={key}
            variant={range === key ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(key)}
            disabled={loading}
          >
            {rangeLabel[key]}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(totals.totalTokens)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatTokens(totals.input)} in / {formatTokens(totals.output)} out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Estimated Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(totals.totalCost)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.missingCostEntries > 0
                ? `${totals.missingCostEntries} entries were estimated or missing cost metadata`
                : "Based on recorded/estimated session usage"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providerCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Provider quota windows available from the gateway
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Provider quota windows</CardTitle>
          </CardHeader>
          <CardContent>
            {!statusSummary || statusSummary.providers.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium">No provider usage data yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect provider credentials in the gateway to populate this panel.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {statusSummary.providers.map((provider) => (
                  <div key={provider.provider} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{provider.displayName}</div>
                        <div className="text-xs text-muted-foreground">{provider.provider}</div>
                      </div>
                      {provider.plan && <Badge variant="outline">{provider.plan}</Badge>}
                    </div>
                    {provider.error ? (
                      <div className="text-xs text-destructive">{provider.error}</div>
                    ) : provider.windows.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No active quota windows reported.</div>
                    ) : (
                      provider.windows.map((window) => (
                        <div key={`${provider.provider}-${window.label}`} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{window.label}</span>
                            <span>{Math.round(window.usedPercent)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.max(0, Math.min(100, window.usedPercent))}%` }}
                            />
                          </div>
                          {window.resetAt && (
                            <div className="text-[11px] text-muted-foreground">
                              Resets {new Date(window.resetAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily cost breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {!costSummary || costSummary.daily.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium">No session cost data yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  The gateway will populate this once chat sessions produce usage records.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {costSummary.daily.map((day) => (
                  <div key={day.date} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{day.date}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTokens(day.totalTokens)} tokens
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs">{formatCost(day.totalCost)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTokens(day.input)} in / {formatTokens(day.output)} out
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
