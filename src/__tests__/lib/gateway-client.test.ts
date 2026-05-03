/**
 * GatewayClient tests - SSE streaming, auth headers, error handling
 *
 * Tests:
 * 1. SSE parsing with data: prefix
 * 2. Message accumulation across chunks
 * 3. [DONE] signal handling
 * 4. Auth headers (Bearer token)
 * 5. Connection timeout
 * 6. Connection refused error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient } from "@/lib/GatewayClient";

import type { ChatCompletionChunk } from "@/types/api";
import type { StreamingChatCompletionRequest } from "@/types/streaming";

// ============================================================================
// Test Fixtures
// ============================================================================

const MOCK_AUTH_TOKEN = "test-session-token-abc123";
const MOCK_BASE_URL = "http://localhost:3000";

const MOCK_STREAMING_REQUEST: StreamingChatCompletionRequest = {
  messages: [{ role: "user", content: "Hello" }],
  model: "claude-sonnet-4-5",
  stream: true,
};

const MOCK_CHUNK_1: ChatCompletionChunk = {
  id: "chunk-1",
  object: "chat.completion.chunk",
  created: Date.now(),
  choices: [
    {
      delta: { content: "Hello", role: "assistant" },
      index: 0,
      finish_reason: null,
    },
  ],
};

const MOCK_CHUNK_2: ChatCompletionChunk = {
  id: "chunk-2",
  object: "chat.completion.chunk",
  created: Date.now(),
  choices: [
    {
      delta: { content: " world" },
      index: 0,
      finish_reason: null,
    },
  ],
};

const MOCK_CHUNK_3: ChatCompletionChunk = {
  id: "chunk-3",
  object: "chat.completion.chunk",
  created: Date.now(),
  choices: [
    {
      delta: { content: "!" },
      index: 0,
      finish_reason: "stop",
    },
  ],
};

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create mock ReadableStream that yields SSE-formatted chunks
 */
function createMockSSEStream(
  chunks: ChatCompletionChunk[],
  includeDone = true,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      // Enqueue chunks
      for (const chunk of chunks) {
        const sseMessage = `data: ${JSON.stringify(chunk)}\n\n`;
        controller.enqueue(encoder.encode(sseMessage));
      }

      // Enqueue [DONE] signal
      if (includeDone) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      }

      controller.close();
    },
  });
}

/**
 * Create mock fetch response
 */
function createMockResponse(
  stream: ReadableStream<Uint8Array>,
  status = 200,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    body: stream,
    text: async () => JSON.stringify({ error: { message: "Mock error" } }),
    json: async () => ({ error: { message: "Mock error" } }),
  } as Response;
}

// ============================================================================
// Tests
// ============================================================================

describe("GatewayClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Test 1: SSE parsing with data: prefix
  // --------------------------------------------------------------------------

  it("should parse SSE messages with data: prefix", async () => {
    const stream = createMockSSEStream([MOCK_CHUNK_1]);
    const response = createMockResponse(stream);

    fetchSpy.mockResolvedValue(response);

    const client = new GatewayClient({
      baseURL: MOCK_BASE_URL,
      authToken: MOCK_AUTH_TOKEN,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of client.sendMessage(MOCK_STREAMING_REQUEST)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.id).toBe("chunk-1");
    expect(chunks[0]?.choices[0]?.delta.content).toBe("Hello");
  });

  // --------------------------------------------------------------------------
  // Test 2: Message accumulation across chunks
  // --------------------------------------------------------------------------

  it("should accumulate message content across multiple chunks", async () => {
    const stream = createMockSSEStream([
      MOCK_CHUNK_1,
      MOCK_CHUNK_2,
      MOCK_CHUNK_3,
    ]);
    const response = createMockResponse(stream);

    fetchSpy.mockResolvedValue(response);

    const client = new GatewayClient({
      baseURL: MOCK_BASE_URL,
      authToken: MOCK_AUTH_TOKEN,
    });

    const chunks: ChatCompletionChunk[] = [];
    let accumulated = "";

    for await (const chunk of client.sendMessage(MOCK_STREAMING_REQUEST)) {
      chunks.push(chunk);
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        accumulated += delta.content;
      }
    }

    expect(chunks).toHaveLength(3);
    expect(accumulated).toBe("Hello world!");

    // Verify individual chunks
    expect(chunks[0]?.choices[0]?.delta.content).toBe("Hello");
    expect(chunks[1]?.choices[0]?.delta.content).toBe(" world");
    expect(chunks[2]?.choices[0]?.delta.content).toBe("!");
  });

  // --------------------------------------------------------------------------
  // Test 3: [DONE] signal handling
  // --------------------------------------------------------------------------

  it("should stop streaming when [DONE] signal received", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send chunk
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(MOCK_CHUNK_1)}\n\n`),
        );

        // Send [DONE] signal
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        // Send additional chunk that should be ignored
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(MOCK_CHUNK_2)}\n\n`),
        );

        controller.close();
      },
    });

    const response = createMockResponse(stream);
    fetchSpy.mockResolvedValue(response);

    const client = new GatewayClient({
      baseURL: MOCK_BASE_URL,
      authToken: MOCK_AUTH_TOKEN,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of client.sendMessage(MOCK_STREAMING_REQUEST)) {
      chunks.push(chunk);
    }

    // Should only receive chunk before [DONE]
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.id).toBe("chunk-1");
  });

  // --------------------------------------------------------------------------
  // Test 4: Auth headers (Bearer token)
  // --------------------------------------------------------------------------

  it("should include Authorization header with Bearer token", async () => {
    const stream = createMockSSEStream([MOCK_CHUNK_1]);
    const response = createMockResponse(stream);

    fetchSpy.mockResolvedValue(response);

    const client = new GatewayClient({
      baseURL: MOCK_BASE_URL,
      authToken: MOCK_AUTH_TOKEN,
    });

    const generator = client.sendMessage(MOCK_STREAMING_REQUEST);
    await generator.next(); // Trigger fetch

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${MOCK_BASE_URL}/v1/chat/completions`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: `Bearer ${MOCK_AUTH_TOKEN}`,
        }),
        body: JSON.stringify(MOCK_STREAMING_REQUEST),
      }),
    );
  });

  // --------------------------------------------------------------------------
  // Test 5: Connection timeout
  // --------------------------------------------------------------------------

  it("should handle connection timeout", async () => {
    // Mock fetch to throw AbortError
    fetchSpy.mockRejectedValue(
      new DOMException("The user aborted a request", "AbortError"),
    );

    const client = new GatewayClient({
      baseURL: MOCK_BASE_URL,
      authToken: MOCK_AUTH_TOKEN,
      timeout: 50, // Short timeout
    });

    let error: Error | null = null;

    try {
      const generator = client.sendMessage(MOCK_STREAMING_REQUEST);
      await generator.next();
    } catch (err) {
      error = err as Error;
    }

    // AbortError should be caught
    expect(error).not.toBeNull();
    // GatewayClient catches AbortError and re-throws as "Request cancelled"
    // but the actual error message depends on where the abort happens
    expect(error?.message).toContain("abort");
  });

  // --------------------------------------------------------------------------
  // Test 6: Connection refused error
  // --------------------------------------------------------------------------

  it("should handle connection refused error", async () => {
    // Mock fetch to throw connection error
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch: ECONNREFUSED"));

    const client = new GatewayClient({
      baseURL: MOCK_BASE_URL,
      authToken: MOCK_AUTH_TOKEN,
    });

    let error: Error | null = null;

    try {
      const generator = client.sendMessage(MOCK_STREAMING_REQUEST);
      await generator.next();
    } catch (err) {
      error = err as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain("Failed to fetch");
  });

  // --------------------------------------------------------------------------
  // Bonus: HTTP 401 error handling
  // --------------------------------------------------------------------------

  it("should handle HTTP 401 Unauthorized", async () => {
    const errorResponse = {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      body: null,
      text: async () =>
        JSON.stringify({ error: { message: "Invalid auth token" } }),
    } as Response;

    fetchSpy.mockResolvedValue(errorResponse);

    const client = new GatewayClient({
      baseURL: MOCK_BASE_URL,
      authToken: "invalid-token",
    });

    let error: Error | null = null;

    try {
      const generator = client.sendMessage(MOCK_STREAMING_REQUEST);
      await generator.next();
    } catch (err) {
      error = err as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain("Invalid auth token");
  });
});
