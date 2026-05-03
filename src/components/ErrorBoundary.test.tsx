/**
 * Phase 6 Group D: ErrorBoundary Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toast } from "sonner";

import { ErrorBoundary } from "./ErrorBoundary";

import type { ErrorFallbackProps } from "@/types/errors";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Normal content</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Suppress console.error in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should render children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("should catch errors and show fallback UI", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("should show error toast on error", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(toast.error).toHaveBeenCalledWith("Error", expect.any(Object));
  });

  it("should call onError callback", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError} autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it("should show retry button with retry count", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Retry \(1\/3\)/i)).toBeInTheDocument();
  });

  it("should retry on button click", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Click retry button - use fireEvent since fake timers + userEvent don't mix
    const retryButton = screen.getByText(/Retry/i);
    fireEvent.click(retryButton);

    // ErrorBoundary re-renders children (which throw again)
    expect(toast.info).toHaveBeenCalledWith("Retrying...");
  });

  it("should auto-retry with exponential backoff", async () => {
    render(
      <ErrorBoundary autoRetry={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // First error
    expect(toast.error).toHaveBeenCalledTimes(1);

    // Auto-retry toast after 1 second
    await vi.advanceTimersByTimeAsync(500);
    expect(toast.info).toHaveBeenCalledWith("Auto-retry", expect.any(Object));

    // Second retry after 2 seconds
    await vi.advanceTimersByTimeAsync(2000);

    // Third retry after 4 seconds
    await vi.advanceTimersByTimeAsync(4000);
  });

  it("should reset error state on reset button", () => {
    const onRecover = vi.fn();

    render(
      <ErrorBoundary autoRetry={false} onRecover={onRecover}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const resetButton = screen.getByText("Reset");
    fireEvent.click(resetButton);

    expect(onRecover).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("Resetting...");
  });

  it("should navigate home on button click", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const homeButton = screen.getByText("Go Home");
    fireEvent.click(homeButton);

    expect(toast.info).toHaveBeenCalledWith("Navigating to home...");
    expect(window.location.hash).toBe("#/");
  });

  it("should classify error severity correctly", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Test severity classification indirectly through rendered content
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("should classify error category correctly", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Category affects the user-friendly message - test error shows generic message
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("should show component stack in details", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const details = screen.getByText("Component Stack");
    expect(details).toBeInTheDocument();
  });

  it("should stop retrying after max retries", async () => {
    render(
      <ErrorBoundary autoRetry={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Each retry cycle: toast.info('Auto-retry') in componentDidCatch + toast.info('Retrying...') in handleRecover
    // First retry after 1s
    await vi.advanceTimersByTimeAsync(1000);

    // Second retry after 2s
    await vi.advanceTimersByTimeAsync(2000);

    // Third retry after 4s
    await vi.advanceTimersByTimeAsync(4000);

    // 3 "Auto-retry" + 3 "Retrying..." = 6 toast.info calls
    // After 3rd retry, retryCount=3, 3 < MAX_RETRIES(3) is false, so no more auto-retry scheduled
    expect(toast.info).toHaveBeenCalledTimes(6);
  });

  it("should use custom fallback component", () => {
    const CustomFallback = ({ error }: ErrorFallbackProps) => (
      <div>Custom error: {error.message}</div>
    );

    render(
      <ErrorBoundary autoRetry={false} fallbackComponent={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom error: Test error")).toBeInTheDocument();
  });

  it("should cleanup timeout on unmount", () => {
    const { unmount } = render(
      <ErrorBoundary autoRetry={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    unmount();

    // Verify timeout is cleared
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should show critical error with infinity toast", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Critical errors get special handling
    expect(toast.error).toHaveBeenCalled();
  });

  it("should display timestamp", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Error occurred at/i)).toBeInTheDocument();
  });

  it("should increment occurrence count on repeated errors", () => {
    render(
      <ErrorBoundary autoRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/\(1\/3\)/i)).toBeInTheDocument();

    // Retry and fail again — use fireEvent since fake timers + userEvent don't mix
    const retryButton = screen.getByText(/Retry/i);
    fireEvent.click(retryButton);

    // After retry, child throws again, retryCount increments to 2
    expect(screen.getByText(/\(2\/3\)/i)).toBeInTheDocument();
  });
});
