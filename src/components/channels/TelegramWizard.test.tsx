/**
 * TelegramWizard Component Tests
 *
 * Tests Telegram bot token validation and channel configuration.
 * Uses WizardShell step-based navigation (Next/Back).
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramWizard } from "./TelegramWizard";

const mockValidateCredentials = vi.fn();
const mockCreateChannel = vi.fn();
const mockPatchGatewayConfig = vi.fn();

// Mock useChannels hook
vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({
    createChannel: mockCreateChannel,
    updateChannel: vi.fn().mockResolvedValue({ success: true }),
    validateCredentials: mockValidateCredentials,
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/gateway-context", () => ({
  patchGatewayConfig: (...args: unknown[]) => mockPatchGatewayConfig(...args),
  resolveToken: vi.fn().mockResolvedValue("test-token"),
  inferGatewayKind: vi.fn().mockReturnValue("local"),
}));

vi.mock("@/lib/config", () => ({
  readConfig: vi.fn().mockResolvedValue({
    gatewayUrl: "http://localhost:18789",
    gatewayToken: "test-token",
  }),
}));

// Valid token: 8-10 digit bot ID + colon + exactly 35 alphanumeric chars
const VALID_TOKEN = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz012345678";

describe("TelegramWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCredentials.mockResolvedValue({
      valid: true,
      metadata: { botId: "123456789", username: "test_bot" },
    });
    mockCreateChannel.mockResolvedValue({});
    mockPatchGatewayConfig.mockResolvedValue(undefined);
  });

  it("renders introduction step", () => {
    render(<TelegramWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/Connect Telegram Bot/i)).toBeInTheDocument();
  });

  it("shows bot token input field", async () => {
    const user = userEvent.setup();
    render(<TelegramWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByLabelText(/bot token/i)).toBeInTheDocument();
    });
  });

  it("validates bot token format", async () => {
    const user = userEvent.setup();
    render(<TelegramWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));

    const tokenInput = screen.getByLabelText(/bot token/i);
    await user.type(tokenInput, "invalid-token-format");

    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText(/Invalid token format/i)).toBeInTheDocument();
    });
  });

  it("validates bot token successfully", async () => {
    const user = userEvent.setup();
    render(<TelegramWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));

    const tokenInput = screen.getByLabelText(/bot token/i);
    await user.type(tokenInput, VALID_TOKEN);

    // Click Next to pass credential validation → reach validation step
    await user.click(screen.getByText("Next"));

    // Now on validation step, click Next to trigger validateCredentials
    await waitFor(() => {
      expect(screen.getByText(/Testing your Telegram bot token/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(mockValidateCredentials).toHaveBeenCalledWith("telegram", {
        botToken: VALID_TOKEN,
      });
    });
  });

  it("displays bot metadata after validation", async () => {
    const user = userEvent.setup();
    render(<TelegramWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));
    const tokenInput = screen.getByLabelText(/bot token/i);
    await user.type(tokenInput, VALID_TOKEN);
    await user.click(screen.getByText("Next"));

    // Validation step
    await waitFor(() => {
      expect(screen.getByText(/Testing your Telegram bot token/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Next"));

    // Advance through advanced step to confirmation
    await waitFor(() => {
      expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Configuration Complete")).toBeInTheDocument();
      expect(screen.getByText(/Bot ID:/i)).toBeInTheDocument();
    });
  });

  it("saves channel config via gateway config.patch", async () => {
    const user = userEvent.setup();

    const onComplete = vi.fn();
    render(<TelegramWizard onComplete={onComplete} onCancel={vi.fn()} />);

    // Navigate: intro → credentials → validation → advanced → confirmation
    await user.click(screen.getByText("Next"));
    const tokenInput = screen.getByLabelText(/bot token/i);
    await user.type(tokenInput, VALID_TOKEN);
    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText(/Testing your Telegram bot token/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Configuration Complete")).toBeInTheDocument();
    });

    // Click Save & Enable on confirmation step
    await user.click(screen.getByText("Save & Enable"));

    await waitFor(() => {
      expect(mockPatchGatewayConfig).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("loads existing token in edit mode", () => {
    const existingConfig = {
      channel: "telegram",
      enabled: true,
      configuredAt: new Date().toISOString(),
      configuredBy: "test-user",
      credentials: {
        botToken: "987654321:XYZabcDEFghiJKLmnoQRStuv012345678",
      },
      settings: {
        autoReply: false,
        allowedChatIds: [],
      },
    };

    render(
      <TelegramWizard
        channel="telegram"
        existingConfig={existingConfig}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const nextButton = screen.getByText("Next");
    userEvent.click(nextButton);

    waitFor(() => {
      const tokenInput = screen.getByLabelText(/bot token/i) as HTMLInputElement;
      expect(tokenInput.value).toBe("987654321:XYZabcDEFghiJKLmnoQRStuv012345678");
    });
  });

  it("shows help text about BotFather", async () => {
    render(<TelegramWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    // Intro step mentions BotFather (multiple references)
    const matches = screen.getAllByText(/BotFather/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("handles validation error gracefully", async () => {
    const user = userEvent.setup();
    mockValidateCredentials.mockResolvedValue({
      valid: false,
      errorMessage: "Bot not found",
    });

    render(<TelegramWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));
    const tokenInput = screen.getByLabelText(/bot token/i);
    await user.type(tokenInput, VALID_TOKEN);
    await user.click(screen.getByText("Next"));

    // Validation step
    await waitFor(() => {
      expect(screen.getByText(/Testing your Telegram bot token/i)).toBeInTheDocument();
    });

    // Trigger validation
    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Bot not found")).toBeInTheDocument();
    });
  });
});
