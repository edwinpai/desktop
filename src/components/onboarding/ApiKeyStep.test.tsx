/**
 * ApiKeyStep Component Tests
 *
 * Tests API key validation, success/failure states, and error handling.
 * Step order: Welcome → Gateway → ApiKey → ...
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock config (for gateway step updateConfig)
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

vi.mock("@/lib/action-approvals", () => ({
  fetchPendingActionApprovals: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/gateway-context", () => ({
  callGatewayMethod: vi.fn().mockResolvedValue({}),
  patchGatewayConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/vault-policy", () => ({
  loadPolicy: vi.fn().mockResolvedValue({ rules: [] }),
  savePolicy: vi.fn().mockResolvedValue(undefined),
  setRuleForCredential: vi.fn((policy) => policy),
}));

// Import after mocks
const OnboardingWizard = await import("./OnboardingWizard").then(
  (m) => m.OnboardingWizard,
);

describe("ApiKeyStep", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Default mock: scan finds one gateway, probe succeeds
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case "scan_gateways":
          return [{ url: "http://localhost:18789", version: null, name: null }];
        case "probe_gateway":
          return { found: true, url: "http://localhost:18789", error: null };
        case "vault_store":
        case "vault_list":
        case "vault_delete":
          return {};
        default:
          return {};
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const navigateToApiKeyStep = async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={vi.fn()} />);

    // Welcome → Get Started
    const getStartedButton = screen.getByRole("button", {
      name: /get started/i,
    });
    await user.click(getStartedButton);

    // Gateway step → Connect → Continue
    await waitFor(() => screen.getByRole("button", { name: /^connect$/i }));
    await user.click(screen.getByRole("button", { name: /^connect$/i }));
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    // Security model step
    await waitFor(() =>
      screen.getByRole("button", { name: /i understand.*continue/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /i understand.*continue/i }),
    );

    // Vault health step
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    // Now on ApiKey step
    await waitFor(() => {
      expect(screen.getByText(/ai provider api key/i)).toBeInTheDocument();
    });
  };

  it("renders API key input field", async () => {
    await navigateToApiKeyStep();

    const input = screen.getByPlaceholderText(/sk-\.\.\./i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  it("validates API key successfully", async () => {
    const user = userEvent.setup();

    render(<OnboardingWizard onComplete={vi.fn()} />);

    // Navigate through Welcome + Gateway
    await user.click(screen.getByRole("button", { name: /get started/i }));
    await waitFor(() => screen.getByRole("button", { name: /^connect$/i }));
    await user.click(screen.getByRole("button", { name: /^connect$/i }));
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() =>
      screen.getByRole("button", { name: /i understand.*continue/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /i understand.*continue/i }),
    );
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    // Now on ApiKey step
    await waitFor(() => screen.getByPlaceholderText(/sk-\.\.\./i));
    const input = screen.getByPlaceholderText(/sk-\.\.\./i);
    await user.type(input, "sk-test-key-123");

    // Mock add_provider for validation
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case "vault_store":
          return {};
        default:
          return {};
      }
    });

    const validateButton = screen.getByRole("button", {
      name: /validate & continue/i,
    });
    await user.click(validateButton);

    await waitFor(() => {
      expect(
        screen.getByText(/api key saved to desktop vault/i),
      ).toBeInTheDocument();
    });
  });

  it("shows validation failure error", async () => {
    const user = userEvent.setup();

    render(<OnboardingWizard onComplete={vi.fn()} />);

    // Navigate through Welcome + Gateway
    await user.click(screen.getByRole("button", { name: /get started/i }));
    await waitFor(() => screen.getByRole("button", { name: /^connect$/i }));
    await user.click(screen.getByRole("button", { name: /^connect$/i }));
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() =>
      screen.getByRole("button", { name: /i understand.*continue/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /i understand.*continue/i }),
    );
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => screen.getByPlaceholderText(/sk-\.\.\./i));
    const input = screen.getByPlaceholderText(/sk-\.\.\./i);
    await user.type(input, "invalid-key");

    // Mock add_provider to fail
    vi.mocked(invoke).mockImplementation(async () => {
      throw new Error("Invalid API key");
    });

    const validateButton = screen.getByRole("button", {
      name: /validate & continue/i,
    });
    await user.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid api key/i)).toBeInTheDocument();
    });
  });

  it("shows error when API key is empty", async () => {
    const user = userEvent.setup();
    await navigateToApiKeyStep();

    const validateButton = screen.getByRole("button", {
      name: /validate & continue/i,
    });
    await user.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter an api key/i)).toBeInTheDocument();
    });
  });

  it("disables input during validation", async () => {
    const user = userEvent.setup();

    render(<OnboardingWizard onComplete={vi.fn()} />);

    // Navigate through Welcome + Gateway
    await user.click(screen.getByRole("button", { name: /get started/i }));
    await waitFor(() => screen.getByRole("button", { name: /^connect$/i }));
    await user.click(screen.getByRole("button", { name: /^connect$/i }));
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() =>
      screen.getByRole("button", { name: /i understand.*continue/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /i understand.*continue/i }),
    );
    await waitFor(() => screen.getByRole("button", { name: /^continue$/i }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => screen.getByPlaceholderText(/sk-\.\.\./i));
    const input = screen.getByPlaceholderText(/sk-\.\.\./i);
    await user.type(input, "sk-test");

    // Mock invoke to never resolve (simulates long validation)
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));

    const validateButton = screen.getByRole("button", {
      name: /validate & continue/i,
    });
    await user.click(validateButton);

    await waitFor(() => {
      expect(input).toBeDisabled();
      expect(screen.getByText(/validating/i)).toBeInTheDocument();
    });
  });
});
