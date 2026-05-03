/**
 * Identity Setup Wizard Component (Phase 1)
 *
 * Multi-step wizard for generating and setting up BSV identity:
 * 1. Welcome/intro
 * 2. Generate keypair (calls Crypto Domain via IPC)
 * 3. Review identity (petname, identicon, public key)
 * 4. Backup recovery phrase
 * 5. Confirm backup
 * 6. Setup complete
 */

import { useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Key,
  Shield,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IdentityBadge } from "@/components/shared/IdentityBadge";
import { getIdentity } from "@/lib/crypto-domain";
import { IdentitySetupStep, type SetupIdentity } from "@/types/identity-setup";

interface IdentitySetupProps {
  onComplete: (identity: SetupIdentity) => void;
  onCancel?: () => void;
  initialStep?: IdentitySetupStep;
  allowSkipBackup?: boolean;
}

/**
 * Generate a BIP-39-style recovery phrase (12 words)
 * TODO: Phase 2 - Replace with actual BIP-39 mnemonic generation from Crypto Domain
 */
function generateRecoveryPhrase(): string[] {
  const words = [
    "abandon",
    "ability",
    "able",
    "about",
    "above",
    "absent",
    "absorb",
    "abstract",
    "absurd",
    "abuse",
    "access",
    "accident",
    "account",
    "accuse",
    "achieve",
    "acid",
    "acoustic",
    "acquire",
    "across",
    "act",
    "action",
    "actor",
    "actress",
    "actual",
    "adapt",
    "add",
    "addict",
    "address",
    "adjust",
    "admit",
    "adult",
    "advance",
  ];

  return Array.from({ length: 12 }, () => {
    const word = words[Math.floor(Math.random() * words.length)];
    if (!word) throw new Error("Failed to generate recovery word");
    return word;
  });
}

/**
 * Main Identity Setup Wizard
 */
export function IdentitySetup({
  onComplete,
  onCancel,
  initialStep = IdentitySetupStep.Welcome,
  allowSkipBackup = false,
}: IdentitySetupProps) {
  const [currentStep, setCurrentStep] =
    useState<IdentitySetupStep>(initialStep);
  const [identity, setIdentity] = useState<SetupIdentity | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState<string[]>(
    Array(12).fill(""),
  );

  /**
   * Generate a new BSV identity via Crypto Domain IPC
   * Calls Tauri: get_identity() which generates keypair if needed
   */
  const handleGenerateIdentity = async () => {
    setIsGenerating(true);

    try {
      // Call Crypto Domain to get or generate identity
      // This will create a new keypair if one doesn't exist in the keychain
      const identityResponse = await getIdentity();

      // Generate recovery phrase (TODO: Phase 2 - get from Crypto Domain)
      const recoveryPhrase = generateRecoveryPhrase();

      setIdentity({
        publicKey: identityResponse.public_key,
        petname: identityResponse.petname,
        avatarSvg: identityResponse.avatar_svg,
        shortId: identityResponse.short_id,
        recoveryPhrase,
        backupConfirmed: false,
      });

      setIsGenerating(false);
    } catch (error) {
      console.error("Failed to generate identity:", error);
      setIsGenerating(false);
      // TODO: Show error toast to user
    }
  };

  /**
   * Move to next step
   */
  const handleNext = () => {
    const steps = Object.values(IdentitySetupStep);
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      if (nextStep) {
        setCurrentStep(nextStep);
      }
    }
  };

  /**
   * Move to previous step
   */
  const handleBack = () => {
    const steps = Object.values(IdentitySetupStep);
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1];
      if (prevStep) {
        setCurrentStep(prevStep);
      }
    }
  };

  /**
   * Validate recovery phrase input
   */
  const validateRecoveryPhrase = (): boolean => {
    if (!identity?.recoveryPhrase) return false;
    const phrase = identity.recoveryPhrase;
    return recoveryInput.every((word, i) => {
      const expectedWord = phrase[i];
      return expectedWord ? word.toLowerCase() === expectedWord : false;
    });
  };

  /**
   * Render current step
   */
  const renderStep = () => {
    switch (currentStep) {
      case IdentitySetupStep.Welcome:
        return (
          <WelcomeStep
            onNext={handleNext}
            {...(onCancel ? { onCancel } : {})}
          />
        );

      case IdentitySetupStep.GenerateKey:
        // Auto-generate identity if not already present
        if (!identity && !isGenerating) {
          void handleGenerateIdentity();
        }
        return (
          <GenerateKeyStep
            isGenerating={isGenerating}
            identity={identity}
            onNext={handleNext}
            onBack={handleBack}
          />
        );

      case IdentitySetupStep.ReviewIdentity:
        if (!identity) return null;
        return (
          <ReviewIdentityStep
            identity={identity}
            onNext={handleNext}
            onBack={handleBack}
          />
        );

      case IdentitySetupStep.BackupKey:
        if (!identity) return null;
        return (
          <BackupKeyStep
            identity={identity}
            onNext={handleNext}
            onBack={handleBack}
            allowSkip={allowSkipBackup}
          />
        );

      case IdentitySetupStep.ConfirmBackup:
        if (!identity) return null;
        return (
          <ConfirmBackupStep
            identity={identity}
            recoveryInput={recoveryInput}
            onRecoveryInputChange={setRecoveryInput}
            isValid={validateRecoveryPhrase()}
            onNext={() => {
              setBackupConfirmed(true);
              handleNext();
            }}
            onBack={handleBack}
          />
        );

      case IdentitySetupStep.Complete:
        if (!identity) return null;
        return (
          <CompleteStep
            identity={identity}
            onComplete={() => onComplete({ ...identity, backupConfirmed })}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 p-8 bg-background">
      {renderStep()}
    </div>
  );
}

/**
 * Step 1: Welcome
 */
function WelcomeStep({
  onNext,
  onCancel,
}: {
  onNext: () => void;
  onCancel?: () => void;
}) {
  return (
    <>
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to EdwinPAI
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          EdwinPAI uses BSV blockchain technology to create a secure,
          decentralized identity for you. Your keys, your data, your AI
          assistant.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your Identity</CardTitle>
          <CardDescription>
            We'll generate a unique cryptographic identity stored securely on
            your device. No usernames, no passwords—just your keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Key className="size-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Secure & Private</p>
              <p className="text-sm text-muted-foreground">
                Your private key never leaves your device
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="size-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">You're in Control</p>
              <p className="text-sm text-muted-foreground">
                No central authority can access or revoke your identity
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          )}
          <Button onClick={onNext} className="flex-1">
            Get Started <ChevronRight className="ml-1 size-4" />
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

/**
 * Step 2: Generate Key
 */
function GenerateKeyStep({
  isGenerating,
  identity,
  onNext,
  onBack,
}: {
  isGenerating: boolean;
  identity: SetupIdentity | null;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {isGenerating ? "Generating Your Identity..." : "Identity Created"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isGenerating
            ? "Creating your BSV keypair..."
            : "Your unique cryptographic identity is ready"}
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {isGenerating ? "Please wait" : `You are ${identity?.petname}`}
          </CardTitle>
          <CardDescription>
            {isGenerating
              ? "Generating secure keypair using your device's hardware..."
              : "This is your EdwinPAI identity. It's stored securely in your system keychain."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {identity && !isGenerating ? (
            <IdentityBadge
              publicKey={identity.publicKey}
              petname={identity.petname}
              size="lg"
            />
          ) : (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={isGenerating}>
            <ChevronLeft className="mr-1 size-4" /> Back
          </Button>
          <Button
            onClick={onNext}
            disabled={isGenerating || !identity}
            className="flex-1"
          >
            Continue <ChevronRight className="ml-1 size-4" />
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

/**
 * Step 3: Review Identity
 */
function ReviewIdentityStep({
  identity,
  onNext,
  onBack,
}: {
  identity: SetupIdentity;
  onNext: () => void;
  onBack: () => void;
}) {
  const [showFullKey, setShowFullKey] = useState(false);

  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Review Your Identity
        </h1>
        <p className="mt-2 text-muted-foreground">
          This is how you'll appear to others in the EdwinPAI network
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{identity.petname}</CardTitle>
          <CardDescription>
            Your petname and avatar are derived from your public key
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <IdentityBadge
            publicKey={identity.publicKey}
            petname={identity.petname}
            size="lg"
          />

          <div>
            <p className="text-sm font-medium mb-2">Short ID</p>
            <p className="font-mono text-sm text-muted-foreground bg-muted px-3 py-2 rounded">
              {identity.shortId}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Public Key</p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowFullKey(!showFullKey)}
              >
                {showFullKey ? "Hide" : "Show"}
              </Button>
            </div>
            {showFullKey && (
              <p className="font-mono text-xs text-muted-foreground bg-muted px-3 py-2 rounded break-all">
                {identity.publicKey}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1 size-4" /> Back
          </Button>
          <Button onClick={onNext} className="flex-1">
            Continue <ChevronRight className="ml-1 size-4" />
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

/**
 * Step 4: Backup Key
 */
function BackupKeyStep({
  identity,
  onNext,
  onBack,
  allowSkip,
}: {
  identity: SetupIdentity;
  onNext: () => void;
  onBack: () => void;
  allowSkip?: boolean;
}) {
  const handleDownload = () => {
    // In production, export encrypted key backup
    // TODO: Implement actual backup download
    console.log("Backup download triggered");
  };

  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Back Up Your Key</h1>
        <p className="mt-2 text-muted-foreground">
          Save your recovery phrase to restore access if you lose your device
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recovery Phrase</CardTitle>
          <CardDescription>
            Write down these 12 words in order. Keep them safe and never share
            them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {identity.recoveryPhrase?.map((word, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted px-3 py-2 rounded"
              >
                <span className="text-xs text-muted-foreground w-5">
                  {index + 1}.
                </span>
                <span className="font-mono text-sm">{word}</span>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button variant="outline" onClick={handleDownload} className="w-full">
            <Download className="mr-2 size-4" />
            Download Backup
          </Button>
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={onBack}>
              <ChevronLeft className="mr-1 size-4" /> Back
            </Button>
            <Button onClick={onNext} className="flex-1">
              I've Saved My Phrase <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
          {allowSkip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              className="w-full"
            >
              Skip for now (not recommended)
            </Button>
          )}
        </CardFooter>
      </Card>
    </>
  );
}

/**
 * Step 5: Confirm Backup
 */
function ConfirmBackupStep({
  recoveryInput,
  onRecoveryInputChange,
  isValid,
  onNext,
  onBack,
}: {
  identity: SetupIdentity;
  recoveryInput: string[];
  onRecoveryInputChange: (input: string[]) => void;
  isValid: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  // Randomly select 3 words to verify
  const [selectedIndices] = useState(() => {
    const indices = Array.from({ length: 12 }, (_, i) => i);
    return indices
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .sort((a, b) => a - b);
  });

  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Confirm Your Backup
        </h1>
        <p className="mt-2 text-muted-foreground">
          Enter the following words from your recovery phrase
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Recovery Phrase</CardTitle>
          <CardDescription>
            Enter the words at the specified positions to confirm you've saved
            them
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedIndices.map((index) => (
            <div key={index}>
              <label className="text-sm font-medium mb-2 block">
                Word #{index + 1}
              </label>
              <input
                type="text"
                value={recoveryInput[index]}
                onChange={(e) => {
                  const newInput = [...recoveryInput];
                  newInput[index] = e.target.value;
                  onRecoveryInputChange(newInput);
                }}
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder={`Enter word #${index + 1}`}
              />
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1 size-4" /> Back
          </Button>
          <Button onClick={onNext} disabled={!isValid} className="flex-1">
            Confirm <ChevronRight className="ml-1 size-4" />
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

/**
 * Step 6: Complete
 */
function CompleteStep({
  identity,
  onComplete,
}: {
  identity: SetupIdentity;
  onComplete: () => void;
}) {
  return (
    <>
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Check className="size-12 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">All Set!</h1>
        <p className="mt-2 text-muted-foreground">
          Your EdwinPAI identity is ready to use
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome, {identity.petname}</CardTitle>
          <CardDescription>
            Your identity has been created and backed up successfully
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IdentityBadge
            publicKey={identity.publicKey}
            petname={identity.petname}
            size="lg"
          />
        </CardContent>
        <CardFooter>
          <Button onClick={onComplete} className="w-full">
            Continue to EdwinPAI <ChevronRight className="ml-1 size-4" />
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
