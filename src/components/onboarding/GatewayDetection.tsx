/**
 * GatewayDetection - Auto-detect running EdwinPAI gateway and pre-fill onboarding
 *
 * Uses Tauri command to probe localhost:18789 for a running gateway.
 * Bypasses CSP/CORS issues by making HTTP requests from Rust.
 * If found, allows user to skip most onboarding steps.
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, Loader2, Wifi, WifiOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { readConfig } from "@/lib/config";
import type { GatewayProfile } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface GatewayDetectionProps {
  onGatewayFound: (info: GatewayInfo) => void;
  onSkip: () => void;
}

interface GatewayInfo {
  url: string;
  status: "running" | "error";
}

interface ProbeResult {
  found: boolean;
  url: string | null;
  error: string | null;
}

export function GatewayDetection({
  onGatewayFound,
  onSkip,
}: GatewayDetectionProps) {
  const [checking, setChecking] = useState(true);
  const [found, setFound] = useState<GatewayInfo | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<GatewayProfile[]>([]);

  const detectGateway = useCallback(async () => {
    setChecking(true);

    try {
      const config = await readConfig().catch(() => null);
      setSavedProfiles(config?.gatewayProfiles ?? []);
    } catch {
      setSavedProfiles([]);
    }

    try {
      // Use Tauri command to probe — bypasses CSP/CORS
      const result = await invoke<ProbeResult>("probe_gateway");
      if (result.found && result.url) {
        setFound({ url: result.url, status: "running" });
      }
    } catch {
      // Probe command failed — gateway not found
    }

    setChecking(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void detectGateway();
    }, 0);

    return () => clearTimeout(timeout);
  }, [detectGateway]);

  if (checking) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Looking for a running EdwinPAI gateway...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (found) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Wifi className="size-5" />
            EdwinPAI Gateway Found!
          </CardTitle>
          <CardDescription>
            An EdwinPAI gateway is already running on this machine
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {savedProfiles.length > 1 && (
            <div className="rounded-lg border border-border p-3 text-left space-y-2">
              <div className="text-sm font-medium">Saved gateway profiles</div>
              <div className="text-xs text-muted-foreground">
                Choose a saved profile for this Desktop window. This does not
                change the global default used by other windows.
              </div>
              <div className="grid gap-2 pt-1">
                {savedProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem(
                        "edwinpai_active_gateway_profile_id",
                        profile.id,
                      );
                      window.dispatchEvent(
                        new CustomEvent("edwinpai:gateway-profile-selected", {
                          detail: { profileId: profile.id },
                        }),
                      );
                      onGatewayFound({
                        url: profile.gatewayUrl,
                        status: "running",
                      });
                    }}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:border-primary/60 hover:bg-primary/5"
                  >
                    <span>
                      <span className="block text-sm font-medium">
                        {profile.name || profile.id}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {profile.gatewayUrl}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {profile.ssh?.enabled ? "ssh" : "direct"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Check className="size-4 text-green-600" />
            <span className="text-sm">
              Gateway running at{" "}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                {found.url}
              </code>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="size-4 text-green-600" />
            <span className="text-sm">API keys already configured</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="size-4 text-green-600" />
            <span className="text-sm">Ready to chat</span>
          </div>

          <Alert className="mt-4">
            <AlertDescription>
              Your EdwinPAI gateway is already set up. You can skip the setup
              wizard and start using EdwinPAI Desktop right away.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button onClick={() => onGatewayFound(found)} className="flex-1">
            <Check className="mr-2 size-4" />
            Connect to Gateway
          </Button>
          <Button variant="outline" onClick={onSkip}>
            Choose Another / Manual Setup
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WifiOff className="size-5 text-muted-foreground" />
          No Gateway Detected
        </CardTitle>
        <CardDescription>
          Let's set one up — it only takes a minute
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          EdwinPAI needs a gateway to connect to AI providers. We'll walk you
          through setting one up.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={onSkip} className="w-full">
          Start Setup
        </Button>
      </CardFooter>
    </Card>
  );
}
