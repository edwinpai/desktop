export const DEFAULT_SESSION_HYDRATION_MESSAGE_LIMIT = 4;
export const SESSION_HYDRATION_MESSAGE_LIMIT_KEY =
  "edwinpai:settings:sessionHydrationMessageLimit";

export function normalizeSessionHydrationMessageLimit(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SESSION_HYDRATION_MESSAGE_LIMIT;
  return Math.max(0, Math.min(100, Math.floor(numeric)));
}

export function loadSessionHydrationMessageLimit(): number {
  try {
    const raw = localStorage.getItem(SESSION_HYDRATION_MESSAGE_LIMIT_KEY);
    if (raw === null) return DEFAULT_SESSION_HYDRATION_MESSAGE_LIMIT;
    return normalizeSessionHydrationMessageLimit(raw);
  } catch {
    return DEFAULT_SESSION_HYDRATION_MESSAGE_LIMIT;
  }
}

export function saveSessionHydrationMessageLimit(value: number): number {
  const normalized = normalizeSessionHydrationMessageLimit(value);
  localStorage.setItem(SESSION_HYDRATION_MESSAGE_LIMIT_KEY, String(normalized));
  window.dispatchEvent(
    new CustomEvent("edwinpai:settings:sessionHydrationMessageLimit", {
      detail: normalized,
    }),
  );
  return normalized;
}
