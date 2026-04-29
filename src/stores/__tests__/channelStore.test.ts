import { describe, it, expect, beforeEach } from 'vitest';
import { useChannelStore } from '../channelStore';

describe('channelStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useChannelStore.setState({
      channels: [],
      isLoading: false,
      error: null,
      wizard: {
        isOpen: false,
        channel: null,
        currentStep: 'intro',
        credentials: {},
        isValidating: false,
        validationError: null,
        isValid: false,
        editMode: false,
      },
      currentUserLevel: null,
      pollingInterval: null,
      lastPolledAt: null,
    });
  });

  describe('Initial State', () => {
    it('should have empty channels array', () => {
      const state = useChannelStore.getState();
      expect(state.channels).toEqual([]);
    });

    it('should not be loading', () => {
      const state = useChannelStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should have no error', () => {
      const state = useChannelStore.getState();
      expect(state.error).toBe(null);
    });

    it('should have closed wizard', () => {
      const state = useChannelStore.getState();
      expect(state.wizard.isOpen).toBe(false);
      expect(state.wizard.channel).toBe(null);
    });

    it('should have no current user level', () => {
      const state = useChannelStore.getState();
      expect(state.currentUserLevel).toBe(null);
    });
  });

  describe('Channel Operations', () => {
    // These tests are outdated - channelStore no longer has direct setChannels/addChannel methods
    // Tests for the current API are in the component tests (ChannelList.test.tsx)
    it.skip('should set channels', () => {
      expect(true).toBe(true);
    });

    it.skip('should add channel', () => {
      expect(true).toBe(true);
    });

    it.skip('should update channel', () => {
      expect(true).toBe(true);
    });

    it.skip('should remove channel', () => {
      expect(true).toBe(true);
    });

    it.skip('should only update matching channel', () => {
      expect(true).toBe(true);
    });
  });

  describe('State Setters', () => {
    it('should set loading state', () => {
      const { setLoading } = useChannelStore.getState();
      setLoading(true);

      const state = useChannelStore.getState();
      expect(state.isLoading).toBe(true);
    });

    it('should set error', () => {
      const { setError } = useChannelStore.getState();
      setError('Something went wrong');

      const state = useChannelStore.getState();
      expect(state.error).toBe('Something went wrong');
    });

    it('should clear error', () => {
      const { setError } = useChannelStore.getState();
      setError('Error');
      setError(null);

      const state = useChannelStore.getState();
      expect(state.error).toBe(null);
    });

    it('should set current user level', () => {
      const { setCurrentUserLevel } = useChannelStore.getState();
      setCurrentUserLevel('owner');

      const state = useChannelStore.getState();
      expect(state.currentUserLevel).toBe('owner');
    });
  });

  describe('Wizard Actions', () => {
    it('should open wizard', () => {
      const { openWizard } = useChannelStore.getState();
      openWizard('telegram');

      const state = useChannelStore.getState();
      expect(state.wizard.isOpen).toBe(true);
      expect(state.wizard.channel).toBe('telegram');
      expect(state.wizard.currentStep).toBe('intro');
    });

    it('should open wizard in edit mode', () => {
      const { openWizard } = useChannelStore.getState();
      openWizard('telegram', true);

      const state = useChannelStore.getState();
      expect(state.wizard.isOpen).toBe(true);
      expect(state.wizard.channel).toBe('telegram');
      expect(state.wizard.currentStep).toBe('credentials');
    });

    it('should close wizard', () => {
      const { openWizard, closeWizard } = useChannelStore.getState();
      openWizard('telegram');
      closeWizard();

      const state = useChannelStore.getState();
      expect(state.wizard.isOpen).toBe(false);
      expect(state.wizard.channel).toBe(null);
    });

    it('should set wizard step', () => {
      const { openWizard, setWizardStep } = useChannelStore.getState();
      openWizard('telegram');
      setWizardStep('credentials');

      const state = useChannelStore.getState();
      expect(state.wizard.currentStep).toBe('credentials');
    });

    it('should set wizard credentials', () => {
      const { openWizard, setWizardCredentials } = useChannelStore.getState();
      openWizard('telegram');
      setWizardCredentials({ botToken: 'test123' });

      const state = useChannelStore.getState();
      expect(state.wizard.credentials).toEqual({ botToken: 'test123' });
    });

    it('should set wizard validating flag', () => {
      const { openWizard, setWizardValidating } = useChannelStore.getState();
      openWizard('telegram');
      setWizardValidating(true);

      const state = useChannelStore.getState();
      expect(state.wizard.isValidating).toBe(true);
    });

    it('should set wizard validation error', () => {
      const { openWizard, setWizardValidationError } = useChannelStore.getState();
      openWizard('telegram');
      setWizardValidationError('Invalid token');

      const state = useChannelStore.getState();
      expect(state.wizard.validationError).toBe('Invalid token');
    });

    it('should set wizard valid flag', () => {
      const { openWizard, setWizardValid } = useChannelStore.getState();
      openWizard('telegram');
      setWizardValid(true);

      const state = useChannelStore.getState();
      expect(state.wizard.isValid).toBe(true);
    });

    it('should reset wizard', () => {
      const { openWizard, setWizardStep, setWizardCredentials, resetWizard } = useChannelStore.getState();
      openWizard('telegram');
      setWizardStep('credentials');
      setWizardCredentials({ botToken: 'test' });
      resetWizard();

      const state = useChannelStore.getState();
      expect(state.wizard.isOpen).toBe(false);
      expect(state.wizard.channel).toBe(null);
      expect(state.wizard.currentStep).toBe('intro');
      expect(state.wizard.credentials).toEqual({});
    });
  });

  describe('Permission Checks', () => {
    it('should return true for owner', () => {
      const { setCurrentUserLevel, canManageChannels } = useChannelStore.getState();
      setCurrentUserLevel('owner');

      expect(canManageChannels()).toBe(true);
    });

    it('should return true for member', () => {
      const { setCurrentUserLevel, canManageChannels } = useChannelStore.getState();
      setCurrentUserLevel('member');

      expect(canManageChannels()).toBe(true);
    });

    it('should return false for guest', () => {
      const { setCurrentUserLevel, canManageChannels } = useChannelStore.getState();
      setCurrentUserLevel('guest');

      expect(canManageChannels()).toBe(false);
    });

    it('should return false when no user level set', () => {
      const { canManageChannels } = useChannelStore.getState();

      expect(canManageChannels()).toBe(false);
    });
  });
});
