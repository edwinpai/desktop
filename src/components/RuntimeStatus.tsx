/**
 * RuntimeStatus - Show EdwinPAI runtime environment status
 *
 * Checks if Node.js and EdwinPAI are installed, shows installation
 * status and readiness for gateway startup.
 */

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  Terminal,
  Wifi,
} from "lucide-react";
import { readConfig } from "@/lib/config";

interface RuntimeInfo {
  nodeAvailable: boolean;
  nodeVersion: string | null;
  edwinpaiAvailable: boolean;
  edwinpaiVersion: string | null;
  edwinpaiPath: string | null;
  bundledRuntime: boolean;
  ready: boolean;
}

export function RuntimeStatus() {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRemoteGateway, setIsRemoteGateway] = useState(false);
  const [gatewayLabel, setGatewayLabel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [status, config] = await Promise.all([
          invoke<RuntimeInfo>("check_runtime"),
          readConfig().catch(() => null),
        ]);
        setRuntime(status);

        // Check if connected to remote gateway
        if (config?.gatewayUrl) {
          try {
            const url = new URL(config.gatewayUrl);
            const isLocal =
              url.hostname === "localhost" || url.hostname === "127.0.0.1";
            setIsRemoteGateway(!isLocal);
            if (!isLocal) {
              setGatewayLabel(`${url.hostname}:${url.port || "18789"}`);
            }
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        console.error("Failed to check runtime:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">
            Checking runtime...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (!runtime) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Local Runtime
            </CardTitle>
            <CardDescription>
              {isRemoteGateway
                ? "Local runtime status (connected to remote gateway)"
                : "Runtime environment for running the EdwinPAI gateway locally"}
            </CardDescription>
          </div>
          {isRemoteGateway && gatewayLabel ? (
            <Badge variant="default" className="bg-green-600 text-white gap-1">
              <Wifi className="h-3 w-3" /> {gatewayLabel}
            </Badge>
          ) : (
            <Badge variant={runtime.ready ? "default" : "destructive"}>
              {runtime.ready ? (
                <>
                  <CheckCircle className="h-4 w-4 inline text-green-500 mr-1" />
                  Ready
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 inline text-red-500 mr-1" />
                  Not Ready
                </>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Node.js */}
        <div className="flex items-center justify-between py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Node.js</span>
          </div>
          <div className="flex items-center gap-2">
            {runtime.nodeAvailable ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">
                  {runtime.nodeVersion}
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">Not installed</span>
              </>
            )}
          </div>
        </div>

        {/* EdwinPAI */}
        <div className="flex items-center justify-between py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">EdwinPAI Gateway</span>
          </div>
          <div className="flex items-center gap-2">
            {runtime.edwinpaiAvailable ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">
                  {runtime.edwinpaiVersion || "installed"}
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">Not found</span>
              </>
            )}
          </div>
        </div>

        {/* Path */}
        {runtime.edwinpaiPath && (
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-muted-foreground">Path</span>
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
              {runtime.edwinpaiPath}
            </span>
          </div>
        )}

        {/* Bundled Runtime */}
        {runtime.bundledRuntime && (
          <div className="flex items-center justify-between py-2 border-t border-border/50">
            <span className="text-sm">Bundled Runtime</span>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">
                ~/.edwinpai/runtime/
              </span>
            </div>
          </div>
        )}

        {/* Not ready guidance — only show as error for local gateway */}
        {!runtime.ready && !isRemoteGateway && (
          <div className="mt-4 p-3 rounded-md bg-destructive/10 text-sm">
            <p className="font-medium text-destructive mb-1">
              Gateway cannot start locally
            </p>
            <p className="text-muted-foreground">
              {!runtime.nodeAvailable
                ? "Node.js is required. Install from nodejs.org (v22+ recommended)."
                : "EdwinPAI gateway binary not found. Install with: npm install -g edwinpai"}
            </p>
          </div>
        )}
        {!runtime.ready && isRemoteGateway && (
          <div className="mt-4 p-3 rounded-md bg-muted text-sm">
            <p className="text-muted-foreground">
              Local runtime not installed — not needed when using a remote
              gateway.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
