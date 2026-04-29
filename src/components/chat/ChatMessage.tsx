/**
 * ChatMessage - Message display with streaming support
 *
 * Displays individual chat messages with:
 * - Role-based styling (user vs assistant)
 * - Streaming animation (cursor/typing indicator)
 * - Timestamp
 * - Copy button for assistant messages
 */

import { useState, memo } from 'react';
import { Copy, Check, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UrlTransform } from 'react-markdown';

import type { ChatMessage as ChatMessageType } from '@/types/chat';
import type { ToolSource } from '@/hooks/useWebSocketChat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CodeBlock } from '@/components/chat/CodeBlock';

interface ChatMessageProps {
  message: ChatMessageType & { sources?: ToolSource[] };
  isStreaming?: boolean;
}

const allowImageDataUrl: UrlTransform = (url) => {
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
};

// Memoized with custom comparison to prevent unnecessary re-renders
export const ChatMessage = memo(function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const sources = isAssistant && Array.isArray(message.sources) ? message.sources : [];
  const hasSources = sources.length > 0;

  // Extract text content (handle both string and multimodal)
  const textContent =
    typeof message.content === 'string'
      ? message.content
      : message.content
          .filter((part) => part.type === 'text')
          .map((part) => (part.type === 'text' ? part.text : ''))
          .join('');

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Copy message content
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className={cn(
        'flex w-full gap-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'group relative max-w-[80%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
          isStreaming && 'animate-pulse'
        )}
      >
        {/* Message content (Markdown) */}
        <div
          className={cn(
            'prose prose-sm max-w-none break-words dark:prose-invert',
            'prose-p:my-2 prose-pre:my-2 prose-pre:bg-background/70 prose-pre:border prose-pre:border-border',
            'prose-code:bg-slate-200 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-slate-300 dark:prose-code:border-slate-700',
            'prose-code:text-slate-900 dark:prose-code:text-slate-100 prose-code:font-semibold',
            'prose-a:text-blue-700 dark:prose-a:text-blue-200 prose-a:font-medium'
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            urlTransform={allowImageDataUrl}
            components={{
              code: ({ className, children, ...props }) => {
                const lang = /language-(\w+)/.exec(className || "")?.[1];
                if (lang) {
                  return <CodeBlock language={lang}>{String(children ?? "")}</CodeBlock>;
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => <>{children}</>,
              img: ({ ...props }) => (
                <img {...props} className="max-h-80 w-auto rounded-md border border-border" loading="lazy" />
              ),
            }}
          >
            {textContent}
          </ReactMarkdown>
          {isStreaming && (
            <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-current" />
          )}
        </div>

        {/* Timestamp */}
        <div
          className={cn(
            'mt-1 text-xs opacity-70',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {formatTime(message.timestamp)}
        </div>

        {/* Copy button (assistant messages only) */}
        {isAssistant && !isStreaming && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="absolute -right-2 -top-2 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
            title="Copy message"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}

        {/* Memory sources citation */}
        {hasSources && !isStreaming && (
          <div className="mt-2 border-t border-border/50 pt-2">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              <span><BookOpen className="h-3 w-3 inline mr-1" />{sources.length} source{sources.length !== 1 ? 's' : ''} used</span>
              {sourcesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {sourcesOpen && (
              <div className="mt-1 space-y-1">
                {sources.map((src, i) => (
                  <div key={i} className="text-xs text-muted-foreground bg-background/50 rounded px-2 py-1">
                    <span className="font-mono">{src.path}</span>
                    {src.startLine && src.endLine && (
                      <span className="ml-1 opacity-70">:{src.startLine}-{src.endLine}</span>
                    )}
                    {src.score != null && (
                      <span className="ml-2 opacity-50">({(src.score * 100).toFixed(0)}%)</span>
                    )}
                    {src.snippet && (
                      <p className="mt-0.5 opacity-60 line-clamp-2">{src.snippet}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if message content, timestamp, or streaming state changes
  return (
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.timestamp === nextProps.message.timestamp &&
    prevProps.isStreaming === nextProps.isStreaming
  );
});
