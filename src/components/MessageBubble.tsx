import { createPortal } from "react-dom";
import { useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import type { UrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, RotateCcw, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeMessageContent } from "@/lib/messageContent";
import { ToolUseList } from "@/components/chat/ToolUseCard";
import { CodeBlock } from "@/components/chat/CodeBlock";
import type { ChatMessage } from "@/types/api";

/** Full-screen image lightbox overlay */
function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white z-[9999]"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/** Position within a group of consecutive same-role messages */
export type GroupPosition = "solo" | "first" | "middle" | "last";

interface MessageBubbleProps {
  message: ChatMessage;
  timestamp?: string;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  isStreaming?: boolean;
  /** Position within a group of consecutive same-role messages */
  groupPosition?: GroupPosition;
}

function attachmentDataUrl(attachment: { mimeType: string; content: string }) {
  if (attachment.content.startsWith("data:")) return attachment.content;
  return `data:${attachment.mimeType};base64,${attachment.content}`;
}

const allowImageDataUrl: UrlTransform = (url) => {
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
};

export function MessageBubble({
  message,
  timestamp,
  onRetry,
  onEdit,
  onDelete,
  isStreaming,
  groupPosition = "solo",
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";

  const showHeader = groupPosition === "solo" || groupPosition === "first";
  const isGrouped = groupPosition === "middle" || groupPosition === "last";

  // Defensive normalization: type says string but the gateway can deliver
  // multimodal content blocks (array of {type, text} parts). Passing a non-string
  // to <ReactMarkdown> throws "Unexpected value [object Object] for children".
  const textContent = normalizeMessageContent(message.content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  return (
    <div
      className={cn(
        "group flex w-full gap-3 px-4",
        isGrouped ? "py-0.5" : "py-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 space-y-1.5",
          isUser
            ? "bg-blue-200 text-gray-900 dark:bg-blue-300/40 dark:text-gray-900 rounded-br-sm"
            : isSystem
              ? "bg-accent/30 text-foreground rounded-bl-sm"
              : "bg-muted text-foreground rounded-bl-sm",
          isGrouped && isUser && "rounded-tr-sm",
          isGrouped && !isUser && "rounded-tl-sm",
        )}
      >
        {/* Header: Role label + timestamp (only shown for first/solo in group) */}
        {showHeader && (
          <div
            className={cn(
              "flex items-center gap-2 text-xs",
              isUser
                ? "text-gray-900 dark:text-gray-300 justify-end"
                : "text-muted-foreground",
            )}
          >
            <span className="font-medium capitalize">{message.role}</span>
            {timestamp && <span>{timestamp}</span>}
          </div>
        )}

        {/* Message content with markdown rendering */}
        <div
          className={cn(
            "prose prose-sm max-w-none",
            isUser ? "dark:prose-invert prose-gray-900" : "dark:prose-invert",
            "prose-p:leading-relaxed prose-p:my-1 prose-pre:bg-background/30 prose-pre:border prose-pre:border-border/50",
            "prose-code:before:content-[''] prose-code:after:content-['']",
            "prose-code:bg-slate-200 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:border prose-code:border-slate-300 dark:prose-code:border-slate-700",
            "prose-code:text-slate-900 dark:prose-code:text-slate-100 prose-code:font-semibold",
            "prose-a:text-blue-700 dark:prose-a:text-blue-200 prose-a:font-medium",
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            urlTransform={allowImageDataUrl}
            components={{
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || "");
                const lang = match?.[1];
                if (lang) {
                  const code = String(children ?? "");
                  return <CodeBlock language={lang}>{code}</CodeBlock>;
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              // Prevent react-markdown from wrapping CodeBlock in an extra <pre>
              pre: ({ children }) => <>{children}</>,
              img: ({ src, alt, ...props }) => (
                <div className="min-h-[80px] max-h-80 w-fit">
                  <img
                    src={src}
                    alt={alt}
                    {...props}
                    className="max-h-80 w-auto rounded-md border border-border cursor-zoom-in hover:opacity-90 transition-opacity"
                    onClick={() => src && setLightboxSrc(src)}
                  />
                </div>
              ),
            }}
          >
            {textContent}
          </ReactMarkdown>
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-2">
            {message.attachments.map((attachment, index) => {
              const isImage = attachment.mimeType.startsWith("image/");
              const key = `${attachment.fileName}-${index}`;
              if (isImage) {
                const src = attachmentDataUrl(attachment);
                return (
                  <button
                    key={key}
                    type="button"
                    className="block max-w-full overflow-hidden rounded-lg border border-border bg-background/40 p-0 text-left"
                    onClick={() => setLightboxSrc(src)}
                    aria-label={`Open ${attachment.fileName}`}
                  >
                    <img
                      src={src}
                      alt={attachment.fileName}
                      className="max-h-80 max-w-full object-contain"
                    />
                  </button>
                );
              }
              return (
                <div
                  key={key}
                  className="rounded-md border border-border bg-background/40 px-2 py-1 text-xs"
                >
                  {attachment.fileName}
                </div>
              );
            })}
          </div>
        )}

        {!isUser && message.tool_use && message.tool_use.length > 0 && (
          <div className="pt-1">
            <ToolUseList toolUses={message.tool_use} />
          </div>
        )}

        {/* Message actions (visible on hover) */}
        {!isStreaming && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mb-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              aria-label="Copy"
              className="h-6 w-6"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            {isAssistant && onRetry && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRetry}
                aria-label="Retry"
                title="Retry"
                className="h-6 w-6"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
            {isUser && onEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(textContent)}
                aria-label="Edit"
                title="Edit"
                className="h-6 w-6"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn("h-6 w-6", confirmDelete && "text-destructive")}
                onClick={() => {
                  if (confirmDelete) {
                    onDelete();
                    setConfirmDelete(false);
                  } else {
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 3000);
                  }
                }}
                aria-label="Delete"
                title={confirmDelete ? "Click again to confirm" : "Delete"}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
      {lightboxSrc &&
        createPortal(
          <ImageLightbox
            src={lightboxSrc}
            onClose={() => setLightboxSrc(null)}
          />,
          document.body,
        )}
    </div>
  );
}
