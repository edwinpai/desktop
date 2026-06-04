// Coerce a chat message's `content` to a plain string for rendering, clipboard,
// and edit flows. The static types claim `content: string`, but the gateway can
// emit Anthropic-style content blocks (array of `{type, text}` parts) and the
// occasional bare object. Passing those to <ReactMarkdown> throws
// "Unexpected value [object Object] for children prop, expected string".
export function normalizeMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const text = (part as { text?: unknown }).text;
          if (typeof text === "string") return text;
        }
        return "";
      })
      .join("");
  }

  if (typeof content === "object") {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string") return text;
    try {
      return JSON.stringify(content);
    } catch {
      return "";
    }
  }

  return String(content);
}
