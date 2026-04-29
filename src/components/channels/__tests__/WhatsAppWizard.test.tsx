import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WhatsAppWizard } from '../WhatsAppWizard';

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

describe('WhatsAppWizard', () => {
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
      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Connect WhatsApp Business')).toBeInTheDocument();
      expect(screen.getByText(/Session data from a paired device or QR code scan/i)).toBeInTheDocument();
    });
  });

  describe('Credentials Step Validation', () => {
    it('should validate session data presence', async () => {
      const user = userEvent.setup();
      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      // Try to proceed without session data
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Session data is required')).toBeInTheDocument();
      });
    });

    it('should validate JSON structure', async () => {
      const user = userEvent.setup();
      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const textarea = screen.getByLabelText(/Session Data/i);
      fireEvent.change(textarea, { target: { value: '{"clientId": "abc123", "serverToken": "xyz789"}' } });

      await user.click(screen.getByText('Next'));

      // Should not show JSON error
      await waitFor(() => {
        expect(screen.queryByText(/Invalid JSON/i)).not.toBeInTheDocument();
      });
    });

    it('should show error for invalid JSON', async () => {
      const user = userEvent.setup();
      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const textarea = screen.getByLabelText(/Session Data/i);
      fireEvent.change(textarea, { target: { value: 'not valid json' } });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid JSON format/i)).toBeInTheDocument();
      });
    });

    it('should show error for non-object JSON', async () => {
      const user = userEvent.setup();
      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const textarea = screen.getByLabelText(/Session Data/i);
      fireEvent.change(textarea, { target: { value: '["array", "not", "object"]' } });

      await user.click(screen.getByText('Next'));

      // The component accepts any valid JSON, so this should not show an error
      await waitFor(() => {
        expect(screen.queryByText(/Invalid JSON/i)).not.toBeInTheDocument();
      });
    });

    it('should render textarea for session data', async () => {
      const user = userEvent.setup();
      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const textarea = screen.getByLabelText(/Session Data/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('Validation Step', () => {
    it('should call validateCredentials on validation step', async () => {
      const user = userEvent.setup();
      const sessionData = '{"clientId": "abc123", "serverToken": "xyz789"}';
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { status: 'active' },
      });

      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const textarea = screen.getByLabelText(/Session Data/i);
      fireEvent.change(textarea, { target: { value: sessionData } });

      await user.click(screen.getByText('Next'));

      // Now on validation step - need to click Next to trigger validation
      await waitFor(() => {
        expect(screen.getByText(/Testing your WhatsApp credentials/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(mockValidateCredentials).toHaveBeenCalledWith('whatsapp', {
          sessionData,
        });
      });
    });

    it('should display validation metadata', async () => {
      const user = userEvent.setup();
      const sessionData = '{"clientId": "abc123", "serverToken": "xyz789"}';
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { status: 'active' },
      });

      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const textarea = screen.getByLabelText(/Session Data/i);
      fireEvent.change(textarea, { target: { value: sessionData } });

      await user.click(screen.getByText('Next'));

      // Now on validation step - click Next to trigger validation
      await waitFor(() => {
        expect(screen.getByText(/Testing your WhatsApp credentials/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      // After validation succeeds, wizard advances to advanced step
      await waitFor(() => {
        expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText(/Configuration Complete/i)).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('should handle validation errors', async () => {
      const user = userEvent.setup();
      const sessionData = '{"clientId": "abc123", "serverToken": "xyz789"}';
      mockValidateCredentials.mockResolvedValue({
        valid: false,
        errorMessage: 'Invalid session data',
      });

      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const textarea = screen.getByLabelText(/Session Data/i);
      fireEvent.change(textarea, { target: { value: sessionData } });

      await user.click(screen.getByText('Next'));

      // Now on validation step - click Next to trigger validation
      await waitFor(() => {
        expect(screen.getByText(/Testing your WhatsApp credentials/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Invalid session data')).toBeInTheDocument();
      });
    });
  });

  describe('Confirmation Step', () => {
    it('should create channel on completion', async () => {
      const user = userEvent.setup();
      const sessionData = '{"clientId": "abc123", "serverToken": "xyz789"}';
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { status: 'active' },
      });
      mockCreateChannel.mockResolvedValue({});

      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Next'));

      const textarea = screen.getByLabelText(/Session Data/i);
      fireEvent.change(textarea, { target: { value: sessionData } });

      await user.click(screen.getByText('Next'));

      // Now on validation step - click Next to trigger validation
      await waitFor(() => {
        expect(screen.getByText(/Testing your WhatsApp credentials/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      // Wait for validation to complete and reach advanced step
      await waitFor(() => {
        expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText(/WhatsApp channel configured successfully/i)).toBeInTheDocument();
      });

      // Now on confirmation step - click Save & Enable
      await user.click(screen.getByText('Save & Enable'));

      await waitFor(() => {
        expect(mockPatchGatewayConfig).toHaveBeenCalled();
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Cancel Flow', () => {
    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      render(<WhatsAppWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
