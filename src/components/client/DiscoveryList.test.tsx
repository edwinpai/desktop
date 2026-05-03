import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscoveryList } from "./DiscoveryList";
import type { DiscoveredPeer } from "@/types/api";

const mockPeer: DiscoveredPeer = {
  pubkey: "03abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
  petname: "alice-gateway",
  address: "192.168.1.100:3000",
  isOnline: true,
  lastSeen: "2026-02-11T12:00:00Z",
  authorizationLevel: "guest",
};

const mockOfflinePeer: DiscoveredPeer = {
  pubkey: "02ef567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
  petname: "bob-gateway",
  address: "192.168.1.101:3000",
  isOnline: false,
  lastSeen: "2026-02-11T11:50:00Z",
  authorizationLevel: "guest",
};

describe("DiscoveryList", () => {
  // Loading state tests
  it("shows scanning indicator when isScanning=true and no peers", () => {
    const { container } = render(
      <DiscoveryList peers={[]} onSelect={vi.fn()} isScanning={true} />,
    );
    expect(screen.getByText("Scanning for gateways...")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when not scanning and no peers", () => {
    render(<DiscoveryList peers={[]} onSelect={vi.fn()} isScanning={false} />);
    expect(screen.getByText("No gateways found")).toBeInTheDocument();
    expect(
      screen.getByText("Make sure a gateway is running on your network"),
    ).toBeInTheDocument();
  });

  it("shows empty state when isScanning is undefined and no peers", () => {
    render(<DiscoveryList peers={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("No gateways found")).toBeInTheDocument();
  });

  // Peer display tests
  it("renders single peer with all details", () => {
    render(
      <DiscoveryList
        peers={[mockPeer]}
        onSelect={vi.fn()}
        isScanning={false}
      />,
    );

    expect(screen.getByText("alice-gateway")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.100:3000")).toBeInTheDocument();
    expect(screen.getByText(/03abcd1234567890/)).toBeInTheDocument();
  });

  it("renders multiple peers", () => {
    const peers = [mockPeer, mockOfflinePeer];
    render(
      <DiscoveryList peers={peers} onSelect={vi.fn()} isScanning={false} />,
    );

    expect(screen.getByText("alice-gateway")).toBeInTheDocument();
    expect(screen.getByText("bob-gateway")).toBeInTheDocument();
  });

  it("truncates long public keys correctly", () => {
    render(<DiscoveryList peers={[mockPeer]} onSelect={vi.fn()} />);

    // Should show first 16 chars + "..." + last 8 chars
    expect(screen.getByText(/03abcd1234567890/)).toBeInTheDocument();
    expect(screen.getByText(/7890ab/)).toBeInTheDocument();
  });

  it("displays peer address correctly", () => {
    render(<DiscoveryList peers={[mockPeer]} onSelect={vi.fn()} />);
    expect(screen.getByText("192.168.1.100:3000")).toBeInTheDocument();
  });

  // Online status tests
  it("shows online indicator for online peer", () => {
    render(<DiscoveryList peers={[mockPeer]} onSelect={vi.fn()} />);
    expect(screen.getByText("Online")).toBeInTheDocument();

    const indicator = screen.getByText("Online").previousSibling;
    expect(indicator).toHaveClass("bg-green-500");
  });

  it("shows offline status with time since last seen", () => {
    // Mock current time to make time calculation predictable
    const now = new Date("2026-02-11T12:00:00Z");
    vi.setSystemTime(now);

    render(<DiscoveryList peers={[mockOfflinePeer]} onSelect={vi.fn()} />);

    // Should show time elapsed since lastSeen (10 minutes = 600 seconds)
    const timeText = screen.getByText(/\d+m ago/);
    expect(timeText).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows "s ago" for recent offline peer', () => {
    const now = new Date("2026-02-11T12:00:00Z");
    vi.setSystemTime(now);

    const recentPeer: DiscoveredPeer = {
      ...mockOfflinePeer,
      lastSeen: "2026-02-11T11:59:45Z", // 15 seconds ago
    };

    render(<DiscoveryList peers={[recentPeer]} onSelect={vi.fn()} />);
    expect(screen.getByText(/15s ago/)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows "h ago" for old offline peer', () => {
    const now = new Date("2026-02-11T12:00:00Z");
    vi.setSystemTime(now);

    const oldPeer: DiscoveredPeer = {
      ...mockOfflinePeer,
      lastSeen: "2026-02-11T10:00:00Z", // 2 hours ago
    };

    render(<DiscoveryList peers={[oldPeer]} onSelect={vi.fn()} />);
    expect(screen.getByText(/2h ago/)).toBeInTheDocument();

    vi.useRealTimers();
  });

  // Interaction tests
  it("calls onSelect when peer is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<DiscoveryList peers={[mockPeer]} onSelect={onSelect} />);

    // Click on the peer container (not the nested button)
    const peerContainer = screen.getByText("alice-gateway").closest("button");
    await user.click(peerContainer!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockPeer);
  });

  it("renders Select button within peer item", () => {
    const onSelect = vi.fn();

    render(<DiscoveryList peers={[mockPeer]} onSelect={onSelect} />);

    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it("applies hover styles to peer buttons", () => {
    render(<DiscoveryList peers={[mockPeer]} onSelect={vi.fn()} />);

    const peerButton = screen.getByText("alice-gateway").closest("button");
    expect(peerButton).toHaveClass("hover:bg-accent");
  });

  // Multiple peers interaction
  it("handles click on different peers independently", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const peers = [mockPeer, mockOfflinePeer];

    render(<DiscoveryList peers={peers} onSelect={onSelect} />);

    // Click first peer container
    const firstPeer = screen.getByText("alice-gateway").closest("button");
    await user.click(firstPeer!);
    expect(onSelect).toHaveBeenCalledWith(mockPeer);

    // Click second peer container
    const secondPeer = screen.getByText("bob-gateway").closest("button");
    await user.click(secondPeer!);
    expect(onSelect).toHaveBeenCalledWith(mockOfflinePeer);

    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  // Edge cases
  it("handles peer with empty petname", () => {
    const peerWithoutName: DiscoveredPeer = {
      ...mockPeer,
      petname: "",
    };

    const { container } = render(
      <DiscoveryList peers={[peerWithoutName]} onSelect={vi.fn()} />,
    );
    // Component should still render the peer container
    expect(container.querySelector("button.w-full")).toBeInTheDocument();
  });

  it("handles peer with very long petname", () => {
    const longNamePeer: DiscoveredPeer = {
      ...mockPeer,
      petname: "this-is-a-very-long-gateway-name-that-should-truncate",
    };

    render(<DiscoveryList peers={[longNamePeer]} onSelect={vi.fn()} />);

    const nameElement = screen.getByText(longNamePeer.petname);
    expect(nameElement).toHaveClass("truncate");
  });

  it("displays peers while still scanning", () => {
    render(
      <DiscoveryList peers={[mockPeer]} onSelect={vi.fn()} isScanning={true} />,
    );

    // Should show peer, not scanning indicator
    expect(screen.getByText("alice-gateway")).toBeInTheDocument();
    expect(
      screen.queryByText("Scanning for gateways..."),
    ).not.toBeInTheDocument();
  });

  it("uses pubkey as key for peer list items", () => {
    const { container } = render(
      <DiscoveryList peers={[mockPeer]} onSelect={vi.fn()} />,
    );

    // Check that peer container is rendered (React key is internal, but we can verify structure)
    const peerContainers = container.querySelectorAll("button.w-full");
    expect(peerContainers).toHaveLength(1);
  });
});
