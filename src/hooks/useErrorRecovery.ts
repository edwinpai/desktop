/**
 * Phase 6 Group D: Error Recovery Hook
 *
 * Hook for connection recovery with exponential backoff (5s → 10s → 20s).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  onRetry?: (attempt: number) => void | Promise<void>;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
  showToast?: boolean;
}

export interface ErrorRecoveryState {
  isRecovering: boolean;
  retryCount: number;
  lastError: Error | null;
  nextRetryDelay: number | null;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_DELAYS = [5000, 10000, 20000] as const; // 5s, 10s, 20s
const DEFAULT_BASE_DELAY: number = DEFAULT_DELAYS[0];
const DEFAULT_MAX_DELAY: number = DEFAULT_DELAYS[DEFAULT_DELAYS.length - 1] ?? 20000;

/**
 * Hook for automatic error recovery with exponential backoff.
 *
 * Features:
 * - Exponential backoff: 5s → 10s → 20s
 * - Automatic retry on connection errors
 * - Toast notifications for retry status
 * - Manual retry trigger
 * - Recovery state tracking
 *
 * @example
 * ```tsx
 * const { recover, state, reset } = useErrorRecovery({
 *   maxRetries: 3,
 *   onRetry: async (attempt) => {
 *     await reconnectToGateway();
 *   },
 *   onSuccess: () => {
 *     console.log('Connection restored');
 *   }
 * });
 *
 * // Trigger recovery on error
 * try {
 *   await sendMessage();
 * } catch (error) {
 *   await recover(error);
 * }
 * ```
 */
export function useErrorRecovery(options: ErrorRecoveryOptions = {}) {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = DEFAULT_BASE_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    onRetry,
    onSuccess,
    onFailure,
    showToast = true,
  } = options;

  const [state, setState] = useState<ErrorRecoveryState>({
    isRecovering: false,
    retryCount: 0,
    lastError: null,
    nextRetryDelay: null,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const effectiveBaseDelay: number = baseDelay ?? DEFAULT_BASE_DELAY;
  const effectiveMaxDelay: number = maxDelay ?? DEFAULT_MAX_DELAY;

  /**
   * Calculate next retry delay with exponential backoff.
   */
  const getRetryDelay = useCallback((attempt: number): number => {
    if (attempt < DEFAULT_DELAYS.length) {
      return DEFAULT_DELAYS[attempt] ?? DEFAULT_BASE_DELAY;
    }

    // Exponential backoff: delay = baseDelay * 2^attempt
    const delay = effectiveBaseDelay * Math.pow(2, attempt);
    return Math.min(delay, effectiveMaxDelay);
  }, [effectiveBaseDelay, effectiveMaxDelay]);

  /**
   * Execute retry attempt.
   */
  const executeRetry = useCallback(async (initialError: Error, initialAttempt: number): Promise<boolean> => {
    let error = initialError;

    for (let attempt = initialAttempt; attempt < maxRetries; attempt += 1) {
      const delay = getRetryDelay(attempt);

      setState(prev => ({
        ...prev,
        isRecovering: true,
        retryCount: attempt + 1,
        nextRetryDelay: delay,
      }));

      if (showToast) {
        toast.info('Connection lost', {
          description: `Retrying in ${delay / 1000}s... (${attempt + 1}/${maxRetries})`,
          duration: delay,
        });
      }

      await new Promise<void>((resolve) => {
        retryTimeoutRef.current = setTimeout(() => resolve(), delay);
      });

      try {
        await onRetry?.(attempt + 1);

        setState({
          isRecovering: false,
          retryCount: 0,
          lastError: null,
          nextRetryDelay: null,
        });

        if (showToast) {
          toast.success('Connection restored', {
            description: 'Successfully reconnected',
          });
        }

        onSuccess?.();
        return true;
      } catch (retryError) {
        error = retryError instanceof Error ? retryError : new Error('Retry failed');

        setState(prev => ({
          ...prev,
          lastError: error,
        }));
      }
    }

    setState(prev => ({
      ...prev,
      isRecovering: false,
      nextRetryDelay: null,
    }));

    if (showToast) {
      toast.error('Recovery failed', {
        description: 'Maximum retry attempts reached',
      });
    }

    onFailure?.(error);
    return false;
  }, [maxRetries, getRetryDelay, onRetry, onSuccess, onFailure, showToast]);

  /**
   * Start recovery process.
   */
  const recover = useCallback(async (error: Error): Promise<boolean> => {
    // Cancel any ongoing recovery
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState({
      isRecovering: true,
      retryCount: 0,
      lastError: error,
      nextRetryDelay: DEFAULT_DELAYS[0] ?? null,
    });

    return executeRetry(error, 0);
  }, [executeRetry]);

  /**
   * Reset recovery state.
   */
  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState({
      isRecovering: false,
      retryCount: 0,
      lastError: null,
      nextRetryDelay: null,
    });
  }, []);

  /**
   * Manual retry trigger (resets retry count).
   */
  const retryNow = useCallback(async (): Promise<boolean> => {
    if (!state.lastError) {
      return false;
    }

    reset();
    return recover(state.lastError);
  }, [state.lastError, reset, recover]);

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    recover,
    reset,
    retryNow,
    state,
  };
}

/**
 * Hook for connection recovery with automatic detection.
 *
 * Automatically attempts recovery when network/IPC errors are detected.
 *
 * @example
 * ```tsx
 * const { wrapAsync } = useConnectionRecovery({
 *   onReconnect: async () => {
 *     await gateway.connect();
 *   }
 * });
 *
 * const handleSendMessage = wrapAsync(async (message) => {
 *   await gateway.send(message);
 * });
 * ```
 */
export function useConnectionRecovery(options: {
  onReconnect: () => void | Promise<void>;
  showToast?: boolean;
}) {
  const { onReconnect, showToast = true } = options;

  const { recover, state, reset, retryNow } = useErrorRecovery({
    maxRetries: 3,
    onRetry: onReconnect,
    showToast,
  });

  /**
   * Wrap an async function with automatic error recovery.
   */
  const wrapAsync = useCallback(<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> => {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');

        // Check if error is recoverable (network/IPC errors)
        if (isRecoverableError(err)) {
          await recover(err);

          // Retry the original operation after recovery
          return await fn(...args);
        }

        // Non-recoverable error, rethrow
        throw error;
      }
    };
  }, [recover]);

  return {
    wrapAsync,
    state,
    reset,
    retryNow,
  };
}

/**
 * Check if an error is recoverable (network/IPC errors).
 */
function isRecoverableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('ipc') ||
    message.includes('tauri') ||
    name.includes('networkerror') ||
    name.includes('timeouterror')
  );
}
