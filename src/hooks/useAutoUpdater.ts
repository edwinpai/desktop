/**
 * Phase 6 Group B: Auto-Updater Hook
 *
 * Wraps Tauri updater plugin with React state management and automatic checking.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";

import {
  UpdateStatus,
  type DownloadProgress,
  type UpdateCheckResult,
  type UpdateInfo,
} from "../types/updater";

export interface UseAutoUpdaterOptions {
  checkInterval?: number; // milliseconds
  autoDownload?: boolean;
  autoInstall?: boolean;
  onUpdateAvailable?: (info: UpdateInfo) => void;
  onUpdateDownloaded?: (info: UpdateInfo) => void;
  onError?: (error: Error) => void;
}

export interface UseAutoUpdaterReturn {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress | null;
  error: string | null;
  checkForUpdates: (force?: boolean) => Promise<UpdateCheckResult>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  cancelDownload: () => void;
}

const DEFAULT_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

interface DownloadStartedEventData {
  contentLength?: number;
}

interface DownloadProgressEventData {
  chunkLength: number;
  contentLength?: number;
}

type DownloadEvent =
  | { event: "Started"; data: DownloadStartedEventData }
  | { event: "Progress"; data: DownloadProgressEventData }
  | { event: "Finished" };

function isDownloadStartedData(
  data: unknown,
): data is DownloadStartedEventData {
  return (
    typeof data === "object" &&
    data !== null &&
    ("contentLength" in data
      ? typeof (data as { contentLength?: unknown }).contentLength ===
          "number" ||
        typeof (data as { contentLength?: unknown }).contentLength ===
          "undefined"
      : true)
  );
}

function isDownloadProgressData(
  data: unknown,
): data is DownloadProgressEventData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { chunkLength?: unknown }).chunkLength === "number" &&
    ("contentLength" in data
      ? typeof (data as { contentLength?: unknown }).contentLength ===
          "number" ||
        typeof (data as { contentLength?: unknown }).contentLength ===
          "undefined"
      : true)
  );
}

/**
 * Hook for managing auto-updates via Tauri updater plugin.
 *
 * Features:
 * - Automatic periodic update checks
 * - Download progress tracking
 * - Toast notifications for update events
 * - One-click install with app relaunch
 *
 * @example
 * ```tsx
 * const { status, updateInfo, checkForUpdates, installUpdate } = useAutoUpdater({
 *   checkInterval: 3600000, // 1 hour
 *   autoDownload: true,
 *   onUpdateAvailable: (info) => {
 *     console.log(`Update available: ${info.version}`);
 *   }
 * });
 *
 * if (status === UpdateStatus.ReadyToInstall) {
 *   return <Button onClick={installUpdate}>Install Update</Button>;
 * }
 * ```
 */
export function useAutoUpdater(
  options: UseAutoUpdaterOptions = {},
): UseAutoUpdaterReturn {
  const {
    checkInterval = DEFAULT_CHECK_INTERVAL,
    autoDownload = true,
    autoInstall = false,
    onUpdateAvailable,
    onUpdateDownloaded,
    onError,
  } = options;

  const [status, setStatus] = useState<UpdateStatus>(UpdateStatus.Idle);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadAbortController = useRef<AbortController | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTime = useRef<number>(0);
  const downloadUpdateRef = useRef<(() => Promise<void>) | null>(null);
  const installUpdateRef = useRef<(() => Promise<void>) | null>(null);

  /**
   * Check for available updates.
   */
  const checkForUpdates = useCallback(
    async (force = false): Promise<UpdateCheckResult> => {
      const now = Date.now();
      if (!force && now - lastCheckTime.current < checkInterval) {
        return {
          available: false,
          currentVersion: updateInfo?.version || "0.0.0",
        };
      }

      setStatus(UpdateStatus.Checking);
      setError(null);

      try {
        const update = await check();
        lastCheckTime.current = now;

        if (!update) {
          setStatus(UpdateStatus.Idle);
          toast.info("No updates available", {
            description: "You are running the latest version",
          });
          return {
            available: false,
            currentVersion: "0.0.0", // Will be replaced by actual version from package.json
          };
        }

        // Update available
        const info: UpdateInfo = {
          version: update.version,
          currentVersion: update.currentVersion,
          date: update.date || new Date().toISOString(),
          body: update.body || "No release notes available",
          signature: "", // Tauri plugin handles signature verification internally
          pubkey: "",
          downloadUrl: "",
          size: 0,
        };

        setUpdateInfo(info);
        setStatus(UpdateStatus.Available);

        toast.success("Update available", {
          description: `Version ${update.version} is ready to download`,
        });

        onUpdateAvailable?.(info);

        // Auto-download if enabled
        if (autoDownload) {
          await downloadUpdateRef.current?.();
        }

        return {
          available: true,
          currentVersion: update.currentVersion,
          latestVersion: update.version,
          updateInfo: info,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to check for updates";
        setError(errorMessage);
        setStatus(UpdateStatus.Error);

        toast.error("Update check failed", {
          description: errorMessage,
        });

        onError?.(err instanceof Error ? err : new Error(errorMessage));

        return {
          available: false,
          currentVersion: "0.0.0",
          error: errorMessage,
        };
      }
    },
    [checkInterval, updateInfo, autoDownload, onUpdateAvailable, onError],
  );

  /**
   * Download the available update.
   */
  const downloadUpdate = useCallback(async (): Promise<void> => {
    if (status !== UpdateStatus.Available && status !== UpdateStatus.Error) {
      return;
    }

    setStatus(UpdateStatus.Downloading);
    setError(null);
    downloadAbortController.current = new AbortController();

    try {
      const update = await check();
      if (!update) {
        throw new Error("No update available");
      }

      // Download with progress tracking
      let lastProgress = 0;
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          const contentLength = isDownloadStartedData(event.data)
            ? (event.data.contentLength ?? 0)
            : 0;
          setProgress({
            downloaded: 0,
            total: contentLength,
            speed: 0,
            eta: 0,
          });
          return;
        }

        if (event.event === "Progress") {
          if (!isDownloadProgressData(event.data)) {
            return;
          }

          const downloaded = event.data.chunkLength;
          const total = event.data.contentLength ?? 0;
          const speed = total > 0 ? downloaded - lastProgress : 0;
          const eta = speed > 0 ? (total - downloaded) / speed : 0;

          setProgress({
            downloaded,
            total,
            speed,
            eta,
          });

          lastProgress = downloaded;
          return;
        }

        if (event.event === "Finished") {
          setProgress(null);
          setStatus(UpdateStatus.ReadyToInstall);

          toast.success("Update downloaded", {
            description: 'Click "Install" to restart and apply the update',
          });

          if (updateInfo) {
            onUpdateDownloaded?.(updateInfo);
          }

          // Auto-install if enabled
          if (autoInstall) {
            void installUpdateRef.current?.();
          }
        }
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Download failed";
      setError(errorMessage);
      setStatus(UpdateStatus.Error);
      setProgress(null);

      toast.error("Download failed", {
        description: errorMessage,
      });

      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [status, updateInfo, autoInstall, onUpdateDownloaded, onError]);

  useEffect(() => {
    downloadUpdateRef.current = downloadUpdate;
  }, [downloadUpdate]);

  /**
   * Install the downloaded update and relaunch the app.
   */
  const installUpdate = useCallback(async (): Promise<void> => {
    if (status !== UpdateStatus.ReadyToInstall) {
      return;
    }

    try {
      toast.info("Installing update...", {
        description: "The app will restart in a moment",
      });

      // Relaunch the app to apply the update
      await relaunch();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Install failed";
      setError(errorMessage);
      setStatus(UpdateStatus.Error);

      toast.error("Install failed", {
        description: errorMessage,
      });

      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [status, onError]);

  useEffect(() => {
    installUpdateRef.current = installUpdate;
  }, [installUpdate]);

  /**
   * Cancel ongoing download.
   */
  const cancelDownload = useCallback(() => {
    if (downloadAbortController.current) {
      downloadAbortController.current.abort();
      downloadAbortController.current = null;
    }

    setStatus(UpdateStatus.Idle);
    setProgress(null);

    toast.info("Download cancelled");
  }, []);

  /**
   * Set up automatic update checks on mount.
   */
  useEffect(() => {
    if (checkInterval > 0) {
      // Initial check after 10 seconds
      const initialTimeout = setTimeout(() => {
        checkForUpdates(false);
      }, 10000);

      // Periodic checks
      checkIntervalRef.current = setInterval(() => {
        checkForUpdates(false);
      }, checkInterval);

      return () => {
        clearTimeout(initialTimeout);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      };
    }
  }, [checkInterval, checkForUpdates]);

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      if (downloadAbortController.current) {
        downloadAbortController.current.abort();
      }
    };
  }, []);

  return {
    status,
    updateInfo,
    progress,
    error,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    cancelDownload,
  };
}
