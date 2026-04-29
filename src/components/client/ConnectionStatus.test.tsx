import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ConnectionStatus } from './ConnectionStatus';

import type { ClientConnectionStatus } from '@/types/api';

describe('ConnectionStatus', () => {
  // Connected state tests
  it('renders connected state with default message', () => {
    render(<ConnectionStatus status="connected" />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Successfully connected to gateway')).toBeInTheDocument();
  });

  it('renders connected state with gateway name', () => {
    render(<ConnectionStatus status="connected" gatewayName="alice-gateway" />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Successfully connected to alice-gateway')).toBeInTheDocument();
  });

  it('shows encryption badge when connected', () => {
    render(<ConnectionStatus status="connected" />);

    expect(screen.getByText('Encrypted connection established')).toBeInTheDocument();

    const badge = screen.getByText('Encrypted connection established').parentElement;
    expect(badge).toHaveClass('bg-green-50', 'border-green-200');
  });

  it('applies success styling to connected state', () => {
    render(<ConnectionStatus status="connected" />);

    const title = screen.getByText('Connected');
    expect(title).toHaveClass('text-green-600');
  });

  // Connecting state tests
  it('renders connecting state with default message', () => {
    render(<ConnectionStatus status="connecting" />);

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.getByText('Authenticating with gateway...')).toBeInTheDocument();
  });

  it('renders connecting state with gateway name', () => {
    render(<ConnectionStatus status="connecting" gatewayName="bob-gateway" />);

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.getByText('Authenticating with bob-gateway...')).toBeInTheDocument();
  });

  it('shows spinner when connecting', () => {
    const { container } = render(<ConnectionStatus status="connecting" />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('border-primary');
  });

  it('does not show encryption badge when connecting', () => {
    render(<ConnectionStatus status="connecting" />);

    expect(
      screen.queryByText('Encrypted connection established')
    ).not.toBeInTheDocument();
  });

  // Reconnecting state tests
  it('renders reconnecting state', () => {
    render(<ConnectionStatus status="reconnecting" />);

    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
    expect(
      screen.getByText('Connection lost. Attempting to reconnect...')
    ).toBeInTheDocument();
  });

  it('shows orange spinner when reconnecting', () => {
    const { container } = render(<ConnectionStatus status="reconnecting" />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('border-orange-500');
  });

  it('applies warning styling to reconnecting state', () => {
    render(<ConnectionStatus status="reconnecting" />);

    const title = screen.getByText('Reconnecting');
    expect(title).toHaveClass('text-orange-600');
  });

  // Failed state tests
  it('renders failed state with default error message', () => {
    render(<ConnectionStatus status="failed" />);

    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect to gateway')).toBeInTheDocument();
  });

  it('renders failed state with custom error message', () => {
    render(<ConnectionStatus status="failed" error="Authentication timeout" />);

    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    expect(screen.getByText('Authentication timeout')).toBeInTheDocument();
  });

  it('applies error styling to failed state', () => {
    render(<ConnectionStatus status="failed" />);

    const title = screen.getByText('Connection Failed');
    expect(title).toHaveClass('text-red-600');
  });

  it('shows error icon for failed state', () => {
    const { container } = render(<ConnectionStatus status="failed" />);

    const errorIcon = container.querySelector('svg.text-red-500');
    expect(errorIcon).toBeInTheDocument();
  });

  // Disconnected state tests
  it('renders disconnected state', () => {
    render(<ConnectionStatus status="disconnected" />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Not connected to any gateway')).toBeInTheDocument();
  });

  it('does not apply color styling to disconnected state', () => {
    render(<ConnectionStatus status="disconnected" />);

    const title = screen.getByText('Disconnected');
    expect(title).not.toHaveClass('text-green-600');
    expect(title).not.toHaveClass('text-red-600');
    expect(title).not.toHaveClass('text-orange-600');
  });

  // Error handling tests
  it('shows error message separately when not in failed state', () => {
    render(<ConnectionStatus status="connecting" error="Temporary network issue" />);

    const errorBox = screen.getByText('Temporary network issue');
    expect(errorBox.parentElement).toHaveClass('bg-red-50', 'border-red-200');
  });

  it('does not show separate error box in failed state', () => {
    render(<ConnectionStatus status="failed" error="Connection refused" />);

    // Error should be in main message, not in separate box
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
    expect(screen.getAllByText('Connection refused')).toHaveLength(1);
  });

  it('handles error prop when no error is provided', () => {
    render(<ConnectionStatus status="connecting" error={null} />);

    expect(screen.queryByText('Temporary network issue')).not.toBeInTheDocument();
  });

  // Edge cases and default handling
  it('handles undefined status as disconnected', () => {
    render(<ConnectionStatus status={undefined as unknown as ClientConnectionStatus} />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('handles invalid status as disconnected', () => {
    render(<ConnectionStatus status={'invalid-status' as ClientConnectionStatus} />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('truncates very long gateway names in message', () => {
    const longName = 'this-is-an-extremely-long-gateway-name-that-might-break-layout';
    render(<ConnectionStatus status="connected" gatewayName={longName} />);

    expect(screen.getByText(`Successfully connected to ${longName}`)).toBeInTheDocument();
  });

  it('handles empty gateway name gracefully', () => {
    render(<ConnectionStatus status="connected" gatewayName="" />);

    // Should fall back to generic message when gatewayName is empty string
    expect(screen.getByText('Successfully connected to gateway')).toBeInTheDocument();
  });
});
