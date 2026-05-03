/**
 * useChat - React hook for chat with SSE streaming
 *
 * Handles chat message state management and SSE streaming to
 * /v1/chat/completions endpoint. Manages connection lifecycle,
 * message accumulation, and error recovery.
 */

import { useState, useCallback, useRef, useEffect } from "react";

import { useGatewayConfig } from "./useConfig";

import type {
  ChatMessageType as ChatMessage,
  StreamingState,
  ChatCompletionRequestType as ChatCompletionRequest,
  ContentBlockDeltaEvent,
  MessageStopEvent,
  ErrorEvent,
  SSEStreamEvent,
} from "@/types";

// ============================================================================
// Hook State
// ============================================================================

interface UseChatOptions {
  /** Gateway base URL (defaults to http://localhost:{port}) */
  baseUrl?: string;

  /** Model to use for completions */
  model?: string;

  /** Temperature (0.0-1.0) */
  temperature?: number;

  /** Max tokens */
  maxTokens?: number;

  /** Enable streaming (default: true) */
  stream?: boolean;

  /** Callback when stream chunk received */
  onStreamChunk?: (chunk: string, accumulated: string) => void;

  /** Callback when stream completes */
  onStreamEnd?: (fullText: string) => void;

  /** Callback when stream errors */
  onStreamError?: (error: string) => void;
}

interface UseChatReturn {
  /** All messages in the conversation */
  messages: ChatMessage[];

  /** Current streaming state */
  streamingState: StreamingState;

  /** Accumulated text for current assistant message */
  currentResponse: string;

  /** Error message if request failed */
  error: string | null;

  /** Whether a request is in progress */
  loading: boolean;

  /** Send a message */
  sendMessage: (content: string, role?: "user" | "system") => Promise<void>;

  /** Cancel current streaming request */
  cancelStream: () => void;

  /** Clear all messages */
  clearMessages: () => void;

  /** Retry last failed message */
  retry: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for chat with SSE streaming
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   sendMessage,
 *   streamingState,
 *   currentResponse,
 * } = useChat({
 *   model: 'claude-sonnet-4-5',
 *   onStreamChunk: (chunk) => console.log('Chunk:', chunk),
 * });
 *
 * return (
 *   <div>
 *     {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *     {streamingState === 'streaming' && <p>{currentResponse}</p>}
 *     <input onSubmit={(e) => sendMessage(e.target.value)} />
 *   </div>
 * );
 * ```
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { gatewayPort } = useGatewayConfig();
  const baseUrl = options.baseUrl ?? `http://localhost:${gatewayPort}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState>("idle");
  const [currentResponse, setCurrentResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Track current request for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Parse SSE event from raw text
   */
  const parseSSEEvent = (eventText: string): SSEStreamEvent | null => {
    try {
      // SSE format: "data: {json}\n\n"
      const lines = eventText.trim().split("\n");
      const dataLine = lines.find((line) => line.startsWith("data: "));

      if (!dataLine) return null;

      const jsonStr = dataLine.slice(6); // Remove "data: " prefix

      // Handle [DONE] signal
      if (jsonStr === "[DONE]") {
        return { type: "message_stop" } as MessageStopEvent;
      }

      const parsed = JSON.parse(jsonStr) as SSEStreamEvent;
      return parsed;
    } catch (err) {
      console.error("Failed to parse SSE event:", err);
      return null;
    }
  };

  /**
   * Process SSE stream events
   */
  const handleStreamEvent = useCallback(
    (event: SSEStreamEvent) => {
      switch (event.type) {
        case "message_start":
          setStreamingState("streaming");
          setCurrentResponse("");
          break;

        case "content_block_delta": {
          const deltaEvent = event as ContentBlockDeltaEvent;
          if (deltaEvent.delta.type === "text_delta") {
            const chunk = deltaEvent.delta.text;
            setCurrentResponse((prev) => {
              const accumulated = prev + chunk;
              options.onStreamChunk?.(chunk, accumulated);
              return accumulated;
            });
          }
          break;
        }

        case "message_stop": {
          setStreamingState("completed");
          setLoading(false);

          // Add assistant message to history
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: currentResponse,
            timestamp: new Date().toISOString(),
            model: options.model,
            finishReason: "stop",
          };

          setMessages((prev) => [...prev, assistantMessage]);
          options.onStreamEnd?.(currentResponse);
          setCurrentResponse("");
          break;
        }

        case "error": {
          const errorEvent = event as ErrorEvent;
          const errorMessage = errorEvent.error.message;
          setStreamingState("error");
          setError(errorMessage);
          setLoading(false);
          options.onStreamError?.(errorMessage);
          break;
        }

        default:
          // Ignore other event types (content_block_start, content_block_stop, message_delta)
          break;
      }
    },
    [currentResponse, options],
  );

  /**
   * Send a chat message
   */
  const sendMessage = useCallback(
    async (content: string, role: "user" | "system" = "user") => {
      if (!content.trim()) return;

      try {
        setError(null);
        setLoading(true);
        setStreamingState("connecting");

        // Add user message to history
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role,
          content: content.trim(),
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        lastUserMessageRef.current = content.trim();

        // Build request payload
        const requestPayload: ChatCompletionRequest = {
          messages: [...messages, userMessage],
          model: options.model ?? "claude-sonnet-4-5",
          stream: options.stream ?? true,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        };

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        // Make streaming request
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        // Process SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setStreamingState("completed");
            setLoading(false);
            break;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Split by double newline (SSE event boundary)
          const events = buffer.split("\n\n");

          // Keep incomplete event in buffer
          buffer = events.pop() ?? "";

          // Process complete events
          for (const eventText of events) {
            if (!eventText.trim()) continue;

            const event = parseSSEEvent(eventText);
            if (event) {
              handleStreamEvent(event);
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setStreamingState("cancelled");
          setError("Request cancelled");
        } else {
          const message =
            err instanceof Error ? err.message : "Failed to send message";
          setStreamingState("error");
          setError(message);
          console.error("Chat request failed:", err);
        }
        setLoading(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [baseUrl, messages, options, handleStreamEvent],
  );

  /**
   * Cancel current streaming request
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStreamingState("cancelled");
      setLoading(false);
    }
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentResponse("");
    setError(null);
    setStreamingState("idle");
  }, []);

  /**
   * Retry last failed message
   */
  const retry = useCallback(async () => {
    if (lastUserMessageRef.current) {
      await sendMessage(lastUserMessageRef.current);
    }
  }, [sendMessage]);

  return {
    messages,
    streamingState,
    currentResponse,
    error,
    loading,
    sendMessage,
    cancelStream,
    clearMessages,
    retry,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to manage multiple conversations
 */
export function useConversations() {
  const [conversations, setConversations] = useState<
    Map<string, ChatMessage[]>
  >(new Map());
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const createConversation = useCallback(() => {
    const id = crypto.randomUUID();
    setConversations((prev) => new Map(prev).set(id, []));
    setActiveConversationId(id);
    return id;
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    },
    [activeConversationId],
  );

  const getConversation = useCallback(
    (id: string) => {
      return conversations.get(id) ?? [];
    },
    [conversations],
  );

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    getConversation,
  };
}
