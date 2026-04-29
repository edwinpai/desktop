/**
 * Onboarding flow types
 *
 * Type-safe definitions for the multi-step onboarding wizard that guides new users
 * through initial setup: API key validation, identity generation, gateway configuration,
 * test chat, and channel configuration.
 */

import type { EdwinPAIConfig } from './api';

// --- Onboarding Step Enumeration ---

/**
 * Onboarding wizard steps
 */
export enum OnboardingStep {
  Welcome = 'Welcome',
  Gateway = 'Gateway',
  ApiKey = 'ApiKey',
  Identity = 'Identity',
  TestChat = 'TestChat',
  Channels = 'Channels',
  Done = 'Done',
}

/**
 * Type-safe onboarding step identifiers
 */
export type OnboardingStepType = keyof typeof OnboardingStep;

// --- Onboarding Progress State ---

/**
 * Tracks user progress through the onboarding flow
 */
export interface OnboardingProgress {
  /** Current step in the wizard (numeric index or enum) */
  currentStep: OnboardingStep | number;

  /** Array of completed step identifiers (for breadcrumb navigation) */
  completedSteps: string[];

  /** Array of skipped step identifiers */
  skippedSteps?: string[];

  /** Whether API key has been validated */
  apiKeyValidated: boolean;

  /** Whether user identity has been generated */
  identityGenerated: boolean;

  /** Whether gateway has been started successfully */
  gatewayStarted: boolean;

  /** Whether test chat interaction has been completed */
  testChatCompleted: boolean;

  /** Array of configured channel names */
  channelsConfigured: string[];

  /** Step-specific data storage */
  data?: Record<string, unknown>;

  /** Timestamp when onboarding started */
  startedAt?: string;

  /** Timestamp when progress was last updated */
  lastUpdatedAt?: string;
}

// --- Step Component Props ---

/**
 * Common props for onboarding step components
 */
export interface StepComponentProps {
  /** Current onboarding progress state */
  progress: OnboardingProgress;

  /** Navigate to the next step */
  onNext: () => void;

  /** Navigate to the previous step */
  onPrevious: () => void;

  /** Skip the current step (for optional steps) */
  onSkip?: () => void;

  /** Update progress state (partial updates) */
  updateProgress: (update: Partial<OnboardingProgress>) => void;
}

// --- IPC Request Type Aliases for Validation ---

/**
 * Validate API key against AI provider
 *
 * NOTE: This is a placeholder type. The actual implementation depends on
 * the AI provider integration (e.g., Anthropic, OpenAI).
 *
 * @see SPEC §10 (Gateway REST API)
 */
export interface ValidateApiKeyRequest {
  type: 'ValidateApiKeyRequest';
  /** API key to validate */
  apiKey: string;
  /** AI provider (e.g., 'anthropic', 'openai') */
  provider: string;
}

/**
 * API key validation response
 */
export interface ValidateApiKeyResponse {
  type: 'ValidateApiKeyResponse';
  /** Whether API key is valid */
  valid: boolean;
  /** Optional error message if validation failed */
  error?: string;
}

/**
 * Generate new user identity
 *
 * Re-uses GetIdentityRequest from IPC types.
 *
 * @see GetIdentityRequest from types/ipc.ts
 */
export interface GenerateIdentityRequest {
  type: 'GetIdentityRequest';
}

/**
 * Generated identity response
 *
 * Re-uses GetIdentityResponse structure from IPC types.
 *
 * @see GetIdentityResponse from types/ipc.ts
 */
export interface GenerateIdentityResponse {
  type: 'GetIdentityResponse';
  publicKey: string;
  petname: string;
  avatarSvg: string;
  shortId: string;
}

/**
 * Start gateway process
 *
 * NOTE: This is a placeholder type. The actual implementation should use
 * StartGatewayProcessRequest from types/phase7.ts once gateway lifecycle is implemented.
 *
 * @see SPEC §8.2 (Gateway Process Management)
 */
export interface StartGatewayRequest {
  type: 'StartGatewayRequest';
  /** Gateway configuration options */
  config?: Partial<EdwinPAIConfig['gateway']>;
}

/**
 * Gateway start response
 */
export interface StartGatewayResponse {
  type: 'StartGatewayResponse';
  /** Whether gateway started successfully */
  success: boolean;
  /** Gateway process PID (if started) */
  pid?: number;
  /** Optional error message if start failed */
  error?: string;
}

/**
 * Send test chat message
 *
 * NOTE: This is a placeholder type. The actual implementation should use
 * ChatCompletionRequest from types/api.ts or SendChatMessageRequest from types/chat.ts.
 *
 * @see SPEC §10.2 (Chat Completions)
 */
export interface SendMessageRequest {
  type: 'SendMessageRequest';
  /** Message content */
  message: string;
  /** Optional conversation ID */
  conversationId?: string;
}

/**
 * Test chat message response
 */
export interface SendMessageResponse {
  type: 'SendMessageResponse';
  /** AI response content */
  response: string;
  /** Whether message was sent successfully */
  success: boolean;
  /** Optional error message if send failed */
  error?: string;
}

/**
 * Update EdwinPAI configuration
 *
 * Re-uses UpdateEdwinPAIConfigRequest structure from IPC types.
 *
 * @see UpdateEdwinPAIConfigRequest from types/ipc.ts
 */
export interface UpdateConfigRequest {
  type: 'UpdateEdwinPAIConfigRequest';
  /** Updated configuration (partial or complete) */
  config: EdwinPAIConfig;
}

/**
 * Configuration update response
 */
export interface UpdateConfigResponse {
  type: 'UpdateEdwinPAIConfigResponse';
  /** Whether config update was successful */
  success: boolean;
  /** Optional error message if update failed */
  error?: string;
}

// --- Validation Helpers ---

/**
 * Check if a step is required (cannot be skipped)
 */
export function isStepRequired(step: OnboardingStep): boolean {
  // Welcome, Identity, and Done are mandatory
  // ApiKey, Gateway, TestChat, and Channels can be configured later
  return step === OnboardingStep.Welcome || step === OnboardingStep.Identity || step === OnboardingStep.Done;
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(progress: OnboardingProgress): boolean {
  return progress.currentStep === OnboardingStep.Done;
}

/**
 * Get the next onboarding step
 */
export function getNextStep(current: OnboardingStep): OnboardingStep | null {
  const steps = Object.values(OnboardingStep);
  const currentIndex = steps.indexOf(current);
  if (currentIndex === -1 || currentIndex === steps.length - 1) {
    return null;
  }
  return steps[currentIndex + 1] as OnboardingStep;
}

/**
 * Get the previous onboarding step
 */
export function getPreviousStep(current: OnboardingStep): OnboardingStep | null {
  const steps = Object.values(OnboardingStep);
  const currentIndex = steps.indexOf(current);
  if (currentIndex <= 0) {
    return null;
  }
  return steps[currentIndex - 1] as OnboardingStep;
}

/**
 * Calculate onboarding completion percentage (0-100)
 */
export function calculateCompletionPercentage(progress: OnboardingProgress): number {
  const totalSteps = Object.values(OnboardingStep).length - 1; // Exclude "Done"
  const completedCount = progress.completedSteps.length;
  return Math.round((completedCount / totalSteps) * 100);
}
