export function getSessionCanvasDir(sessionKey: string): string {
  const platform = (navigator.platform || "").toLowerCase();

  if (platform.includes("mac")) {
    return `~/Library/Application Support/EdwinPAI/canvas/${sessionKey}`;
  }

  if (platform.includes("win")) {
    return `%APPDATA%\\EdwinPAI\\canvas\\${sessionKey}`;
  }

  return `~/.local/share/EdwinPAI/canvas/${sessionKey}`;
}

export function buildSnapshotOutPath(sessionKey: string): string {
  const dir = getSessionCanvasDir(sessionKey);
  return `${dir}/snapshot-${Date.now()}.png`;
}
