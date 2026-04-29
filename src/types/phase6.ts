/**
 * Phase 6: Onboarding & Updates - Type Export Index
 *
 * This barrel file re-exports all Phase 6 type contracts for clean imports.
 *
 * Usage:
 * ```typescript
 * import type { OnboardingProgress, UpdateInfo, ErrorBoundaryState } from '@/types/phase6';
 * ```
 *
 * @module types/phase6
 */

// ============================================================================
// Phase 6 Requirements Document Type Contracts
// ============================================================================

/**
 * Task group definition for phased implementation
 * Represents a logical grouping of related implementation work
 */
export interface TaskGroup {
  /** Unique identifier for the task group */
  id: string;

  /** Human-readable name describing the task group */
  name: string;

  /** List of task group IDs that must complete before this one can start */
  blocking_deps: string[];

  /** Criteria that must be met for this task group to be considered complete */
  acceptance_criteria: string[];

  /** Estimated lines of code for this task group */
  estimated_loc: number;
}

/**
 * Error inventory categorization
 * Tracks known issues by category, severity, and affected files
 */
export interface ErrorInventory {
  /** Error category - either TypeScript or Rust compilation/test errors */
  category: 'typescript' | 'rust';

  /** Total count of errors in this category */
  count: number;

  /** Severity level of the errors */
  severity: 'critical' | 'high' | 'medium' | 'low';

  /** List of files affected by these errors */
  files_affected: string[];

  /** Optional description of the error type */
  description?: string;
}

/**
 * Success criteria metric definition
 * Defines measurable targets for phase completion
 */
export interface SuccessCriteria {
  /** Name of the metric being measured */
  metric: string;

  /** Target value to achieve for success */
  target: string | number;

  /** Current baseline value before phase work begins */
  current_baseline: string | number;

  /** Method used to verify this metric */
  verification_method: string;

  /** Optional: whether this is a blocking criterion */
  blocking?: boolean;
}

/**
 * Phase implementation state tracking
 * Captures the current state of a phase's implementation progress
 */
export interface PhaseState {
  /** Phase number (1-7 per PLAN.md) */
  phase_num: number;

  /** Current status of the phase */
  status: 'not_started' | 'in_progress' | 'complete' | 'blocked';

  /** Total number of files created/modified in this phase */
  file_count: number;

  /** Total lines of code written in this phase */
  loc_count: number;

  /** Total number of tests written for this phase */
  test_count: number;

  /** List of domain modules completed in this phase */
  domains_completed: string[];

  /** Optional: list of blocking issues preventing completion */
  blocking_issues?: string[];

  /** Optional: timestamp when phase was started */
  started_at?: string;

  /** Optional: timestamp when phase was completed */
  completed_at?: string;
}

/**
 * Complete Phase 6 requirements document structure
 * Aggregates all requirement types for the phase
 */
export interface Phase6Requirements {
  /** Phase metadata */
  phase: PhaseState;

  /** Task groups defining implementation work */
  task_groups: TaskGroup[];

  /** Known errors to be addressed */
  error_inventory: ErrorInventory[];

  /** Success criteria for phase completion */
  success_criteria: SuccessCriteria[];

  /** Optional: dependencies from previous phases */
  phase_dependencies?: {
    phase_num: number;
    required_deliverables: string[];
  }[];

  /** Optional: risk assessment */
  risks?: {
    description: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }[];
}

/**
 * Type guard for TaskGroup validation
 */
export function isTaskGroup(obj: unknown): obj is TaskGroup {
  const tg = obj as TaskGroup;
  return (
    typeof tg === 'object' &&
    tg !== null &&
    typeof tg.id === 'string' &&
    typeof tg.name === 'string' &&
    Array.isArray(tg.blocking_deps) &&
    Array.isArray(tg.acceptance_criteria) &&
    typeof tg.estimated_loc === 'number'
  );
}

/**
 * Type guard for ErrorInventory validation
 */
export function isErrorInventory(obj: unknown): obj is ErrorInventory {
  const ei = obj as ErrorInventory;
  return (
    typeof ei === 'object' &&
    ei !== null &&
    (ei.category === 'typescript' || ei.category === 'rust') &&
    typeof ei.count === 'number' &&
    ['critical', 'high', 'medium', 'low'].includes(ei.severity) &&
    Array.isArray(ei.files_affected)
  );
}

/**
 * Type guard for SuccessCriteria validation
 */
export function isSuccessCriteria(obj: unknown): obj is SuccessCriteria {
  const sc = obj as SuccessCriteria;
  return (
    typeof sc === 'object' &&
    sc !== null &&
    typeof sc.metric === 'string' &&
    (typeof sc.target === 'string' || typeof sc.target === 'number') &&
    (typeof sc.current_baseline === 'string' || typeof sc.current_baseline === 'number') &&
    typeof sc.verification_method === 'string'
  );
}

/**
 * Type guard for PhaseState validation
 */
export function isPhaseState(obj: unknown): obj is PhaseState {
  const ps = obj as PhaseState;
  return (
    typeof ps === 'object' &&
    ps !== null &&
    typeof ps.phase_num === 'number' &&
    ['not_started', 'in_progress', 'complete', 'blocked'].includes(ps.status) &&
    typeof ps.file_count === 'number' &&
    typeof ps.loc_count === 'number' &&
    typeof ps.test_count === 'number' &&
    Array.isArray(ps.domains_completed)
  );
}

// ============================================================================
// Re-export Phase 6 Feature Types
// ============================================================================

// Onboarding wizard types (updated structure)
// NOTE: Phase 6 originally used a different onboarding structure.
// The new structure from onboarding.ts is simpler and more focused.
export type {
  OnboardingStepType,
  OnboardingStep,
  OnboardingProgress,
  StepComponentProps,
  ValidateApiKeyRequest,
  ValidateApiKeyResponse,
  GenerateIdentityRequest,
  GenerateIdentityResponse,
  StartGatewayRequest,
  StartGatewayResponse,
  SendMessageRequest,
  SendMessageResponse,
  UpdateConfigRequest,
  UpdateConfigResponse,
} from './onboarding';

// Auto-updater types
export type {
  UpdateInfo,
  UpdateConfig,
  DownloadProgress,
  UpdateCheckResult,
  CheckForUpdatesRequest,
  CheckForUpdatesResponse,
  DownloadUpdateRequest,
  DownloadUpdateResponse,
  ApplyUpdateRequest,
  ApplyUpdateResponse,
  CancelDownloadRequest,
  CancelDownloadResponse,
  GetUpdateStatusRequest,
  GetUpdateStatusResponse,
  SetUpdateConfigRequest,
  SetUpdateConfigResponse,
  UpdateStatusEvent,
} from './updater';
export { UpdateStatus } from './updater';

// Error boundary types
export type {
  ErrorRecoveryAction,
  ErrorBoundaryState,
  ErrorRecoveryStrategy,
  ErrorBoundaryConfig,
  ErrorFallbackProps,
  LogErrorRequest,
  LogErrorResponse,
  GlobalErrorConfig,
  ErrorReport,
} from './errors';
export { ErrorSeverity, ErrorCategory } from './errors';

// NOTE: Performance and Accessibility types will be added when files are created
// export type { VirtualizationConfig, MemoizationStrategy, LazyLoadConfig } from './performance';
// export type { AriaLabels, KeyboardShortcut, FocusTrapConfig } from './accessibility';
