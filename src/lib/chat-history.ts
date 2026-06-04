import type { ChatMessage } from "@/hooks/useWebSocketChat";

const STORAGE_PREFIX = "edwinpai:chat:history:";
const MAX_MESSAGES = 500;

function storageKey(sessionKey: string): string {
  return `${STORAGE_PREFIX}${sessionKey}`;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.role === "user" ||
      record.role === "assistant" ||
      record.role === "system") &&
    typeof record.content === "string"
  );
}

export function loadChatHistory(sessionKey: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(sessionKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatMessage).slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export function saveChatHistory(
  sessionKey: string,
  messages: ChatMessage[],
): void {
  if (typeof window === "undefined") return;
  try {
    const bounded = messages.filter(isChatMessage).slice(-MAX_MESSAGES);
    if (bounded.length === 0) {
      window.localStorage.removeItem(storageKey(sessionKey));
      return;
    }
    window.localStorage.setItem(
      storageKey(sessionKey),
      JSON.stringify(bounded),
    );
  } catch {
    // Best-effort UI cache; gateway transcript remains source of truth.
  }
}

export function clearChatHistory(sessionKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(sessionKey));
  } catch {
    // Best effort.
  }
}

export const CHAT_HISTORY_STORAGE_PREFIX = STORAGE_PREFIX;
