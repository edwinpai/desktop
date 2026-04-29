/**
 * LogViewer — Live tail of gateway log files.
 *
 * Displays log lines in a scrollable monospace pane with auto-scroll,
 * pause/resume, and level filtering.
 */

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StyledSelect } from '@/components/ui/styled-select';
import { useLogTail, type LogLine } from '@/hooks/useLogTail';
import { cn } from '@/lib/utils';

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-gray-400',
  INFO: 'text-blue-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  FATAL: 'text-red-600 font-bold',
};

export function LogViewer() {
  const { lines, isPolling, error, logFile, start, stop, clear } = useLogTail();
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start polling on mount
  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const filteredLines = levelFilter === 'all'
    ? lines
    : lines.filter((l) => l.level === levelFilter);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Logs</h2>
          {logFile && (
            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
              {logFile}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StyledSelect
            className="h-7 text-xs"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="all">All levels</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </StyledSelect>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => isPolling ? stop() : start()}
            className="h-7"
          >
            {isPolling ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span className="ml-1 text-xs">{isPolling ? 'Pause' : 'Resume'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={clear} className="h-7">
            <Trash2 className="h-3 w-3" />
            <span className="ml-1 text-xs">Clear</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-b">
          {error}
        </div>
      )}

      {/* Log lines */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-black/95 font-mono text-xs leading-5 p-2"
      >
        {filteredLines.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {isPolling ? 'Waiting for log lines...' : 'Log viewer paused. Click Resume to start.'}
          </div>
        ) : (
          filteredLines.map((line, i) => (
            <LogLineRow key={i} line={line} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1 border-t bg-background text-xs text-muted-foreground flex items-center justify-between">
        <span>{filteredLines.length} lines{levelFilter !== 'all' ? ` (filtered from ${lines.length})` : ''}</span>
        <span>{autoScroll ? 'Auto-scroll on' : 'Auto-scroll off (scroll to bottom to re-enable)'}</span>
      </div>
    </div>
  );
}

function LogLineRow({ line }: { line: LogLine }) {
  const levelColor = line.level ? LEVEL_COLORS[line.level] ?? 'text-gray-300' : 'text-gray-300';

  if (!line.parsed) {
    return <div className="text-gray-300 whitespace-pre-wrap break-all">{line.raw}</div>;
  }

  return (
    <div className="whitespace-pre-wrap break-all hover:bg-white/5">
      {line.timestamp && (
        <span className="text-gray-500">{formatTimestamp(line.timestamp)} </span>
      )}
      {line.level && (
        <span className={cn('font-semibold', levelColor)}>
          {line.level.padEnd(5)} </span>
      )}
      <span className="text-gray-200">{line.message}</span>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    return date.toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
  } catch {
    return ts;
  }
}
