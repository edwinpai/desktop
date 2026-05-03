/**
 * Chat - Main chat container with SSE connection
 *
 * Manages:
 * - SSE streaming connection to gateway
 * - Message history
 * - Conversation state
 * - Real-time token display
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  ChatMessage,
  StreamChunkEventPayload,
  StreamEndEventPayload,
  StreamErrorEventPayload,
  SendChatMessageRequest,
  SendChatMessageResponse,
  GetConversationHistoryRequest,
  GetConversationHistoryResponse,
} from "@/types/chat";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatProps {
  conversationId: string;
}

export function Chat({ conversationId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const [streamingText, setStreamingText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversation history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const request: GetConversationHistoryRequest = {
          conversationId,
          limit: 100,
        };

        const response = await invoke<GetConversationHistoryResponse>(
          "get_conversation_history",
          { request },
        );

        setMessages(response.messages);
      } catch (err) {
        console.error("Failed to load conversation history:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [conversationId]);

  // Setup SSE event listeners
  useEffect(() => {
    const setupListeners = async () => {
      try {
        // Listen for stream chunks
        const unlistenChunk = await listen<StreamChunkEventPayload>(
          "chat:stream_chunk",
          (event) => {
            const { messageId, accumulated } = event.payload;

            if (messageId === streamingMessageId) {
              setStreamingText(accumulated);
              scrollToBottom();
            }
          },
        );

        // Listen for stream end
        const unlistenEnd = await listen<StreamEndEventPayload>(
          "chat:stream_end",
          (event) => {
            const { messageId, fullText, finishReason } = event.payload;

            if (messageId === streamingMessageId) {
              // Add completed message to history
              const completedMessage: ChatMessage = {
                id: messageId,
                role: "assistant",
                content: fullText,
                timestamp: new Date().toISOString(),
                finishReason,
              };

              setMessages((prev) => [...prev, completedMessage]);
              setStreamingMessageId(null);
              setStreamingText("");
              setIsSending(false);
            }
          },
        );

        // Listen for stream errors
        const unlistenError = await listen<StreamErrorEventPayload>(
          "chat:stream_error",
          (event) => {
            const { messageId, error: errorMsg } = event.payload;

            if (messageId === streamingMessageId) {
              setError(errorMsg);
              setStreamingMessageId(null);
              setStreamingText("");
              setIsSending(false);
            }
          },
        );

        unlistenersRef.current = [unlistenChunk, unlistenEnd, unlistenError];
      } catch (err) {
        console.error("Failed to setup SSE listeners:", err);
        setError("Failed to setup real-time connection");
      }
    };

    setupListeners();

    // Cleanup listeners on unmount
    return () => {
      unlistenersRef.current.forEach((unlisten) => unlisten());
      unlistenersRef.current = [];
    };
  }, [streamingMessageId, scrollToBottom]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // Send message handler
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      try {
        setIsSending(true);
        setError(null);

        // Create user message
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: content.trim(),
          timestamp: new Date().toISOString(),
        };

        // Add user message to UI immediately
        setMessages((prev) => [...prev, userMessage]);

        // Send to backend
        const request: SendChatMessageRequest = {
          conversationId,
          message: userMessage,
          stream: true,
        };

        const response = await invoke<SendChatMessageResponse>(
          "send_chat_message",
          { request },
        );

        if (!response.success) {
          throw new Error(response.error || "Failed to send message");
        }

        // Track streaming message
        setStreamingMessageId(response.messageId);
        setStreamingText("");
      } catch (err) {
        console.error("Failed to send message:", err);
        setError(err instanceof Error ? err.message : "Failed to send message");
        setIsSending(false);
      }
    },
    [conversationId, isSending],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading conversation...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessageComponent
            key={message.id}
            message={message}
            isStreaming={false}
          />
        ))}

        {/* Streaming message */}
        {streamingMessageId && streamingText && (
          <ChatMessageComponent
            message={{
              id: streamingMessageId,
              role: "assistant",
              content: streamingText,
              timestamp: new Date().toISOString(),
            }}
            isStreaming={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-4">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isSending}
          placeholder={isSending ? "Sending..." : "Type a message..."}
        />
      </div>
    </div>
  );
}
