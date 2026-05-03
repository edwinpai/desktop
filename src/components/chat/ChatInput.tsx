/**
 * ChatInput - Message input with send button
 *
 * Features:
 * - Textarea with auto-resize
 * - Enter to send (Shift+Enter for newline)
 * - Send button with loading state
 * - Character limit indicator
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  maxLength = 4000,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    // Set height to scrollHeight (capped at max height)
    const maxHeight = 200; // ~10 lines
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (Shift+Enter for newline)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOverLimit = value.length > maxLength;
  const showCounter = value.length > maxLength * 0.8; // Show at 80% capacity

  return (
    <div className="flex flex-col gap-2">
      {/* Character counter */}
      {showCounter && (
        <div
          className={cn(
            "text-xs text-right",
            isOverLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {value.length} / {maxLength}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-colors",
          )}
          style={{
            minHeight: "40px",
            maxHeight: "200px",
          }}
        />

        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim() || isOverLimit}
          size="icon"
          className="h-10 w-10 shrink-0"
          title="Send message (Enter)"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Hint text */}
      <div className="text-xs text-muted-foreground">
        Press <kbd className="rounded border px-1">Enter</kbd> to send,{" "}
        <kbd className="rounded border px-1">Shift</kbd> +{" "}
        <kbd className="rounded border px-1">Enter</kbd> for new line
      </div>
    </div>
  );
}
