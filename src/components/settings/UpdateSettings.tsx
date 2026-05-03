/**
 * Phase 6 Group B: Update Settings Component
 *
 * UI for configuring auto-updater behavior with interval selection and manual check.
 */

import { useState } from "react";
import {
  useAutoUpdater,
  type UseAutoUpdaterOptions,
} from "@/hooks/useAutoUpdater";
import {
  UpdateStatus,
  type UpdateInfo,
  type DownloadProgress,
} from "@/types/updater";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const CHECK_INTERVAL_OPTIONS = [
  { label: "Never (Manual only)", value: 0 },
  { label: "Every 15 minutes", value: 15 * 60 * 1000 },
  { label: "Every 30 minutes", value: 30 * 60 * 1000 },
  { label: "Every hour", value: 60 * 60 * 1000 },
  { label: "Every 6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "Every 12 hours", value: 12 * 60 * 60 * 1000 },
  { label: "Daily", value: 24 * 60 * 60 * 1000 },
];

export interface UpdateSettingsProps {
  className?: string;
}

/**
 * Component for configuring auto-updater settings.
 *
 * Features:
 * - Check interval configuration
 * - Auto-download toggle
 * - Auto-install toggle
 * - Manual update check button
 * - Download progress display
 * - Install button when update ready
 *
 * @example
 * ```tsx
 * <UpdateSettings />
 * ```
 */
export function UpdateSettings({ className }: UpdateSettingsProps) {
  const [checkInterval, setCheckInterval] = useState(60 * 60 * 1000); // 1 hour
  const [autoDownload, setAutoDownload] = useState(true);
  const [autoInstall, setAutoInstall] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const updaterOptions: UseAutoUpdaterOptions = {
    checkInterval,
    autoDownload,
    autoInstall,
    onUpdateAvailable: (info: UpdateInfo) => {
      toast.success("Update available", {
        description: `Version ${info.version} - ${info.body?.substring(0, 100)}...`,
        duration: 5000,
      });
    },
    onUpdateDownloaded: (info: UpdateInfo) => {
      toast.success("Update downloaded", {
        description: `Version ${info.version} is ready to install`,
        action: {
          label: "Install Now",
          onClick: installUpdate,
        },
      });
    },
    onError: (error: Error) => {
      toast.error("Update error", {
        description: error.message,
      });
    },
  };

  const {
    status,
    updateInfo,
    progress,
    error,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    cancelDownload,
  } = useAutoUpdater(updaterOptions);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    try {
      await checkForUpdates(true);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCancelDownload = () => {
    cancelDownload();
    toast.info("Download cancelled");
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const formatEta = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getDownloadProgress = (progress: DownloadProgress | null): number => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.downloaded / progress.total) * 100);
  };

  const getStatusDisplay = (): string => {
    switch (status) {
      case UpdateStatus.Idle:
        return updateInfo ? "Update available" : "Up to date";
      case UpdateStatus.Checking:
        return "Checking for updates...";
      case UpdateStatus.Available:
        return `Update available: ${updateInfo?.version}`;
      case UpdateStatus.Downloading:
        return "Downloading update...";
      case UpdateStatus.ReadyToInstall:
        return "Update ready to install";
      case UpdateStatus.Error:
        return `Error: ${error}`;
      default:
        return "Unknown status";
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle>Auto-Updater Settings</CardTitle>
          <CardDescription>
            Configure automatic updates for EdwinPAI Desktop
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Display */}
          <div className="space-y-2">
            <Label>Current Status</Label>
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">{getStatusDisplay()}</p>
              {updateInfo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {updateInfo.currentVersion} → Latest:{" "}
                  {updateInfo.version}
                </p>
              )}
            </div>
          </div>

          {/* Download Progress */}
          {status === UpdateStatus.Downloading && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Downloading...</span>
                <span>{getDownloadProgress(progress)}%</span>
              </div>
              <Progress value={getDownloadProgress(progress)} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(progress.downloaded)} /{" "}
                  {formatBytes(progress.total)}
                </span>
                <span>
                  {formatSpeed(progress.speed)} • {formatEta(progress.eta)}{" "}
                  remaining
                </span>
              </div>
            </div>
          )}

          {/* Check Interval */}
          <div className="space-y-2">
            <Label htmlFor="check-interval">Check for Updates</Label>
            <Select
              value={checkInterval.toString()}
              onValueChange={(value) => setCheckInterval(Number(value))}
            >
              <SelectTrigger id="check-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHECK_INTERVAL_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value.toString()}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often to automatically check for new versions
            </p>
          </div>

          {/* Auto-Download Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-download">Auto-Download</Label>
              <p className="text-xs text-muted-foreground">
                Automatically download updates when available
              </p>
            </div>
            <Switch
              id="auto-download"
              checked={autoDownload}
              onCheckedChange={setAutoDownload}
            />
          </div>

          {/* Auto-Install Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-install">Auto-Install</Label>
              <p className="text-xs text-muted-foreground">
                Automatically install updates after download (requires restart)
              </p>
            </div>
            <Switch
              id="auto-install"
              checked={autoInstall}
              onCheckedChange={setAutoInstall}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            {status === UpdateStatus.Idle && (
              <Button
                onClick={handleCheckForUpdates}
                disabled={isChecking}
                className="w-full"
              >
                {isChecking ? "Checking..." : "Check for Updates"}
              </Button>
            )}

            {status === UpdateStatus.Available && !autoDownload && (
              <Button onClick={downloadUpdate} className="w-full">
                Download Update
              </Button>
            )}

            {status === UpdateStatus.Downloading && (
              <Button
                onClick={handleCancelDownload}
                variant="outline"
                className="w-full"
              >
                Cancel Download
              </Button>
            )}

            {status === UpdateStatus.ReadyToInstall && (
              <Button onClick={installUpdate} className="w-full">
                Install and Restart
              </Button>
            )}

            {status === UpdateStatus.Error && (
              <Button
                onClick={handleCheckForUpdates}
                variant="outline"
                className="w-full"
              >
                Retry
              </Button>
            )}
          </div>

          {/* Release Notes */}
          {updateInfo && updateInfo.body && (
            <div className="space-y-2">
              <Label>Release Notes</Label>
              <div className="rounded-md border p-3 max-h-40 overflow-y-auto">
                <p className="text-sm whitespace-pre-line">{updateInfo.body}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
