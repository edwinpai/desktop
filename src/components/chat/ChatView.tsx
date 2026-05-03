/**
 * ChatView - Main conversation interface
 *
 * Displays chat messages with streaming support, tool use cards,
 * and auto-scroll behavior. Uses useGatewayChat for state management.
 */

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useGatewayChat } from "@/hooks/useGatewayChat";
import { ToolUseCard } from "./ToolUseCard";

import type { StreamingChatMessage } from "@/types/streaming";

// ============================================================================
// Component Props
// ============================================================================

interface ChatViewProps {
  /** Auth token for gateway connection */
  authToken?: string;

  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * Main conversation interface with streaming support
 *
 * @example
 * ```tsx
 * <ChatView authToken="session-abc123" />
 * ```
 */
export function ChatView({ authToken, className = "" }: ChatViewProps) {
  const {
    messages,
    isStreaming,
    currentResponse,
    currentToolUses,
    error,
    sendMessage,
    clearMessages,
  } = useGatewayChat({ authToken });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentResponse]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Chat
        </h2>

        <button
          type="button"
          onClick={clearMessages}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Messages container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50 dark:bg-gray-950"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400 text-center">
              No messages yet. Start a conversation!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="space-y-2">
                {/* Current response */}
                {currentResponse && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentResponse}
                        </ReactMarkdown>
                      </div>

                      {/* Typing indicator */}
                      <div className="flex gap-1 mt-2">
                        <span
                          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Current tool uses */}
                {currentToolUses.length > 0 && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] space-y-2">
                      {currentToolUses.map((toolUse) => (
                        <ToolUseCard key={toolUse.id} toolUse={toolUse} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Error display */}
        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <ChatInput
          onSubmit={sendMessage}
          disabled={isStreaming}
          placeholder={
            isStreaming ? "Waiting for response..." : "Type a message..."
          }
        />
      </div>
    </div>
  );
}

// ============================================================================
// Message Bubble Component
// ============================================================================

interface MessageBubbleProps {
  message: StreamingChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-lg ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        }`}
      >
        {/* Message content */}
        <div
          className={`prose prose-sm max-w-none ${
            isUser ? "prose-invert" : "dark:prose-invert"
          }`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Tool use cards (for assistant messages) */}
        {!isUser && message.tool_use && message.tool_use.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.tool_use.map((toolUse) => (
              <ToolUseCard key={toolUse.id} toolUse={toolUse} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        {message.timestamp && (
          <div className="mt-1 text-xs opacity-70">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Chat Input Component
// ============================================================================

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function ChatInput({
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Send
      </button>
    </form>
  );
}
