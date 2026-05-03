/**
 * Phase 6 Group D: Error Boundary Component
 *
 * React Error Boundary with retry logic, exponential backoff, and toast notifications.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ErrorSeverity,
  ErrorCategory,
  type ErrorBoundaryState,
  type ErrorBoundaryConfig,
  type ErrorFallbackProps,
  type ErrorRecoveryAction,
} from "@/types/errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Home, XCircle } from "lucide-react";

interface ErrorBoundaryProps extends Partial<ErrorBoundaryConfig> {
  children: ReactNode;
}

interface ErrorBoundaryComponentState {
  errorState: ErrorBoundaryState | null;
  retryCount: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

/**
 * Default error fallback component.
 */
function DefaultErrorFallback({
  error,
  errorInfo,
  errorState,
  onRecover,
  onDismiss,
}: ErrorFallbackProps) {
  const canRetry = errorState && errorState.occurrences < MAX_RETRIES;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            {errorState?.severity === ErrorSeverity.Critical
              ? "A critical error occurred. Please restart the application."
              : "An error occurred while rendering this component."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{errorState?.message || error.message}</AlertTitle>
            {errorState?.details && (
              <AlertDescription className="mt-2">
                <details className="cursor-pointer">
                  <summary className="font-medium">Technical Details</summary>
                  <pre className="mt-2 text-xs overflow-x-auto p-2 bg-muted rounded">
                    {errorState.details}
                  </pre>
                </details>
              </AlertDescription>
            )}
          </Alert>

          {errorInfo && (
            <details className="cursor-pointer">
              <summary className="font-medium text-sm">Component Stack</summary>
              <pre className="mt-2 text-xs overflow-x-auto p-2 bg-muted rounded">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-2">
            {canRetry && (
              <Button onClick={() => onRecover("retry")} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry ({errorState.occurrences}/{MAX_RETRIES})
              </Button>
            )}
            <Button
              onClick={() => onRecover("reset")}
              variant={canRetry ? "outline" : "default"}
              className="flex-1"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              onClick={() => onRecover("navigate")}
              variant="outline"
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
            {onDismiss && (
              <Button onClick={onDismiss} variant="ghost">
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>

          {errorState && (
            <p className="text-xs text-muted-foreground">
              Error occurred at{" "}
              {new Date(errorState.timestamp).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Error Boundary Component with retry logic and exponential backoff.
 *
 * Features:
 * - Catches React rendering errors
 * - 3 automatic retries with exponential backoff (1s → 2s → 4s)
 * - Toast notifications for errors
 * - Customizable fallback UI
 * - Error severity classification
 * - Recovery actions: retry, reset, navigate, reload
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   name="ChatErrorBoundary"
 *   onError={(error, errorInfo) => {
 *     console.error('Chat error:', error, errorInfo);
 *   }}
 * >
 *   <ChatView />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryComponentState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      errorState: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<ErrorBoundaryComponentState> {
    // Update state so the next render will show the fallback UI
    return {
      errorState: {
        error,
        errorInfo: { componentStack: "" },
        recovered: false,
        timestamp: new Date().toISOString(),
        severity: ErrorSeverity.Medium,
        category: ErrorCategory.Render,
        message: error.message || "An unexpected error occurred",
        occurrences: 1,
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { name = "ErrorBoundary", onError, autoRetry = true } = this.props;
    const { retryCount } = this.state;

    // Classify error
    const severity = this.classifyErrorSeverity(error);
    const category = this.classifyErrorCategory(error);

    // Build error state
    const errorState: ErrorBoundaryState = {
      error,
      errorInfo,
      recovered: false,
      timestamp: new Date().toISOString(),
      severity,
      category,
      message: this.getUserFriendlyMessage(error, category),
      details: error.stack,
      occurrences: retryCount + 1,
    };

    this.setState({ errorState });

    // Log error
    console.error(`[${name}] Error caught:`, error, errorInfo);
    onError?.(error, errorInfo);

    // Show toast notification
    const toastMessage = `${errorState.message} (${errorState.occurrences}/${MAX_RETRIES})`;

    if (severity === ErrorSeverity.Critical) {
      toast.error("Critical Error", {
        description: toastMessage,
        duration: Infinity,
      });
    } else {
      toast.error("Error", {
        description: toastMessage,
        duration: 5000,
      });
    }

    // Auto-retry with exponential backoff
    if (autoRetry && retryCount < MAX_RETRIES) {
      const delay =
        RETRY_DELAYS[retryCount] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];

      if (delay) {
        toast.info("Auto-retry", {
          description: `Retrying in ${delay / 1000}s...`,
          duration: delay,
        });

        this.retryTimeoutId = setTimeout(() => {
          this.handleRecover("retry");
        }, delay);
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * Classify error severity based on error type and message.
   */
  private classifyErrorSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();

    if (message.includes("critical") || message.includes("security")) {
      return ErrorSeverity.Critical;
    }

    if (message.includes("network") || message.includes("timeout")) {
      return ErrorSeverity.Medium;
    }

    if (message.includes("validation") || message.includes("format")) {
      return ErrorSeverity.Low;
    }

    return ErrorSeverity.Medium;
  }

  /**
   * Classify error category based on error type and message.
   */
  private classifyErrorCategory(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout")
    ) {
      return ErrorCategory.Network;
    }

    if (message.includes("ipc") || message.includes("tauri")) {
      return ErrorCategory.IPC;
    }

    if (message.includes("validation") || message.includes("invalid")) {
      return ErrorCategory.Validation;
    }

    if (message.includes("auth") || message.includes("permission")) {
      return ErrorCategory.Auth;
    }

    if (name.includes("error") && message.includes("render")) {
      return ErrorCategory.Render;
    }

    if (message.includes("state") || message.includes("store")) {
      return ErrorCategory.State;
    }

    return ErrorCategory.Unknown;
  }

  /**
   * Get user-friendly error message based on category.
   */
  private getUserFriendlyMessage(
    error: Error,
    category: ErrorCategory,
  ): string {
    switch (category) {
      case ErrorCategory.Network:
        return "Network connection failed. Please check your internet connection.";
      case ErrorCategory.IPC:
        return "Communication with the app backend failed. Try restarting the app.";
      case ErrorCategory.Validation:
        return "Invalid data detected. Please check your input.";
      case ErrorCategory.Auth:
        return "Authentication failed. Please sign in again.";
      case ErrorCategory.Render:
        return "Failed to display this component. Retrying...";
      case ErrorCategory.State:
        return "App state is corrupted. Resetting...";
      default:
        return error.message || "An unexpected error occurred.";
    }
  }

  /**
   * Handle recovery action.
   */
  private handleRecover = (action: ErrorRecoveryAction) => {
    const { onRecover } = this.props;
    const { retryCount } = this.state;

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    switch (action) {
      case "retry":
        this.setState({
          errorState: null,
          retryCount: retryCount + 1,
        });
        toast.info("Retrying...");
        break;

      case "reset":
        this.setState({
          errorState: null,
          retryCount: 0,
        });
        toast.info("Resetting...");
        onRecover?.();
        break;

      case "navigate":
        this.setState({
          errorState: null,
          retryCount: 0,
        });
        window.location.hash = "/";
        toast.info("Navigating to home...");
        break;

      case "reload":
        toast.info("Reloading app...");
        window.location.reload();
        break;

      case "ignore":
        this.setState({ errorState: null });
        break;
    }
  };

  /**
   * Handle dismiss (same as ignore).
   */
  private handleDismiss = () => {
    this.handleRecover("ignore");
  };

  render() {
    const { children, fallbackComponent: FallbackComponent } = this.props;
    const { errorState } = this.state;

    if (errorState) {
      const FallbackUI = FallbackComponent || DefaultErrorFallback;

      return (
        <FallbackUI
          error={errorState.error}
          errorInfo={errorState.errorInfo}
          errorState={errorState}
          onRecover={this.handleRecover}
          onDismiss={this.handleDismiss}
          recoveryActions={["retry", "reset", "navigate", "reload"]}
        />
      );
    }

    return children;
  }
}
