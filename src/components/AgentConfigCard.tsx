/**
 * AgentConfigCard - Configure the agent's model, memory, and behavior settings
 *
 * Reads from and writes to the connected gateway's config via WebSocket.
 * Settings: primary model, fallback models, memory search toggle/provider.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bot,
  Brain,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  fetchGatewayConfig,
  listGatewayModels,
  patchGatewayConfig,
  resolveToken,
  type GatewayModelChoice,
  type GatewayTarget,
} from "@/lib/gateway-context";

interface AgentConfig {
  model: string;
  fallbacks: string;
  memoryEnabled: boolean;
  memoryProvider: string;
}

const DEFAULT_MODELS = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4-5",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
];

interface AgentConfigCardProps {
  gatewayUrl?: string;
  gatewayToken?: string;
}

export function AgentConfigCard({
  gatewayUrl,
  gatewayToken,
}: AgentConfigCardProps) {
  const [config, setConfig] = useState<AgentConfig>({
    model: "",
    fallbacks: "",
    memoryEnabled: true,
    memoryProvider: "auto",
  });
  const [modelOptions, setModelOptions] = useState<GatewayModelChoice[]>([]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "saving" | "saved" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const buildTarget = useCallback(async (): Promise<GatewayTarget | null> => {
    const url = gatewayUrl || "http://localhost:18789";
    const token = gatewayToken || (await resolveToken());
    const { inferGatewayKind } = await import("@/lib/gateway-context");
    return { url, token: token || undefined, kind: inferGatewayKind(url) };
  }, [gatewayUrl, gatewayToken]);

  const loadConfig = useCallback(async () => {
    const gateway = await buildTarget();
    if (!gateway) return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      const gwConfig = await fetchGatewayConfig(gateway);
      if (gwConfig) {
        const defaults = (gwConfig as Record<string, unknown>).agents as
          | Record<string, unknown>
          | undefined;
        const agentDefaults = defaults?.defaults as
          | Record<string, unknown>
          | undefined;
        const modelConfig = agentDefaults?.model as
          | Record<string, unknown>
          | undefined;
        const memorySearch = agentDefaults?.memorySearch as
          | Record<string, unknown>
          | undefined;

        setConfig({
          model: (modelConfig?.primary as string) ?? "",
          fallbacks: Array.isArray(modelConfig?.fallbacks)
            ? (modelConfig.fallbacks as string[]).join(", ")
            : "",
          memoryEnabled: memorySearch?.enabled !== false,
          memoryProvider: (memorySearch?.provider as string) ?? "auto",
        });
      }
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to load config");
    }
  }, [buildTarget]);

  const loadModels = useCallback(async () => {
    const gateway = await buildTarget();
    if (!gateway) return;
    try {
      const models = await listGatewayModels(gateway);
      setModelOptions(models);
    } catch {
      setModelOptions([]);
    }
  }, [buildTarget]);

  useEffect(() => {
    loadConfig();
    loadModels();
  }, [loadConfig, loadModels]);

  const availableModels = useMemo(() => {
    const list = modelOptions.length
      ? modelOptions
      : DEFAULT_MODELS.map((m) => ({ id: m, name: m, provider: "" }));
    const hasCurrent = config.model && list.some((m) => m.id === config.model);
    const withCurrent = !hasCurrent && config.model
      ? [{ id: config.model, name: config.model, provider: "" }, ...list]
      : list;

    // Gateways can report the same provider/model from multiple sources. Dedupe
    // by rendered value so React/Radix Select keys stay stable and the console
    // remains useful for real errors.
    return Array.from(
      new Map(withCurrent.map((model) => [model.id, model])).values(),
    );
  }, [modelOptions, config.model]);

  const handleSave = async () => {
    const gateway = await buildTarget();
    if (!gateway) return;
    setStatus("saving");
    setErrorMsg(null);

    const fallbacksArray = config.fallbacks
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const patch: Record<string, unknown> = {
      agents: {
        defaults: {
          model: {
            ...(config.model ? { primary: config.model } : {}),
            ...(fallbacksArray.length ? { fallbacks: fallbacksArray } : {}),
          },
          memorySearch: {
            enabled: config.memoryEnabled,
            ...(config.memoryProvider !== "auto"
              ? { provider: config.memoryProvider }
              : {}),
          },
        },
      },
    };

    try {
      await patchGatewayConfig(gateway, patch);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to save config");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Agent Configuration</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            loadConfig();
            loadModels();
          }}
          disabled={status === "loading"}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1 ${status === "loading" ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Status banner */}
      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4" />
          {errorMsg}
        </div>
      )}
      {status === "saved" && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 rounded-md px-3 py-2">
          <CheckCircle className="h-4 w-4" />
          Configuration saved. Gateway will reload.
        </div>
      )}

      {/* Model Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Bot className="h-4 w-4" />
          Model
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary-model">Primary Model</Label>
          <Select
            value={config.model || undefined}
            onValueChange={(value) =>
              setConfig((prev) => ({ ...prev, model: value }))
            }
          >
            <SelectTrigger id="primary-model">
              <SelectValue placeholder="Select a model..." />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.provider ? ` (${m.provider})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Default model for new sessions. Per-session overrides are available
            in Chat.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fallback-models">Fallback Models</Label>
          <Input
            id="fallback-models"
            value={config.fallbacks}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, fallbacks: e.target.value }))
            }
            placeholder="anthropic/claude-haiku-4-5, openai/gpt-4o-mini"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated. Used when the primary model fails or is
            rate-limited.
          </p>
        </div>
      </div>

      {/* Memory Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain className="h-4 w-4" />
          Memory Search
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="memory-enabled">Enable Memory Search</Label>
            <p className="text-xs text-muted-foreground">
              Agent can recall prior context from workspace files.
            </p>
          </div>
          <Switch
            id="memory-enabled"
            checked={config.memoryEnabled}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, memoryEnabled: checked }))
            }
          />
        </div>

        {config.memoryEnabled && (
          <div className="space-y-2">
            <Label htmlFor="memory-provider">Embedding Provider</Label>
            <Select
              value={config.memoryProvider}
              onValueChange={(value) =>
                setConfig((prev) => ({ ...prev, memoryProvider: value }))
              }
            >
              <SelectTrigger id="memory-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto (use available API key)
                </SelectItem>
                <SelectItem value="openai">
                  OpenAI (text-embedding-3-small)
                </SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="local">
                  Local (no API key needed, ~300MB model)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Embedding model for semantic memory search. Local runs on CPU with
              no external calls.
            </p>
          </div>
        )}
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={status === "saving"}
        className="w-full"
      >
        <Save className="h-4 w-4 mr-2" />
        {status === "saving" ? "Applying..." : "Apply to Gateway"}
      </Button>
    </div>
  );
}
