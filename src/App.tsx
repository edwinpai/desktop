import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChatView } from "@/components/ChatView";
import { StyledSelect } from "@/components/ui/styled-select";
import { GeneralSettings } from "@/components/GeneralSettings";
import { ClientModeFlow } from "@/components/client/ClientModeFlow";
import { ModeSwitch } from "@/components/client/ModeSwitch";
// AccessControlPanel removed — Access Control page handles user management
import { GatewayConnect } from "@/components/onboarding/GatewayConnect";
import { AccessControl } from "@/components/client/AccessControl";
import { ChannelList } from "@/components/channels/ChannelList";
import { WorkflowJobs } from "@/components/workflows/WorkflowJobs";
import { KnowledgePanel } from "@/components/knowledge/KnowledgePanel";
import { NodesPanel } from "@/components/nodes/NodesPanel";
import { ExecApprovalsPanel } from "@/components/exec-approvals/ExecApprovalsPanel";
import { CanvasWorkspace } from "@/components/CanvasWorkspace";
import { LogViewer } from "@/components/logs/LogViewer";
import { StatusDashboard } from "@/components/StatusDashboard";
import { UsagePanel } from "@/components/usage/UsagePanel";
import { SessionsPanel } from "@/components/sessions/SessionsPanel";
import { InstancesPanel } from "@/components/instances/InstancesPanel";
import { TasksPanel } from "@/components/tasks/TasksPanel";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { FileEditor } from "@/components/workspace/FileEditor";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LockScreen } from "@/components/LockScreen";
// PinSetup available for onboarding integration
import { useWebSocketChat } from "@/hooks/useWebSocketChat";
import { APP_VERSION } from "@/lib/app-version";
import { useTalkMode } from "@/hooks/useTalkMode";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import { useSshTunnel } from "@/hooks/useSshTunnel";
import { useTraySync } from "@/hooks/useTraySync";
import type { AccessLevel, ClientConnectionStatus } from "@/types/api";
import type { GatewayProfile } from "@/types/config";
import { DEFAULT_GATEWAY_PROFILE } from "@/types";
import { readConfig } from "@/lib/config";
import { VaultPanel } from "@/components/vault/VaultPanel";
import type { ChatDraft } from "@/components/InputBar";

const DEFAULT_GATEWAY_PORT = 18789;

type View = "chat" | "canvas" | "settings" | "client-connect" | "mode-select" | "discover-gateways" | "access-control" | "channels" | "workflows" | "knowledge" | "nodes" | "exec-approvals" | "logs" | "status" | "usage" | "sessions" | "tasks" | "instances" | "debug" | "workspace" | "vault";
type Mode = "gateway" | "client";

function App() {
  const [currentView, setCurrentView] = useState<View>("mode-select");
  const [currentMode, setCurrentMode] = useState<Mode>("gateway");
  const [isGatewayRunning, setIsGatewayRunning] = useState(false);
  const [isClientConnected, setIsClientConnected] = useState(false);
  const [clientConnectionStatus, setClientConnectionStatus] = useState<ClientConnectionStatus>("disconnected");
  const startConfiguredGateway = useCallback(async () => {
    const config = await readConfig().catch(() => null);
    const port = config?.gatewayPort || DEFAULT_GATEWAY_PORT;
    await invoke("start_gateway_real", { port });
    setIsGatewayRunning(true);
    return port;
  }, []);

  // Users managed entirely by AccessControl component
  const [currentUserLevel] = useState<AccessLevel>("owner");
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [agentId, setAgentId] = useState("main");
  const [mainSessionKey, setMainSessionKey] = useState("main");
  const [sessionKey, setSessionKey] = useState("agent:main:main");
  const [chatDrafts, setChatDrafts] = useState<Record<string, ChatDraft>>({});
  const [agentsList, setAgentsList] = useState<Array<{ id: string; name?: string }>>([]);
  const [modelsList, setModelsList] = useState<Array<{ id: string; name: string; provider: string; reasoning?: boolean; contextWindow?: number }>>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [thinkingLevel, setThinkingLevel] = useState("off");
  const [verboseLevel, setVerboseLevel] = useState("off");
  const [reasoningLevel, setReasoningLevel] = useState("off");
  const [sessionsList, setSessionsList] = useState<Array<{
    key: string;
    label?: string;
    displayName?: string;
    derivedTitle?: string;
    lastMessagePreview?: string;
    thinkingLevel?: string;
    verboseLevel?: string;
    reasoningLevel?: string;
    model?: string;
    contextTokens?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    responseUsage?: "on" | "off" | "tokens" | "full";
    activeTask?: {
      goal?: string;
      status?: string;
      criteriaTotal?: number;
      criteriaCompleted?: number;
    };
    taskQueue?: {
      total?: number;
      runnable?: number;
    };
  }>>([]);
  const [deliverEnabled, setDeliverEnabled] = useState(false);
  const [memoryConfig, setMemoryConfig] = useState<{
    contextWindowSize?: number;
    autoSummarize?: boolean;
    summarizationThreshold?: number;
  } | null>(null);
  const [gatewayTargetKey, setGatewayTargetKey] = useState("default:http://localhost:18789");
  const [gatewayProfiles, setGatewayProfiles] = useState<GatewayProfile[]>([DEFAULT_GATEWAY_PROFILE]);
  const [activeProfile, setActiveProfile] = useState<GatewayProfile>(DEFAULT_GATEWAY_PROFILE);

  // SSH tunnel for remote gateway profiles
  const { tunnelState, effectiveUrl } = useSshTunnel(activeProfile);

  // WebSocket chat hook
  const {
    messages,
    sendMessage: handleSendMessage,
    abortRun: handleAbortRun,
    isStreaming,
    runStatus,
    currentToolUses,
    toolEvents,
    compactionStatus,
    isConnected,
    reconnect,
    error: chatError,
    clearMessages,
    deleteMessage,
    listSessions,
    listAgents,
    listModels,
    patchSession,
    resetSession,
    deleteSession,
    request,
  } = useWebSocketChat({
    sessionKey,
    wsUrl: activeProfile.ssh?.enabled ? effectiveUrl.replace(/^http/, "ws") : undefined,
  });

  const handleChatDraftChange = useCallback((key: string, draft: ChatDraft) => {
    setChatDrafts((prev) => {
      const isEmpty = draft.value.length === 0 && draft.attachments.length === 0;
      if (isEmpty) {
        if (!(key in prev)) return prev;
        const { [key]: _removedDraft, ...next } = prev;
        void _removedDraft;
        return next;
      }
      return { ...prev, [key]: draft };
    });
  }, []);

  const handleCurrentSessionDraftChange = useCallback((draft: ChatDraft) => {
    handleChatDraftChange(sessionKey, draft);
  }, [handleChatDraftChange, sessionKey]);

  const talkMode = useTalkMode({
    onSendMessage: handleSendMessage,
    request,
    gatewayKind: 'local',
    autoTts: true,
  });

  // Fetch channel count from gateway when connected
  const [channelCount, setChannelCount] = useState(0);
  useEffect(() => {
    if (!isConnected) {
      setChannelCount(0);
      setMemoryConfig(null);
      return;
    }
    request<{
      config?: {
        messages?: { channels?: Record<string, unknown> };
        memory?: {
          contextWindowSize?: number;
          autoSummarize?: boolean;
          summarizationThreshold?: number;
        };
      };
    }>("config.get")
      .then((result) => {
        const channels = result?.config?.messages?.channels;
        const memory = result?.config?.memory;
        setChannelCount(channels ? Object.keys(channels).length : 0);
        setMemoryConfig(memory ?? null);
      })
      .catch(() => {
        setChannelCount(0);
        setMemoryConfig(null);
      });
  }, [isConnected, request]);

  // Sync app state to system tray
  useTraySync({
    isConnected,
    activeProfileName: activeProfile.name,
    sshTunnelStatus: tunnelState?.status ?? null,
    channelCount,
  });

  // Desktop notifications (fires when window is unfocused)
  useDesktopNotifications({
    enabled: true,
    messages,
    isConnected,
    runStatus,
  });

  const handleSaveSettings = (settings: unknown) => {
    console.log("Settings saved:", settings);

    if (!settings || typeof settings !== "object") {
      return;
    }

    const nextSettings = settings as {
      activeGatewayProfileId?: string;
      gatewayUrl?: string;
    };
    const nextProfileId = nextSettings.activeGatewayProfileId ?? "default";
    const nextGatewayUrl = nextSettings.gatewayUrl ?? "http://localhost:18789";
    const nextTargetKey = `${nextProfileId}:${nextGatewayUrl}`;

    if (nextTargetKey === gatewayTargetKey) {
      return;
    }

    setGatewayTargetKey(nextTargetKey);
    setAgentId("main");
    setMainSessionKey("main");
    setSessionKey("agent:main:main");
    setAgentsList([]);
    setModelsList([]);
    setSessionsList([]);
    setModelId(null);
    setThinkingLevel("off");
    setVerboseLevel("off");
    setReasoningLevel("off");
    setDeliverEnabled(false);
    clearMessages();
    reconnect();
  };

  useEffect(() => {
    readConfig()
      .then((config) => {
        setGatewayTargetKey(`${config.activeGatewayProfileId}:${config.gatewayUrl}`);
        if (config.gatewayProfiles?.length) {
          setGatewayProfiles(config.gatewayProfiles);
          const active = config.gatewayProfiles.find(
            (p: GatewayProfile) => p.id === config.activeGatewayProfileId
          ) ?? config.gatewayProfiles[0];
          if (active) setActiveProfile(active);
        }
      })
      .catch(() => {
        setGatewayTargetKey("default:http://localhost:18789");
      });
  }, []);

  const refreshSessions = async (agentOverride?: string) => {
    if (!isConnected) return;
    try {
      const result = await listSessions({
        includeGlobal: false,
        includeUnknown: false,
        includeDerivedTitles: true,
        includeLastMessage: true,
        agentId: agentOverride ?? agentId,
      });
      const next = result.sessions.map((session) => ({
        key: session.key,
        label: session.label,
        displayName: session.displayName,
        derivedTitle: session.derivedTitle,
        lastMessagePreview: session.lastMessagePreview,
        thinkingLevel: session.thinkingLevel,
        verboseLevel: session.verboseLevel,
        reasoningLevel: session.reasoningLevel,
        model: session.model,
        contextTokens: session.contextTokens,
        inputTokens: session.inputTokens,
        outputTokens: session.outputTokens,
        totalTokens: session.totalTokens,
        responseUsage: session.responseUsage,
        activeTask: session.activeTask,
        taskQueue: session.taskQueue,
      }));
      setSessionsList(next);
      const current = next.find((session) => session.key === sessionKey);
      if (current) {
        setThinkingLevel(current.thinkingLevel ?? "off");
        setVerboseLevel(current.verboseLevel ?? "off");
        setReasoningLevel(current.reasoningLevel ?? "off");
        setModelId(current.model ?? null);
      }
    } catch (err) {
      console.error("Failed to list sessions:", err);
    }
  };

  const refreshAgents = async () => {
    if (!isConnected) return;
    try {
      const result = await listAgents();
      setAgentsList(result.agents);
      const resolvedMainKey = result.mainKey || mainSessionKey;
      const resolvedAgentId = agentId || result.defaultId || "main";
      if (result.mainKey) {
        setMainSessionKey(result.mainKey);
      }
      if (!agentId && result.defaultId) {
        setAgentId(result.defaultId);
      }
      const expectedKey = `agent:${resolvedAgentId}:${resolvedMainKey}`;
      if (sessionKey !== expectedKey) {
        setSessionKey(expectedKey);
      }
    } catch (err) {
      console.error("Failed to list agents:", err);
    }
  };

  const refreshModels = async () => {
    if (!isConnected) return;
    try {
      const result = await listModels();
      // Deduplicate models by id (gateway may return same model from multiple providers)
      const seen = new Set<string>();
      const deduped = (result.models ?? []).filter((model) => {
        if (seen.has(model.id)) return false;
        seen.add(model.id);
        return true;
      });
      setModelsList(
        deduped.map((model) => ({
          id: model.id,
          name: model.name,
          provider: model.provider,
          reasoning: model.reasoning,
          contextWindow: model.contextWindow,
        })),
      );
    } catch (err) {
      console.error("Failed to list models:", err);
    }
  };

  const handleSelectSession = (key: string) => {
    setSessionKey(key);
    clearMessages();
  };

  const handleNewSession = () => {
    const newKey = `agent:${agentId}:desktop-${Date.now().toString(36)}`;
    setSessionKey(newKey);
    clearMessages();
  };

  const handleResetSession = async () => {
    try {
      await resetSession(sessionKey);
      clearMessages();
      refreshSessions();
    } catch (err) {
      console.error("Failed to reset session:", err);
    }
  };

  const handleDeleteSession = async () => {
    try {
      await deleteSession(sessionKey, { deleteTranscript: true });
      const nextKey = `agent:${agentId}:${mainSessionKey}`;
      setSessionKey(nextKey);
      clearMessages();
      refreshSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleExecuteTasks = async () => {
    try {
      await request('sessions.tasks.execute', { key: sessionKey });
      refreshSessions();
    } catch (err) {
      console.error("Failed to execute queued tasks:", err);
    }
  };

  const handleSelectAgent = (nextAgentId: string) => {
    setAgentId(nextAgentId);
    const nextKey = `agent:${nextAgentId}:${mainSessionKey}`;
    setSessionKey(nextKey);
    clearMessages();
    refreshSessions(nextAgentId);
  };

  const handleSelectProfile = useCallback(async (profileId: string) => {
    const profile = gatewayProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    setActiveProfile(profile);
    // Persist active profile + sync top-level fields so loadAuthAndUrl picks them up
    const { updateConfig } = await import("@/lib/config");
    await updateConfig({
      activeGatewayProfileId: profileId,
      gatewayUrl: profile.ssh?.enabled
        ? `http://localhost:${profile.ssh.localPort}`
        : profile.gatewayUrl,
      gatewayPort: profile.ssh?.enabled
        ? profile.ssh.localPort
        : profile.gatewayPort,
      gatewayToken: profile.gatewayToken,
    });
    // Reset session state for clean switch
    setAgentId("main");
    setMainSessionKey("main");
    setSessionKey("agent:main:main");
    setAgentsList([]);
    setModelsList([]);
    setSessionsList([]);
    setModelId(null);
    setGatewayTargetKey(`${profileId}:${profile.gatewayUrl}`);
    clearMessages();
    reconnect();
  }, [gatewayProfiles, clearMessages, reconnect]);

  // Message actions: retry, edit, delete
  const handleRetryMessage = useCallback((messageIndex: number) => {
    // Find the user message preceding this assistant message and re-send it
    const msg = messages[messageIndex];
    if (!msg || msg.role !== 'assistant') return;
    for (let i = messageIndex - 1; i >= 0; i--) {
      const prev = messages[i];
      if (prev && prev.role === 'user') {
        handleSendMessage(prev.content, { deliver: deliverEnabled });
        break;
      }
    }
  }, [messages, handleSendMessage, deliverEnabled]);

  const handleEditMessage = useCallback((content: string) => {
    // Focus the input bar and populate it with the message content
    const textarea = document.querySelector('textarea');
    if (textarea) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      nativeInputValueSetter?.call(textarea, content);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    }
  }, []);

  const handleDeleteMessage = useCallback((messageIndex: number) => {
    deleteMessage(messageIndex);
  }, [deleteMessage]);

  const handleSlashCommand = useCallback((command: string, args: string) => {
    switch (command) {
      case "/agent":
        if (args) handleSelectAgent(args);
        break;
      case "/model":
        if (args) handleSelectModel(args);
        else handleSelectModel(null);
        break;
      case "/session":
        if (args) handleSelectSession(args);
        break;
      case "/new":
        handleNewSession();
        break;
      case "/reset":
        handleResetSession();
        break;
      case "/think":
        if (args) handleSelectThinkingLevel(args);
        break;
      case "/verbose":
        if (args) handleSelectVerboseLevel(args);
        break;
      case "/reasoning":
        if (args) handleSelectReasoningLevel(args);
        break;
      case "/abort":
        handleAbortRun();
        break;
      case "/status":
        // Send as a regular message — the agent will respond with status
        handleSendMessage("/status", { deliver: deliverEnabled });
        break;
      case "/help":
        handleSendMessage("/help", { deliver: deliverEnabled });
        break;
      default:
        // Unknown slash command — send as regular message (may be a gateway-defined command)
        handleSendMessage(`${command}${args ? ` ${args}` : ""}`, { deliver: deliverEnabled });
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliverEnabled]);

  const handleSelectModel = async (nextModelId: string | null) => {
    setModelId(nextModelId);
    try {
      await patchSession({ key: sessionKey, model: nextModelId ?? null });
      refreshSessions();
    } catch (err) {
      console.error("Failed to update model:", err);
    }
  };

  const handleSelectThinkingLevel = async (level: string) => {
    setThinkingLevel(level);
    try {
      await patchSession({ key: sessionKey, thinkingLevel: level });
      refreshSessions();
    } catch (err) {
      console.error("Failed to update thinking level:", err);
    }
  };

  const handleSelectVerboseLevel = async (level: string) => {
    setVerboseLevel(level);
    try {
      await patchSession({ key: sessionKey, verboseLevel: level });
      refreshSessions();
    } catch (err) {
      console.error("Failed to update verbose level:", err);
    }
  };

  const handleSelectReasoningLevel = async (level: string) => {
    setReasoningLevel(level);
    try {
      await patchSession({ key: sessionKey, reasoningLevel: level });
      refreshSessions();
    } catch (err) {
      console.error("Failed to update reasoning level:", err);
    }
  };

  // Mode-based initialization on mount
  useEffect(() => {
    async function initializeApp() {
      try {
        // Check app lock status (skip if already unlocked this session)
        const sessionUnlocked = sessionStorage.getItem('edwinpai_unlocked') === 'true';
        if (!sessionUnlocked) {
          try {
            const hasLock = await invoke<boolean>('has_app_lock');
            if (hasLock) {
              setIsLocked(true);
              setIsInitializing(false);
              return;
            }
          } catch {
            // Lock check failed — proceed without lock
          }
        }

        // Check onboarding status from localStorage (desktop-only state)
        const onboardingDone = localStorage.getItem("edwinpai_onboarding_complete") === "true";
        if (!onboardingDone) {
          setNeedsOnboarding(true);
          setIsInitializing(false);
          return;
        }

        // Check for saved mode preference
        const savedMode = localStorage.getItem("edwinpai_mode") as Mode | null;

        if (savedMode === "gateway") {
          setCurrentMode("gateway");
          try {
            const probe = await invoke<{ found: boolean }>("probe_gateway");
            if (!probe.found) {
              await startConfiguredGateway();
            } else {
              setIsGatewayRunning(true);
            }
            setCurrentView("chat");
          } catch (error) {
            console.error("Failed to detect/start gateway:", error);
            setCurrentView("mode-select");
          }
        } else if (savedMode === "client") {
          setCurrentMode("client");
          try {
            const probe = await invoke<{ found: boolean }>("probe_gateway");
            if (probe.found) {
              setCurrentMode("gateway");
              setIsGatewayRunning(true);
              setCurrentView("chat");
              localStorage.setItem("edwinpai_mode", "gateway");
              setIsInitializing(false);
              return;
            }
          } catch {
            // probe not available
          }
          setIsClientConnected(false);
          setClientConnectionStatus("disconnected");
          setCurrentView("discover-gateways");
        } else {
          // No saved mode — auto-detect running gateway
          try {
            const probe = await invoke<{ found: boolean }>("probe_gateway");
            if (probe.found) {
              setCurrentMode("gateway");
              setIsGatewayRunning(true);
              setCurrentView("chat");
              localStorage.setItem("edwinpai_mode", "gateway");
              setIsInitializing(false);
              return;
            }
          } catch {
            // probe not available
          }
          setCurrentView("mode-select");
        }
      } catch (error) {
        console.error("Initialization error:", error);
        setCurrentView("mode-select");
      } finally {
        setIsInitializing(false);
      }
    }

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, startConfiguredGateway]);

  useEffect(() => {
    if (isConnected) {
      refreshAgents();
      refreshModels();
      refreshSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, sessionKey, currentView]);

  useEffect(() => {
    if (!isConnected || currentView !== "chat" || isStreaming) return;
    refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, currentView, isStreaming, messages.length, sessionKey]);

  useEffect(() => {
    if (!toolEvents.length) return;
    const evt = toolEvents[0] as Record<string, unknown>;
    const toolName = evt.toolName as string | undefined;
    const phase = evt.phase as string | undefined;
    const data = evt.data as Record<string, unknown> | undefined;
    if (toolName !== "canvas" || phase !== "end" || !data) return;
    if ((data.action as string | undefined) !== "snapshot") return;

    const findImage = (value: unknown): string | null => {
      if (typeof value === "string") {
        if (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")) return value;
        if (value.startsWith("MEDIA:")) return value.replace(/^MEDIA:\\s*/, "").trim();
        if (value.endsWith(".png") || value.endsWith(".jpg") || value.endsWith(".jpeg") || value.endsWith(".webp")) return value;
        return null;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findImage(item);
          if (found) return found;
        }
        return null;
      }
      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        for (const k of ["output", "result", "image", "path", "url", "snapshot", "media"]) {
          const found = findImage(obj[k]);
          if (found) return found;
        }
      }
      return null;
    };

    const image = findImage(data);
    if (image) {
      setCurrentView("canvas");
    }
  }, [toolEvents]);

  const handleOnboardingComplete = async () => {
    // Always transition out of onboarding, even if save fails
    setNeedsOnboarding(false);
    setCurrentView("chat");

    // Save onboarding completion to localStorage (desktop-only state)
    // DO NOT write to ~/.edwinpai/edwinpai.json — that's the shared gateway config
    try {
      localStorage.setItem("edwinpai_onboarding_complete", "true");
      localStorage.removeItem("edwinpai_onboarding_progress");
    } catch {
      // ignore
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setCurrentMode(newMode);
    localStorage.setItem("edwinpai_mode", newMode);

    if (newMode === "gateway") {
      setIsClientConnected(false);
      setClientConnectionStatus("disconnected");
      setCurrentView("chat");
      startConfiguredGateway().catch((err) => {
        console.error("Failed to start gateway:", err);
        setCurrentView("mode-select");
      });
    } else {
      setIsGatewayRunning(false);
      setCurrentView("discover-gateways");
    }
  };

  const handleClientConnected = () => {
    setIsClientConnected(true);
    setClientConnectionStatus("connected");
    setCurrentView("chat");
  };

  // User management handled by AccessControl component

  // Show loading state during initialization
  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading EdwinPAI Desktop...</p>
        </div>
      </div>
    );
  }

  // Show lock screen if app is locked
  if (isLocked) {
    return (
      <LockScreen
        onUnlock={() => {
          sessionStorage.setItem('edwinpai_unlocked', 'true');
          setIsLocked(false);
          setIsInitializing(true);
        }}
      />
    );
  }

  // Show onboarding wizard if needed
  if (needsOnboarding) {
    return (
      <ErrorBoundary>
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onCancel={() => setNeedsOnboarding(false)}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden">
        {currentView === "mode-select" && (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-4xl w-full">
              <h1 className="text-3xl font-bold mb-2 text-center">Welcome to EdwinPAI Desktop</h1>
              <p className="text-muted-foreground mb-8 text-center">
                Choose how you want to use EdwinPAI
              </p>
              <ModeSwitch
                currentMode={currentMode}
                onModeChange={handleModeChange}
                isGatewayRunning={isGatewayRunning}
                isClientConnected={isClientConnected}
              />
            </div>
          </div>
        )}

        {currentView === "client-connect" && (
          <ClientModeFlow
            onComplete={handleClientConnected}
            onCancel={() => setCurrentView("mode-select")}
          />
        )}

        {currentView === "discover-gateways" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-6">Discover Gateways</h2>
              <GatewayConnect onConnected={() => {
                reconnect();
                setCurrentView("chat");
              }} />
            </div>
          </div>
        )}

        {currentView === "chat" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <ChatView
              messages={messages}
              onSendMessage={handleSendMessage}
              onAbortRun={handleAbortRun}
              isLoading={isStreaming}
              runStatus={runStatus}
              currentToolUses={currentToolUses}
              toolEvents={toolEvents}
              isConnected={isConnected}
              error={chatError}
              onNavigateToSettings={() => setCurrentView("settings")}
              sessionKey={sessionKey}
              sessions={sessionsList}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onResetSession={handleResetSession}
              onDeleteSession={handleDeleteSession}
              agentId={agentId}
              agents={agentsList}
              onSelectAgent={handleSelectAgent}
              modelId={modelId}
              models={modelsList}
              memoryConfig={memoryConfig}
              compactionStatus={compactionStatus}
              onSelectModel={handleSelectModel}
              thinkingLevel={thinkingLevel}
              verboseLevel={verboseLevel}
              reasoningLevel={reasoningLevel}
              onSelectThinkingLevel={handleSelectThinkingLevel}
              onSelectVerboseLevel={handleSelectVerboseLevel}
              onSelectReasoningLevel={handleSelectReasoningLevel}
              deliverEnabled={deliverEnabled}
              onToggleDeliver={setDeliverEnabled}
              talkPhase={talkMode.phase}
              talkError={talkMode.error}
              onTalkToggle={talkMode.toggle}
              onTalkCancel={talkMode.cancel}
              onReplyReceived={talkMode.onReplyReceived}
              onRetryMessage={handleRetryMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onSlashCommand={handleSlashCommand}
              onExecuteTasks={handleExecuteTasks}
              draft={chatDrafts[sessionKey]}
              onDraftChange={handleCurrentSessionDraftChange}
            />
          </div>
        )}

        {currentView === "canvas" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <CanvasWorkspace sessionKey={sessionKey} toolEvents={toolEvents} />
          </div>
        )}

        {currentView === "settings" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto">
              <GeneralSettings
                onSave={handleSaveSettings}
                currentMode={currentMode}
                onModeChange={(mode) => {
                  setCurrentMode(mode);
                  localStorage.setItem("edwinpai_mode", mode);
                  if (mode === "gateway") {
                    setCurrentView("chat");
                  } else {
                    setCurrentView("discover-gateways");
                  }
                }}
              />
            </div>
          </div>
        )}

        {currentView === "access-control" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-6">Access Control</h2>
              <AccessControl
                currentUserLevel={currentUserLevel}
                currentMode={currentMode}
              />
            </div>
          </div>
        )}

        {currentView === "channels" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto">
              <ErrorBoundary name="ChannelsTabErrorBoundary" autoRetry={false}>
                <ChannelList currentUserLevel={currentUserLevel} mode={currentMode} />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {currentView === "workflows" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto">
              <ErrorBoundary name="WorkflowsTabErrorBoundary" autoRetry={false}>
                <WorkflowJobs />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {currentView === "knowledge" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto">
              <ErrorBoundary name="KnowledgeTabErrorBoundary" autoRetry={false}>
                <KnowledgePanel />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {currentView === "nodes" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto">
              <NodesPanel />
            </div>
          </div>
        )}

        {currentView === "exec-approvals" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto">
              <ExecApprovalsPanel profileId={activeProfile.id} />
            </div>
          </div>
        )}

        {currentView === "vault" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <div className="flex-1 overflow-y-auto">
              <VaultPanel profileId={activeProfile.id} />
            </div>
          </div>
        )}

        {currentView === "logs" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <LogViewer />
          </div>
        )}

        {currentView === "status" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <StatusDashboard />
          </div>
        )}

        {currentView === "usage" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <UsagePanel />
          </div>
        )}


        {currentView === "sessions" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <SessionsPanel
              sessions={sessionsList}
              currentSessionKey={sessionKey}
              onSelectSession={(key) => {
                setSessionKey(key);
                setCurrentView("chat");
              }}
              onNewSession={() => {
                const newKey = `session-${Date.now()}`;
                setSessionKey(`agent:${agentId}:${newKey}`);
                setMainSessionKey(newKey);
                setCurrentView("chat");
              }}
              onDeleteSession={(key) => {
                deleteSession?.(key);
                refreshSessions();
              }}
              onResetSession={(key) => {
                resetSession?.(key);
                refreshSessions();
              }}
            />
          </div>
        )}

        {currentView === "tasks" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <ErrorBoundary name="TasksTabErrorBoundary" autoRetry={false}>
              <TasksPanel
                sessionKey={sessionKey}
                sessions={sessionsList}
                onSelectSession={(key) => setSessionKey(key)}
                onOpenChat={(key) => {
                  setSessionKey(key);
                  setCurrentView("chat");
                }}
                onTasksChanged={() => refreshSessions()}
                request={request}
              />
            </ErrorBoundary>
          </div>
        )}

        {currentView === "instances" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <InstancesPanel request={request} />
          </div>
        )}

        {currentView === "debug" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <DebugPanel request={request} />
          </div>
        )}

        {currentView === "workspace" && (
          <div className="flex h-full">
            <SidebarNav
              currentView={currentView}
              currentMode={currentMode}
              onNavigate={setCurrentView}
              profiles={gatewayProfiles}
              activeProfileId={activeProfile.id}
              onSelectProfile={handleSelectProfile}
              tunnelStatus={tunnelState?.status ?? null}
            />
            <FileEditor request={request} />
          </div>
        )}
      </div>


      {/* Connection Status Footer */}
      <ConnectionStatusFooter
        mode={currentMode}
        isGatewayRunning={isGatewayRunning}
        clientConnectionStatus={clientConnectionStatus}
      />
    </div>
  );
}

// Sidebar component with mode-based navigation
function SidebarNav({
  currentView,
  currentMode,
  onNavigate,
  profiles,
  activeProfileId,
  onSelectProfile,
  tunnelStatus,
}: {
  currentView: View;
  currentMode: Mode;
  onNavigate: (view: View) => void;
  profiles?: GatewayProfile[];
  activeProfileId?: string;
  onSelectProfile?: (profileId: string) => void;
  tunnelStatus?: string | null;
}) {
  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">EdwinPAI Desktop</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {currentMode === "gateway" ? "Gateway Mode" : "Client Mode"}
        </p>
        {profiles && profiles.length > 1 && onSelectProfile && (
          <StyledSelect
            value={activeProfileId ?? "default"}
            onChange={(e) => onSelectProfile(e.target.value)}
            className="mt-2 text-xs"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.ssh?.enabled ? " (SSH)" : ""}
              </option>
            ))}
          </StyledSelect>
        )}
        {tunnelStatus && (
          <div className={`mt-1 text-xs ${tunnelStatus === "connected" ? "text-green-500" : tunnelStatus === "error" ? "text-destructive" : "text-yellow-500"}`}>
            SSH: {tunnelStatus}
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <button
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            currentView === "chat"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          }`}
          onClick={() => onNavigate("chat")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </button>

        {currentMode === "gateway" && (
          <>
            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "tasks"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("tasks")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Tasks
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "workflows"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("workflows")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12h18" />
                <path d="M3 6h18" />
                <path d="M3 18h18" />
              </svg>
              Workflows
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "exec-approvals"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("exec-approvals")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Exec Approvals
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "knowledge"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("knowledge")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 6v12" />
                <path d="M17 4v16" />
                <path d="M7 8v10" />
                <path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              Knowledge
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "vault"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("vault")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Vault
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "access-control"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("access-control")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Access Control
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "logs"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("logs")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
              </svg>
              Logs
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "status"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("status")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Status
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "canvas"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("canvas")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="14" rx="2" ry="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
              Canvas
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "channels"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("channels")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M9 10h6" />
                <path d="M9 14h6" />
              </svg>
              Channels
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "nodes"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("nodes")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7h18" />
                <path d="M3 12h18" />
                <path d="M3 17h18" />
              </svg>
              Nodes
            </button>

            <div className="mt-2 pt-2 border-t">
              <p className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Admin</p>
            </div>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "usage"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("usage")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
              </svg>
              Usage
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "workspace"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("workspace")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 13l-2 2 2 2" /><path d="M14 17l2-2-2-2" />
              </svg>
              Workspace
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "sessions"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("sessions")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
              </svg>
              Sessions
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "instances"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("instances")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />
              </svg>
              Instances
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "debug"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("debug")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" />
              </svg>
              Debug
            </button>
          </>
        )}

        {currentMode === "client" && (
          <>
            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "discover-gateways"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("discover-gateways")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              Discover Gateways
            </button>

            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                currentView === "canvas"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => onNavigate("canvas")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="14" rx="2" ry="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
              Canvas
            </button>
          </>
        )}

        <button
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            currentView === "settings"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          }`}
          onClick={() => onNavigate("settings")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </button>
      </nav>


      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground">Version {APP_VERSION}</p>
      </div>
    </aside>
  );
}

// Connection Status Footer
function ConnectionStatusFooter({
  mode,
  isGatewayRunning: isGatewayRunningProp,
  clientConnectionStatus,
}: {
  mode: Mode;
  isGatewayRunning: boolean;
  clientConnectionStatus: ClientConnectionStatus;
}) {
  // Probe for externally-managed gateway
  const [probeRunning, setProbeRunning] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const result = await invoke<{ found: boolean }>("probe_gateway");
        if (!cancelled) setProbeRunning(result.found);
      } catch {
        // probe not available
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const isGatewayRunning = isGatewayRunningProp || probeRunning;

  const getStatusColor = () => {
    if (mode === "gateway") {
      return isGatewayRunning ? "bg-green-500" : "bg-gray-400";
    } else {
      switch (clientConnectionStatus) {
        case "connected":
          return "bg-green-500";
        case "connecting":
        case "reconnecting":
          return "bg-yellow-500";
        case "failed":
          return "bg-red-500";
        default:
          return "bg-gray-400";
      }
    }
  };

  const getStatusText = () => {
    if (mode === "gateway") {
      return isGatewayRunning ? "Gateway Running" : "Gateway Stopped";
    } else {
      switch (clientConnectionStatus) {
        case "connected":
          return "Connected to Gateway";
        case "connecting":
          return "Connecting...";
        case "reconnecting":
          return "Reconnecting...";
        case "failed":
          return "Connection Failed";
        default:
          return "Disconnected";
      }
    }
  };

  return (
    <div className="border-t bg-muted/30 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
        <span className="text-xs text-muted-foreground">{getStatusText()}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {mode === "gateway" ? "🏠 Gateway" : "🔌 Client"}
      </div>
    </div>
  );
}

export default App;
