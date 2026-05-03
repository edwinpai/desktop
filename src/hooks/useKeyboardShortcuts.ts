/**
 * useKeyboardShortcuts Hook - Group F Implementation
 *
 * Manages keyboard shortcuts for accessibility (WCAG 2.1.1).
 * Supports Ctrl+Enter (submit), Escape (close), and custom shortcuts.
 */

import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: (event: KeyboardEvent) => void;
  description?: string;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

/**
 * Hook for registering keyboard shortcuts
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   {
 *     key: 'Enter',
 *     ctrl: true,
 *     handler: handleSubmit,
 *     description: 'Submit form'
 *   },
 *   {
 *     key: 'Escape',
 *     handler: handleClose,
 *     description: 'Close modal'
 *   }
 * ]);
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {},
): void {
  const {
    enabled = true,
    preventDefault = true,
    stopPropagation = false,
  } = options;
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);

  // Update shortcuts ref when they change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const matchingShortcut = shortcutsRef.current.find((shortcut) => {
        // Normalize key comparison (case-insensitive)
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        // Check modifier keys
        const ctrlMatch =
          shortcut.ctrl === undefined || shortcut.ctrl === event.ctrlKey;
        const altMatch =
          shortcut.alt === undefined || shortcut.alt === event.altKey;
        const shiftMatch =
          shortcut.shift === undefined || shortcut.shift === event.shiftKey;
        const metaMatch =
          shortcut.meta === undefined || shortcut.meta === event.metaKey;

        return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
      });

      if (matchingShortcut) {
        if (preventDefault) event.preventDefault();
        if (stopPropagation) event.stopPropagation();
        matchingShortcut.handler(event);
      }
    },
    [enabled, preventDefault, stopPropagation],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * Common keyboard shortcut presets
 */
export const KeyboardShortcutPresets = {
  /**
   * Submit action (Ctrl+Enter)
   */
  submit: (handler: () => void): KeyboardShortcut => ({
    key: "Enter",
    ctrl: true,
    handler,
    description: "Submit (Ctrl+Enter)",
  }),

  /**
   * Close/Cancel action (Escape)
   */
  close: (handler: () => void): KeyboardShortcut => ({
    key: "Escape",
    handler,
    description: "Close (Esc)",
  }),

  /**
   * Save action (Ctrl+S)
   */
  save: (handler: () => void): KeyboardShortcut => ({
    key: "s",
    ctrl: true,
    handler,
    description: "Save (Ctrl+S)",
  }),

  /**
   * Search action (Ctrl+K or Cmd+K)
   */
  search: (handler: () => void): KeyboardShortcut[] => [
    {
      key: "k",
      ctrl: true,
      handler,
      description: "Search (Ctrl+K)",
    },
    {
      key: "k",
      meta: true,
      handler,
      description: "Search (Cmd+K)",
    },
  ],

  /**
   * Navigate forward (Tab or ArrowRight)
   */
  navigateForward: (handler: () => void): KeyboardShortcut[] => [
    {
      key: "Tab",
      handler,
      description: "Next (Tab)",
    },
    {
      key: "ArrowRight",
      ctrl: true,
      handler,
      description: "Next (Ctrl+Right)",
    },
  ],

  /**
   * Navigate backward (Shift+Tab or ArrowLeft)
   */
  navigateBackward: (handler: () => void): KeyboardShortcut[] => [
    {
      key: "Tab",
      shift: true,
      handler,
      description: "Previous (Shift+Tab)",
    },
    {
      key: "ArrowLeft",
      ctrl: true,
      handler,
      description: "Previous (Ctrl+Left)",
    },
  ],
};
