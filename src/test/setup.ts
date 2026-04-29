import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke?: typeof tauriInvoke;
    };
  }
}

// Provide stable Tauri internals for tests that import @tauri-apps/api/core
const tauriInvoke = vi.fn(async () => null);

window.__TAURI_INTERNALS__ ??= {};
window.__TAURI_INTERNALS__.invoke = tauriInvoke;

// Global fallback mocks for tests that don't provide their own mocks
vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriInvoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

// Polyfills for Radix UI (required for JSDOM)
if (typeof Element.prototype.setPointerCapture === "undefined") {
  Element.prototype.setPointerCapture = vi.fn();
}
if (typeof Element.prototype.releasePointerCapture === "undefined") {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (typeof Element.prototype.hasPointerCapture === "undefined") {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = vi.fn();
}
// Radix Select/Popover uses ResizeObserver
if (typeof window.ResizeObserver === "undefined") {
  class MockResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  window.ResizeObserver = MockResizeObserver;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
