/**
 * a2ui-bridge — Bridge between gateway A2UI events and the local iframe renderer.
 *
 * Gateway sends A2UI JSONL via canvas tool events. This module:
 * 1. Receives JSONL payloads from the gateway (via tool events or direct push)
 * 2. Posts them into the A2UI iframe via postMessage
 * 3. Receives user actions from the iframe and forwards to a callback
 */

/** Message sent INTO the A2UI iframe */
export interface A2UIInboundMessage {
  type: "a2ui:push" | "a2ui:reset";
  /** JSONL string for push, undefined for reset */
  jsonl?: string;
}

/** Message received FROM the A2UI iframe (user action) */
export interface A2UIOutboundMessage {
  type: "a2ui:action";
  userAction: {
    id: string;
    [key: string]: unknown;
  };
}

/**
 * Tauri-compatible bridge script injected into the A2UI iframe.
 * Replaces the iOS/Android native bridge with window.parent.postMessage.
 */
export function buildTauriBridgeScript(): string {
  return `
<script>
(() => {
  // Tauri desktop bridge — replaces iOS/Android native message handlers.
  // Routes EdwinPAI.postMessage and EdwinPAI.sendUserAction through parent postMessage.
  function postToNode(payload) {
    try {
      const data = typeof payload === "string" ? JSON.parse(payload) : payload;
      window.parent.postMessage({ type: "a2ui:action", ...data }, "*");
      return true;
    } catch (e) {
      console.warn("[a2ui-bridge] postToNode error:", e);
      return false;
    }
  }

  function sendUserAction(userAction) {
    const id =
      (userAction && typeof userAction.id === "string" && userAction.id.trim()) ||
      (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const action = { ...userAction, id };
    window.parent.postMessage({ type: "a2ui:action", userAction: action }, "*");
    return true;
  }

  globalThis.EdwinPAI = globalThis.EdwinPAI ?? {};
  globalThis.EdwinPAI.postMessage = postToNode;
  globalThis.EdwinPAI.sendUserAction = sendUserAction;
  globalThis.edwinpaiPostMessage = postToNode;
  globalThis.edwinpaiSendUserAction = sendUserAction;

  // Listen for inbound A2UI commands from the parent frame
  window.addEventListener("message", (ev) => {
    if (!ev.data || typeof ev.data !== "object") return;
    const { type, jsonl } = ev.data;
    if (type === "a2ui:push" && typeof jsonl === "string") {
      // Push JSONL to the A2UI host element
      const host = document.querySelector("openclaw-a2ui-host");
      if (host && typeof host.pushJsonl === "function") {
        host.pushJsonl(jsonl);
      }
    } else if (type === "a2ui:reset") {
      const host = document.querySelector("openclaw-a2ui-host");
      if (host && typeof host.reset === "function") {
        host.reset();
      }
    }
  });
})();
</script>`;
}

/**
 * Inject the Tauri bridge script into A2UI HTML, replacing the original
 * iOS/Android bridge that the core server would inject.
 */
export function injectTauriBridge(html: string): string {
  const snippet = buildTauriBridgeScript().trim();
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx >= 0) {
    return `${html.slice(0, idx)}\n${snippet}\n${html.slice(idx)}`;
  }
  return `${html}\n${snippet}\n`;
}

/**
 * Post an A2UI JSONL push command to the iframe.
 */
export function pushJsonlToFrame(
  iframe: HTMLIFrameElement,
  jsonl: string,
): void {
  iframe.contentWindow?.postMessage(
    { type: "a2ui:push", jsonl } satisfies A2UIInboundMessage,
    "*",
  );
}

/**
 * Post an A2UI reset command to the iframe.
 */
export function resetFrame(iframe: HTMLIFrameElement): void {
  iframe.contentWindow?.postMessage(
    { type: "a2ui:reset" } satisfies A2UIInboundMessage,
    "*",
  );
}
