import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { UpdateConfig } from '@/types/updater';
import { UpdateStatus } from '@/types/updater';

export interface UseUpdateReturn {
  config: UpdateConfig | null;
  status: UpdateStatus | null;
  isLoading: boolean;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  updateConfig: (config: Partial<UpdateConfig>) => Promise<void>;
}

export function useUpdate(): UseUpdateReturn {
  const [config, setConfig] = useState<UpdateConfig | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await invoke<UpdateConfig>('get_update_config');
        setConfig(cfg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load update config');
      }
    };
    loadConfig();
  }, []);

  const checkForUpdates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const updateStatus = await invoke<UpdateStatus>('check_for_updates');
      setStatus(updateStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (status !== UpdateStatus.Available) {
      setError('No update available to install');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await invoke('install_update');
      // Update will restart the app
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install update');
      setIsLoading(false);
    }
  }, [status]);

  const updateConfig = useCallback(async (partial: Partial<UpdateConfig>) => {
    setIsLoading(true);
    setError(null);
    try {
      const newConfig = await invoke<UpdateConfig>('update_update_config', { config: partial });
      setConfig(newConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    config,
    status,
    isLoading,
    error,
    checkForUpdates,
    installUpdate,
    updateConfig,
  };
}
