/**
 * GatewayConfigCard — Configure the connected gateway's settings
 *
 * Reads the gateway's config via WebSocket config.get and allows
 * updating port, bind mode, and auth token via config.patch.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  Save,
  AlertCircle,
  Play,
  Square,
  RotateCw,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  fetchGatewayConfig,
  patchGatewayConfig,
  inferGatewayKind,
  type GatewayTarget,
} from "@/lib/gateway-context";

interface GatewayConfigCardProps {
  gatewayUrl: string;
  gatewayToken: string;
}

interface GatewayState {
  port: number;
  bind: string; // "loopback" | "lan" | "tailnet" | "auto" | "custom"
  authToken: string;
  isLoading: boolean;
  error: string | null;
  hasChanges: boolean;
  isSaving: boolean;
  saveResult: { ok: boolean; message: string } | null;
}

function normalizeBindForUi(bind: string | undefined): string {
  if (!bind) return "loopback";
  if (bind === "localhost") return "loopback";
  if (bind === "tailscale") return "tailnet";
  return bind;
}

export function GatewayConfigCard({
  gatewayUrl,
  gatewayToken,
}: GatewayConfigCardProps) {
  const [state, setState] = useState<GatewayState>({
    port: 18789,
    bind: "loopback",
    authToken: "",
    isLoading: true,
    error: null,
    hasChanges: false,
    isSaving: false,
    saveResult: null,
  });

  const [gatewayRunning, setGatewayRunning] = useState<boolean | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<string | null>(null);

  const target: GatewayTarget = {
    url: gatewayUrl || "http://localhost:18789",
    token: gatewayToken || undefined,
    kind: inferGatewayKind(gatewayUrl || "http://localhost:18789"),
  };

  const fetchConfig = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const config = await fetchGatewayConfig(target);
      const gw = (config.gateway ?? {}) as Record<string, unknown>;
      const auth = (gw.auth ?? {}) as Record<string, unknown>;

      setState((prev) => ({
        ...prev,
        port: (gw.port as number) ?? 18789,
        bind: normalizeBindForUi(gw.bind as string | undefined),
        authToken: (auth.token as string) ?? "",
        isLoading: false,
        hasChanges: false,
      }));
      setGatewayRunning(true);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch config",
      }));
      setGatewayRunning(false);
    }
  }, [gatewayUrl, gatewayToken]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setState((prev) => ({ ...prev, isSaving: true, saveResult: null }));
    try {
      const patch: Record<string, unknown> = {
        gateway: {
          port: state.port,
          bind: state.bind,
          auth: state.authToken
            ? { mode: "token", token: state.authToken }
            : undefined,
        },
      };

      await patchGatewayConfig(target, patch);
      setState((prev) => ({
        ...prev,
        isSaving: false,
        hasChanges: false,
        saveResult: {
          ok: true,
          message: "Saved! Gateway will restart to apply changes.",
        },
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        saveResult: {
          ok: false,
          message: err instanceof Error ? err.message : "Failed to save config",
        },
      }));
    }
  };

  const handleLifecycle = async (action: "start" | "stop" | "restart") => {
    setLifecycleAction(action);
    try {
      if (action === "start") {
        await invoke("start_gateway_real", { port: state.port });
        setGatewayRunning(true);
        setTimeout(fetchConfig, 2000);
      } else if (action === "stop") {
        await invoke("stop_gateway_real");
        setGatewayRunning(false);
      } else {
        await invoke("stop_gateway_real");
        await new Promise((resolve) => setTimeout(resolve, 500));
        await invoke("start_gateway_real", { port: state.port });
        setGatewayRunning(true);
        setTimeout(fetchConfig, 3000);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error:
          err instanceof Error ? err.message : `Failed to ${action} gateway`,
      }));
    }
    setLifecycleAction(null);
  };

  if (state.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gateway Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Fetching gateway config...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gateway Configuration</CardTitle>
            <CardDescription>
              Configure the connected gateway&apos;s network and auth settings
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {gatewayRunning !== null && (
              <Badge variant={gatewayRunning ? "default" : "destructive"}>
                {gatewayRunning ? "Running" : "Stopped"}
              </Badge>
            )}
            {state.hasChanges && (
              <Badge variant="outline" className="text-blue-600">
                Unsaved
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Gateway Lifecycle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLifecycle("start")}
            disabled={lifecycleAction !== null || gatewayRunning === true}
          >
            {lifecycleAction === "start" ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Play className="size-4 mr-1" />
            )}
            Start
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLifecycle("stop")}
            disabled={lifecycleAction !== null || gatewayRunning === false}
          >
            {lifecycleAction === "stop" ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Square className="size-4 mr-1" />
            )}
            Stop
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLifecycle("restart")}
            disabled={lifecycleAction !== null || gatewayRunning === false}
          >
            {lifecycleAction === "restart" ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <RotateCw className="size-4 mr-1" />
            )}
            Restart
          </Button>
        </div>

        {/* Port */}
        <div className="space-y-2">
          <Label htmlFor="gw-port">Port</Label>
          <Input
            id="gw-port"
            type="number"
            min={1024}
            max={65535}
            value={state.port}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                setState((prev) => ({ ...prev, port: val, hasChanges: true }));
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Network port the gateway listens on (default: 18789)
          </p>
        </div>

        {/* Bind Mode */}
        <div className="space-y-2">
          <Label htmlFor="gw-bind">Bind Mode</Label>
          <Select
            value={state.bind}
            onValueChange={(value) => {
              setState((prev) => ({ ...prev, bind: value, hasChanges: true }));
            }}
          >
            <SelectTrigger id="gw-bind">
              <SelectValue placeholder="Select bind mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loopback">Localhost only</SelectItem>
              <SelectItem value="lan">LAN (all interfaces)</SelectItem>
              <SelectItem value="tailnet">Tailscale</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {state.bind === "loopback" && "Only accessible from this machine."}
            {state.bind === "lan" &&
              "Accessible from any device on your local network."}
            {state.bind === "tailnet" &&
              "Accessible via Tailscale mesh network."}
          </p>
        </div>

        {/* Gateway Auth Token */}
        <div className="space-y-2">
          <Label htmlFor="gw-auth-token">Gateway Auth Token</Label>
          <Input
            id="gw-auth-token"
            type="password"
            value={state.authToken}
            onChange={(e) => {
              setState((prev) => ({
                ...prev,
                authToken: e.target.value,
                hasChanges: true,
              }));
            }}
            placeholder="No token (open access)"
          />
          <p className="text-xs text-muted-foreground">
            Token required for all gateway connections. Leave empty for no
            authentication.
          </p>
        </div>

        {/* Save / Refresh */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!state.hasChanges || state.isSaving}
          >
            {state.isSaving ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Save className="size-4 mr-1" />
            )}
            Apply to Gateway
          </Button>
          <Button variant="outline" size="sm" onClick={fetchConfig}>
            <RefreshCw className="size-4 mr-1" />
            Refresh
          </Button>
        </div>

        {state.saveResult && (
          <Alert variant={state.saveResult.ok ? "default" : "destructive"}>
            <AlertDescription>{state.saveResult.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
