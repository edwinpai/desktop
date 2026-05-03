import { useCallback, useEffect, useState } from "react";

import {
  getTunnelManager,
  stopAllTunnels,
  type SshTunnelConfig,
  type SshTunnelState,
} from "@/lib/ssh-tunnel";
import type { GatewayProfile } from "@/types/config";

interface UseSshTunnelReturn {
  tunnelState: SshTunnelState | null;
  /** The effective gateway URL (tunnel endpoint if SSH, original if local) */
  effectiveUrl: string;
  /** Start tunnel for a profile */
  startTunnel: (profile: GatewayProfile) => Promise<void>;
  /** Stop the active tunnel */
  stopTunnel: () => Promise<void>;
}

export function useSshTunnel(
  activeProfile: GatewayProfile,
): UseSshTunnelReturn {
  const [tunnelState, setTunnelState] = useState<SshTunnelState | null>(null);
  const isSshProfile = activeProfile.ssh?.enabled === true;

  const effectiveUrl =
    isSshProfile && activeProfile.ssh
      ? `http://localhost:${activeProfile.ssh.localPort}`
      : activeProfile.gatewayUrl;

  const startTunnel = useCallback(async (profile: GatewayProfile) => {
    if (!profile.ssh?.enabled) return;
    const manager = getTunnelManager(profile.id);
    const config: SshTunnelConfig = {
      host: profile.ssh.host,
      remotePort: profile.ssh.remotePort,
      localPort: profile.ssh.localPort,
    };
    await manager.start(config);
  }, []);

  const stopTunnel = useCallback(async () => {
    const manager = getTunnelManager(activeProfile.id);
    await manager.stop();
    setTunnelState(null);
  }, [activeProfile.id]);

  // Subscribe to tunnel state changes
  useEffect(() => {
    if (!isSshProfile) {
      return;
    }

    const manager = getTunnelManager(activeProfile.id);
    const unsubscribe = manager.subscribe(setTunnelState);
    return unsubscribe;
  }, [activeProfile.id, isSshProfile]);

  // Auto-start tunnel when SSH profile is selected (keyed on profile ID only)
  const sshHost = activeProfile.ssh?.host;
  const sshRemotePort = activeProfile.ssh?.remotePort;
  const sshLocalPort = activeProfile.ssh?.localPort;

  useEffect(() => {
    if (!isSshProfile || !sshHost) return;

    const manager = getTunnelManager(activeProfile.id);
    if (manager.getState().status === "disconnected") {
      manager.start({
        host: sshHost,
        remotePort: sshRemotePort ?? 18789,
        localPort: sshLocalPort ?? 28789,
      });
    }
  }, [activeProfile.id, isSshProfile, sshHost, sshRemotePort, sshLocalPort]);

  // Cleanup all tunnels on app unmount
  useEffect(() => {
    return () => {
      stopAllTunnels();
    };
  }, []);

  return {
    tunnelState: isSshProfile ? tunnelState : null,
    effectiveUrl,
    startTunnel,
    stopTunnel,
  };
}
