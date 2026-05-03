/**
 * GatewayClient - HTTP client for gateway REST API
 *
 * Implements SSE streaming for chat completions with EventSource polyfill.
 * Handles authentication, retry logic, and error recovery.
 */

import type { ChatCompletionRequest, ChatCompletionChunk } from "@/types/api";

import type {
  GatewayClientConfig,
  StreamingChatCompletionRequest,
} from "@/types/streaming";

import { DEFAULT_GATEWAY_CLIENT_CONFIG } from "@/types/streaming";

// ============================================================================
// Gateway Client
// ============================================================================

/**
 * HTTP client for gateway REST API
 *
 * Provides methods for chat completions with SSE streaming.
 * Handles authentication via Bearer token (BRC-103).
 */
export class GatewayClient {
  private readonly config: GatewayClientConfig;

  constructor(config: Partial<GatewayClientConfig>) {
    this.config = {
      ...DEFAULT_GATEWAY_CLIENT_CONFIG,
      ...config,
    } as GatewayClientConfig;
  }

  /**
   * Send a chat message with SSE streaming
   *
   * @param request Chat completion request
   * @returns Async generator yielding ChatCompletionChunk objects
   *
   * @example
   * ```ts
   * const client = new GatewayClient({ baseURL: 'http://localhost:18789', authToken: 'abc123' });
   *
   * for await (const chunk of client.sendMessage({ messages: [...], model: 'claude-sonnet-4-5', stream: true })) {
   *   console.log(chunk.choices[0].delta.content);
   * }
   * ```
   */
  async *sendMessage(
    request: StreamingChatCompletionRequest,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const abortController = new AbortController();
    let response: Response | null = null;

    try {
      // Fetch SSE stream
      response = await fetch(`${this.config.baseURL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.authToken}`,
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          }
        } catch {
          // Use default error message
        }

        throw new Error(errorMessage);
      }

      // Check for body
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

          // Parse SSE message: "data: {json}\n"
          const lines = eventText.trim().split("\n");
          const dataLine = lines.find((line) => line.startsWith("data: "));

          if (!dataLine) continue;

          const jsonStr = dataLine.slice(6); // Remove "data: " prefix

          // Handle [DONE] signal
          if (jsonStr === "[DONE]") {
            return;
          }

          // Parse ChatCompletionChunk
          try {
            const chunk = JSON.parse(jsonStr) as ChatCompletionChunk;
            yield chunk;
          } catch (err) {
            console.error("Failed to parse SSE chunk:", err);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Request cancelled");
      }
      throw err;
    } finally {
      abortController.abort();
    }
  }

  /**
   * Send a non-streaming chat message
   *
   * @param request Chat completion request
   * @returns Chat completion response
   */
  async sendMessageSync(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionChunk> {
    const response = await fetch(`${this.config.baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.authToken}`,
      },
      body: JSON.stringify({ ...request, stream: false }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Update auth token
   */
  setAuthToken(token: string): void {
    (this.config as { authToken: string }).authToken = token;
  }

  /**
   * Update base URL
   */
  setBaseURL(url: string): void {
    (this.config as { baseURL: string }).baseURL = url;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a GatewayClient instance
 */
export function createGatewayClient(
  config: Partial<GatewayClientConfig>,
): GatewayClient {
  return new GatewayClient(config);
}
