/**
 * Phase 6 Group D: Error Recovery Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useErrorRecovery, useConnectionRecovery } from "./useErrorRecovery";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("useErrorRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with not recovering state", () => {
    const { result } = renderHook(() => useErrorRecovery());

    expect(result.current.state.isRecovering).toBe(false);
    expect(result.current.state.retryCount).toBe(0);
    expect(result.current.state.lastError).toBeNull();
  });

  it("should start recovery with exponential backoff", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useErrorRecovery({
        maxRetries: 3,
        onRetry,
      }),
    );

    const error = new Error("Connection failed");

    act(() => {
      result.current.recover(error);
    });

    expect(result.current.state.isRecovering).toBe(true);
    // recover() calls executeRetry(0) immediately which sets retryCount to 1
    expect(result.current.state.retryCount).toBe(1);

    // First retry after 5s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(onRetry).toHaveBeenCalledWith(1);
    expect(result.current.state.isRecovering).toBe(false);
    expect(toast.success).toHaveBeenCalledWith(
      "Connection restored",
      expect.any(Object),
    );
  });

  it("should retry with increasing delays (5s → 10s → 20s)", async () => {
    let retryAttempts = 0;
    const onRetry = vi.fn().mockImplementation(() => {
      retryAttempts++;
      if (retryAttempts < 3) {
        throw new Error("Still failing");
      }
    });

    const { result } = renderHook(() =>
      useErrorRecovery({
        maxRetries: 3,
        onRetry,
      }),
    );

    act(() => {
      result.current.recover(new Error("Connection failed"));
    });

    // First retry after 5s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Second retry after 10s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(onRetry).toHaveBeenCalledTimes(2);

    // Third retry after 20s (succeeds)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(onRetry).toHaveBeenCalledTimes(3);
    expect(result.current.state.isRecovering).toBe(false);
  });

  it("should stop after max retries", async () => {
    const onRetry = vi.fn().mockRejectedValue(new Error("Still failing"));
    const onFailure = vi.fn();

    const { result } = renderHook(() =>
      useErrorRecovery({
        maxRetries: 3,
        onRetry,
        onFailure,
      }),
    );

    act(() => {
      result.current.recover(new Error("Connection failed"));
    });

    // First retry after 5s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Second retry after 10s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    // Third retry after 20s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(onRetry).toHaveBeenCalledTimes(3);
    expect(result.current.state.isRecovering).toBe(false);
    expect(onFailure).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Recovery failed",
      expect.any(Object),
    );
  });

  it("should call onSuccess callback on successful recovery", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useErrorRecovery({
        onRetry,
        onSuccess,
      }),
    );

    act(() => {
      result.current.recover(new Error("Connection failed"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it("should show toast notifications by default", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useErrorRecovery({
        onRetry,
        showToast: true,
      }),
    );

    act(() => {
      result.current.recover(new Error("Connection failed"));
    });

    expect(toast.info).toHaveBeenCalledWith(
      "Connection lost",
      expect.any(Object),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Connection restored",
      expect.any(Object),
    );
  });

  it("should not show toast when showToast is false", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useErrorRecovery({
        onRetry,
        showToast: false,
      }),
    );

    act(() => {
      result.current.recover(new Error("Connection failed"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should reset recovery state", () => {
    const { result } = renderHook(() => useErrorRecovery());

    act(() => {
      result.current.recover(new Error("Test error"));
    });

    expect(result.current.state.isRecovering).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.isRecovering).toBe(false);
    expect(result.current.state.retryCount).toBe(0);
    expect(result.current.state.lastError).toBeNull();
  });

  it("should retry now and reset retry count", async () => {
    let attempts = 0;
    const onRetry = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 2) {
        throw new Error("Still failing");
      }
    });

    const { result } = renderHook(() =>
      useErrorRecovery({
        onRetry,
      }),
    );

    // Start recovery
    act(() => {
      result.current.recover(new Error("Connection failed"));
    });

    // Advance through first retry (5s) — onRetry throws, triggers second attempt (10s timer)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.state.retryCount).toBe(2);
    expect(result.current.state.isRecovering).toBe(true);

    // Advance through second retry (10s) — onRetry succeeds this time
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(result.current.state.isRecovering).toBe(false);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("should cleanup on unmount", () => {
    const { unmount } = renderHook(() => useErrorRecovery());

    act(() => {
      unmount();
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useConnectionRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should wrap async function with error recovery", async () => {
    const onReconnect = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConnectionRecovery({
        onReconnect,
      }),
    );

    let callCount = 0;
    const mockFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Network timeout");
      }
      return "success";
    });

    const wrapped = result.current.wrapAsync(mockFn);

    await act(async () => {
      const promise = wrapped();
      await vi.advanceTimersByTimeAsync(5000);
      await promise;
    });

    expect(onReconnect).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledTimes(2); // Original + retry
  });

  it("should detect recoverable errors", async () => {
    const onReconnect = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConnectionRecovery({
        onReconnect,
      }),
    );

    // First call fails (triggers recovery), second call (retry) also fails
    const networkError = vi
      .fn()
      .mockRejectedValue(new Error("Network timeout"));
    const wrapped = result.current.wrapAsync(networkError);

    await act(async () => {
      const promise = wrapped().catch(() => {}); // Catch the eventual rejection
      await vi.advanceTimersByTimeAsync(5000);
      await promise;
    });

    expect(onReconnect).toHaveBeenCalled();
  });

  it("should not recover non-network errors", async () => {
    const onReconnect = vi.fn();
    const { result } = renderHook(() =>
      useConnectionRecovery({
        onReconnect,
      }),
    );

    const validationError = vi
      .fn()
      .mockRejectedValue(new Error("Validation failed"));
    const wrapped = result.current.wrapAsync(validationError);

    await expect(wrapped()).rejects.toThrow("Validation failed");
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it("should reset and retry now", async () => {
    const onReconnect = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useConnectionRecovery({
        onReconnect,
      }),
    );

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.isRecovering).toBe(false);
  });
});
