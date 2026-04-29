/**
 * channelStore Tests
 *
 * Tests channel state management, wizard flow, permissions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { useChannelStore } from '@/stores/channelStore';
import type { ChannelConfig } from '@/types/channels';

// Create mock functions in vi.hoisted()
const mockChannelsApi = vi.hoisted(() => ({
  listChannels: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
  toggleChannel: vi.fn(),
  validateChannelCredentials: vi.fn(),
}));

vi.mock('@/lib/channels', () => mockChannelsApi);

describe('channelStore', () => {
  const mockChannel: ChannelConfig = {
    channel: 'telegram',
    enabled: true,
    configuredBy: 'test-user',
    configuredAt: new Date().toISOString(),
    credentials: { bot_token: 'test-token' },
    settings: { autoReply: false, allowedChatIds: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useChannelStore.getState().channels = [];
    useChannelStore.getState().isLoading = false;
    useChannelStore.getState().error = null;
    useChannelStore.getState().resetWizard();
  });

  afterEach(() => {
    useChannelStore.getState().stopPolling();
  });

  it('should initialize with empty state', () => {
    const state = useChannelStore.getState();

    expect(state.channels).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.wizard.isOpen).toBe(false);
  });

  it('should load channels', async () => {
    mockChannelsApi.listChannels.mockResolvedValue([mockChannel]);

    await act(async () => {
      await useChannelStore.getState().loadChannels();
    });

    const state = useChannelStore.getState();
    expect(state.channels).toHaveLength(1);
    expect(state.channels[0]).toEqual(mockChannel);
    expect(state.lastPolledAt).toBeTruthy();
  });

  it('should handle load errors', async () => {
    mockChannelsApi.listChannels.mockRejectedValue(new Error('Load failed'));

    await act(async () => {
      await useChannelStore.getState().loadChannels();
    });

    const state = useChannelStore.getState();
    expect(state.error).toBe('Load failed');
  });

  it('should create a channel with permission check', async () => {
    mockChannelsApi.createChannel.mockResolvedValue(mockChannel);
    mockChannelsApi.listChannels.mockResolvedValue([mockChannel]);

    useChannelStore.getState().setCurrentUserLevel('owner');

    await act(async () => {
      await useChannelStore.getState().createChannel(
        'telegram',
        'test-user',
        { bot_token: 'test-token' },
        { autoReply: false, allowedChatIds: [] }
      );
    });

    expect(mockChannelsApi.createChannel).toHaveBeenCalled();
    expect(mockChannelsApi.listChannels).toHaveBeenCalled();
  });

  it('should block create without permissions', async () => {
    useChannelStore.getState().setCurrentUserLevel('guest');

    await expect(async () => {
      await act(async () => {
        await useChannelStore.getState().createChannel(
          'telegram',
          'test-user',
          { bot_token: 'test-token' },
          { autoReply: false, allowedChatIds: [] }
        );
      });
    }).rejects.toThrow('Insufficient permissions');
  });

  it('should update a channel with permission check', async () => {
    mockChannelsApi.updateChannel.mockResolvedValue(mockChannel);
    mockChannelsApi.listChannels.mockResolvedValue([mockChannel]);

    useChannelStore.getState().setCurrentUserLevel('member');

    await act(async () => {
      await useChannelStore.getState().updateChannelConfig('telegram', false);
    });

    expect(mockChannelsApi.updateChannel).toHaveBeenCalledWith('telegram', false, undefined, undefined);
  });

  it('should delete a channel', async () => {
    mockChannelsApi.deleteChannel.mockResolvedValue(undefined);
    mockChannelsApi.listChannels.mockResolvedValue([]);

    useChannelStore.getState().setCurrentUserLevel('owner');

    await act(async () => {
      await useChannelStore.getState().deleteChannel('telegram');
    });

    expect(mockChannelsApi.deleteChannel).toHaveBeenCalledWith('telegram');
  });

  it('should toggle a channel', async () => {
    mockChannelsApi.toggleChannel.mockResolvedValue(mockChannel);
    mockChannelsApi.listChannels.mockResolvedValue([mockChannel]);

    useChannelStore.getState().setCurrentUserLevel('owner');

    await act(async () => {
      await useChannelStore.getState().toggleChannel('telegram', false);
    });

    expect(mockChannelsApi.toggleChannel).toHaveBeenCalledWith('telegram', false);
  });

  it('should open wizard in create mode', () => {
    act(() => {
      useChannelStore.getState().openWizard('telegram');
    });

    const state = useChannelStore.getState();
    expect(state.wizard.isOpen).toBe(true);
    expect(state.wizard.channel).toBe('telegram');
    expect(state.wizard.editMode).toBe(false);
    expect(state.wizard.currentStep).toBe('intro');
  });

  it('should open wizard in edit mode', () => {
    act(() => {
      useChannelStore.getState().openWizard('telegram', true);
    });

    const state = useChannelStore.getState();
    expect(state.wizard.isOpen).toBe(true);
    expect(state.wizard.editMode).toBe(true);
    expect(state.wizard.currentStep).toBe('credentials');
  });

  it('should close wizard', () => {
    act(() => {
      useChannelStore.getState().openWizard('telegram');
      useChannelStore.getState().closeWizard();
    });

    const state = useChannelStore.getState();
    expect(state.wizard.isOpen).toBe(false);
  });

  it('should update wizard step', () => {
    act(() => {
      useChannelStore.getState().openWizard('telegram');
      useChannelStore.getState().setWizardStep('credentials');
    });

    expect(useChannelStore.getState().wizard.currentStep).toBe('credentials');
  });

  it('should update wizard credentials', () => {
    const credentials = { bot_token: 'test-token' };

    act(() => {
      useChannelStore.getState().setWizardCredentials(credentials);
    });

    expect(useChannelStore.getState().wizard.credentials).toEqual(credentials);
  });

  it('should start and stop polling', async () => {
    vi.useFakeTimers();
    mockChannelsApi.listChannels.mockResolvedValue([mockChannel]);

    await act(async () => {
      useChannelStore.getState().startPolling();
    });

    // Initial load
    expect(mockChannelsApi.listChannels).toHaveBeenCalledTimes(1);

    // Advance timer by 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // Should have polled again
    expect(mockChannelsApi.listChannels).toHaveBeenCalledTimes(2);

    act(() => {
      useChannelStore.getState().stopPolling();
    });

    // Clear mock and advance timer again
    mockChannelsApi.listChannels.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // Should NOT have polled after stopping
    expect(mockChannelsApi.listChannels).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should check permissions correctly', () => {
    const state = useChannelStore.getState();

    state.setCurrentUserLevel('owner');
    expect(state.canManageChannels()).toBe(true);

    state.setCurrentUserLevel('member');
    expect(state.canManageChannels()).toBe(true);

    state.setCurrentUserLevel('guest');
    expect(state.canManageChannels()).toBe(false);

    state.setCurrentUserLevel(null);
    expect(state.canManageChannels()).toBe(false);
  });
});
