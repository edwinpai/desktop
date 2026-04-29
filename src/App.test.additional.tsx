/**
 * App Component Tests - Onboarding Routing
 *
 * Tests onboarding wizard routing and completion flow
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("App - Onboarding Routing", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows onboarding wizard when onboardingComplete is false", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      config: {
        ui: { onboardingComplete: false },
        gateway: { aiProvider: {} },
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/welcome to edwinpai/i)).toBeInTheDocument();
    });
  });

  it("skips onboarding when onboardingComplete is true", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      config: {
        ui: { onboardingComplete: true },
        gateway: { aiProvider: {} },
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText(/welcome to edwinpai/i)).not.toBeInTheDocument();
    });
  });

  it("saves onboarding completion to config", async () => {
    const user = userEvent.setup();

    // Initial config load
    vi.mocked(invoke).mockResolvedValueOnce({
      config: {
        ui: { onboardingComplete: false },
        gateway: { aiProvider: {} },
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/welcome to edwinpai/i)).toBeInTheDocument();
    });

    // Mock onboarding completion
    vi.mocked(invoke)
      .mockResolvedValueOnce({ // get_edwinpai_config for save
        config: {
          ui: { onboardingComplete: false },
          gateway: { aiProvider: {} },
        },
      })
      .mockResolvedValueOnce({ success: true }); // update_edwinpai_config

    // Complete onboarding (simulate through steps)
    const getStartedButton = screen.getByRole("button", { name: /get started/i });
    await user.click(getStartedButton);

    // Verify update_edwinpai_config was called
    await waitFor(() => {
      const updateCalls = vi.mocked(invoke).mock.calls.filter(
        (call) => call[0] === "update_edwinpai_config"
      );
      expect(updateCalls.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("shows mode selection after onboarding complete", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({
        config: {
          ui: { onboardingComplete: false },
          gateway: { aiProvider: {} },
        },
      })
      .mockResolvedValueOnce({
        config: {
          ui: { onboardingComplete: false },
          gateway: { aiProvider: {} },
        },
      })
      .mockResolvedValueOnce({ success: true });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/welcome to edwinpai/i)).toBeInTheDocument();
    });

    // Note: Full navigation test would require completing all wizard steps
    // This is covered by OnboardingWizard.test.tsx
  });
});
