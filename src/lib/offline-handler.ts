/**
 * Phase 6 Group D: Offline Mode Handler
 *
 * Graceful degradation for offline mode with connection status detection.
 */

import { toast } from "sonner";

export interface OfflineStatus {
  isOnline: boolean;
  lastOnline: Date | null;
  offlineDuration: number; // milliseconds
}

export interface OfflineHandlerOptions {
  onOnline?: () => void;
  onOffline?: () => void;
  showToast?: boolean;
  checkInterval?: number; // milliseconds
}

/**
 * Offline mode handler with graceful degradation.
 *
 * Features:
 * - Browser online/offline detection
 * - Connection status persistence
 * - Toast notifications for status changes
 * - Automatic reconnection on online
 *
 * @example
 * ```ts
 * const handler = createOfflineHandler({
 *   onOnline: () => {
 *     console.log('Connection restored');
 *     reconnectToGateway();
 *   },
 *   onOffline: () => {
 *     console.log('Connection lost');
 *     enableOfflineMode();
 *   }
 * });
 *
 * // Cleanup
 * handler.destroy();
 * ```
 */
export function createOfflineHandler(options: OfflineHandlerOptions = {}) {
  const {
    onOnline,
    onOffline,
    showToast = true,
    checkInterval = 5000,
  } = options;

  let status: OfflineStatus = {
    isOnline: navigator.onLine,
    lastOnline: navigator.onLine ? new Date() : null,
    offlineDuration: 0,
  };

  let checkIntervalId: NodeJS.Timeout | null = null;
  let offlineStartTime: Date | null = null;

  /**
   * Handle online event.
   */
  const handleOnline = () => {
    const wasOffline = !status.isOnline;

    status = {
      isOnline: true,
      lastOnline: new Date(),
      offlineDuration: offlineStartTime
        ? Date.now() - offlineStartTime.getTime()
        : 0,
    };

    offlineStartTime = null;

    if (wasOffline) {
      if (showToast) {
        toast.success("Connection restored", {
          description: "You are back online",
        });
      }

      onOnline?.();
    }
  };

  /**
   * Handle offline event.
   */
  const handleOffline = () => {
    const wasOnline = status.isOnline;

    offlineStartTime = new Date();

    status = {
      isOnline: false,
      lastOnline: status.lastOnline,
      offlineDuration: 0,
    };

    if (wasOnline) {
      if (showToast) {
        toast.warning("Connection lost", {
          description: "Working in offline mode",
          duration: Infinity,
        });
      }

      onOffline?.();
    }
  };

  /**
   * Periodic connection check.
   */
  const checkConnection = async () => {
    const wasOnline = status.isOnline;
    const isNowOnline = navigator.onLine;

    if (wasOnline !== isNowOnline) {
      if (isNowOnline) {
        handleOnline();
      } else {
        handleOffline();
      }
    }

    // Update offline duration
    if (!status.isOnline && offlineStartTime) {
      status.offlineDuration = Date.now() - offlineStartTime.getTime();
    }
  };

  /**
   * Initialize handler.
   */
  const init = () => {
    // Listen to browser events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic check
    checkIntervalId = setInterval(checkConnection, checkInterval);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }
  };

  /**
   * Destroy handler and cleanup.
   */
  const destroy = () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);

    if (checkIntervalId) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }
  };

  /**
   * Get current status.
   */
  const getStatus = (): OfflineStatus => {
    // Update duration if offline
    if (!status.isOnline && offlineStartTime) {
      return {
        ...status,
        offlineDuration: Date.now() - offlineStartTime.getTime(),
      };
    }

    return status;
  };

  /**
   * Check if currently online.
   */
  const isOnline = (): boolean => {
    return status.isOnline;
  };

  /**
   * Force status check.
   */
  const forceCheck = async (): Promise<boolean> => {
    await checkConnection();
    return status.isOnline;
  };

  // Initialize
  init();

  return {
    destroy,
    getStatus,
    isOnline,
    forceCheck,
  };
}

/**
 * Wrap a function with offline detection and graceful failure.
 *
 * @example
 * ```ts
 * const sendMessage = withOfflineCheck(async (message: string) => {
 *   await gateway.send(message);
 * }, {
 *   fallback: () => {
 *     console.log('Queued for later');
 *   }
 * });
 * ```
 */
export function withOfflineCheck<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    fallback?: (...args: T) => R | undefined;
    showToast?: boolean;
  } = {},
): (...args: T) => Promise<R | undefined> {
  const { fallback, showToast = true } = options;

  return async (...args: T): Promise<R | undefined> => {
    if (!navigator.onLine) {
      if (showToast) {
        toast.error("No internet connection", {
          description: "Please check your network and try again",
        });
      }

      if (fallback) {
        return fallback(...args);
      }

      throw new Error("Network offline");
    }

    try {
      return await fn(...args);
    } catch (error) {
      // Check if error is network-related
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes("network") ||
          message.includes("timeout") ||
          message.includes("connection") ||
          message.includes("fetch")
        ) {
          if (showToast) {
            toast.error("Network error", {
              description: error.message,
            });
          }

          if (fallback) {
            return fallback(...args);
          }
        }
      }

      throw error;
    }
  };
}

/**
 * Hook for offline status tracking (React).
 *
 * @example
 * ```tsx
 * import { useState, useEffect } from 'react';
 *
 * function useOfflineStatus() {
 *   const [status, setStatus] = useState<OfflineStatus>({
 *     isOnline: navigator.onLine,
 *     lastOnline: null,
 *     offlineDuration: 0,
 *   });
 *
 *   useEffect(() => {
 *     const handler = createOfflineHandler({
 *       onOnline: () => {
 *         setStatus(handler.getStatus());
 *       },
 *       onOffline: () => {
 *         setStatus(handler.getStatus());
 *       },
 *     });
 *
 *     return () => handler.destroy();
 *   }, []);
 *
 *   return status;
 * }
 * ```
 */
