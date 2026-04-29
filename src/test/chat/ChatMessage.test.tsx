/**
 * ChatMessage Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import type { ChatMessage as ChatMessageType } from '@/types/chat';

describe('ChatMessage', () => {
  it('renders user message with correct styling', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'user',
      content: 'Hello, world!',
      timestamp: '2024-01-01T12:00:00Z',
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders assistant message with correct styling', () => {
    const message: ChatMessageType = {
      id: '2',
      role: 'assistant',
      content: 'Hi there! How can I help?',
      timestamp: '2024-01-01T12:01:00Z',
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText('Hi there! How can I help?')).toBeInTheDocument();
  });

  it('displays streaming indicator when streaming', () => {
    const message: ChatMessageType = {
      id: '3',
      role: 'assistant',
      content: 'Streaming message...',
      timestamp: '2024-01-01T12:02:00Z',
    };

    render(<ChatMessage message={message} isStreaming={true} />);

    expect(screen.getByText('Streaming message...')).toBeInTheDocument();
  });

  it('formats timestamp correctly', () => {
    const message: ChatMessageType = {
      id: '4',
      role: 'user',
      content: 'Test message',
      timestamp: '2024-01-01T12:30:00Z',
    };

    render(<ChatMessage message={message} />);

    // Timestamp should be displayed
    const timestamp = screen.getByText(/\d{1,2}:\d{2}/);
    expect(timestamp).toBeInTheDocument();
  });

  it('handles multimodal content', () => {
    const message: ChatMessageType = {
      id: '5',
      role: 'user',
      content: [
        { type: 'text', text: 'First part' },
        { type: 'text', text: 'Second part' },
      ],
      timestamp: '2024-01-01T12:00:00Z',
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText('First partSecond part')).toBeInTheDocument();
  });
});
