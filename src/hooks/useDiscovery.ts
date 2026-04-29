/**
 * useDiscovery - mDNS peer discovery with polling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { DiscoveredPeer } from '@/types/api';
import { useDebouncedCallback } from '@/lib/debounce';

interface UseDiscoveryReturn {
  peers: DiscoveredPeer[];
  isScanning: boolean;
  error: string | null;
  startScan: () => void;
  stopScan: () => void;
  refreshPeers: () => Promise<void>;
}

/**
 * Hook for mDNS discovery of EdwinPAI gateways on the local network
 * Polls every 5 seconds while scanning is active
 * Debounced to prevent excessive network calls (500ms)
 */
export function useDiscovery(): UseDiscoveryReturn {
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Internal refresh without debounce (for polling)
  const refreshPeersInternal = useCallback(async () => {
    try {
      setError(null);
      const discovered = await invoke<DiscoveredPeer[]>('scan_network');
      setPeers(discovered);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to scan network';
      setError(errorMsg);
      setPeers([]);
    }
  }, []);

  // Debounced version for manual refresh (500ms to prevent spam)
  const debouncedRefresh = useDebouncedCallback(refreshPeersInternal, 500);

  // Wrapper to match interface (returns Promise for API consistency)
  const refreshPeers = useCallback(async () => {
    debouncedRefresh();
  }, [debouncedRefresh]);

  const startScan = useCallback(() => {
    if (isScanning) return;

    setIsScanning(true);
    refreshPeersInternal(); // Initial scan (immediate, not debounced)

    // Poll every 5 seconds (use internal non-debounced version for polling)
    intervalRef.current = window.setInterval(() => {
      refreshPeersInternal();
    }, 5000);
  }, [isScanning, refreshPeersInternal]);

  const stopScan = useCallback(() => {
    setIsScanning(false);
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    peers,
    isScanning,
    error,
    startScan,
    stopScan,
    refreshPeers,
  };
}
