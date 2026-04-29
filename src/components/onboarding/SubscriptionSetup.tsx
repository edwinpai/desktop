// Subscription setup during onboarding
export interface SubscriptionSetupProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export function SubscriptionSetup({ onComplete, onCancel }: SubscriptionSetupProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <h2 className="text-2xl font-bold">Subscription Setup</h2>
      <p className="text-muted-foreground">Verify your subscription to continue</p>
      <button onClick={onComplete} className="px-4 py-2 bg-primary text-primary-foreground rounded">
        Continue
      </button>
      {onCancel && (
        <button onClick={onCancel} className="text-sm text-muted-foreground">
          Skip for now
        </button>
      )}
    </div>
  );
}
