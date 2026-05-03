/**
 * TestChatStep Component Tests
 *
 * Tests WebSocket-based chat in onboarding wizard step 5.
 * Mocks WebSocket to simulate gateway protocol handshake + chat.send + streaming.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/components/shared/IdentityBadge", () => ({
  IdentityBadge: () => <div>Identity</div>,
}));

// Mock config reader
vi.mock("@/lib/config", () => ({
  readConfig: vi.fn().mockResolvedValue({
    gatewayUrl: "http://localhost:18789",
    gatewayPort: 18789,
    gatewayToken: "test-token",
    theme: "dark",
    chat: {},
    gateway: {},
  }),
  writeConfig: vi.fn(),
  updateConfig: vi.fn(),
  resetConfig: vi.fn(),
  getConfigPath: vi.fn().mockReturnValue("desktop-config.json"),
}));

// Mock WebSocket for chat test
let wsResponseMode: "success" | "error" | "hang" = "success";

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;

  _handlers: Record<string, Array<(...args: unknown[]) => void>> = {};

  constructor(url: string) {
    void url;
    // Auto-trigger open
    setTimeout(() => this._trigger("open"), 10);
  }

  addEventListener(event: string, handler: (...args: unknown[]) => void) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  }

  _trigger(event: string, data?: unknown) {
    for (const h of this._handlers[event] ?? []) {
      h(data ?? {});
    }
  }

  send(data: string) {
    const frame = JSON.parse(data);

    if (frame.method === "connect") {
      // Respond with hello-ok
      setTimeout(() => {
        this._trigger("message", {
          data: JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { type: "hello-ok", server: { version: "test" } },
          }),
        });
      }, 10);
    } else if (frame.method === "chat.send") {
      if (wsResponseMode === "success") {
        // Send chat.send response, then delta, then final
        setTimeout(() => {
          this._trigger("message", {
            data: JSON.stringify({
              type: "res",
              id: frame.id,
              ok: true,
              payload: { runId: "test-run", status: "started" },
            }),
          });
        }, 20);
        setTimeout(() => {
          this._trigger("message", {
            data: JSON.stringify({
              type: "event",
              event: "chat",
              payload: {
                state: "delta",
                sessionKey: "main",
                message: {
                  content: [{ type: "text", text: "Hello from EdwinPAI!" }],
                },
              },
            }),
          });
        }, 30);
        setTimeout(() => {
          this._trigger("message", {
            data: JSON.stringify({
              type: "event",
              event: "chat",
              payload: {
                state: "final",
                sessionKey: "main",
                message: {
                  content: [{ type: "text", text: "Hello from EdwinPAI!" }],
                },
              },
            }),
          });
        }, 40);
      } else if (wsResponseMode === "error") {
        setTimeout(() => {
          this._trigger("message", {
            data: JSON.stringify({
              type: "event",
              event: "chat",
              payload: {
                state: "error",
                sessionKey: "main",
                errorMessage: "No API key configured",
              },
            }),
          });
        }, 20);
      }
      // "hang" mode: don't respond (simulates timeout/streaming indicator)
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

const OriginalWebSocket = globalThis.WebSocket;

const OnboardingWizard = await import("./OnboardingWizard").then(
  (m) => m.OnboardingWizard,
);

describe("TestChatStep", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    wsResponseMode = "success";
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  const navigateToTestChatStep = async () => {
    const user = userEvent.setup();

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case "add_provider":
          return { providers: [] };
        case "get_identity":
          return {
            publicKey: "02test",
            petname: "Test",
            avatarSvg: "<svg></svg>",
            shortId: "test",
          };
        case "scan_gateways":
          return [{ url: "http://localhost:18789", version: null, name: null }];
        case "probe_gateway":
          return { found: true, url: "http://localhost:18789", error: null };
        default:
          return {};
      }
    });

    render(<OnboardingWizard onComplete={vi.fn()} />);

    // Welcome → Gateway → ApiKey → Identity → TestChat
    await user.click(screen.getByRole("button", { name: /get started/i }));

    // Gateway step
    await waitFor(() => screen.getByRole("button", { name: /^connect$/i }));
    await user.click(screen.getByRole("button", { name: /^connect$/i }));
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    // ApiKey step
    await waitFor(() => screen.getByPlaceholderText(/sk-ant-/i));
    await user.type(screen.getByPlaceholderText(/sk-ant-/i), "sk-ant-test");
    await user.click(
      screen.getByRole("button", { name: /validate & continue/i }),
    );

    // Identity step
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/test chat/i)).toBeInTheDocument();
    });
  };

  it("shows message input with default message", async () => {
    await navigateToTestChatStep();
    const input = screen.getByPlaceholderText(/type a message/i);
    expect(input).toHaveValue("Hello! Can you tell me about EdwinPAI?");
  });

  it("sends test message successfully", async () => {
    const user = userEvent.setup();
    wsResponseMode = "success";

    await navigateToTestChatStep();

    const sendButton = screen.getByRole("button", {
      name: /send test message/i,
    });
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/hello from edwinpai/i)).toBeInTheDocument();
    });
  });

  it("shows continue button after successful chat", async () => {
    const user = userEvent.setup();
    wsResponseMode = "success";

    await navigateToTestChatStep();

    await user.click(
      screen.getByRole("button", { name: /send test message/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^continue$/i }),
      ).toBeInTheDocument();
    });
  });

  it("handles chat error", async () => {
    const user = userEvent.setup();
    wsResponseMode = "error";

    await navigateToTestChatStep();

    await user.click(
      screen.getByRole("button", { name: /send test message/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/no api key configured/i)).toBeInTheDocument();
    });
  });
});
