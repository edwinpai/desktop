/**
 * useConfig - React hook for configuration management
 *
 * Provides reactive access to app configuration with persistence.
 * Wraps lib/config.ts with React state management.
 */

import { useState, useEffect, useCallback } from 'react';

import type { DesktopConfig, PartialDesktopConfig, GatewayProfile } from '@/types';
import { DEFAULT_DESKTOP_CONFIG, getActiveGatewayProfile } from '@/types';
import { readConfig, updateConfig, resetConfig } from '@/lib/config';
// import { useDebouncedCallback } from '@/lib/debounce';

// ============================================================================
// Hook State
// ============================================================================

interface UseConfigReturn {
  /** Current configuration */
  config: DesktopConfig;

  /** Whether config is being loaded */
  loading: boolean;

  /** Error message if load/save failed */
  error: string | null;

  /** Update specific config fields */
  update: (updates: PartialDesktopConfig) => Promise<void>;

  /** Reset configuration to defaults */
  reset: () => Promise<void>;

  /** Reload configuration from disk */
  reload: () => Promise<void>;

  /** Persisted gateway profiles */
  gatewayProfiles: GatewayProfile[];

  /** Active gateway profile */
  activeGatewayProfile: GatewayProfile;

  /** Create or update a gateway profile */
  saveGatewayProfile: (
    profile: Omit<GatewayProfile, 'id'> & { id?: string }
  ) => Promise<GatewayProfile>;

  /** Delete a non-default gateway profile */
  deleteGatewayProfile: (profileId: string) => Promise<void>;

  /** Switch the active gateway profile */
  setActiveGatewayProfile: (profileId: string) => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for configuration management
 *
 * @example
 * ```tsx
 * const { config, loading, update } = useConfig();
 *
 * if (loading) return <Spinner />;
 *
 * return (
 *   <div>
 *     <p>Port: {config.gatewayPort}</p>
 *     <button onClick={() => update({ theme: 'dark' })}>
 *       Set Dark Theme
 *     </button>
 *   </div>
 * );
 * ```
 */
export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<DesktopConfig>(DEFAULT_DESKTOP_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gatewayProfiles = config.gatewayProfiles;
  const activeGatewayProfile = getActiveGatewayProfile(config);

  // Load config on mount
  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const loaded = await readConfig();
        if (mounted) {
          setConfig(loaded);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load configuration';
          setError(message);
          console.error('Failed to load config:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      mounted = false;
    };
  }, []);

  // Immediate update — writes to disk and updates state right away
  const update = useCallback(async (updates: PartialDesktopConfig) => {
    try {
      setError(null);
      const updated = await updateConfig(updates);
      setConfig(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update configuration';
      setError(message);
      console.error('Failed to update config:', err);
      throw err;
    }
  }, []);

  // Reset config to defaults
  const reset = useCallback(async () => {
    try {
      setError(null);
      const defaultConfig = await resetConfig();
      setConfig(defaultConfig);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset configuration';
      setError(message);
      console.error('Failed to reset config:', err);
      throw err;
    }
  }, []);

  // Reload config from disk
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await readConfig();
      setConfig(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reload configuration';
      setError(message);
      console.error('Failed to reload config:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveGatewayProfile = useCallback(async (
    profile: Omit<GatewayProfile, 'id'> & { id?: string }
  ) => {
    const slug =
      profile.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `gateway-${Date.now().toString(36)}`;
    const nextId =
      profile.id ?? slug;

    const nextProfile: GatewayProfile = {
      id: nextId,
      name: profile.name.trim() || 'Unnamed Gateway',
      gatewayUrl: profile.gatewayUrl,
      gatewayPort: profile.gatewayPort,
      gatewayToken: profile.gatewayToken,
    };

    const nextProfiles = [
      ...config.gatewayProfiles.filter((existing) => existing.id !== nextId),
      nextProfile,
    ];

    const updated = await updateConfig({
      activeGatewayProfileId: nextProfile.id,
      gatewayProfiles: nextProfiles,
    });
    setConfig(updated);
    return getActiveGatewayProfile(updated);
  }, [config.gatewayProfiles]);

  const deleteGatewayProfile = useCallback(async (profileId: string) => {
    const remainingProfiles = config.gatewayProfiles.filter((profile) => profile.id !== profileId);
    const fallbackProfileId =
      remainingProfiles.find((profile) => profile.id === DEFAULT_DESKTOP_CONFIG.activeGatewayProfileId)?.id ??
      remainingProfiles[0]?.id ??
      DEFAULT_DESKTOP_CONFIG.activeGatewayProfileId;

    const updated = await updateConfig({
      activeGatewayProfileId:
        config.activeGatewayProfileId === profileId ? fallbackProfileId : config.activeGatewayProfileId,
      gatewayProfiles: remainingProfiles,
    });
    setConfig(updated);
  }, [config.activeGatewayProfileId, config.gatewayProfiles]);

  const setActiveGatewayProfile = useCallback(async (profileId: string) => {
    const updated = await updateConfig({ activeGatewayProfileId: profileId });
    setConfig(updated);
  }, []);

  return {
    config,
    loading,
    error,
    update,
    reset,
    reload,
    gatewayProfiles,
    activeGatewayProfile,
    saveGatewayProfile,
    deleteGatewayProfile,
    setActiveGatewayProfile,
  };
}

// ============================================================================
// Derived Config Hooks
// ============================================================================

/**
 * Hook to access theme preference
 */
export function useTheme() {
  const { config, update } = useConfig();

  const setTheme = useCallback(
    async (theme: DesktopConfig['theme']) => {
      await update({ theme });
    },
    [update]
  );

  return {
    theme: config.theme,
    setTheme,
  };
}

/**
 * Hook to access chat config
 */
export function useChatConfig() {
  const { config, update } = useConfig();

  const updateChatConfig = useCallback(
    async (chatUpdates: Partial<DesktopConfig['chat']>) => {
      await update({ chat: chatUpdates });
    },
    [update]
  );

  return {
    chatConfig: config.chat,
    updateChatConfig,
  };
}

/**
 * Hook to access gateway config
 */
export function useGatewayConfig() {
  const { config, update } = useConfig();

  const updateGatewayConfig = useCallback(
    async (gatewayUpdates: Partial<DesktopConfig['gateway']>) => {
      await update({ gateway: gatewayUpdates });
    },
    [update]
  );

  return {
    gatewayConfig: config.gateway,
    updateGatewayConfig,
    gatewayUrl: config.gatewayUrl,
    gatewayPort: config.gatewayPort,
    autoStartGateway: config.autoStartGateway,
  };
}
