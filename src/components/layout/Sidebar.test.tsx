/**
 * Sidebar Component Tests
 *
 * Tests gateway status indicator rendering
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { APP_VERSION } from "@/lib/app-version";

// Mock GatewayStatusIndicator
vi.mock("@/components/shared/GatewayStatusIndicator", () => ({
  GatewayStatusIndicator: () => (
    <div data-testid="gateway-status">
      <span className="status-dot" data-status="running">●</span>
      <span>Gateway Running</span>
    </div>
  ),
}));

describe("Sidebar", () => {
  it("renders EdwinPAI Desktop title", () => {
    render(<Sidebar />);

    expect(screen.getByText("EdwinPAI Desktop")).toBeInTheDocument();
  });

  it("renders gateway status indicator", () => {
    render(<Sidebar />);

    const statusIndicator = screen.getByTestId("gateway-status");
    expect(statusIndicator).toBeInTheDocument();
    expect(screen.getByText("Gateway Running")).toBeInTheDocument();
  });

  it("renders version number", () => {
    render(<Sidebar />);

    expect(screen.getByText(`Version ${APP_VERSION}`)).toBeInTheDocument();
  });

  it("has proper layout structure", () => {
    const { container } = render(<Sidebar />);

    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("w-64", "border-r", "flex", "flex-col");
  });
});
