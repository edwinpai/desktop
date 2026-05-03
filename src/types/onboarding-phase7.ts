/**
 * Phase 7: Onboarding Flow Type Definitions
 *
 * Defines type contracts for:
 * - Multi-step onboarding wizard
 * - Step validation and progress tracking
 * - Onboarding state persistence
 * - Skip/back/next navigation
 *
 * This extends the Phase 6 onboarding types with Phase 7-specific flows
 * (gateway binary discovery, subscription verification, first-run setup).
 *
 * @module types/onboarding-phase7
 */

// ============================================================================
// Onboarding Steps
// ============================================================================

/**
 * Onboarding step identifier.
 *
 * Steps execute in this order:
 * 1. welcome - Introduction screen
 * 2. identity - Setup BSV identity (Phase 1)
 * 3. backup - Backup recovery phrase (Phase 1)
 * 4. mode-select - Choose gateway or client mode (Phase 3/4)
 * 5. gateway-setup - Configure gateway (if gateway mode)
 * 6. client-discovery - Connect to gateway (if client mode)
 * 7. subscription - Verify subscription status (Phase 2)
 * 8. complete - Onboarding complete
 */
export type OnboardingStepId =
  | "welcome"
  | "identity"
  | "backup"
  | "mode-select"
  | "gateway-setup"
  | "client-discovery"
  | "subscription"
  | "complete";

/**
 * Onboarding step status.
 */
export type OnboardingStepStatus =
  | "pending" // Not started
  | "in-progress" // Currently active
  | "completed" // Successfully completed
  | "skipped" // User skipped (if optional)
  | "error"; // Validation failed

/**
 * Individual onboarding step state.
 *
 * @example
 * ```ts
 * const identityStep: OnboardingStep = {
 *   id: 'identity',
 *   title: 'Set Up Your Identity',
 *   description: 'Create your BSV identity and petname',
 *   status: 'completed',
 *   optional: false,
 *   data: {
 *     publicKey: '02abc...',
 *     petname: 'brave-elephant'
 *   },
 *   completedAt: '2026-02-12T10:05:00Z'
 * };
 * ```
 */
export interface OnboardingStep {
  /** Step identifier */
  id: OnboardingStepId;

  /** Display title */
  title: string;

  /** Optional description text */
  description?: string;

  /** Step status */
  status: OnboardingStepStatus;

  /** Whether this step can be skipped */
  optional: boolean;

  /** Step-specific data (JSON-serializable) */
  data?: Record<string, unknown>;

  /** Timestamp when step was completed (ISO 8601, null if not completed) */
  completedAt: string | null;

  /** Validation error message (if status='error') */
  error?: string;
}

// ============================================================================
// Onboarding State
// ============================================================================

/**
 * Complete onboarding flow state.
 *
 * Persisted to ~/.edwinpai/onboarding.json for resume capability.
 *
 * @example
 * ```ts
 * const state: OnboardingState = {
 *   currentStep: 'mode-select',
 *   steps: [
 *     { id: 'welcome', status: 'completed', ... },
 *     { id: 'identity', status: 'completed', ... },
 *     { id: 'backup', status: 'completed', ... },
 *     { id: 'mode-select', status: 'in-progress', ... }
 *   ],
 *   completionPercent: 37,
 *   isComplete: false,
 *   startedAt: '2026-02-12T10:00:00Z',
 *   completedAt: null
 * };
 * ```
 */
export interface OnboardingState {
  /** Current step being worked on */
  currentStep: OnboardingStepId;

  /** All steps in order */
  steps: OnboardingStep[];

  /** Overall completion percentage (0-100) */
  completionPercent: number;

  /** Whether onboarding flow has been fully completed */
  isComplete: boolean;

  /** Onboarding start timestamp (ISO 8601) */
  startedAt: string;

  /** Onboarding completion timestamp (ISO 8601, null if not complete) */
  completedAt: string | null;

  /** Operating mode selected during onboarding */
  selectedMode?: "gateway" | "client";

  /** Gateway setup data (if mode=gateway) */
  gatewaySetup?: {
    port: number;
    autoStart: boolean;
    mdnsEnabled: boolean;
  };

  /** Client connection data (if mode=client) */
  clientConnection?: {
    gatewayPubkey: string;
    gatewayAddress: string;
    gatewayPetname: string;
  };
}

// ============================================================================
// Step-Specific Data Schemas
// ============================================================================

/**
 * Identity step data.
 */
export interface IdentityStepData {
  /** Hex-encoded secp256k1 public key (66 chars) */
  publicKey: string;

  /** Human-readable petname (e.g., "brave-elephant") */
  petname: string;

  /** Short ID (e.g., "edw:a1b2c3d4") */
  shortId: string;

  /** Identicon SVG data URL */
  identicon: string;
}

/**
 * Backup step data.
 */
export interface BackupStepData {
  /** Whether user confirmed backup (checkbox) */
  confirmed: boolean;

  /** Timestamp when backup was confirmed (ISO 8601) */
  confirmedAt: string;
}

/**
 * Mode select step data.
 */
export interface ModeSelectStepData {
  /** Selected operating mode */
  selectedMode: "gateway" | "client";
}

/**
 * Gateway setup step data.
 */
export interface GatewaySetupStepData {
  /** Gateway HTTP port */
  port: number;

  /** Auto-start gateway on app launch */
  autoStart: boolean;

  /** Enable mDNS service advertising */
  mdnsEnabled: boolean;

  /** Binary discovery strategy */
  binaryStrategy: "bundled" | "path" | "explicit";

  /** Binary path (if strategy='explicit') */
  binaryPath?: string;

  /** Binary version (from discovery) */
  binaryVersion?: string;
}

/**
 * Client discovery step data.
 */
export interface ClientDiscoveryStepData {
  /** Gateway public key (hex, 66 chars) */
  gatewayPubkey: string;

  /** Gateway network address (IP:port or hostname:port) */
  gatewayAddress: string;

  /** Gateway petname */
  gatewayPetname: string;

  /** Discovery method used */
  discoveryMethod: "mdns" | "manual" | "qr";

  /** Connection timestamp (ISO 8601) */
  connectedAt: string;

  /** Permission level granted */
  permission: "owner" | "member" | "guest";
}

/**
 * Subscription step data.
 */
export interface SubscriptionStepData {
  /** Subscription UTXO transaction ID */
  txid: string;

  /** Subscription UTXO output index */
  vout: number;

  /** Subscription state */
  state: "active" | "cached" | "expired" | "grace_exceeded" | "not_found";

  /** Verification method */
  method: "spv" | "cached" | "offline";

  /** Last verification timestamp (ISO 8601) */
  verifiedAt: string;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Step validation result.
 */
export interface StepValidationResult {
  /** Whether step data is valid */
  valid: boolean;

  /** Validation error messages (if invalid) */
  errors?: string[];

  /** Warnings (non-blocking) */
  warnings?: string[];
}

/**
 * Step validator function signature.
 */
export type StepValidator = (
  stepId: OnboardingStepId,
  data: Record<string, unknown>,
) => Promise<StepValidationResult>;

// ============================================================================
// Navigation
// ============================================================================

/**
 * Onboarding navigation actions.
 */
export interface OnboardingNavigation {
  /** Navigate to next step */
  next: () => Promise<void>;

  /** Navigate to previous step */
  back: () => Promise<void>;

  /** Skip current step (if optional) */
  skip: () => Promise<void>;

  /** Jump to specific step (if already completed) */
  jumpTo: (stepId: OnboardingStepId) => Promise<void>;

  /** Restart onboarding from beginning */
  restart: () => Promise<void>;

  /** Exit onboarding (cancel) */
  exit: () => void;
}

/**
 * Onboarding step order.
 */
export const ONBOARDING_STEP_ORDER: OnboardingStepId[] = [
  "welcome",
  "identity",
  "backup",
  "mode-select",
  "gateway-setup",
  "client-discovery",
  "subscription",
  "complete",
];

/**
 * Onboarding step metadata.
 */
export const ONBOARDING_STEP_METADATA: Record<
  OnboardingStepId,
  { title: string; description: string; optional: boolean }
> = {
  welcome: {
    title: "Welcome to EdwinPAI",
    description: "Your personal AI assistant with true privacy",
    optional: false,
  },
  identity: {
    title: "Set Up Your Identity",
    description: "Create your BSV identity and petname",
    optional: false,
  },
  backup: {
    title: "Backup Your Key",
    description: "Secure your identity with a recovery phrase",
    optional: true,
  },
  "mode-select": {
    title: "Choose Your Mode",
    description: "Run your own gateway or connect to an existing one",
    optional: false,
  },
  "gateway-setup": {
    title: "Configure Gateway",
    description: "Set up your EdwinPAI gateway server",
    optional: false, // conditional: only shown if mode=gateway
  },
  "client-discovery": {
    title: "Connect to Gateway",
    description: "Find and connect to an EdwinPAI gateway on your network",
    optional: false, // conditional: only shown if mode=client
  },
  subscription: {
    title: "Verify Subscription",
    description: "Check your subscription status",
    optional: true,
  },
  complete: {
    title: "Setup Complete",
    description: "You're all set! Start chatting with EdwinPAI.",
    optional: false,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate onboarding completion percentage.
 */
export function calculateCompletion(steps: OnboardingStep[]): number {
  const completedCount = steps.filter(
    (s) => s.status === "completed" || s.status === "skipped",
  ).length;
  return Math.round((completedCount / steps.length) * 100);
}

/**
 * Get next onboarding step.
 */
export function getNextStep(
  currentStep: OnboardingStepId,
  mode?: "gateway" | "client",
): OnboardingStepId | null {
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(currentStep);
  if (
    currentIndex === -1 ||
    currentIndex === ONBOARDING_STEP_ORDER.length - 1
  ) {
    return null;
  }

  let nextIndex = currentIndex + 1;
  let nextStep = ONBOARDING_STEP_ORDER[nextIndex];

  // Skip conditional steps based on mode
  if (mode === "gateway" && nextStep === "client-discovery") {
    nextIndex++;
    nextStep = ONBOARDING_STEP_ORDER[nextIndex];
  } else if (mode === "client" && nextStep === "gateway-setup") {
    nextIndex++;
    nextStep = ONBOARDING_STEP_ORDER[nextIndex];
  }

  return nextStep ?? null;
}

/**
 * Get previous onboarding step.
 */
export function getPreviousStep(
  currentStep: OnboardingStepId,
  mode?: "gateway" | "client",
): OnboardingStepId | null {
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(currentStep);
  if (currentIndex <= 0) {
    return null;
  }

  let prevIndex = currentIndex - 1;
  let prevStep = ONBOARDING_STEP_ORDER[prevIndex];

  // Skip conditional steps based on mode
  if (mode === "gateway" && prevStep === "client-discovery") {
    prevIndex--;
    prevStep = ONBOARDING_STEP_ORDER[prevIndex];
  } else if (mode === "client" && prevStep === "gateway-setup") {
    prevIndex--;
    prevStep = ONBOARDING_STEP_ORDER[prevIndex];
  }

  return prevStep ?? null;
}

/**
 * Check if onboarding is complete.
 */
export function isOnboardingComplete(state: OnboardingState): boolean {
  const requiredSteps = state.steps.filter((s) => !s.optional);
  const completedRequired = requiredSteps.filter(
    (s) => s.status === "completed",
  );
  return completedRequired.length === requiredSteps.length;
}

/**
 * Get required steps based on selected mode.
 */
export function getRequiredSteps(
  mode: "gateway" | "client" | null,
): OnboardingStepId[] {
  const baseSteps: OnboardingStepId[] = [
    "welcome",
    "identity",
    "mode-select",
    "complete",
  ];

  if (mode === "gateway") {
    return [...baseSteps.slice(0, 3), "gateway-setup", "complete"];
  } else if (mode === "client") {
    return [...baseSteps.slice(0, 3), "client-discovery", "complete"];
  }

  return baseSteps;
}

/**
 * Initialize onboarding state.
 */
export function initializeOnboardingState(): OnboardingState {
  const steps: OnboardingStep[] = ONBOARDING_STEP_ORDER.map((id) => ({
    id,
    title: ONBOARDING_STEP_METADATA[id].title,
    description: ONBOARDING_STEP_METADATA[id].description,
    status: id === "welcome" ? "in-progress" : "pending",
    optional: ONBOARDING_STEP_METADATA[id].optional,
    completedAt: null,
  }));

  return {
    currentStep: "welcome",
    steps,
    completionPercent: 0,
    isComplete: false,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}
