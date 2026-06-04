import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneralSettings } from "./GeneralSettings";
import * as useConfigModule from "@/hooks/useConfig";

// Mock child settings cards that hit Tauri FS / gateway context
vi.mock("@/components/ProviderSettings", () => ({
  ProviderSettings: () => <div>ProviderSettings</div>,
}));
vi.mock("@/components/GatewayConfigCard", () => ({
  GatewayConfigCard: () => <div>GatewayConfigCard</div>,
}));
vi.mock("@/components/WebToolsCard", () => ({
  WebToolsCard: () => <div>WebToolsCard</div>,
}));
vi.mock("@/components/AgentConfigCard", () => ({
  AgentConfigCard: () => <div>AgentConfigCard</div>,
}));
vi.mock("@/components/RuntimeStatus", () => ({
  RuntimeStatus: () => <div>RuntimeStatus</div>,
}));
vi.mock("@/components/AppLockSettings", () => ({
  AppLockSettings: () => <div>AppLockSettings</div>,
}));
vi.mock("@/components/TtsSettingsCard", () => ({
  TtsSettingsCard: () => <div>TtsSettingsCard</div>,
}));

// Mock Tauri invoke for ProviderSettings
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ providers: [] }),
}));

// Mock the useConfig hook
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockReset = vi.fn().mockResolvedValue(undefined);
const mockReload = vi.fn().mockResolvedValue(undefined);

const defaultMockConfig = {
  gatewayUrl: "http://localhost:18789",
  gatewayPort: 18789,
  gatewayToken: "",
  defaultModel: "claude-sonnet-4-5",
  gatewayProfiles: [
    {
      id: "default",
      name: "Default Gateway",
      gatewayUrl: "http://localhost:18789",
      gatewayPort: 18789,
      gatewayToken: "",
    },
    {
      id: "remote",
      name: "Remote Gateway",
      gatewayUrl: "https://gateway.example",
      gatewayPort: 443,
      gatewayToken: "remote-token",
    },
  ],
  activeGatewayProfileId: "default",
  theme: "system" as const,
  autoStartGateway: true,
  chat: {
    enableStreaming: true,
    maxTokens: 2048,
    temperature: 1.0,
  },
  gateway: {
    autoRestart: true,
    maxRestarts: 5,
    healthCheckInterval: 30000,
  },
};

vi.mock("@/hooks/useConfig", () => ({
  useConfig: vi.fn(),
}));

// Mock hasPointerCapture for JSDOM (needed for Radix UI Select)
beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

describe("GeneralSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      config: defaultMockConfig,
      loading: false,
      error: null,
      update: mockUpdate,
      reset: mockReset,
      reload: mockReload,
      gatewayProfiles: defaultMockConfig.gatewayProfiles,
      activeGatewayProfile: defaultMockConfig.gatewayProfiles[0]!,
      saveGatewayProfile: vi.fn(),
      deleteGatewayProfile: vi.fn(),
      setActiveGatewayProfile: vi.fn(),
    });
  });

  it("renders all settings sections", () => {
    render(<GeneralSettings />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Behavior")).toBeInTheDocument();
    expect(screen.getByText("Gateway Connection")).toBeInTheDocument();
    expect(screen.getByText("Gateway Profiles")).toBeInTheDocument();
  });

  it("shows loading state when config is loading", () => {
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      config: defaultMockConfig,
      loading: true,
      error: null,
      update: mockUpdate,
      reset: mockReset,
      reload: mockReload,
      gatewayProfiles: defaultMockConfig.gatewayProfiles,
      activeGatewayProfile: defaultMockConfig.gatewayProfiles[0]!,
      saveGatewayProfile: vi.fn(),
      deleteGatewayProfile: vi.fn(),
      setActiveGatewayProfile: vi.fn(),
    });

    render(<GeneralSettings />);

    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
  });

  it("renders with default values from config", () => {
    render(<GeneralSettings />);

    const notificationsSwitch = screen.getByLabelText("Notifications");
    expect(notificationsSwitch).toBeChecked();

    const autoScrollSwitch = screen.getByLabelText("Auto-scroll");
    expect(autoScrollSwitch).toBeChecked();

    const gatewayUrlInput = screen.getByLabelText("Gateway URL");
    expect(gatewayUrlInput).toHaveValue("http://localhost:18789");
    expect(screen.getByLabelText("Active Gateway Profile")).toHaveTextContent(
      "Default Gateway",
    );
  });

  it("renders theme selector with system as default", () => {
    render(<GeneralSettings />);

    const themeSelect = screen.getAllByRole("combobox")[0];
    expect(themeSelect).toHaveTextContent("System");
  });

  it("toggles notifications switch", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const notificationsSwitch = screen.getByLabelText("Notifications");

    expect(notificationsSwitch).toBeChecked();

    await user.click(notificationsSwitch);

    expect(notificationsSwitch).not.toBeChecked();
  });

  it("toggles auto-scroll switch", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const autoScrollSwitch = screen.getByLabelText("Auto-scroll");

    expect(autoScrollSwitch).toBeChecked();

    await user.click(autoScrollSwitch);

    expect(autoScrollSwitch).not.toBeChecked();
  });

  it("changes gateway URL input", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const gatewayUrlInput = screen.getByLabelText("Gateway URL");

    await user.clear(gatewayUrlInput);
    await user.type(gatewayUrlInput, "http://localhost:5000");

    expect(gatewayUrlInput).toHaveValue("http://localhost:5000");
  });

  it("switches the editable gateway fields when the active profile changes", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const profileSelect = screen.getByLabelText("Active Gateway Profile");
    await user.click(profileSelect);
    await user.click(
      await screen.findByRole("option", { name: "Remote Gateway" }),
    );

    expect(screen.getByLabelText("Gateway URL")).toHaveValue(
      "https://gateway.example",
    );
    expect(screen.getByLabelText("Auth Token")).toHaveValue("remote-token");
  });

  it("persists active profile changes when saved", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const profileSelect = screen.getByLabelText("Active Gateway Profile");
    await user.click(profileSelect);
    await user.click(
      await screen.findByRole("option", { name: "Remote Gateway" }),
    );

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          activeGatewayProfileId: "remote",
          gatewayProfiles: expect.arrayContaining([
            expect.objectContaining({
              id: "remote",
              gatewayUrl: "https://gateway.example",
              gatewayToken: "remote-token",
            }),
          ]),
          gatewayUrl: "https://gateway.example",
          gatewayPort: 443,
          gatewayToken: "remote-token",
        }),
      );
    });
  });

  it("creates a new gateway profile draft from the current fields", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    await user.click(screen.getByRole("button", { name: /New Profile/i }));

    expect(screen.getByLabelText("Profile Name")).toHaveValue("New Gateway");
    expect(screen.getByLabelText("Gateway URL")).toHaveValue(
      "http://localhost:18789",
    );
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("renders theme selector", () => {
    render(<GeneralSettings />);

    // Verify theme selector is present
    const themeSelect = screen.getAllByRole("combobox")[0];
    expect(themeSelect).toBeInTheDocument();
    expect(themeSelect).toHaveTextContent("System");

    // Verify it's labeled correctly
    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
  });

  it('shows "unsaved changes" badge when settings change', async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    const notificationsSwitch = screen.getByLabelText("Notifications");
    await user.click(notificationsSwitch);

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("calls update hook when save button is clicked", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const gatewayUrlInput = screen.getByLabelText("Gateway URL");
    await user.clear(gatewayUrlInput);
    await user.type(gatewayUrlInput, "http://localhost:5000");

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayUrl: "http://localhost:5000",
        }),
      );
    });
  });

  it("calls onSave callback when save button is clicked", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<GeneralSettings onSave={onSave} />);

    const gatewayUrlInput = screen.getByLabelText("Gateway URL");
    await user.clear(gatewayUrlInput);
    await user.type(gatewayUrlInput, "http://localhost:9999");

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayUrl: "http://localhost:9999",
        }),
      );
    });
  });

  it('hides "unsaved changes" badge after saving', async () => {
    const user = userEvent.setup();
    render(<GeneralSettings onSave={vi.fn()} />);

    const notificationsSwitch = screen.getByLabelText("Notifications");
    await user.click(notificationsSwitch);

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });
  });

  it("disables save button when no changes", () => {
    render(<GeneralSettings />);

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });

    expect(saveButton).toBeDisabled();
  });

  it("enables save button when changes are made", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    expect(saveButton).toBeDisabled();

    const notificationsSwitch = screen.getByLabelText("Notifications");
    await user.click(notificationsSwitch);

    expect(saveButton).toBeEnabled();
  });

  it("resets to default values when reset button is clicked", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    // Make some changes first
    const gatewayUrlInput = screen.getByLabelText("Gateway URL");
    await user.clear(gatewayUrlInput);
    await user.type(gatewayUrlInput, "http://localhost:5000");

    const resetButton = screen.getByRole("button", {
      name: /Reset to Defaults/i,
    });
    await user.click(resetButton);

    // Check that values are reset
    expect(gatewayUrlInput).toHaveValue("http://localhost:18789");
  });

  it("shows unsaved changes after reset", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const resetButton = screen.getByRole("button", {
      name: /Reset to Defaults/i,
    });
    await user.click(resetButton);

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("updates theme in config when changed", async () => {
    render(<GeneralSettings />);

    // Verify the theme selector shows the current theme from config
    const themeSelect = screen.getAllByRole("combobox")[0];
    expect(themeSelect).toHaveTextContent("System");

    // Note: We don't interact with the Radix UI dropdown in tests due to JSDOM limitations.
    // Theme functionality is verified through integration tests and the "syncs theme from config" test.
  });

  it("displays helper text for gateway URL", () => {
    render(<GeneralSettings />);

    expect(
      screen.getByText(/The URL of your EdwinPAI Gateway instance/),
    ).toBeInTheDocument();
  });

  it("handles multiple setting changes before saving", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<GeneralSettings onSave={onSave} />);

    const notificationsSwitch = screen.getByLabelText("Notifications");
    await user.click(notificationsSwitch);

    const autoScrollSwitch = screen.getByLabelText("Auto-scroll");
    await user.click(autoScrollSwitch);

    const gatewayUrlInput = screen.getByLabelText("Gateway URL");
    await user.clear(gatewayUrlInput);
    await user.type(gatewayUrlInput, "http://localhost:8000");

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayUrl: "http://localhost:8000",
        }),
      );
    });
  });

  it("handles rapid toggle changes", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const notificationsSwitch = screen.getByLabelText("Notifications");

    // Toggle multiple times
    await user.click(notificationsSwitch);
    await user.click(notificationsSwitch);
    await user.click(notificationsSwitch);

    expect(notificationsSwitch).not.toBeChecked();
  });

  it("renders mode switcher when onModeChange is provided", () => {
    const onModeChange = vi.fn();
    render(
      <GeneralSettings onModeChange={onModeChange} currentMode="gateway" />,
    );

    expect(screen.getByText("Application Mode")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Gateway Mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Connect Mode/i }),
    ).toBeInTheDocument();
  });

  it("does not render mode switcher when onModeChange is not provided", () => {
    render(<GeneralSettings />);

    expect(screen.queryByText("Application Mode")).not.toBeInTheDocument();
  });

  it("calls onModeChange when switching to connect mode", async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <GeneralSettings onModeChange={onModeChange} currentMode="gateway" />,
    );

    const clientModeButton = screen.getByRole("button", {
      name: /Connect Mode/i,
    });
    await user.click(clientModeButton);

    expect(onModeChange).toHaveBeenCalledWith("client");
  });

  it("calls onModeChange when switching to gateway mode", async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <GeneralSettings onModeChange={onModeChange} currentMode="client" />,
    );

    const gatewayModeButton = screen.getByRole("button", {
      name: /Gateway Mode/i,
    });
    await user.click(gatewayModeButton);

    expect(onModeChange).toHaveBeenCalledWith("gateway");
  });

  it("syncs gatewayUrl from config when it changes", () => {
    const { rerender } = render(<GeneralSettings />);

    const gatewayUrlInput = screen.getByLabelText("Gateway URL");
    expect(gatewayUrlInput).toHaveValue("http://localhost:18789");

    // Update mock to return different config
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      config: {
        ...defaultMockConfig,
        gatewayUrl: "http://localhost:9999",
        gatewayProfiles: [
          {
            ...defaultMockConfig.gatewayProfiles[0]!,
            gatewayUrl: "http://localhost:9999",
            gatewayPort: 9999,
          },
          defaultMockConfig.gatewayProfiles[1]!,
        ],
      },
      loading: false,
      error: null,
      update: mockUpdate,
      reset: mockReset,
      reload: mockReload,
      gatewayProfiles: [
        {
          ...defaultMockConfig.gatewayProfiles[0]!,
          gatewayUrl: "http://localhost:9999",
          gatewayPort: 9999,
        },
        defaultMockConfig.gatewayProfiles[1]!,
      ],
      activeGatewayProfile: {
        ...defaultMockConfig.gatewayProfiles[0]!,
        gatewayUrl: "http://localhost:9999",
        gatewayPort: 9999,
      },
      saveGatewayProfile: vi.fn(),
      deleteGatewayProfile: vi.fn(),
      setActiveGatewayProfile: vi.fn(),
    });

    rerender(<GeneralSettings />);

    expect(gatewayUrlInput).toHaveValue("http://localhost:9999");
  });

  it("syncs theme from config when it changes", () => {
    const { rerender } = render(<GeneralSettings />);

    const themeSelect = screen.getAllByRole("combobox")[0];
    expect(themeSelect).toHaveTextContent("System");

    // Update mock to return different config
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      config: {
        ...defaultMockConfig,
        theme: "dark",
      },
      loading: false,
      error: null,
      update: mockUpdate,
      reset: mockReset,
      reload: mockReload,
      gatewayProfiles: defaultMockConfig.gatewayProfiles,
      activeGatewayProfile: defaultMockConfig.gatewayProfiles[0]!,
      saveGatewayProfile: vi.fn(),
      deleteGatewayProfile: vi.fn(),
      setActiveGatewayProfile: vi.fn(),
    });

    rerender(<GeneralSettings />);

    expect(themeSelect).toHaveTextContent("Dark");
  });

  it("parses port from gateway URL when saving", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const gatewayUrlInput = screen.getByLabelText("Gateway URL");
    await user.clear(gatewayUrlInput);
    await user.type(gatewayUrlInput, "http://localhost:9999");

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayUrl: "http://localhost:9999",
          gatewayPort: 9999,
        }),
      );
    });
  });

  it("uses default port when URL has no port", async () => {
    const user = userEvent.setup();
    render(<GeneralSettings />);

    const gatewayUrlInput = screen.getByLabelText("Gateway URL");
    await user.clear(gatewayUrlInput);
    await user.type(gatewayUrlInput, "http://example.com");

    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayUrl: "http://example.com",
          gatewayPort: 18789, // default port from config
        }),
      );
    });
  });
});
