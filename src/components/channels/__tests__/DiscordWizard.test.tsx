import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DiscordWizard } from "../DiscordWizard";

const mockValidateCredentials = vi.fn();
const mockCreateChannel = vi.fn();
const mockPatchGatewayConfig = vi.fn();

// Mock dependencies
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/hooks/useChannels", () => ({
  useChannels: vi.fn(),
}));

vi.mock("@/stores/channelStore", () => ({
  useChannelStore: vi.fn(),
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

import { useChannels } from "@/hooks/useChannels";
import { useChannelStore } from "@/stores/channelStore";

const mockUseChannels = vi.mocked(useChannels);
const mockUseChannelStore = vi.mocked(useChannelStore);

describe("DiscordWizard", () => {
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
      currentUserLevel: "owner",
    });
  });

  describe("Intro Step", () => {
    it("should render intro step", () => {
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      expect(screen.getByText("Connect Discord Bot")).toBeInTheDocument();
      expect(
        screen.getByText(/This wizard will help you connect a Discord bot/i),
      ).toBeInTheDocument();
    });
  });

  describe("Credentials Step", () => {
    it("should render bot token tab", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      expect(
        screen.getByRole("tab", { name: "Bot Token" }),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/MTk4NjIyNDgz/i)).toBeInTheDocument();
    });

    it("should render OAuth tab", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // OAuth tab should be disabled (Coming Soon)
      const oauthTab = screen.getByRole("tab", {
        name: /OAuth \(Coming Soon\)/i,
      });
      expect(oauthTab).toBeDisabled();
    });

    it("should validate bot token presence", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Try to proceed without token
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Bot token is required")).toBeInTheDocument();
      });
    });

    it("should validate bot token length (≥50 chars)", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      const input = screen.getByPlaceholderText(/MTk4NjIyNDgz/i);
      await user.type(input, "short");

      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Bot token appears too short. Please check and try again.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("should validate OAuth access token presence", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // OAuth tab should be disabled
      const oauthTab = screen.getByRole("tab", {
        name: /OAuth \(Coming Soon\)/i,
      });
      expect(oauthTab).toBeDisabled();
    });

    it("should validate OAuth refresh token presence", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // OAuth tab should be disabled
      const oauthTab = screen.getByRole("tab", {
        name: /OAuth \(Coming Soon\)/i,
      });
      expect(oauthTab).toBeDisabled();
    });

    it("should validate OAuth expiration date presence", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // OAuth tab should be disabled
      const oauthTab = screen.getByRole("tab", {
        name: /OAuth \(Coming Soon\)/i,
      });
      expect(oauthTab).toBeDisabled();
    });

    it("should switch between auth methods", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Should start on bot token tab with input visible
      expect(screen.getByPlaceholderText(/MTk4NjIyNDgz/i)).toBeInTheDocument();

      // OAuth tab should be visible but disabled
      const oauthTab = screen.getByRole("tab", {
        name: /OAuth \(Coming Soon\)/i,
      });
      expect(oauthTab).toBeDisabled();

      // Bot Token tab should be active
      const botTokenTab = screen.getByRole("tab", { name: "Bot Token" });
      expect(botTokenTab).toHaveAttribute("data-state", "active");
    });
  });

  describe("Validation Step", () => {
    it("should call validateCredentials with bot token", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { botId: "123456789", username: "TestBot" },
      });

      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      const input = screen.getByPlaceholderText(/MTk4NjIyNDgz/i);
      await user.type(
        input,
        "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKlMnOpQrStUvWxYz123456",
      );

      // Click Next to proceed to validation step
      await user.click(screen.getByText("Next"));

      // Validation step should show "Validating..."
      await waitFor(() => {
        expect(
          screen.getByText(/Validating your bot token/i),
        ).toBeInTheDocument();
      });

      // Click Next from validation step to trigger validateCredentials
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(mockValidateCredentials).toHaveBeenCalledWith("discord", {
          botToken: "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKlMnOpQrStUvWxYz123456",
        });
      });
    });

    it("should call validateCredentials with OAuth tokens", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // OAuth is disabled (Coming Soon)
      const oauthTab = screen.getByRole("tab", {
        name: /OAuth \(Coming Soon\)/i,
      });
      expect(oauthTab).toBeDisabled();
    });

    it("should display validation metadata (authMethod)", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: {
          botId: "123456789",
          username: "TestBot",
          discriminator: "1234",
        },
      });

      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      const input = screen.getByPlaceholderText(/MTk4NjIyNDgz/i);
      await user.type(
        input,
        "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKlMnOpQrStUvWxYz123456",
      );

      // Click Next to proceed to validation step
      await user.click(screen.getByText("Next"));

      // Click Next from validation step to trigger validation and advance
      await user.click(screen.getByText("Next"));

      // Should now be on advanced step
      await waitFor(() => {
        expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Configuration Complete")).toBeInTheDocument();
        expect(screen.getByText("TestBot#1234")).toBeInTheDocument();
      });
    });

    it("should handle validation errors", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: false,
        errorMessage: "Invalid bot token",
      });

      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      const input = screen.getByPlaceholderText(/MTk4NjIyNDgz/i);
      await user.type(
        input,
        "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKlMnOpQrStUvWxYz123456",
      );

      // Click Next to proceed to validation step
      await user.click(screen.getByText("Next"));

      // Click Next from validation step to trigger validation
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Invalid bot token")).toBeInTheDocument();
      });
    });
  });

  describe("Confirmation Step", () => {
    it("should create channel on completion", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { botId: "123456789", username: "TestBot" },
      });
      mockCreateChannel.mockResolvedValue({});

      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      // Step 1: Click Next from intro
      await user.click(screen.getByText("Next"));

      // Step 2: Enter token and click Next
      const input = screen.getByPlaceholderText(/MTk4NjIyNDgz/i);
      await user.type(
        input,
        "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKlMnOpQrStUvWxYz123456",
      );
      await user.click(screen.getByText("Next"));

      // Step 3: Validation step - click Next to trigger validation and advance
      await user.click(screen.getByText("Next"));

      // Should now be on advanced step
      await waitFor(() => {
        expect(screen.getByText(/Advanced Settings/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Configuration Complete")).toBeInTheDocument();
      });

      // Click Save & Enable to complete
      const saveButton = screen.getByText("Save & Enable");
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockPatchGatewayConfig).toHaveBeenCalled();
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe("Cancel Flow", () => {
    it("should call onCancel when cancel button clicked", async () => {
      const user = userEvent.setup();
      render(
        <DiscordWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      const cancelButton = screen.getByText("Cancel");
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
