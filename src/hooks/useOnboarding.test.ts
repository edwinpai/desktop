/**
 * useOnboarding Hook Tests - Group A
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOnboarding } from "./useOnboarding";

import type { OnboardingStepType } from "@/types/onboarding";

describe("useOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.currentStep).toBe(0);
    expect(result.current.completedSteps).toEqual([]);
    expect(result.current.skippedSteps).toEqual([]);
    expect(result.current.data).toEqual({});
    expect(result.current.isComplete).toBe(false);
  });

  it("navigates to next step", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.nextStep();
    });

    expect(result.current.currentStep).toBe(1);
  });

  it("navigates to previous step", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.nextStep();
      result.current.nextStep();
    });

    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.prevStep();
    });

    expect(result.current.currentStep).toBe(1);
  });

  it("does not go below step 0", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.prevStep();
    });

    expect(result.current.currentStep).toBe(0);
  });

  it("does not go beyond last step", () => {
    const { result } = renderHook(() => useOnboarding());

    // Each nextStep must be in its own act() so the closure captures the updated currentStep
    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.nextStep();
      });
    }

    // TOTAL_STEPS = 7, max step index is 6
    expect(result.current.currentStep).toBeLessThanOrEqual(6);
  });

  it("jumps to specific step", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.goToStep(3);
    });

    expect(result.current.currentStep).toBe(3);
  });

  it("completes step and stores data", () => {
    const { result } = renderHook(() => useOnboarding());

    const stepData = { publicKey: "test_key", petname: "Alice" };

    act(() => {
      result.current.completeStep("identity" as OnboardingStepType, stepData);
    });

    expect(result.current.completedSteps).toContain("identity");
    expect(result.current.data.identity).toEqual(stepData);
    expect(result.current.currentStep).toBe(1); // Auto-advanced
  });

  it("skips step", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.skipStep("channels" as OnboardingStepType);
    });

    expect(result.current.skippedSteps).toContain("channels");
    expect(result.current.currentStep).toBe(1); // Auto-advanced
  });

  it("updates step data without completing", () => {
    const { result } = renderHook(() => useOnboarding());

    const stepData = { mode: "gateway" };

    act(() => {
      result.current.updateStepData("mode", stepData);
    });

    expect(result.current.data.mode).toEqual(stepData);
    expect(result.current.completedSteps).not.toContain("mode");
  });

  it("detects completion", () => {
    const { result } = renderHook(() => useOnboarding());

    // isComplete requires currentStep >= TOTAL_STEPS - 1 (6) AND completedSteps.length >= 3
    // completeStep auto-advances, so we need to reach step 6 with 3+ completed steps
    act(() => {
      result.current.completeStep("Identity" as OnboardingStepType); // step -> 1
      result.current.completeStep("Gateway" as OnboardingStepType); // step -> 2
      result.current.completeStep("TestChat" as OnboardingStepType); // step -> 3
      result.current.nextStep(); // step -> 4
      result.current.nextStep(); // step -> 5
      result.current.nextStep(); // step -> 6
    });

    expect(result.current.isComplete).toBe(true);
  });

  it("calls onComplete callback when finished", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useOnboarding({ onComplete }));

    // Need to reach step 6 with 3+ completed steps, then call nextStep at the end
    act(() => {
      result.current.completeStep("Identity" as OnboardingStepType); // step -> 1
      result.current.completeStep("Gateway" as OnboardingStepType); // step -> 2
      result.current.completeStep("TestChat" as OnboardingStepType); // step -> 3
      result.current.nextStep(); // step -> 4
      result.current.nextStep(); // step -> 5
      result.current.nextStep(); // step -> 6 (isComplete = true now)
    });

    act(() => {
      result.current.nextStep(); // At last step + isComplete → calls onComplete
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it("saves progress to localStorage", () => {
    const { result } = renderHook(() => useOnboarding({ autoSave: true }));

    act(() => {
      result.current.completeStep("identity" as OnboardingStepType, {
        test: "data",
      });
    });

    const saved = localStorage.getItem("edwinpai_onboarding_progress");
    expect(saved).toBeTruthy();

    const parsed = JSON.parse(saved!);
    expect(parsed.completedSteps).toContain("identity");
    expect(parsed.data.identity).toEqual({ test: "data" });
  });

  it("loads progress from localStorage", () => {
    // Pre-populate localStorage
    const progress = {
      currentStep: 2,
      completedSteps: ["identity", "mode"],
      skippedSteps: [],
      data: { identity: { petname: "Alice" } },
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      "edwinpai_onboarding_progress",
      JSON.stringify(progress),
    );

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.currentStep).toBe(2);
    expect(result.current.completedSteps).toEqual(["identity", "mode"]);
    expect(result.current.data.identity).toEqual({ petname: "Alice" });
  });

  it("resets onboarding state", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.completeStep("Identity" as OnboardingStepType);
      // completeStep auto-advances to step 1, then nextStep goes to 2
      result.current.nextStep();
      result.current.completeStep("Gateway" as OnboardingStepType);
    });

    expect(result.current.currentStep).toBeGreaterThan(0);
    expect(result.current.completedSteps.length).toBeGreaterThan(0);

    act(() => {
      result.current.resetOnboarding();
    });

    expect(result.current.currentStep).toBe(0);
    expect(result.current.completedSteps).toEqual([]);
    expect(result.current.skippedSteps).toEqual([]);
    expect(result.current.data).toEqual({});

    // After reset, auto-save may persist the empty state, so check the content
    // rather than expecting null
    const saved = localStorage.getItem("edwinpai_onboarding_progress");
    if (saved) {
      const parsed = JSON.parse(saved);
      expect(parsed.currentStep).toBe(0);
      expect(parsed.completedSteps).toEqual([]);
    }
  });

  it("does not duplicate completed steps", () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.completeStep("Identity" as OnboardingStepType);
      result.current.completeStep("Identity" as OnboardingStepType);
      result.current.completeStep("Identity" as OnboardingStepType);
    });

    const identityCount = result.current.completedSteps.filter(
      (s) => s === "Identity",
    ).length;
    expect(identityCount).toBe(1);
  });
});
