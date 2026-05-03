import { useCallback, useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InputBar } from "./InputBar";

describe("InputBar", () => {
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    mockOnSendMessage.mockClear();
    window.localStorage.clear();
  });

  it("renders with default placeholder", () => {
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    expect(
      screen.getByPlaceholderText(
        "Type a message... (! for shell commands, / for slash commands)",
      ),
    ).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(
      <InputBar
        onSendMessage={mockOnSendMessage}
        placeholder="Custom placeholder"
      />,
    );

    expect(
      screen.getByPlaceholderText("Custom placeholder"),
    ).toBeInTheDocument();
  });

  it("sends message on Enter key press", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "Hello world");
    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("Hello world", {
      attachments: [],
    });
  });

  it("does not send message on Shift+Enter", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "Line 1");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(textarea, "Line 2");

    // Should not send message yet
    expect(mockOnSendMessage).not.toHaveBeenCalled();

    // Textarea should contain both lines
    expect(textarea).toHaveValue("Line 1\nLine 2");
  });

  it("clears input after sending message", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "Test message");
    await user.keyboard("{Enter}");

    expect(textarea).toHaveValue("");
  });

  it("trims whitespace before sending", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "  Message with spaces  ");
    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("Message with spaces", {
      attachments: [],
    });
  });

  it("does not send empty or whitespace-only messages", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    // Try to send empty message
    await user.keyboard("{Enter}");
    expect(mockOnSendMessage).not.toHaveBeenCalled();

    // Try to send whitespace-only message
    await user.type(textarea, "   ");
    await user.keyboard("{Enter}");
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it("sends message on send button click", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /send message/i });

    await user.type(textarea, "Click to send");
    await user.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith("Click to send", {
      attachments: [],
    });
  });

  it("keeps input enabled when disabled prop is true for API compatibility", () => {
    render(<InputBar onSendMessage={mockOnSendMessage} disabled={true} />);

    const textarea = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /send message/i });

    expect(textarea).toBeEnabled();
    expect(sendButton).toBeDisabled();
  });

  it("still sends messages when disabled prop is true", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} disabled={true} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "Should still send");
    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("Should still send", {
      attachments: [],
    });
  });

  it("disables send button when input is empty", () => {
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const sendButton = screen.getByRole("button", { name: /send message/i });

    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has content", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /send message/i });

    await user.type(textarea, "Content");

    expect(sendButton).toBeEnabled();
  });

  it("enforces max length", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} maxLength={10} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "12345678901234567890"); // 20 characters

    // Should only contain first 10 characters
    expect(textarea).toHaveValue("1234567890");
  });

  it("shows character count when near limit", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} maxLength={100} />);

    const textarea = screen.getByRole("textbox");

    // Type 91 characters (> 90% of 100)
    await user.type(textarea, "a".repeat(91));

    expect(screen.getByText("91/100")).toBeInTheDocument();
  });

  it("shows character count in red when at limit", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} maxLength={10} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "1234567890"); // Exactly 10 characters

    const charCount = screen.getByText("10/10");
    expect(charCount).toBeInTheDocument();
    expect(charCount).toHaveClass("text-destructive");
  });

  it("does not show character count when below 90%", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} maxLength={100} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "Short message"); // Far below limit

    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
  });

  it("displays keyboard shortcut hints", () => {
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    expect(screen.getByText(/Press/)).toBeInTheDocument();
    expect(screen.getByText("Enter")).toBeInTheDocument();
    expect(screen.getByText("Shift+Enter")).toBeInTheDocument();
  });

  it("handles multiline input correctly", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    await user.type(
      textarea,
      "Line 1{Shift>}{Enter}{/Shift}Line 2{Shift>}{Enter}{/Shift}Line 3",
    );

    expect(textarea).toHaveValue("Line 1\nLine 2\nLine 3");

    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("Line 1\nLine 2\nLine 3", {
      attachments: [],
    });
  });

  it("prevents Enter key default behavior", async () => {
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    // Type a message first so Enter triggers send
    fireEvent.change(textarea, { target: { value: "test message" } });

    // fireEvent.keyDown creates a real DOM event — check defaultPrevented on it
    const prevented = !fireEvent.keyDown(textarea, {
      key: "Enter",
      shiftKey: false,
    });

    // fireEvent returns false when preventDefault was called
    expect(prevented).toBe(true);
  });

  it("does not prevent Shift+Enter default behavior", async () => {
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    const shiftEnterEvent = {
      key: "Enter",
      shiftKey: true,
      preventDefault: vi.fn(),
    };

    fireEvent.keyDown(textarea, shiftEnterEvent);

    expect(shiftEnterEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("accepts controlled input changes", async () => {
    const user = userEvent.setup();
    render(<InputBar onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "Test");
    await user.clear(textarea);
    await user.type(textarea, "New content");

    expect(textarea).toHaveValue("New content");
  });

  it("restores unsent draft text for the same session key after remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <InputBar
        onSendMessage={mockOnSendMessage}
        sessionKey="agent:main:main"
      />,
    );

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Draft that should survive tab switching");

    expect(
      window.localStorage.getItem("edwinpai:chat:draft:agent:main:main"),
    ).toBeNull();

    unmount();

    expect(
      window.localStorage.getItem("edwinpai:chat:draft:agent:main:main"),
    ).toBe("Draft that should survive tab switching");

    render(
      <InputBar
        onSendMessage={mockOnSendMessage}
        sessionKey="agent:main:main"
      />,
    );

    expect(screen.getByRole("textbox")).toHaveValue(
      "Draft that should survive tab switching",
    );
  });

  it("debounces local text persistence while typing without syncing draft upstream", () => {
    vi.useFakeTimers();
    const handleDraftChange = vi.fn();

    const { unmount } = render(
      <InputBar
        onSendMessage={mockOnSendMessage}
        sessionKey="agent:main:main"
        onDraftChange={handleDraftChange}
      />,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "D" } });
    fireEvent.change(textarea, { target: { value: "Dr" } });
    fireEvent.change(textarea, { target: { value: "Draft" } });

    expect(handleDraftChange).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem("edwinpai:chat:draft:agent:main:main"),
    ).toBeNull();

    vi.advanceTimersByTime(299);
    expect(handleDraftChange).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem("edwinpai:chat:draft:agent:main:main"),
    ).toBeNull();

    vi.advanceTimersByTime(1);
    expect(handleDraftChange).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem("edwinpai:chat:draft:agent:main:main"),
    ).toBe("Draft");

    unmount();
    expect(handleDraftChange).toHaveBeenCalledWith({
      value: "Draft",
      attachments: [],
    });

    vi.useRealTimers();
  });

  it("clears saved draft after sending for a session key", async () => {
    const user = userEvent.setup();
    render(
      <InputBar
        onSendMessage={mockOnSendMessage}
        sessionKey="agent:main:main"
      />,
    );

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Persistent draft");
    await user.keyboard("{Enter}");

    expect(
      window.localStorage.getItem("edwinpai:chat:draft:agent:main:main"),
    ).toBeNull();
    expect(textarea).toHaveValue("");
  });

  it("preserves attachments and text across remount when draft state is hoisted", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [draft, setDraft] = useState({
        value: "",
        attachments: [] as Array<{
          type?: string;
          mimeType: string;
          fileName: string;
          content: string;
        }>,
      });
      const [mounted, setMounted] = useState(true);
      const handleDraftChange = useCallback(
        (next: {
          value: string;
          attachments: Array<{
            type?: string;
            mimeType: string;
            fileName: string;
            content: string;
          }>;
        }) => {
          setDraft(next);
        },
        [],
      );

      return (
        <div>
          <button type="button" onClick={() => setMounted((prev) => !prev)}>
            toggle
          </button>
          {mounted ? (
            <InputBar
              onSendMessage={mockOnSendMessage}
              sessionKey="agent:main:main"
              draft={draft}
              onDraftChange={handleDraftChange}
            />
          ) : null}
        </div>
      );
    }

    const { container } = render(<Harness />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Draft with attachment");

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["hello"], "note.txt", { type: "text/plain" });
    await user.upload(fileInput, file);

    expect(screen.getByText("note.txt")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "toggle" }));
    await user.click(screen.getByRole("button", { name: "toggle" }));

    expect(screen.getByRole("textbox")).toHaveValue("Draft with attachment");
    expect(screen.getByText("note.txt")).toBeInTheDocument();
  });
});
