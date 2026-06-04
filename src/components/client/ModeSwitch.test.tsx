import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModeSwitch } from "./ModeSwitch";

describe("ModeSwitch", () => {
  let mockOnModeChange: (newMode: "gateway" | "client") => void;

  beforeEach(() => {
    mockOnModeChange = vi.fn<(newMode: "gateway" | "client") => void>();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Initial render tests
  it("renders both mode cards", () => {
    render(
      <ModeSwitch currentMode="gateway" onModeChange={mockOnModeChange} />,
    );

    expect(screen.getByText("Gateway Mode")).toBeInTheDocument();
    expect(screen.getByText("Connect Mode")).toBeInTheDocument();
  });

  it("highlights current mode (gateway)", () => {
    render(
      <ModeSwitch currentMode="gateway" onModeChange={mockOnModeChange} />,
    );

    const gatewayCard = screen.getByText("Gateway Mode").closest("button");
    expect(gatewayCard).toHaveClass("border-primary");
    expect(screen.getByText("Current Mode")).toBeInTheDocument();
  });

  it("highlights current mode (client)", () => {
    render(<ModeSwitch currentMode="client" onModeChange={mockOnModeChange} />);

    const clientCard = screen.getByText("Connect Mode").closest("button");
    expect(clientCard).toHaveClass("border-primary");
    expect(screen.getByText("Current Mode")).toBeInTheDocument();
  });

  it("current mode card is clickable (not disabled)", () => {
    render(
      <ModeSwitch currentMode="gateway" onModeChange={mockOnModeChange} />,
    );

    const gatewayCard = screen.getByText("Gateway Mode").closest("button");
    expect(gatewayCard).not.toBeDisabled();
  });

  it("enables non-current mode card", () => {
    render(
      <ModeSwitch currentMode="gateway" onModeChange={mockOnModeChange} />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button");
    expect(clientCard).not.toBeDisabled();
  });

  // Mode descriptions tests
  it("shows correct description for gateway mode", () => {
    render(<ModeSwitch currentMode="client" onModeChange={mockOnModeChange} />);

    expect(
      screen.getByText("Run your own AI gateway and share access with others"),
    ).toBeInTheDocument();
  });

  it("shows correct description for connect mode", () => {
    render(
      <ModeSwitch currentMode="gateway" onModeChange={mockOnModeChange} />,
    );

    expect(
      screen.getByText("Connect to an existing Gateway with permissions granted to your identity"),
    ).toBeInTheDocument();
  });

  it("displays gateway features", () => {
    render(<ModeSwitch currentMode="client" onModeChange={mockOnModeChange} />);

    expect(screen.getByText("Full control")).toBeInTheDocument();
    expect(screen.getByText("Share with others")).toBeInTheDocument();
    expect(screen.getByText("Custom channels")).toBeInTheDocument();
  });

  it("displays client features", () => {
    render(
      <ModeSwitch currentMode="gateway" onModeChange={mockOnModeChange} />,
    );

    expect(screen.getByText("Quick setup")).toBeInTheDocument();
    expect(screen.getByText("No configuration")).toBeInTheDocument();
    expect(screen.getByText("Guest access")).toBeInTheDocument();
  });

  // Simple mode switching (no confirmation) tests
  it("switches mode immediately when gateway is not running", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={false}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    expect(mockOnModeChange).toHaveBeenCalledWith("client");
    expect(screen.queryByText("Switch Mode?")).not.toBeInTheDocument();
  });

  it("switches mode immediately when client is not connected", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="client"
        onModeChange={mockOnModeChange}
        isClientConnected={false}
      />,
    );

    const gatewayCard = screen.getByText("Gateway Mode").closest("button")!;
    await user.click(gatewayCard);

    expect(mockOnModeChange).toHaveBeenCalledWith("gateway");
    expect(screen.queryByText("Switch Mode?")).not.toBeInTheDocument();
  });

  // Confirmation dialog tests
  it("shows confirmation when switching from running gateway", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    await waitFor(() => {
      expect(screen.getByText("Switch Mode?")).toBeInTheDocument();
    });
  });

  it("shows confirmation when switching from connected client", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="client"
        onModeChange={mockOnModeChange}
        isClientConnected={true}
      />,
    );

    const gatewayCard = screen.getByText("Gateway Mode").closest("button")!;
    await user.click(gatewayCard);

    await waitFor(() => {
      expect(screen.getByText("Switch Mode?")).toBeInTheDocument();
    });
  });

  it("shows correct warning message for gateway → client switch", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Switching to connect mode will stop your gateway. Any connected users will be disconnected./,
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows correct warning message for client → gateway switch", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="client"
        onModeChange={mockOnModeChange}
        isClientConnected={true}
      />,
    );

    const gatewayCard = screen.getByText("Gateway Mode").closest("button")!;
    await user.click(gatewayCard);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Switching to gateway mode will disconnect you from the current gateway./,
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows Cancel button in confirmation dialog", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows correct confirm button text for gateway → client", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    await waitFor(() => {
      expect(screen.getByText("Switch to Connect Mode")).toBeInTheDocument();
    });
  });

  it("shows correct confirm button text for client → gateway", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="client"
        onModeChange={mockOnModeChange}
        isClientConnected={true}
      />,
    );

    const gatewayCard = screen.getByText("Gateway Mode").closest("button")!;
    await user.click(gatewayCard);

    await waitFor(() => {
      expect(screen.getByText("Switch to Gateway Mode")).toBeInTheDocument();
    });
  });

  // Confirmation actions tests
  it("switches mode when confirmed", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    const confirmButton = await screen.findByText("Switch to Connect Mode");
    await user.click(confirmButton);

    expect(mockOnModeChange).toHaveBeenCalledWith("client");
  });

  it("closes dialog when mode switch is confirmed", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    const confirmButton = await screen.findByText("Switch to Connect Mode");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByText("Switch Mode?")).not.toBeInTheDocument();
    });
  });

  it("does not switch mode when cancelled", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    const cancelButton = await screen.findByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnModeChange).not.toHaveBeenCalled();
  });

  it("closes dialog when cancelled", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    const cancelButton = await screen.findByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText("Switch Mode?")).not.toBeInTheDocument();
    });
  });

  // Active indicator tests
  it("shows Active indicator for running gateway", () => {
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
    const indicator = screen.getByText("Active").previousSibling;
    expect(indicator).toHaveClass("animate-pulse");
  });

  it("shows Active indicator for connected client", () => {
    render(
      <ModeSwitch
        currentMode="client"
        onModeChange={mockOnModeChange}
        isClientConnected={true}
      />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("does not show Active indicator when gateway is not running", () => {
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={false}
      />,
    );

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("does not show Active indicator when client is not connected", () => {
    render(
      <ModeSwitch
        currentMode="client"
        onModeChange={mockOnModeChange}
        isClientConnected={false}
      />,
    );

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  // Edge cases
  it("re-selects current mode without confirmation when clicking it", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch
        currentMode="gateway"
        onModeChange={mockOnModeChange}
        isGatewayRunning={true}
      />,
    );

    const gatewayCard = screen.getByText("Gateway Mode").closest("button")!;
    await user.click(gatewayCard);

    // Should fire mode change (re-enter gateway mode) without confirmation
    expect(mockOnModeChange).toHaveBeenCalledWith("gateway");
    expect(screen.queryByText("Switch Mode?")).not.toBeInTheDocument();
  });

  it("handles undefined isGatewayRunning as false", async () => {
    const user = userEvent.setup();
    render(
      <ModeSwitch currentMode="gateway" onModeChange={mockOnModeChange} />,
    );

    const clientCard = screen.getByText("Connect Mode").closest("button")!;
    await user.click(clientCard);

    // Should switch immediately without confirmation
    expect(mockOnModeChange).toHaveBeenCalledWith("client");
  });

  it("handles undefined isClientConnected as false", async () => {
    const user = userEvent.setup();
    render(<ModeSwitch currentMode="client" onModeChange={mockOnModeChange} />);

    const gatewayCard = screen.getByText("Gateway Mode").closest("button")!;
    await user.click(gatewayCard);

    // Should switch immediately without confirmation
    expect(mockOnModeChange).toHaveBeenCalledWith("gateway");
  });
});
