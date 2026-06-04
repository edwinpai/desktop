/**
 * Matrix Channel Wizard (SPEC §9.1)
 *
 * Homeserver URL + access token OR username/password tabs.
 * Supports both authentication methods.
 */

import { useState } from "react";
import { Grid3x3 } from "lucide-react";
import { WizardShell, type WizardStepConfig } from "./WizardShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChannels } from "@/hooks/useChannels";
import type { ChannelWizardProps } from "@/types/channels";

type AuthMethod = "token" | "password";

export function MatrixWizard({
  channel = "matrix",
  onComplete,
  onCancel,
  existingConfig,
}: ChannelWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    existingConfig?.credentials?.accessToken ? "token" : "password",
  );
  const [homeserver, setHomeserver] = useState(
    existingConfig?.credentials?.homeserver || "https://matrix.org",
  );
  const [accessToken, setAccessToken] = useState(
    existingConfig?.credentials?.accessToken || "",
  );
  const [username, setUsername] = useState(
    existingConfig?.credentials?.username || "",
  );
  const [password, setPassword] = useState(
    existingConfig?.credentials?.password || "",
  );
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [validationMetadata, setValidationMetadata] = useState<{
    homeserver?: string;
    userId?: string;
    authMethod?: string;
  }>();

  const { validateCredentials } = useChannels(false);

  // Step 1: Introduction
  const introStep: WizardStepConfig = {
    step: "intro",
    title: "Connect Matrix Account",
    description: "Integrate Matrix protocol for decentralized messaging",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This wizard will help you connect to a Matrix homeserver. You can
          authenticate using:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>Access Token:</strong> Pre-generated token from your Matrix
            account settings
          </li>
          <li>
            <strong>Username/Password:</strong> Your Matrix credentials (token
            will be generated)
          </li>
        </ul>
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Supported homeservers:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>matrix.org (default)</li>
            <li>Custom self-hosted homeservers</li>
            <li>Element, Beeper, or other Matrix services</li>
          </ul>
        </div>
      </div>
    ),
  };

  // Step 2: Credential input
  const credentialsStep: WizardStepConfig = {
    step: "credentials",
    title: "Enter Credentials",
    description: "Choose your authentication method",
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="homeserver">Homeserver URL</Label>
          <Input
            id="homeserver"
            type="url"
            placeholder="https://matrix.org"
            value={homeserver}
            onChange={(e) => {
              setHomeserver(e.target.value);
              setError(undefined);
            }}
          />
          <p className="text-xs text-muted-foreground">
            The Matrix homeserver you want to connect to
          </p>
        </div>

        <Tabs
          value={authMethod}
          onValueChange={(v) => setAuthMethod(v as AuthMethod)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="token">Access Token</TabsTrigger>
            <TabsTrigger value="password">Username/Password</TabsTrigger>
          </TabsList>

          <TabsContent value="token" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="access-token">Access Token</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="syt_..."
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  setError(undefined);
                }}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Get this from Element: Settings → Help & About → Access Token
              </p>
            </div>
          </TabsContent>

          <TabsContent value="password" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="@user:matrix.org"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(undefined);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Your full Matrix user ID (e.g., @alice:matrix.org)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(undefined);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Your Matrix account password
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    ),
    onValidate: async () => {
      if (!homeserver.trim()) {
        setError("Homeserver URL is required");
        return false;
      }

      // Validate homeserver URL format
      try {
        new URL(homeserver);
      } catch {
        setError("Invalid homeserver URL. Must start with https://");
        return false;
      }

      if (authMethod === "token") {
        if (!accessToken.trim()) {
          setError("Access token is required");
          return false;
        }
      } else {
        if (!username.trim() || !password.trim()) {
          setError("Username and password are required");
          return false;
        }
      }

      return true;
    },
  };

  // Step 3: Validation
  const validationStep: WizardStepConfig = {
    step: "validation",
    title: "Validate Connection",
    description: "Testing your Matrix credentials",
    content: (
      <div className="space-y-4">
        {validationMetadata ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full" />
              <span className="text-sm font-medium">Connection successful</span>
            </div>
            {validationMetadata.homeserver && (
              <div className="text-sm text-muted-foreground">
                Homeserver:{" "}
                <span className="font-medium">
                  {validationMetadata.homeserver}
                </span>
              </div>
            )}
            {validationMetadata.userId && (
              <div className="text-sm text-muted-foreground">
                User ID:{" "}
                <span className="font-mono">{validationMetadata.userId}</span>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Auth method:{" "}
              <span className="font-medium">
                {validationMetadata.authMethod}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Validating your credentials...
          </p>
        )}
      </div>
    ),
    onValidate: async () => {
      setLoading(true);
      setError(undefined);

      try {
        const credentials: Record<string, string> = {
          homeserver,
        };

        if (authMethod === "token") {
          credentials.accessToken = accessToken;
        } else {
          credentials.username = username;
          credentials.password = password;
        }

        const result = await validateCredentials(channel, credentials);

        if (!result.valid) {
          setError(result.errorMessage || "Validation failed");
          return false;
        }

        setValidationMetadata({
          homeserver: result.metadata?.homeserver || homeserver,
          userId: result.metadata?.username,
          authMethod:
            authMethod === "token" ? "Access Token" : "Username/Password",
        });

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Validation failed");
        return false;
      } finally {
        setLoading(false);
      }
    },
  };

  // Step 4: Confirmation
  const confirmationStep: WizardStepConfig = {
    step: "confirmation",
    title: "Configuration Complete",
    description: "Your Matrix channel is ready",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <div className="w-3 h-3 bg-green-600 dark:bg-green-400 rounded-full" />
          <span className="font-medium">
            Matrix channel configured successfully
          </span>
        </div>
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Channel:</span>{" "}
            <span className="font-medium">Matrix</span>
          </div>
          {validationMetadata?.homeserver && (
            <div className="text-sm">
              <span className="text-muted-foreground">Homeserver:</span>{" "}
              <span className="font-medium">
                {validationMetadata.homeserver}
              </span>
            </div>
          )}
          {validationMetadata?.userId && (
            <div className="text-sm">
              <span className="text-muted-foreground">User ID:</span>{" "}
              <span className="font-mono">{validationMetadata.userId}</span>
            </div>
          )}
          <div className="text-sm">
            <span className="text-muted-foreground">Auth:</span>{" "}
            <span className="font-medium">
              {validationMetadata?.authMethod}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Status:</span>{" "}
            <span className="font-medium text-green-600 dark:text-green-400">
              Active
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          You can now receive and respond to Matrix messages through EdwinPAI.
        </p>
      </div>
    ),
    onValidate: async () => {
      setLoading(true);
      setError(undefined);

      try {
        const credentials: Record<string, string> = {
          homeserver,
        };

        if (authMethod === "token") {
          credentials.accessToken = accessToken;
        } else {
          credentials.username = username;
          credentials.password = password;
        }

        const { invoke } = await import("@tauri-apps/api/core");
        const { vaultCredentialForChannelSecret } =
          await import("@/lib/vault-credentials");
        if (authMethod === "token") {
          const vaultCredential = vaultCredentialForChannelSecret(
            channel,
            "access-token",
          );
          await invoke("vault_store", {
            profileId: "default",
            id: vaultCredential.id,
            name: vaultCredential.name,
            entryType: vaultCredential.entryType,
            provider: vaultCredential.provider,
            credential: accessToken,
            metadata: { source: "matrix-wizard" },
          });
        }

        // Build gateway-native config without raw token secrets.
        const channelConfig: Record<string, unknown> = {
          enabled: true,
          homeserver,
          ...(authMethod === "token"
            ? { userId: username || undefined }
            : { userId: username, password }),
        };

        const patch = {
          channels: {
            [channel]: channelConfig,
          },
        };

        // Save via config.patch (works with remote gateways)
        try {
          const { patchGatewayConfig, resolveToken, inferGatewayKind } =
            await import("@/lib/gateway-context");
          const { readConfig } = await import("@/lib/config");
          const desktopConfig = await readConfig();
          const gwUrl = desktopConfig?.gatewayUrl || "http://localhost:18789";
          const token = desktopConfig?.gatewayToken || (await resolveToken());
          await patchGatewayConfig(
            {
              url: gwUrl,
              token: token || undefined,
              kind: inferGatewayKind(gwUrl),
            },
            patch,
          );
        } catch {
          // Fallback: local IPC
          const configResponse = await invoke<{
            config: Record<string, unknown>;
          }>("get_edwinpai_config");
          const currentConfig = configResponse.config as Record<
            string,
            unknown
          >;
          const updatedConfig = {
            ...currentConfig,
            channels: {
              ...((currentConfig.channels ?? {}) as Record<string, unknown>),
              [channel]: channelConfig,
            },
          };
          await invoke("update_edwinpai_config", { config: updatedConfig });
        }

        onComplete?.({
          enabled: true,
          ...channelConfig,
        } as unknown as import("@/types/channels").ChannelConfig);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save configuration",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    nextLabel: "Save & Enable",
  };

  const steps = [introStep, credentialsStep, validationStep, confirmationStep];

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setError(undefined);
    }
  };

  return (
    <WizardShell
      title="Matrix Integration"
      icon={<Grid3x3 className="w-10 h-10 text-black dark:text-white" />}
      steps={steps}
      currentStepIndex={currentStepIndex}
      onNext={handleNext}
      onBack={handleBack}
      onCancel={() => onCancel?.()}
      error={error}
      loading={loading}
    />
  );
}
