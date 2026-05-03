import {
  useState,
  KeyboardEvent,
  ClipboardEvent,
  ChangeEvent,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Send, Square, Paperclip, X, FileText, Image } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SlashCommandMenu,
  type SlashCommand,
} from "@/components/chat/SlashCommandMenu";

export interface InputAttachment {
  type?: string;
  mimeType: string;
  fileName: string;
  content: string;
}

export interface ChatDraft {
  value: string;
  attachments: InputAttachment[];
}

const DRAFT_PERSIST_DEBOUNCE_MS = 300;
const getDraftStorageKey = (sessionKey?: string) =>
  sessionKey ? `edwinpai:chat:draft:${sessionKey}` : null;

interface InputBarProps {
  onSendMessage: (
    message: string,
    opts?: { attachments?: InputAttachment[] },
  ) => void;
  onAbortRun?: () => void;
  onSlashCommand?: (command: string, args: string) => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  sessionKey?: string;
  draft?: ChatDraft;
  onDraftChange?: (draft: ChatDraft) => void;
}

export function InputBar({
  onSendMessage,
  onAbortRun,
  onSlashCommand,
  isStreaming = false,
  disabled: _disabled = false,
  placeholder = "Type a message... (! for shell commands, / for slash commands)",
  maxLength = 4000,
  sessionKey,
  draft,
  onDraftChange,
}: InputBarProps) {
  void _disabled; // kept for API compat; input is always enabled now
  const draftStorageKey = getDraftStorageKey(sessionKey);
  const [value, setValue] = useState(() => {
    if (typeof draft?.value === "string") return draft.value;
    if (draftStorageKey && typeof window !== "undefined") {
      return window.localStorage.getItem(draftStorageKey) ?? "";
    }
    return "";
  });
  const [attachments, setAttachments] = useState<InputAttachment[]>(
    () => draft?.attachments ?? [],
  );
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestDraftRef = useRef<ChatDraft>({ value, attachments });

  useEffect(() => {
    latestDraftRef.current = { value, attachments };
  }, [attachments, value]);

  const persistTextDraft = useCallback(
    (nextValue: string) => {
      if (!draftStorageKey || typeof window === "undefined") return;
      if (nextValue) {
        window.localStorage.setItem(draftStorageKey, nextValue);
      } else {
        window.localStorage.removeItem(draftStorageKey);
      }
    },
    [draftStorageKey],
  );

  const flushDraft = useCallback(
    (nextDraft: ChatDraft) => {
      persistTextDraft(nextDraft.value);
      onDraftChange?.(nextDraft);
    },
    [onDraftChange, persistTextDraft],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextValue =
        typeof draft?.value === "string"
          ? draft.value
          : draftStorageKey && typeof window !== "undefined"
            ? (window.localStorage.getItem(draftStorageKey) ?? "")
            : "";
      const nextAttachments = draft?.attachments ?? [];
      setValue((prev) => (prev === nextValue ? prev : nextValue));
      setAttachments((prev) => {
        const sameLength = prev.length === nextAttachments.length;
        const sameItems =
          sameLength &&
          prev.every((item, index) => {
            const next = nextAttachments[index];
            return (
              next &&
              item.type === next.type &&
              item.mimeType === next.mimeType &&
              item.fileName === next.fileName &&
              item.content === next.content
            );
          });
        return sameItems ? prev : nextAttachments;
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [draftStorageKey, draft]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      persistTextDraft(value);
    }, DRAFT_PERSIST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [persistTextDraft, value]);

  useEffect(() => {
    return () => {
      flushDraft(latestDraftRef.current);
    };
  }, [flushDraft]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      setValue(newValue);
      // Show slash command menu when typing "/" at start of input
      if (newValue.startsWith("/") && !newValue.includes("\n")) {
        setShowSlashMenu(true);
        setSlashQuery(newValue);
      } else {
        setShowSlashMenu(false);
      }
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    await addFilesAsAttachments(files);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue && attachments.length === 0) return;

    // Intercept shell commands (! prefix)
    if (trimmedValue.startsWith("!") && onSlashCommand) {
      const shellCmd = trimmedValue.slice(1).trim();
      if (shellCmd) {
        onSlashCommand("shell", shellCmd);
        setValue("");
        setAttachments([]);
        flushDraft({ value: "", attachments: [] });
        setShowSlashMenu(false);
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        return;
      }
    }

    // Intercept slash commands
    if (trimmedValue.startsWith("/") && onSlashCommand) {
      const spaceIdx = trimmedValue.indexOf(" ");
      const command =
        spaceIdx === -1 ? trimmedValue : trimmedValue.slice(0, spaceIdx);
      const args =
        spaceIdx === -1 ? "" : trimmedValue.slice(spaceIdx + 1).trim();
      onSlashCommand(command, args);
      setValue("");
      setAttachments([]);
      flushDraft({ value: "", attachments: [] });
      setShowSlashMenu(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      return;
    }

    onSendMessage(trimmedValue, { attachments });
    setValue("");
    setAttachments([]);
    flushDraft({ value: "", attachments: [] });
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const addFilesAsAttachments = async (files: File[]) => {
    const validFiles = files.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File "${file.name}" exceeds 10 MB limit, skipping`);
        return false;
      }
      return true;
    });

    const selected = await Promise.all(
      validFiles.map(
        (file) =>
          new Promise<InputAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = String(reader.result ?? "");
              const base64 = result.includes(",")
                ? (result.split(",")[1] ?? "")
                : result;
              const isImage = file.type.startsWith("image/");
              resolve({
                type: isImage ? "image" : "file",
                mimeType: file.type || "application/octet-stream",
                fileName: file.name,
                content: base64,
              });
            };
            reader.onerror = () =>
              reject(reader.error ?? new Error("Failed to read file"));
            reader.readAsDataURL(file);
          }),
      ),
    );

    if (selected.length > 0) {
      setAttachments((prev) => [...prev, ...selected]);
    }
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    setValue(cmd.name + " ");
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Let SlashCommandMenu handle navigation when visible
    if (
      showSlashMenu &&
      (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab")
    ) {
      return; // SlashCommandMenu captures these via window listener
    }
    // Escape closes slash menu or aborts run
    if (e.key === "Escape") {
      if (showSlashMenu) {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
      if (isStreaming && onAbortRun) {
        e.preventDefault();
        onAbortRun();
        return;
      }
    }
    // Enter without Shift sends the message
    if (e.key === "Enter" && !e.shiftKey) {
      if (showSlashMenu) return; // SlashCommandMenu handles Enter
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const pastedFiles = items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);

    if (pastedFiles.length > 0) {
      e.preventDefault();
      await addFilesAsAttachments(pastedFiles);
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const charCount = value.length;
  const isNearLimit = charCount > maxLength * 0.9;
  const isAtLimit = charCount >= maxLength;

  return (
    <div className="border-t bg-background p-4">
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={false}
          aria-label="Attach files"
          title="Attach files"
          className="h-[60px] w-[60px]"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <div className="flex-1 relative">
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
            visible={showSlashMenu}
          />
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={false}
            className={cn(
              "min-h-[60px] max-h-[200px] resize-none",
              "focus-visible:ring-2",
            )}
            rows={1}
          />
          {/* Character count indicator */}
          {(isNearLimit || isAtLimit) && (
            <div
              className={cn(
                "absolute bottom-2 right-2 text-xs",
                isAtLimit ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {charCount}/{maxLength}
            </div>
          )}
        </div>

        {isStreaming && onAbortRun && (
          <Button
            onClick={onAbortRun}
            variant="destructive"
            size="icon"
            aria-label="Abort run (Esc)"
            title="Stop (Esc)"
            className="h-[60px] w-[60px]"
          >
            <Square className="h-5 w-5" />
          </Button>
        )}
        {(!isStreaming || value.trim() || attachments.length > 0) && (
          <Button
            onClick={handleSend}
            disabled={!value.trim() && attachments.length === 0}
            size="icon"
            aria-label="Send message"
            className="h-[60px] w-[60px]"
          >
            <Send className="h-5 w-5" />
          </Button>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={`${attachment.fileName}-${index}`}
              className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs bg-muted/40"
            >
              {attachment.mimeType.startsWith("image/") ? (
                <Image className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="max-w-[220px] truncate">
                {attachment.fileName}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${attachment.fileName}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      <div className="mt-1 text-xs text-muted-foreground">
        Press <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> to send,{" "}
        <kbd className="px-1 py-0.5 bg-muted rounded">Shift+Enter</kbd> for new
        line
        {isStreaming && (
          <>
            , <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> to stop
          </>
        )}
      </div>
    </div>
  );
}
