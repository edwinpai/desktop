/**
 * Client Mode Flow - 4-step wizard for connecting to a gateway
 * Steps: Discover → Select → Authenticate → Connect
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DiscoveredPeer } from "@/types/api";
import { DiscoveryList } from "./DiscoveryList";
import { ConnectionStatus } from "./ConnectionStatus";
import { useDiscovery } from "@/hooks/useDiscovery";
import { useClientConnection } from "@/hooks/useClientConnection";

type WizardStep = "discover" | "select" | "auth" | "connect";

interface ClientModeFlowProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function ClientModeFlow({ onComplete, onCancel }: ClientModeFlowProps) {
  const [step, setStep] = useState<WizardStep>("discover");
  const [selectedPeer, setSelectedPeer] = useState<DiscoveredPeer | null>(null);

  const { peers, isScanning, startScan, stopScan } = useDiscovery();
  const { connect, connectionStatus, error } = useClientConnection();

  useEffect(() => {
    if (step === "discover") {
      startScan();
    }
    return () => stopScan();
  }, [step, startScan, stopScan]);

  const handlePeerSelect = (peer: DiscoveredPeer) => {
    setSelectedPeer(peer);
    setStep("select");
  };

  const handleAuth = async () => {
    if (!selectedPeer) return;
    setStep("auth");

    // Start connection process
    const success = await connect({
      gatewayAddress: selectedPeer.address,
      gatewayPubkey: selectedPeer.pubkey,
    });

    if (success) {
      setStep("connect");
    }
  };

  const handleComplete = () => {
    stopScan();
    onComplete?.();
  };

  const handleBack = () => {
    if (step === "select") setStep("discover");
    else if (step === "auth") setStep("select");
  };

  const handleCancel = () => {
    stopScan();
    setSelectedPeer(null);
    setStep("discover");
    onCancel?.();
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-8">
        {(["discover", "select", "auth", "connect"] as const).map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : i < ["discover", "select", "auth", "connect"].indexOf(step)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            {i < 3 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  i < ["discover", "select", "auth", "connect"].indexOf(step)
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === "discover" && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Discover Gateways</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Scanning your local network for EdwinPAI gateways...
          </p>

          <DiscoveryList
            peers={peers}
            onSelect={handlePeerSelect}
            isScanning={isScanning}
          />

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {step === "select" && selectedPeer && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Confirm Gateway</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Petname</p>
              <p className="text-sm text-muted-foreground">
                {selectedPeer.petname}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Address</p>
              <p className="text-sm text-muted-foreground font-mono">
                {selectedPeer.address}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Public Key</p>
              <p className="text-sm text-muted-foreground font-mono break-all">
                {selectedPeer.pubkey}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleAuth}>Connect</Button>
          </div>
        </Card>
      )}

      {(step === "auth" || step === "connect") && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {step === "auth" ? "Authenticating..." : "Connected"}
          </h2>

          <ConnectionStatus
            status={connectionStatus}
            gatewayName={selectedPeer?.petname}
            error={error}
          />

          <div className="flex justify-end gap-2 mt-6">
            {step === "connect" && (
              <Button onClick={handleComplete}>Continue to Chat</Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
