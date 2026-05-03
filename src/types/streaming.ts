/**
 * Streaming types for SSE-based chat completions (SPEC §10.2)
 *
 * Supports OpenAI-compatible streaming with tool use extensions.
 * Extends existing types from api.ts and chat.ts.
 */

import type {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionChunk,
} from "./api";

// ============================================================================
// SSE MESSAGE STRUCTURE
// ============================================================================

/**
 * Server-Sent Events (SSE) message format
 *
 * Parsed from SSE stream lines:
 * - `data: <json>` → SSEMessage.data
 * - `event: <type>` → SSEMessage.event
 * - `id: <string>` → SSEMessage.id
 */
export interface SSEMessage {
  /** JSON payload (stringified ChatCompletionChunk) */
  data: string;

  /** Optional event type (e.g., "message_start", "content_block_delta") */
  event?: string;

  /** Optional event ID for replay (Last-Event-ID header) */
  id?: string;
}

// ============================================================================
// CHAT COMPLETION DELTA (extends existing ChatCompletionChunk from api.ts)
// ============================================================================

/**
 * Delta content in streaming chunk
 *
 * Contains incremental updates to message content.
 * Used within ChatCompletionChunkChoice.delta from api.ts.
 */
export interface ChatCompletionDelta {
  /** Role (only present in first chunk) */
  role?: "assistant";

  /** Text content delta (incremental string fragment) */
  content?: string;

  /** Tool use blocks (for function calls) */
  tool_use?: ToolUseBlock[];
}

// ============================================================================
// TOOL USE BLOCKS
// ============================================================================

/**
 * Tool use block (function call)
 *
 * Represents a request to call a tool/function.
 * Follows OpenAI function calling format.
 */
export interface ToolUseBlock {
  /** Unique tool use ID (for correlation with results) */
  id: string;

  /** Tool name (matches ChatCompletionRequest.tools[].function.name) */
  name: string;

  /** Tool input arguments (JSON object) */
  input: Record<string, unknown>;
}

// ============================================================================
// GATEWAY CLIENT CONFIG
// ============================================================================

/**
 * Gateway HTTP client configuration
 *
 * Used by GatewayClient to connect to local gateway process.
 */
export interface GatewayClientConfig {
  /** Base URL of gateway API (e.g., "http://localhost:18789") */
  baseURL: string;

  /** BRC-103 auth token (session token from handshake) */
  authToken: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout: number;

  /** Retry configuration */
  retries?: {
    /** Maximum retry attempts (default: 3) */
    maxAttempts: number;

    /** Initial retry delay in milliseconds (default: 1000) */
    initialDelayMs: number;

    /** Backoff multiplier (default: 2) */
    backoffMultiplier: number;
  };
}

// ============================================================================
// STREAMING CHAT MESSAGE
// ============================================================================

/**
 * Chat message with streaming state
 *
 * Extends ChatMessage with streaming-specific fields.
 * Used in UI to display partial messages while streaming.
 */
export interface StreamingChatMessage extends ChatMessage {
  /** Whether message is currently streaming */
  streaming: boolean;

  /** Tool use blocks (function calls) */
  tool_use: ToolUseBlock[];

  /** Unique message ID (for correlation with SSE events) */
  id?: string;

  /** Unix timestamp (milliseconds since epoch) */
  timestamp?: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for SSEMessage
 */
export function isSSEMessage(value: unknown): value is SSEMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof (value as SSEMessage).data === "string"
  );
}

/**
 * Type guard for ChatCompletionChunk (imported from api.ts)
 */
export function isChatCompletionChunk(
  value: unknown,
): value is ChatCompletionChunk {
  return (
    typeof value === "object" &&
    value !== null &&
    "object" in value &&
    (value as ChatCompletionChunk).object === "chat.completion.chunk" &&
    "choices" in value &&
    Array.isArray((value as ChatCompletionChunk).choices)
  );
}

/**
 * Type guard for ChatCompletionDelta
 */
export function isChatCompletionDelta(
  value: unknown,
): value is ChatCompletionDelta {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const delta = value as ChatCompletionDelta;

  // At least one field must be present
  return (
    delta.role !== undefined ||
    delta.content !== undefined ||
    delta.tool_use !== undefined
  );
}

/**
 * Type guard for ToolUseBlock
 */
export function isToolUseBlock(value: unknown): value is ToolUseBlock {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "input" in value &&
    typeof (value as ToolUseBlock).id === "string" &&
    typeof (value as ToolUseBlock).name === "string" &&
    typeof (value as ToolUseBlock).input === "object"
  );
}

// ============================================================================
// STREAMING SESSION STATE (extends chat.ts StreamingState type)
// ============================================================================

/**
 * Streaming session metadata
 *
 * Tracks active streaming request lifecycle with accumulated content.
 * Note: chat.ts defines StreamingState as a union type ('idle' | 'streaming' | ...)
 * This interface tracks the full session state including accumulated data.
 */
export interface StreamingSessionState {
  /** Whether a stream is currently active */
  active: boolean;

  /** Stream ID (correlation with SSE events) */
  streamId?: string;

  /** Accumulated message content */
  content: string;

  /** Accumulated tool use blocks */
  toolUses: ToolUseBlock[];

  /** Stream start timestamp (milliseconds since epoch) */
  startedAt?: number;

  /** Last received chunk timestamp (milliseconds since epoch) */
  lastChunkAt?: number;

  /** Error message (if stream failed) */
  error?: string;
}

// ============================================================================
// STREAMING REQUEST/RESPONSE
// ============================================================================

/**
 * Request to start streaming chat completion
 *
 * Extends ChatCompletionRequest with streaming flag.
 */
export interface StreamingChatCompletionRequest extends ChatCompletionRequest {
  /** Enable streaming (must be true) */
  stream: true;

  /** Stream ID (for correlation with events) */
  streamId?: string;
}

/**
 * Response from streaming chat completion
 *
 * Contains stream handle for reading chunks.
 */
export interface StreamingChatCompletionResponse {
  /** Stream ID (for correlation with events) */
  streamId: string;

  /** Readable stream of ChatCompletionChunk objects */
  stream: ReadableStream<ChatCompletionChunk>;

  /** Abort controller (for cancellation) */
  abortController: AbortController;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate GatewayClientConfig
 */
export function isValidGatewayClientConfig(
  value: unknown,
): value is GatewayClientConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const config = value as GatewayClientConfig;

  return (
    typeof config.baseURL === "string" &&
    typeof config.authToken === "string" &&
    typeof config.timeout === "number" &&
    config.timeout > 0
  );
}

/**
 * Validate StreamingChatMessage
 */
export function isValidStreamingChatMessage(
  value: unknown,
): value is StreamingChatMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const msg = value as StreamingChatMessage;

  return (
    typeof msg.role === "string" &&
    typeof msg.content === "string" &&
    typeof msg.streaming === "boolean" &&
    Array.isArray(msg.tool_use) &&
    msg.tool_use.every(isToolUseBlock)
  );
}

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Default GatewayClientConfig
 */
export const DEFAULT_GATEWAY_CLIENT_CONFIG: Omit<
  GatewayClientConfig,
  "baseURL" | "authToken"
> = {
  timeout: 30000,
  retries: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  },
};

/**
 * Create initial StreamingSessionState
 */
export function createInitialStreamingSessionState(): StreamingSessionState {
  return {
    active: false,
    content: "",
    toolUses: [],
  };
}
