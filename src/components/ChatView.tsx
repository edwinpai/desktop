import { useEffect, useRef, useState, useCallback } from "react";
import { AlertCircle, Loader2, Maximize2, Minimize2, Settings, WifiOff, Zap } from "lucide-react";
import { MessageBubble, type GroupPosition } from "@/components/MessageBubble";
import { SearchDialog } from "@/components/chat/SearchDialog";
import { KeyboardShortcutsDialog } from "@/components/chat/KeyboardShortcutsDialog";
import { InputBar, type ChatDraft } from "@/components/InputBar";
import { ToolUseList } from "@/components/chat/ToolUseCard";
import { TalkModeButton } from "@/components/chat/TalkModeButton";
import { StyledSelect } from "@/components/ui/styled-select";
import type { ChatMessage } from "@/types/api";
import type { ToolUseBlock } from "@/types/streaming";
import type { TalkPhase } from "@/hooks/useTalkMode";

const formatTokenCount = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

interface SessionOption {
  key: string;
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  contextTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  responseUsage?: "on" | "off" | "tokens" | "full";
  taskQueue?: {
    total?: number;
    runnable?: number;
  };
}

interface AgentOption {
  id: string;
  name?: string;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  reasoning?: boolean;
  contextWindow?: number;
}

interface MemoryUsageConfig {
  contextWindowSize?: number;
  autoSummarize?: boolean;
  summarizationThreshold?: number;
}

interface CompactionStatusInfo {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
}

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, opts?: { deliver?: boolean; attachments?: Array<{ type?: string; mimeType: string; fileName: string; content: string }> }) => void;
  onAbortRun?: () => void;
  isLoading?: boolean;
  runStatus?: "idle" | "streaming" | "aborted" | "error";
  currentToolUses?: ToolUseBlock[];
  toolEvents?: Array<Record<string, unknown>>;
  isConnected?: boolean;
  error?: string | null;
  onNavigateToSettings?: () => void;
  sessionKey: string;
  sessions?: SessionOption[];
  onSelectSession?: (key: string) => void;
  onNewSession?: () => void;
  onResetSession?: () => void;
  onDeleteSession?: () => void;
  agentId: string;
  agents?: AgentOption[];
  onSelectAgent?: (agentId: string) => void;
  modelId?: string | null;
  models?: ModelOption[];
  memoryConfig?: MemoryUsageConfig | null;
  compactionStatus?: CompactionStatusInfo | null;
  onSelectModel?: (modelId: string | null) => void;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  onSelectThinkingLevel?: (level: string) => void;
  onSelectVerboseLevel?: (level: string) => void;
  onSelectReasoningLevel?: (level: string) => void;
  deliverEnabled?: boolean;
  onToggleDeliver?: (next: boolean) => void;
  talkPhase?: TalkPhase;
  talkError?: string | null;
  onTalkToggle?: () => void;
  onTalkCancel?: () => void;
  onReplyReceived?: (text: string) => void;
  onRetryMessage?: (messageIndex: number) => void;
  onEditMessage?: (content: string) => void;
  onDeleteMessage?: (messageIndex: number) => void;
  onSlashCommand?: (command: string, args: string) => void;
  onExecuteTasks?: () => void;
  draft?: ChatDraft;
  onDraftChange?: (draft: ChatDraft) => void;
}

export function ChatView({
  messages,
  onSendMessage,
  onAbortRun,
  isLoading = false,
  runStatus = "idle",
  currentToolUses = [],
  toolEvents = [],
  isConnected = true,
  error = null,
  onNavigateToSettings,
  sessionKey,
  sessions = [],
  onSelectSession,
  onNewSession,
  onResetSession,
  onDeleteSession,
  agentId,
  agents = [],
  onSelectAgent,
  modelId = null,
  models = [],
  memoryConfig = null,
  compactionStatus = null,
  onSelectModel,
  thinkingLevel = "off",
  verboseLevel = "off",
  reasoningLevel = "off",
  onSelectThinkingLevel,
  onSelectVerboseLevel,
  onSelectReasoningLevel,
  deliverEnabled = false,
  onToggleDeliver,
  talkPhase = 'idle',
  talkError = null,
  onTalkToggle,
  onTalkCancel,
  onReplyReceived,
  onRetryMessage,
  onEditMessage,
  onDeleteMessage,
  onSlashCommand,
  onExecuteTasks,
  draft,
  onDraftChange,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(() => {
    try {
      return localStorage.getItem("edwinpai:focusMode") === "true";
    } catch {
      return false;
    }
  });

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("edwinpai:focusMode", String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Keyboard shortcuts: Ctrl+K search, Ctrl+Shift+F focus, ? shortcuts help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFocusMode();
        return;
      }
      // "?" to open shortcuts help — only when not typing in an input/textarea
      if (
        e.key === "?" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement)?.isContentEditable) {
          e.preventDefault();
          setShortcutsOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFocusMode]);

  // Compute group positions for consecutive same-role messages
  const getGroupPosition = (index: number): GroupPosition => {
    const msg = messages[index];
    if (!msg) return "solo";
    const prev = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;
    const sameAsPrev = prev?.role === msg.role;
    const sameAsNext = next?.role === msg.role;
    if (sameAsPrev && sameAsNext) return "middle";
    if (sameAsPrev) return "last";
    if (sameAsNext) return "first";
    return "solo";
  };

  const handleScrollToMessage = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-message-index="${index}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  // Trigger TTS playback when a final assistant reply arrives during talk mode
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (!onReplyReceived || talkPhase !== 'processing') {
      prevMessageCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && typeof lastMsg.content === 'string') {
        onReplyReceived(lastMsg.content);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, talkPhase, onReplyReceived]);

  // Auto-scroll to bottom when new messages arrive.
  // We intentionally avoid virtualization here because streaming, dynamic-height
  // markdown/code blocks caused visible flicker during chat updates.
  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [messages.length]);

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const isApiKeyError = error && (
    error.includes("No API key") ||
    error.includes("api key") ||
    error.includes("auth") ||
    error.includes("provider")
  );
  const [showToolEvents, setShowToolEvents] = useState(false);

  const sessionOptions: SessionOption[] = (() => {
    const existing = new Map(sessions.map((s) => [s.key, s]));
    if (!existing.has(sessionKey)) {
      existing.set(sessionKey, { key: sessionKey });
    }
    return Array.from(existing.values());
  })();

  const currentSession = sessionOptions.find((session) => session.key === sessionKey);
  const runnableTaskCount = currentSession?.taskQueue?.runnable ?? 0;

  const agentOptions: AgentOption[] = (() => {
    const existing = new Map(agents.map((agent) => [agent.id, agent]));
    if (!existing.has(agentId)) {
      existing.set(agentId, { id: agentId });
    }
    return Array.from(existing.values());
  })();

  const formatSessionLabel = (session: SessionOption) => {
    return (
      session.displayName ||
      session.label ||
      session.derivedTitle ||
      session.key
    );
  };

  const selectedModel = modelId
    ? models.find((model) => model.id === modelId)
    : null;
  const supportsThinking = selectedModel?.reasoning ?? true;
  const supportsReasoningVisibility = selectedModel?.reasoning ?? true;

  const tokensUsed = currentSession?.totalTokens
    ?? (currentSession?.inputTokens != null || currentSession?.outputTokens != null
      ? (currentSession?.inputTokens ?? 0) + (currentSession?.outputTokens ?? 0)
      : null);
  const contextWindow = currentSession?.contextTokens ?? selectedModel?.contextWindow ?? memoryConfig?.contextWindowSize ?? null;
  const compactionThresholdFraction = memoryConfig?.autoSummarize === false
    ? null
    : Math.max(0, Math.min(1, memoryConfig?.summarizationThreshold ?? 0.8));
  const compactionThresholdTokens = contextWindow != null && compactionThresholdFraction != null
    ? Math.round(contextWindow * compactionThresholdFraction)
    : null;
  const usagePercent = tokensUsed != null && contextWindow
    ? clampPercent((tokensUsed / contextWindow) * 100)
    : null;
  const headroomToCompaction = tokensUsed != null && compactionThresholdTokens != null
    ? compactionThresholdTokens - tokensUsed
    : null;
  const headroomToWindow = tokensUsed != null && contextWindow != null
    ? contextWindow - tokensUsed
    : null;
  const showCompactedRecently = !compactionStatus?.active && compactionStatus?.completedAt != null;
  const tokenSummary = tokensUsed == null
    ? "tokens —"
    : contextWindow != null && usagePercent != null
      ? `tokens ${formatTokenCount(tokensUsed)}/${formatTokenCount(contextWindow)} (${Math.round(usagePercent)}%)`
      : `tokens ${formatTokenCount(tokensUsed)}`;
  const tokenSummaryTitle = [
    contextWindow != null ? `Context window: ${formatTokenCount(contextWindow)} tokens` : null,
    compactionThresholdTokens != null ? `Next compaction around ${formatTokenCount(compactionThresholdTokens)} tokens` : null,
    headroomToCompaction != null ? `${headroomToCompaction >= 0 ? formatTokenCount(headroomToCompaction) + ' left until compaction' : formatTokenCount(Math.abs(headroomToCompaction)) + ' over compaction threshold'}` : null,
    headroomToWindow != null ? `${headroomToWindow >= 0 ? formatTokenCount(headroomToWindow) + ' left in window' : formatTokenCount(Math.abs(headroomToWindow)) + ' over context window'}` : null,
    currentSession?.responseUsage ? `Usage reporting: ${currentSession.responseUsage}` : null,
    currentSession?.inputTokens != null || currentSession?.outputTokens != null
      ? `Session I/O: ${formatTokenCount(currentSession?.inputTokens ?? 0)} in / ${formatTokenCount(currentSession?.outputTokens ?? 0)} out`
      : null,
  ].filter(Boolean).join('\n');

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Floating exit-focus button (visible only in focus mode) */}
      {focusMode && (
        <button
          onClick={toggleFocusMode}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
          title="Exit focus mode (Ctrl+Shift+F)"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      )}

      {/* Session header */}
      {!focusMode && (
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Session</label>
          <StyledSelect
            value={sessionKey}
            onChange={(e) => onSelectSession?.(e.target.value)}
          >
            {sessionOptions.map((session) => (
              <option key={session.key} value={session.key}>
                {formatSessionLabel(session)}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 text-xs rounded-md border border-input hover:bg-muted"
            onClick={() => onNewSession?.()}
          >
            New
          </button>
          <button
            className="px-2 py-1 text-xs rounded-md border border-input hover:bg-muted"
            onClick={() => onResetSession?.()}
          >
            Reset
          </button>
          <button
            className="px-2 py-1 text-xs rounded-md border border-input hover:bg-muted"
            onClick={() => onDeleteSession?.()}
          >
            Delete
          </button>
          <button
            className="p-1 rounded-md border border-input hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={toggleFocusMode}
            title="Focus mode (Ctrl+Shift+F)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      )}

      {/* Agent + model header */}
      {!focusMode && (
      <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Agent</label>
          <StyledSelect
            value={agentId}
            onChange={(e) => onSelectAgent?.(e.target.value)}
          >
            {agentOptions.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name ? `${agent.name} (${agent.id})` : agent.id}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Model</label>
          <StyledSelect
            value={modelId ?? ""}
            onChange={(e) => onSelectModel?.(e.target.value || null)}
          >
            <option value="">Default</option>
            {models.map((model, i) => (
              <option key={`${model.provider}:${model.id}:${i}`} value={model.id}>
                {model.name} ({model.provider})
              </option>
            ))}
          </StyledSelect>
        </div>
        {supportsThinking && (
          <div className="flex items-center gap-2">
            <label
              className="text-xs text-muted-foreground"
              title="Controls model thinking budget (more thinking can improve complex answers at higher latency/cost)."
            >
              Think
            </label>
            <StyledSelect
              value={thinkingLevel}
              onChange={(e) => onSelectThinkingLevel?.(e.target.value)}
            >
              {['off', 'low', 'medium', 'high'].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </StyledSelect>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label
            className="text-xs text-muted-foreground"
            title="Shows extra tool/debug detail in chat output."
          >
            Verbose
          </label>
          <StyledSelect
            value={verboseLevel}
            onChange={(e) => onSelectVerboseLevel?.(e.target.value)}
          >
            {['off', 'on', 'full'].map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </StyledSelect>
        </div>
        {supportsReasoningVisibility && (
          <div className="flex items-center gap-2">
            <label
              className="text-xs text-muted-foreground"
              title="Shows model reasoning as a separate message when available."
            >
              Reasoning
            </label>
            <StyledSelect
              value={reasoningLevel === 'stream' ? 'on' : reasoningLevel}
              onChange={(e) => onSelectReasoningLevel?.(e.target.value)}
            >
              {['off', 'on'].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </StyledSelect>
          </div>
        )}
      </div>
      )}

      {/* Connection/Error banner */}
      {!isConnected && (
        <div className="mx-4 mt-4 p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 flex items-center gap-3">
          <WifiOff className="h-5 w-5 text-yellow-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-500">Not connected to gateway</p>
            <p className="text-xs text-muted-foreground">Check your gateway URL and token in Settings</p>
          </div>
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Open Settings
            </button>
          )}
        </div>
      )}

      {error && isConnected && (
        <div className="mx-4 mt-4 p-3 rounded-lg border border-destructive/50 bg-destructive/10 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              {isApiKeyError ? "No API key configured" : "Chat error"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isApiKeyError
                ? "Add an AI provider API key in Settings to start chatting."
                : error}
            </p>
          </div>
          {isApiKeyError && onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Add API Key
            </button>
          )}
        </div>
      )}

      {/* Messages area */}
      <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          style={{ contain: "strict" }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center space-y-4 max-w-md">
                <div className="flex items-center justify-center">
                  <Zap className="h-12 w-12 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">EdwinPAI</h2>
                  <p className="text-sm text-muted-foreground">
                    Your personal AI assistant. Ask me anything — I can search the web, recall from memory, and help you get things done.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {['What can you do?', 'Search the web for...', 'Remember this...'].map((hint) => (
                    <button
                      key={hint}
                      onClick={() => {
                        const textarea = document.querySelector('textarea');
                        if (textarea) {
                          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLTextAreaElement.prototype, 'value'
                          )?.set;
                          nativeInputValueSetter?.call(textarea, hint);
                          textarea.dispatchEvent(new Event('input', { bubbles: true }));
                          textarea.focus();
                        }
                      }}
                      className="px-3 py-1.5 text-xs rounded-full border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col py-2">
              {messages.map((message, index) => (
                <div key={`message-${index}`} data-message-index={index}>
                  <MessageBubble
                    message={message}
                    timestamp={formatTimestamp(new Date())}
                    isStreaming={isLoading && index === messages.length - 1}
                    onRetry={onRetryMessage ? () => onRetryMessage(index) : undefined}
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage ? () => onDeleteMessage(index) : undefined}
                    groupPosition={getGroupPosition(index)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thinking indicator */}
        <div
          className="flex items-center gap-2 px-6 py-3 text-sm text-muted-foreground transition-opacity duration-150"
          style={{ opacity: isLoading ? 1 : 0, height: isLoading ? 'auto' : 0, overflow: 'hidden', padding: isLoading ? undefined : 0 }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {currentToolUses.length > 0
              ? `Working (${currentToolUses.length} tool${currentToolUses.length > 1 ? "s" : ""})…`
              : "Thinking…"}
          </span>
        </div>

        {/* Input area */}
        <div className="border-t bg-background">
          <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Status: {isLoading ? "Running" : runStatus === "error" ? "Error" : "Idle"}
              </span>
              <span className="font-mono" title={tokenSummaryTitle || undefined}>
                {tokenSummary}
              </span>
              {compactionStatus?.active && (
                <span className="text-emerald-600 dark:text-emerald-400">compacting…</span>
              )}
              {!compactionStatus?.active && showCompactedRecently && (
                <span className="text-primary">compacted</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {runnableTaskCount > 0 && onExecuteTasks && (
                <button
                  className="text-xs px-2 py-1 rounded-md border border-input hover:bg-muted"
                  onClick={onExecuteTasks}
                  disabled={isLoading}
                >
                  Execute Tasks ({runnableTaskCount})
                </button>
              )}
              <button
                className="text-xs underline"
                onClick={() => onToggleDeliver?.(!deliverEnabled)}
              >
                Deliver: {deliverEnabled ? "On" : "Off"}
              </button>
              <button
                className="text-xs underline"
                onClick={() => setShowToolEvents((prev: boolean) => !prev)}
              >
                {showToolEvents ? "Hide tool events" : "Show tool events"}
              </button>
            </div>
          </div>
          {showToolEvents && (
            <div className="px-4 py-2 text-xs font-mono whitespace-pre-wrap border-t bg-muted/40 max-h-48 overflow-auto">
              {toolEvents.length === 0 ? "No tool events yet." : JSON.stringify(toolEvents, null, 2)}
            </div>
          )}
          <div
            className="border-t transition-all duration-150"
            style={{
              opacity: isLoading && currentToolUses.length > 0 ? 1 : 0,
              maxHeight: isLoading && currentToolUses.length > 0 ? '500px' : '0px',
              overflow: 'hidden',
              padding: isLoading && currentToolUses.length > 0 ? undefined : 0,
            }}
          >
            <div className="px-4 py-3">
              <div className="text-xs text-muted-foreground mb-2">Live tool calls</div>
              <ToolUseList toolUses={currentToolUses} />
            </div>
          </div>
          <div className="flex items-end gap-2 px-4 pb-4">
            <div className="flex-1">
              <InputBar
                sessionKey={sessionKey}
                draft={draft}
                onDraftChange={onDraftChange}
                onSendMessage={(message, opts) =>
                  onSendMessage(message, { deliver: deliverEnabled, attachments: opts?.attachments })
                }
                onAbortRun={onAbortRun}
                onSlashCommand={onSlashCommand}
                isStreaming={isLoading}
                disabled={false}
                placeholder={
                  talkPhase === 'listening' ? "Listening... click mic to send"
                    : talkPhase === 'processing' ? "Processing voice..."
                    : isLoading ? "Type to queue message... (Esc to stop)"
                    : "Type a message... (Shift+Enter for new line)"
                }
              />
            </div>
            {onTalkToggle && onTalkCancel && (
              <div className="pb-4">
                <TalkModeButton
                  phase={talkPhase}
                  error={talkError}
                  onToggle={onTalkToggle}
                  onCancel={onTalkCancel}
                />
              </div>
            )}
          </div>
        </div>
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        messages={messages}
        onScrollToMessage={handleScrollToMessage}
      />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  );
}
