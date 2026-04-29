/**
 * useKeyboardShortcuts Hook Tests - Group F
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useKeyboardShortcuts, KeyboardShortcutPresets } from "./useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any event listeners
    window.removeEventListener("keydown", () => {});
  });

  it("calls handler on matching key press", () => {
    const handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts([
        {
          key: "Enter",
          ctrl: true,
          handler,
        },
      ])
    );

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      ctrlKey: true,
    });

    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("does not call handler on non-matching key", () => {
    const handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts([
        {
          key: "Enter",
          ctrl: true,
          handler,
        },
      ])
    );

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      ctrlKey: false, // Missing ctrl modifier
    });

    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("handles multiple shortcuts", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts([
        { key: "Enter", ctrl: true, handler: handler1 },
        { key: "Escape", handler: handler2 },
      ])
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }));
    expect(handler1).toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler2).toHaveBeenCalled();
  });

  it("respects enabled option", () => {
    const handler = vi.fn();

    const { rerender } = renderHook(
      ({ enabled }) =>
        useKeyboardShortcuts(
          [{ key: "Enter", handler }],
          { enabled }
        ),
      { initialProps: { enabled: false } }
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(handler).not.toHaveBeenCalled();

    rerender({ enabled: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(handler).toHaveBeenCalled();
  });

  it("prevents default when preventDefault is true", () => {
    const handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts(
        [{ key: "s", ctrl: true, handler }],
        { preventDefault: true }
      )
    );

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("does not prevent default when preventDefault is false", () => {
    const handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts(
        [{ key: "s", ctrl: true, handler }],
        { preventDefault: false }
      )
    );

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it("matches keys case-insensitively", () => {
    const handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts([{ key: "k", ctrl: true, handler }])
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "K", ctrlKey: true }));
    expect(handler).toHaveBeenCalled();
  });

  it("supports shift modifier", () => {
    const handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts([
        { key: "Tab", shift: true, handler },
      ])
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
    expect(handler).toHaveBeenCalled();
  });

  it("supports alt modifier", () => {
    const handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts([
        { key: "F", alt: true, handler },
      ])
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F", altKey: true }));
    expect(handler).toHaveBeenCalled();
  });

  it("supports meta modifier", () => {
    const handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts([
        { key: "k", meta: true, handler },
      ])
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    expect(handler).toHaveBeenCalled();
  });

  describe("KeyboardShortcutPresets", () => {
    it("creates submit preset (Ctrl+Enter)", () => {
      const handler = vi.fn();
      const shortcut = KeyboardShortcutPresets.submit(handler);

      expect(shortcut.key).toBe("Enter");
      expect(shortcut.ctrl).toBe(true);

      renderHook(() => useKeyboardShortcuts([shortcut]));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }));
      expect(handler).toHaveBeenCalled();
    });

    it("creates close preset (Escape)", () => {
      const handler = vi.fn();
      const shortcut = KeyboardShortcutPresets.close(handler);

      expect(shortcut.key).toBe("Escape");

      renderHook(() => useKeyboardShortcuts([shortcut]));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(handler).toHaveBeenCalled();
    });

    it("creates save preset (Ctrl+S)", () => {
      const handler = vi.fn();
      const shortcut = KeyboardShortcutPresets.save(handler);

      expect(shortcut.key).toBe("s");
      expect(shortcut.ctrl).toBe(true);

      renderHook(() => useKeyboardShortcuts([shortcut]));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }));
      expect(handler).toHaveBeenCalled();
    });

    it("creates search preset (Ctrl+K or Cmd+K)", () => {
      const handler = vi.fn();
      const shortcuts = KeyboardShortcutPresets.search(handler);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0]?.ctrl).toBe(true);
      expect(shortcuts[1]?.meta).toBe(true);

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Test Ctrl+K
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
      expect(handler).toHaveBeenCalledTimes(1);

      // Test Cmd+K
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  it("cleans up event listeners on unmount", () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() =>
      useKeyboardShortcuts([{ key: "Enter", handler }])
    );

    unmount();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(handler).not.toHaveBeenCalled();
  });
});
