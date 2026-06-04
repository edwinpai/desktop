/**
 * useOnboarding Hook - Group A Implementation
 *
 * Manages onboarding wizard state with localStorage persistence.
 * Provides step navigation, progress tracking, and state management.
 */

import { useState, useEffect, useCallback } from "react";

import type {
  OnboardingProgress,
  OnboardingStepType,
} from "@/types/onboarding";

const STORAGE_KEY = "edwinpai_onboarding_progress";

export interface UseOnboardingOptions {
  onComplete?: () => void;
  autoSave?: boolean;
}

export interface UseOnboardingReturn {
  currentStep: number;
  completedSteps: OnboardingStepType[];
  skippedSteps: OnboardingStepType[];
  data: Record<string, unknown>;
  isComplete: boolean;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  completeStep: (stepType: OnboardingStepType, stepData?: unknown) => void;
  skipStep: (stepType: OnboardingStepType) => void;
  updateStepData: (stepType: string, stepData: unknown) => void;
  resetOnboarding: () => void;
  saveProgress: () => void;
  loadProgress: () => OnboardingProgress | null;
}

const TOTAL_STEPS = 11; // Welcome, Gateway, Security, VaultHealth, ApiKey, SecretMigration, CredentialProbe, Identity, TestChat, Channels, Done

/**
 * Hook for managing onboarding wizard state
 */
export function useOnboarding(
  options: UseOnboardingOptions = {},
): UseOnboardingReturn {
  const { onComplete, autoSave = true } = options;

  // Initialize state from localStorage
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = loadProgressFromStorage();
    const step = saved?.currentStep ?? 0;
    return typeof step === "number" ? step : 0;
  });

  const [completedSteps, setCompletedSteps] = useState<OnboardingStepType[]>(
    () => {
      const saved = loadProgressFromStorage();
      return (saved?.completedSteps ?? []) as OnboardingStepType[];
    },
  );

  const [skippedSteps, setSkippedSteps] = useState<OnboardingStepType[]>(() => {
    const saved = loadProgressFromStorage();
    return (saved?.skippedSteps ?? []) as OnboardingStepType[];
  });

  const [data, setData] = useState<Record<string, unknown>>(() => {
    const saved = loadProgressFromStorage();
    return saved?.data ?? {};
  });

  const [startedAt] = useState<string>(() => {
    const saved = loadProgressFromStorage();
    return saved?.startedAt ?? new Date().toISOString();
  });

  const isComplete =
    currentStep >= TOTAL_STEPS - 1 && completedSteps.length >= 3; // At least 3 required steps (Identity, Gateway, TestChat)

  // Save progress to localStorage
  const saveProgress = useCallback(() => {
    const progress: OnboardingProgress = {
      currentStep,
      completedSteps,
      skippedSteps,
      data,
      startedAt,
      lastUpdatedAt: new Date().toISOString(),
      apiKeyValidated: completedSteps.includes("ApiKey"),
      identityGenerated: completedSteps.includes("Identity"),
      gatewayStarted: completedSteps.includes("Gateway"),
      testChatCompleted: completedSteps.includes("TestChat"),
      channelsConfigured: [],
    };
    saveProgressToStorage(progress);
  }, [currentStep, completedSteps, skippedSteps, data, startedAt]);

  // Load progress from localStorage
  const loadProgress = useCallback((): OnboardingProgress | null => {
    return loadProgressFromStorage();
  }, []);

  // Auto-save on state changes
  useEffect(() => {
    if (autoSave) {
      saveProgress();
    }
  }, [autoSave, saveProgress]);

  // Navigate to specific step
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < TOTAL_STEPS) {
      setCurrentStep(step);
    }
  }, []);

  // Navigate to next step
  const nextStep = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev) => prev + 1);
    } else if (isComplete && onComplete) {
      onComplete();
    }
  }, [currentStep, isComplete, onComplete]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Mark step as completed
  const completeStep = useCallback(
    (stepType: OnboardingStepType, stepData?: unknown) => {
      setCompletedSteps((prev) => {
        if (prev.includes(stepType)) return prev;
        return [...prev, stepType];
      });

      if (stepData) {
        setData((prev) => ({
          ...prev,
          [stepType]: stepData,
        }));
      }

      // Auto-advance to next step
      if (currentStep < TOTAL_STEPS - 1) {
        setCurrentStep((prev) => prev + 1);
      }
    },
    [currentStep],
  );

  // Mark step as skipped
  const skipStep = useCallback(
    (stepType: OnboardingStepType) => {
      setSkippedSteps((prev) => {
        if (prev.includes(stepType)) return prev;
        return [...prev, stepType];
      });

      // Auto-advance to next step
      if (currentStep < TOTAL_STEPS - 1) {
        setCurrentStep((prev) => prev + 1);
      }
    },
    [currentStep],
  );

  // Update step data without completing
  const updateStepData = useCallback((stepType: string, stepData: unknown) => {
    setData((prev) => ({
      ...prev,
      [stepType]: stepData,
    }));
  }, []);

  // Reset onboarding state
  const resetOnboarding = useCallback(() => {
    setCurrentStep(0);
    setCompletedSteps([]);
    setSkippedSteps([]);
    setData({});
    clearProgressFromStorage();
  }, []);

  return {
    currentStep,
    completedSteps,
    skippedSteps,
    data,
    isComplete,
    goToStep,
    nextStep,
    prevStep,
    completeStep,
    skipStep,
    updateStepData,
    resetOnboarding,
    saveProgress,
    loadProgress,
  };
}

/**
 * Helper: Load progress from localStorage
 */
function loadProgressFromStorage(): OnboardingProgress | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as OnboardingProgress;
  } catch (error) {
    console.error("Failed to load onboarding progress:", error);
    return null;
  }
}

/**
 * Helper: Save progress to localStorage
 */
function saveProgressToStorage(progress: OnboardingProgress): void {
  try {
    // Sanitize data to avoid cyclic structures (WS objects, Error objects, etc.)
    const sanitized = {
      ...progress,
      data: progress.data ? sanitizeData(progress.data) : {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    console.error("Failed to save onboarding progress:", error);
  }
}

/**
 * Strip non-serializable values from step data to prevent JSON.stringify failures.
 */
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    try {
      // Test if value is serializable
      JSON.stringify(value);
      clean[key] = value;
    } catch {
      // Replace non-serializable values with a safe placeholder
      if (value && typeof value === "object") {
        clean[key] = "[non-serializable]";
      }
    }
  }
  return clean;
}

/**
 * Helper: Clear progress from localStorage
 */
function clearProgressFromStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear onboarding progress:", error);
  }
}
