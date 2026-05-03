import { useEffect, useRef, useCallback } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { ChatMessage } from "@/types/api";

interface UseDesktopNotificationsOptions {
  enabled: boolean;
  messages: ChatMessage[];
  isConnected: boolean;
  runStatus: "idle" | "streaming" | "aborted" | "error";
}

export function useDesktopNotifications({
  enabled,
  messages,
  isConnected,
  runStatus,
}: UseDesktopNotificationsOptions) {
  const permissionRef = useRef(false);
  const prevMessageCountRef = useRef(messages.length);
  const prevConnectedRef = useRef(isConnected);
  const prevRunStatusRef = useRef(runStatus);

  // Request permission on mount if enabled
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === "granted";
      }
      permissionRef.current = granted;
    })();
  }, [enabled]);

  const notify = useCallback(
    (title: string, body: string) => {
      if (!enabled || !permissionRef.current) return;
      if (document.hasFocus()) return; // Don't notify if window is focused
      sendNotification({ title, body });
    },
    [enabled],
  );

  // Notify on new assistant message
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        const preview =
          lastMsg.content.length > 100
            ? lastMsg.content.slice(0, 100) + "..."
            : lastMsg.content;
        notify("EdwinPAI", preview);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, notify]);

  // Notify on run completion/error
  useEffect(() => {
    const prev = prevRunStatusRef.current;
    if (prev === "streaming" && runStatus === "idle") {
      notify("EdwinPAI", "Agent run completed");
    } else if (prev === "streaming" && runStatus === "error") {
      notify("EdwinPAI", "Agent run failed");
    }
    prevRunStatusRef.current = runStatus;
  }, [runStatus, notify]);

  // Notify on disconnect/reconnect
  useEffect(() => {
    const prev = prevConnectedRef.current;
    if (prev && !isConnected) {
      notify("EdwinPAI", "Disconnected from gateway");
    } else if (!prev && isConnected) {
      notify("EdwinPAI", "Reconnected to gateway");
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, notify]);
}
