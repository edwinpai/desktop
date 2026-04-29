/**
 * Phase 6 Group D: Offline Status Hook
 *
 * React hook for tracking online/offline status with graceful degradation.
 */

import { useState, useEffect } from 'react';
import { createOfflineHandler, type OfflineStatus } from '@/lib/offline-handler';

export interface UseOfflineStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
  showToast?: boolean;
  checkInterval?: number;
}

/**
 * Hook for tracking offline status.
 *
 * Features:
 * - Real-time online/offline detection
 * - Offline duration tracking
 * - Toast notifications for status changes
 * - Callbacks for status changes
 *
 * @example
 * ```tsx
 * function ChatView() {
 *   const { isOnline, status } = useOfflineStatus({
 *     onOffline: () => {
 *       console.log('Connection lost, switching to offline mode');
 *     },
 *     onOnline: () => {
 *       console.log('Connection restored, syncing...');
 *     }
 *   });
 *
 *   if (!isOnline) {
 *     return <OfflineWarning duration={status.offlineDuration} />;
 *   }
 *
 *   return <ChatMessages />;
 * }
 * ```
 */
export function useOfflineStatus(options: UseOfflineStatusOptions = {}) {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    lastOnline: navigator.onLine ? new Date() : null,
    offlineDuration: 0,
  });

  useEffect(() => {
    const handler = createOfflineHandler({
      ...options,
      onOnline: () => {
        setStatus(handler.getStatus());
        options.onOnline?.();
      },
      onOffline: () => {
        setStatus(handler.getStatus());
        options.onOffline?.();
      },
    });

    // Update status periodically while offline
    const updateInterval = setInterval(() => {
      setStatus(handler.getStatus());
    }, 1000);

    return () => {
      handler.destroy();
      clearInterval(updateInterval);
    };
  }, [options.onOnline, options.onOffline, options.showToast, options.checkInterval]);

  return {
    isOnline: status.isOnline,
    status,
  };
}
