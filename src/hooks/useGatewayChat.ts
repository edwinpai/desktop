/**
 * useGatewayChat - React hook for gateway chat with streaming
 *
 * Manages chat message state with SSE streaming to gateway API.
 * Handles connection errors (401, connection refused, timeout).
 */

import { useState, useCallback, useRef, useEffect } from 'react';

import { GatewayClient } from '@/lib/GatewayClient';
import { useGatewayConfig } from './useConfig';

import type {
  ChatMessage,
  ChatCompletionRequest,
} from '@/types/api';

import type {
  StreamingChatMessage,
  ToolUseBlock,
} from '@/types/streaming';

// ============================================================================
// Hook Types
// ============================================================================

interface UseGatewayChatOptions {
  /** Gateway base URL (defaults to http://localhost:{port}) */
  baseURL?: string;

  /** Auth token (BRC-103 session token) */
  authToken?: string;

  /** Model to use for completions */
  model?: string;

  /** Temperature (0.0-1.0) */
  temperature?: number;

  /** Max tokens */
  maxTokens?: number;

  /** Callback when stream chunk received */
  onStreamChunk?: (chunk: string, accumulated: string) => void;

  /** Callback when stream completes */
  onStreamEnd?: (fullText: string) => void;

  /** Callback when stream errors */
  onStreamError?: (error: string) => void;
}

interface UseGatewayChatReturn {
  /** All messages in the conversation */
  messages: StreamingChatMessage[];

  /** Whether currently streaming */
  isStreaming: boolean;

  /** Accumulated text for current assistant message */
  currentResponse: string;

  /** Tool use blocks for current message */
  currentToolUses: ToolUseBlock[];

  /** Error message if request failed */
  error: string | null;

  /** Whether a request is in progress */
  loading: boolean;

  /** Send a message */
  sendMessage: (content: string, role?: 'user' | 'system' | 'assistant') => Promise<void>;

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
 * React hook for gateway chat with SSE streaming
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   sendMessage,
 *   isStreaming,
 *   currentResponse,
 * } = useGatewayChat({
 *   authToken: 'session-token-abc',
 *   model: 'claude-sonnet-4-5',
 * });
 *
 * return (
 *   <div>
 *     {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *     {isStreaming && <p>{currentResponse}</p>}
 *     <input onSubmit={(e) => sendMessage(e.target.value)} />
 *   </div>
 * );
 * ```
 */
export function useGatewayChat(options: UseGatewayChatOptions = {}): UseGatewayChatReturn {
  const { gatewayUrl, gatewayPort } = useGatewayConfig();
  const baseURL = options.baseURL ?? gatewayUrl ?? `http://localhost:${gatewayPort ?? 18789}`;
  const authToken = options.authToken ?? '';

  const [messages, setMessages] = useState<StreamingChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentToolUses, setCurrentToolUses] = useState<ToolUseBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Track client and last message for retry
  const clientRef = useRef<GatewayClient | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize client when config changes
  useEffect(() => {
    clientRef.current = new GatewayClient({
      baseURL,
      authToken,
      timeout: 30000,
    });
  }, [baseURL, authToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Send a chat message with streaming
   */
  const sendMessage = useCallback(
    async (content: string, role: 'user' | 'system' | 'assistant' = 'user') => {
      if (!content.trim()) return;
      if (!clientRef.current) {
        setError('Gateway client not initialized');
        return;
      }

      try {
        setError(null);
        setLoading(true);
        setIsStreaming(true);
        setCurrentResponse('');
        setCurrentToolUses([]);

        // Add user message to history
        const userMessage: StreamingChatMessage = {
          id: crypto.randomUUID(),
          role,
          content: content.trim(),
          timestamp: Date.now(),
          streaming: false,
          tool_use: [],
        };

        setMessages((prev) => [...prev, userMessage]);
        lastUserMessageRef.current = content.trim();

        // Build request payload
        const requestMessages: ChatMessage[] = [
          ...messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            role,
            content: content.trim(),
          },
        ];

        const request: ChatCompletionRequest = {
          messages: requestMessages,
          model: options.model ?? 'claude-sonnet-4-5',
          stream: true,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        };

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        // Stream response
        let accumulated = '';
        const toolUses: ToolUseBlock[] = [];

        for await (const chunk of clientRef.current.sendMessage({
          ...request,
          stream: true,
        })) {
          // Check if cancelled
          if (abortControllerRef.current.signal.aborted) {
            break;
          }

          // Extract delta content
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          // Accumulate text content
          if (delta.content) {
            accumulated += delta.content;
            setCurrentResponse(accumulated);
            options.onStreamChunk?.(delta.content, accumulated);
          }

          // Accumulate tool uses
          if ('tool_use' in delta && Array.isArray(delta.tool_use)) {
            toolUses.push(...delta.tool_use);
            setCurrentToolUses(toolUses);
          }
        }

        // Add assistant message to history
        const assistantMessage: StreamingChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: accumulated,
          timestamp: Date.now(),
          streaming: false,
          tool_use: toolUses,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        options.onStreamEnd?.(accumulated);

        // Reset streaming state
        setCurrentResponse('');
        setCurrentToolUses([]);
        setIsStreaming(false);
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';

        // Handle specific error cases
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          setError('Authentication failed. Please reconnect to gateway.');
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Failed to fetch')) {
          setError('Cannot connect to gateway. Is it running?');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
          setError('Request timed out. Please try again.');
        } else {
          setError(errorMessage);
        }

        options.onStreamError?.(errorMessage);
        console.error('Chat request failed:', err);

        setIsStreaming(false);
        setLoading(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [baseURL, authToken, messages, options]
  );

  /**
   * Cancel current streaming request
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setLoading(false);
      setCurrentResponse('');
      setCurrentToolUses([]);
    }
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentResponse('');
    setCurrentToolUses([]);
    setError(null);
    setIsStreaming(false);
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
    isStreaming,
    currentResponse,
    currentToolUses,
    error,
    loading,
    sendMessage,
    cancelStream,
    clearMessages,
    retry,
  };
}
