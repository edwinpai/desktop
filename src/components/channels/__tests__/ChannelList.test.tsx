import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelConfig } from '@/types/channels';
import { ChannelList } from '../ChannelList';

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

vi.mock('@/lib/config', () => ({
  readConfig: vi.fn().mockResolvedValue({ gatewayUrl: 'http://localhost:18789', gatewayToken: '' }),
}));

vi.mock('@/lib/gateway-context', () => ({
  fetchChannelStatus: vi.fn().mockResolvedValue({ channels: {} }),
  inferGatewayKind: vi.fn().mockReturnValue('local'),
  resolveToken: vi.fn().mockResolvedValue(''),
  webLoginStart: vi.fn().mockResolvedValue({ qrDataUrl: '', message: '' }),
  webLoginWait: vi.fn().mockResolvedValue({ connected: false, message: '' }),
}));

vi.mock('../MatrixRoomManager', () => ({ MatrixRoomManager: () => <div>MatrixRoomManager</div> }));
vi.mock('../ChannelConfigEditor', () => ({ ChannelConfigEditor: () => <div>Settings</div> }));

type WizardMockProps = { onComplete: () => void; onCancel: () => void };

// Mock wizard components
vi.mock('../TelegramWizard', () => ({
  TelegramWizard: ({ onComplete, onCancel }: WizardMockProps) => (
    <div data-testid="telegram-wizard">
      <button onClick={onComplete}>Complete</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../MatrixWizard', () => ({
  MatrixWizard: ({ onComplete, onCancel }: WizardMockProps) => (
    <div data-testid="matrix-wizard">
      <button onClick={onComplete}>Complete</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../DiscordWizard', () => ({
  DiscordWizard: ({ onComplete, onCancel }: WizardMockProps) => (
    <div data-testid="discord-wizard">
      <button onClick={onComplete}>Complete</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../SlackWizard', () => ({
  SlackWizard: ({ onComplete, onCancel }: WizardMockProps) => (
    <div data-testid="slack-wizard">
      <button onClick={onComplete}>Complete</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../WhatsAppWizard', () => ({
  WhatsAppWizard: ({ onComplete, onCancel }: WizardMockProps) => (
    <div data-testid="whatsapp-wizard">
      <button onClick={onComplete}>Complete</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../SignalWizard', () => ({
  SignalWizard: ({ onComplete, onCancel }: WizardMockProps) => (
    <div data-testid="signal-wizard">
      <button onClick={onComplete}>Complete</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

import { useChannels } from '@/hooks/useChannels';
import { useChannelStore } from '@/stores/channelStore';

const mockUseChannels = vi.mocked(useChannels);
const mockUseChannelStore = vi.mocked(useChannelStore);

describe('ChannelList', () => {
  const mockToggleChannel = vi.fn();
  const mockDeleteChannel = vi.fn();
  const mockOpenWizard = vi.fn();
  const mockCloseWizard = vi.fn();
  const mockStartPolling = vi.fn();
  const mockStopPolling = vi.fn();
  const mockSetCurrentUserLevel = vi.fn();

  const mockChannels: ChannelConfig[] = [
    {
      channel: 'telegram',
      enabled: true,
      configuredAt: '2026-02-11T10:00:00Z',
      configuredBy: 'owner',
      credentials: { botToken: 'encrypted-token-data' },
      settings: {
        autoReply: true,
        allowedChatIds: [],
      },
    },
    {
      channel: 'discord',
      enabled: false,
      configuredAt: '2026-02-10T15:30:00Z',
      configuredBy: 'owner',
      credentials: { botToken: 'encrypted-bot-token' },
      settings: {
        autoReply: false,
        allowedChatIds: ['123', '456'],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseChannels.mockReturnValue({
      channels: [],
      loading: false,
      error: null,
      refreshChannels: vi.fn(),
      toggleChannel: vi.fn(),
      deleteChannel: vi.fn(),
      createChannel: vi.fn(),
      updateChannel: vi.fn(),
      validateCredentials: vi.fn(),
    });

    mockUseChannelStore.mockReturnValue({
      channels: [],
      isLoading: false,
      error: null,
      wizard: { isOpen: false, channel: null },
      openWizard: mockOpenWizard,
      closeWizard: mockCloseWizard,
      startPolling: mockStartPolling,
      stopPolling: mockStopPolling,
      setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
      toggleChannel: mockToggleChannel,
      deleteChannel: mockDeleteChannel,
    });
  });

  describe('Rendering', () => {
    it('should render list of channels', () => {
      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      expect(screen.getByText('Telegram')).toBeInTheDocument();
      expect(screen.getByText('Discord')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('should render empty state when no channels configured', () => {
      render(<ChannelList />);

      expect(screen.getByText('No Channels Configured')).toBeInTheDocument();
      expect(screen.getByText('Connect your first messaging platform to get started.')).toBeInTheDocument();
    });

    it('should display loading state', () => {
      mockUseChannelStore.mockReturnValue({
        channels: [],
        isLoading: true,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      expect(screen.getByText('Loading channels...')).toBeInTheDocument();
    });

    it('should display error state', () => {
      mockUseChannelStore.mockReturnValue({
        channels: [],
        isLoading: false,
        error: 'Failed to load channels',
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      expect(screen.getByText('Failed to load channels')).toBeInTheDocument();
    });

    it('should filter available channels (not showing configured ones)', () => {
      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Should show unconfigured channels
      expect(screen.getByText('Matrix')).toBeInTheDocument();
      expect(screen.getByText('Slack')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
      expect(screen.getByText('Signal')).toBeInTheDocument();

      // Should not show "Add Telegram" or "Add Discord" buttons since they're configured
      const configureButtons = screen.getAllByText('Configure');
      expect(configureButtons.length).toBe(4); // Matrix, Slack, WhatsApp, Signal
    });
  });

  describe('Channel Operations', () => {
    it('should toggle channel enabled/disabled', async () => {
      const user = userEvent.setup();
      mockToggleChannel.mockResolvedValue({});

      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Find the switch for Telegram (enabled)
      const switches = screen.getAllByRole('switch');
      await user.click(switches[0]!);

      await waitFor(() => {
        expect(mockToggleChannel).toHaveBeenCalledWith('telegram', false);
      });
    });

    it('should open channel config editor when edit button clicked', async () => {
      const user = userEvent.setup();

      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Find edit buttons and click the first one
      const editButtons = screen.getAllByRole('button', { name: '' });
      const editButton = editButtons.find((btn) => btn.querySelector('svg'));
      if (editButton) {
        await user.click(editButton);
      }

      // Edit now opens config editor instead of wizard
      expect(screen.getByText(/Settings/i)).toBeInTheDocument();
    });

    it('should show delete confirmation dialog', async () => {
      const user = userEvent.setup();

      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Find and click a delete button
      const deleteButtons = screen.getAllByRole('button', { name: '' });
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      await user.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText(/Delete this channel/i)).toBeInTheDocument();
      });
    });

    it('should delete channel after confirmation', async () => {
      const user = userEvent.setup();
      mockDeleteChannel.mockResolvedValue(undefined);

      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: '' });
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      await user.click(deleteButton!);

      // Confirm deletion
      await waitFor(() => {
        const confirmButton = screen.getByText('Delete');
        user.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockDeleteChannel).toHaveBeenCalled();
      });
    });

    it('should cancel delete confirmation', async () => {
      const user = userEvent.setup();

      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: '' });
      const deleteButton = deleteButtons[deleteButtons.length - 1];
      await user.click(deleteButton!);

      // Cancel deletion
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        user.click(cancelButton);
      });

      expect(mockDeleteChannel).not.toHaveBeenCalled();
    });

    it('should add new channel via wizard', async () => {
      const user = userEvent.setup();

      render(<ChannelList />);

      // Click "Configure" button for Matrix
      const configureButtons = screen.getAllByText('Configure');
      await user.click(configureButtons[0]!);

      expect(mockOpenWizard).toHaveBeenCalled();
    });
  });

  describe('Permission Checks', () => {
    it('should disable actions for guest users', () => {
      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList currentUserLevel="guest" />);

      expect(screen.getByText(/read-only access/i)).toBeInTheDocument();

      // Check that switches are disabled
      const switches = screen.getAllByRole('switch');
      switches.forEach((switchEl) => {
        expect(switchEl).toBeDisabled();
      });
    });

    it('should enable actions for owner users', () => {
      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList currentUserLevel="owner" />);

      expect(screen.queryByText(/read-only access/i)).not.toBeInTheDocument();

      // Check that switches are enabled
      const switches = screen.getAllByRole('switch');
      switches.forEach((switchEl) => {
        expect(switchEl).not.toBeDisabled();
      });
    });

    it('should enable actions for member users', () => {
      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList currentUserLevel="member" />);

      expect(screen.queryByText(/read-only access/i)).not.toBeInTheDocument();
    });
  });

  describe('Wizard Integration', () => {
    it('should open telegram wizard', async () => {
      mockUseChannelStore.mockReturnValue({
        channels: [],
        isLoading: false,
        error: null,
        wizard: { isOpen: true, channel: 'telegram' },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Wait for lazy-loaded wizard to appear
      await waitFor(() => {
        expect(screen.getByTestId('telegram-wizard')).toBeInTheDocument();
      });
    });

    it('should close wizard on cancel', async () => {
      const user = userEvent.setup();
      mockUseChannelStore.mockReturnValue({
        channels: [],
        isLoading: false,
        error: null,
        wizard: { isOpen: true, channel: 'telegram' },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Wait for lazy-loaded wizard to appear
      const cancelButton = await waitFor(() => screen.getByText('Cancel'));
      await user.click(cancelButton);

      expect(mockCloseWizard).toHaveBeenCalled();
    });

    it('should close wizard and refresh channels on complete', async () => {
      const user = userEvent.setup();
      mockUseChannelStore.mockReturnValue({
        channels: [],
        isLoading: false,
        error: null,
        wizard: { isOpen: true, channel: 'telegram' },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      // Wait for lazy-loaded wizard to appear
      const completeButton = await waitFor(() => screen.getByText('Complete'));
      await user.click(completeButton);

      expect(mockCloseWizard).toHaveBeenCalled();
    });
  });

  describe('Channel Settings Display', () => {
    it('should display auto-reply setting', () => {
      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      expect(screen.getByText('On')).toBeInTheDocument(); // Telegram auto-reply
      expect(screen.getByText('Off')).toBeInTheDocument(); // Discord auto-reply
    });

    it('should display allowed chats count', () => {
      mockUseChannelStore.mockReturnValue({
        channels: mockChannels,
        isLoading: false,
        error: null,
        wizard: { isOpen: false, channel: null },
        openWizard: mockOpenWizard,
        closeWizard: mockCloseWizard,
        startPolling: mockStartPolling,
        stopPolling: mockStopPolling,
        setMode: vi.fn(),
      setCurrentUserLevel: mockSetCurrentUserLevel,
        toggleChannel: mockToggleChannel,
        deleteChannel: mockDeleteChannel,
      });

      render(<ChannelList />);

      expect(screen.getByText('All')).toBeInTheDocument(); // Telegram (empty array)
      expect(screen.getByText('2 chat(s)')).toBeInTheDocument(); // Discord (2 chats)
    });
  });
});
