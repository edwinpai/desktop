/**
 * SubscriptionSettings Component
 *
 * Settings panel showing:
 * - Subscription status with colored badge
 * - Grace period countdown (for Cached state)
 * - UTXO details (txid/vout/block height)
 * - Actions: Refresh, Renew, Cancel
 */

import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

export interface SubscriptionSettingsProps {
  onRenew?: () => void;
  onCancel?: () => void;
}

export function SubscriptionSettings({
  onRenew,
  onCancel,
}: SubscriptionSettingsProps) {
  const subscription = useSubscriptionStatus();

  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleString();
  };

  const formatTimeRemaining = (ms: number | null) => {
    if (ms === null) return null;

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusIcon = () => {
    switch (subscription.state) {
      case "Active":
        return <CheckCircle2 className="size-5 text-green-500" />;
      case "Cached":
        return <AlertCircle className="size-5 text-yellow-500" />;
      case "Expired":
        return <XCircle className="size-5 text-red-500" />;
      case "GraceExceeded":
        return <Info className="size-5 text-muted-foreground" />;
      case "NotFound":
        return <Info className="size-5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <CardTitle>Subscription Status</CardTitle>
              <CardDescription>
                {subscription.badge.description}
              </CardDescription>
            </div>
          </div>
          <CardAction>
            <Badge variant={subscription.badge.variant} className="text-xs">
              {subscription.badge.label}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Grace Period Countdown (Cached state only) */}
          {subscription.state === "Cached" &&
            subscription.gracePeriodRemaining !== null && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Grace Period Remaining
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {formatTimeRemaining(subscription.gracePeriodRemaining)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Attempting to reconnect and verify subscription
                </p>
              </div>
            )}

          {/* Details Grid */}
          {subscription.txid && (
            <div className="grid gap-2 text-sm">
              <DetailRow
                label="Transaction ID"
                value={subscription.txid}
                mono
                truncate
              />
              {subscription.vout !== undefined && (
                <DetailRow
                  label="Output Index"
                  value={String(subscription.vout)}
                />
              )}
              {subscription.verifiedAt && (
                <DetailRow
                  label="Last Verified"
                  value={formatDate(subscription.verifiedAt)}
                />
              )}
              {subscription.cachedProof && (
                <DetailRow
                  label="Proof Source"
                  value="Cached"
                  badge="secondary"
                />
              )}
            </div>
          )}

          {/* Not Found State */}
          {subscription.state === "NotFound" && (
            <div className="rounded-lg border bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No active subscription found. Subscribe to unlock all features.
              </p>
            </div>
          )}

          {/* Expired State */}
          {subscription.state === "Expired" && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Your subscription has ended
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Renew now to restore full access to EdwinPAI
              </p>
            </div>
          )}

          {/* Grace Exceeded State */}
          {subscription.state === "GraceExceeded" && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm font-medium">Limited Mode Active</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect to the internet to verify your subscription
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={subscription.refresh}
            disabled={subscription.isLoading || subscription.isRefreshing}
            className="gap-2"
          >
            <RefreshCw
              className={cn(
                "size-4",
                subscription.isRefreshing && "animate-spin",
              )}
            />
            {subscription.isRefreshing ? "Checking..." : "Refresh"}
          </Button>

          {/* Renew Button (for Expired/NotFound) */}
          {subscription.needsRenewal && onRenew && (
            <Button size="sm" onClick={onRenew}>
              {subscription.state === "Expired" ? "Renew" : "Subscribe"}
            </Button>
          )}

          {/* Cancel Button (for Active/Cached) */}
          {subscription.isOperational && onCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-destructive hover:bg-destructive/10"
            >
              Cancel Subscription
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Loading/Error States */}
      {subscription.isLoading && (
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Checking subscription status...</span>
          </div>
        </div>
      )}

      {subscription.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Error checking subscription
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {subscription.error}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Helper Components ---

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  badge?: "secondary" | "outline";
}

function DetailRow({ label, value, mono, truncate, badge }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      {badge ? (
        <Badge variant={badge} className="text-xs">
          {value}
        </Badge>
      ) : (
        <span
          className={cn(
            "text-foreground",
            mono && "font-mono text-xs",
            truncate && "max-w-[200px] truncate",
          )}
          title={truncate ? value : undefined}
        >
          {value}
        </span>
      )}
    </div>
  );
}
