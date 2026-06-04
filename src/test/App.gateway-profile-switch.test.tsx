import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const mockReconnect = vi.fn();
const mockClearMessages = vi.fn();
const mockUseWebSocketChat = vi.fn();

vi.mock("@/lib/config", () => ({
  readConfig: vi.fn().mockResolvedValue({
    activeGatewayProfileId: "default",
    gatewayUrl: "http://localhost:18789",
    gatewayProfiles: [
      {
        id: "default",
        name: "Default Gateway",
        kind: "local",
        gatewayUrl: "http://localhost:18789",
        gatewayPort: 18789,
        gatewayToken: "local-token",
      },
      {
        id: "vps",
        name: "VPS Gateway",
        kind: "remote",
        gatewayUrl: "https://vps.example",
        gatewayPort: 443,
        gatewayToken: "vps-token",
      },
    ],
  }),
  updateConfig: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === "probe_gateway") {
      return { found: true };
    }
    if (command === "start_gateway_real") {
      return 12345;
    }
    if (command === "has_app_lock") {
      return false;
    }
    return null;
  }),
}));

vi.mock("@/hooks/useWebSocketChat", () => ({
  useWebSocketChat: (options: unknown) => {
    mockUseWebSocketChat(options);
    return {
      messages: [],
      sendMessage: vi.fn(),
      abortRun: vi.fn(),
      isStreaming: false,
      runStatus: "idle",
      currentToolUses: [],
      toolEvents: [],
      isConnected: true,
      reconnect: mockReconnect,
      clearMessages: mockClearMessages,
      request: vi.fn().mockResolvedValue({
        config: { messages: { channels: {} }, memory: {} },
      }),
      error: null,
      listSessions: vi.fn().mockResolvedValue({ sessions: [] }),
      listAgents: vi.fn().mockResolvedValue({
        agents: [],
        defaultId: "main",
        mainKey: "main",
        scope: "global",
      }),
      listModels: vi.fn().mockResolvedValue({ models: [] }),
      patchSession: vi.fn().mockResolvedValue({}),
      resetSession: vi.fn().mockResolvedValue({}),
      deleteSession: vi.fn().mockResolvedValue({}),
    };
  },
}));

vi.mock("@/hooks/useDesktopNotifications", () => ({
  useDesktopNotifications: () => undefined,
}));
vi.mock("@/components/GeneralSettings", () => ({
  GeneralSettings: ({ onSave }: { onSave?: (settings: unknown) => void }) => (
    <div>
      <h2>Settings</h2>
      <button
        onClick={() =>
          onSave?.({
            activeGatewayProfileId: "remote",
            gatewayUrl: "https://gateway.example",
          })
        }
      >
        Trigger Gateway Switch
      </button>
    </div>
  ),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      store = Object.fromEntries(
        Object.entries(store).filter(([entryKey]) => entryKey !== key),
      );
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("App gateway profile switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    localStorageMock.clear();
    localStorageMock.setItem("edwinpai_onboarding_complete", "true");
    localStorageMock.setItem("edwinpai_mode", "gateway");
  });

  it("uses a per-window gateway profile override without changing the global default", async () => {
    window.sessionStorage.setItem("edwinpai_active_gateway_profile_id", "vps");

    render(<App />);

    await waitFor(() => {
      expect(mockUseWebSocketChat).toHaveBeenCalledWith(
        expect.objectContaining({
          wsUrl: "wss://vps.example",
          authToken: "vps-token",
          historyScopeKey: "vps:https://vps.example",
        }),
      );
    });
  });

  it("reconnects and clears session state after a gateway profile switch is saved", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("EdwinPAI Desktop")).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: /Settings/i })[0]!);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Settings/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Trigger Gateway Switch" }),
    );

    await waitFor(() => {
      expect(mockClearMessages).toHaveBeenCalledTimes(1);
      expect(mockReconnect).toHaveBeenCalledTimes(1);
    });
  });
});
