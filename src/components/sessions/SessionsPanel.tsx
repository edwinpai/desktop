import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Trash2, RotateCcw } from "lucide-react";

interface Session {
  key: string;
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  model?: string;
}

interface SessionsPanelProps {
  sessions: Session[];
  currentSessionKey: string;
  onSelectSession?: (key: string) => void;
  onNewSession?: () => void;
  onResetSession?: (key: string) => void;
  onDeleteSession?: (key: string) => void;
}

function getSessionTitle(session: Session): string {
  return (
    session.displayName ||
    session.label ||
    session.derivedTitle ||
    session.key
  );
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function SessionsPanel({
  sessions,
  currentSessionKey,
  onSelectSession,
  onNewSession,
  onResetSession,
  onDeleteSession,
}: SessionsPanelProps) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return sessions;
    const lower = filter.toLowerCase();
    return sessions.filter((s) => {
      const title = getSessionTitle(s).toLowerCase();
      const preview = (s.lastMessagePreview ?? "").toLowerCase();
      return title.includes(lower) || preview.includes(lower);
    });
  }, [sessions, filter]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 space-y-3 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <Button size="sm" onClick={onNewSession}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {sessions.length === 0
                ? "No sessions yet"
                : "No sessions match your search"}
            </div>
          )}

          {filtered.map((session) => {
            const isActive = session.key === currentSessionKey;
            const title = getSessionTitle(session);

            return (
              <div
                key={session.key}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession?.(session.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSession?.(session.key);
                  }
                }}
                className={`group relative flex flex-col gap-1 rounded-md px-3 py-2.5 cursor-pointer transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r" />
                )}

                {/* Title row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {title}
                  </span>

                  {/* Action buttons - visible on hover / always on active */}
                  <div
                    className={`flex items-center gap-0.5 shrink-0 ${
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    } transition-opacity`}
                  >
                    {onResetSession && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResetSession(session.key);
                        }}
                        title="Reset session"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                    {onDeleteSession && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.key);
                        }}
                        title="Delete session"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Preview */}
                {session.lastMessagePreview && (
                  <span className="text-xs text-muted-foreground truncate">
                    {truncate(session.lastMessagePreview, 80)}
                  </span>
                )}

                {/* Model badge */}
                {session.model && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {session.model}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
