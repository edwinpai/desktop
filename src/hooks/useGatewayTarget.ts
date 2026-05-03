/**
 * useGatewayTarget — React hook for managing the selected gateway.
 *
 * Stores the selected gateway target and provides methods to:
 * - Set the target (from onboarding or settings)
 * - Fetch the gateway's own config
 * - Get channel info from the remote gateway
 *
 * Config reads go through the gateway WebSocket API, not local files.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { readConfig } from "@/lib/config";
import {
  fetchGatewayConfig,
  extractChannels,
  inferGatewayKind,
  type GatewayTarget,
  type GatewayConfig,
  type ChannelInfo,
} from "@/lib/gateway-context";

export interface GatewayTargetState {
  target: GatewayTarget | null;
  config: GatewayConfig | null;
  channels: ChannelInfo[];
  isLoading: boolean;
  error: string | null;
  version: string | null;
}

export function useGatewayTarget() {
  const [state, setState] = useState<GatewayTargetState>({
    target: null,
    config: null,
    channels: [],
    isLoading: true,
    error: null,
    version: null,
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Load target from saved desktop config on mount
  useEffect(() => {
    (async () => {
      try {
        const desktopConfig = await readConfig();
        if (desktopConfig.gatewayUrl) {
          const target: GatewayTarget = {
            url: desktopConfig.gatewayUrl,
            token: desktopConfig.gatewayToken || undefined,
            kind: inferGatewayKind(desktopConfig.gatewayUrl),
          };
          if (isMounted.current) {
            setState((prev) => ({ ...prev, target, isLoading: false }));
          }
        } else {
          if (isMounted.current) {
            setState((prev) => ({ ...prev, isLoading: false }));
          }
        }
      } catch {
        if (isMounted.current) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    })();
  }, []);

  /**
   * Set a new gateway target and optionally fetch its config.
   */
  const setTarget = useCallback(async (target: GatewayTarget) => {
    setState((prev) => ({ ...prev, target, isLoading: true, error: null }));

    try {
      const config = await fetchGatewayConfig(target);
      const channels = extractChannels(config);

      if (isMounted.current) {
        setState({
          target,
          config,
          channels,
          isLoading: false,
          error: null,
          version: null, // could be extracted from hello-ok in future
        });
      }
    } catch (err) {
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          target,
          isLoading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to fetch gateway config",
        }));
      }
    }
  }, []);

  /**
   * Refresh the gateway config from the current target.
   */
  const refreshConfig = useCallback(async () => {
    if (!state.target) return;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const config = await fetchGatewayConfig(state.target);
      const channels = extractChannels(config);

      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          config,
          channels,
          isLoading: false,
          error: null,
        }));
      }
    } catch (err) {
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            err instanceof Error ? err.message : "Failed to refresh config",
        }));
      }
    }
  }, [state.target]);

  return {
    ...state,
    setTarget,
    refreshConfig,
  };
}
