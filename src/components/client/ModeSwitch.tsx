/**
 * Mode Switch - Toggle between Gateway and Client mode with confirmation
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

type Mode = "gateway" | "client";

interface ModeSwitchProps {
  currentMode: Mode;
  onModeChange: (newMode: Mode) => void;
  isGatewayRunning?: boolean;
  isClientConnected?: boolean;
}

export function ModeSwitch({
  currentMode,
  onModeChange,
  isGatewayRunning = false,
  isClientConnected = false,
}: ModeSwitchProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [targetMode, setTargetMode] = useState<Mode | null>(null);

  const handleModeClick = (mode: Mode) => {
    // Show confirmation if switching will disconnect active connections
    if (
      mode !== currentMode &&
      ((currentMode === "gateway" && isGatewayRunning) ||
        (currentMode === "client" && isClientConnected))
    ) {
      setTargetMode(mode);
      setShowConfirmation(true);
    } else {
      // Always fire — including re-selecting current mode (needed on mode-select screen)
      onModeChange(mode);
    }
  };

  const handleConfirm = () => {
    if (targetMode) {
      onModeChange(targetMode);
      setShowConfirmation(false);
      setTargetMode(null);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setTargetMode(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <ModeCard
          mode="gateway"
          isActive={currentMode === "gateway"}
          isRunning={isGatewayRunning}
          onClick={() => handleModeClick("gateway")}
        />
        <ModeCard
          mode="client"
          isActive={currentMode === "client"}
          isRunning={isClientConnected}
          onClick={() => handleModeClick("client")}
        />
      </div>

      {showConfirmation && (
        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-2">Switch Mode?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {currentMode === "gateway"
                  ? "Switching to client mode will stop your gateway. Any connected users will be disconnected."
                  : "Switching to gateway mode will disconnect you from the current gateway."}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm}>
                  Switch to {targetMode === "gateway" ? "Gateway" : "Client"}{" "}
                  Mode
                </Button>
              </div>
            </Card>
          </div>
        </Dialog>
      )}
    </>
  );
}

interface ModeCardProps {
  mode: Mode;
  isActive: boolean;
  isRunning: boolean;
  onClick: () => void;
}

function ModeCard({ mode, isActive, isRunning, onClick }: ModeCardProps) {
  const config = {
    gateway: {
      title: "Gateway Mode",
      description: "Run your own AI gateway and share access with others",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
      features: ["Full control", "Share with others", "Custom channels"],
    },
    client: {
      title: "Client Mode",
      description: "Connect to a remote gateway shared by someone else",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      features: ["Quick setup", "No configuration", "Guest access"],
    },
  };

  const { title, description, icon, features } = config[mode];

  return (
    <button
      onClick={onClick}
      className={`p-6 border-2 rounded-lg text-left transition-all ${
        isActive
          ? "border-primary bg-primary/5 hover:bg-primary/10 cursor-pointer"
          : "border-border hover:border-primary/50 hover:bg-accent cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={isActive ? "text-primary" : "text-muted-foreground"}>
          {icon}
        </div>
        {isActive && isRunning && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 border border-green-200 rounded-full">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-700 font-medium">Active</span>
          </div>
        )}
      </div>

      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <ul className="space-y-1">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isActive ? "text-primary" : ""}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      {isActive && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-medium text-primary">Current Mode</p>
        </div>
      )}
    </button>
  );
}
