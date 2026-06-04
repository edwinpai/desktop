/**
 * ProviderSettings - Configure AI provider API keys
 *
 * Stores keys in Desktop Vault / OS keychain by default.
 * Writes provider metadata (not raw keys) to the connected gateway via config.patch.
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// Alert removed — target label replaces old warning banner
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle, RefreshCw } from "lucide-react";
import { readConfig } from "@/lib/config";
import { vaultCredentialForProvider } from "@/lib/vault-credentials";
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
  source: "gateway" | "vault" | "env";
  vaultCredentialId?: string;
}

const PROVIDERS = [
  { value: "openai-codex", label: "OpenAI Codex OAuth (ChatGPT)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI API key" },
  { value: "google", label: "Google (Gemini)" },
  { value: "openrouter", label: "OpenRouter" },
];


export function ProviderSettings() {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("openai-codex");
  const [apiKey, setApiKey] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isOAuthLogin, setIsOAuthLogin] = useState(false);
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
            const descriptor = vaultCredentialForProvider(name);
            const isVaultCredential = key === descriptor.id;
            entries.push({
              provider: name,
              hasKey: !!key,
              // Gateway should only ever store Vault credential ids or placeholders here.
              maskedKey: key ? `vault:${key}` : undefined,
              source: "gateway",
              vaultCredentialId: isVaultCredential ? descriptor.id : undefined,
            });
          }
        }
      }

      // Merge with Desktop Vault (metadata only; no secrets).
      try {
        const vaultEntries = await invoke<
          { id: string; provider: string; entryType: string }[]
        >("vault_list", { profileId: "default" });
        for (const provider of PROVIDERS.map((p) => p.value)) {
          const descriptor = vaultCredentialForProvider(provider);
          const has = vaultEntries.some((e) => e.id === descriptor.id);
          if (has && !entries.find((e) => e.provider === provider)) {
            entries.push({
              provider,
              hasKey: true,
              maskedKey: `vault:${descriptor.id}`,
              source: "vault",
              vaultCredentialId: descriptor.id,
            });
          }
        }
      } catch {
        // Vault providers unavailable
      }

      setProviders(entries);
      setError(null);
    } catch (err) {
      console.error("Failed to load providers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [buildTarget]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const patchProviderMetadata = useCallback(
    async (provider: string) => {
      const target = await buildTarget();
      const vaultCredential = vaultCredentialForProvider(provider);
      const providerPatch =
        vaultCredential.provider === "openai-codex"
          ? {
              baseUrl: "https://chatgpt.com/backend-api",
              api: "openai-codex-responses",
              apiKey: vaultCredential.id,
              auth: vaultCredential.authMode ?? "oauth",
              models: [
                {
                  id: "gpt-5.5",
                  name: "GPT-5.5",
                  reasoning: true,
                  input: ["text", "image"],
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                  contextWindow: 272000,
                  maxTokens: 128000,
                },
              ],
            }
          : {
              apiKey: vaultCredential.id,
              auth: vaultCredential.authMode ?? "api-key",
            };

      await patchGatewayConfig(target, {
        ...(vaultCredential.defaultModel
          ? {
              agents: {
                defaults: { model: { primary: vaultCredential.defaultModel } },
              },
            }
          : {}),
        models: {
          providers: {
            [vaultCredential.provider]: providerPatch,
          },
        },
      });
    },
    [buildTarget],
  );

  const handleOpenAICodexOAuthLogin = async () => {
    setIsOAuthLogin(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await invoke<{
        credentialId: string;
        accountId: string;
        expires: number;
      }>("login_openai_codex_oauth_to_vault", {
        profileId: "default",
      });
      await patchProviderMetadata("openai-codex");
      setSuccess(
        `OpenAI Codex OAuth connected as ${result.accountId}. Stored in Desktop Vault as ${result.credentialId}; ${gatewayLabel} metadata updated.`,
      );
      await loadProviders();
    } catch (err) {
      setError(
        `OpenAI Codex OAuth failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsOAuthLogin(false);
    }
  };

  const handleImportOpenAICodexOAuth = async () => {
    setIsImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await invoke<{
        imported: boolean;
        credentialId: string;
        profileId: string;
        removedSource: boolean;
      }>("import_openai_codex_oauth_profile_to_vault", {
        profileId: "default",
        removeSource: true,
      });
      await patchProviderMetadata("openai-codex");
      setSuccess(
        `Imported ${result.profileId} into Desktop Vault as ${result.credentialId}; legacy source ${result.removedSource ? "removed" : "kept"}.`,
      );
      await loadProviders();
    } catch (err) {
      setError(
        `Failed to import OpenAI Codex OAuth profile: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddProvider = async () => {
    const vaultCredential = vaultCredentialForProvider(selectedProvider);
    const isOAuthProvider = vaultCredential.authMode === "oauth";
    if (!isOAuthProvider && !apiKey.trim()) {
      setError("API key is required");
      return;
    }
    if (isOAuthProvider && !apiKey.trim()) {
      setError(
        "Desktop OAuth flow is not wired yet. Use this provider to patch metadata only after importing/storing the OAuth payload in Vault.",
      );
      return;
    }

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      await invoke("vault_store", {
        profileId: "default",
        id: vaultCredential.id,
        name: vaultCredential.name,
        entryType: vaultCredential.entryType,
        provider: vaultCredential.provider,
        credential: apiKey.trim(),
        metadata: {
          source: "provider-settings",
          gatewayKind: isRemoteGateway ? "remote" : "local",
          authMode: vaultCredential.authMode ?? "api-key",
        },
      });

      // Write provider metadata only. Raw API keys/OAuth tokens belong in Desktop Vault.
      await patchProviderMetadata(selectedProvider);

      setApiKey("");
      setSuccess(
        `${vaultCredential.name} saved to Desktop Vault. ${gatewayLabel} metadata updated without raw secrets.`,
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

  const selectedVaultCredential = vaultCredentialForProvider(selectedProvider);
  const selectedProviderIsOAuth = selectedVaultCredential.authMode === "oauth";

  const handleRemoveProvider = async (entry: ProviderEntry) => {
    setError(null);
    setSuccess(null);

    try {
      const descriptor = vaultCredentialForProvider(entry.provider);
      const credentialId = entry.vaultCredentialId ?? descriptor.id;
      const removedVault = await invoke<boolean>("vault_delete", {
        profileId: "default",
        id: credentialId,
      }).catch(() => false);

      let removedGateway = false;
      if (entry.source === "gateway") {
        const target = await buildTarget();
        await patchGatewayConfig(target, {
          models: { providers: { [entry.provider]: null } },
        });
        removedGateway = true;
      }

      setSuccess(
        `${entry.provider} removed${removedVault ? " from Desktop Vault" : ""}${removedGateway ? ` and ${gatewayLabel} metadata` : ""}.`,
      );
      await loadProviders();
    } catch (err) {
      setError(
        `Failed to remove provider: ${err instanceof Error ? err.message : String(err)}`,
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
              Configure API keys for AI model providers. At least one provider
              is required for chat.
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
            Configuring providers on:{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
              {gatewayLabel}
            </code>
            {isRemoteGateway && (
              <Badge variant="outline" className="ml-2 text-xs">
                remote
              </Badge>
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
                    {p.source === "vault" && (
                      <Badge variant="outline" className="text-xs">
                        vault
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveProvider(p)}
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
          <Label>Configure Provider</Label>
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
            {!selectedProviderIsOAuth && (
              <>
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
              </>
            )}
          </div>
          {selectedProvider === "openai-codex" && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
              <p className="text-muted-foreground">
                Sign in with ChatGPT. Desktop opens the OAuth flow, stores the
                resulting token payload in OS-backed Vault as
                <code className="mx-1">openai-codex-oauth</code>, and patches
                gateway metadata without raw secrets.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleOpenAICodexOAuthLogin}
                  disabled={isOAuthLogin || isImporting}
                >
                  {isOAuthLogin ? "Waiting for browser..." : "Sign in with ChatGPT"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportOpenAICodexOAuth}
                  disabled={isImporting || isOAuthLogin}
                  title="Only needed if you previously authenticated with the legacy CLI."
                >
                  {isImporting
                    ? "Importing..."
                    : "Import legacy CLI profile"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Feedback */}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
      </CardContent>
    </Card>
  );
}
