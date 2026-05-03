import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import { APP_VERSION } from "@/lib/app-version";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock useWebSocketChat to avoid real WebSocket connections
const mockSendMessage = vi.fn();
const mockReconnect = vi.fn();
const mockClearMessages = vi.fn();
vi.mock("@/hooks/useWebSocketChat", () => ({
  useWebSocketChat: () => ({
    messages: [],
    sendMessage: mockSendMessage,
    abortRun: vi.fn(),
    isStreaming: false,
    runStatus: "idle",
    currentToolUses: [],
    toolEvents: [],
    isConnected: true,
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
    clearMessages: mockClearMessages,
    reconnect: mockReconnect,
  }),
}));

// Mock @tauri-apps/plugin-fs to avoid file system errors
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn().mockResolvedValue("{}"),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
  BaseDirectory: { AppConfig: 1, AppData: 2 },
}));

// Mock useConfig to avoid filesystem-dependent config loading
vi.mock("@/hooks/useConfig", () => ({
  useConfig: () => ({
    config: {
      gatewayPort: 18789,
      gatewayUrl: "http://localhost:18789",
      gatewayToken: "",
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
      autoStartGateway: true,
      theme: "dark" as const,
      defaultModel: "claude-sonnet",
      chat: { enableStreaming: true, temperature: 0.7, maxTokens: 4096 },
      gateway: { autoRestart: true, maxRestarts: 3, healthCheckInterval: 30 },
    },
    update: vi.fn().mockResolvedValue(undefined),
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
    activeGatewayProfile: {
      id: "default",
      name: "Default Gateway",
      gatewayUrl: "http://localhost:18789",
      gatewayPort: 18789,
      gatewayToken: "",
    },
    saveGatewayProfile: vi.fn().mockResolvedValue(undefined),
    deleteGatewayProfile: vi.fn().mockResolvedValue(undefined),
    setActiveGatewayProfile: vi.fn().mockResolvedValue(undefined),
    loading: false,
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Stub global WebSocket to prevent undici ERR_INVALID_ARG_TYPE errors in JSDOM
vi.stubGlobal(
  "WebSocket",
  class FakeWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 3; // CLOSED
    url = "";
    protocol = "";
    extensions = "";
    binaryType: BinaryType = "blob";
    bufferedAmount = 0;
    onopen: ((ev: Event) => void) | null = null;
    onclose: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    constructor(url: string | URL) {
      super();
      this.url = String(url);
    }
    send() {}
    close() {}
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;
  },
);

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockClear();
    mockReconnect.mockClear();
    mockClearMessages.mockClear();
    localStorageMock.clear();

    // Skip onboarding by default
    localStorageMock.setItem("edwinpai_onboarding_complete", "true");
    localStorageMock.setItem("edwinpai_mode", "gateway");

    // Mock Tauri invoke to simulate gateway running
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "probe_gateway") {
        return { found: true };
      }
      if (cmd === "start_gateway_real") {
        return 12345;
      }
      return null;
    });
  });

  it("renders chat view when gateway is running", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("EdwinPAI Desktop")).toBeInTheDocument();
    });

    // ChatView should be visible with message input
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
    });
  });

  it("shows onboarding when not completed", async () => {
    localStorageMock.removeItem("edwinpai_onboarding_complete");
    render(<App />);

    // Should show onboarding wizard with "Welcome to EdwinPAI" heading(s)
    await waitFor(() => {
      const welcomeElements = screen.getAllByText(/Welcome to EdwinPAI/);
      expect(welcomeElements.length).toBeGreaterThan(0);
    });
  });

  it("navigates to settings view", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("EdwinPAI Desktop")).toBeInTheDocument();
    });

    // SidebarNav renders Settings button alongside ChatView
    const settingsButtons = screen.getAllByRole("button", {
      name: /Settings/i,
    });
    await user.click(settingsButtons[0]!);

    // After navigation, GeneralSettings renders with Settings heading
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Settings/i }),
      ).toBeInTheDocument();
    });
  });

  it("navigates back to chat from settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("EdwinPAI Desktop")).toBeInTheDocument();
    });

    // Go to settings
    const settingsButtons = screen.getAllByRole("button", {
      name: /Settings/i,
    });
    await user.click(settingsButtons[0]!);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Settings/i }),
      ).toBeInTheDocument();
    });

    // Go back to chat
    const chatButton = screen.getByRole("button", { name: /Chat/i });
    await user.click(chatButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
    });
  });

  it("sends message through WebSocket hook", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "Test message");
    await user.keyboard("{Enter}");

    expect(mockSendMessage).toHaveBeenCalledWith("Test message", {
      deliver: false,
      attachments: [],
    });
  });

  it("displays version number", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(`Version ${APP_VERSION}`)).toBeInTheDocument();
    });
  });

  it("shows gateway running status", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Gateway Running/)).toBeInTheDocument();
    });
  });

  it("renders sidebar navigation buttons", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Chat/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Access Control/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Settings/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders sidebar with SVG icons", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("EdwinPAI Desktop")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    const buttonsWithSvg = buttons.filter(
      (button) => button.querySelector("svg") !== null,
    );
    expect(buttonsWithSvg.length).toBeGreaterThan(0);
  });

  it("handles multiple message sends", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox");

    await user.type(input, "First");
    await user.keyboard("{Enter}");

    await user.type(input, "Second");
    await user.keyboard("{Enter}");

    expect(mockSendMessage).toHaveBeenCalledWith("First", {
      deliver: false,
      attachments: [],
    });
    expect(mockSendMessage).toHaveBeenCalledWith("Second", {
      deliver: false,
      attachments: [],
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it("shows mode-select when no saved mode", async () => {
    localStorageMock.removeItem("edwinpai_mode");

    // Gateway not found
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "probe_gateway") {
        return { found: false };
      }
      throw new Error("not available");
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText(/Welcome to EdwinPAI Desktop/),
      ).toBeInTheDocument();
    });
  });
});
