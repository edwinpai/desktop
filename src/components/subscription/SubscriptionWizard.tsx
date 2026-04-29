/**
 * SubscriptionWizard Component
 *
 * Onboarding flow for new users (no blockchain jargon):
 * 1. Welcome - explain what EdwinPAI does
 * 2. Choose Plan - pricing tiers
 * 3. Setup - connect wallet/create UTXO
 * 4. Complete - confirmation
 */

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SubscriptionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type WizardStep = 'welcome' | 'choose-plan' | 'setup' | 'complete';

interface PricingTier {
  id: string;
  name: string;
  price: string;
  features: string[];
  recommended?: boolean;
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: '$5/month',
    features: [
      'Access to AI assistant',
      'Up to 100 messages/day',
      'Community channels',
      'Basic support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$15/month',
    features: [
      'Everything in Basic',
      'Unlimited messages',
      'Private channels',
      'Priority support',
      'Advanced features',
    ],
    recommended: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: '$50/month',
    features: [
      'Everything in Pro',
      'Up to 10 team members',
      'Admin dashboard',
      'Custom branding',
      'Dedicated support',
    ],
  },
];

export function SubscriptionWizard({
  open,
  onOpenChange,
  onComplete,
}: SubscriptionWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [selectedPlan, setSelectedPlan] = useState<string>('pro');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = () => {
    if (step === 'welcome') {
      setStep('choose-plan');
    } else if (step === 'choose-plan') {
      setStep('setup');
    } else if (step === 'setup') {
      handleSetup();
    }
  };

  const handleBack = () => {
    if (step === 'choose-plan') {
      setStep('welcome');
    } else if (step === 'setup') {
      setStep('choose-plan');
    }
  };

  const handleSetup = async () => {
    setIsProcessing(true);
    try {
      // TODO: Call IPC command to create subscription UTXO
      // For now, simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setStep('complete');
    } catch (error) {
      console.error('Subscription setup failed:', error);
      // TODO: Show error message
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    onComplete();
    onOpenChange(false);
    // Reset wizard state
    setTimeout(() => {
      setStep('welcome');
      setSelectedPlan('pro');
    }, 300);
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return <WelcomeStep onNext={handleNext} />;

      case 'choose-plan':
        return (
          <ChoosePlanStep
            selectedPlan={selectedPlan}
            onSelectPlan={setSelectedPlan}
            onNext={handleNext}
            onBack={handleBack}
          />
        );

      case 'setup':
        return (
          <SetupStep
            selectedPlan={selectedPlan}
            isProcessing={isProcessing}
            onBack={handleBack}
            onNext={handleNext}
          />
        );

      case 'complete':
        return <CompleteStep onFinish={handleFinish} />;

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}

// --- Step Components ---

interface WelcomeStepProps {
  onNext: () => void;
}

function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">Welcome to EdwinPAI</DialogTitle>
        <DialogDescription className="text-base">
          Your intelligent assistant for productivity and collaboration
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What is EdwinPAI?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              EdwinPAI is your personal AI assistant that helps you work smarter.
              Get instant answers, collaborate with others, and access powerful
              tools—all in one place.
            </p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Chat with an advanced AI that understands context</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Join channels to collaborate with your team</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Access your data from anywhere, securely</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button onClick={onNext} size="lg">
            Get Started
          </Button>
        </div>
      </div>
    </>
  );
}

interface ChoosePlanStepProps {
  selectedPlan: string;
  onSelectPlan: (planId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function ChoosePlanStep({
  selectedPlan,
  onSelectPlan,
  onNext,
  onBack,
}: ChoosePlanStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">Choose Your Plan</DialogTitle>
        <DialogDescription className="text-base">
          Select the plan that works best for you
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <Card
            key={tier.id}
            className={cn(
              'cursor-pointer transition-all hover:border-primary',
              selectedPlan === tier.id && 'border-primary ring-2 ring-primary/20',
              tier.recommended && 'border-primary/50',
            )}
            onClick={() => onSelectPlan(tier.id)}
          >
            <CardHeader>
              {tier.recommended && (
                <div className="text-xs font-semibold text-primary">
                  RECOMMENDED
                </div>
              )}
              <CardTitle className="text-lg">{tier.name}</CardTitle>
              <div className="text-2xl font-bold">{tier.price}</div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Continue with {PRICING_TIERS.find((t) => t.id === selectedPlan)?.name}
        </Button>
      </div>
    </>
  );
}

interface SetupStepProps {
  selectedPlan: string;
  isProcessing: boolean;
  onBack: () => void;
  onNext: () => void;
}

function SetupStep({
  selectedPlan,
  isProcessing,
  onBack,
  onNext,
}: SetupStepProps) {
  const plan = PRICING_TIERS.find((t) => t.id === selectedPlan);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">Setup Your Subscription</DialogTitle>
        <DialogDescription className="text-base">
          Securely activate your {plan?.name} plan
        </DialogDescription>
      </DialogHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selected Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{plan?.name}</span>
            <span className="text-lg font-bold">{plan?.price}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Your subscription will be activated using a secure, decentralized
            payment method. You maintain full control of your funds.
          </p>
        </CardContent>
      </Card>

      {isProcessing && (
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Setting up your subscription...</span>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          Back
        </Button>
        <Button onClick={onNext} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Activate Subscription'}
        </Button>
      </div>
    </>
  );
}

interface CompleteStepProps {
  onFinish: () => void;
}

function CompleteStep({ onFinish }: CompleteStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">You're All Set!</DialogTitle>
        <DialogDescription className="text-base">
          Your subscription is now active
        </DialogDescription>
      </DialogHeader>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10 text-green-500">
            <svg
              className="size-8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Subscription Active</h3>
            <p className="text-sm text-muted-foreground">
              You now have full access to all EdwinPAI features. Start chatting,
              join channels, and explore everything EdwinPAI has to offer.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            <p className="font-medium">Next Steps:</p>
            <ul className="mt-2 space-y-1 pl-4 text-muted-foreground">
              <li>• Start a conversation with EdwinPAI</li>
              <li>• Browse and join community channels</li>
              <li>• Customize your profile and settings</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={onFinish}>
          Start Using EdwinPAI
        </Button>
      </div>
    </>
  );
}
