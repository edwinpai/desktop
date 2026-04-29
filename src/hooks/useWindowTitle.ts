/**
 * useWindowTitle Hook - Group G Implementation
 *
 * Manages dynamic window titles via Tauri API.
 * Updates native window title and browser document.title.
 */

import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface UseWindowTitleOptions {
  /**
   * Base title (app name)
   */
  base?: string;

  /**
   * Separator between base and page title
   */
  separator?: string;

  /**
   * Update native window title (Tauri)
   */
  updateNative?: boolean;
}

/**
 * Hook for managing window title
 *
 * @example
 * ```tsx
 * useWindowTitle("Settings"); // => "Settings | EdwinPAI"
 * useWindowTitle("Chat with Alice", { base: "EdwinPAI Desktop" });
 * ```
 */
export function useWindowTitle(
  title: string | null,
  options: UseWindowTitleOptions = {}
) {
  const {
    base = "EdwinPAI",
    separator = " | ",
    updateNative = true,
  } = options;

  useEffect(() => {
    const fullTitle = title ? `${title}${separator}${base}` : base;

    // Update document title (always)
    document.title = fullTitle;

    // Update native window title (Tauri)
    if (updateNative) {
      const window = getCurrentWindow();
      window
        .setTitle(fullTitle)
        .catch((error: unknown) => console.error("Failed to set window title:", error));
    }

    // Cleanup: reset to base title on unmount
    return () => {
      if (!title) return; // Don't reset if already at base
      document.title = base;
      if (updateNative) {
        const window = getCurrentWindow();
        window
          .setTitle(base)
          .catch((error: unknown) => console.error("Failed to reset window title:", error));
      }
    };
  }, [title, base, separator, updateNative]);
}

/**
 * Build a formatted title string
 *
 * @example
 * ```tsx
 * formatTitle("Settings", "EdwinPAI"); // => "Settings | EdwinPAI"
 * formatTitle(null, "EdwinPAI"); // => "EdwinPAI"
 * ```
 */
export function formatTitle(
  page: string | null,
  base: string = "EdwinPAI",
  separator: string = " | "
): string {
  return page ? `${page}${separator}${base}` : base;
}
