/**
 * GatewayContext — single source of truth for the selected gateway target.
 *
 * All features that need gateway config (channels, providers, status, etc.)
 * should query through this context, NOT read local ~/.edwinpai/edwinpai.json directly.
 *
 * The context connects via WebSocket and uses the gateway's own config.get
 * method to fetch its configuration.
 */

import { APP_VERSION } from "@/lib/app-version";

export interface GatewayTarget {
  url: string;        // e.g., "http://127.0.0.1:18789"
  token?: string;     // auth token
  kind: "local" | "docker" | "remote";  // inferred from URL/context
}

export interface GatewayConfig {
  [key: string]: unknown;
  messages?: {
    channels?: Record<string, unknown>;
    [key: string]: unknown;
  };
  gateway?: {
    port?: number;
    auth?: { token?: string };
    [key: string]: unknown;
  };
}

export type GatewayModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

export interface ChannelInfo {
  name: string;
  type: string;
  configured: boolean;
  details?: Record<string, unknown>;
}

/**
 * Try to read the gateway token from desktop config or shared config.
 * Used as fallback when no token is provided.
 */
export async function resolveToken(providedToken?: string): Promise<string | undefined> {
  if (providedToken) return providedToken;

  try {
    // Try desktop config first
    const { readConfig } = await import("@/lib/config");
    const cfg = await readConfig();
    if (cfg.gatewayToken) return cfg.gatewayToken;
  } catch {
    // ignore
  }

  try {
    // Try shared edwinpai.json via Tauri IPC
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ config: Record<string, unknown> }>("get_edwinpai_config");
    const gw = (result.config?.gateway ?? {}) as Record<string, unknown>;
    const auth = (gw.auth ?? {}) as Record<string, unknown>;
    if (typeof auth.token === "string") return auth.token;
  } catch {
    // ignore
  }

  return undefined;
}

/**
 * Prefer localhost for secure-context behavior, but fall back to 127.0.0.1.
 *
 * On some systems, `localhost` resolves to `::1` first. If the gateway is bound
 * to IPv4 loopback only (127.0.0.1), WebView/WebSocket may fail without trying
 * IPv4 fallback. This helper keeps the UI working while still preferring
 * `localhost` where possible.
 */
export function buildWsUrlCandidates(httpUrl: string): string[] {
  try {
    const u = new URL(httpUrl);
    const isWsSecure = u.protocol === "https:";
    const wsProtocol = isWsSecure ? "wss:" : "ws:";

    const mk = (hostname: string) => {
      const clone = new URL(u.toString());
      clone.protocol = wsProtocol;
      clone.hostname = hostname;
      return clone.toString();
    };

    // Normalize any loopback-y inputs.
    const host = u.hostname;
    if (host === "localhost") {
      return [mk("localhost"), mk("127.0.0.1")];
    }
    if (host === "::1") {
      return [mk("localhost"), mk("127.0.0.1")];
    }
    if (host === "0.0.0.0") {
      return [mk("localhost"), mk("127.0.0.1")];
    }
    if (host.startsWith("127.")) {
      // Prefer localhost, but keep exact host as a fallback.
      return [mk("localhost"), mk(host)];
    }

    // Non-loopback: just use the provided host.
    const clone = new URL(u.toString());
    clone.protocol = wsProtocol;
    return [clone.toString()];
  } catch {
    return [httpUrl.replace(/^http/, "ws")];
  }
}

/**
 * Fetch the gateway's own configuration via WebSocket config.get method.
 * This queries the REMOTE gateway, not local files.
 */

function getWsUrlCandidate(wsUrlCandidates: string[], attempt: number, httpUrl: string): string {
  return (
    wsUrlCandidates[Math.min(attempt, wsUrlCandidates.length - 1)] ??
    httpUrl.replace(/^http/, "ws")
  );
}

function closeWebSocketQuietly(socket: WebSocket | null | undefined): void {
  if (!socket) return;
  try {
    socket.close();
  } catch {
    return;
  }
}

export async function fetchGatewayConfig(
  target: GatewayTarget,
  timeoutMs = 10000,
): Promise<GatewayConfig> {
  const token = await resolveToken(target.token);
  const wsUrlCandidates = buildWsUrlCandidates(target.url);

  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let msgId = 0;
    const nextId = () => String(++msgId);

    const timeout = setTimeout(() => {
      closeWebSocketQuietly(ws);
      reject(new Error("Timed out fetching gateway config"));
    }, timeoutMs);

    const connect = (attempt: number) => {
      const candidate = getWsUrlCandidate(wsUrlCandidates, attempt, target.url);
      const socket = new WebSocket(candidate);
      ws = socket;

      let handshakeDone = false;
      let configReqId: string | null = null;

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            type: "req",
            id: nextId(),
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "edwinpai-macos",
                displayName: "EdwinPAI Desktop",
                version: APP_VERSION,
                platform: "desktop",
                mode: "ui",
              },
              auth: token ? { token } : undefined,
            },
          }),
        );
      });

      socket.addEventListener("message", (event) => {
        try {
          const frame = JSON.parse(event.data as string);

          if (frame.type === "res") {
            if (!handshakeDone) {
              if (frame.ok && frame.payload?.type === "hello-ok") {
                handshakeDone = true;
                configReqId = nextId();
                socket.send(
                  JSON.stringify({
                    type: "req",
                    id: configReqId,
                    method: "config.get",
                    params: {},
                  }),
                );
              } else {
                clearTimeout(timeout);
                closeWebSocketQuietly(socket);
                reject(new Error(frame.error?.message ?? "Handshake failed"));
              }
            } else if (frame.id === configReqId) {
              clearTimeout(timeout);
              closeWebSocketQuietly(socket);
              if (frame.ok && frame.payload) {
                const payload = frame.payload as Record<string, unknown>;
                const config = (payload.config ?? payload.parsed ?? payload) as GatewayConfig;
                resolve(config);
              } else {
                reject(new Error(frame.error?.message ?? "Failed to fetch config"));
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      const retry = () => {
        if (attempt < wsUrlCandidates.length - 1) {
          closeWebSocketQuietly(socket);
          connect(attempt + 1);
          return true;
        }
        return false;
      };

      socket.addEventListener("error", () => {
        if (socket.readyState !== WebSocket.OPEN && retry()) return;
        clearTimeout(timeout);
        reject(new Error("WebSocket connection failed"));
      });

      socket.addEventListener("close", (event) => {
        if (event.code !== 1000) {
          if (!handshakeDone && retry()) return;
          clearTimeout(timeout);
          reject(new Error(`Connection closed: ${event.reason || `code ${event.code}`}`));
        }
      });
    };

    connect(0);
  });
}

export async function signGatewayParams<T extends Record<string, unknown>>(
  params: T,
): Promise<T & { signedEnvelope: Record<string, unknown> }> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const signed = await invoke<{ payload: string; envelope: Record<string, unknown> }>("sign_request", {
      payload: JSON.stringify(params),
    });
    return { ...params, signedEnvelope: signed.envelope };
  } catch {
    throw new Error("Failed to sign request");
  }
}

export async function callGatewayMethod(
  target: GatewayTarget,
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<unknown> {
  const token = await resolveToken(target.token);
  const wsUrlCandidates = buildWsUrlCandidates(target.url);

  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let attempt = 0;

    const connect = () => {
      const candidate = getWsUrlCandidate(wsUrlCandidates, attempt, target.url);
      const socket = new WebSocket(candidate);
      ws = socket;

      let msgId = 0;
      const nextId = () => String(++msgId);
      const timeout = setTimeout(() => {
        closeWebSocketQuietly(ws);
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            type: "req",
            id: nextId(),
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "edwinpai-macos",
                displayName: "EdwinPAI Desktop",
                version: APP_VERSION,
                platform: "desktop",
                mode: "ui",
              },
              auth: token ? { token } : undefined,
            },
          }),
        );
      });

      let handshakeDone = false;
      let reqId: string | null = null;

      socket.addEventListener("message", (event) => {
        try {
          const frame = JSON.parse(event.data as string);
          if (frame.type === "res") {
            if (!handshakeDone) {
              if (frame.ok && frame.payload?.type === "hello-ok") {
                handshakeDone = true;
                reqId = nextId();
                socket.send(
                  JSON.stringify({
                    type: "req",
                    id: reqId,
                    method,
                    params,
                  }),
                );
              } else {
                clearTimeout(timeout);
                closeWebSocketQuietly(socket);
                reject(new Error(frame.error?.message ?? "Handshake failed"));
              }
            } else if (frame.id === reqId) {
              clearTimeout(timeout);
              closeWebSocketQuietly(socket);
              if (frame.ok) {
                resolve(frame.payload);
              } else {
                reject(new Error(frame.error?.message ?? "Gateway request failed"));
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      const retry = () => {
        if (attempt < wsUrlCandidates.length - 1) {
          attempt += 1;
          closeWebSocketQuietly(socket);
          connect();
          return true;
        }
        return false;
      };

      socket.addEventListener("error", () => {
        if (socket.readyState !== WebSocket.OPEN && retry()) return;
        clearTimeout(timeout);
        reject(new Error("WebSocket connection failed"));
      });

      socket.addEventListener("close", (event) => {
        if (event.code !== 1000) {
          if (!handshakeDone && retry()) return;
          clearTimeout(timeout);
          reject(new Error(`Connection closed: ${event.reason || `code ${event.code}`}`));
        }
      });
    };

    connect();
  });
}

export interface ChannelAccountStatus {
  accountId: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  connected?: boolean;
  reconnectAttempts?: number;
  lastConnectedAt?: number | null;
  lastMessageAt?: number | null;
  lastEventAt?: number | null;
}

export interface ChannelStatusResult {
  channels: Record<string, {
    accounts: ChannelAccountStatus[];
    defaultAccountId?: string;
  }>;
}

export interface WebLoginStartResult {
  qrDataUrl?: string;
  message: string;
}

export interface WebLoginWaitResult {
  connected: boolean;
  message: string;
}

/**
 * Fetch live channel status from the gateway via channels.status method.
 */
export async function fetchChannelStatus(
  target: GatewayTarget,
  timeoutMs = 10000,
): Promise<ChannelStatusResult> {
  return await callGatewayMethod(
    target,
    "channels.status",
    {},
    timeoutMs,
    "Timed out fetching channel status",
  ) as ChannelStatusResult;
}

export async function webLoginStart(
  target: GatewayTarget,
  params: { accountId?: string; force?: boolean; timeoutMs?: number; verbose?: boolean } = {},
  timeoutMs = 20000,
): Promise<WebLoginStartResult> {
  return await callGatewayMethod(
    target,
    "web.login.start",
    params,
    timeoutMs,
    "Timed out starting web login",
  ) as WebLoginStartResult;
}

export async function webLoginWait(
  target: GatewayTarget,
  params: { accountId?: string; timeoutMs?: number } = {},
  timeoutMs = 120000,
): Promise<WebLoginWaitResult> {
  return await callGatewayMethod(
    target,
    "web.login.wait",
    params,
    timeoutMs,
    "Timed out waiting for web login",
  ) as WebLoginWaitResult;
}

export async function listGatewayModels(
  target: GatewayTarget,
  timeoutMs = 10000,
): Promise<GatewayModelChoice[]> {
  const payload = await callGatewayMethod(
    target,
    'models.list',
    {},
    timeoutMs,
    'Timed out listing models',
  ) as Record<string, unknown>;
  const models = payload?.models as unknown;
  return Array.isArray(models) ? (models as GatewayModelChoice[]) : [];
}

export type ExecApprovalsAllowlistEntry = {
  id?: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
};

export type ExecApprovalsDefaults = {
  security?: string;
  ask?: string;
  askFallback?: string;
  autoAllowSkills?: boolean;
};

export type ExecApprovalsAgent = ExecApprovalsDefaults & {
  allowlist?: ExecApprovalsAllowlistEntry[];
};

export type ExecApprovalsFile = {
  version: 1;
  socket?: {
    path?: string;
    token?: string;
  };
  defaults?: ExecApprovalsDefaults;
  agents?: Record<string, ExecApprovalsAgent>;
};

export type ExecApprovalsSnapshot = {
  path: string;
  exists: boolean;
  hash: string;
  file: ExecApprovalsFile;
};

export type ExecApprovalRequest = {
  id: string;
  request: {
    command: string;
    cwd?: string | null;
    host?: string | null;
    security?: string | null;
    ask?: string | null;
    agentId?: string | null;
    resolvedPath?: string | null;
    sessionKey?: string | null;
  };
  createdAtMs: number;
  expiresAtMs: number;
};

/** Tool invocation approval request from `edwinpai tool invoke` CLI */
export type ToolInvokeApprovalRequest = {
  id: string;
  tool: string;
  action?: string;
  args: Record<string, unknown>;
  sessionKey?: string | null;
  agentId?: string | null;
  requestingClient?: string | null;
  createdAtMs: number;
  expiresAtMs: number;
};

/** Credential request from gateway credential vault */
export type CredentialRequest = {
  id: string;
  credentialId: string;
  name: string;
  purpose: string;
  requester: string;
  leaseDurationMs: number;
  createdAtMs: number;
  expiresAtMs: number;
};

export async function resolveCredential(
  target: GatewayTarget,
  requestId: string,
  decision: "granted" | "denied",
  credential?: string,
  leaseMs?: number,
  signedEnvelope?: Record<string, unknown>,
  timeoutMs = 10000,
): Promise<{ ok: boolean }> {
  return await callGatewayMethod(
    target,
    "credential.resolve",
    { requestId, decision, credential, leaseMs, signedEnvelope },
    timeoutMs,
    "Timed out resolving credential request",
  ) as { ok: boolean };
}

export async function resolveToolInvokeApproval(
  target: GatewayTarget,
  id: string,
  decision: "approve" | "deny",
  signedEnvelope?: Record<string, unknown>,
  timeoutMs = 10000,
): Promise<{ ok: boolean }> {
  return await callGatewayMethod(
    target,
    "tool.invoke.approval.resolve",
    { id, decision, signedEnvelope },
    timeoutMs,
    "Timed out resolving tool invoke approval",
  ) as { ok: boolean };
}

export async function fetchExecApprovals(
  target: GatewayTarget,
  timeoutMs = 10000,
): Promise<ExecApprovalsSnapshot> {
  return await callGatewayMethod(
    target,
    "exec.approvals.get",
    {},
    timeoutMs,
    "Timed out fetching exec approvals",
  ) as ExecApprovalsSnapshot;
}

export async function setExecApprovals(
  target: GatewayTarget,
  file: ExecApprovalsFile,
  baseHash?: string,
  timeoutMs = 10000,
): Promise<ExecApprovalsSnapshot> {
  return await callGatewayMethod(
    target,
    "exec.approvals.set",
    { file, baseHash },
    timeoutMs,
    "Timed out saving exec approvals",
  ) as ExecApprovalsSnapshot;
}

export async function fetchNodeExecApprovals(
  target: GatewayTarget,
  nodeId: string,
  timeoutMs = 15000,
): Promise<ExecApprovalsSnapshot> {
  return await callGatewayMethod(
    target,
    "exec.approvals.node.get",
    { nodeId },
    timeoutMs,
    "Timed out fetching node exec approvals",
  ) as ExecApprovalsSnapshot;
}

export async function setNodeExecApprovals(
  target: GatewayTarget,
  nodeId: string,
  file: ExecApprovalsFile,
  baseHash?: string,
  timeoutMs = 15000,
): Promise<ExecApprovalsSnapshot> {
  return await callGatewayMethod(
    target,
    "exec.approvals.node.set",
    { nodeId, file, baseHash },
    timeoutMs,
    "Timed out saving node exec approvals",
  ) as ExecApprovalsSnapshot;
}

export async function resolveExecApproval(
  target: GatewayTarget,
  id: string,
  decision: "allow-once" | "allow-always" | "deny",
  timeoutMs = 10000,
): Promise<{ ok: boolean }> {
  return await callGatewayMethod(
    target,
    "exec.approval.resolve",
    { id, decision },
    timeoutMs,
    "Timed out resolving exec approval",
  ) as { ok: boolean };
}

/**
 * Extract channel information from a gateway config snapshot.
 */
export function extractChannels(config: GatewayConfig): ChannelInfo[] {
  const channels: ChannelInfo[] = [];
  const msgChannels = config.messages?.channels;

  if (!msgChannels || typeof msgChannels !== "object") {
    return channels;
  }

  const channelTypes = [
    "matrix", "telegram", "discord", "slack", "whatsapp", "signal",
    "googlechat", "imessage",
  ];

  for (const type of channelTypes) {
    const channelConfig = msgChannels[type];
    if (channelConfig && typeof channelConfig === "object") {
      const cfg = channelConfig as Record<string, unknown>;
      // Check if it's actually configured (has essential fields)
      const isConfigured = !!(
        cfg.enabled !== false && (
          cfg.homeserver || // matrix
          cfg.botToken ||  // telegram, discord, slack
          cfg.token ||     // generic
          cfg.phoneNumber || // whatsapp, signal
          cfg.accountId    // imessage
        )
      );

      if (isConfigured) {
        channels.push({
          name: type.charAt(0).toUpperCase() + type.slice(1),
          type,
          configured: true,
          details: cfg,
        });
      }
    }
  }

  return channels;
}

/**
 * Send a config.patch to the gateway via WebSocket.
 * The patch is merge-patched into the gateway's config and triggers a restart.
 */
export async function patchGatewayConfig(
  target: GatewayTarget,
  patch: Record<string, unknown>,
  timeoutMs = 15000,
): Promise<void> {
  const token = await resolveToken(target.token);
  const wsUrlCandidates = buildWsUrlCandidates(target.url);

  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let attempt = 0;

    const connect = () => {
      const candidate = getWsUrlCandidate(wsUrlCandidates, attempt, target.url);
      const socket = new WebSocket(candidate);
      ws = socket;

      let msgId = 0;
      const nextId = () => String(++msgId);
      const timeout = setTimeout(() => {
        closeWebSocketQuietly(ws);
        reject(new Error("Timed out patching gateway config"));
      }, timeoutMs);

      type Phase = "handshake" | "get-config" | "patch";
      let phase: Phase = "handshake";
      let getConfigId: string | null = null;
      let patchId: string | null = null;

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            type: "req",
            id: nextId(),
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "edwinpai-macos",
                displayName: "EdwinPAI Desktop",
                version: APP_VERSION,
                platform: "desktop",
                mode: "ui",
              },
              auth: token ? { token } : undefined,
            },
          }),
        );
      });

      socket.addEventListener("message", (event) => {
        try {
          const frame = JSON.parse(event.data as string);
          if (frame.type !== "res") return;

          if (phase === "handshake") {
            if (frame.ok && frame.payload?.type === "hello-ok") {
              phase = "get-config";
              getConfigId = nextId();
              socket.send(
                JSON.stringify({
                  type: "req",
                  id: getConfigId,
                  method: "config.get",
                  params: {},
                }),
              );
            } else {
              clearTimeout(timeout);
              closeWebSocketQuietly(socket);
              reject(new Error(frame.error?.message ?? "Handshake failed"));
            }
          } else if (phase === "get-config" && frame.id === getConfigId) {
            if (frame.ok && frame.payload) {
              const snapshot = frame.payload as Record<string, unknown>;
              const baseHash = snapshot.hash as string | undefined;

              phase = "patch";
              patchId = nextId();
              const rawPatch = (() => {
                try {
                  return JSON.stringify(patch ?? {}) || "{}";
                } catch {
                  return "{}";
                }
              })();

              socket.send(
                JSON.stringify({
                  type: "req",
                  id: patchId,
                  method: "config.patch",
                  params: {
                    raw: rawPatch,
                    baseHash: baseHash ?? undefined,
                  },
                }),
              );
            } else {
              clearTimeout(timeout);
              closeWebSocketQuietly(socket);
              reject(new Error(frame.error?.message ?? "Failed to get config for patching"));
            }
          } else if (phase === "patch" && frame.id === patchId) {
            clearTimeout(timeout);
            closeWebSocketQuietly(socket);
            if (frame.ok) resolve();
            else reject(new Error(frame.error?.message ?? "Config patch failed"));
          }
        } catch {
          // Ignore parse errors
        }
      });

      const retry = () => {
        if (attempt < wsUrlCandidates.length - 1) {
          attempt += 1;
          closeWebSocketQuietly(socket);
          connect();
          return true;
        }
        return false;
      };

      socket.addEventListener("error", () => {
        if (socket.readyState !== WebSocket.OPEN && retry()) return;
        clearTimeout(timeout);
        reject(new Error("WebSocket connection failed"));
      });

      socket.addEventListener("close", (event) => {
        if (event.code !== 1000) {
          if (phase === "handshake" && retry()) return;
          clearTimeout(timeout);
          reject(new Error(`Connection closed: ${event.reason || `code ${event.code}`}`));
        }
      });
    };

    connect();
  });
}

/**
 * Build a GatewayTarget from desktop config values.
 * Shared by all feature libs (skills, nodes, workflows, canvas, etc.).
 */
export function buildGatewayTarget(config: {
  gatewayUrl?: string;
  gatewayPort?: number;
  gatewayToken?: string;
}): GatewayTarget {
  const url = config.gatewayUrl ?? `http://localhost:${config.gatewayPort ?? 18789}`;
  return {
    url,
    token: config.gatewayToken || undefined,
    kind: inferGatewayKind(url),
  };
}

/**
 * Infer gateway kind from URL.
 */
export function inferGatewayKind(url: string): GatewayTarget["kind"] {
  try {
    const u = new URL(url);
    const port = parseInt(u.port || "80");
    // Docker gateways typically run on non-standard ports (mapped)
    if (port !== 18789) {
      return "docker"; // could be docker or remote, default to docker for local
    }
    if (
      u.hostname === "localhost" ||
      u.hostname === "::1" ||
      u.hostname === "0.0.0.0" ||
      u.hostname.startsWith("127.")
    ) {
      return "local";
    }
    return "remote";
  } catch {
    return "remote";
  }
}
