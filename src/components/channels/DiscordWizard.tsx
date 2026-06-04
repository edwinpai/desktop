/**
 * Discord Channel Wizard (SPEC §9.1)
 *
 * Bot token input with validation.
 * Supports bot token authentication (OAuth flow deferred to Phase 6).
 */

import { useState } from "react";
import { MessageSquare, AlertTriangle } from "lucide-react";
import { WizardShell, type WizardStepConfig } from "./WizardShell";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChannels } from "@/hooks/useChannels";
import type { ChannelWizardProps } from "@/types/channels";

type AuthMethod = "bot" | "oauth";

export function DiscordWizard({
  channel = "discord",
  onComplete,
  onCancel,
  existingConfig,
}: ChannelWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    existingConfig?.credentials?.botToken ? "bot" : "bot",
  );
  const [botToken, setBotToken] = useState(
    existingConfig?.credentials?.botToken || "",
  );
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [validationMetadata, setValidationMetadata] = useState<{
    botId?: string;
    username?: string;
    discriminator?: string;
  }>();

  // Advanced settings state
  const [enabled, setEnabled] = useState(true);
  const [dmPolicy, setDmPolicy] = useState("pairing");
  const [groupPolicy, setGroupPolicy] = useState("open");
  const [historyLimit, setHistoryLimit] = useState(50);

  const { validateCredentials } = useChannels(false);

  // Step 1: Introduction
  const introStep: WizardStepConfig = {
    step: "intro",
    title: "Connect Discord Bot",
    description: "Integrate a Discord bot to receive and respond to messages",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This wizard will help you connect a Discord bot. You'll need:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li>A Discord bot token from the Discord Developer Portal</li>
          <li>Bot must have appropriate permissions in your server</li>
          <li>Message Content intent must be enabled</li>
        </ul>
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            How to create a bot:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>Go to https://discord.com/developers/applications</li>
            <li>Click "New Application" and give it a name</li>
            <li>Go to the "Bot" section and click "Add Bot"</li>
            <li>Copy the bot token (click "Reset Token" if needed)</li>
            <li>
              Enable "Message Content Intent" under Privileged Gateway Intents
            </li>
            <li>
              Invite the bot to your server using the OAuth2 URL Generator
            </li>
          </ol>
        </div>
      </div>
    ),
  };

  // Step 2: Credential input
  const credentialsStep: WizardStepConfig = {
    step: "credentials",
    title: "Enter Bot Token",
    description: "Paste your Discord bot token",
    content: (
      <div className="space-y-4">
        <Tabs
          value={authMethod}
          onValueChange={(v) => setAuthMethod(v as AuthMethod)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bot">Bot Token</TabsTrigger>
            <TabsTrigger value="oauth" disabled>
              OAuth (Coming Soon)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bot" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bot-token">Bot Token</Label>
              <Input
                id="bot-token"
                type="password"
                placeholder="MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs"
                value={botToken}
                onChange={(e) => {
                  setBotToken(e.target.value);
                  setError(undefined);
                }}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Get this from Discord Developer Portal → Your App → Bot → Token
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg">
              <p className="text-xs text-orange-900 dark:text-orange-100">
                <AlertTriangle className="h-4 w-4 inline text-amber-500 mr-1" />{" "}
                Never share your bot token! It provides full access to your bot.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="oauth" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              OAuth flow for user authentication will be available in Phase 6.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    ),
    onValidate: async () => {
      if (authMethod === "bot") {
        if (!botToken.trim()) {
          setError("Bot token is required");
          return false;
        }

        // Basic token format validation (Discord tokens are base64-ish)
        if (botToken.length < 50) {
          setError("Bot token appears too short. Please check and try again.");
          return false;
        }
      }

      return true;
    },
  };

  // Step 3: Validation
  const validationStep: WizardStepConfig = {
    step: "validation",
    title: "Validate Bot",
    description: "Testing your Discord bot token",
    content: (
      <div className="space-y-4">
        {validationMetadata ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full" />
              <span className="text-sm font-medium">
                Bot validated successfully
              </span>
            </div>
            {validationMetadata.username && (
              <div className="text-sm text-muted-foreground">
                Bot name:{" "}
                <span className="font-medium">
                  {validationMetadata.username}
                  {validationMetadata.discriminator &&
                    `#${validationMetadata.discriminator}`}
                </span>
              </div>
            )}
            {validationMetadata.botId && (
              <div className="text-sm text-muted-foreground">
                Bot ID:{" "}
                <span className="font-mono">{validationMetadata.botId}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Validating your bot token...
          </p>
        )}
      </div>
    ),
    onValidate: async () => {
      setLoading(true);
      setError(undefined);

      try {
        const credentials: Record<string, string> = {
          botToken,
        };

        const result = await validateCredentials(channel, credentials);

        if (!result.valid) {
          setError(result.errorMessage || "Validation failed");
          return false;
        }

        setValidationMetadata({
          botId: result.metadata?.botId,
          username: result.metadata?.username,
          discriminator: result.metadata?.discriminator,
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

  // Step 4: Advanced Settings (Optional)
  const advancedStep: WizardStepConfig = {
    step: "advanced",
    title: "Advanced Settings (Optional)",
    description: "Configure channel behavior",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          These settings are optional. You can always change them later in the
          channel settings.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable Channel</Label>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Toggle the channel on/off without removing configuration
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dm-policy">DM Policy</Label>
          <Select value={dmPolicy} onValueChange={setDmPolicy}>
            <SelectTrigger id="dm-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pairing">Pairing</SelectItem>
              <SelectItem value="allowlist">Allowlist</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How to handle direct messages
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-policy">Group Policy</Label>
          <Select value={groupPolicy} onValueChange={setGroupPolicy}>
            <SelectTrigger id="group-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="allowlist">Allowlist</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How to handle group messages
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="history-limit">History Limit</Label>
          <Input
            id="history-limit"
            type="number"
            value={historyLimit}
            onChange={(e) => setHistoryLimit(parseInt(e.target.value, 10) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            Number of messages to keep in context window
          </p>
        </div>
      </div>
    ),
  };

  // Step 5: Confirmation
  const confirmationStep: WizardStepConfig = {
    step: "confirmation",
    title: "Configuration Complete",
    description: "Your Discord bot is ready",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <div className="w-3 h-3 bg-green-600 dark:bg-green-400 rounded-full" />
          <span className="font-medium">
            Discord bot configured successfully
          </span>
        </div>
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Channel:</span>{" "}
            <span className="font-medium">Discord</span>
          </div>
          {validationMetadata?.username && (
            <div className="text-sm">
              <span className="text-muted-foreground">Bot name:</span>{" "}
              <span className="font-medium">
                {validationMetadata.username}
                {validationMetadata.discriminator &&
                  `#${validationMetadata.discriminator}`}
              </span>
            </div>
          )}
          {validationMetadata?.botId && (
            <div className="text-sm">
              <span className="text-muted-foreground">Bot ID:</span>{" "}
              <span className="font-mono">{validationMetadata.botId}</span>
            </div>
          )}
          <div className="text-sm">
            <span className="text-muted-foreground">Status:</span>{" "}
            <span className="font-medium text-green-600 dark:text-green-400">
              Active
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          You can now receive and respond to Discord messages through EdwinPAI.
        </p>
      </div>
    ),
    onValidate: async () => {
      setLoading(true);
      setError(undefined);

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { vaultCredentialForChannelSecret } =
          await import("@/lib/vault-credentials");
        const vaultCredential = vaultCredentialForChannelSecret(channel);
        await invoke("vault_store", {
          profileId: "default",
          id: vaultCredential.id,
          name: vaultCredential.name,
          entryType: vaultCredential.entryType,
          provider: vaultCredential.provider,
          credential: botToken,
          metadata: { source: "discord-wizard" },
        });

        // Save non-secret channel config via gateway config.patch.
        const patch = {
          channels: {
            [channel]: {
              enabled,
              dmPolicy,
              groupPolicy,
              historyLimit,
            },
          },
        };

        // Try config.patch via WebSocket first (works for remote gateways)
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
          // Fallback: try local IPC
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
              [channel]: {
                enabled,
                dmPolicy,
                groupPolicy,
                historyLimit,
              },
            },
          };
          await invoke("update_edwinpai_config", { config: updatedConfig });
        }

        onComplete?.({
          enabled,
          dmPolicy,
          groupPolicy,
          historyLimit,
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

  const steps = [
    introStep,
    credentialsStep,
    validationStep,
    advancedStep,
    confirmationStep,
  ];

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
      title="Discord Integration"
      icon={<MessageSquare className="w-10 h-10 text-indigo-500" />}
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
