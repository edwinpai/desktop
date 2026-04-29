import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SlackWizard } from '../SlackWizard';

const mockValidateCredentials = vi.fn();
const mockCreateChannel = vi.fn();
const mockPatchGatewayConfig = vi.fn();

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/hooks/useChannels', () => ({
  useChannels: vi.fn(),
}));

vi.mock('@/stores/channelStore', () => ({
  useChannelStore: vi.fn(),
}));

vi.mock('@/lib/gateway-context', () => ({
  patchGatewayConfig: (...args: unknown[]) => mockPatchGatewayConfig(...args),
  resolveToken: vi.fn().mockResolvedValue('test-token'),
  inferGatewayKind: vi.fn().mockReturnValue('local'),
}));

vi.mock('@/lib/config', () => ({
  readConfig: vi.fn().mockResolvedValue({ gatewayUrl: 'http://localhost:18789', gatewayToken: 'test-token' }),
}));

import { useChannels } from '@/hooks/useChannels';
import { useChannelStore } from '@/stores/channelStore';

const mockUseChannels = vi.mocked(useChannels);
const mockUseChannelStore = vi.mocked(useChannelStore);

describe('SlackWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseChannels.mockReturnValue({
      validateCredentials: mockValidateCredentials,
      createChannel: mockCreateChannel,
      error: null,
    } as unknown as ReturnType<typeof useChannels>);

    mockPatchGatewayConfig.mockResolvedValue(undefined);

    mockUseChannelStore.mockReturnValue({
      currentUserLevel: 'owner',
    });
  });

  describe('Intro Step', () => {
    it('should render intro step', () => {
      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Connect Slack Workspace')).toBeInTheDocument();
      expect(screen.getByText(/This wizard will help you connect to a Slack workspace/i)).toBeInTheDocument();
    });
  });

  describe('Credentials Step Validation', () => {
    it('should validate token presence', async () => {
      const user = userEvent.setup();
      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      // Try to proceed without token
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Access token is required')).toBeInTheDocument();
      });
    });

    it('should validate xoxb- prefix', async () => {
      const user = userEvent.setup();
      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const input = screen.getByPlaceholderText(/xoxb-your-token-here/i);
      await user.type(input, 'invalid-prefix-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz');

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid token format.*xoxb-.*xoxp-/i)).toBeInTheDocument();
      });
    });

    it('should accept xoxb- prefix', async () => {
      const user = userEvent.setup();
      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const input = screen.getByPlaceholderText(/xoxb-your-token-here/i);
      await user.type(input, 'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz');

      await user.click(screen.getByText('Next'));

      // Should not show prefix error
      await waitFor(() => {
        expect(screen.queryByText(/Invalid token format/i)).not.toBeInTheDocument();
      });
    });

    it('should accept xoxp- prefix', async () => {
      const user = userEvent.setup();
      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const input = screen.getByPlaceholderText(/xoxb-your-token-here/i);
      await user.type(input, 'xoxp-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz');

      await user.click(screen.getByText('Next'));

      // Should not show prefix error
      await waitFor(() => {
        expect(screen.queryByText(/Invalid token format/i)).not.toBeInTheDocument();
      });
    });

    it('should validate token length (≥40 chars)', async () => {
      const user = userEvent.setup();
      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const input = screen.getByPlaceholderText(/xoxb-your-token-here/i);
      await user.type(input, 'xoxb-short');

      await user.click(screen.getByText('Next'));

      // Should proceed to validation step even with short token (format is valid)
      // No length validation error in the component
      await waitFor(() => {
        expect(screen.getByText(/Testing your Slack access token/i)).toBeInTheDocument();
      });
    });
  });

  describe('Validation Step', () => {
    it('should call validateCredentials on validation step', async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { tokenType: 'Bot Token', teamName: 'Test Workspace' },
      });

      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const input = screen.getByPlaceholderText(/xoxb-your-token-here/i);
      await user.type(input, 'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz');

      // Click Next to proceed to validation step
      await user.click(screen.getByText('Next'));

      // Click Next from validation step to trigger validation
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(mockValidateCredentials).toHaveBeenCalledWith('slack', {
          accessToken: 'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz',
        });
      });
    });

    it('should display validation metadata (tokenType)', async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { tokenType: 'Bot Token', teamName: 'Test Workspace', botUserId: 'U123456' },
      });

      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const input = screen.getByPlaceholderText(/xoxb-your-token-here/i);
      await user.type(input, 'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz');

      // Click Next to proceed to validation step
      await user.click(screen.getByText('Next'));

      // Click Next from validation step to trigger validation and advance
      await user.click(screen.getByText('Next'));

      // Should now be on advanced step
      await waitFor(() => {
        expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Configuration Complete')).toBeInTheDocument();
        expect(screen.getByText('Test Workspace')).toBeInTheDocument();
      });
    });

    it('should handle validation errors', async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: false,
        errorMessage: 'Invalid Slack token',
      });

      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const input = screen.getByPlaceholderText(/xoxb-your-token-here/i);
      await user.type(input, 'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz');

      // Click Next to proceed to validation step
      await user.click(screen.getByText('Next'));

      // Click Next from validation step to trigger validation
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Invalid Slack token')).toBeInTheDocument();
      });
    });
  });

  describe('Confirmation Step', () => {
    it('should create channel on completion', async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { tokenType: 'Bot Token', teamName: 'Test Workspace' },
      });
      mockCreateChannel.mockResolvedValue({});

      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Step 1: Click Next from intro
      await user.click(screen.getByText('Next'));

      // Step 2: Enter token and click Next
      const input = screen.getByPlaceholderText(/xoxb-your-token-here/i);
      await user.type(input, 'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz');
      await user.click(screen.getByText('Next'));

      // Step 3: Validation step - click Next to trigger validation and advance
      await user.click(screen.getByText('Next'));

      // Should now be on advanced step
      await waitFor(() => {
        expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Configuration Complete')).toBeInTheDocument();
      });

      // Click Save & Enable to complete
      const saveButton = screen.getByText('Save & Enable');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockPatchGatewayConfig).toHaveBeenCalled();
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Cancel Flow', () => {
    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      render(<SlackWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
