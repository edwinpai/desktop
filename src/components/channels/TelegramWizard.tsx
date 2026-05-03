/**
 * Telegram Channel Wizard (SPEC §9.1)
 *
 * Bot token input with format validation (BOT_ID:AUTH_TOKEN).
 */

import { useState } from "react";
import { Send } from "lucide-react";
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

export function TelegramWizard({
  channel = "telegram",
  onComplete,
  onCancel,
  existingConfig,
}: ChannelWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [botToken, setBotToken] = useState(
    existingConfig?.credentials?.botToken || "",
  );
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [validationMetadata, setValidationMetadata] = useState<{
    botId?: string;
    username?: string;
  }>();

  // Advanced settings state
  const [enabled, setEnabled] = useState(true);
  const [dmPolicy, setDmPolicy] = useState("pairing");
  const [groupPolicy, setGroupPolicy] = useState("open");
  const [historyLimit, setHistoryLimit] = useState(50);

  const { validateCredentials } = useChannels(false);

  // Validate Telegram bot token format: BOT_ID:AUTH_TOKEN
  const validateTokenFormat = (token: string): boolean => {
    const telegramTokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
    return telegramTokenRegex.test(token);
  };

  // Step 1: Introduction
  const introStep: WizardStepConfig = {
    step: "intro",
    title: "Connect Telegram Bot",
    description: "Integrate a Telegram bot to receive and respond to messages",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This wizard will help you connect a Telegram bot. You'll need:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li>A Telegram bot token from @BotFather</li>
          <li>Bot must be created and active</li>
          <li>
            Token format: BOT_ID:AUTH_TOKEN (e.g.,
            123456789:ABCdefGHIjklMNOpqrsTUVwxyz)
          </li>
        </ul>
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            How to create a bot:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>Open Telegram and search for @BotFather</li>
            <li>Send /newbot and follow the prompts</li>
            <li>Copy the bot token provided by BotFather</li>
            <li>Paste it in the next step</li>
          </ol>
        </div>
      </div>
    ),
  };

  // Step 2: Credential input
  const credentialsStep: WizardStepConfig = {
    step: "credentials",
    title: "Enter Bot Token",
    description: "Paste your Telegram bot token",
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bot-token">Bot Token</Label>
          <Input
            id="bot-token"
            type="password"
            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            value={botToken}
            onChange={(e) => {
              setBotToken(e.target.value);
              setError(undefined);
            }}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Format: BOT_ID:AUTH_TOKEN (obtained from @BotFather)
          </p>
        </div>

        {botToken && !validateTokenFormat(botToken) && (
          <div className="text-sm text-orange-600 dark:text-orange-400">
            Token format appears invalid. Expected format:
            123456789:ABCdefGHIjklMNOpqrsTUVwxyz
          </div>
        )}
      </div>
    ),
    onValidate: async () => {
      if (!botToken.trim()) {
        setError("Bot token is required");
        return false;
      }

      if (!validateTokenFormat(botToken)) {
        setError(
          "Invalid token format. Expected: BOT_ID:AUTH_TOKEN (e.g., 123456789:ABCdefGHI...)",
        );
        return false;
      }

      return true;
    },
  };

  // Step 3: Validation
  const validationStep: WizardStepConfig = {
    step: "validation",
    title: "Validate Bot",
    description: "Testing your Telegram bot token",
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
            {validationMetadata.botId && (
              <div className="text-sm text-muted-foreground">
                Bot ID:{" "}
                <span className="font-mono">{validationMetadata.botId}</span>
              </div>
            )}
            {validationMetadata.username && (
              <div className="text-sm text-muted-foreground">
                Username:{" "}
                <span className="font-mono">
                  @{validationMetadata.username}
                </span>
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

        // Extract bot ID from token
        const botId = botToken.split(":")[0];
        setValidationMetadata({
          botId,
          username: result.metadata?.username,
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
    description: "Your Telegram bot is ready",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <div className="w-3 h-3 bg-green-600 dark:bg-green-400 rounded-full" />
          <span className="font-medium">
            Telegram bot configured successfully
          </span>
        </div>
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Channel:</span>{" "}
            <span className="font-medium">Telegram</span>
          </div>
          {validationMetadata?.botId && (
            <div className="text-sm">
              <span className="text-muted-foreground">Bot ID:</span>{" "}
              <span className="font-mono">{validationMetadata.botId}</span>
            </div>
          )}
          {validationMetadata?.username && (
            <div className="text-sm">
              <span className="text-muted-foreground">Username:</span>{" "}
              <span className="font-mono">@{validationMetadata.username}</span>
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
          You can now receive and respond to Telegram messages through EdwinPAI.
        </p>
      </div>
    ),
    onValidate: async () => {
      setLoading(true);
      setError(undefined);

      try {
        // Save channel config via gateway config.patch
        const patch = {
          channels: {
            [channel]: {
              botToken,
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
          const { invoke } = await import("@tauri-apps/api/core");
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
                botToken,
              },
            },
          };
          await invoke("update_edwinpai_config", { config: updatedConfig });
        }

        onComplete?.({
          enabled: true,
          botToken,
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
      title="Telegram Integration"
      icon={<Send className="w-10 h-10 text-blue-500" />}
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
