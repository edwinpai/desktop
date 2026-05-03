/**
 * PinSetup - First-time PIN creation for app lock
 *
 * Two-step: enter PIN → confirm PIN → save
 */

import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, Lock, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PinSetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function PinSetup({ onComplete, onSkip }: PinSetupProps) {
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pin.length < 4) {
      setError("PIN must be at least 4 characters");
      return;
    }
    setError("");
    setStep("confirm");
  };

  const handleConfirm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (confirmPin !== pin) {
      setError("PINs do not match");
      setConfirmPin("");
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError("");

    try {
      await invoke("set_app_lock", { pin });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set PIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Secure Your EdwinPAI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "create"
              ? "Set a PIN to protect access to your EdwinPAI Desktop"
              : "Confirm your PIN"}
          </p>
        </div>

        {step === "create" ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Create a PIN (4+ characters)"
                className="pl-10 text-center text-lg tracking-widest"
                autoFocus
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={pin.length < 4}>
              <Shield className="h-4 w-4 mr-2" /> Continue
            </Button>

            {onSkip && (
              <Button variant="ghost" className="w-full" onClick={onSkip}>
                Skip for now
              </Button>
            )}
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="relative">
              <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm your PIN"
                className="pl-10 text-center text-lg tracking-widest"
                autoFocus
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={saving || !confirmPin}
            >
              <Shield className="h-4 w-4 mr-2" />
              {saving ? "Setting up..." : "Set PIN"}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("create");
                setConfirmPin("");
                setError("");
              }}
            >
              Back
            </Button>
          </form>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6">
          Your PIN is secured with your BSV cryptographic identity.
          <br />
          It cannot be recovered — choose something memorable.
        </p>
      </div>
    </div>
  );
}
