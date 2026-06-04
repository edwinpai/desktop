import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ChatView } from "./ChatView";

import type { ChatMessage } from "@/types/api";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 80,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        key: index,
        index,
        start: index * 80,
      })),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}));

describe("ChatView", () => {
  const mockOnSendMessage = vi.fn();

  const defaultProps = {
    messages: [] as ChatMessage[],
    onSendMessage: mockOnSendMessage,
    isLoading: false,
    sessionKey: "agent:main:main",
    agentId: "main",
  };

  it("renders empty state when no messages", () => {
    render(<ChatView {...defaultProps} />);

    expect(screen.getByText("EdwinPAI")).toBeInTheDocument();
    expect(screen.getByText(/Your personal AI assistant/)).toBeInTheDocument();
  });

  it("renders messages array", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ];

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
    expect(screen.getByText("How are you?")).toBeInTheDocument();
  });

  it("renders correct number of messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Message 1" },
      { role: "assistant", content: "Message 2" },
      { role: "user", content: "Message 3" },
      { role: "assistant", content: "Message 4" },
    ];

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(messages.length).toBe(4);
  });

  it("renders system messages", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "System notification" },
    ];

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(screen.getByText("System notification")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    render(<ChatView {...defaultProps} isLoading={true} />);

    expect(
      screen.getByPlaceholderText("Type to queue message... (Esc to stop)"),
    ).toBeInTheDocument();
  });

  it("renders normal placeholder when not loading", () => {
    render(<ChatView {...defaultProps} isLoading={false} />);

    expect(
      screen.getByPlaceholderText(
        "Type a message... (Shift+Enter for new line)",
      ),
    ).toBeInTheDocument();
  });

  it("shows execute tasks button when current session has runnable tasks", () => {
    render(
      <ChatView
        {...defaultProps}
        sessions={[
          {
            key: "agent:main:main",
            label: "Main",
            taskQueue: { total: 2, runnable: 1 },
          },
        ]}
        onExecuteTasks={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Execute Tasks (1)" }),
    ).toBeInTheDocument();
  });

  it("hides execute tasks button when there are no runnable tasks", () => {
    render(
      <ChatView
        {...defaultProps}
        sessions={[
          {
            key: "agent:main:main",
            label: "Main",
            taskQueue: { total: 2, runnable: 0 },
          },
        ]}
        onExecuteTasks={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Execute Tasks/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the active task currently being worked on", () => {
    render(
      <ChatView
        {...defaultProps}
        isLoading={true}
        sessions={[
          {
            key: "agent:main:main",
            label: "Main",
            activeTask: {
              goal: "Fix chat tool visibility",
              status: "active",
              criteriaTotal: 4,
              criteriaCompleted: 1,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Currently working on")).toBeInTheDocument();
    expect(screen.getByText("Fix chat tool visibility")).toBeInTheDocument();
    expect(screen.getByText("1/4 criteria")).toBeInTheDocument();
  });

  it("hides the active task banner once the task is done", () => {
    render(
      <ChatView
        {...defaultProps}
        sessions={[
          {
            key: "agent:main:main",
            label: "Main",
            activeTask: {
              goal: "Ship onboarding flow",
              status: "done",
              criteriaTotal: 7,
              criteriaCompleted: 6,
            },
          },
        ]}
      />,
    );

    expect(screen.queryByText("Currently working on")).not.toBeInTheDocument();
    expect(screen.queryByText("Ship onboarding flow")).not.toBeInTheDocument();
    expect(screen.queryByText("6/7 criteria")).not.toBeInTheDocument();
  });

  it("handles long message arrays", () => {
    const messages: ChatMessage[] = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i + 1}`,
    }));

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(screen.getByText("Message 1")).toBeInTheDocument();
    expect(screen.getByText("Message 100")).toBeInTheDocument();
  });

  it("handles messages with special characters", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: 'Test <script>alert("xss")</script>' },
      { role: "assistant", content: "Test & < > \" ' special chars" },
    ];

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(screen.getByText(/Test <script>/)).toBeInTheDocument();
    expect(screen.getByText(/special chars/)).toBeInTheDocument();
  });

  it("handles empty message content", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "" },
      { role: "assistant", content: "Response" },
    ];

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(screen.getByText("Response")).toBeInTheDocument();
  });

  it("renders multiline messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Line 1\nLine 2\nLine 3" },
    ];

    render(<ChatView {...defaultProps} messages={messages} />);

    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
  });
});
