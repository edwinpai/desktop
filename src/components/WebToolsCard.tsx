/**
 * WebToolsCard — Configure web search (Brave) and fetch settings
 *
 * Reads tools.web.search config from the connected gateway via config.get,
 * allows setting/updating the Brave Search API key, and pushes changes
 * via config.patch.
 */

import { useMemo, useState, useEffect, useCallback } from "react";
import { Loader2, Save, Search, ExternalLink } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  fetchGatewayConfig,
  patchGatewayConfig,
  inferGatewayKind,
  type GatewayTarget,
} from "@/lib/gateway-context";

interface WebToolsCardProps {
  gatewayUrl: string;
  gatewayToken: string;
}

export function WebToolsCard({ gatewayUrl, gatewayToken }: WebToolsCardProps) {
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [searchApiKey, setSearchApiKey] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const target = useMemo<GatewayTarget>(() => {
    const url = gatewayUrl || "http://localhost:18789";
    return {
      url,
      token: gatewayToken || undefined,
      kind: inferGatewayKind(url),
    };
  }, [gatewayToken, gatewayUrl]);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const config = await fetchGatewayConfig(target);
      const tools = (config.tools ?? {}) as Record<string, unknown>;
      const web = (tools.web ?? {}) as Record<string, unknown>;
      const search = (web.search ?? {}) as Record<string, unknown>;

      setSearchEnabled(search.enabled !== false && !!search.apiKey);
      setHasExistingKey(!!search.apiKey);
      setSearchApiKey(""); // Don't show the actual key
      setIsLoading(false);
    } catch {
      // Gateway not reachable or no config — show defaults
      setIsLoading(false);
    }
  }, [target]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchConfig();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const patch: Record<string, unknown> = {
        tools: {
          web: {
            search: {
              enabled: searchEnabled,
              ...(searchApiKey.trim() ? { apiKey: searchApiKey.trim() } : {}),
            },
          },
        },
      };

      await patchGatewayConfig(target, patch);
      setSaveResult({
        ok: true,
        message: "Saved! Web search settings updated.",
      });
      setHasChanges(false);
      if (searchApiKey.trim()) {
        setHasExistingKey(true);
        setSearchApiKey("");
      }
    } catch (err) {
      setSaveResult({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Web Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading web tools config...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="size-5" />
          Web Tools
        </CardTitle>
        <CardDescription>
          Enable web search for your agent using Brave Search API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="web-search-enabled">Web Search</Label>
            <p className="text-sm text-muted-foreground">
              Let your agent search the web with the <code>web_search</code>{" "}
              tool
            </p>
          </div>
          <Switch
            id="web-search-enabled"
            checked={searchEnabled}
            onCheckedChange={(checked) => {
              setSearchEnabled(checked);
              setHasChanges(true);
            }}
          />
        </div>

        {searchEnabled && (
          <div className="space-y-2">
            <Label htmlFor="brave-api-key">Brave Search API Key</Label>
            <Input
              id="brave-api-key"
              type="password"
              value={searchApiKey}
              onChange={(e) => {
                setSearchApiKey(e.target.value);
                setHasChanges(true);
              }}
              placeholder={
                hasExistingKey
                  ? "Key configured — leave blank to keep"
                  : "BSA..."
              }
            />
            <p className="text-xs text-muted-foreground">
              Get a free API key at{" "}
              <a
                href="https://brave.com/search/api/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                brave.com/search/api
                <ExternalLink className="size-3" />
              </a>
              . Or set <code>BRAVE_API_KEY</code> in the gateway environment.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Save className="size-4 mr-1" />
            )}
            Apply to Gateway
          </Button>
        </div>

        {saveResult && (
          <Alert variant={saveResult.ok ? "default" : "destructive"}>
            <AlertDescription>{saveResult.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
