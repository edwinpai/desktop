import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TelegramWizard } from '../TelegramWizard';

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

describe('TelegramWizard', () => {
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
      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Connect Telegram Bot')).toBeInTheDocument();
      expect(screen.getByText(/This wizard will help you connect a Telegram bot/i)).toBeInTheDocument();
    });

    it('should display instructions for creating bot', () => {
      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText(/Open Telegram and search for @BotFather/i)).toBeInTheDocument();
      expect(screen.getByText(/Send \/newbot and follow the prompts/i)).toBeInTheDocument();
    });
  });

  describe('Credentials Step Validation', () => {
    it('should validate bot token format (BOT_ID:AUTH_TOKEN)', async () => {
      const user = userEvent.setup();
      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Move to credentials step
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      // Enter valid token
      const input = screen.getByPlaceholderText(/123456789:ABC/i);
      await user.type(input, '123456789:ABCdefGHIjklMNOpqrsTUVwxyz012345678w11');

      // Should not show error
      expect(screen.queryByText(/Invalid token format/i)).not.toBeInTheDocument();
    });

    it('should show error for invalid format', async () => {
      const user = userEvent.setup();
      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Move to credentials step
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      // Enter invalid token (missing colon)
      const input = screen.getByPlaceholderText(/123456789:ABC/i);
      await user.type(input, '123456ABC-DEF1234ghIkl');

      // Try to proceed
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid token format/i)).toBeInTheDocument();
      });
    });

    it('should show error for non-numeric bot ID', async () => {
      const user = userEvent.setup();
      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Move to credentials step
      await user.click(screen.getByText('Next'));

      // Enter token with non-numeric bot ID
      const input = screen.getByPlaceholderText(/123456789:ABC/i);
      await user.type(input, 'abc123:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');

      // Try to proceed
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid token format/i)).toBeInTheDocument();
      });
    });

    it('should show error for short auth token (<30 chars)', async () => {
      const user = userEvent.setup();
      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Move to credentials step
      await user.click(screen.getByText('Next'));

      // Enter token with short auth token
      const input = screen.getByPlaceholderText(/123456789:ABC/i);
      await user.type(input, '123456789:short');

      // Try to proceed
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid token format/i)).toBeInTheDocument();
      });
    });

    it('should show error for empty token', async () => {
      const user = userEvent.setup();
      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Move to credentials step
      await user.click(screen.getByText('Next'));

      // Try to proceed without entering token
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Bot token is required')).toBeInTheDocument();
      });
    });
  });

  describe('Validation Step', () => {
    it('should call validateCredentials on validation step', async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { botId: '123456' },
      });

      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Navigate to credentials step
      await user.click(screen.getByText('Next'));

      // Enter valid token (35 chars after colon)
      const input = screen.getByPlaceholderText(/123456789:ABC/i);
      await user.type(input, '123456789:ABCdefGHIjklMNOpqrsTUVwxyz012345678');

      // Click Next to proceed to validation step
      await user.click(screen.getByText('Next'));

      // Now on validation step - wait for it to render
      await waitFor(() => {
        expect(screen.getByText(/Testing your Telegram bot token/i)).toBeInTheDocument();
      });

      // Click Next from validation step to trigger validateCredentials
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(mockValidateCredentials).toHaveBeenCalledWith('telegram', {
          botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz012345678',
        });
      });
    });

    it('should display validation metadata (botId)', async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { botId: '123456789', username: 'testbot' },
      });

      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Navigate through steps
      await user.click(screen.getByText('Next'));
      const input = screen.getByPlaceholderText(/123456789:ABC/i);
      await user.type(input, '123456789:ABCdefGHIjklMNOpqrsTUVwxyz012345678');
      await user.click(screen.getByText('Next'));

      // Now on validation step - wait for it to render
      await waitFor(() => {
        expect(screen.getByText(/Testing your Telegram bot token/i)).toBeInTheDocument();
      });

      // Click Next from validation step to trigger validation and advance
      await user.click(screen.getByText('Next'));

      // Should now be on advanced step
      await waitFor(() => {
        expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Configuration Complete')).toBeInTheDocument();
        expect(screen.getByText('123456789')).toBeInTheDocument();
      });
    });

    it('should handle validation errors', async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: false,
        errorMessage: 'Invalid bot token',
      });

      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Navigate through steps
      await user.click(screen.getByText('Next'));
      const input = screen.getByPlaceholderText(/123456789:ABC/i);
      await user.type(input, '123456789:ABCdefGHIjklMNOpqrsTUVwxyz012345678');
      await user.click(screen.getByText('Next'));

      // Now on validation step - wait for it to render
      await waitFor(() => {
        expect(screen.getByText(/Testing your Telegram bot token/i)).toBeInTheDocument();
      });

      // Click Next from validation step to trigger validation
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Invalid bot token')).toBeInTheDocument();
      });
    });
  });

  describe('Confirmation Step', () => {
    it('should create channel on completion', async () => {
      const user = userEvent.setup();

      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { botId: '123456789', username: 'testbot' },
      });

      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      // Step 1: Click Next from intro
      await user.click(screen.getByText('Next'));

      // Step 2: Enter token and click Next
      const input = screen.getByPlaceholderText(/123456789:ABC/i);
      await user.type(input, '123456789:ABCdefGHIjklMNOpqrsTUVwxyz012345678');
      await user.click(screen.getByText('Next'));

      // Now on validation step
      await waitFor(() => {
        expect(screen.getByText(/Testing your Telegram bot token/i)).toBeInTheDocument();
      });

      // Step 3: Validation step - click Next to trigger validation and advance
      await user.click(screen.getByText('Next'));

      // Step 4: Advanced step
      await waitFor(() => {
        expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      // Should now be on confirmation step
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
      render(<TelegramWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
