/**
 * useClientConnection - Manage client connection lifecycle
 */

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ClientConnectionStatus } from "@/types/api";

interface ConnectParams {
  gatewayAddress: string;
  gatewayPubkey?: string;
}

interface ConnectionEvent {
  status: ClientConnectionStatus;
  error?: string;
}

interface UseClientConnectionReturn {
  connectionStatus: ClientConnectionStatus;
  error: string | null;
  connect: (params: ConnectParams) => Promise<boolean>;
  disconnect: (disableReconnect?: boolean) => Promise<void>;
  getStatus: () => Promise<ClientConnectionStatus>;
}

/**
 * Hook for managing client connection to a remote gateway
 * Handles BRC-103 authentication and connection state management
 */
export function useClientConnection(): UseClientConnectionReturn {
  const [connectionStatus, setConnectionStatus] =
    useState<ClientConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  // Listen for connection status events from backend
  useEffect(() => {
    const unlisten = listen<ConnectionEvent>("connection-status", (event) => {
      setConnectionStatus(event.payload.status);
      if (event.payload.error) {
        setError(event.payload.error);
      } else {
        setError(null);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const connect = useCallback(
    async (params: ConnectParams): Promise<boolean> => {
      try {
        setError(null);
        setConnectionStatus("connecting");

        const response = await invoke<{
          success: boolean;
          state: ClientConnectionStatus;
          error?: string;
          gatewayPetname?: string;
        }>("connect_to_gateway", {
          request: {
            gatewayAddress: params.gatewayAddress,
            gatewayPubkey: params.gatewayPubkey || null,
          },
        });

        setConnectionStatus(response.state);

        if (!response.success) {
          setError(response.error || "Connection failed");
          return false;
        }

        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Connection failed";
        setError(errorMsg);
        setConnectionStatus("failed");
        return false;
      }
    },
    [],
  );

  const disconnect = useCallback(
    async (disableReconnect = false): Promise<void> => {
      try {
        setError(null);
        await invoke("disconnect", {
          request: { disableReconnect },
        });
        setConnectionStatus("disconnected");
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Disconnect failed";
        setError(errorMsg);
      }
    },
    [],
  );

  const getStatus = useCallback(async (): Promise<ClientConnectionStatus> => {
    try {
      const status = await invoke<ClientConnectionStatus>(
        "get_connection_status",
      );
      setConnectionStatus(status);
      return status;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to get status";
      setError(errorMsg);
      return "disconnected";
    }
  }, []);

  return {
    connectionStatus,
    error,
    connect,
    disconnect,
    getStatus,
  };
}
