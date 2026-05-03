/**
 * AppLockSettings - Enable/disable PIN lock from Settings
 */

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Unlock, CheckCircle, AlertCircle } from "lucide-react";

export function AppLockSettings() {
  const [hasLock, setHasLock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [disablePin, setDisablePin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    invoke<boolean>("has_app_lock")
      .then(setHasLock)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSetPin = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 characters");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    try {
      await invoke("set_app_lock", { pin });
      setHasLock(true);
      setShowSetup(false);
      setPin("");
      setConfirmPin("");
      setError("");
      setSuccess("App lock enabled. PIN required on next launch.");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set PIN");
    }
  };

  const handleDisable = async () => {
    try {
      await invoke("disable_app_lock", { pin: disablePin });
      setHasLock(false);
      setShowDisable(false);
      setDisablePin("");
      setError("");
      setSuccess("App lock disabled.");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect PIN");
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              App Lock
            </CardTitle>
            <CardDescription>
              Require a PIN to access EdwinPAI Desktop on launch
            </CardDescription>
          </div>
          <Badge variant={hasLock ? "default" : "secondary"}>
            {hasLock ? (
              <>
                <Lock className="h-4 w-4 inline mr-1" /> Enabled
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 inline mr-1" /> Disabled
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {success && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 rounded-md px-3 py-2">
            <CheckCircle className="h-4 w-4" />
            {success}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!hasLock && !showSetup && (
          <Button
            onClick={() => {
              setShowSetup(true);
              setError("");
            }}
          >
            <Lock className="h-4 w-4 mr-2" />
            Set Up PIN
          </Button>
        )}

        {hasLock && !showDisable && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDisable(true);
                setError("");
              }}
            >
              Disable Lock
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowSetup(true);
                setError("");
              }}
            >
              Change PIN
            </Button>
          </div>
        )}

        {showSetup && (
          <div className="space-y-3 p-4 rounded-md border">
            <div>
              <Label>New PIN</Label>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN (4+ characters)"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Confirm PIN</Label>
              <Input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm PIN"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSetPin} disabled={pin.length < 4}>
                Save PIN
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowSetup(false);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {showDisable && (
          <div className="space-y-3 p-4 rounded-md border">
            <div>
              <Label>Current PIN</Label>
              <Input
                type="password"
                value={disablePin}
                onChange={(e) => setDisablePin(e.target.value)}
                placeholder="Enter current PIN"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDisable}>
                Disable Lock
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDisable(false);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
