/**
 * ChatView tests - useGatewayChat integration, typing indicator, tool use, auto-scroll
 *
 * Tests:
 * 1. useGatewayChat integration (sends messages, displays responses)
 * 2. Typing indicator visibility during streaming
 * 3. Tool use rendering (ToolUseCard components)
 * 4. Auto-scroll during streaming
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChatView } from '@/components/chat/ChatView';
import { useGatewayChat } from '@/hooks/useGatewayChat';

import type { StreamingChatMessage, ToolUseBlock } from '@/types/streaming';

// ============================================================================
// Mock Dependencies
// ============================================================================

vi.mock('@/hooks/useGatewayChat');

// ============================================================================
// Test Fixtures
// ============================================================================

const MOCK_TOOL_USE: ToolUseBlock = {
  id: 'toolu_abc123',
  name: 'get_weather',
  input: { location: 'San Francisco' },
};

const MOCK_MESSAGES: StreamingChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'What is the weather in SF?',
    timestamp: Date.now(),
    streaming: false,
    tool_use: [],
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Let me check the weather for you.',
    timestamp: Date.now(),
    streaming: false,
    tool_use: [MOCK_TOOL_USE],
  },
];

// ============================================================================
// Test Helpers
// ============================================================================

function createMockUseGatewayChat(overrides = {}) {
  return {
    messages: [],
    isStreaming: false,
    currentResponse: '',
    currentToolUses: [],
    error: null,
    loading: false,
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
    clearMessages: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Test 1: useGatewayChat integration
  // --------------------------------------------------------------------------

  it('should integrate with useGatewayChat and display messages', async () => {
    const mockSendMessage = vi.fn();

    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        messages: MOCK_MESSAGES,
        sendMessage: mockSendMessage,
      })
    );

    render(<ChatView authToken="test-token" />);

    // Should display both messages
    expect(screen.getByText('What is the weather in SF?')).toBeInTheDocument();
    expect(screen.getByText('Let me check the weather for you.')).toBeInTheDocument();

    // Should display tool use
    expect(screen.getByText('get_weather')).toBeInTheDocument();

    // Should have input field
    const input = screen.getByPlaceholderText('Type a message...');
    expect(input).toBeInTheDocument();

    // Send message
    fireEvent.change(input, { target: { value: 'New message' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockSendMessage).toHaveBeenCalledWith('New message');
  });

  // --------------------------------------------------------------------------
  // Test 2: Typing indicator visibility
  // --------------------------------------------------------------------------

  it('should show typing indicator when streaming', async () => {
    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        messages: [MOCK_MESSAGES[0]],
        isStreaming: true,
        currentResponse: 'Thinking',
      })
    );

    const { container } = render(<ChatView authToken="test-token" />);

    // Should display current response
    expect(screen.getByText('Thinking')).toBeInTheDocument();

    // Should have animated dots (3 spans with animate-bounce)
    const animatedDots = container.querySelectorAll('.animate-bounce');
    expect(animatedDots).toHaveLength(3);

    // Verify animation delays
    expect(animatedDots[0]).toHaveStyle({ animationDelay: '0ms' });
    expect(animatedDots[1]).toHaveStyle({ animationDelay: '150ms' });
    expect(animatedDots[2]).toHaveStyle({ animationDelay: '300ms' });
  });

  // --------------------------------------------------------------------------
  // Test 3: Tool use rendering
  // --------------------------------------------------------------------------

  it('should render tool use cards for assistant messages', async () => {
    const toolUse1: ToolUseBlock = {
      id: 'tool-1',
      name: 'search_web',
      input: { query: 'TypeScript tutorial' },
    };

    const toolUse2: ToolUseBlock = {
      id: 'tool-2',
      name: 'calculator',
      input: { expression: '2 + 2' },
    };

    const messagesWithTools: StreamingChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Search for TypeScript tutorials and calculate 2+2',
        timestamp: Date.now(),
        streaming: false,
        tool_use: [],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'I will help you with that.',
        timestamp: Date.now(),
        streaming: false,
        tool_use: [toolUse1, toolUse2],
      },
    ];

    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        messages: messagesWithTools,
      })
    );

    render(<ChatView authToken="test-token" />);

    // Should display both tool use cards
    expect(screen.getByText('search_web')).toBeInTheDocument();
    expect(screen.getByText('calculator')).toBeInTheDocument();

    // Tool IDs should be visible
    expect(screen.getByText('tool-1')).toBeInTheDocument();
    expect(screen.getByText('tool-2')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Test 4: Auto-scroll during streaming
  // --------------------------------------------------------------------------

  it('should auto-scroll when streaming updates', async () => {
    const scrollIntoViewMock = vi.fn();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    // Initial render with messages
    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        messages: [MOCK_MESSAGES[0]],
      })
    );

    const { rerender } = render(
      <ChatView authToken="test-token" />
    );

    // Should scroll on initial render with messages
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });

    scrollIntoViewMock.mockClear();

    // Start streaming - should scroll on streaming
    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        messages: [MOCK_MESSAGES[0]],
        isStreaming: true,
        currentResponse: 'Hello',
      })
    );

    rerender(<ChatView authToken="test-token" />);

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });

    scrollIntoViewMock.mockClear();

    // Update streaming content - should scroll again
    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        messages: [MOCK_MESSAGES[0]],
        isStreaming: true,
        currentResponse: 'Hello world',
      })
    );

    rerender(<ChatView authToken="test-token" />);

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Bonus: Error display
  // --------------------------------------------------------------------------

  it('should display error messages', () => {
    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        error: 'Connection failed. Please try again.',
      })
    );

    render(<ChatView authToken="test-token" />);

    // Should display error
    expect(screen.getByText(/Connection failed/)).toBeInTheDocument();

    // Error should have red styling
    const errorElement = screen.getByText(/Connection failed/).closest('div');
    expect(errorElement).toHaveClass('bg-red-50');
  });

  // --------------------------------------------------------------------------
  // Bonus: Clear messages
  // --------------------------------------------------------------------------

  it('should call clearMessages when Clear button clicked', () => {
    const mockClearMessages = vi.fn();

    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        messages: MOCK_MESSAGES,
        clearMessages: mockClearMessages,
      })
    );

    render(<ChatView authToken="test-token" />);

    // Click Clear button
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    expect(mockClearMessages).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // Bonus: Streaming tool uses
  // --------------------------------------------------------------------------

  it('should display streaming tool uses', () => {
    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat({
        messages: [MOCK_MESSAGES[0]], // Need at least one message to show streaming
        isStreaming: true,
        currentResponse: 'Using tools...',
        currentToolUses: [MOCK_TOOL_USE],
      })
    );

    render(<ChatView authToken="test-token" />);

    // Should display streaming tool use
    expect(screen.getByText('get_weather')).toBeInTheDocument();
    expect(screen.getByText('toolu_abc123')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Bonus: Empty state
  // --------------------------------------------------------------------------

  it('should display empty state when no messages', () => {
    (useGatewayChat as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockUseGatewayChat()
    );

    render(<ChatView authToken="test-token" />);

    // Should display empty state
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    expect(screen.getByText(/Start a conversation!/)).toBeInTheDocument();
  });
});
