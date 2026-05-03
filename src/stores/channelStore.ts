/**
 * Channel Store - Zustand state management for channels (SPEC §9)
 *
 * Manages:
 * - Channel list state with 30s polling for status updates
 * - Wizard flow state
 * - Validation state
 * - Integration with Phase 4 authorization
 * - CRUD operations via useChannels hook integration
 */

import { create } from "zustand";
import type {
  ChannelConfig,
  ChannelName,
  WizardStep,
  ChannelSettings,
} from "@/types/channels";
import type { AccessLevel } from "@/types/auth";
import * as channelsApi from "@/lib/channels";

type AppMode = "gateway" | "client";

interface WizardState {
  isOpen: boolean;
  channel: ChannelName | null;
  currentStep: WizardStep;
  credentials: Record<string, string>;
  isValidating: boolean;
  validationError: string | null;
  isValid: boolean;
  editMode: boolean;
}

interface ChannelStoreState {
  // Channel list state
  channels: ChannelConfig[];
  isLoading: boolean;
  error: string | null;

  // Wizard state
  wizard: WizardState;

  // App mode (determines data source for channels)
  mode: AppMode;

  // Authorization state (Phase 4 integration)
  currentUserLevel: AccessLevel | null;

  // Polling state
  pollingInterval: NodeJS.Timeout | null;
  lastPolledAt: Date | null;

  // Actions - Channel CRUD (delegates to lib/channels.ts)
  loadChannels: () => Promise<void>;
  createChannel: (
    channel: ChannelName,
    configuredBy: string,
    credentials: Record<string, string>,
    settings: ChannelSettings,
  ) => Promise<void>;
  updateChannelConfig: (
    channel: ChannelName,
    enabled?: boolean,
    credentials?: Record<string, string>,
    settings?: ChannelSettings,
  ) => Promise<void>;
  deleteChannel: (channel: ChannelName) => Promise<void>;
  toggleChannel: (channel: ChannelName, enabled: boolean) => Promise<void>;
  validateCredentials: (
    channel: ChannelName,
    credentials: Record<string, string>,
  ) => Promise<channelsApi.ValidationResult>;

  // State management
  setMode: (mode: AppMode) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentUserLevel: (level: AccessLevel | null) => void;

  // Wizard actions
  openWizard: (channel: ChannelName, editMode?: boolean) => void;
  closeWizard: () => void;
  setWizardStep: (step: WizardStep) => void;
  setWizardCredentials: (credentials: Record<string, string>) => void;
  setWizardValidating: (validating: boolean) => void;
  setWizardValidationError: (error: string | null) => void;
  setWizardValid: (valid: boolean) => void;
  resetWizard: () => void;

  // Polling actions
  startPolling: () => void;
  stopPolling: () => void;

  // Permission checks (Phase 4 authorization)
  canManageChannels: () => boolean;
}

const initialWizardState: WizardState = {
  isOpen: false,
  channel: null,
  currentStep: "intro",
  credentials: {},
  isValidating: false,
  validationError: null,
  isValid: false,
  editMode: false,
};

// Polling interval: 30 seconds (30000ms)
const POLLING_INTERVAL_MS = 30000;

function toUserFacingError(err: unknown): string {
  const errorMsg = err instanceof Error ? err.message : String(err);
  if (
    errorMsg.includes(
      "Cannot read properties of undefined (reading 'invoke')",
    ) ||
    errorMsg.includes("Failed to initialize configuration")
  ) {
    return "Desktop integration is unavailable right now. Please reopen this screen inside the desktop app.";
  }
  return errorMsg;
}

export const useChannelStore = create<ChannelStoreState>((set, get) => ({
  // Initial state
  channels: [],
  isLoading: false,
  error: null,
  mode: "gateway",
  wizard: initialWizardState,
  currentUserLevel: null,
  pollingInterval: null,
  lastPolledAt: null,

  // Load channels — mode-aware data source
  loadChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const { mode } = get();
      const channels =
        mode === "gateway"
          ? await channelsApi.listChannelsFromGatewayConfig()
          : await channelsApi.listChannels();
      set({ channels, isLoading: false, lastPolledAt: new Date() });
    } catch (err) {
      set({ error: toUserFacingError(err), isLoading: false });
    }
  },

  // Create a new channel
  createChannel: async (channel, configuredBy, credentials, settings) => {
    // Permission check (Phase 4 integration)
    if (!get().canManageChannels()) {
      throw new Error("Insufficient permissions to create channels");
    }

    set({ error: null });
    try {
      await channelsApi.createChannel(
        channel,
        configuredBy,
        credentials,
        settings,
      );
      await get().loadChannels(); // Reload channels after creation
    } catch (err) {
      set({ error: toUserFacingError(err) });
      throw err;
    }
  },

  // Update an existing channel
  updateChannelConfig: async (channel, enabled, credentials, settings) => {
    // Permission check (Phase 4 integration)
    if (!get().canManageChannels()) {
      throw new Error("Insufficient permissions to update channels");
    }

    set({ error: null });
    try {
      await channelsApi.updateChannel(channel, enabled, credentials, settings);
      await get().loadChannels(); // Reload channels after update
    } catch (err) {
      set({ error: toUserFacingError(err) });
      throw err;
    }
  },

  // Delete a channel
  deleteChannel: async (channel) => {
    // Permission check (Phase 4 integration)
    if (!get().canManageChannels()) {
      throw new Error("Insufficient permissions to delete channels");
    }

    set({ error: null });
    try {
      await channelsApi.deleteChannel(channel);
      await get().loadChannels(); // Reload channels after deletion
    } catch (err) {
      set({ error: toUserFacingError(err) });
      throw err;
    }
  },

  // Toggle channel enabled state
  toggleChannel: async (channel, enabled) => {
    // Permission check (Phase 4 integration)
    if (!get().canManageChannels()) {
      throw new Error("Insufficient permissions to toggle channels");
    }

    set({ error: null });
    try {
      await channelsApi.toggleChannel(channel, enabled);
      await get().loadChannels(); // Reload channels after toggle
    } catch (err) {
      set({ error: toUserFacingError(err) });
      throw err;
    }
  },

  // Validate credentials without saving
  validateCredentials: async (channel, credentials) => {
    set({ error: null });
    try {
      return await channelsApi.validateChannelCredentials(channel, credentials);
    } catch (err) {
      set({ error: toUserFacingError(err) });
      throw err;
    }
  },

  // State setters
  setMode: (mode) => set({ mode }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setCurrentUserLevel: (level) => set({ currentUserLevel: level }),

  // Wizard actions
  openWizard: (channel, editMode = false) =>
    set({
      wizard: {
        ...initialWizardState,
        isOpen: true,
        channel,
        editMode,
        currentStep: editMode ? "credentials" : "intro",
      },
    }),

  closeWizard: () =>
    set({
      wizard: initialWizardState,
    }),

  setWizardStep: (step) =>
    set((state) => ({
      wizard: { ...state.wizard, currentStep: step },
    })),

  setWizardCredentials: (credentials) =>
    set((state) => ({
      wizard: { ...state.wizard, credentials },
    })),

  setWizardValidating: (validating) =>
    set((state) => ({
      wizard: { ...state.wizard, isValidating: validating },
    })),

  setWizardValidationError: (error) =>
    set((state) => ({
      wizard: { ...state.wizard, validationError: error },
    })),

  setWizardValid: (valid) =>
    set((state) => ({
      wizard: { ...state.wizard, isValid: valid },
    })),

  resetWizard: () =>
    set({
      wizard: initialWizardState,
    }),

  // Polling actions - 30s interval for channel status updates
  startPolling: () => {
    const state = get();

    // Clear existing interval if any
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
    }

    // Load channels immediately
    state.loadChannels();

    // Set up 30-second polling interval
    const intervalId = setInterval(() => {
      get().loadChannels();
    }, POLLING_INTERVAL_MS);

    set({ pollingInterval: intervalId });
  },

  stopPolling: () => {
    const state = get();
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
      set({ pollingInterval: null });
    }
  },

  // Permission checks (Phase 4 integration)
  canManageChannels: () => {
    const { currentUserLevel } = get();
    // Owner and Member can manage channels, Guest is read-only
    return currentUserLevel === "owner" || currentUserLevel === "member";
  },
}));
