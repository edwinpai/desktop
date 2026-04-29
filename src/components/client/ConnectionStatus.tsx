/**
 * Connection Status - Displays connection state (connected/disconnecting/error)
 */

import type { ClientConnectionStatus } from '@/types/api';

interface ConnectionStatusProps {
  status: ClientConnectionStatus;
  gatewayName?: string;
  error?: string | null;
}

export function ConnectionStatus({ status, gatewayName, error }: ConnectionStatusProps) {
  const getStatusDisplay = () => {
    switch (status) {
      case 'connected':
        return {
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-green-500"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="16 12 12 8 8 12" />
              <line x1="12" y1="16" x2="12" y2="8" />
            </svg>
          ),
          title: 'Connected',
          message: gatewayName
            ? `Successfully connected to ${gatewayName}`
            : 'Successfully connected to gateway',
          variant: 'success' as const,
        };

      case 'connecting':
        return {
          icon: (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          ),
          title: 'Connecting',
          message: gatewayName
            ? `Authenticating with ${gatewayName}...`
            : 'Authenticating with gateway...',
          variant: 'loading' as const,
        };

      case 'reconnecting':
        return {
          icon: (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          ),
          title: 'Reconnecting',
          message: 'Connection lost. Attempting to reconnect...',
          variant: 'warning' as const,
        };

      case 'failed':
        return {
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-500"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ),
          title: 'Connection Failed',
          message: error || 'Failed to connect to gateway',
          variant: 'error' as const,
        };

      case 'disconnected':
      default:
        return {
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground/50"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          ),
          title: 'Disconnected',
          message: 'Not connected to any gateway',
          variant: 'neutral' as const,
        };
    }
  };

  const { icon, title, message, variant } = getStatusDisplay();

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4">{icon}</div>
      <h3
        className={`text-lg font-semibold mb-2 ${
          variant === 'success'
            ? 'text-green-600'
            : variant === 'error'
            ? 'text-red-600'
            : variant === 'warning'
            ? 'text-orange-600'
            : ''
        }`}
      >
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>

      {status === 'connected' && (
        <div className="mt-4 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
          <p className="text-xs text-green-700 font-medium">
            Encrypted connection established
          </p>
        </div>
      )}

      {error && status !== 'failed' && (
        <div className="mt-4 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg max-w-md">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
