/**
 * Phase 6: Onboarding & Updates - Error Boundary Type Definitions
 *
 * Defines type contracts for React error boundaries and error recovery strategies.
 *
 * @module types/errors
 */

import type { ErrorInfo as ReactErrorInfo } from "react";

/**
 * Error recovery action strategy.
 *
 * - `retry`: Attempt to re-render the failed component
 * - `reset`: Reset component state and re-render
 * - `ignore`: Dismiss error and continue with fallback UI
 * - `reload`: Reload the entire application
 * - `navigate`: Navigate to a safe route (e.g., home)
 */
export type ErrorRecoveryAction =
  | "retry"
  | "reset"
  | "ignore"
  | "reload"
  | "navigate";

/**
 * Error severity level.
 *
 * Determines logging behavior and UI presentation.
 */
export enum ErrorSeverity {
  /** Low severity - UI glitch, non-critical feature failure */
  Low = "low",

  /** Medium severity - Feature unavailable, degraded functionality */
  Medium = "medium",

  /** High severity - Major feature failure, data loss risk */
  High = "high",

  /** Critical severity - App crash, security issue */
  Critical = "critical",
}

/**
 * Error category for classification.
 *
 * Used for analytics and targeted error handling.
 */
export enum ErrorCategory {
  /** Network request failure */
  Network = "network",

  /** IPC communication failure */
  IPC = "ipc",

  /** Validation error */
  Validation = "validation",

  /** Authentication/authorization error */
  Auth = "auth",

  /** Rendering error */
  Render = "render",

  /** State management error */
  State = "state",

  /** Unknown error */
  Unknown = "unknown",
}

/**
 * Error boundary state.
 *
 * Captured by React Error Boundary's `componentDidCatch`.
 *
 * @example
 * ```tsx
 * const [errorState, setErrorState] = useState<ErrorBoundaryState | null>(null);
 *
 * if (errorState) {
 *   return (
 *     <ErrorFallback
 *       error={errorState.error}
 *       errorInfo={errorState.errorInfo}
 *       onRecover={() => setErrorState(null)}
 *     />
 *   );
 * }
 * ```
 */
export interface ErrorBoundaryState {
  /** The error object that was thrown */
  error: Error;

  /** React error info with component stack */
  errorInfo: ReactErrorInfo;

  /** Whether recovery has been attempted */
  recovered: boolean;

  /** Timestamp when error occurred (ISO 8601) */
  timestamp: string;

  /** Error severity level */
  severity: ErrorSeverity;

  /** Error category */
  category: ErrorCategory;

  /** User-facing error message */
  message: string;

  /** Technical details for developers */
  details?: string;

  /** Number of times this error has occurred */
  occurrences: number;
}

/**
 * Error recovery strategy configuration.
 *
 * Defines how to handle specific error types.
 *
 * @example
 * ```ts
 * const strategy: ErrorRecoveryStrategy = {
 *   action: 'retry',
 *   maxRetries: 3,
 *   retryDelay: 1000,
 *   fallbackAction: 'reset',
 *   showNotification: true,
 *   notificationMessage: 'Connection failed. Retrying...'
 * };
 * ```
 */
export interface ErrorRecoveryStrategy {
  /** Primary recovery action */
  action: ErrorRecoveryAction;

  /** Maximum retry attempts (for 'retry' action) */
  maxRetries?: number;

  /** Delay between retries in milliseconds */
  retryDelay?: number;

  /** Fallback action if primary fails */
  fallbackAction?: ErrorRecoveryAction;

  /** Whether to show user notification */
  showNotification: boolean;

  /** Custom notification message */
  notificationMessage?: string;

  /** Route to navigate to (for 'navigate' action) */
  navigateTo?: string;

  /** Whether to log error to analytics */
  logToAnalytics: boolean;
}

/**
 * Error boundary configuration.
 *
 * @example
 * ```ts
 * const config: ErrorBoundaryConfig = {
 *   name: 'ChatErrorBoundary',
 *   fallbackComponent: ChatErrorFallback,
 *   onError: (error, errorInfo) => {
 *     logErrorToService(error, errorInfo);
 *   },
 *   recoveryStrategies: {
 *     NetworkError: { action: 'retry', maxRetries: 3 },
 *     ValidationError: { action: 'reset' }
 *   }
 * };
 * ```
 */
export interface ErrorBoundaryConfig {
  /** Unique name for this error boundary */
  name: string;

  /** Fallback component to render on error */
  fallbackComponent?: React.ComponentType<ErrorFallbackProps>;

  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ReactErrorInfo) => void;

  /** Callback after successful recovery */
  onRecover?: () => void;

  /** Recovery strategies by error type */
  recoveryStrategies?: Record<string, ErrorRecoveryStrategy>;

  /** Whether to automatically retry on error */
  autoRetry?: boolean;

  /** Whether to reset state on retry */
  resetOnRetry?: boolean;
}

/**
 * Props for error fallback component.
 *
 * Passed to custom fallback UI components.
 */
export interface ErrorFallbackProps {
  /** The error that was caught */
  error: Error;

  /** React error info with component stack */
  errorInfo?: ReactErrorInfo;

  /** Error boundary state */
  errorState?: ErrorBoundaryState;

  /** Callback to attempt recovery */
  onRecover: (action: ErrorRecoveryAction) => void;

  /** Callback to dismiss error */
  onDismiss?: () => void;

  /** Available recovery actions */
  recoveryActions?: ErrorRecoveryAction[];
}

/**
 * IPC request to log error to backend.
 *
 * Errors are logged to audit trail for debugging.
 */
export interface LogErrorRequest {
  /** Error message */
  message: string;

  /** Error stack trace */
  stack?: string;

  /** Error category */
  category: ErrorCategory;

  /** Error severity */
  severity: ErrorSeverity;

  /** Additional context */
  context?: Record<string, unknown>;

  /** Timestamp (ISO 8601) */
  timestamp: string;
}

/**
 * IPC response for error logging.
 */
export interface LogErrorResponse {
  success: boolean;
  errorId?: string;
  error?: string;
}

/**
 * Global error handler configuration.
 *
 * Applied at the app root level.
 */
export interface GlobalErrorConfig {
  /** Whether to catch unhandled promise rejections */
  catchUnhandledRejections: boolean;

  /** Whether to catch global window errors */
  catchWindowErrors: boolean;

  /** Callback for unhandled errors */
  onUnhandledError?: (error: Error) => void;

  /** Whether to show error notifications */
  showNotifications: boolean;

  /** Default recovery strategy */
  defaultRecoveryStrategy: ErrorRecoveryStrategy;

  /** Maximum errors before forcing reload */
  maxErrorsBeforeReload: number;

  /** Time window for error counting (milliseconds) */
  errorCountWindow: number;
}

/**
 * Error report for analytics/debugging.
 */
export interface ErrorReport {
  /** Unique error ID */
  id: string;

  /** Error message */
  message: string;

  /** Error stack trace */
  stack?: string;

  /** Error category */
  category: ErrorCategory;

  /** Error severity */
  severity: ErrorSeverity;

  /** Component stack (if React error) */
  componentStack?: string;

  /** Browser/OS info */
  userAgent: string;

  /** App version */
  appVersion: string;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Additional context */
  context?: Record<string, unknown>;
}
