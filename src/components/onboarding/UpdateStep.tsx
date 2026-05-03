/**
 * Update step for onboarding wizard.
 * Shows auto-update configuration options.
 */
export function UpdateStep() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Auto-Updates</h3>
      <p className="text-sm text-muted-foreground">
        EdwinPAI can automatically check for updates to keep you on the latest
        version. You can change this later in Settings.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="auto-update"
          defaultChecked
          className="rounded"
        />
        <label htmlFor="auto-update" className="text-sm">
          Check for updates automatically
        </label>
      </div>
    </div>
  );
}
