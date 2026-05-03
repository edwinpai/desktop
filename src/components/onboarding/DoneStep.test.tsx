/**
 * DoneStep Component Tests
 *
 * Tests completion screen rendering
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/components/shared/IdentityBadge", () => ({
  IdentityBadge: () => <div>Identity</div>,
}));

vi.mock("./GatewayDetection", () => ({
  GatewayDetection: ({ onSkip }: { onSkip: () => void }) => (
    <button onClick={onSkip}>Skip Detection</button>
  ),
}));

global.fetch = vi.fn();

const OnboardingWizard = await import("./OnboardingWizard").then(
  (m) => m.OnboardingWizard,
);

describe("DoneStep", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const navigateToDoneStep = async () => {
    const user = userEvent.setup();

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode("data: [DONE]\n"),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    vi.mocked(invoke)
      .mockResolvedValueOnce({ config: { gateway: { aiProvider: {} } } }) // get_edwinpai_config
      .mockResolvedValueOnce({ success: true }) // update_edwinpai_config_cmd
      .mockResolvedValueOnce({
        // get_identity
        publicKey: "02test",
        petname: "Test",
        avatarSvg: "<svg></svg>",
        shortId: "test",
      })
      .mockResolvedValueOnce({ state: "Active" }) // check_subscription
      .mockResolvedValueOnce({ success: true }); // start_gateway_process

    render(<OnboardingWizard onComplete={vi.fn()} />);

    // Navigate through all steps to Done
    // In test mode, GatewayDetection doesn't render, so Get Started is already visible
    await user.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => screen.getByPlaceholderText(/sk-ant-/i));
    await user.type(screen.getByPlaceholderText(/sk-ant-/i), "sk-ant-test");
    await user.click(
      screen.getByRole("button", { name: /validate & continue/i }),
    );

    const continueFromApi = await screen.findByRole("button", {
      name: /^continue$/i,
    });
    await user.click(continueFromApi);

    await waitFor(() => screen.getByRole("button", { name: /start gateway/i }));
    await user.click(screen.getByRole("button", { name: /start gateway/i }));

    await waitFor(() =>
      screen.getByRole("button", { name: /send test message/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /send test message/i }),
    );

    await waitFor(
      () => screen.getAllByRole("button", { name: /^continue$/i }).length > 0,
    );
    const continueButtons = screen.getAllByRole("button", {
      name: /^continue$/i,
    });
    const continueFromTestChat = continueButtons[0];
    if (!continueFromTestChat) throw new Error("Expected a continue button");
    await user.click(continueFromTestChat);

    await waitFor(() => screen.getByText(/connect channels/i));
    const skipButton = screen.getByRole("button", { name: /skip for now/i });
    await user.click(skipButton);

    await waitFor(
      () => {
        expect(screen.getByText(/you're all set/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  };

  it.skip("shows completion message", async () => {
    await navigateToDoneStep();

    expect(screen.getByText(/you're all set/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your edwinpai assistant is ready to use/i),
    ).toBeInTheDocument();
  });

  it.skip("shows complete button instead of next", async () => {
    await navigateToDoneStep();

    expect(
      screen.getByRole("button", { name: /complete/i }),
    ).toBeInTheDocument();
  });
});
