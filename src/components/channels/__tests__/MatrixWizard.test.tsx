import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MatrixWizard } from "../MatrixWizard";

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

import { useChannels } from "@/hooks/useChannels";
import { useChannelStore } from "@/stores/channelStore";

const mockUseChannels = vi.mocked(useChannels);
const mockUseChannelStore = vi.mocked(useChannelStore);

describe("MatrixWizard", () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();
  const mockValidateCredentials = vi.fn();
  const mockCreateChannel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseChannels.mockReturnValue({
      validateCredentials: mockValidateCredentials,
      createChannel: mockCreateChannel,
      error: null,
    } as unknown as ReturnType<typeof useChannels>);

    mockUseChannelStore.mockReturnValue({
      currentUserLevel: "owner",
    });
  });

  describe("Intro Step", () => {
    it("should render intro step", () => {
      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      expect(screen.getByText("Connect Matrix Account")).toBeInTheDocument();
      expect(
        screen.getByText(
          /This wizard will help you connect to a Matrix homeserver/i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Credentials Step", () => {
    it("should render access token tab", async () => {
      const user = userEvent.setup();
      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to Access Token tab (defaults to password)
      await user.click(screen.getByRole("tab", { name: "Access Token" }));

      expect(
        screen.getByRole("tab", { name: "Access Token" }),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/https:\/\/matrix\.org/i),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/syt_/i)).toBeInTheDocument();
    });

    it("should render username/password tab", async () => {
      const user = userEvent.setup();
      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to password tab
      await user.click(screen.getByRole("tab", { name: "Username/Password" }));

      expect(
        screen.getByPlaceholderText(/@user:matrix\.org/i),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    });

    it("should validate homeserver URL format", async () => {
      const user = userEvent.setup();
      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to Access Token tab
      await user.click(screen.getByRole("tab", { name: "Access Token" }));

      // Clear default homeserver and enter invalid URL
      const homeserverInput = screen.getByPlaceholderText(
        /https:\/\/matrix\.org/i,
      );
      await user.clear(homeserverInput);
      await user.type(homeserverInput, "invalid-url");

      // Enter access token
      const tokenInput = screen.getByPlaceholderText(/syt_/i);
      await user.type(tokenInput, "syt_test_token");

      // Try to proceed
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText(/Invalid homeserver URL/i)).toBeInTheDocument();
      });
    });

    it("should validate access token presence", async () => {
      const user = userEvent.setup();
      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to Access Token tab
      await user.click(screen.getByRole("tab", { name: "Access Token" }));

      // Try to proceed without token (empty by default)
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(
          screen.getByText("Access token is required"),
        ).toBeInTheDocument();
      });
    });

    it("should validate username+password presence", async () => {
      const user = userEvent.setup();
      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to password tab
      await user.click(screen.getByText("Username/Password"));

      // Try to proceed without credentials
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(
          screen.getByText(/Username and password are required/i),
        ).toBeInTheDocument();
      });
    });

    it("should switch between auth methods", async () => {
      const user = userEvent.setup();
      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Should start on password tab (default)
      expect(
        screen.getByPlaceholderText(/@user:matrix\.org/i),
      ).toBeInTheDocument();

      // Switch to token tab
      await user.click(screen.getByRole("tab", { name: "Access Token" }));
      expect(screen.getByPlaceholderText(/syt_/i)).toBeInTheDocument();

      // Switch back to password tab
      await user.click(screen.getByRole("tab", { name: "Username/Password" }));
      expect(
        screen.getByPlaceholderText(/@user:matrix\.org/i),
      ).toBeInTheDocument();
    });
  });

  describe("Validation Step", () => {
    it("should call validateCredentials with correct data (token)", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { homeserver: "https://matrix.org", authMethod: "token" },
      });

      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to Access Token tab
      await user.click(screen.getByRole("tab", { name: "Access Token" }));

      const tokenInput = screen.getByPlaceholderText(/syt_/i);
      await user.type(tokenInput, "syt_test_token");

      // Click Next to proceed to validation step
      await user.click(screen.getByText("Next"));

      // Validation step should show "Validating..."
      await waitFor(() => {
        expect(
          screen.getByText(/Validating your credentials/i),
        ).toBeInTheDocument();
      });

      // Click Next from validation step to trigger validateCredentials
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(mockValidateCredentials).toHaveBeenCalledWith("matrix", {
          homeserver: "https://matrix.org",
          accessToken: "syt_test_token",
        });
      });
    });

    it("should call validateCredentials with correct data (password)", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: {
          homeserver: "https://matrix.org",
          authMethod: "password",
          username: "@alice:matrix.org",
        },
      });

      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to password tab
      await user.click(screen.getByRole("tab", { name: "Username/Password" }));

      const usernameInput = screen.getByPlaceholderText(/@user:matrix\.org/i);
      await user.type(usernameInput, "@alice:matrix.org");

      const passwordInput = screen.getByPlaceholderText(/••••••••/i);
      await user.type(passwordInput, "secret123");

      // Click Next to proceed to validation step
      await user.click(screen.getByText("Next"));

      // Validation step should show "Validating..."
      await waitFor(() => {
        expect(
          screen.getByText(/Validating your credentials/i),
        ).toBeInTheDocument();
      });

      // Click Next from validation step to trigger validateCredentials
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(mockValidateCredentials).toHaveBeenCalledWith("matrix", {
          homeserver: "https://matrix.org",
          username: "@alice:matrix.org",
          password: "secret123",
        });
      });
    });

    it("should display validation metadata (homeserver, authMethod)", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: {
          homeserver: "https://matrix.org",
        },
      });

      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to Access Token tab
      await user.click(screen.getByRole("tab", { name: "Access Token" }));

      const tokenInput = screen.getByPlaceholderText(/syt_/i);
      await user.type(tokenInput, "syt_test_token");

      // Click Next to proceed to validation step
      await user.click(screen.getByText("Next"));

      // Click Next from validation step to trigger validation and advance
      await user.click(screen.getByText("Next"));

      // Should now be on confirmation step showing validation metadata
      await waitFor(() => {
        expect(screen.getByText("Configuration Complete")).toBeInTheDocument();
        expect(screen.getByText("https://matrix.org")).toBeInTheDocument();
        expect(screen.getByText("Access Token")).toBeInTheDocument();
      });
    });

    it("should display username in metadata", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: {
          homeserver: "https://matrix.org",
          username: "@alice:matrix.org",
        },
      });

      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));
      await user.click(screen.getByRole("tab", { name: "Username/Password" }));

      const usernameInput = screen.getByPlaceholderText(/@user:matrix\.org/i);
      await user.type(usernameInput, "@alice:matrix.org");

      const passwordInput = screen.getByPlaceholderText(/••••••••/i);
      await user.type(passwordInput, "secret123");

      // Click Next to proceed to validation step
      await user.click(screen.getByText("Next"));

      // Click Next from validation step to trigger validation and advance
      await user.click(screen.getByText("Next"));

      // Should now be on confirmation step showing validation metadata
      await waitFor(() => {
        expect(screen.getByText("Configuration Complete")).toBeInTheDocument();
        expect(screen.getByText("@alice:matrix.org")).toBeInTheDocument();
      });
    });

    it("should handle validation errors", async () => {
      const user = userEvent.setup();
      mockValidateCredentials.mockResolvedValue({
        valid: false,
        errorMessage: "Invalid access token",
      });

      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      await user.click(screen.getByText("Next"));

      // Switch to Access Token tab
      await user.click(screen.getByRole("tab", { name: "Access Token" }));

      const tokenInput = screen.getByPlaceholderText(/syt_/i);
      await user.type(tokenInput, "syt_invalid");

      // Click Next to proceed to validation step
      await user.click(screen.getByText("Next"));

      // Click Next from validation step to trigger validation
      await user.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Invalid access token")).toBeInTheDocument();
      });
    });
  });

  describe("Confirmation Step", () => {
    it("should create channel on completion", async () => {
      const user = userEvent.setup();

      // Mock gateway-context for config.patch path
      vi.doMock("@/lib/gateway-context", () => ({
        patchGatewayConfig: vi.fn().mockResolvedValue(undefined),
        resolveToken: vi.fn().mockResolvedValue("test-token"),
        inferGatewayKind: vi.fn().mockReturnValue("local"),
      }));
      vi.doMock("@/lib/config", () => ({
        readConfig: vi.fn().mockResolvedValue({
          gatewayUrl: "http://localhost:18789",
          gatewayToken: "test-token",
        }),
      }));

      mockValidateCredentials.mockResolvedValue({
        valid: true,
        metadata: { homeserver: "https://matrix.org" },
      });

      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      // Step 1: Click Next from intro
      await user.click(screen.getByText("Next"));

      // Step 2: Switch to Access Token tab, enter token and click Next
      await user.click(screen.getByRole("tab", { name: "Access Token" }));
      const tokenInput = screen.getByPlaceholderText(/syt_/i);
      await user.type(tokenInput, "syt_test_token");
      await user.click(screen.getByText("Next"));

      // Step 3: Validation step - click Next to trigger validation and advance
      await user.click(screen.getByText("Next"));

      // Should now be on confirmation step
      await waitFor(() => {
        expect(screen.getByText("Configuration Complete")).toBeInTheDocument();
      });

      // Click Save & Enable to complete
      const saveButton = screen.getByText("Save & Enable");
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe("Cancel Flow", () => {
    it("should call onCancel when cancel button clicked", async () => {
      const user = userEvent.setup();
      render(
        <MatrixWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />,
      );

      const cancelButton = screen.getByText("Cancel");
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
