import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Monitor, Link } from "lucide-react";

interface ModeSelectorProps {
  onSelect: (mode: "gateway" | "client") => void;
}

export function ModeSelector({ onSelect }: ModeSelectorProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to EdwinPAI</h1>
        <p className="mt-2 text-muted-foreground">
          Are you setting up a new EdwinPAI, or connecting to an existing one?
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md">
        <Card
          className="cursor-pointer transition-colors hover:border-primary hover:bg-accent"
          onClick={() => onSelect("gateway")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-6 w-6" />
              Set up a new EdwinPAI
              <span className="ml-auto text-xs font-normal text-muted-foreground rounded-full bg-muted px-2 py-0.5">
                Gateway
              </span>
            </CardTitle>
            <CardDescription>
              Run EdwinPAI on this computer. It will be always on and manage your AI
              assistant. Other family members can connect to it.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:border-primary hover:bg-accent"
          onClick={() => onSelect("client")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-6 w-6" />
              Connect to an existing EdwinPAI
              <span className="ml-auto text-xs font-normal text-muted-foreground rounded-full bg-muted px-2 py-0.5">
                Client
              </span>
            </CardTitle>
            <CardDescription>
              Someone in your household already runs EdwinPAI. Connect to theirs.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
