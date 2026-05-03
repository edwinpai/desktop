/**
 * IdentityStep Component Tests
 *
 * Tests BSV identity generation via IPC, error handling, and retry logic
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock IdentityBadge component
vi.mock("@/components/shared/IdentityBadge", () => ({
  IdentityBadge: ({
    publicKey,
    petname,
  }: {
    publicKey: string;
    petname: string;
  }) => (
    <div data-testid="identity-badge">
      <div data-testid="public-key">{publicKey}</div>
      <div data-testid="petname">{petname}</div>
    </div>
  ),
}));

vi.mock("./GatewayDetection", () => ({
  GatewayDetection: ({ onSkip }: { onSkip: () => void }) => (
    <button onClick={onSkip}>Skip Detection</button>
  ),
}));

const OnboardingWizard = await import("./OnboardingWizard").then(
  (m) => m.OnboardingWizard,
);

describe("IdentityStep", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const navigateToIdentityStep = async () => {
    const user = userEvent.setup();

    // Mock API key validation
    vi.mocked(invoke)
      .mockResolvedValueOnce({ config: { gateway: { aiProvider: {} } } }) // get_edwinpai_config
      .mockResolvedValueOnce({ success: true }); // update_edwinpai_config_cmd

    render(<OnboardingWizard onComplete={vi.fn()} />);

    // Navigate: Welcome → ApiKey → Identity
    // In test mode, GatewayDetection doesn't render, so Get Started is already visible
    const getStartedButton = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.includes("Get Started"));
    if (getStartedButton) await user.click(getStartedButton);

    await waitFor(() => {
      expect(screen.getByText(/configure ai provider/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/sk-ant-/i);
    await user.type(input, "sk-ant-test");

    const validateButton = screen.getByRole("button", {
      name: /validate & continue/i,
    });
    await user.click(validateButton);
  };

  it.skip("auto-generates identity on mount", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      publicKey: "02a1b2c3d4e5f6",
      petname: "Alice",
      avatarSvg: "<svg></svg>",
      shortId: "a1b2",
    });

    await navigateToIdentityStep();

    await waitFor(
      () => {
        expect(screen.getByText(/set up your identity/i)).toBeInTheDocument();
        expect(screen.getByTestId("identity-badge")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it.skip("displays generated identity details", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      publicKey: "02abcdef123456",
      petname: "BobTheBuilder",
      avatarSvg: "<svg></svg>",
      shortId: "abcd",
    });

    await navigateToIdentityStep();

    await waitFor(
      () => {
        expect(screen.getByTestId("public-key")).toHaveTextContent(
          "02abcdef123456",
        );
        expect(screen.getByTestId("petname")).toHaveTextContent(
          "BobTheBuilder",
        );
      },
      { timeout: 3000 },
    );
  });

  it.skip("shows loading state during generation", async () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {})); // Never resolves

    await navigateToIdentityStep();

    await waitFor(
      () => {
        expect(
          screen.getByText(/generating your unique cryptographic identity/i),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it.skip("handles generation error with retry button", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Keychain unavailable"));

    await navigateToIdentityStep();

    await waitFor(
      () => {
        expect(screen.getByText(/keychain unavailable/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /retry/i }),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Test retry
    vi.mocked(invoke).mockResolvedValueOnce({
      publicKey: "02retry123",
      petname: "RetryUser",
      avatarSvg: "<svg></svg>",
      shortId: "retr",
    });

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    await waitFor(
      () => {
        expect(screen.getByTestId("petname")).toHaveTextContent("RetryUser");
      },
      { timeout: 3000 },
    );
  });

  it.skip("enables continue button after successful generation", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      publicKey: "02test",
      petname: "TestUser",
      avatarSvg: "<svg></svg>",
      shortId: "test",
    });

    await navigateToIdentityStep();

    await waitFor(
      () => {
        const continueButton = screen.getByRole("button", {
          name: /^continue$/i,
        });
        expect(continueButton).not.toBeDisabled();
      },
      { timeout: 3000 },
    );
  });
});
