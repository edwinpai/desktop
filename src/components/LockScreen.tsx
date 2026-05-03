/**
 * LockScreen - PIN protection for EdwinPAI Desktop
 *
 * Shows on app launch when app lock is enabled.
 * PIN is verified against HMAC-SHA256(pin, identity_key).
 */

import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, Lock, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load failed attempts count
    invoke<{ failedAttempts: number }>("get_lock_status")
      .then((status) => setFailedAttempts(status.failedAttempts))
      .catch(() => {});
    // Focus input
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pin.trim() || verifying) return;

    setVerifying(true);
    setError("");

    try {
      const valid = await invoke<boolean>("verify_app_lock", { pin });
      if (valid) {
        onUnlock();
      } else {
        setFailedAttempts((prev) => prev + 1);
        setError("Incorrect PIN");
        setPin("");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
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
          <h1 className="text-2xl font-bold">EdwinPAI Desktop</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your PIN to unlock
          </p>
        </div>

        {/* PIN Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="pl-10 text-center text-lg tracking-widest"
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
              {failedAttempts > 2 && (
                <span className="text-xs text-muted-foreground">
                  ({failedAttempts} failed attempts)
                </span>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!pin.trim() || verifying}
          >
            <Shield className="h-4 w-4 mr-2" />
            {verifying ? "Verifying..." : "Unlock"}
          </Button>
        </form>

        {/* Security info */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Protected by BSV cryptographic identity
        </p>
      </div>
    </div>
  );
}
