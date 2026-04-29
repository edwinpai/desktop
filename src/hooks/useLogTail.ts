/**
 * useLogTail — Poll gateway logs.tail for live log tailing.
 *
 * Uses cursor-based pagination to fetch new log lines incrementally.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  callGatewayMethod,
  resolveToken,
  inferGatewayKind,
  type GatewayTarget,
} from '@/lib/gateway-context';
import { readConfig } from '@/lib/config';

export interface LogLine {
  raw: string;
  level?: string;
  timestamp?: string;
  message?: string;
  parsed: boolean;
}

interface LogTailResult {
  file: string;
  cursor: number;
  size: number;
  lines: string[];
  truncated: boolean;
  reset: boolean;
}

export interface UseLogTailOpts {
  /** Polling interval in ms (default 2000) */
  intervalMs?: number;
  /** Max lines to keep in buffer */
  maxLines?: number;
  /** Initial limit per request */
  limit?: number;
}

export function useLogTail({
  intervalMs = 2000,
  maxLines = 2000,
  limit = 200,
}: UseLogTailOpts = {}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logFile, setLogFile] = useState<string | null>(null);
  const cursorRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetRef = useRef<GatewayTarget | null>(null);

  const buildTarget = useCallback(async (): Promise<GatewayTarget> => {
    const cfg = await readConfig();
    const url = cfg.gatewayUrl || 'http://localhost:18789';
    const token = cfg.gatewayToken || (await resolveToken());
    return { url, token: token || undefined, kind: inferGatewayKind(url) };
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      if (!targetRef.current) {
        targetRef.current = await buildTarget();
      }
      const result = (await callGatewayMethod(
        targetRef.current,
        'logs.tail',
        { cursor: cursorRef.current, limit },
        10_000,
        'logs.tail timed out',
      )) as LogTailResult;

      if (result.reset) {
        cursorRef.current = 0;
        setLines([]);
      }

      if (result.lines.length > 0) {
        cursorRef.current = result.cursor;
        setLogFile(result.file);

        const newLines: LogLine[] = result.lines.map(parseLogLine);
        setLines((prev) => {
          const combined = [...prev, ...newLines];
          return combined.length > maxLines
            ? combined.slice(combined.length - maxLines)
            : combined;
        });
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [buildTarget, limit, maxLines]);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    setIsPolling(true);
    fetchLogs();
    intervalRef.current = setInterval(fetchLogs, intervalMs);
  }, [fetchLogs, intervalMs]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    cursorRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { lines, isPolling, error, logFile, start, stop, clear };
}

function parseLogLine(raw: string): LogLine {
  try {
    const obj = JSON.parse(raw);
    return {
      raw,
      level: obj.level ?? obj.lvl,
      timestamp: obj.time ?? obj.timestamp ?? obj.ts,
      message: obj.msg ?? obj.message,
      parsed: true,
    };
  } catch {
    // Not JSON — extract level from common patterns
    const levelMatch = raw.match(/\b(DEBUG|INFO|WARN|ERROR|FATAL)\b/i);
    return {
      raw,
      level: levelMatch?.[1]?.toUpperCase(),
      message: raw,
      parsed: false,
    };
  }
}
