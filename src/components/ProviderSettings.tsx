/**
 * ProviderSettings - Configure AI provider API keys
 *
 * Writes keys to the connected gateway via config.patch (models.providers.<name>.apiKey).
 * Also writes to local auth-profiles.json as a fallback for local gateways.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Alert removed — target label replaces old warning banner
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle, RefreshCw } from "lucide-react";
import { readConfig } from "@/lib/config";
import {
  fetchGatewayConfig,
  patchGatewayConfig,
  resolveToken,
  inferGatewayKind,
  type GatewayTarget,
} from "@/lib/gateway-context";

interface ProviderEntry {
  provider: string;
  hasKey: boolean;
  maskedKey?: string;
  source: "gateway" | "local" | "env";
}

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "google", label: "Google (Gemini)" },
  { value: "openrouter", label: "OpenRouter" },
];

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}

export function ProviderSettings() {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isRemoteGateway, setIsRemoteGateway] = useState(false);
  const [gatewayLabel, setGatewayLabel] = useState<string>("localhost");
  const [isLoading, setIsLoading] = useState(false);

  const buildTarget = useCallback(async (): Promise<GatewayTarget> => {
    const config = await readConfig().catch(() => null);
    const url = config?.gatewayUrl || "http://localhost:18789";
    const token = config?.gatewayToken || (await resolveToken());
    return { url, token: token || undefined, kind: inferGatewayKind(url) };
  }, []);

  const loadProviders = useCallback(async () => {
    setIsLoading(true);
    try {
      const target = await buildTarget();

      // Check if remote and set label
      try {
        const urlObj = new URL(target.url);
        const isLocal =
          urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1";
        setIsRemoteGateway(!isLocal);
        setGatewayLabel(`${urlObj.hostname}:${urlObj.port || "18789"}`);
      } catch {
        // ignore
      }

      // Try to load from gateway config first
      const gwConfig = await fetchGatewayConfig(target).catch(() => null);
      const entries: ProviderEntry[] = [];

      if (gwConfig) {
        const modelsConfig = (gwConfig as Record<string, unknown>).models as
          | Record<string, unknown>
          | undefined;
        const providersConfig = modelsConfig?.providers as
          | Record<string, Record<string, unknown>>
          | undefined;

        if (providersConfig) {
          for (const [name, config] of Object.entries(providersConfig)) {
            const key = config?.apiKey as string | undefined;
            entries.push({
              provider: name,
              hasKey: !!key,
              maskedKey: key ? maskKey(key) : undefined,
              source: "gateway",
            });
          }
        }
      }

      // Merge with local auth-profiles (for providers not in gateway config)
      try {
        const result = await invoke<{ providers: { provider: string; maskedKey: string }[] }>(
          "list_providers",
        );
        for (const local of result.providers) {
          if (!entries.find((e) => e.provider === local.provider)) {
            entries.push({
              provider: local.provider,
              hasKey: true,
              maskedKey: local.maskedKey,
              source: "local",
            });
          }
        }
      } catch {
        // Local providers unavailable
      }

      setProviders(entries);
    } catch (err) {
      console.error("Failed to load providers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [buildTarget]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleAddProvider = async () => {
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const target = await buildTarget();

      // Write to gateway config via config.patch (primary path)
      const patch = {
        models: {
          providers: {
            [selectedProvider]: {
              apiKey: apiKey.trim(),
            },
          },
        },
      };

      await patchGatewayConfig(target, patch);

      // Only write to local auth-profiles for local gateways
      if (!isRemoteGateway) {
        try {
          await invoke("add_provider", {
            request: {
              provider: selectedProvider,
              apiKey: apiKey.trim(),
              label: null,
            },
          });
        } catch {
          // Local save is best-effort for local gateways
        }
      }

      setApiKey("");
      setSuccess(
        `${selectedProvider} API key saved to ${gatewayLabel}. Config applied.`,
      );
      await loadProviders();
    } catch (err) {
      setError(
        `Failed to save to gateway (${gatewayLabel}): ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveProvider = async (provider: string) => {
    setError(null);
    setSuccess(null);

    try {
      const target = await buildTarget();

      // Remove from gateway config
      // config.patch with null/empty to clear — but gateway doesn't support deleting keys via patch
      // Instead, set apiKey to empty string
      const patch = {
        models: {
          providers: {
            [provider]: {
              apiKey: "",
            },
          },
        },
      };

      await patchGatewayConfig(target, patch);

      // Only remove from local auth-profiles for local gateways
      if (!isRemoteGateway) {
        try {
          const result = await invoke<{ providers: { id: string; provider: string }[] }>(
            "list_providers",
          );
          const local = result.providers.find((p) => p.provider === provider);
          if (local) {
            await invoke("remove_provider", { id: local.id });
          }
        } catch {
          // Best effort for local
        }
      }

      setSuccess(`${provider} removed from ${gatewayLabel}.`);
      await loadProviders();
    } catch (err) {
      setError(
        `Failed to remove from gateway (${gatewayLabel}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Providers</CardTitle>
            <CardDescription>
              Configure API keys for AI model providers. At least one provider is
              required for chat.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadProviders}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target label */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>
            Configuring providers on: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{gatewayLabel}</code>
            {isRemoteGateway && (
              <Badge variant="outline" className="ml-2 text-xs">remote</Badge>
            )}
          </span>
        </div>

        {/* Existing providers */}
        {providers.length > 0 && (
          <div className="space-y-2">
            <Label>Configured Providers</Label>
            <div className="space-y-2">
              {providers.map((p) => (
                <div
                  key={p.provider}
                  className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{p.provider}</Badge>
                    <span className="text-sm text-muted-foreground font-mono">
                      {p.maskedKey || "••••••••"}
                    </span>
                    {p.source === "gateway" && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" /> gateway
                      </Badge>
                    )}
                    {p.source === "local" && (
                      <Badge variant="outline" className="text-xs">
                        local only
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveProvider(p.provider)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {providers.length === 0 && !isLoading && (
          <div className="p-4 rounded-md border border-dashed text-center text-sm text-muted-foreground">
            No providers configured. Add an API key to enable chat.
          </div>
        )}

        {/* Add provider form */}
        <div className="pt-2 border-t space-y-3">
          <Label>Add Provider</Label>
          <div className="flex gap-2">
            <Select
              value={selectedProvider}
              onValueChange={setSelectedProvider}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="password"
              placeholder="Paste API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAddProvider}
              disabled={isAdding || !apiKey.trim()}
            >
              {isAdding ? "Saving..." : "Add"}
            </Button>
          </div>
        </div>

        {/* Feedback */}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
      </CardContent>
    </Card>
  );
}
