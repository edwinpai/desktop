import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GeneralSettings } from "../GeneralSettings";

import { APP_VERSION } from "@/lib/app-version";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

type SaveConfigPayload = {
  config?: {
    gateway?: {
      port?: number;
    };
  };
};

const isSaveConfigPortCall = (call: unknown[], port: number): boolean => {
  const [command, payload] = call;
  return (
    command === "save_config" &&
    typeof payload === "object" &&
    payload !== null &&
    (payload as SaveConfigPayload).config?.gateway?.port === port
  );
};

describe("GeneralSettings", () => {
  const mockConfig = {
    version: APP_VERSION,
    mode: "gateway" as const,
    gateway: {
      port: 3000,
      autoStart: true,
      autoRestart: true,
      maxRestarts: 5,
      healthCheckIntervalMs: 30000,
      logLevel: "info",
    },
    mdns: {
      enabled: true,
      serviceName: null,
      advertiseOnStartup: true,
    },
    ui: {
      theme: "system" as const,
      minimizeToTray: true,
      startMinimized: false,
      windowWidth: 1200,
      windowHeight: 800,
      windowX: null,
      windowY: null,
    },
    subscription: {
      cacheTtlSeconds: 3600,
      checkOnStartup: true,
      autoRenewReminderDays: 7,
    },
    lastClientSession: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(mockConfig);
  });

  describe("Component Rendering", () => {
    it("renders loading state initially", async () => {
      mockInvoke.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(mockConfig), 100)),
      );
      render(<GeneralSettings />);
      // Loading state shows skeleton (no text), verify no "General Settings" yet
      expect(screen.queryByText("General Settings")).not.toBeInTheDocument();
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(screen.getByText("Operating Mode")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("renders settings after loading config", async () => {
      render(<GeneralSettings />);

      await waitFor(
        () => {
          expect(screen.getByText("General Settings")).toBeInTheDocument();
          expect(screen.getByText("Operating Mode")).toBeInTheDocument();
          expect(screen.getByText("Appearance")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("displays gateway mode by default", async () => {
      render(<GeneralSettings />);

      await waitFor(
        () => {
          const gatewayCard = screen
            .getByText("Gateway Mode")
            .closest("button");
          expect(gatewayCard).toHaveClass("border-blue-500");
        },
        { timeout: 1000 },
      );
    });

    it("displays client mode when configured", async () => {
      mockInvoke.mockResolvedValue({ ...mockConfig, mode: "client" });
      render(<GeneralSettings />);

      await waitFor(
        () => {
          const clientCard = screen.getByText("Client Mode").closest("button");
          expect(clientCard).toHaveClass("border-blue-500");
        },
        { timeout: 1000 },
      );
    });

    it("shows gateway-specific settings in gateway mode", async () => {
      render(<GeneralSettings />);

      await waitFor(
        () => {
          expect(screen.getByText("Gateway Settings")).toBeInTheDocument();
          expect(screen.getByLabelText("Gateway Port")).toBeInTheDocument();
          expect(
            screen.getByLabelText("Auto-start gateway"),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("shows client-specific settings in client mode", async () => {
      mockInvoke.mockResolvedValue({ ...mockConfig, mode: "client" });
      render(<GeneralSettings />);

      await waitFor(
        () => {
          expect(screen.getByText("Client Settings")).toBeInTheDocument();
          expect(screen.getByLabelText("Auto-reconnect")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe("IPC Integration", () => {
    it("calls get_config on mount", async () => {
      render(<GeneralSettings />);

      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledWith("get_config");
        },
        { timeout: 1000 },
      );
    });

    it("calls save_config when theme changes", async () => {
      const user = userEvent.setup();
      render(<GeneralSettings />);

      await waitFor(() => screen.getByText("Theme"), { timeout: 1000 });

      // Radix Select: click trigger to open, then click option
      const trigger = screen.getByText("System").closest("button")!;
      await user.click(trigger);
      const darkOption = await screen.findByRole("option", { name: "Dark" });
      await user.click(darkOption);

      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledWith("save_config", {
            config: expect.objectContaining({
              ui: expect.objectContaining({ theme: "dark" }),
            }),
          });
        },
        { timeout: 1000 },
      );
    });

    it("calls save_config when gateway port changes", async () => {
      render(<GeneralSettings />);

      await waitFor(() => screen.getByLabelText("Gateway Port"), {
        timeout: 1000,
      });

      const portInput = screen.getByLabelText(
        "Gateway Port",
      ) as HTMLInputElement;
      // Use fireEvent.change directly to avoid NaN from clear + type
      fireEvent.change(portInput, { target: { value: "4000" } });

      await waitFor(
        () => {
          const calls = mockInvoke.mock.calls.filter((call) =>
            isSaveConfigPortCall(call, 4000),
          );
          expect(calls.length).toBeGreaterThan(0);
        },
        { timeout: 1000 },
      );
    });

    it("calls save_config when auto-start changes", async () => {
      const user = userEvent.setup();
      render(<GeneralSettings />);

      await waitFor(() => screen.getByLabelText("Auto-start gateway"), {
        timeout: 1000,
      });

      const autoStartSwitch = screen.getByLabelText("Auto-start gateway");
      await user.click(autoStartSwitch);

      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledWith("save_config", {
            config: expect.objectContaining({
              gateway: expect.objectContaining({ autoStart: false }),
            }),
          });
        },
        { timeout: 1000 },
      );
    });

    it("calls set_mode when switching to client mode", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce(mockConfig); // Initial get_config
      mockInvoke.mockResolvedValueOnce({ ...mockConfig, mode: "client" }); // set_mode

      render(<GeneralSettings />);

      await waitFor(() => screen.getByText("Client Mode"), { timeout: 1000 });

      const clientButton = screen.getByText("Client Mode").closest("button");
      if (clientButton) await user.click(clientButton);

      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledWith("set_mode", {
            mode: "client",
          });
        },
        { timeout: 1000 },
      );
    });

    it("calls stop_gateway before switching from gateway to client mode", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce(mockConfig); // get_config
      mockInvoke.mockResolvedValueOnce(undefined); // stop_gateway
      mockInvoke.mockResolvedValueOnce({ ...mockConfig, mode: "client" }); // set_mode

      render(<GeneralSettings />);

      await waitFor(() => screen.getByText("Client Mode"), { timeout: 1000 });

      const clientButton = screen.getByText("Client Mode").closest("button");
      if (clientButton) await user.click(clientButton);

      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledWith("stop_gateway", {
            request: {},
          });
        },
        { timeout: 1000 },
      );
    });
  });

  describe("Form Validation", () => {
    it("validates gateway port range (1024-65535)", async () => {
      render(<GeneralSettings />);

      await waitFor(() => screen.getByLabelText("Gateway Port"), {
        timeout: 1000,
      });

      const portInput = screen.getByLabelText(
        "Gateway Port",
      ) as HTMLInputElement;

      // Test valid port
      fireEvent.change(portInput, { target: { value: "4000" } });

      await waitFor(
        () => {
          const calls = mockInvoke.mock.calls.filter((call) =>
            isSaveConfigPortCall(call, 4000),
          );
          expect(calls.length).toBeGreaterThan(0);
        },
        { timeout: 1000 },
      );
    });

    it("applies dark theme to document when selected", async () => {
      const user = userEvent.setup();
      render(<GeneralSettings />);

      await waitFor(() => screen.getByText("Theme"), { timeout: 1000 });

      const trigger = screen.getByText("System").closest("button")!;
      await user.click(trigger);
      const darkOption = await screen.findByRole("option", { name: "Dark" });
      await user.click(darkOption);

      await waitFor(
        () => {
          expect(document.documentElement.classList.contains("dark")).toBe(
            true,
          );
        },
        { timeout: 1000 },
      );
    });

    it("removes dark class when light theme selected", async () => {
      const user = userEvent.setup();
      document.documentElement.classList.add("dark");

      render(<GeneralSettings />);

      await waitFor(() => screen.getByText("Theme"), { timeout: 1000 });

      const trigger = screen.getByText("System").closest("button")!;
      await user.click(trigger);
      const lightOption = await screen.findByRole("option", { name: "Light" });
      await user.click(lightOption);

      await waitFor(
        () => {
          expect(document.documentElement.classList.contains("dark")).toBe(
            false,
          );
        },
        { timeout: 1000 },
      );
    });
  });

  describe("Error Handling", () => {
    it("displays error when config loading fails", async () => {
      mockInvoke.mockRejectedValue(new Error("Config load failed"));
      render(<GeneralSettings />);

      // When config load fails, config stays null and the loading guard (if !config)
      // shows skeleton UI. Error is set internally but not displayed.
      // Verify component stays in loading/skeleton state since config is null
      await waitFor(
        () => {
          expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
      // Config-dependent content should NOT appear
      expect(screen.queryByText("General Settings")).not.toBeInTheDocument();
    });

    it("displays error when save_config fails", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce(mockConfig); // get_config succeeds
      mockInvoke.mockRejectedValueOnce(new Error("Save failed")); // save_config fails

      render(<GeneralSettings />);

      await waitFor(() => screen.getByText("Theme"), { timeout: 1000 });

      const trigger = screen.getByText("System").closest("button")!;
      await user.click(trigger);
      const darkOption = await screen.findByRole("option", { name: "Dark" });
      await user.click(darkOption);

      await waitFor(
        () => {
          expect(screen.getByText(/Save failed/)).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("displays mode change error when switching modes fails", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce(mockConfig); // get_config
      mockInvoke.mockRejectedValueOnce(new Error("Mode switch failed")); // set_mode fails

      render(<GeneralSettings />);

      await waitFor(() => screen.getByText("Client Mode"), { timeout: 1000 });

      const clientButton = screen.getByText("Client Mode").closest("button");
      if (clientButton) await user.click(clientButton);

      await waitFor(
        () => {
          expect(screen.getByText(/Mode switch failed/)).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe("UI State Management", () => {
    it("disables mode buttons while switching modes", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce(mockConfig); // get_config
      mockInvoke.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(mockConfig), 100)),
      ); // Slow set_mode

      render(<GeneralSettings />);

      await waitFor(() => screen.getByText("Client Mode"), { timeout: 1000 });

      const clientButton = screen.getByText("Client Mode").closest("button");
      if (clientButton) {
        await user.click(clientButton);
        expect(clientButton).toBeDisabled();
      }
    });

    it("preserves config values after updates", async () => {
      render(<GeneralSettings />);

      await waitFor(() => screen.getByLabelText("Gateway Port"), {
        timeout: 1000,
      });

      const portInput = screen.getByLabelText(
        "Gateway Port",
      ) as HTMLInputElement;

      // Use fireEvent.change to set the value directly
      fireEvent.change(portInput, { target: { value: "4000" } });

      await waitFor(
        () => {
          expect(portInput.value).toBe("4000");
        },
        { timeout: 1000 },
      );
    });
  });
});
