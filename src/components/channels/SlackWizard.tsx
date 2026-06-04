/**
 * Slack Channel Wizard (SPEC §9.1)
 *
 * Bot token input with prefix validation (xoxb- or xoxp-).
 * Channel picker via API preview (Phase 6: full implementation).
 */

import { useState } from "react";
import { Hash, Lightbulb, AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { useChannels } from "@/hooks/useChannels";
import type { ChannelWizardProps } from "@/types/channels";

export function SlackWizard({
  channel = "slack",
  onComplete,
  onCancel,
  existingConfig,
}: ChannelWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [accessToken, setAccessToken] = useState(
    existingConfig?.credentials?.accessToken || "",
  );
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [validationMetadata, setValidationMetadata] = useState<{
    tokenType?: string;
    teamName?: string;
    botUserId?: string;
  }>();

  // Advanced settings state
  const [enabled, setEnabled] = useState(true);
  const [dmPolicy, setDmPolicy] = useState("pairing");
  const [groupPolicy, setGroupPolicy] = useState("open");
  const [historyLimit, setHistoryLimit] = useState(50);

  const { validateCredentials } = useChannels(false);

  // Validate Slack token prefix (xoxb- for bot, xoxp- for user)
  const validateTokenPrefix = (token: string): boolean => {
    return token.startsWith("xoxb-") || token.startsWith("xoxp-");
  };

  const getTokenType = (token: string): string => {
    if (token.startsWith("xoxb-")) return "Bot Token";
    if (token.startsWith("xoxp-")) return "User Token";
    return "Unknown";
  };

  // Step 1: Introduction
  const introStep: WizardStepConfig = {
    step: "intro",
    title: "Connect Slack Workspace",
    description: "Integrate Slack to receive and respond to messages",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This wizard will help you connect to a Slack workspace. You'll need:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li>A Slack app with OAuth tokens (bot or user token)</li>
          <li>
            Token must have appropriate scopes (chat:write, channels:read, etc.)
          </li>
          <li>App must be installed to your workspace</li>
        </ul>
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            How to get a token:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>Go to https://api.slack.com/apps</li>
            <li>Create a new app or select an existing one</li>
            <li>Go to "OAuth & Permissions"</li>
            <li>
              Add required scopes (chat:write, channels:read, users:read, etc.)
            </li>
            <li>Install app to workspace</li>
            <li>Copy the "Bot User OAuth Token" (starts with xoxb-)</li>
          </ol>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg">
          <p className="text-xs text-orange-900 dark:text-orange-100">
            <Lightbulb className="h-4 w-4 inline mr-1" /> Tip: Bot tokens
            (xoxb-) are recommended for automated messaging
          </p>
        </div>
      </div>
    ),
  };

  // Step 2: Credential input
  const credentialsStep: WizardStepConfig = {
    step: "credentials",
    title: "Enter Access Token",
    description: "Paste your Slack OAuth token",
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="access-token">OAuth Access Token</Label>
          <Input
            id="access-token"
            type="password"
            placeholder="xoxb-your-token-here"
            value={accessToken}
            onChange={(e) => {
              setAccessToken(e.target.value);
              setError(undefined);
            }}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Bot tokens start with{" "}
            <code className="bg-muted px-1 py-0.5 rounded">xoxb-</code>, user
            tokens with{" "}
            <code className="bg-muted px-1 py-0.5 rounded">xoxp-</code>
          </p>
        </div>

        {accessToken && !validateTokenPrefix(accessToken) && (
          <div className="text-sm text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-4 w-4 inline text-amber-500 mr-1" />{" "}
            Token should start with xoxb- (bot) or xoxp- (user)
          </div>
        )}

        {accessToken && validateTokenPrefix(accessToken) && (
          <div className="text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 inline text-green-500 mr-1" />{" "}
            Token type: {getTokenType(accessToken)}
          </div>
        )}
      </div>
    ),
    onValidate: async () => {
      if (!accessToken.trim()) {
        setError("Access token is required");
        return false;
      }

      if (!validateTokenPrefix(accessToken)) {
        setError(
          "Invalid token format. Token must start with xoxb- (bot) or xoxp- (user)",
        );
        return false;
      }

      return true;
    },
  };

  // Step 3: Validation
  const validationStep: WizardStepConfig = {
    step: "validation",
    title: "Validate Token",
    description: "Testing your Slack access token",
    content: (
      <div className="space-y-4">
        {validationMetadata ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full" />
              <span className="text-sm font-medium">
                Token validated successfully
              </span>
            </div>
            {validationMetadata.tokenType && (
              <div className="text-sm text-muted-foreground">
                Token type:{" "}
                <span className="font-medium">
                  {validationMetadata.tokenType}
                </span>
              </div>
            )}
            {validationMetadata.teamName && (
              <div className="text-sm text-muted-foreground">
                Workspace:{" "}
                <span className="font-medium">
                  {validationMetadata.teamName}
                </span>
              </div>
            )}
            {validationMetadata.botUserId && (
              <div className="text-sm text-muted-foreground">
                Bot User ID:{" "}
                <span className="font-mono">
                  {validationMetadata.botUserId}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Validating your token...
          </p>
        )}
      </div>
    ),
    onValidate: async () => {
      setLoading(true);
      setError(undefined);

      try {
        const credentials: Record<string, string> = {
          accessToken,
        };

        const result = await validateCredentials(channel, credentials);

        if (!result.valid) {
          setError(result.errorMessage || "Validation failed");
          return false;
        }

        setValidationMetadata({
          tokenType: result.metadata?.tokenType || getTokenType(accessToken),
          teamName: result.metadata?.teamName,
          botUserId: result.metadata?.botUserId,
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
    description: "Your Slack integration is ready",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <div className="w-3 h-3 bg-green-600 dark:bg-green-400 rounded-full" />
          <span className="font-medium">
            Slack workspace configured successfully
          </span>
        </div>
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Channel:</span>{" "}
            <span className="font-medium">Slack</span>
          </div>
          {validationMetadata?.tokenType && (
            <div className="text-sm">
              <span className="text-muted-foreground">Token type:</span>{" "}
              <span className="font-medium">
                {validationMetadata.tokenType}
              </span>
            </div>
          )}
          {validationMetadata?.teamName && (
            <div className="text-sm">
              <span className="text-muted-foreground">Workspace:</span>{" "}
              <span className="font-medium">{validationMetadata.teamName}</span>
            </div>
          )}
          {validationMetadata?.botUserId && (
            <div className="text-sm">
              <span className="text-muted-foreground">Bot User ID:</span>{" "}
              <span className="font-mono">{validationMetadata.botUserId}</span>
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
          You can now receive and respond to Slack messages through EdwinPAI.
        </p>
        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            <Lightbulb className="h-4 w-4 inline mr-1" /> Channel picker will be
            available in Phase 6 for selecting specific Slack channels
          </p>
        </div>
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
          credential: accessToken,
          metadata: { source: "slack-wizard" },
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
      title="Slack Integration"
      icon={<Hash className="w-10 h-10 text-purple-600" />}
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
