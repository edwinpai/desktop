/**
 * Phase 7: EdwinPAI Gateway Configuration & API Type Definitions
 *
 * Defines type contracts for:
 * - EdwinPAI gateway configuration schema (~/.edwinpai/edwinpai.json)
 * - Gateway REST API endpoints (/v1/status, /v1/chat/completions)
 * - SSE (Server-Sent Events) streaming protocol
 * - Tool use blocks and function calling
 *
 * These types mirror the actual EdwinPAI gateway API (npm package `edwinpai`).
 * All implementation nodes MUST use these contracts.
 *
 * @module types/edwinpai-gateway
 */

// ============================================================================
// Gateway Configuration (~/.edwinpai/edwinpai.json)
// ============================================================================

/**
 * EdwinPAI gateway configuration schema.
 *
 * Stored in `~/.edwinpai/edwinpai.json` (Linux/macOS) or
 * `%APPDATA%\EdwinPAI\edwinpai.json` (Windows).
 *
 * @example
 * ```json
 * {
 *   "port": 18789,
 *   "logLevel": "info",
 *   "identity": {
 *     "publicKey": "02abc...",
 *     "petname": "brave-elephant"
 *   },
 *   "subscription": {
 *     "utxo": { "txid": "123...", "vout": 0 },
 *     "cacheFile": "/home/user/.edwinpai/subscription_cache.json"
 *   }
 * }
 * ```
 */
export interface GatewayConfig {
  /** HTTP server port (default: 18789) */
  port: number;

  /** Log level (default: "info") */
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';

  /** Identity configuration */
  identity: {
    /** Hex-encoded secp256k1 public key (66 chars) */
    publicKey: string;

    /** Human-readable petname (e.g., "brave-elephant") */
    petname: string;
  };

  /** Subscription verification settings */
  subscription: {
    /** UTXO reference for subscription payment */
    utxo: {
      /** Transaction ID (64-char hex) */
      txid: string;

      /** Output index */
      vout: number;
    };

    /** Path to SPV proof cache file */
    cacheFile: string;

    /** Cache TTL in seconds (default: 3600) */
    cacheTtlSeconds?: number;

    /** Offline grace period in hours (default: 72) */
    graceHours?: number;
  };

  /** mDNS advertising configuration */
  mdns?: {
    /** Enable mDNS service advertising (default: true) */
    enabled: boolean;

    /** Custom service name (null = hostname-based default) */
    serviceName?: string | null;
  };

  /** Channel configuration (optional, Phase 5) */
  channels?: {
    /** Enabled channel names */
    enabled: string[];

    /** Path to encrypted channel config directory */
    configDir: string;
  };
}

// ============================================================================
// Gateway Status API (/v1/status)
// ============================================================================

/**
 * Gateway status response from /v1/status endpoint.
 *
 * Used for health monitoring and capability detection.
 *
 * @example
 * ```ts
 * const status = await fetch('http://localhost:18789/v1/status').then(r => r.json());
 * console.log(status.uptime); // 3600 (seconds)
 * ```
 */
export interface GatewayStatus {
  /** Gateway health status */
  status: 'ok' | 'degraded' | 'error';

  /** Gateway uptime in seconds */
  uptime: number;

  /** Gateway version string (semver) */
  version: string;

  /** Operating mode */
  mode: 'gateway' | 'client';

  /** Identity information */
  identity: {
    /** Hex-encoded public key (66 chars) */
    publicKey: string;

    /** Human-readable petname */
    petname: string;

    /** Short ID (e.g., "edw:a1b2c3d4") */
    shortId: string;
  };

  /** Subscription status */
  subscription: {
    /** Whether subscription is active/cached */
    active: boolean;

    /** Verification method (SPV or cached) */
    method: 'spv' | 'cached' | 'offline';

    /** Last verification timestamp (ISO 8601) */
    verifiedAt: string | null;

    /** Subscription state */
    state: 'active' | 'cached' | 'expired' | 'grace_exceeded' | 'not_found';
  };

  /** Configured channel names */
  channels: string[];

  /** Per-service health indicators */
  services: {
    /** Chat API availability */
    chat: boolean;

    /** Identity endpoints availability */
    identity: boolean;

    /** Subscription verification availability */
    subscription: boolean;

    /** mDNS advertising status */
    mdns: boolean;
  };
}

// ============================================================================
// Chat Completions API (/v1/chat/completions)
// ============================================================================

/**
 * Chat message role.
 */
export type ChatRole = 'system' | 'user' | 'assistant';

/**
 * Text content block.
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content block (future use).
 */
export interface ImageContent {
  type: 'image';
  source: {
    type: 'url';
    url: string;
  };
}

/**
 * Tool use content block (function calling).
 */
export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result content block (function response).
 */
export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | TextContent[];
  is_error?: boolean;
}

/**
 * Content block types (multimodal support).
 */
export type ContentBlock =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent;

/**
 * Chat message (request format).
 */
export interface ChatMessage {
  /** Message role */
  role: ChatRole;

  /** Message content (string for simple, array for multimodal) */
  content: string | ContentBlock[];
}

/**
 * Tool definition for function calling.
 *
 * @example
 * ```ts
 * const weatherTool: ToolDefinition = {
 *   name: 'get_weather',
 *   description: 'Get current weather for a location',
 *   input_schema: {
 *     type: 'object',
 *     properties: {
 *       location: { type: 'string', description: 'City name' }
 *     },
 *     required: ['location']
 *   }
 * };
 * ```
 */
export interface ToolDefinition {
  /** Tool name (must be unique) */
  name: string;

  /** Human-readable tool description */
  description: string;

  /** JSON Schema for tool input parameters */
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Chat completion request to /v1/chat/completions.
 *
 * OpenAI-compatible with Anthropic extensions.
 *
 * @example
 * ```ts
 * const request: ChatCompletionRequest = {
 *   model: 'claude-sonnet-4-5',
 *   messages: [
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   stream: true,
 *   max_tokens: 2048
 * };
 * ```
 */
export interface ChatCompletionRequest {
  /** Model identifier (e.g., "claude-sonnet-4-5") */
  model: string;

  /** Conversation messages */
  messages: ChatMessage[];

  /** Enable SSE streaming (default: false) */
  stream?: boolean;

  /** System prompt (alternative to system message) */
  system?: string;

  /** Maximum tokens to generate (default: 4096) */
  max_tokens?: number;

  /** Temperature (0.0-1.0, default: 1.0) */
  temperature?: number;

  /** Top-p nucleus sampling (0.0-1.0, default: 1.0) */
  top_p?: number;

  /** Available tools for function calling */
  tools?: ToolDefinition[];

  /** Tool choice strategy */
  tool_choice?: 'auto' | 'any' | { type: 'tool'; name: string };

  /** Stop sequences */
  stop_sequences?: string[];

  /** Metadata for tracking (opaque to model) */
  metadata?: Record<string, unknown>;
}

/**
 * Non-streaming chat completion response.
 */
export interface ChatCompletionResponse {
  /** Response ID (UUID) */
  id: string;

  /** Response type (always "message") */
  type: 'message';

  /** Message role (always "assistant") */
  role: 'assistant';

  /** Message content blocks */
  content: ContentBlock[];

  /** Model used for generation */
  model: string;

  /** Stop reason */
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;

  /** Token usage statistics */
  usage: {
    /** Input tokens consumed */
    input_tokens: number;

    /** Output tokens generated */
    output_tokens: number;
  };
}

// ============================================================================
// SSE Streaming (/v1/chat/completions?stream=true)
// ============================================================================

/**
 * SSE event types (Anthropic Messages API format).
 *
 * Stream lifecycle:
 * 1. message_start
 * 2. content_block_start (per block)
 * 3. content_block_delta (multiple, per block)
 * 4. content_block_stop (per block)
 * 5. message_delta (usage updates)
 * 6. message_stop
 */
export type SSEEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'ping'
  | 'error';

/**
 * SSE message format (data field of SSE event).
 *
 * Each SSE event has format:
 * ```
 * event: message_start
 * data: {"type":"message_start","message":{...}}
 * ```
 */
export type SSEMessage =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | ErrorEvent;

/**
 * Message start event (first event in stream).
 */
export interface MessageStartEvent {
  type: 'message_start';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: [];
    model: string;
    stop_reason: null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

/**
 * Content block start event.
 */
export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: ContentBlock;
}

/**
 * Content block delta event (streaming text/tool input).
 */
export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta:
    | { type: 'text_delta'; text: string }
    | { type: 'input_json_delta'; partial_json: string };
}

/**
 * Content block stop event.
 */
export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

/**
 * Message delta event (metadata updates).
 */
export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
    stop_sequence?: string;
  };
  usage: {
    output_tokens: number;
  };
}

/**
 * Message stop event (final event in stream).
 */
export interface MessageStopEvent {
  type: 'message_stop';
}

/**
 * Ping event (keepalive).
 */
export interface PingEvent {
  type: 'ping';
}

/**
 * Error event.
 */
export interface ErrorEvent {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// ============================================================================
// Tool Use Blocks (Function Calling)
// ============================================================================

/**
 * Tool use block (model requesting function call).
 *
 * Appears in `content` array of assistant messages.
 */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result block (function call response).
 *
 * Sent in next user message after tool use.
 */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | TextContent[];
  is_error?: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract text content from content blocks.
 */
export function extractText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/**
 * Extract tool use blocks from content.
 */
export function extractToolUses(
  content: string | ContentBlock[],
): ToolUseBlock[] {
  if (typeof content === 'string') {
    return [];
  }

  return content.filter(
    (block): block is ToolUseBlock => block.type === 'tool_use',
  );
}

/**
 * Check if subscription is active (not expired or grace exceeded).
 */
export function isSubscriptionActive(
  state: GatewayStatus['subscription']['state'],
): boolean {
  return state === 'active' || state === 'cached';
}

/**
 * Check if gateway services are healthy.
 */
export function isGatewayHealthy(status: GatewayStatus): boolean {
  return (
    status.status === 'ok' &&
    status.services.chat &&
    status.services.identity &&
    status.subscription.active
  );
}
