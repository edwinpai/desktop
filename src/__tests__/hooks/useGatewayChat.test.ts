/**
 * useGatewayChat tests - Send message flow, streaming, error handling
 *
 * Tests:
 * 1. Send message flow (user message → API request → assistant message)
 * 2. Streaming state updates (isStreaming, currentResponse)
 * 3. Error handling: 401 Unauthorized
 * 4. Error handling: Network error (connection refused)
 * 5. Error handling: Timeout
 * 6. Message list updates
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGatewayChat } from '@/hooks/useGatewayChat';
import type { ChatCompletionChunk } from '@/types/api';

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock dependencies BEFORE imports
const mockSendMessage = vi.fn();
const mockSetAuthToken = vi.fn();
const mockSetBaseURL = vi.fn();

vi.mock('@/hooks/useConfig', () => ({
  useGatewayConfig: () => ({
    gatewayPort: 3000,
  }),
}));

vi.mock('@/lib/GatewayClient', () => {
  class MockGatewayClient {
    sendMessage = mockSendMessage;
    setAuthToken = mockSetAuthToken;
    setBaseURL = mockSetBaseURL;
  }

  return {
    GatewayClient: MockGatewayClient,
  };
});

// ============================================================================
// Test Fixtures
// ============================================================================

const MOCK_CHUNKS: ChatCompletionChunk[] = [
  {
    id: 'chunk-1',
    object: 'chat.completion.chunk',
    created: Date.now(),
    choices: [
      {
        delta: { content: 'Hello', role: 'assistant' },
        index: 0,
        finish_reason: null,
      },
    ],
  },
  {
    id: 'chunk-2',
    object: 'chat.completion.chunk',
    created: Date.now(),
    choices: [
      {
        delta: { content: ' world' },
        index: 0,
        finish_reason: null,
      },
    ],
  },
  {
    id: 'chunk-3',
    object: 'chat.completion.chunk',
    created: Date.now(),
    choices: [
      {
        delta: { content: '!' },
        index: 0,
        finish_reason: 'stop',
      },
    ],
  },
];

// ============================================================================
// Test Helpers
// ============================================================================

async function* createThrowingStreamingGenerator(
  error: Error
): AsyncGenerator<ChatCompletionChunk> {
  yield* [] as ChatCompletionChunk[];
  throw error;
}

/**
 * Create async generator that yields chunks
 */
async function* createMockStreamingGenerator(chunks: ChatCompletionChunk[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('useGatewayChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Test 1: Send message flow
  // --------------------------------------------------------------------------

  it('should send user message and receive assistant response', async () => {
    // Mock GatewayClient.sendMessage
    mockSendMessage.mockImplementation(() =>
      createMockStreamingGenerator(MOCK_CHUNKS)
    );

    const { result } = renderHook(() =>
      useGatewayChat({
        authToken: 'test-token',
        model: 'claude-sonnet-4-5',
      })
    );

    // Initial state
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentResponse).toBe('');

    // Send message
    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    // Wait for streaming to complete
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    // Should have 2 messages (user + assistant)
    expect(result.current.messages).toHaveLength(2);

    // User message
    expect(result.current.messages[0]?.role).toBe('user');
    expect(result.current.messages[0]?.content).toBe('Hello');

    // Assistant message
    expect(result.current.messages[1]?.role).toBe('assistant');
    expect(result.current.messages[1]?.content).toBe('Hello world!');

    // Streaming state reset
    expect(result.current.currentResponse).toBe('');
    expect(result.current.error).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test 2: Streaming state updates
  // --------------------------------------------------------------------------

  it('should update streaming state during message send', async () => {
    let resolveChunk: ((value: IteratorResult<ChatCompletionChunk>) => void) | null = null;

    // Mock generator that yields chunks on demand
    const mockGenerator = {
      async next() {
        return new Promise<IteratorResult<ChatCompletionChunk>>((resolve) => {
          resolveChunk = resolve;
        });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };

    mockSendMessage.mockReturnValue(mockGenerator);

    const { result } = renderHook(() => useGatewayChat());

    // Start sending message
    act(() => {
      result.current.sendMessage('Test');
    });

    // Should be streaming
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
      expect(result.current.loading).toBe(true);
    });

    // Yield first chunk
    await act(async () => {
      resolveChunk?.({ value: MOCK_CHUNKS[0]!, done: false });
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => {
      expect(result.current.currentResponse).toBe('Hello');
    });

    // Complete stream
    await act(async () => {
      resolveChunk?.({ value: undefined, done: true });
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: Error handling - 401 Unauthorized
  // --------------------------------------------------------------------------

  it('should handle 401 Unauthorized error', async () => {
    mockSendMessage.mockImplementation(() =>
      createThrowingStreamingGenerator(new Error('HTTP 401: Unauthorized'))
    );

    const { result } = renderHook(() => useGatewayChat());

    // Send message
    await act(async () => {
      await result.current.sendMessage('Test');
    });

    // Should have error
    expect(result.current.error).toContain('Authentication failed');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Test 4: Error handling - Connection refused
  // --------------------------------------------------------------------------

  it('should handle connection refused error', async () => {
    mockSendMessage.mockImplementation(() =>
      createThrowingStreamingGenerator(new TypeError('Failed to fetch: ECONNREFUSED'))
    );

    const { result } = renderHook(() => useGatewayChat());

    // Send message
    await act(async () => {
      await result.current.sendMessage('Test');
    });

    // Should have error
    expect(result.current.error).toContain('Cannot connect to gateway');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Test 5: Error handling - Timeout
  // --------------------------------------------------------------------------

  it('should handle timeout error', async () => {
    mockSendMessage.mockImplementation(() => {
      // Throw error that matches the timeout pattern
      const error = new Error('Connection timeout');
      error.name = 'AbortError';
      return createThrowingStreamingGenerator(error);
    });

    const { result } = renderHook(() => useGatewayChat());

    // Send message
    await act(async () => {
      await result.current.sendMessage('Test');
    });

    // Should have error (hook checks for 'AbortError' in message)
    expect(result.current.error).toContain('Request timed out');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Test 6: Message list updates
  // --------------------------------------------------------------------------

  it('should update message list correctly', async () => {
    mockSendMessage.mockImplementation(() =>
      createMockStreamingGenerator(MOCK_CHUNKS)
    );

    const { result } = renderHook(() => useGatewayChat());

    // Send first message
    await act(async () => {
      await result.current.sendMessage('First message');
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    // Send second message
    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(4);
    });

    // Verify message order
    expect(result.current.messages[0]?.content).toBe('First message');
    expect(result.current.messages[1]?.content).toBe('Hello world!');
    expect(result.current.messages[2]?.content).toBe('Second message');
    expect(result.current.messages[3]?.content).toBe('Hello world!');

    // Clear messages
    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Bonus: Cancel stream
  // --------------------------------------------------------------------------

  it('should cancel streaming request', async () => {
    // Mock generator that yields chunks on demand
    const mockGenerator = {
      async next() {
        return new Promise<IteratorResult<ChatCompletionChunk>>(() => {
          // Never resolves (simulates long-running request)
        });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };

    mockSendMessage.mockReturnValue(mockGenerator);

    const { result } = renderHook(() => useGatewayChat());

    // Start sending message
    act(() => {
      result.current.sendMessage('Test');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
    });

    // Cancel stream
    act(() => {
      result.current.cancelStream();
    });

    // Should stop streaming
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.currentResponse).toBe('');
  });

  // --------------------------------------------------------------------------
  // Bonus: Retry last message
  // --------------------------------------------------------------------------

  it('should retry last failed message', async () => {
    mockSendMessage
      .mockImplementationOnce(() =>
        createThrowingStreamingGenerator(new Error('Network error'))
      )
      .mockImplementation(() => createMockStreamingGenerator(MOCK_CHUNKS));

    const { result } = renderHook(() => useGatewayChat());

    // First attempt fails
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    // Should have error and user message
    expect(result.current.error).not.toBeNull();
    expect(result.current.messages).toHaveLength(1); // 1 user message

    // Retry
    await act(async () => {
      await result.current.retry();
    });

    // Should succeed and add user + assistant
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toHaveLength(3); // 1 original user + 1 retry user + 1 assistant
  });
});
