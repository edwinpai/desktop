/**
 * useWebSocketChat - React hook for WebSocket-based chat with EdwinPAI Gateway
 *
 * Protocol: EdwinPAI Gateway WebSocket (see src/gateway/protocol/schema/frames.ts)
 * - Request frames:  { type: "req", id: "<string>", method: "<string>", params?: ... }
 * - Response frames: { type: "res", id: "<string>", ok: bool, payload?: ..., error?: ... }
 * - Event frames:    { type: "event", event: "<string>", payload?: ..., seq?: N }
 *
 * Handshake: send { type:"req", id:"1", method:"connect", params: ConnectParams }
 *            recv { type:"res", id:"1", ok:true, payload: { server: {...} } }
 *
 * Chat:      send { type:"req", id:"2", method:"chat.send", params: { sessionKey, message, idempotencyKey } }
 *            recv { type:"res", id:"2", ok:true, payload: { runId } }
 *            recv { type:"event", event:"chat", payload: { runId, sessionKey, seq, state:"delta"|"final"|"error", message:{...} } }
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

import { APP_VERSION } from "@/lib/app-version";
import { readConfig } from "@/lib/config";
import {
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
} from "@/lib/chat-history";
import { signChallenge } from "@/lib/crypto-domain";
import {
  getRuleForCredential,
  loadPolicy as loadVaultPolicy,
} from "@/lib/vault-policy";
import type { ChatMessage as BaseChatMessage } from "@/types/api";
import type { ToolUseBlock } from "@/types/streaming";

/** Extended ChatMessage with tool sources for citation UI */
export interface ChatMessage extends BaseChatMessage {
  /** Memory search sources used for this response */
  sources?: ToolSource[];
}

/** A source citation from a tool call (e.g., memory_search) */
export interface ToolSource {
  tool: string;
  path: string;
  startLine?: number;
  endLine?: number;
  score?: number;
  snippet?: string;
}

/** Compaction status indicator */
export interface CompactionStatus {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
}

// ============================================================================
// Gateway WebSocket Protocol Types
// ============================================================================

interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
  };
  auth: Record<string, unknown>;
}

/** Outgoing request frame */
interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

/** Incoming response frame */
interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: { code: number; message: string };
}

/** Incoming event frame */
interface EventFrame {
  type: "event";
  event: string;
  payload?: Record<string, unknown>;
  seq?: number;
}

/** Chat event payload (inside EventFrame.payload) */
interface ChatPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: {
    role: "assistant" | "user" | "system";
    content: Array<{ type: "text"; text: string }>;
    timestamp?: number;
  };
  errorMessage?: string;
}

type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

// ============================================================================
// Hook Types
// ============================================================================

interface UseWebSocketChatOptions {
  wsUrl?: string;
  authToken?: string | null;
  historyScopeKey?: string;
  profileId?: string;
  sessionKey?: string;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  /** When false, do not open/reopen the websocket yet. Useful while an SSH tunnel is starting. */
  enabled?: boolean;
  /** Number of recent transcript messages to hydrate when switching sessions. 0 disables hydration. */
  sessionHydrationMessageLimit?: number;
  /** Workspace directory to use for this chat session's context injection/writes. */
  workspaceDir?: string;
}

export type GatewaySessionList = {
  ts: number;
  path: string;
  count: number;
  defaults?: {
    model?: string | null;
    modelProvider?: string | null;
    contextTokens?: number | null;
  };
  sessions: Array<{
    key: string;
    sessionId?: string;
    updatedAt?: number | null;
    thinkingLevel?: string;
    verboseLevel?: string;
    reasoningLevel?: string;
    sendPolicy?: string;
    model?: string;
    contextTokens?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    responseUsage?: "on" | "off" | "tokens" | "full";
    modelProvider?: string;
    workspaceDir?: string;
    label?: string;
    userLabel?: string;
    displayName?: string;
    provider?: string;
    groupChannel?: string;
    space?: string;
    subject?: string;
    chatType?: string;
    lastProvider?: string;
    lastTo?: string;
    lastAccountId?: string;
    derivedTitle?: string;
    lastMessagePreview?: string;
    activeTask?: {
      id?: string;
      goal?: string;
      definitionOfDone?: string;
      status?: string;
      criteriaTotal?: number;
      criteriaCompleted?: number;
      blockedReason?: string;
      needsUserReason?: string;
      lastEvaluationReason?: string;
      autoContinueEnabled?: boolean;
    };
    taskQueue?: {
      total?: number;
      runnable?: number;
    };
  }>;
};

export type GatewayAgentsList = {
  defaultId: string;
  mainKey: string;
  scope: "per-sender" | "global";
  agents: Array<{
    id: string;
    name?: string;
  }>;
};

export type GatewayModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

export interface ChatAttachmentInput {
  type?: string;
  mimeType: string;
  fileName: string;
  content: string; // base64 payload
}

interface UseWebSocketChatReturn {
  messages: ChatMessage[];
  sendMessage: (
    content: string,
    opts?: { deliver?: boolean; attachments?: ChatAttachmentInput[] },
  ) => Promise<void>;
  abortRun: () => Promise<void>;
  isConnected: boolean;
  isStreaming: boolean;
  runStatus: "idle" | "streaming" | "aborted" | "error";
  currentToolUses: ToolUseBlock[];
  toolEvents: Array<Record<string, unknown>>;
  compactionStatus: CompactionStatus | null;
  error: string | null;
  reconnect: () => void;
  clearMessages: () => void;
  deleteMessage: (index: number) => void;
  listSessions: (opts?: {
    limit?: number;
    activeMinutes?: number;
    includeGlobal?: boolean;
    includeUnknown?: boolean;
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
    agentId?: string;
  }) => Promise<GatewaySessionList>;
  listAgents: () => Promise<GatewayAgentsList>;
  listModels: () => Promise<{ models?: GatewayModelChoice[] }>;
  loadChatHistoryFromGateway: (limit?: number) => Promise<ChatMessage[]>;
  patchSession: (opts: {
    key: string;
    userLabel?: string | null;
    model?: string | null;
    thinkingLevel?: string | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
    workspaceDir?: string | null;
  }) => Promise<unknown>;
  getTask: (key: string) => Promise<Record<string, unknown>>;
  updateTask: (
    params: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  taskAction: (
    params: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  resetSession: (key: string) => Promise<unknown>;
  deleteSession: (
    key: string,
    opts?: { deleteTranscript?: boolean },
  ) => Promise<unknown>;
  request: <T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
    opts?: { timeoutMs?: number; reportErrors?: boolean },
  ) => Promise<T>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWebSocketChat(
  options: UseWebSocketChatOptions = {},
): UseWebSocketChatReturn {
  const {
    wsUrl,
    authToken,
    historyScopeKey = "default",
    profileId = "default",
    sessionKey = "agent:main:desktop",
    autoReconnect = true,
    reconnectDelayMs = 3000,
    enabled = true,
    sessionHydrationMessageLimit = 4,
    workspaceDir,
  } = options;
  const scopedSessionKey = `${historyScopeKey}:${sessionKey}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChatHistory(scopedSessionKey),
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<
    "idle" | "streaming" | "aborted" | "error"
  >("idle");
  const [currentToolUses, setCurrentToolUses] = useState<ToolUseBlock[]>([]);
  const [toolEvents, setToolEvents] = useState<Array<Record<string, unknown>>>(
    [],
  );
  const toolEventBufferRef = useRef<Array<Record<string, unknown>>>([]);
  const toolEventFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [compactionStatus, setCompactionStatus] =
    useState<CompactionStatus | null>(null);
  const compactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const resolvedWsUrlRef = useRef<string | null>(wsUrl ?? null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const messageIdRef = useRef(1);
  const pendingRequestsRef = useRef(
    new Map<
      string,
      {
        resolve: (payload: Record<string, unknown>) => void;
        reject: (err: Error) => void;
        timeoutId?: ReturnType<typeof setTimeout>;
        reportErrors?: boolean;
      }
    >(),
  );
  // Track tool sources per runId for citation UI
  const toolSourcesRef = useRef<Map<string, ToolSource[]>>(new Map());
  const toolUsesByRunRef = useRef<Map<string, ToolUseBlock[]>>(new Map());
  const mountedRef = useRef(true);
  const closeActiveSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    const active = wsRef.current;
    if (active) {
      // Clear the ref before closing so the socket's close handler knows this
      // was an intentional target change/cleanup and must not auto-reconnect
      // using the stale URL captured by that older connection.
      wsRef.current = null;
      try {
        active.close();
      } catch {
        /* ignore */
      }
    }
  }, []);
  // Track which runId is currently streaming so we know when to append vs update
  const activeRunIdRef = useRef<string | null>(null);
  const autoGrantedCredentialsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMessages(loadChatHistory(scopedSessionKey));
    activeRunIdRef.current = null;
  }, [scopedSessionKey]);

  useEffect(() => {
    saveChatHistory(scopedSessionKey, messages);
  }, [scopedSessionKey, messages]);

  const nextId = useCallback(() => String(messageIdRef.current++), []);

  const autoGrantCredentialRequest = useCallback(
    async (payload: Record<string, unknown>) => {
      const requestId = typeof payload.id === "string" ? payload.id : "";
      const credentialId =
        typeof payload.credentialId === "string" ? payload.credentialId : "";
      if (!requestId || !credentialId) return;
      if (autoGrantedCredentialsRef.current.has(requestId)) return;

      const policy = await loadVaultPolicy(profileId);
      const { ask, maxLeaseMs } = getRuleForCredential(policy, credentialId);
      if (ask !== "auto-grant" && ask !== "first-time") return;

      autoGrantedCredentialsRef.current.add(requestId);
      try {
        const requestedLeaseMs =
          typeof payload.leaseDurationMs === "number"
            ? payload.leaseDurationMs
            : 300_000;
        const leaseMs = maxLeaseMs
          ? Math.min(requestedLeaseMs, maxLeaseMs)
          : requestedLeaseMs;
        const purpose =
          typeof payload.purpose === "string" ? payload.purpose : undefined;
        const requester =
          typeof payload.requester === "string" ? payload.requester : undefined;
        const name =
          typeof payload.name === "string" ? payload.name : credentialId;
        const signedPayload = JSON.stringify({
          actionType: "vault.secret.use",
          vaultEntryId: credentialId,
          label: name,
          provider: requester,
          purpose,
          requestedBy: requester,
          scope: { operation: "credential.resolve", requestId },
          requestedAtMs: Date.now(),
        });
        const signed = await invoke<{ envelope: Record<string, unknown> }>(
          "sign_request",
          { payload: signedPayload },
        );
        await invoke("vault_use_for_credential_request", {
          profileId,
          id: credentialId,
          payload: signedPayload,
          envelope: signed.envelope,
          gatewayUrl: resolvedWsUrlRef.current,
          gatewayToken: authTokenRef.current,
          requestId,
          leaseMs,
        });
        console.log(`[Vault] Auto-granted ${credentialId} from chat listener`);
      } catch (err) {
        autoGrantedCredentialsRef.current.delete(requestId);
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[Vault] Auto-grant failed for ${credentialId}: ${message}`,
        );
        setError(`Vault auto-grant failed for ${name}: ${message}`);
      }
    },
    [profileId],
  );

  /**
   * Load auth token and gateway URL from config
   *
   * Priority for gateway URL:
   * 1. desktop-config.json gatewayUrl (user-set in Settings UI)
   * 2. ~/.edwinpai/edwinpai.json gateway.url or gateway.port
   * 3. Default ws://localhost:18789
   */
  const loadAuthAndUrl = useCallback(async (): Promise<{
    token: string | null;
    wsUrl: string;
  }> => {
    const defaultUrl = "ws://localhost:18789";
    try {
      // 1. Check explicit per-window overrides first, then desktop config.
      let desktopUrl: string | null = wsUrl ?? null;
      let desktopToken: string | null = authToken ?? null;
      try {
        const desktopConfig = await readConfig();
        if (!desktopUrl) {
          if (
            desktopConfig.gatewayUrl &&
            desktopConfig.gatewayUrl !== `http://localhost:18789`
          ) {
            desktopUrl = desktopConfig.gatewayUrl.replace(/^http/, "ws");
          } else if (
            desktopConfig.gatewayPort &&
            desktopConfig.gatewayPort !== 18789
          ) {
            desktopUrl = `ws://localhost:${desktopConfig.gatewayPort}`;
          }
        }
        // Explicit authToken takes priority, then token from Settings.
        if (!desktopToken && desktopConfig.gatewayToken) {
          desktopToken = desktopConfig.gatewayToken;
        }
      } catch {
        // Desktop config may not exist yet
      }

      // 2. Read EdwinPAI gateway config for auth token (and fallback URL)
      let edwinpaiToken: string | null = null;
      let configuredUrl = desktopUrl;
      try {
        const result = await invoke<{ config: Record<string, unknown> }>(
          "get_edwinpai_config",
        );
        const gateway = result.config.gateway as
          | Record<string, unknown>
          | undefined;
        const auth = gateway?.auth as Record<string, unknown> | undefined;
        edwinpaiToken = (auth?.token as string) ?? null;

        if (!configuredUrl) {
          const gwUrl = gateway?.url as string | undefined;
          const gwPort = gateway?.port as number | undefined;
          if (gwUrl) {
            configuredUrl = gwUrl.replace(/^http/, "ws");
          } else if (gwPort) {
            configuredUrl = `ws://localhost:${gwPort}`;
          }
        }
      } catch (err) {
        // edwinpai.json may have trailing commas or not exist — fall through to desktop config
        console.warn("[WS] Could not read edwinpai.json:", err);
      }

      // Token priority: desktop config > edwinpai config
      const token = desktopToken ?? edwinpaiToken;

      return { token, wsUrl: configuredUrl ?? defaultUrl };
    } catch (err) {
      console.error("[WS] Failed to load config:", err);
      return { token: null, wsUrl: defaultUrl };
    }
  }, [authToken, wsUrl]);

  /**
   * Handle incoming gateway frames
   */
  const handleFrame = useCallback(
    (frame: GatewayFrame) => {
      if (frame.type === "res") {
        // Response to one of our requests
        const res = frame as ResponseFrame;
        const pending = pendingRequestsRef.current.get(res.id);
        if (pending) {
          pendingRequestsRef.current.delete(res.id);
          if (pending.timeoutId) clearTimeout(pending.timeoutId);
          if (res.ok) {
            pending.resolve(res.payload ?? {});
          } else {
            const errMsg = res.error?.message ?? "Request failed";
            pending.reject(new Error(errMsg));
            if (pending.reportErrors !== false) {
              setError(errMsg);
            }
          }
          return;
        }

        if (!res.ok) {
          const errMsg = res.error?.message ?? "Request failed";
          console.error("[WS] Request failed:", res.error);
          setError(errMsg);
          // Show error in chat so user sees it
          setMessages((prev) => [
            ...prev,
            { role: "system", content: `Error: ${errMsg}` },
          ]);
        }
        // For connect response, mark as connected
        if (
          res.ok &&
          res.payload &&
          "type" in res.payload &&
          res.payload.type === "hello-ok"
        ) {
          console.log("[WS] Handshake complete");
          setIsConnected(true);
          setError(null);
        }
        return;
      }

      if (frame.type === "event") {
        const evt = frame as EventFrame;

        if (evt.event === "credential.requested" && evt.payload) {
          void autoGrantCredentialRequest(evt.payload);
        }

        if (evt.event === "chat" && evt.payload) {
          const chat = evt.payload as unknown as ChatPayload;

          // Filter for our session
          if (chat.sessionKey !== sessionKey) return;

          if (chat.state === "delta") {
            // Streaming delta — accumulate text
            const text =
              chat.message?.content
                ?.filter((c) => c.type === "text")
                .map((c) => c.text)
                .join("") ?? "";

            setIsStreaming((prev) => prev || true);
            setRunStatus((prev) => (prev === "streaming" ? prev : "streaming"));

            setMessages((prev) => {
              // If this is the same run as before, update last assistant message
              if (activeRunIdRef.current === chat.runId) {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === "assistant") {
                  return [...prev.slice(0, -1), { ...lastMsg, content: text }];
                }
              }
              // New run — add new assistant message
              activeRunIdRef.current = chat.runId;
              return [...prev, { role: "assistant", content: text }];
            });
          } else if (chat.state === "final") {
            // Final message
            const text =
              chat.message?.content
                ?.filter((c) => c.type === "text")
                .map((c) => c.text)
                .join("") ?? "";

            // Collect any tool sources accumulated during this run
            const sources = chat.runId
              ? toolSourcesRef.current.get(chat.runId)
              : undefined;
            if (chat.runId) toolSourcesRef.current.delete(chat.runId);

            const toolUses = chat.runId
              ? toolUsesByRunRef.current.get(chat.runId)
              : undefined;
            if (chat.runId) toolUsesByRunRef.current.delete(chat.runId);

            setIsStreaming(false);
            setRunStatus("idle");
            setCurrentToolUses([]);
            activeRunIdRef.current = null;

            if (text) {
              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                const nextPayload = {
                  content: text,
                  sources: sources?.length ? sources : undefined,
                  tool_use: toolUses?.length ? toolUses : undefined,
                };
                if (lastMsg && lastMsg.role === "assistant") {
                  return [...prev.slice(0, -1), { ...lastMsg, ...nextPayload }];
                }
                return [...prev, { role: "assistant", ...nextPayload }];
              });
            } else {
              // Model returned empty — surface it instead of silent no-op
              console.warn(
                "[WS] chat final with no content — model may have failed silently",
              );
              setMessages((prev) => [
                ...prev,
                {
                  role: "system",
                  content:
                    "Model returned no content. Check provider/API key configuration on the connected gateway.",
                },
              ]);
            }
          } else if (chat.state === "aborted") {
            setIsStreaming(false);
            setRunStatus("idle");
            setCurrentToolUses([]);
            activeRunIdRef.current = null;
            setMessages((prev) => [
              ...prev,
              { role: "system", content: "Run aborted." },
            ]);
          } else if (chat.state === "error") {
            setIsStreaming(false);
            setRunStatus("error");
            setCurrentToolUses([]);
            activeRunIdRef.current = null;
            const errMsg = chat.errorMessage ?? "Unknown error";
            setError(errMsg);
            setMessages((prev) => [
              ...prev,
              { role: "system", content: `Error: ${errMsg}` },
            ]);
          }
        }

        // Capture agent events (tool + compaction)
        if (evt.event === "agent" && evt.payload) {
          const agent = evt.payload as {
            runId?: string;
            stream?: string;
            data?: Record<string, unknown>;
            sessionKey?: string;
          };

          // Handle compaction events
          if (agent.stream === "compaction") {
            const phase =
              typeof agent.data?.phase === "string" ? agent.data.phase : "";
            if (compactionTimerRef.current != null) {
              clearTimeout(compactionTimerRef.current);
              compactionTimerRef.current = null;
            }
            if (phase === "start") {
              setCompactionStatus({
                active: true,
                startedAt: Date.now(),
                completedAt: null,
              });
            } else if (phase === "end") {
              setCompactionStatus((prev) => ({
                active: false,
                startedAt: prev?.startedAt ?? null,
                completedAt: Date.now(),
              }));
              compactionTimerRef.current = setTimeout(() => {
                setCompactionStatus(null);
                compactionTimerRef.current = null;
              }, 5000);
            }
            return;
          }

          if (agent.stream === "tool" && agent.runId) {
            const data = agent.data ?? {};
            const toolName = (data.name as string) ?? "";
            const phase = (data.phase as string) ?? "";
            const toolCallId = (data.toolCallId as string) ?? "";

            const matchesSession =
              !agent.sessionKey || agent.sessionKey === sessionKey;
            const matchesRun = activeRunIdRef.current
              ? agent.runId === activeRunIdRef.current
              : false;
            if (!matchesSession && !matchesRun) {
              return;
            }

            toolEventBufferRef.current.push({
              runId: agent.runId,
              phase,
              toolName,
              toolCallId,
              data,
              ts: Date.now(),
            });
            if (!toolEventFlushTimerRef.current) {
              toolEventFlushTimerRef.current = setTimeout(() => {
                const buffered = toolEventBufferRef.current;
                toolEventBufferRef.current = [];
                toolEventFlushTimerRef.current = null;
                setToolEvents((prev) =>
                  [...buffered.reverse(), ...prev].slice(0, 50),
                );
              }, 200);
            }

            if (phase === "start" && toolName && toolCallId) {
              const input =
                typeof data.args === "object" && data.args !== null
                  ? (data.args as Record<string, unknown>)
                  : {};
              const toolUse: ToolUseBlock = {
                id: toolCallId,
                name: toolName,
                input,
              };
              const existing = toolUsesByRunRef.current.get(agent.runId) ?? [];
              const next = [...existing, toolUse];
              toolUsesByRunRef.current.set(agent.runId, next);
              if (activeRunIdRef.current === agent.runId) {
                setCurrentToolUses(next);
              }
            }

            // Parse memory_search results
            if (toolName === "memory_search" && data.output) {
              try {
                const output =
                  typeof data.output === "string"
                    ? JSON.parse(data.output)
                    : data.output;
                const results = (
                  output as { results?: Array<Record<string, unknown>> }
                )?.results;
                if (Array.isArray(results)) {
                  const sources: ToolSource[] = results.map((r) => ({
                    tool: "memory_search",
                    path: (r.path as string) ?? "",
                    startLine: r.startLine as number | undefined,
                    endLine: r.endLine as number | undefined,
                    score: r.score as number | undefined,
                    snippet: (r.snippet as string)?.slice(0, 200),
                  }));
                  const existing =
                    toolSourcesRef.current.get(agent.runId) ?? [];
                  toolSourcesRef.current.set(agent.runId, [
                    ...existing,
                    ...sources,
                  ]);
                }
              } catch {
                /* ignore parse errors */
              }
            }
          }
        }

        // Ignore other events (presence, health, etc.)
        return;
      }
    },
    [sessionKey, autoGrantCredentialRequest],
  );

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    // Always re-read config on connect (token/URL may have changed in Settings)
    const { token, wsUrl: configUrl } = await loadAuthAndUrl();
    if (!token) {
      setError("Failed to load auth token from config");
      return;
    }
    authTokenRef.current = token;
    // Explicit wsUrl prop takes priority over config
    resolvedWsUrlRef.current = wsUrl ?? configUrl;

    const targetUrl = resolvedWsUrlRef.current;

    try {
      setError(null);
      // Close any existing connection before opening a new one
      if (wsRef.current || reconnectTimeoutRef.current) {
        console.log("[WS] Closing existing connection before reconnect");
        closeActiveSocket();
      }

      console.log("[WS] Connecting to", targetUrl);
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      // Build and send the connect handshake frame. Capture this socket so
      // delayed fallback timers from an older connection cannot send another
      // connect frame on a newer already-handshaken socket.
      const sendHandshake = async () => {
        if (!mountedRef.current || wsRef.current !== ws) return;
        console.log("[WS] Sending handshake...");

        // Build auth — token only (nonce is for ordering, not sent back in auth)
        const auth: Record<string, unknown> = {};
        if (authTokenRef.current) {
          auth.token = authTokenRef.current;
        }

        // Sign handshake with BSV identity key (best-effort)
        try {
          const identity = await signChallenge(
            `edwinpai-handshake:${Date.now()}`,
          );
          auth.identity = {
            publicKey: identity.publicKey,
            signature: identity.signature,
            shortId: identity.shortId,
          };
        } catch {
          // Identity signing not available — proceed with token only
        }

        // Send connect request frame (gateway protocol)
        const frame: RequestFrame = {
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
              platform: navigator.platform || "desktop",
              mode: "ui",
            },
            auth,
          } satisfies ConnectParams,
        };

        if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(frame));
        }
      };

      let handshakeSent = false;

      ws.addEventListener("open", () => {
        if (!mountedRef.current) return;
        console.log("[WS] Connected, waiting for challenge...");
        // Start a timeout — if no challenge arrives in 2s, send handshake directly
        // (backwards compat with gateways that don't send connect.challenge)
        setTimeout(() => {
          if (!handshakeSent && mountedRef.current && wsRef.current === ws) {
            console.log(
              "[WS] No challenge received, sending handshake directly",
            );
            handshakeSent = true;
            sendHandshake();
          }
        }, 2000);
      });

      ws.addEventListener("message", (event) => {
        if (!mountedRef.current) return;
        try {
          const frame = JSON.parse(event.data as string) as GatewayFrame;

          // Handle connect.challenge before anything else
          if (
            "event" in frame &&
            frame.event === "connect.challenge" &&
            !handshakeSent
          ) {
            console.log("[WS] Received connect.challenge, sending handshake");
            handshakeSent = true;
            sendHandshake();
            return;
          }

          handleFrame(frame);
        } catch (err) {
          console.error("[WS] Failed to parse frame:", err, event.data);
        }
      });

      ws.addEventListener("close", (event) => {
        if (!mountedRef.current) return;
        console.log("[WS] Disconnected:", event.code, event.reason);
        // Only null the ref if this is still the active connection
        // (React strict mode creates two connections; first close shouldn't kill second)
        if (wsRef.current === ws) {
          wsRef.current = null;
          setIsConnected(false);
          setIsStreaming(false);
          setRunStatus("idle");

          for (const [id, pending] of pendingRequestsRef.current.entries()) {
            pendingRequestsRef.current.delete(id);
            if (pending.timeoutId) clearTimeout(pending.timeoutId);
            pending.reject(new Error("Disconnected"));
          }

          if (autoReconnect && mountedRef.current) {
            console.log(`[WS] Reconnecting in ${reconnectDelayMs}ms...`);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) connect();
            }, reconnectDelayMs);
          }
        }
      });

      ws.addEventListener("error", () => {
        console.error("[WS] Connection error");
        setError("WebSocket connection failed");
      });
    } catch (err) {
      console.error("[WS] Failed to connect:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [
    autoReconnect,
    reconnectDelayMs,
    loadAuthAndUrl,
    handleFrame,
    nextId,
    wsUrl,
    enabled,
    closeActiveSocket,
  ]);

  const signParams = useCallback(async (params?: Record<string, unknown>) => {
    if (!params) return undefined;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const signed = await invoke<{
        payload: string;
        envelope: Record<string, unknown>;
      }>("sign_request", {
        payload: JSON.stringify(params),
      });
      return { ...params, signedEnvelope: signed.envelope };
    } catch {
      throw new Error("Failed to sign request");
    }
  }, []);

  const shouldSign = useCallback((method: string) => {
    const signedMethods = new Set([
      "sessions.patch",
      "sessions.reset",
      "sessions.delete",
      "config.patch",
      "config.apply",
    ]);
    return signedMethods.has(method);
  }, []);

  /**
   * Send a generic gateway request and wait for response
   */
  const request = useCallback(
    async <T = Record<string, unknown>>(
      method: string,
      params?: Record<string, unknown>,
      opts?: { timeoutMs?: number; reportErrors?: boolean },
    ): Promise<T> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to gateway");
      }

      const id = nextId();
      const timeoutMs = opts?.timeoutMs ?? 10_000;

      return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pendingRequestsRef.current.delete(id);
          reject(new Error("Request timed out"));
        }, timeoutMs);

        pendingRequestsRef.current.set(id, {
          resolve: (payload) => resolve(payload as T),
          reject,
          timeoutId,
          reportErrors: opts?.reportErrors,
        });

        const sendFrame = async () => {
          const signedParams = shouldSign(method)
            ? await signParams(params)
            : undefined;
          const frame: RequestFrame = {
            type: "req",
            id,
            method,
            params: signedParams ?? params,
          };

          ws.send(JSON.stringify(frame));
        };

        try {
          sendFrame().catch((err) => {
            clearTimeout(timeoutId);
            pendingRequestsRef.current.delete(id);
            reject(err instanceof Error ? err : new Error("Request failed"));
          });
        } catch (err) {
          clearTimeout(timeoutId);
          pendingRequestsRef.current.delete(id);
          reject(err instanceof Error ? err : new Error("Request failed"));
        }
      });
    },
    [nextId, signParams, shouldSign],
  );

  /**
   * Send a chat message
   */
  const sendMessage = useCallback(
    async (
      content: string,
      opts?: { deliver?: boolean; attachments?: ChatAttachmentInput[] },
    ) => {
      const trimmed = content.trim();
      const attachments = opts?.attachments ?? [];
      if (!trimmed && attachments.length === 0) return;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError("Not connected to gateway");
        return;
      }

      // Add user message to UI immediately. Keep the attachment payload on the
      // local message so pasted screenshots render as images instead of losing
      // fidelity behind a text-only placeholder.
      const nonImageAttachmentNote = attachments
        .filter((a) => !a.mimeType?.startsWith("image/"))
        .map((a) => `[Attached: ${a.fileName}]`)
        .join("\n");
      const localContent = [trimmed, nonImageAttachmentNote]
        .filter(Boolean)
        .join("\n\n");
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: localContent,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      ]);
      setCurrentToolUses([]);
      setIsStreaming(true);
      setRunStatus("streaming");

      // Send chat.send request frame
      try {
        const frame: RequestFrame = {
          type: "req",
          id: nextId(),
          method: "chat.send",
          params: {
            sessionKey,
            message: trimmed,
            deliver: opts?.deliver,
            attachments: attachments.length > 0 ? attachments : undefined,
            workspaceDir,
            idempotencyKey: crypto.randomUUID(),
          },
        };

        ws.send(JSON.stringify(frame));
      } catch (err) {
        console.error("[WS] Failed to send:", err);
        setError(err instanceof Error ? err.message : "Failed to send message");
      }
    },
    [sessionKey, nextId, workspaceDir],
  );

  const abortRun = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Not connected to gateway");
      return;
    }

    // Optimistically update UI immediately so stop feels responsive.
    // "Aborted" is a last outcome, not a current run state; once stopped, we're idle.
    setIsStreaming(false);
    setRunStatus("idle");

    try {
      const frame: RequestFrame = {
        type: "req",
        id: nextId(),
        method: "chat.abort",
        params: {
          sessionKey,
          runId: activeRunIdRef.current ?? undefined,
        },
      };

      ws.send(JSON.stringify(frame));
    } catch (err) {
      console.error("[WS] Failed to abort:", err);
      setError(err instanceof Error ? err.message : "Failed to abort run");
    }
  }, [sessionKey, nextId]);

  const clearMessages = useCallback(() => {
    clearChatHistory(scopedSessionKey);
    setMessages([]);
    activeRunIdRef.current = null;
    setIsStreaming(false);
    setRunStatus("idle");
    setCurrentToolUses([]);
  }, [scopedSessionKey]);

  const deleteMessage = useCallback((index: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const loadChatHistoryFromGateway = useCallback(
    async (limit = sessionHydrationMessageLimit) => {
      const normalizedLimit = Math.max(0, Math.min(100, Math.floor(limit)));
      if (normalizedLimit <= 0) return [];
      const result = await request<{ messages?: ChatMessage[] }>(
        "chat.history",
        { sessionKey, limit: normalizedLimit },
        { timeoutMs: 15_000, reportErrors: false },
      );
      const hydrated = Array.isArray(result.messages) ? result.messages : [];
      setMessages(hydrated);
      return hydrated;
    },
    [request, sessionHydrationMessageLimit, sessionKey],
  );

  useEffect(() => {
    if (!enabled || !isConnected || sessionHydrationMessageLimit <= 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await request<{ messages?: ChatMessage[] }>(
          "chat.history",
          { sessionKey, limit: sessionHydrationMessageLimit },
          { timeoutMs: 15_000, reportErrors: false },
        );
        if (cancelled) return;
        const hydrated = Array.isArray(result.messages) ? result.messages : [];
        setMessages(hydrated);
      } catch {
        // Fall back to locally cached chat history when gateway hydration is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, isConnected, request, sessionHydrationMessageLimit, sessionKey]);

  const listSessions = useCallback(
    async (opts?: {
      limit?: number;
      activeMinutes?: number;
      includeGlobal?: boolean;
      includeUnknown?: boolean;
      includeDerivedTitles?: boolean;
      includeLastMessage?: boolean;
      agentId?: string;
    }) => {
      return await request<GatewaySessionList>("sessions.list", {
        limit: opts?.limit,
        activeMinutes: opts?.activeMinutes,
        includeGlobal: opts?.includeGlobal,
        includeUnknown: opts?.includeUnknown,
        includeDerivedTitles: opts?.includeDerivedTitles,
        includeLastMessage: opts?.includeLastMessage,
        agentId: opts?.agentId,
      });
    },
    [request],
  );

  const listAgents = useCallback(async () => {
    return await request<GatewayAgentsList>("agents.list", {});
  }, [request]);

  const listModels = useCallback(async () => {
    return await request<{ models?: GatewayModelChoice[] }>("models.list", {});
  }, [request]);

  const patchSession = useCallback(
    async (opts: {
      key: string;
      userLabel?: string | null;
      model?: string | null;
      thinkingLevel?: string | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
      workspaceDir?: string | null;
    }) => {
      return await request("sessions.patch", opts as Record<string, unknown>);
    },
    [request],
  );

  const getTask = useCallback(
    async (key: string) => {
      return await request<Record<string, unknown>>("sessions.task.get", {
        key,
      });
    },
    [request],
  );

  const updateTask = useCallback(
    async (params: Record<string, unknown>) => {
      return await request<Record<string, unknown>>(
        "sessions.task.update",
        params,
      );
    },
    [request],
  );

  const taskAction = useCallback(
    async (params: Record<string, unknown>) => {
      return await request<Record<string, unknown>>(
        "sessions.task.action",
        params,
      );
    },
    [request],
  );

  const resetSession = useCallback(
    async (key: string) => {
      return await request("sessions.reset", { key });
    },
    [request],
  );

  const deleteSession = useCallback(
    async (key: string, opts?: { deleteTranscript?: boolean }) => {
      return await request("sessions.delete", {
        key,
        deleteTranscript: opts?.deleteTranscript,
      });
    },
    [request],
  );

  const reconnect = useCallback(() => {
    closeActiveSocket();
    if (enabled) connect();
  }, [closeActiveSocket, connect, enabled]);

  // Connect on mount, cleanup on unmount
  // Use ref to avoid reconnecting when connect's deps change
  const connectRef = useRef(connect);
  connectRef.current = connect;

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      closeActiveSocket();
      setIsConnected(false);
      setIsStreaming(false);
      setRunStatus("idle");
      return undefined;
    }

    connectRef.current();

    return () => {
      closeActiveSocket();
    };
  }, [enabled, wsUrl, authToken, sessionKey, closeActiveSocket]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      closeActiveSocket();
    };
  }, [closeActiveSocket]);

  return {
    messages,
    sendMessage,
    abortRun,
    isConnected,
    isStreaming,
    runStatus,
    currentToolUses,
    toolEvents,
    compactionStatus,
    error,
    reconnect,
    clearMessages,
    deleteMessage,
    listSessions,
    listAgents,
    listModels,
    loadChatHistoryFromGateway,
    patchSession,
    getTask,
    updateTask,
    taskAction,
    resetSession,
    deleteSession,
    request,
  };
}
