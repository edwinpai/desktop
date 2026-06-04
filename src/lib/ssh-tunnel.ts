/**
 * SSH Tunnel Manager
 *
 * Spawns and manages SSH tunnels for connecting to remote gateways.
 * Uses `ssh -N -L localPort:localhost:remotePort sshHost` via Tauri shell plugin.
 */

import { invoke } from "@tauri-apps/api/core";
import { Command } from "@tauri-apps/plugin-shell";

export interface SshTunnelConfig {
  host: string;
  remotePort: number;
  localPort: number;
}

export type TunnelStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface SshTunnelState {
  status: TunnelStatus;
  error: string | null;
  pid: number | null;
  localPort: number;
  killedStalePids?: number[];
}

type StatusListener = (state: SshTunnelState) => void;

class SshTunnelManager {
  private config: SshTunnelConfig | null = null;
  private childProcess: Awaited<
    ReturnType<typeof Command.prototype.spawn>
  > | null = null;
  private state: SshTunnelState = {
    status: "disconnected",
    error: null,
    pid: null,
    localPort: 0,
  };
  private listeners: Set<StatusListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalStop = false;

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  private setState(partial: Partial<SshTunnelState>) {
    Object.assign(this.state, partial);
    this.emit();
  }

  async start(config: SshTunnelConfig): Promise<void> {
    await this.stop();
    this.intentionalStop = false;
    this.config = config;

    this.setState({
      status: "connecting",
      error: null,
      localPort: config.localPort,
    });

    try {
      const cleanup = await invoke<{
        port: number;
        killed_pids?: number[];
        skipped_pids?: number[];
        killedPids?: number[];
        skippedPids?: number[];
      }>("cleanup_ssh_tunnel_port", { port: config.localPort }).catch((err) => {
        console.warn(
          "[SSH] Port cleanup failed; attempting tunnel anyway:",
          err,
        );
        return null;
      });
      const killedStalePids = cleanup?.killed_pids ?? cleanup?.killedPids ?? [];
      if (killedStalePids.length > 0) {
        console.log(
          `[SSH] Killed stale tunnel PID(s) on localhost:${config.localPort}: ${killedStalePids.join(
            ", ",
          )}`,
        );
        this.setState({ killedStalePids });
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const cmd = Command.create("ssh", [
        "-N", // No remote command
        "-o",
        "ExitOnForwardFailure=yes",
        "-o",
        "ServerAliveInterval=30",
        "-o",
        "ServerAliveCountMax=3",
        "-L",
        `${config.localPort}:localhost:${config.remotePort}`,
        config.host,
      ]);

      cmd.on("error", (error) => {
        console.error("[SSH] Tunnel error:", error);
        this.setState({ status: "error", error: String(error), pid: null });
        this.scheduleReconnect();
      });

      cmd.on("close", (data) => {
        console.log("[SSH] Tunnel closed, code:", data.code);
        if (!this.intentionalStop) {
          this.setState({ status: "disconnected", pid: null });
          this.scheduleReconnect();
        }
      });

      // SSH -N doesn't produce stdout, but stderr shows connection info
      cmd.stderr.on("data", (line) => {
        console.log("[SSH] stderr:", line);
        // Some SSH errors appear on stderr before the process exits
        if (
          line.includes("Permission denied") ||
          line.includes("Connection refused") ||
          line.includes("Address already in use") ||
          line.includes("bind")
        ) {
          this.setState({ status: "error", error: line.trim() });
        }
      });

      const child = await cmd.spawn();
      this.childProcess = child;

      console.log(
        `[SSH] Tunnel spawned: localhost:${config.localPort} → ${config.host}:${config.remotePort} (PID ${child.pid})`,
      );

      // Wait briefly for the tunnel to establish before marking connected
      // SSH -N doesn't produce output, so we verify the process is still alive
      setTimeout(() => {
        if (this.childProcess === child && this.state.status === "connecting") {
          this.setState({ status: "connected", pid: child.pid });
          console.log("[SSH] Tunnel established");
        }
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SSH] Failed to start tunnel:", message);
      this.setState({ status: "error", error: message, pid: null });
    }
  }

  async stop(): Promise<void> {
    this.intentionalStop = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.childProcess) {
      try {
        await this.childProcess.kill();
      } catch {
        // Process may already be dead
      }
      this.childProcess = null;
    }
    this.setState({
      status: "disconnected",
      error: null,
      pid: null,
      killedStalePids: undefined,
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.config) return;
    console.log("[SSH] Reconnecting in 5s...");
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.config) {
        await this.start(this.config);
      }
    }, 5000);
  }

  getState(): SshTunnelState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.status === "connected";
  }
}

// Singleton per profile — keyed by profile ID
const tunnels = new Map<string, SshTunnelManager>();

export function getTunnelManager(profileId: string): SshTunnelManager {
  let manager = tunnels.get(profileId);
  if (!manager) {
    manager = new SshTunnelManager();
    tunnels.set(profileId, manager);
  }
  return manager;
}

export async function stopAllTunnels(): Promise<void> {
  for (const manager of tunnels.values()) {
    await manager.stop();
  }
  tunnels.clear();
}
