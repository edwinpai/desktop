/**
 * MatrixWizard Component Tests
 *
 * Tests Matrix channel configuration with homeserver URL and auth methods.
 * Uses WizardShell step-based navigation (Next/Back).
 *
 * Note: Default auth method is 'password' (unless existingConfig has accessToken).
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatrixWizard } from "./MatrixWizard";

const mockValidateCredentials = vi.fn();
const mockCreateChannel = vi.fn();

// Mock useChannels hook
vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({
    createChannel: mockCreateChannel,
    updateChannel: vi.fn().mockResolvedValue({ success: true }),
    validateCredentials: mockValidateCredentials,
  }),
}));

// Mock invoke for IPC
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("MatrixWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCredentials.mockResolvedValue({
      valid: true,
      metadata: {
        homeserver: "https://matrix.org",
        userId: "@test:matrix.org",
        authMethod: "token",
      },
    });
    mockCreateChannel.mockResolvedValue({});
  });

  it("renders introduction step", () => {
    render(<MatrixWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText("Connect Matrix Account")).toBeInTheDocument();
  });

  it("shows homeserver input field", async () => {
    const user = userEvent.setup();
    render(<MatrixWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByLabelText(/Homeserver URL/i)).toBeInTheDocument();
    });
  });

  it("defaults to password authentication method", async () => {
    const user = userEvent.setup();
    render(<MatrixWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));

    // Without existingConfig, default is 'password'
    await waitFor(() => {
      const passwordTab = screen.getByRole("tab", { name: /Username\/Password/i });
      expect(passwordTab).toHaveAttribute("data-state", "active");
    });
  });

  it("allows switching to token authentication", async () => {
    const user = userEvent.setup();
    render(<MatrixWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));

    // Switch to token tab
    const tokenTab = screen.getByRole("tab", { name: /Access Token/i });
    await user.click(tokenTab);

    await waitFor(() => {
      // Token input should now be visible (type=password, placeholder starts with syt_)
      expect(screen.getByPlaceholderText(/syt_/i)).toBeInTheDocument();
    });
  });

  it("validates token credentials successfully", async () => {
    const user = userEvent.setup();
    render(<MatrixWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    // Intro → credentials
    await user.click(screen.getByText("Next"));

    // Switch to token auth
    const tokenTab = screen.getByRole("tab", { name: /Access Token/i });
    await user.click(tokenTab);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/syt_/i)).toBeInTheDocument();
    });

    // Homeserver already defaults to https://matrix.org
    const tokenInput = screen.getByPlaceholderText(/syt_/i);
    await user.type(tokenInput, "syt_test_token_12345");

    // Credentials → validation step
    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText(/Testing your Matrix credentials/i)).toBeInTheDocument();
    });

    // Trigger validation
    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(mockValidateCredentials).toHaveBeenCalledWith("matrix", expect.objectContaining({
        homeserver: "https://matrix.org",
        accessToken: "syt_test_token_12345",
      }));
    });
  });

  it("shows error for invalid homeserver URL", async () => {
    const user = userEvent.setup();
    render(<MatrixWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByText("Next"));

    const homeserverInput = screen.getByLabelText(/Homeserver URL/i);
    await user.clear(homeserverInput);
    await user.type(homeserverInput, "not-a-url");

    // Fill in username/password (default auth) so we don't fail on that
    const usernameInput = screen.getByPlaceholderText(/@user:matrix.org/i);
    const passwordInput = screen.getByLabelText("Password");
    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpass");

    // Click Next triggers credentials onValidate which checks URL
    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText(/Invalid homeserver URL/i)).toBeInTheDocument();
    });
  });

  it("saves channel config via gateway config.patch", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

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

    render(<MatrixWizard onComplete={onComplete} onCancel={vi.fn()} />);

    // Navigate: intro → credentials
    await user.click(screen.getByText("Next"));

    // Switch to token auth and fill
    const tokenTab = screen.getByRole("tab", { name: /Access Token/i });
    await user.click(tokenTab);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/syt_/i)).toBeInTheDocument();
    });

    const tokenInput = screen.getByPlaceholderText(/syt_/i);
    await user.type(tokenInput, "syt_test_token_12345");

    // Credentials → validation
    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText(/Testing your Matrix credentials/i)).toBeInTheDocument();
    });

    // Validation → confirmation
    await user.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText(/Configuration Complete/i)).toBeInTheDocument();
    });

    // Save & Enable → triggers confirmation onValidate which uses invoke
    await user.click(screen.getByText("Save & Enable"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it("loads existing configuration in edit mode", () => {
    const existingConfig = {
      channel: "matrix",
      enabled: true,
      configuredAt: new Date().toISOString(),
      configuredBy: "test-user",
      credentials: {
        homeserver: "https://custom.matrix.org",
        accessToken: "existing_token",
      },
      settings: {
        autoReply: false,
        allowedChatIds: [],
      },
    };

    render(
      <MatrixWizard
        channel="matrix"
        existingConfig={existingConfig}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const nextButton = screen.getByText("Next");
    userEvent.click(nextButton);

    waitFor(() => {
      const homeserverInput = screen.getByLabelText(/Homeserver URL/i) as HTMLInputElement;
      expect(homeserverInput.value).toBe("https://custom.matrix.org");
    });
  });

  it("supports cancel action", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<MatrixWizard onComplete={vi.fn()} onCancel={onCancel} />);

    const cancelButton = screen.getByText("Cancel");
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });
});
