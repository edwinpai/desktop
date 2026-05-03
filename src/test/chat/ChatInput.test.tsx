/**
 * ChatInput Component Tests
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "@/components/chat/ChatInput";

describe("ChatInput", () => {
  it("renders input field and send button", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    expect(
      screen.getByPlaceholderText("Type a message..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("calls onSend when send button is clicked", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Hello!");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await user.click(sendButton);

    expect(onSend).toHaveBeenCalledWith("Hello!");
  });

  it("calls onSend when Enter key is pressed", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Test message{Enter}");

    expect(onSend).toHaveBeenCalledWith("Test message");
  });

  it("does not call onSend when Shift+Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Line 1{Shift>}{Enter}{/Shift}Line 2");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears input after sending", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByPlaceholderText(
      "Type a message...",
    ) as HTMLTextAreaElement;
    await user.type(input, "Test{Enter}");

    expect(input.value).toBe("");
  });

  it("disables input when disabled prop is true", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={true} />);

    const input = screen.getByPlaceholderText("Type a message...");
    expect(input).toBeDisabled();
  });

  it("does not send empty messages", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "   {Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows character counter at 80% capacity", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} maxLength={100} />);

    const input = screen.getByPlaceholderText("Type a message...");
    // Type 81 characters (81% of 100)
    await user.type(input, "a".repeat(81));

    expect(screen.getByText(/81.*100/)).toBeInTheDocument();
  });
});
