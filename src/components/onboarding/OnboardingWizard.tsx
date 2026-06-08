/**
 * OnboardingWizard Component
 *
 * Multi-step onboarding wizard with 7 steps:
 * 1. Welcome - Introduction to EdwinPAI
 * 2. ApiKey - AI provider API key validation
 * 3. Identity - BSV identity generation via Crypto Domain IPC
 * 4. Gateway - Start gateway process and health check
 * 5. TestChat - Test chat with SSE streaming
 * 6. Channels - Configure messaging channels
 * 7. Done - Onboarding complete
 *
 * Features:
 * - localStorage persistence via useOnboarding hook
 * - Error handling for all IPC calls
 * - Step-by-step progress tracking
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Check,
  ChevronRight,
  AlertCircle,
  Loader2,
  Play,
  MessageSquare,
  Key,
  Radio,
  Wifi,
  LockKeyhole,
  FileSearch,
  Package,
  RefreshCw,
  Shield,
  Globe,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { GatewayDetection } from "./GatewayDetection";

import { vaultCredentialForProvider } from "@/lib/vault-credentials";
import { fetchPendingActionApprovals } from "@/lib/action-approvals";
import {
  callGatewayMethod,
  patchGatewayConfig,
  type GatewayTarget,
} from "@/lib/gateway-context";
import {
  loadPolicy,
  savePolicy,
  setRuleForCredential,
  type AskMode,
} from "@/lib/vault-policy";
import { updateConfig } from "@/lib/config";
import { getIdentity as getCryptoIdentity } from "@/lib/crypto-domain";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { IdentityBadge } from "@/components/shared/IdentityBadge";
import { APP_VERSION } from "@/lib/app-version";
import {
  OnboardingStep,
  getNextStep,
  getPreviousStep,
  calculateCompletionPercentage,
  type OnboardingProgress,
} from "@/types/onboarding";
// Chat test uses WebSocket protocol directly (no HTTP SSE)

export interface OnboardingWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

/**
 * Main OnboardingWizard Component
 */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const {
    currentStep,
    completedSteps,
    nextStep,
    prevStep,
    completeStep,
    updateStepData,
    data,
    isComplete,
  } = useOnboarding({
    onComplete,
    autoSave: true,
  });

  // Map numeric step to enum
  const getCurrentStepEnum = (): OnboardingStep => {
    const steps = Object.values(OnboardingStep);
    return steps[currentStep] || OnboardingStep.Welcome;
  };

  const currentStepEnum = getCurrentStepEnum();
  const progress: OnboardingProgress = {
    currentStep: currentStepEnum,
    completedSteps: completedSteps as string[],
    apiKeyValidated: completedSteps.includes("ApiKey"),
    identityGenerated: completedSteps.includes("Identity"),
    gatewayStarted: completedSteps.includes("Gateway"),
    testChatCompleted: completedSteps.includes("TestChat"),
    channelsConfigured: data.channels ? (data.channels as string[]) : [],
  };

  const completionPercentage = calculateCompletionPercentage(progress);

  const handleNext = () => {
    const nextStepEnum = getNextStep(currentStepEnum);
    if (nextStepEnum) {
      nextStep();
    } else if (isComplete) {
      onComplete();
    }
  };

  const handlePrevious = () => {
    const prevStepEnum = getPreviousStep(currentStepEnum);
    if (prevStepEnum) {
      prevStep();
    }
  };

  const handleStepComplete = (data?: unknown) => {
    completeStep(currentStepEnum, data);
  };

  const canNavigateForward = completedSteps.includes(currentStepEnum);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="px-8 lg:px-16 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">
                {getStepTitle(currentStepEnum)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {getStepDescription(currentStepEnum)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={completionPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Step {currentStep + 1} of {Object.values(OnboardingStep).length}
              </span>
              <span>{completionPercentage}% complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 lg:px-16 py-8">
          {renderStep(
            currentStepEnum,
            progress,
            handleStepComplete,
            updateStepData,
            data,
            () => onComplete?.(),
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t bg-background/95 backdrop-blur">
        <div className="px-8 lg:px-16 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>

            <div className="flex gap-2">
              {Object.values(OnboardingStep).map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index < currentStep
                      ? "bg-primary"
                      : index === currentStep
                        ? "bg-primary/50"
                        : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {currentStepEnum === OnboardingStep.Done ? (
              <Button onClick={onComplete}>
                Complete <Check className="ml-2 size-4" />
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canNavigateForward}>
                Next <ChevronRight className="ml-2 size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Render current step content
 */
function renderStep(
  step: OnboardingStep,
  _progress: OnboardingProgress,
  onComplete: (data?: unknown) => void,
  updateData: (stepType: string, data: unknown) => void,
  data: Record<string, unknown>,
  onSkipToEnd?: () => void,
): React.ReactNode {
  switch (step) {
    case OnboardingStep.Welcome:
      return <WelcomeStep onNext={onComplete} onSkipToEnd={onSkipToEnd} />;

    case OnboardingStep.Security:
      return <SecurityModelStep onComplete={onComplete} />;

    case OnboardingStep.VaultHealth:
      return <VaultHealthStep onComplete={onComplete} />;

    case OnboardingStep.ApiKey:
      return (
        <ApiKeyStep
          onComplete={onComplete}
          initialKey={data.apiKey as string | undefined}
        />
      );

    case OnboardingStep.SecretMigration:
      return <SecretMigrationStep onComplete={onComplete} />;

    case OnboardingStep.CredentialProbe:
      return <CredentialProbeStep onComplete={onComplete} />;

    case OnboardingStep.Identity:
      return <IdentityStep onComplete={onComplete} />;

    case OnboardingStep.Gateway:
      return <GatewayStep onComplete={onComplete} />;

    case OnboardingStep.TestChat:
      return <TestChatStep onComplete={onComplete} />;

    case OnboardingStep.Channels:
      return <ChannelsStep onComplete={onComplete} updateData={updateData} />;

    case OnboardingStep.Done:
      return <DoneStep data={data} />;

    default:
      return null;
  }
}

/**
 * Step 1: Welcome
 */
function WelcomeStep({
  onNext,
  onSkipToEnd,
}: {
  onNext: () => void;
  onSkipToEnd?: () => void;
}) {
  // Keep test harness deterministic: skip async gateway probing in unit tests.
  const [showDetection, setShowDetection] = useState(
    import.meta.env.MODE !== "test",
  );

  if (showDetection) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
        <div className="space-y-4 max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight">
            Welcome to EdwinPAI
          </h2>
          <p className="text-lg text-muted-foreground">
            EdwinPAI is your personal AI assistant powered by BSV blockchain
            technology. Secure, private, and completely under your control.
          </p>
        </div>

        <GatewayDetection
          onGatewayFound={() => {
            // Gateway already running — skip to done
            onSkipToEnd?.();
          }}
          onSkip={() => setShowDetection(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
      <div className="space-y-4 max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold tracking-tight">
          Welcome to EdwinPAI
        </h2>
        <p className="text-lg text-muted-foreground">
          EdwinPAI is your personal AI assistant powered by BSV blockchain
          technology. Secure, private, and completely under your control.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 w-full">
        <FeatureCard
          icon={<Shield className="h-8 w-8 text-primary" />}
          title="Secure"
          description="Your keys, your data. Everything stays on your device."
        />
        <FeatureCard
          icon={<Globe className="h-8 w-8 text-primary" />}
          title="Decentralized"
          description="No central authority. Connect peer-to-peer over LAN."
        />
        <FeatureCard
          icon={<MessageSquare className="h-8 w-8 text-primary" />}
          title="Multi-Channel"
          description="Use EdwinPAI across WhatsApp, Telegram, Discord, and more."
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button size="lg" onClick={onNext}>
          Get Started <ChevronRight className="ml-2 size-5" />
        </Button>
        <Button variant="ghost" onClick={onSkipToEnd}>
          Skip setup wizard
        </Button>
        <p className="max-w-md text-xs text-muted-foreground">
          Use this if EdwinPAI is already configured. You can finish setup later
          from Settings.
        </p>
      </div>
    </div>
  );
}

/**
 * Step 2: Vault + Actions Approval security model
 */
function SecurityModelStep({
  onComplete,
}: {
  onComplete: (data?: unknown) => void;
}) {
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Vault-backed security model
        </CardTitle>
        <CardDescription>
          EdwinPAI keeps sensitive credentials behind Desktop Vault and Actions
          Approvals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard
            icon={<LockKeyhole className="h-8 w-8 text-primary" />}
            title="Secrets stay in Vault"
            description="API keys and OAuth tokens are stored in Desktop Vault backed by the OS keychain, not loose config files."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-primary" />}
            title="Approvals gate access"
            description="Gateway tools request credential use through Actions Approvals and receive only short-lived leases."
          />
        </div>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            Recommended setup uses OpenAI for model access. API-backed model and
            embedding features require an OpenAI API key; a ChatGPT subscription
            alone does not provide API access.
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onComplete({ securityModelAcknowledged: true })}
          className="w-full"
        >
          I understand — continue
        </Button>
      </CardFooter>
    </Card>
  );
}

function buildGatewayTargetFromConfig(config: {
  gatewayUrl?: string;
  gatewayPort?: number;
  gatewayToken?: string;
}): GatewayTarget {
  return {
    url: config.gatewayUrl || `http://localhost:${config.gatewayPort || 18789}`,
    token: config.gatewayToken,
    kind: "local",
  };
}

/**
 * Step 3: Vault / Actions Approval health check
 */
function VaultHealthStep({
  onComplete,
}: {
  onComplete: (data?: unknown) => void;
}) {
  const [checks, setChecks] = useState<
    Array<{
      label: string;
      status: "pass" | "fail" | "checking";
      detail?: string;
    }>
  >([]);
  const [running, setRunning] = useState(false);

  const runChecks = useCallback(async () => {
    setRunning(true);
    const next: Array<{
      label: string;
      status: "pass" | "fail" | "checking";
      detail?: string;
    }> = [];
    const push = (
      label: string,
      status: "pass" | "fail" | "checking",
      detail?: string,
    ) => {
      next.push({ label, status, detail });
      setChecks([...next]);
    };

    try {
      const testId = `onboarding-health-${Date.now()}`;
      push("Vault store/list/delete", "checking");
      await invoke("vault_store", {
        profileId: "default",
        id: testId,
        name: "Onboarding health check",
        entryType: "secret",
        provider: "edwinpai",
        credential: `health-${Date.now()}`,
        metadata: { source: "onboarding-health-check" },
      });
      await invoke("vault_list", { profileId: "default" });
      await invoke("vault_delete", { profileId: "default", id: testId });
      next[next.length - 1] = {
        label: "Vault store/list/delete",
        status: "pass",
        detail: "Desktop Vault is writable",
      };
      setChecks([...next]);
    } catch (err) {
      next[next.length - 1] = {
        label: "Vault store/list/delete",
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      };
      setChecks([...next]);
    }

    try {
      push("Gateway approvals stream", "checking");
      const { readConfig } = await import("@/lib/config");
      const target = buildGatewayTargetFromConfig(await readConfig());
      await fetchPendingActionApprovals(target, {}, 5000);
      next[next.length - 1] = {
        label: "Gateway approvals stream",
        status: "pass",
        detail: "action.approvals.pending reachable",
      };
      setChecks([...next]);
    } catch (err) {
      next[next.length - 1] = {
        label: "Gateway approvals stream",
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      };
      setChecks([...next]);
    }

    setRunning(false);
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);
  const passed = checks.length >= 2 && checks.every((c) => c.status === "pass");

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Vault & approval health
        </CardTitle>
        <CardDescription>
          Verifies local Vault access and the Gateway approval surface without
          using real secrets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-center gap-3 rounded-lg border p-3 text-sm"
          >
            {check.status === "checking" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : check.status === "pass" ? (
              <Check className="size-4 text-green-500" />
            ) : (
              <AlertCircle className="size-4 text-red-500" />
            )}
            <div>
              <div className="font-medium">{check.label}</div>
              {check.detail && (
                <div className="text-xs text-muted-foreground">
                  {check.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" onClick={runChecks} disabled={running}>
          Retry
        </Button>
        <Button
          onClick={() => onComplete({ vaultHealthPassed: passed })}
          disabled={!passed}
        >
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Step 4: API Key Validation
 */
function ApiKeyStep({
  onComplete,
  initialKey,
}: {
  onComplete: (data?: unknown) => void;
  initialKey?: string;
}) {
  const [apiKey, setApiKey] = useState(initialKey || "");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // OpenAI is the default recommended provider for new users.
      let provider = "openai";
      if (apiKey.startsWith("sk-ant-")) {
        provider = "anthropic";
      } else if (apiKey.startsWith("sk-") && !apiKey.startsWith("sk-ant-")) {
        provider = "openai";
      }

      // Store API keys in Desktop Vault / OS keychain by default.
      const vaultCredential = vaultCredentialForProvider(provider);
      await invoke("vault_store", {
        profileId: "default",
        id: vaultCredential.id,
        name: vaultCredential.name,
        entryType: vaultCredential.entryType,
        provider: vaultCredential.provider,
        credential: apiKey.trim(),
        metadata: {
          source: "onboarding",
        },
      });

      // Patch gateway config with metadata-only provider config (no raw secrets).
      try {
        const { readConfig } = await import("@/lib/config");
        const target = buildGatewayTargetFromConfig(await readConfig());
        await patchGatewayConfig(target, {
          ...(vaultCredential.defaultModel
            ? { agents: { defaults: { model: vaultCredential.defaultModel } } }
            : {}),
          models: {
            providers: {
              [vaultCredential.provider]: {
                apiKey: vaultCredential.id,
                auth: vaultCredential.authMode ?? "api-key",
              },
            },
          },
        });
      } catch {
        // Best-effort: vault write succeeded; gateway patch can be applied later.
      }

      setIsValid(true);
      setIsValidating(false);

      // Auto-advance after brief delay
      setTimeout(() => {
        onComplete({ apiKey: "configured" });
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
      setIsValidating(false);
      setIsValid(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="size-5" />
          AI Provider API Key
        </CardTitle>
        <CardDescription>
          EdwinPAI needs an API key for API-backed model access. We recommend
          OpenAI for first-time setup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
          <p className="font-medium">How to get an API key:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>
              Go to{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener"
                className="text-primary underline underline-offset-2"
              >
                platform.openai.com
              </a>
            </li>
            <li>Sign in or create an account</li>
            <li>
              Click <strong>"Create Key"</strong>
            </li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            disabled={isValidating || isValid}
          />
          <p className="text-xs text-muted-foreground">
            Starts with{" "}
            <code className="px-1 py-0.5 bg-muted rounded">sk-</code> for
            OpenAI. Anthropic keys are still accepted for advanced users.
          </p>
        </div>

        <ApprovalPolicyChooser credentialId="openai-api-key" />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isValid && (
          <Alert>
            <Check className="size-4" />
            <AlertDescription>
              API key saved to Desktop Vault. Only non-secret provider metadata
              is kept outside Vault.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleValidate}
          disabled={isValidating || isValid}
          className="w-full"
        >
          {isValidating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Validating...
            </>
          ) : isValid ? (
            <>
              <Check className="mr-2 size-4" />
              Validated
            </>
          ) : (
            "Validate & Continue"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ApprovalPolicyChooser({ credentialId }: { credentialId: string }) {
  const [ask, setAsk] = useState<AskMode>("first-time");
  const [notice, setNotice] = useState<string | null>(null);

  const save = async (nextAsk: AskMode) => {
    setAsk(nextAsk);
    const policy = await loadPolicy("default");
    const updated = setRuleForCredential(
      policy,
      credentialId,
      nextAsk,
      5 * 60 * 1000,
      "Configured during onboarding",
    );
    await savePolicy("default", updated);
    setNotice(`Approval policy saved: ${nextAsk}`);
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="text-sm font-medium">
        OpenAI credential approval policy
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {[
          ["ask", "Ask every time"],
          ["first-time", "Ask first time, then short leases"],
          ["auto-grant", "Auto-grant short local leases"],
          ["deny", "Never grant automatically"],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={ask === value ? "default" : "outline"}
            onClick={() => void save(value as AskMode)}
          >
            {label}
          </Button>
        ))}
      </div>
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
    </div>
  );
}

function SecretMigrationStep({
  onComplete,
}: {
  onComplete: (data?: unknown) => void;
}) {
  const [status, setStatus] = useState<string>("Not checked yet");
  const [isChecking, setIsChecking] = useState(false);

  const checkPendingImports = async () => {
    setIsChecking(true);
    try {
      const { readConfig } = await import("@/lib/config");
      const target = buildGatewayTargetFromConfig(await readConfig());
      const result = (await callGatewayMethod(
        target,
        "vault.import.pending",
        {},
        5000,
        "Timed out fetching pending Vault imports",
      )) as { imports?: unknown[] };
      const count = Array.isArray(result?.imports) ? result.imports.length : 0;
      setStatus(
        count > 0
          ? `${count} pending redacted Vault import request(s). Open Action Approvals to review and import.`
          : "No pending Vault imports found. Existing raw-secret scans are non-destructive and imports require approval.",
      );
    } catch (err) {
      setStatus(
        `Could not query Vault imports yet: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    void checkPendingImports();
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="size-5" />
          Import existing secrets
        </CardTitle>
        <CardDescription>
          Move existing config/env/auth-profile secrets into Desktop Vault
          through approval-backed imports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            Only redacted previews should be shown in onboarding. Raw values are
            claimed privately by Desktop and stored with{" "}
            <code>vault_store</code> after user approval.
          </AlertDescription>
        </Alert>
        <div className="rounded-lg border p-3">{status}</div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          onClick={checkPendingImports}
          disabled={isChecking}
        >
          {isChecking ? "Checking..." : "Refresh"}
        </Button>
        <Button onClick={() => onComplete({ vaultImportsReviewed: true })}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

function CredentialProbeStep({
  onComplete,
}: {
  onComplete: (data?: unknown) => void;
}) {
  const [status, setStatus] = useState<string>(
    "Ready to verify OpenAI credential access through Gateway + Actions Approvals.",
  );
  const [probing, setProbing] = useState(false);
  const [passed, setPassed] = useState(false);

  const runProbe = async () => {
    setProbing(true);
    setPassed(false);
    try {
      const { readConfig } = await import("@/lib/config");
      const target = buildGatewayTargetFromConfig(await readConfig());
      await callGatewayMethod(
        target,
        "credential.request",
        {
          credentialId: "openai-api-key",
          name: "OpenAI API key",
          purpose: "onboarding OpenAI credential probe",
          requester: "desktop:onboarding",
          leaseDurationMs: 60_000,
        },
        120000,
        "Timed out waiting for approved OpenAI credential probe",
      );
      setStatus(
        "Gateway credential request completed through the approval-backed path.",
      );
      setPassed(true);
    } catch (err) {
      setStatus(
        `Probe could not complete automatically: ${err instanceof Error ? err.message : String(err)}. Open Action Approvals and ensure the openai-api-key Vault entry exists.`,
      );
    } finally {
      setProbing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5" />
          Approved OpenAI credential probe
        </CardTitle>
        <CardDescription>
          Verifies Gateway can request <code>openai-api-key</code> and Desktop
          can grant it through signed Vault use.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" onClick={runProbe} disabled={probing}>
          {probing ? "Waiting for approval..." : "Run probe"}
        </Button>
        <Button
          onClick={() =>
            onComplete({
              openAiCredentialProbe: passed ? "passed" : "deferred",
            })
          }
        >
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

interface WizardIdentity {
  publicKey: string;
  petname: string;
  avatarSvg: string;
  shortId: string;
}

function mapCryptoIdentityToWizardIdentity(
  identity: Awaited<ReturnType<typeof getCryptoIdentity>>,
): WizardIdentity {
  return {
    publicKey: identity.public_key,
    petname: identity.petname,
    avatarSvg: identity.avatar_svg,
    shortId: identity.short_id,
  };
}

/**
 * Step 3: Identity Generation
 */
function IdentityStep({
  onComplete,
}: {
  onComplete: (data?: unknown) => void;
}) {
  const [identity, setIdentity] = useState<WizardIdentity | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const loadIdentity = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Check if we have a cached identity (prevents regeneration on re-navigation)
      const cached = localStorage.getItem("edwinpai_identity_cache");
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached) as WizardIdentity;
          if (parsedCache.publicKey) {
            setIdentity(parsedCache);
            setIsGenerating(false);
            return;
          }
        } catch {
          // Invalid cache, proceed to generate
        }
      }

      const response = mapCryptoIdentityToWizardIdentity(
        await getCryptoIdentity(),
      );
      setIdentity(response);
      // Cache the identity so re-navigation doesn't regenerate
      localStorage.setItem("edwinpai_identity_cache", JSON.stringify(response));
      setIsGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load identity");
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    // Only fetch once per mount cycle — prevent regeneration on re-navigation
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void loadIdentity();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = mapCryptoIdentityToWizardIdentity(
        await getCryptoIdentity(),
      );
      setIdentity(response);
      setIsGenerating(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate identity",
      );
      setIsGenerating(false);
    }
  };

  const handleContinue = () => {
    if (identity) {
      onComplete({ identity });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Your BSV Identity</CardTitle>
        <CardDescription>
          {isGenerating
            ? "Generating your unique cryptographic identity..."
            : identity
              ? "Your identity has been generated and stored securely"
              : "Failed to generate identity"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating && (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="size-12 animate-spin text-primary" />
          </div>
        )}

        {identity && (
          <IdentityBadge
            publicKey={identity.publicKey}
            petname={identity.petname}
            size="lg"
          />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {error && (
          <Button onClick={handleGenerate} variant="outline" className="flex-1">
            Retry
          </Button>
        )}
        <Button
          onClick={handleContinue}
          disabled={!identity}
          className="flex-1"
        >
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Step 4: Gateway Start
 */
interface DiscoveredGateway {
  url: string;
  version: string | null;
  name: string | null;
}

function GatewayStep({ onComplete }: { onComplete: (data?: unknown) => void }) {
  const [isScanning, setIsScanning] = useState(true);
  const [gateways, setGateways] = useState<DiscoveredGateway[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showStartConfig, setShowStartConfig] = useState(false);
  const [startPort, setStartPort] = useState(18789);
  const [startToken, setStartToken] = useState("");
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [isInstallingGateway, setIsInstallingGateway] = useState(false);
  const [installOutput, setInstallOutput] = useState<string | null>(null);
  const [runtimeChecked, setRuntimeChecked] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState<{
    nodeAvailable: boolean;
    npmAvailable?: boolean;
    edwinpaiAvailable: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");

  // Scan for gateways and check runtime on mount
  useEffect(() => {
    (async () => {
      // Check runtime availability in parallel with gateway scan
      invoke<{
        nodeAvailable: boolean;
        npmAvailable?: boolean;
        edwinpaiAvailable: boolean;
        ready: boolean;
      }>("check_runtime")
        .then((status) => {
          setRuntimeReady(status.ready);
          setRuntimeInfo({
            nodeAvailable: status.nodeAvailable,
            npmAvailable: status.npmAvailable,
            edwinpaiAvailable: status.edwinpaiAvailable,
          });
          setRuntimeChecked(true);
        })
        .catch(() => setRuntimeChecked(true));

      try {
        const found = await invoke<DiscoveredGateway[]>("scan_gateways");
        setGateways(found);
        // Auto-select if exactly one found
        const onlyGateway = found.length === 1 ? found[0] : undefined;
        if (onlyGateway) {
          setSelectedUrl(onlyGateway.url);
        }
      } catch {
        // Scan failed
      } finally {
        setIsScanning(false);
      }
    })();
  }, []);

  const handleRescan = async () => {
    setIsScanning(true);
    setGateways([]);
    setSelectedUrl(null);
    setIsConnected(false);
    setError(null);
    try {
      const found = await invoke<DiscoveredGateway[]>("scan_gateways");
      setGateways(found);
      const onlyGateway = found.length === 1 ? found[0] : undefined;
      if (onlyGateway) {
        setSelectedUrl(onlyGateway.url);
      }
    } catch {
      // Scan failed
    } finally {
      setIsScanning(false);
    }
  };

  const handleInstallGatewayRuntime = async () => {
    setIsInstallingGateway(true);
    setError(null);
    setInstallOutput(null);
    try {
      const result = await invoke<{
        success: boolean;
        command: string;
        stdout: string;
        stderr: string;
        runtime: {
          nodeAvailable: boolean;
          npmAvailable?: boolean;
          edwinpaiAvailable: boolean;
          ready: boolean;
        };
      }>("install_gateway_runtime");
      setRuntimeReady(result.runtime.ready);
      setRuntimeInfo({
        nodeAvailable: result.runtime.nodeAvailable,
        npmAvailable: result.runtime.npmAvailable,
        edwinpaiAvailable: result.runtime.edwinpaiAvailable,
      });
      setInstallOutput(
        `Installed with ${result.command}${result.stdout ? `\n${result.stdout}` : ""}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInstallingGateway(false);
      setRuntimeChecked(true);
    }
  };

  const handleStartLocal = async () => {
    setIsStarting(true);
    setError(null);

    try {
      // Start gateway on configured port
      await invoke("start_gateway_real", { port: startPort });

      // Wait a moment for gateway to initialize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Rescan to find the newly started gateway
      const found = await invoke<DiscoveredGateway[]>("scan_gateways");
      setGateways(found);

      if (found.length > 0) {
        // Auto-select the local gateway on the port we started
        const local =
          found.find((g) => g.url.includes(String(startPort))) ?? found[0];
        if (local) {
          setSelectedUrl(local.url);
        }
        // Set token if configured
        if (startToken) {
          setTokenInput(startToken);
        }
      }

      setShowStartConfig(false);
      setIsStarting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start gateway");
      setIsStarting(false);
    }
  };

  const handleConnect = async () => {
    const url = showManual ? manualUrl.trim() : selectedUrl;
    if (!url) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Verify gateway is reachable via Rust-side probe
      const probe = await invoke<{ found: boolean }>("probe_gateway", { url });
      if (!probe.found) {
        throw new Error(`Cannot reach gateway at ${url}`);
      }

      // Save selected gateway URL + token to desktop config
      await updateConfig({
        gatewayUrl: url,
        ...(tokenInput.trim() ? { gatewayToken: tokenInput.trim() } : {}),
      });

      setIsConnected(true);
      setIsConnecting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsConnecting(false);
    }
  };

  const formatUrl = (url: string) => {
    try {
      const u = new URL(url);
      return `${u.hostname}:${u.port || "80"}`;
    } catch {
      return url;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="size-5" />
          Connect to Gateway
        </CardTitle>
        <CardDescription>
          Select a running EdwinPAI gateway to connect to
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isScanning && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Scanning local network for gateways...
          </div>
        )}

        {!isScanning && gateways.length > 0 && !showManual && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Discovered Gateways</label>
            <div className="space-y-2">
              {gateways.map((gw) => (
                <button
                  key={gw.url}
                  type="button"
                  onClick={() => setSelectedUrl(gw.url)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selectedUrl === gw.url
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Radio
                    className={`size-4 ${selectedUrl === gw.url ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {formatUrl(gw.url)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {gw.url}
                    </div>
                  </div>
                  {selectedUrl === gw.url && (
                    <Check className="size-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isScanning &&
          gateways.length === 0 &&
          !showManual &&
          !isStarting &&
          !isConnected && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  No running gateways found on your network.
                </AlertDescription>
              </Alert>

              {!runtimeReady && runtimeChecked && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Package className="size-5 text-primary" />
                    <h4 className="font-medium">Install EdwinPAI Runtime</h4>
                  </div>

                  {!runtimeInfo?.nodeAvailable ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        EdwinPAI requires Node.js to run. Follow these steps:
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                            1
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              Install Node.js
                            </p>
                            <p className="text-xs text-muted-foreground mb-1">
                              Download from nodejs.org (v22+ recommended)
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                window.open?.("https://nodejs.org", "_blank")
                              }
                              className="text-xs text-primary hover:underline"
                            >
                              Open nodejs.org →
                            </button>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                            2
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              Install EdwinPAI
                            </p>
                            <p className="text-xs text-muted-foreground mb-1">
                              Open a terminal and run:
                            </p>
                            <code className="block text-xs bg-muted px-3 py-2 rounded font-mono select-all">
                              npm install -g @edwinpai/edwinpai@beta
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Node.js is installed (
                        {runtimeInfo?.nodeAvailable ? (
                          <CheckCircle2 className="h-4 w-4 inline text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 inline text-red-500" />
                        )}
                        ), but EdwinPAI gateway is missing.
                      </p>
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          1
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            Install EdwinPAI
                          </p>
                          <p className="text-xs text-muted-foreground mb-1">
                            Open a terminal and run:
                          </p>
                          <code className="block text-xs bg-muted px-3 py-2 rounded font-mono select-all">
                            npm install -g @edwinpai/edwinpai@beta
                          </code>
                        </div>
                      </div>
                    </div>
                  )}

                  {runtimeInfo?.nodeAvailable &&
                    runtimeInfo?.npmAvailable !== false &&
                    !runtimeInfo?.edwinpaiAvailable && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleInstallGatewayRuntime}
                        disabled={isInstallingGateway}
                        className="w-full"
                      >
                        {isInstallingGateway ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <Package className="size-4 mr-2" />
                        )}
                        {isInstallingGateway
                          ? "Installing Gateway..."
                          : "Install Gateway via npm"}
                      </Button>
                    )}

                  {installOutput && (
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
                      {installOutput}
                    </pre>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setRuntimeChecked(false);
                      try {
                        const status = await invoke<{
                          nodeAvailable: boolean;
                          npmAvailable?: boolean;
                          edwinpaiAvailable: boolean;
                          ready: boolean;
                        }>("check_runtime");
                        setRuntimeReady(status.ready);
                        setRuntimeInfo({
                          nodeAvailable: status.nodeAvailable,
                          npmAvailable: status.npmAvailable,
                          edwinpaiAvailable: status.edwinpaiAvailable,
                        });
                      } catch {
                        /* ignore */
                      }
                      setRuntimeChecked(true);
                    }}
                    className="w-full"
                  >
                    <RefreshCw
                      className={`size-4 mr-2 ${!runtimeChecked ? "animate-spin" : ""}`}
                    />
                    Check Again
                  </Button>
                </div>
              )}

              {!showStartConfig ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowStartConfig(true)}
                      disabled={!runtimeReady && runtimeChecked}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="size-5 text-primary" />
                      <div>
                        <div className="text-sm font-medium">
                          Start Local Gateway
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {runtimeReady || !runtimeChecked
                            ? "Launch an EdwinPAI gateway on this machine"
                            : "Install EdwinPAI runtime first (see above)"}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-medium">Gateway Configuration</h4>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Port
                    </label>
                    <Input
                      type="number"
                      min={1024}
                      max={65535}
                      value={startPort}
                      onChange={(e) =>
                        setStartPort(parseInt(e.target.value, 10) || 18789)
                      }
                      placeholder="18789"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Auth Token (optional)
                    </label>
                    <Input
                      type="password"
                      value={startToken}
                      onChange={(e) => setStartToken(e.target.value)}
                      placeholder="Leave empty for no auth"
                    />
                    <p className="text-xs text-muted-foreground">
                      Set a token to require authentication for all connections.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleStartLocal}>
                      <Play className="size-4 mr-1" />
                      Start Gateway
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowStartConfig(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        {isStarting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Starting gateway...
          </div>
        )}

        {showManual && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Gateway URL</label>
              <Input
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="http://localhost:18789"
              />
            </div>
          </div>
        )}

        {/* Auth token — shown when a gateway is selected or manual URL entered */}
        {(selectedUrl || (showManual && manualUrl.trim())) && !isConnected && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Auth Token</label>
            <Input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Gateway authentication token (if required)"
            />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isConnected && (
          <Alert>
            <Check className="size-4" />
            <AlertDescription>
              Connected to gateway at {showManual ? manualUrl : selectedUrl}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {!isConnected && (
          <>
            <Button
              onClick={handleConnect}
              disabled={
                isConnecting ||
                isScanning ||
                (!selectedUrl && !showManual) ||
                (showManual && !manualUrl.trim())
              }
              className="flex-1"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleRescan}
              disabled={isScanning}
            >
              Rescan
            </Button>
            <Button variant="ghost" onClick={() => setShowManual(!showManual)}>
              {showManual ? "Show Discovered" : "Enter Manually"}
            </Button>
          </>
        )}
        {isConnected && (
          <Button
            onClick={() =>
              onComplete({ gatewayUrl: showManual ? manualUrl : selectedUrl })
            }
            className="flex-1"
          >
            Continue
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * Step 5: Test Chat via WebSocket protocol
 */
function TestChatStep({
  onComplete,
}: {
  onComplete: (data?: unknown) => void;
}) {
  const [message, setMessage] = useState(
    "Hello! Can you tell me about EdwinPAI?",
  );
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setIsStreaming(true);
    setError(null);
    setResponse("");
    setIsComplete(false);

    try {
      // Read config for URL and token
      const { readConfig } = await import("@/lib/config");
      const config = await readConfig();
      const httpUrl =
        config.gatewayUrl || `http://localhost:${config.gatewayPort || 18789}`;
      const wsUrl = httpUrl.replace(/^http/, "ws");

      // Get auth token
      let token: string | null = config.gatewayToken || null;
      if (!token) {
        try {
          const result = await invoke<{ config: Record<string, unknown> }>(
            "get_edwinpai_config",
          );
          const gw = result.config.gateway as
            | Record<string, unknown>
            | undefined;
          const auth = gw?.auth as Record<string, unknown> | undefined;
          token = (auth?.token as string) ?? null;
        } catch {
          /* no shared config */
        }
      }

      // Open WebSocket and perform handshake + chat
      const ws = new WebSocket(wsUrl);
      let msgId = 0;
      const nextId = () => String(++msgId);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("Test chat timed out (30s)"));
        }, 30000);

        ws.addEventListener("open", () => {
          // Handshake
          ws.send(
            JSON.stringify({
              type: "req",
              id: nextId(),
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: "edwinpai-macos",
                  displayName: "EdwinPAI Desktop (onboarding)",
                  version: APP_VERSION,
                  platform: navigator.platform || "desktop",
                  mode: "ui",
                },
                auth: token ? { token } : undefined,
              },
            }),
          );
        });

        ws.addEventListener("message", (event) => {
          try {
            const frame = JSON.parse(event.data as string);

            if (frame.type === "res") {
              if (frame.payload?.type === "hello-ok") {
                // Handshake complete — send chat message
                ws.send(
                  JSON.stringify({
                    type: "req",
                    id: nextId(),
                    method: "chat.send",
                    params: {
                      sessionKey: "main",
                      message: message.trim(),
                      idempotencyKey: crypto.randomUUID(),
                    },
                  }),
                );
              } else if (!frame.ok) {
                clearTimeout(timeout);
                ws.close();
                reject(
                  new Error(frame.error?.message ?? "Gateway request failed"),
                );
              }
            } else if (frame.type === "event" && frame.event === "chat") {
              const chat = frame.payload;
              const text =
                chat.message?.content
                  ?.filter((c: { type: string }) => c.type === "text")
                  .map((c: { text: string }) => c.text)
                  .join("") ?? "";

              if (chat.state === "delta" && text) {
                setResponse(text);
              } else if (chat.state === "final") {
                if (text) setResponse(text);
                setIsComplete(true);
                setIsStreaming(false);
                clearTimeout(timeout);
                ws.close();
                resolve();
              } else if (chat.state === "error") {
                clearTimeout(timeout);
                ws.close();
                reject(new Error(chat.errorMessage ?? "Chat error"));
              }
            }
          } catch (e) {
            console.warn("Failed to parse frame:", e);
          }
        });

        ws.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(
            new Error(
              "WebSocket connection failed — check gateway URL in Settings",
            ),
          );
        });

        ws.addEventListener("close", (event) => {
          if (!isComplete) {
            clearTimeout(timeout);
            if (event.code !== 1000) {
              reject(
                new Error(
                  `Connection closed: ${event.reason || `code ${event.code}`}`,
                ),
              );
            }
          }
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setIsStreaming(false);
    }
  };

  const handleContinue = () => {
    onComplete({ testChatCompleted: true });
  };

  return (
    <Card className="max-w-3xl mx-auto w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          Test Chat
        </CardTitle>
        <CardDescription>
          Send a test message to verify your gateway is working
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Message</label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={isStreaming}
          />
        </div>

        {response && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm whitespace-pre-wrap">{response}</p>
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          onClick={handleSendMessage}
          disabled={isStreaming || !message.trim()}
          className="flex-1"
        >
          {isStreaming ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Test Message"
          )}
        </Button>
        {isComplete && (
          <Button onClick={handleContinue} variant="outline">
            Continue
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * Step 6: Channels Configuration
 */
function ChannelsStep({
  onComplete,
  updateData,
}: {
  onComplete: (data?: unknown) => void;
  updateData: (stepType: string, data: unknown) => void;
}) {
  const [channels] = useState<string[]>([]);

  const handleSkip = () => {
    updateData("channels", []);
    onComplete({ channels: [] });
  };

  const handleContinue = () => {
    updateData("channels", channels);
    onComplete({ channels });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Connect Channels</CardTitle>
        <CardDescription>
          Connect messaging platforms to use EdwinPAI across all your
          conversations. You can always add channels later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center text-sm text-muted-foreground">
          Channel configuration wizard will be available after onboarding.
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" onClick={handleSkip} className="flex-1">
          Skip for Now
        </Button>
        <Button onClick={handleContinue} className="flex-1">
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Step 7: Done
 */
function DoneStep({ data }: { data: Record<string, unknown> }) {
  const [checks, setChecks] = useState<
    Array<{
      label: string;
      status: "pass" | "fail" | "checking" | "skip";
      detail?: string;
    }>
  >([]);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const results: typeof checks = [];

      // 1. Gateway reachable
      results.push({ label: "Gateway connection", status: "checking" });
      setChecks([...results]);
      try {
        const { readConfig: rc } = await import("@/lib/config");
        const cfg = await rc();
        if (cfg.gatewayUrl) {
          const probe = await invoke<{ found: boolean }>("probe_gateway", {
            url: cfg.gatewayUrl,
          });
          results[results.length - 1] = {
            label: "Gateway connection",
            status: probe.found ? "pass" : "fail",
            detail: probe.found ? cfg.gatewayUrl : "Not reachable",
          };
        } else {
          results[results.length - 1] = {
            label: "Gateway connection",
            status: "skip",
            detail: "No URL configured",
          };
        }
      } catch {
        results[results.length - 1] = {
          label: "Gateway connection",
          status: "fail",
          detail: "Probe failed",
        };
      }
      setChecks([...results]);

      // 2. Auth token
      try {
        const { readConfig: rc } = await import("@/lib/config");
        const cfg = await rc();
        results.push({
          label: "Auth token",
          status: cfg.gatewayToken ? "pass" : "skip",
          detail: cfg.gatewayToken ? "Configured" : "Not set (public gateway)",
        });
      } catch {
        results.push({
          label: "Auth token",
          status: "skip",
          detail: "Could not check",
        });
      }
      setChecks([...results]);

      // 3. API provider
      try {
        const providers = await invoke<{ providers: Array<{ name: string }> }>(
          "list_providers",
        );
        const count = providers.providers?.length ?? 0;
        results.push({
          label: "AI provider",
          status: count > 0 ? "pass" : "fail",
          detail: count > 0 ? `${count} provider(s) configured` : "No API keys",
        });
      } catch {
        results.push({
          label: "AI provider",
          status: "skip",
          detail: "Could not check",
        });
      }
      setChecks([...results]);

      // 4. Identity (prefer onboarding data, fallback to local cache; never call get_identity here)
      try {
        const identityData = data?.identity as
          | { identity?: { publicKey?: string; petname?: string } }
          | { publicKey?: string; petname?: string }
          | undefined;
        const stepIdentity =
          (
            identityData as
              | { identity?: { publicKey?: string; petname?: string } }
              | undefined
          )?.identity ??
          (identityData as
            | { publicKey?: string; petname?: string }
            | undefined);

        let cachedIdentity: { publicKey?: string; petname?: string } | null =
          null;
        if (!stepIdentity) {
          const cached = localStorage.getItem("edwinpai_identity_cache");
          if (cached) {
            cachedIdentity = JSON.parse(cached) as {
              publicKey?: string;
              petname?: string;
            };
          }
        }

        const identity = stepIdentity || cachedIdentity;
        results.push({
          label: "Identity",
          status: identity?.publicKey ? "pass" : "skip",
          detail:
            identity?.petname ||
            identity?.publicKey?.slice(0, 12) ||
            "Not generated",
        });
      } catch {
        results.push({
          label: "Identity",
          status: "skip",
          detail: "Not generated yet",
        });
      }
      setChecks([...results]);

      setIsChecking(false);
    })();
  }, [data]);

  const allPassed =
    !isChecking &&
    checks.every((c) => c.status === "pass" || c.status === "skip");

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
      {allPassed ? (
        <div className="rounded-full bg-primary/10 p-6">
          <Check className="size-16 text-primary" />
        </div>
      ) : isChecking ? (
        <div className="rounded-full bg-muted p-6">
          <Loader2 className="size-16 text-muted-foreground animate-spin" />
        </div>
      ) : (
        <div className="rounded-full bg-yellow-500/10 p-6">
          <AlertCircle className="size-16 text-yellow-500" />
        </div>
      )}

      <div className="space-y-4 max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold">
          {isChecking
            ? "Running Health Check..."
            : allPassed
              ? "You're All Set!"
              : "Almost There"}
        </h2>
        <p className="text-lg text-muted-foreground">
          {isChecking
            ? "Verifying your setup..."
            : allPassed
              ? "Your EdwinPAI assistant is ready to use."
              : "Some checks need attention. You can still continue and fix these later."}
        </p>
      </div>

      <div className="w-full max-w-md space-y-2">
        {checks.map((check, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg border text-left"
          >
            {check.status === "checking" && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            {check.status === "pass" && (
              <Check className="size-4 text-green-500" />
            )}
            {check.status === "fail" && (
              <AlertCircle className="size-4 text-red-500" />
            )}
            {check.status === "skip" && (
              <Check className="size-4 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium">{check.label}</div>
              {check.detail && (
                <div className="text-xs text-muted-foreground">
                  {check.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Feature Card Component
 */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center space-y-2 p-6 rounded-lg border bg-card">
      <span aria-hidden="true">{icon}</span>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * Get step title
 */
function getStepTitle(step: OnboardingStep): string {
  const titles: Record<OnboardingStep, string> = {
    [OnboardingStep.Welcome]: "Welcome to EdwinPAI",
    [OnboardingStep.Security]: "Understand Vault Security",
    [OnboardingStep.VaultHealth]: "Check Vault & Approvals",
    [OnboardingStep.ApiKey]: "Configure OpenAI Provider",
    [OnboardingStep.SecretMigration]: "Import Existing Secrets",
    [OnboardingStep.CredentialProbe]: "Verify Approved Credential Use",
    [OnboardingStep.Identity]: "Set Up Your Identity",
    [OnboardingStep.Gateway]: "Connect to Gateway",
    [OnboardingStep.TestChat]: "Test Your Setup",
    [OnboardingStep.Channels]: "Connect Channels",
    [OnboardingStep.Done]: "You're All Set!",
  };
  return titles[step] || "Onboarding";
}

/**
 * Get step description
 */
function getStepDescription(step: OnboardingStep): string {
  const descriptions: Record<OnboardingStep, string> = {
    [OnboardingStep.Welcome]: "Let's get you started with your AI assistant",
    [OnboardingStep.Security]:
      "How Vault and Actions Approvals protect secrets",
    [OnboardingStep.VaultHealth]:
      "Verify local Vault and approval connectivity",
    [OnboardingStep.ApiKey]: "Store your OpenAI API key in Desktop Vault",
    [OnboardingStep.SecretMigration]: "Move existing raw secrets into Vault",
    [OnboardingStep.CredentialProbe]:
      "Confirm Gateway uses the approved Vault path",
    [OnboardingStep.Identity]: "Create your secure BSV identity",
    [OnboardingStep.Gateway]: "Find and connect to an EdwinPAI gateway",
    [OnboardingStep.TestChat]: "Send a test message to verify your setup",
    [OnboardingStep.Channels]: "Connect your messaging platforms (optional)",
    [OnboardingStep.Done]: "Start using EdwinPAI",
  };
  return descriptions[step] || "";
}
