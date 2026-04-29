/**
 * GatewayStep Component Tests
 *
 * Tests gateway process start success/failure and status indicator
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/components/shared/IdentityBadge", () => ({
  IdentityBadge: () => <div data-testid="identity-badge">Identity</div>,
}));

vi.mock("./GatewayDetection", () => ({
  GatewayDetection: ({ onSkip }: { onSkip: () => void }) => (
    <button onClick={onSkip}>Skip Detection</button>
  ),
}));

const OnboardingWizard = await import("./OnboardingWizard").then((m) => m.OnboardingWizard);

describe("GatewayStep", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const navigateToGatewayStep = async () => {
    const user = userEvent.setup();

    // Mock previous steps
    vi.mocked(invoke)
      .mockResolvedValueOnce({ config: { gateway: { aiProvider: {} } } }) // get_edwinpai_config
      .mockResolvedValueOnce({ success: true }) // update_edwinpai_config_cmd
      .mockResolvedValueOnce({ // get_identity (called on Identity step mount)
        publicKey: "02test",
        petname: "Test",
        avatarSvg: "<svg></svg>",
        shortId: "test",
      });

    render(<OnboardingWizard onComplete={vi.fn()} />);

    // Navigate: Welcome → ApiKey → Identity → Gateway
    // In test mode, GatewayDetection doesn't render, so Get Started is already visible
    const getStartedButton = screen.getAllByRole("button").find(
      btn => btn.textContent?.includes("Get Started")
    );
    if (getStartedButton) await user.click(getStartedButton);

    await waitFor(() => screen.getByPlaceholderText(/sk-ant-/i));
    await user.type(screen.getByPlaceholderText(/sk-ant-/i), "sk-ant-test");
    await user.click(screen.getByRole("button", { name: /validate & continue/i }));

    // Wait for Identity step to complete (it auto-generates on mount)
    await waitFor(() => {
      const continueButton = screen.getByRole("button", { name: /^continue$/i });
      expect(continueButton).not.toBeDisabled();
    }, { timeout: 3000 });
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/start gateway/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  };

  it.skip("shows gateway start button", async () => {
    await navigateToGatewayStep();

    expect(screen.getByRole("button", { name: /start gateway/i })).toBeInTheDocument();
    expect(screen.getByText(/not started/i)).toBeInTheDocument();
  });

  it.skip("starts gateway successfully", async () => {
    const user = userEvent.setup();

    // Mock subscription check and gateway start
    vi.mocked(invoke)
      .mockResolvedValueOnce({ state: "Active" }) // check_subscription
      .mockResolvedValueOnce({ success: true }); // start_gateway_process

    await navigateToGatewayStep();

    const startButton = screen.getByRole("button", { name: /start gateway/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/gateway is running/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /running/i })).toBeDisabled();
    }, { timeout: 3000 });
  });

  it.skip("shows error when subscription invalid", async () => {
    const user = userEvent.setup();

    vi.mocked(invoke).mockResolvedValueOnce({ state: "Expired" }); // check_subscription

    await navigateToGatewayStep();

    const startButton = screen.getByRole("button", { name: /start gateway/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/valid subscription required/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it.skip("shows status indicator during startup", async () => {
    const user = userEvent.setup();

    vi.mocked(invoke)
      .mockResolvedValueOnce({ state: "Active" })
      .mockImplementation(() => new Promise(() => {})); // Hang on start

    await navigateToGatewayStep();

    const startButton = screen.getByRole("button", { name: /start gateway/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/starting gateway/i)).toBeInTheDocument();
      expect(screen.getByText(/starting gateway process/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it.skip("handles gateway start failure", async () => {
    const user = userEvent.setup();

    vi.mocked(invoke)
      .mockResolvedValueOnce({ state: "Active" })
      .mockRejectedValueOnce(new Error("Port 3000 already in use"));

    await navigateToGatewayStep();

    const startButton = screen.getByRole("button", { name: /start gateway/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/port 3000 already in use/i)).toBeInTheDocument();
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
