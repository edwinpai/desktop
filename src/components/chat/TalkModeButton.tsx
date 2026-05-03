/**
 * TalkModeButton — Mic toggle for voice conversation mode
 *
 * States:
 * - idle:       Mic icon, click to start listening
 * - listening:  Pulsing red indicator, click to stop and send
 * - processing: Spinner, waiting for LLM reply + TTS
 * - speaking:   Speaker icon with animation, click to interrupt
 */

import { Mic, MicOff, Loader2, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TalkPhase } from "@/hooks/useTalkMode";

interface TalkModeButtonProps {
  phase: TalkPhase;
  error?: string | null;
  onToggle: () => void;
  onCancel: () => void;
}

export function TalkModeButton({
  phase,
  error,
  onToggle,
  onCancel,
}: TalkModeButtonProps) {
  const isActive = phase !== "idle";

  return (
    <div className="relative flex items-center gap-1">
      <Button
        type="button"
        variant={isActive ? "default" : "outline"}
        size="icon"
        onClick={onToggle}
        aria-label={phaseLabel(phase)}
        title={phaseTitle(phase)}
        className={cn(
          "h-[60px] w-[60px] transition-all",
          phase === "listening" && "bg-red-600 hover:bg-red-700 animate-pulse",
          phase === "processing" && "bg-amber-600 hover:bg-amber-700",
          phase === "speaking" && "bg-green-600 hover:bg-green-700",
        )}
      >
        {phase === "idle" && <Mic className="h-5 w-5" />}
        {phase === "listening" && <MicOff className="h-5 w-5" />}
        {phase === "processing" && <Loader2 className="h-5 w-5 animate-spin" />}
        {phase === "speaking" && <Volume2 className="h-5 w-5" />}
      </Button>

      {isActive && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Cancel voice mode"
          className="h-8 w-8 absolute -top-2 -right-2 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {error && (
        <span className="absolute -bottom-6 left-0 text-xs text-destructive whitespace-nowrap">
          {error}
        </span>
      )}
    </div>
  );
}

function phaseLabel(phase: TalkPhase): string {
  switch (phase) {
    case "idle":
      return "Start voice input";
    case "listening":
      return "Stop recording";
    case "processing":
      return "Processing voice...";
    case "speaking":
      return "Stop playback";
  }
}

function phaseTitle(phase: TalkPhase): string {
  switch (phase) {
    case "idle":
      return "Click to talk";
    case "listening":
      return "Click to send recording";
    case "processing":
      return "Transcribing & thinking...";
    case "speaking":
      return "Click to stop";
  }
}
