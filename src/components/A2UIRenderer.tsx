/**
 * A2UIRenderer — Local iframe-based A2UI rendering surface.
 *
 * Loads the A2UI bundle from public/a2ui/index.html with the Tauri bridge
 * injected. Accepts JSONL push/reset commands and forwards user actions
 * back to the parent via callback.
 */

import { useEffect, useRef, useCallback } from "react";
import {
  pushJsonlToFrame,
  resetFrame,
  type A2UIOutboundMessage,
} from "@/lib/a2ui-bridge";

interface A2UIRendererProps {
  /** JSONL string to push into the A2UI surface */
  jsonl?: string | null;
  /** Increment to trigger a reset */
  resetKey?: number;
  /** Called when the A2UI surface emits a user action */
  onUserAction?: (action: Record<string, unknown>) => void;
  className?: string;
}

export function A2UIRenderer({
  jsonl,
  resetKey = 0,
  onUserAction,
  className = "",
}: A2UIRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef(false);
  const pendingJsonlRef = useRef<string | null>(null);

  // Listen for user action messages from the iframe
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== "object") return;
      const msg = ev.data as A2UIOutboundMessage;
      if (msg.type === "a2ui:action" && msg.userAction) {
        onUserAction?.(msg.userAction);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onUserAction]);

  // Handle iframe load — flush any pending JSONL
  const handleLoad = useCallback(() => {
    loadedRef.current = true;
    if (pendingJsonlRef.current && iframeRef.current) {
      pushJsonlToFrame(iframeRef.current, pendingJsonlRef.current);
      pendingJsonlRef.current = null;
    }
  }, []);

  // Push JSONL when it changes
  useEffect(() => {
    if (!jsonl) return;
    if (loadedRef.current && iframeRef.current) {
      pushJsonlToFrame(iframeRef.current, jsonl);
    } else {
      pendingJsonlRef.current = jsonl;
    }
  }, [jsonl]);

  // Reset when resetKey changes
  useEffect(() => {
    if (resetKey > 0 && loadedRef.current && iframeRef.current) {
      resetFrame(iframeRef.current);
    }
  }, [resetKey]);

  return (
    <iframe
      ref={iframeRef}
      src="/a2ui/index.html"
      onLoad={handleLoad}
      sandbox="allow-scripts allow-same-origin"
      className={`w-full h-full border-0 ${className}`}
      title="A2UI Canvas"
    />
  );
}
