/**
 * subscriptionStore Tests
 *
 * Tests subscription state machine, retry logic, grace period
 */

import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import type { CheckSubscriptionResponse } from "@/types";

describe("subscriptionStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useSubscriptionStore.getState().clearSubscription();
    });
  });

  it("should initialize with NotFound state", () => {
    const state = useSubscriptionStore.getState();

    expect(state.state).toBe("NotFound");
    expect(state.isLoading).toBe(false);
    expect(state.isRefreshing).toBe(false);
    expect(state.cachedProof).toBe(false);
    expect(state.retryCount).toBe(0);
  });

  it("should set Active subscription", () => {
    const response: CheckSubscriptionResponse = {
      type: "CheckSubscriptionResponse",
      state: "Active",
      txid: "abc123",
      vout: 0,
      blockHeight: 1000,
      confirmations: 6,
      cachedProof: false,
      verifiedAt: new Date().toISOString(),
    };

    act(() => {
      useSubscriptionStore.getState().setSubscription(response);
    });

    const state = useSubscriptionStore.getState();
    expect(state.state).toBe("Active");
    expect(state.txid).toBe("abc123");
    expect(state.vout).toBe(0);
    expect(state.cachedProof).toBe(false);
    expect(state.retryCount).toBe(0); // Reset on success
  });

  it("should set Cached subscription with grace period", () => {
    const verifiedAt = new Date().toISOString();
    const response: CheckSubscriptionResponse = {
      type: "CheckSubscriptionResponse",
      state: "Cached",
      txid: "abc123",
      vout: 0,
      cachedProof: true,
      verifiedAt,
    };

    act(() => {
      useSubscriptionStore.getState().setSubscription(response);
    });

    const state = useSubscriptionStore.getState();
    expect(state.state).toBe("Cached");
    expect(state.cachedProof).toBe(true);
    expect(state.graceExpiresAt).toBeTruthy();

    // Grace period should be 72 hours from verifiedAt
    const graceExpiry = new Date(state.graceExpiresAt!);
    const verified = new Date(verifiedAt);
    const diffHours =
      (graceExpiry.getTime() - verified.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(72, 1);
  });

  it("should compute isOperational correctly", () => {
    const state = useSubscriptionStore.getState();

    // Active is operational
    act(() => {
      state.setSubscription({
        type: "CheckSubscriptionResponse",
        state: "Active",
        cachedProof: false,
      });
    });
    expect(state.isOperational()).toBe(true);

    // Cached is operational
    act(() => {
      state.setSubscription({
        type: "CheckSubscriptionResponse",
        state: "Cached",
        cachedProof: true,
      });
    });
    expect(state.isOperational()).toBe(true);

    // Expired is not operational
    act(() => {
      state.setSubscription({
        type: "CheckSubscriptionResponse",
        state: "Expired",
        cachedProof: false,
      });
    });
    expect(state.isOperational()).toBe(false);
  });

  it("should compute needsRenewal correctly", () => {
    const state = useSubscriptionStore.getState();

    // Expired needs renewal
    act(() => {
      state.setSubscription({
        type: "CheckSubscriptionResponse",
        state: "Expired",
        cachedProof: false,
      });
    });
    expect(state.needsRenewal()).toBe(true);

    // NotFound needs renewal
    act(() => {
      state.clearSubscription();
    });
    expect(state.needsRenewal()).toBe(true);

    // Active doesn't need renewal
    act(() => {
      state.setSubscription({
        type: "CheckSubscriptionResponse",
        state: "Active",
        cachedProof: false,
      });
    });
    expect(state.needsRenewal()).toBe(false);
  });

  it("should calculate grace period remaining", () => {
    act(() => {
      useSubscriptionStore.getState().setSubscription({
        type: "CheckSubscriptionResponse",
        state: "Cached",
        cachedProof: true,
        verifiedAt: new Date(Date.now() - 71 * 60 * 60 * 1000).toISOString(), // 71h ago
      });
    });

    const state = useSubscriptionStore.getState();
    const remaining = state.getGracePeriodRemaining();

    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThan(2 * 60 * 60 * 1000); // Less than 2 hours
  });

  it("should return null for grace period when no expiry set", () => {
    const state = useSubscriptionStore.getState();
    expect(state.getGracePeriodRemaining()).toBeNull();
  });

  it("should handle loading state", () => {
    act(() => {
      useSubscriptionStore.getState().setLoading(true);
    });
    expect(useSubscriptionStore.getState().isLoading).toBe(true);

    act(() => {
      useSubscriptionStore.getState().setLoading(false);
    });
    expect(useSubscriptionStore.getState().isLoading).toBe(false);
  });

  it("should handle refreshing state", () => {
    act(() => {
      useSubscriptionStore.getState().setRefreshing(true);
    });
    expect(useSubscriptionStore.getState().isRefreshing).toBe(true);

    act(() => {
      useSubscriptionStore.getState().setRefreshing(false);
    });
    expect(useSubscriptionStore.getState().isRefreshing).toBe(false);
  });

  it("should handle errors and calculate next retry", () => {
    act(() => {
      useSubscriptionStore.getState().setError("Network error");
    });

    const state = useSubscriptionStore.getState();
    expect(state.error).toBe("Network error");
    expect(state.nextRetryAt).toBeTruthy();
  });

  it("should increment retry count", () => {
    act(() => {
      useSubscriptionStore.getState().incrementRetry();
    });

    const state = useSubscriptionStore.getState();
    expect(state.retryCount).toBe(1);
    expect(state.nextRetryAt).toBeTruthy();
  });

  it("should reset retry count", () => {
    act(() => {
      useSubscriptionStore.getState().incrementRetry();
      useSubscriptionStore.getState().resetRetry();
    });

    const state = useSubscriptionStore.getState();
    expect(state.retryCount).toBe(0);
    expect(state.nextRetryAt).toBeUndefined();
  });

  it("should determine if can retry", () => {
    let state = useSubscriptionStore.getState();

    // Can retry if no next retry time set
    expect(state.canRetry()).toBe(true);

    // Cannot retry if next retry is in the future
    act(() => {
      state.setError("Error");
    });

    // Get updated state after setError
    state = useSubscriptionStore.getState();
    expect(state.canRetry()).toBe(false);

    // Can retry if next retry time has passed
    act(() => {
      useSubscriptionStore.setState({
        nextRetryAt: new Date(Date.now() - 1000).toISOString(),
      });
    });

    state = useSubscriptionStore.getState();
    expect(state.canRetry()).toBe(true);
  });

  it("should clear subscription completely", () => {
    // First set some state
    act(() => {
      useSubscriptionStore.getState().setSubscription({
        type: "CheckSubscriptionResponse",
        state: "Active",
        txid: "abc123",
        vout: 0,
        cachedProof: false,
      });
    });

    // Then clear
    act(() => {
      useSubscriptionStore.getState().clearSubscription();
    });

    const state = useSubscriptionStore.getState();
    expect(state.state).toBe("NotFound");
    expect(state.txid).toBeUndefined();
    expect(state.vout).toBeUndefined();
    expect(state.cachedProof).toBe(false);
    expect(state.retryCount).toBe(0);
  });
});
