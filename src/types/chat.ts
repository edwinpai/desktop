/**
 * Chat & SSE Streaming Type Definitions
 *
 * Defines type contracts for:
 * - Chat messages and conversation history
 * - SSE (Server-Sent Events) streaming
 * - Streaming state management
 * - Chat API requests/responses
 *
 * All implementation nodes MUST import from this contract.
 */

// ============================================================================
// Chat Messages
// ============================================================================

/**
 * Message role
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Message content part (for multimodal messages)
 */
export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image"; imageUrl: string };

/**
 * Message content (string for simple, array for multimodal)
 */
export type MessageContent = string | MessageContentPart[];

/**
 * Chat message
 */
export interface ChatMessage {
  id: string; // UUID
  role: MessageRole;
  content: MessageContent;
  timestamp: string; // ISO 8601
  model?: string; // Model used for assistant messages
  finishReason?: "stop" | "length" | "content_filter" | null;
}

/**
 * Conversation metadata
 */
export interface Conversation {
  id: string; // UUID
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  messageCount: number;
  model: string;
}

// ============================================================================
// Chat API (Gateway REST)
// ============================================================================

/**
 * Chat completion request (to gateway /api/chat/completions)
 */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string; // Default: "claude-sonnet-4-5"
  stream?: boolean; // Default: true
  temperature?: number; // 0.0-1.0
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Chat completion response (non-streaming)
 */
export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number; // Unix timestamp
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finishReason: "stop" | "length" | "content_filter";
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// SSE Streaming
// ============================================================================

/**
 * SSE event types (per OpenAI streaming spec)
 */
export type SSEEventType =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "message_delta"
  | "message_stop"
  | "error";

/**
 * SSE event base structure
 */
export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
}

/**
 * Message start event (beginning of stream)
 */
export interface MessageStartEvent {
  type: "message_start";
  message: {
    id: string;
    role: "assistant";
    content: [];
    model: string;
  };
}

/**
 * Content block start event
 */
export interface ContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  contentBlock: {
    type: "text";
    text: string;
  };
}

/**
 * Content block delta event (streaming text chunk)
 */
export interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "text_delta";
    text: string;
  };
}

/**
 * Content block stop event
 */
export interface ContentBlockStopEvent {
  type: "content_block_stop";
  index: number;
}

/**
 * Message delta event (metadata updates)
 */
export interface MessageDeltaEvent {
  type: "message_delta";
  delta: {
    stopReason?: "end_turn" | "max_tokens" | "stop_sequence";
  };
  usage?: {
    outputTokens: number;
  };
}

/**
 * Message stop event (end of stream)
 */
export interface MessageStopEvent {
  type: "message_stop";
}

/**
 * Error event
 */
export interface ErrorEvent {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}

/**
 * Union of all SSE event types
 */
export type SSEStreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | ErrorEvent;

// ============================================================================
// Streaming State
// ============================================================================

/**
 * Streaming connection states
 */
export type StreamingState =
  | "idle" // Not streaming
  | "connecting" // Opening SSE connection
  | "streaming" // Receiving chunks
  | "completed" // Stream finished successfully
  | "error" // Stream failed
  | "cancelled"; // User cancelled

/**
 * Streaming session metadata
 */
export interface StreamingSession {
  id: string; // Message ID
  state: StreamingState;
  startedAt: string | null; // ISO 8601
  completedAt: string | null; // ISO 8601
  bytesReceived: number;
  chunksReceived: number;
  error: string | null;
}

/**
 * Streaming progress (for UI)
 */
export interface StreamingProgress {
  messageId: string;
  accumulatedText: string;
  state: StreamingState;
  error?: string;
}

// ============================================================================
// IPC Commands (Frontend → Rust)
// ============================================================================

/**
 * Send chat message request (IPC command)
 */
export interface SendChatMessageRequest {
  conversationId: string;
  message: ChatMessage;
  model?: string;
  stream?: boolean;
}

/**
 * Send chat message response
 */
export interface SendChatMessageResponse {
  success: boolean;
  messageId: string;
  error?: string;
}

/**
 * Cancel streaming request
 */
export interface CancelStreamRequest {
  messageId: string;
}

/**
 * Cancel streaming response
 */
export interface CancelStreamResponse {
  success: boolean;
  cancelled: boolean;
}

/**
 * Get conversation history request
 */
export interface GetConversationHistoryRequest {
  conversationId: string;
  limit?: number;
  before?: string; // Message ID for pagination
}

/**
 * Get conversation history response
 */
export interface GetConversationHistoryResponse {
  messages: ChatMessage[];
  hasMore: boolean;
}

/**
 * List conversations request
 */
export interface ListConversationsRequest {
  limit?: number;
  offset?: number;
}

/**
 * List conversations response
 */
export interface ListConversationsResponse {
  conversations: Conversation[];
  total: number;
}

/**
 * Create conversation request
 */
export interface CreateConversationRequest {
  title?: string;
  model?: string;
}

/**
 * Create conversation response
 */
export interface CreateConversationResponse {
  conversation: Conversation;
}

/**
 * Delete conversation request
 */
export interface DeleteConversationRequest {
  conversationId: string;
}

/**
 * Delete conversation response
 */
export interface DeleteConversationResponse {
  success: boolean;
}

// ============================================================================
// IPC Events (Rust → Frontend)
// ============================================================================

/**
 * Chat event types (for IPC event listeners)
 */
export type ChatEvent =
  | "chat:stream_start"
  | "chat:stream_chunk"
  | "chat:stream_end"
  | "chat:stream_error"
  | "chat:message_created"
  | "chat:conversation_updated";

/**
 * Stream chunk event payload
 */
export interface StreamChunkEventPayload {
  messageId: string;
  chunk: string;
  accumulated: string;
}

/**
 * Stream end event payload
 */
export interface StreamEndEventPayload {
  messageId: string;
  fullText: string;
  finishReason: "stop" | "length" | "content_filter";
}

/**
 * Stream error event payload
 */
export interface StreamErrorEventPayload {
  messageId: string;
  error: string;
}

// All types are already exported inline above via interface/type declarations
