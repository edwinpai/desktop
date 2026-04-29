import { useState, useEffect, useRef, useMemo } from "react";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/api";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessage[];
  onScrollToMessage: (index: number) => void;
}

interface SearchResult {
  index: number;
  role: string;
  snippet: string;
  matchStart: number;
}

export function SearchDialog({
  open,
  onOpenChange,
  messages,
  onScrollToMessage,
}: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    const matches: SearchResult[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg) continue;
      const content = msg.content;
      const matchStart = content.toLowerCase().indexOf(lower);
      if (matchStart === -1) continue;

      // Build a snippet around the match
      const snippetStart = Math.max(0, matchStart - 30);
      const snippetEnd = Math.min(content.length, matchStart + query.length + 50);
      const snippet =
        (snippetStart > 0 ? "..." : "") +
        content.slice(snippetStart, snippetEnd) +
        (snippetEnd < content.length ? "..." : "");

      matches.push({ index: i, role: msg.role, snippet, matchStart: matchStart - snippetStart + (snippetStart > 0 ? 3 : 0) });
    }
    return matches;
  }, [query, messages]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSelectedIndex(0), 0);
    return () => window.clearTimeout(timeoutId);
  }, [results]);

  // Focus input when dialog opens
  useEffect(() => {
    if (!open) return;

    const resetTimeoutId = window.setTimeout(() => setQuery(""), 0);
    const focusTimeoutId = window.setTimeout(() => inputRef.current?.focus(), 50);

    return () => {
      window.clearTimeout(resetTimeoutId);
      window.clearTimeout(focusTimeoutId);
    };
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const item = container.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      onScrollToMessage(results[selectedIndex].index);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0" onKeyDown={handleKeyDown}>
        <DialogTitle className="sr-only">Search messages</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="border-0 focus-visible:ring-0 shadow-none h-12"
          />
        </div>
        <div
          ref={resultsRef}
          className="max-h-72 overflow-y-auto"
        >
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No messages found
            </div>
          )}
          {results.map((result, i) => (
            <button
              key={result.index}
              className={cn(
                "flex w-full flex-col gap-0.5 px-4 py-2 text-left text-sm hover:bg-accent",
                i === selectedIndex && "bg-accent"
              )}
              onClick={() => {
                onScrollToMessage(result.index);
                onOpenChange(false);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="text-xs font-medium text-muted-foreground capitalize">
                {result.role}
              </span>
              <span className="text-sm line-clamp-2">{result.snippet}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
