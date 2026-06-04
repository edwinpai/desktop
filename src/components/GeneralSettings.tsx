import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, XCircle, Loader2, Home, Plug } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfig } from "@/hooks/useConfig";
import { ProviderSettings } from "@/components/ProviderSettings";
import { GatewayConfigCard } from "@/components/GatewayConfigCard";
import { WebToolsCard } from "@/components/WebToolsCard";
import { AgentConfigCard } from "@/components/AgentConfigCard";
import { RuntimeStatus } from "@/components/RuntimeStatus";
import { AppLockSettings } from "@/components/AppLockSettings";
import { TtsSettingsCard } from "@/components/TtsSettingsCard";
import {
  fetchGatewayConfig,
  patchGatewayConfig,
  type GatewayTarget,
} from "@/lib/gateway-context";
import {
  DEFAULT_DESKTOP_CONFIG,
  getVaultNamespace,
  type GatewayProfile,
} from "@/types";
import { APP_VERSION } from "@/lib/app-version";

interface GeneralSettingsProps {
  onSave?: (settings: unknown) => void;
  onModeChange?: (mode: "gateway" | "client") => void;
  currentMode?: "gateway" | "client";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchGatewayConfigWithRetry(target: GatewayTarget) {
  try {
    return await fetchGatewayConfig(target, 8000);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The Settings page may mount while an SSH tunnel has been started but the
    // local forwarding socket is not accepting WebSocket connections yet. Retry
    // once to avoid showing a stale error that immediately clears on Refresh.
    if (
      /WebSocket connection failed|Connection closed|Timed out/i.test(message)
    ) {
      await sleep(750);
      return await fetchGatewayConfig(target, 8000);
    }
    throw err;
  }
}

export function GeneralSettings({
  onSave,
  onModeChange,
  currentMode = "gateway",
}: GeneralSettingsProps) {
  const {
    config,
    update,
    loading: configLoading,
    activeGatewayProfile,
  } = useConfig();
  const resolvedActiveGatewayProfile =
    activeGatewayProfile ??
    config.gatewayProfiles?.[0] ??
    DEFAULT_DESKTOP_CONFIG.gatewayProfiles[0];

  const [gatewayProfiles, setGatewayProfiles] = useState<GatewayProfile[]>(
    config.gatewayProfiles,
  );
  const [activeProfileId, setActiveProfileId] = useState(
    config.activeGatewayProfileId,
  );
  const [profileName, setProfileName] = useState(
    resolvedActiveGatewayProfile.name,
  );
  const [gatewayUrl, setGatewayUrl] = useState(
    resolvedActiveGatewayProfile.gatewayUrl,
  );
  const [gatewayToken, setGatewayToken] = useState(
    resolvedActiveGatewayProfile.gatewayToken,
  );
  const currentGatewayProfile =
    gatewayProfiles.find((profile) => profile.id === activeProfileId) ??
    resolvedActiveGatewayProfile;
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    config.theme ?? "system",
  );
  const [notifications, setNotifications] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    status: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ status: "idle" });
  const [connectionTest, setConnectionTest] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // Gateway security config (remote gateway)
  const [requireSignedRequests, setRequireSignedRequests] =
    useState<boolean>(true);
  const [requireSignedRequestsSource, setRequireSignedRequestsSource] =
    useState<"default" | "explicit">("default");
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setConnectionTest({ status: "testing" });
    const testUrl = gatewayUrl || `http://localhost:18789`;

    try {
      // Use Rust-side HTTP probe (JS fetch blocked by Tauri CSP for cross-origin)
      const probeResult = await invoke<{
        found: boolean;
        url: string | null;
        error: string | null;
      }>(
        "probe_gateway",
        { url: testUrl }, // probe_gateway accepts optional URL override
      );

      if (probeResult.found) {
        // Gateway is reachable via HTTP. Now try WebSocket handshake.
        const wsUrl = testUrl.replace(/^http/, "ws");
        const ws = new WebSocket(wsUrl);
        const testToken = gatewayToken || config.gatewayToken;

        await new Promise<void>((resolve, reject) => {
          const wsTimeout = setTimeout(() => {
            ws.close();
            reject(new Error("WebSocket handshake timed out"));
          }, 5000);

          ws.addEventListener("open", () => {
            ws.send(
              JSON.stringify({
                type: "req",
                id: "test-1",
                method: "connect",
                params: {
                  minProtocol: 3,
                  maxProtocol: 3,
                  client: {
                    id: "edwinpai-macos",
                    displayName: "EdwinPAI Desktop (test)",
                    version: APP_VERSION,
                    platform: navigator.platform || "desktop",
                    mode: "ui",
                  },
                  auth: testToken ? { token: testToken } : undefined,
                },
              }),
            );
          });

          ws.addEventListener("message", (event) => {
            try {
              const frame = JSON.parse(event.data as string);
              if (frame.type === "res") {
                clearTimeout(wsTimeout);
                ws.close();
                if (frame.ok && frame.payload?.type === "hello-ok") {
                  const version = frame.payload.server?.version ?? "unknown";
                  resolve();
                  setConnectionTest({
                    status: "success",
                    message: `Connected! Gateway v${version}`,
                  });
                  setSecurityError(null);
                  window.setTimeout(() => {
                    void refreshSecurityConfig();
                  }, 250);
                } else {
                  reject(new Error(frame.error?.message ?? "Handshake failed"));
                }
              }
            } catch {
              clearTimeout(wsTimeout);
              ws.close();
              reject(new Error("Invalid gateway response"));
            }
          });

          ws.addEventListener("error", () => {
            clearTimeout(wsTimeout);
            reject(new Error("WebSocket connection failed"));
          });
        });
      } else {
        setConnectionTest({
          status: "error",
          message: `Gateway not reachable at ${testUrl}`,
        });
      }
    } catch (err) {
      setConnectionTest({
        status: "error",
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    }
  };

  // Sync from config when it loads
  useEffect(() => {
    if (!configLoading) {
      setGatewayProfiles(config.gatewayProfiles);
      setActiveProfileId(config.activeGatewayProfileId);
      setProfileName(resolvedActiveGatewayProfile.name);
      setGatewayUrl(resolvedActiveGatewayProfile.gatewayUrl);
      setGatewayToken(resolvedActiveGatewayProfile.gatewayToken);
      setTheme(config.theme ?? "system");
    }
  }, [config, configLoading, resolvedActiveGatewayProfile]);

  const syncActiveProfileDraft = (
    nextProfileId: string,
    nextProfiles: GatewayProfile[],
    options?: { markChanged?: boolean },
  ) => {
    const profile = nextProfiles.find(
      (candidate) => candidate.id === nextProfileId,
    ) ??
      nextProfiles[0] ??
      DEFAULT_DESKTOP_CONFIG.gatewayProfiles[0] ?? {
        ...resolvedActiveGatewayProfile,
        id: DEFAULT_DESKTOP_CONFIG.activeGatewayProfileId,
      };

    setGatewayProfiles(nextProfiles);
    setActiveProfileId(profile.id);
    setProfileName(profile.name);
    setGatewayUrl(profile.gatewayUrl);
    setGatewayToken(profile.gatewayToken);
    setConnectionTest({ status: "idle" });
    if (options?.markChanged ?? true) {
      setHasChanges(true);
    }
  };

  const buildActiveProfile = (portOverride?: number): GatewayProfile => {
    const nextName = profileName.trim() || "Unnamed Gateway";
    const existingNamespace = currentGatewayProfile.vaultNamespace;
    const vaultNamespace =
      activeProfileId === "default" &&
      (!existingNamespace || existingNamespace === "default") &&
      nextName !== "Default Gateway"
        ? nextName
        : getVaultNamespace(currentGatewayProfile);

    return {
      id: activeProfileId,
      name: nextName,
      vaultNamespace,
      gatewayUrl,
      gatewayPort:
        portOverride ??
        currentGatewayProfile.gatewayPort ??
        config.gatewayPort ??
        18789,
      gatewayToken,
      ssh: currentGatewayProfile.ssh,
    };
  };

  const replaceActiveProfile = (
    nextProfiles: GatewayProfile[],
    portOverride?: number,
  ) =>
    nextProfiles.map((profile) =>
      profile.id === activeProfileId
        ? buildActiveProfile(portOverride)
        : profile,
    );

  const getGatewayTarget = (): GatewayTarget => ({
    url: gatewayUrl || `http://localhost:${config.gatewayPort ?? 18789}`,
    token: gatewayToken || config.gatewayToken || undefined,
    kind: "local",
  });

  const refreshSecurityConfig = async () => {
    setSecurityError(null);
    setSecurityLoading(true);
    try {
      const target = getGatewayTarget();
      const gwConfig = await fetchGatewayConfigWithRetry(target);

      const security = (gwConfig.security ?? {}) as Record<string, unknown>;
      const raw = security.requireSignedRequests;

      // When unset, the gateway may still enforce by default when BSV auth is enabled.
      if (typeof raw === "boolean") {
        setRequireSignedRequests(raw);
        setRequireSignedRequestsSource("explicit");
      } else {
        // Default UI posture: secure
        setRequireSignedRequests(true);
        setRequireSignedRequestsSource("default");
      }
    } catch (err) {
      setSecurityError(err instanceof Error ? err.message : String(err));
    } finally {
      setSecurityLoading(false);
    }
  };

  // Load security config when gateway target changes.
  // Skip in unit tests (Vitest/JSDOM) where Tauri FS/WebSocket aren’t available.
  useEffect(() => {
    if (configLoading) return;
    if (import.meta.env.MODE === "test") return;
    void refreshSecurityConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoading, gatewayUrl, gatewayToken]);

  const updateRequireSignedRequests = async (value: boolean) => {
    setSecurityError(null);
    setSecurityLoading(true);
    try {
      const target = getGatewayTarget();
      await patchGatewayConfig(target, {
        security: {
          requireSignedRequests: value,
        },
      });
      setRequireSignedRequests(value);
      setRequireSignedRequestsSource("explicit");
    } catch (err) {
      setSecurityError(err instanceof Error ? err.message : String(err));
    } finally {
      setSecurityLoading(false);
    }
  };

  const resetRequireSignedRequests = async () => {
    setSecurityError(null);
    setSecurityLoading(true);
    try {
      const target = getGatewayTarget();
      // JSON merge patch: null deletes the key.
      await patchGatewayConfig(target, {
        security: {
          requireSignedRequests: null,
        },
      });
      setRequireSignedRequests(true);
      setRequireSignedRequestsSource("default");
    } catch (err) {
      setSecurityError(err instanceof Error ? err.message : String(err));
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Parse port from URL
      let port =
        currentGatewayProfile.gatewayPort ?? config.gatewayPort ?? 18789;
      try {
        const url = new URL(gatewayUrl);
        if (url.port) {
          port = parseInt(url.port, 10);
        }
      } catch {
        // keep existing port if URL parse fails
      }

      setSaveStatus({ status: "saving" });
      const nextProfiles = replaceActiveProfile(gatewayProfiles, port);

      await update({
        activeGatewayProfileId: activeProfileId,
        gatewayUrl,
        gatewayPort: port,
        gatewayToken,
        gatewayProfiles: nextProfiles,
        theme,
      });

      setGatewayProfiles(nextProfiles);
      setHasChanges(false);
      setSaveStatus({ status: "saved", message: "Settings saved" });
      await onSave?.({ activeGatewayProfileId: activeProfileId, gatewayUrl, theme });
      window.setTimeout(() => setSaveStatus({ status: "idle" }), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      console.error("Failed to save settings:", err);
      setSaveStatus({ status: "error", message });
    }
  };

  const handleReset = () => {
    const defaultProfile =
      DEFAULT_DESKTOP_CONFIG.gatewayProfiles[0] ?? resolvedActiveGatewayProfile;
    setGatewayProfiles(DEFAULT_DESKTOP_CONFIG.gatewayProfiles);
    setActiveProfileId(DEFAULT_DESKTOP_CONFIG.activeGatewayProfileId);
    setProfileName(defaultProfile.name);
    setGatewayUrl(defaultProfile.gatewayUrl);
    setGatewayToken(defaultProfile.gatewayToken);
    setTheme("system");
    setNotifications(true);
    setAutoScroll(true);
    setHasChanges(true);
  };

  if (configLoading) {
    return <div className="p-6 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="w-full p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage your application preferences
          </p>
        </div>
        {hasChanges && (
          <Badge variant="outline" className="text-blue-600">
            Unsaved changes
          </Badge>
        )}
      </div>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={theme}
              onValueChange={(value: "light" | "dark" | "system") => {
                setTheme(value);
                setHasChanges(true);
                // Apply theme immediately (don't wait for Save)
                const root = document.documentElement;
                if (value === "dark") {
                  root.classList.add("dark");
                } else if (value === "light") {
                  root.classList.remove("dark");
                } else {
                  const prefersDark = window.matchMedia(
                    "(prefers-color-scheme: dark)",
                  ).matches;
                  root.classList.toggle("dark", prefersDark);
                }
              }}
            >
              <SelectTrigger id="theme">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Behavior Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Behavior</CardTitle>
          <CardDescription>
            Configure application behavior and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive desktop notifications
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={(checked) => {
                setNotifications(checked);
                setHasChanges(true);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-scroll">Auto-scroll</Label>
              <p className="text-sm text-muted-foreground">
                Automatically scroll to new messages
              </p>
            </div>
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={(checked) => {
                setAutoScroll(checked);
                setHasChanges(true);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gateway Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Gateway Profiles</CardTitle>
          <CardDescription>
            Save and switch between multiple gateway connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="active-gateway-profile">
              Active Gateway Profile
            </Label>
            <Select
              value={activeProfileId}
              onValueChange={(value) => {
                syncActiveProfileDraft(
                  value,
                  replaceActiveProfile(gatewayProfiles),
                );
              }}
            >
              <SelectTrigger id="active-gateway-profile">
                <SelectValue placeholder="Select gateway profile" />
              </SelectTrigger>
              <SelectContent>
                {gatewayProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Profile Name</Label>
            <Input
              id="profile-name"
              value={profileName}
              onChange={(e) => {
                const nextName = e.target.value;
                setProfileName(nextName);
                setGatewayProfiles(
                  gatewayProfiles.map((profile) =>
                    profile.id === activeProfileId
                      ? { ...profile, name: nextName }
                      : profile,
                  ),
                );
                setHasChanges(true);
              }}
            />
          </div>

          {/* SSH Tunnel Settings */}
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ssh-enabled" className="text-sm font-medium">
                SSH Tunnel
              </Label>
              <Switch
                id="ssh-enabled"
                checked={currentGatewayProfile.ssh?.enabled ?? false}
                onCheckedChange={(checked) => {
                  setGatewayProfiles(
                    gatewayProfiles.map((p) =>
                      p.id === activeProfileId
                        ? {
                            ...p,
                            ssh: {
                              enabled: checked,
                              host: p.ssh?.host ?? "",
                              remotePort: p.ssh?.remotePort ?? 18789,
                              localPort: p.ssh?.localPort ?? 28789,
                            },
                          }
                        : p,
                    ),
                  );
                  setHasChanges(true);
                }}
              />
            </div>
            {currentGatewayProfile.ssh?.enabled && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="ssh-host" className="text-xs">
                    SSH Host (from ~/.ssh/config)
                  </Label>
                  <Input
                    id="ssh-host"
                    placeholder="hostinger-personal"
                    value={currentGatewayProfile.ssh?.host ?? ""}
                    onChange={(e) => {
                      setGatewayProfiles(
                        gatewayProfiles.map((p) =>
                          p.id === activeProfileId && p.ssh
                            ? { ...p, ssh: { ...p.ssh, host: e.target.value } }
                            : p,
                        ),
                      );
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="ssh-remote-port" className="text-xs">
                      Remote Port
                    </Label>
                    <Input
                      id="ssh-remote-port"
                      type="number"
                      value={currentGatewayProfile.ssh?.remotePort ?? 18789}
                      onChange={(e) => {
                        setGatewayProfiles(
                          gatewayProfiles.map((p) =>
                            p.id === activeProfileId && p.ssh
                              ? {
                                  ...p,
                                  ssh: {
                                    ...p.ssh,
                                    remotePort:
                                      parseInt(e.target.value) || 18789,
                                  },
                                }
                              : p,
                          ),
                        );
                        setHasChanges(true);
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="ssh-local-port" className="text-xs">
                      Local Tunnel Port
                    </Label>
                    <Input
                      id="ssh-local-port"
                      type="number"
                      value={currentGatewayProfile.ssh?.localPort ?? 28789}
                      onChange={(e) => {
                        setGatewayProfiles(
                          gatewayProfiles.map((p) =>
                            p.id === activeProfileId && p.ssh
                              ? {
                                  ...p,
                                  ssh: {
                                    ...p.ssh,
                                    localPort:
                                      parseInt(e.target.value) || 28789,
                                  },
                                }
                              : p,
                          ),
                        );
                        setHasChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const profileId = `profile-${Date.now().toString(36)}`;
                const draftProfile: GatewayProfile = {
                  id: profileId,
                  name: "New Gateway",
                  vaultNamespace: profileId,
                  gatewayUrl,
                  gatewayPort: config.gatewayPort ?? 18789,
                  gatewayToken,
                };
                syncActiveProfileDraft(draftProfile.id, [
                  ...replaceActiveProfile(gatewayProfiles),
                  draftProfile,
                ]);
              }}
            >
              New Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (gatewayProfiles.length <= 1) return;
                const remainingProfiles = replaceActiveProfile(
                  gatewayProfiles,
                ).filter((profile) => profile.id !== activeProfileId);
                const nextActiveProfile = remainingProfiles[0];
                if (nextActiveProfile) {
                  syncActiveProfileDraft(
                    nextActiveProfile.id,
                    remainingProfiles,
                  );
                }
              }}
              disabled={gatewayProfiles.length <= 1}
            >
              Delete Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gateway Connection</CardTitle>
          <CardDescription>
            Connect to your EdwinPAI Gateway instance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gateway-url">Gateway URL</Label>
            <Input
              id="gateway-url"
              type="url"
              value={gatewayUrl}
              onChange={(e) => {
                setGatewayUrl(e.target.value);
                setGatewayProfiles(
                  gatewayProfiles.map((profile) =>
                    profile.id === activeProfileId
                      ? { ...profile, gatewayUrl: e.target.value }
                      : profile,
                  ),
                );
                setHasChanges(true);
              }}
              placeholder="http://localhost:18789"
            />
            <p className="text-xs text-muted-foreground">
              The URL of your EdwinPAI Gateway instance (default:
              http://localhost:18789)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gateway-token">Auth Token</Label>
            <Input
              id="gateway-token"
              type="password"
              value={gatewayToken}
              onChange={(e) => {
                setGatewayToken(e.target.value);
                setGatewayProfiles(
                  gatewayProfiles.map((profile) =>
                    profile.id === activeProfileId
                      ? { ...profile, gatewayToken: e.target.value }
                      : profile,
                  ),
                );
                setHasChanges(true);
              }}
              placeholder="Leave empty to use ~/.edwinpai/edwinpai.json token"
            />
            <p className="text-xs text-muted-foreground">
              Gateway authentication token. Leave empty to read from shared
              config.
            </p>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={connectionTest.status === "testing"}
            >
              {connectionTest.status === "testing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            {connectionTest.status === "success" && (
              <div className="flex items-center gap-1.5 text-sm text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                {connectionTest.message}
              </div>
            )}
            {connectionTest.status === "error" && (
              <div className="flex items-center gap-1.5 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {connectionTest.message}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Control whether the gateway requires BSV-signed requests for
            sensitive operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="require-signed-requests">
                  Require signed requests
                </Label>
                <Badge variant="outline">
                  {requireSignedRequestsSource === "explicit"
                    ? "Explicit"
                    : "Default"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, the gateway rejects config changes and other
                sensitive methods unless they include a valid BSV signature.
                This makes the Desktop GUI (with the identity key) the secure
                admin surface.
              </p>
            </div>
            <Switch
              id="require-signed-requests"
              checked={requireSignedRequests}
              disabled={securityLoading}
              onCheckedChange={(checked) => {
                void updateRequireSignedRequests(checked);
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshSecurityConfig()}
              disabled={securityLoading}
            >
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void resetRequireSignedRequests()}
              disabled={securityLoading}
            >
              Reset to default
            </Button>
            {securityLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating…
              </div>
            )}
          </div>

          {securityError && (
            <p className="text-sm text-destructive">{securityError}</p>
          )}
        </CardContent>
      </Card>

      {/* Gateway Configuration */}
      <GatewayConfigCard gatewayUrl={gatewayUrl} gatewayToken={gatewayToken} />
      {/* Agent Configuration */}
      <AgentConfigCard gatewayUrl={gatewayUrl} gatewayToken={gatewayToken} />

      {/* Web Tools */}
      <WebToolsCard gatewayUrl={gatewayUrl} gatewayToken={gatewayToken} />

      {/* AI Providers */}
      <ProviderSettings />

      {/* Text-to-Speech */}
      <TtsSettingsCard gatewayUrl={gatewayUrl} gatewayToken={gatewayToken} />

      {/* App Lock */}
      <AppLockSettings />

      {/* Runtime Status */}
      <RuntimeStatus gatewayUrl={gatewayUrl} />

      {/* Mode Switch */}
      {onModeChange && (
        <Card>
          <CardHeader>
            <CardTitle>Application Mode</CardTitle>
            <CardDescription>
              Switch between Gateway Mode (run your own) and Connect Mode
              (connect with granted permissions)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant={currentMode === "gateway" ? "default" : "outline"}
                onClick={() => {
                  onModeChange("gateway");
                  localStorage.setItem("edwinpai_mode", "gateway");
                }}
                className="flex-1"
              >
                <Home className="h-4 w-4 inline mr-1" /> Gateway Mode
              </Button>
              <Button
                variant={currentMode === "client" ? "default" : "outline"}
                onClick={() => {
                  onModeChange("client");
                  localStorage.setItem("edwinpai_mode", "client");
                }}
                className="flex-1"
              >
                <Plug className="h-4 w-4 inline mr-1" /> Connect Mode
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
        {saveStatus.status === "saved" && (
          <div className="flex items-center gap-1.5 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            {saveStatus.message}
          </div>
        )}
        {saveStatus.status === "error" && (
          <div className="flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            {saveStatus.message}
          </div>
        )}
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveStatus.status === "saving"}
        >
          {saveStatus.status === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}
