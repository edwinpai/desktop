/**
 * TopBar - Top navigation bar with identity and status
 *
 * Displays:
 * - App title/logo
 * - Identity badge (petname + avatar)
 * - Gateway status indicator
 * - Subscription status
 */

import { useIdentityStore } from "@/stores/identityStore";
import { useGatewayStore } from "@/stores/gateway";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TopBar() {
  const identity = useIdentityStore((state) => state.identity);
  const gatewayStatus = useGatewayStore((state) => state.status);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      {/* App title */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">EdwinPAI Desktop</h1>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-3">
        {/* Gateway status */}
        <Badge
          variant={gatewayStatus === "running" ? "default" : "secondary"}
          className={cn(
            "flex items-center gap-1.5",
            gatewayStatus === "running" && "bg-green-500",
            gatewayStatus === "starting" && "bg-yellow-500",
            gatewayStatus === "unhealthy" && "bg-red-500",
            gatewayStatus === "stopped" && "bg-gray-500",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              gatewayStatus === "running" && "bg-white animate-pulse",
              gatewayStatus !== "running" && "bg-white/70",
            )}
          />
          <span className="text-xs">
            {gatewayStatus === "running" && "Online"}
            {gatewayStatus === "starting" && "Starting..."}
            {gatewayStatus === "stopped" && "Offline"}
            {gatewayStatus === "unhealthy" && "Unhealthy"}
            {gatewayStatus === "crashed" && "Crashed"}
          </span>
        </Badge>

        {/* Identity */}
        {identity && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
            <div className="h-6 w-6 rounded-full bg-primary" />
            <span className="text-sm font-medium">{identity.petname}</span>
          </div>
        )}
      </div>
    </header>
  );
}
