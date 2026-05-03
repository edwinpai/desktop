import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationManager } from "./InvitationManager";
import type { InvitationData } from "@/types/api";

// Mock the hook
vi.mock("@/hooks/useInvitations");

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock ClipboardItem for QR code copy
global.ClipboardItem = class ClipboardItem {
  constructor(public data: Record<string, Blob>) {}
} as unknown as typeof ClipboardItem;

const mockInvitation: InvitationData = {
  version: "edwinpai-invite-v1",
  invitation: {
    gatewayPubkey:
      "03abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    gatewayAddress: "192.168.1.100:3000",
    level: "member",
    expiresAt: "2026-02-12T12:00:00Z",
    token: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  },
  petname: "alice-gateway",
};

const mockQrCodeSvg = "<svg>QR Code</svg>";

describe("InvitationManager", () => {
  let mockUseInvitations: {
    createInvitation: ReturnType<typeof vi.fn>;
    currentInvitation: InvitationData | null;
    qrCodeSvg: string | null;
    isCreating: boolean;
    error: string | null;
  };

  beforeEach(async () => {
    mockUseInvitations = {
      createInvitation: vi.fn().mockResolvedValue(mockInvitation),
      currentInvitation: null,
      qrCodeSvg: null,
      isCreating: false,
      error: null,
    };

    const { useInvitations } = await import("@/hooks/useInvitations");
    vi.mocked(useInvitations).mockReturnValue(
      mockUseInvitations as unknown as ReturnType<typeof useInvitations>,
    );

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Initial render tests
  it("renders creation form initially", () => {
    render(<InvitationManager />);

    const headings = screen.getAllByText("Create Invitation");
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Access Level")).toBeInTheDocument();
    expect(screen.getByText("Expires In")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create invitation/i }),
    ).toBeInTheDocument();
  });

  it("defaults to guest access level", () => {
    render(<InvitationManager />);

    // Radix Select shows selected text in the trigger
    expect(screen.getByText("Guest (Read Only)")).toBeInTheDocument();
  });

  it("uses defaultLevel prop when provided", () => {
    render(<InvitationManager defaultLevel="member" />);

    expect(screen.getByText("Member (Read + Write)")).toBeInTheDocument();
  });

  it("defaults to 24 hours expiration", () => {
    render(<InvitationManager />);

    const input = screen.getByLabelText("Expires In") as HTMLInputElement;
    expect(input.value).toBe("24");
  });

  // Level selection tests
  it("shows correct description for member level", () => {
    render(<InvitationManager defaultLevel="member" />);

    expect(
      screen.getByText("Members can read and write messages"),
    ).toBeInTheDocument();
  });

  it("shows correct description for guest level", () => {
    render(<InvitationManager defaultLevel="guest" />);

    expect(
      screen.getByText("Guests can only read messages"),
    ).toBeInTheDocument();
  });

  it("changes access level when dropdown is changed", async () => {
    const user = userEvent.setup();
    render(<InvitationManager />);

    // Radix Select: click the trigger button (not the span inside it)
    const trigger = screen.getByText("Guest (Read Only)").closest("button")!;
    await user.click(trigger);
    const memberOption = await screen.findByRole("option", { name: /Member/ });
    await user.click(memberOption);

    expect(
      screen.getByText("Members can read and write messages"),
    ).toBeInTheDocument();
  });

  // Expiration input tests
  it("changes expiration hours when input is changed", async () => {
    const user = userEvent.setup();
    render(<InvitationManager />);

    const input = screen.getByLabelText("Expires In");
    await user.clear(input);
    await user.type(input, "48");

    expect(input).toHaveValue(48);
  });

  it("shows formatted expiration time in description", async () => {
    const user = userEvent.setup();
    render(<InvitationManager />);

    const input = screen.getByLabelText("Expires In");
    await user.clear(input);
    await user.type(input, "36");

    // 36 hours = 1 day + 12 hours
    expect(
      screen.getByText(/Invitation will expire after 36h \(1d 12h\)/),
    ).toBeInTheDocument();
  });

  it("enforces minimum value of 1 hour", () => {
    render(<InvitationManager />);

    const input = screen.getByLabelText("Expires In") as HTMLInputElement;
    expect(input.min).toBe("1");
  });

  it("enforces maximum value of 168 hours (7 days)", () => {
    render(<InvitationManager />);

    const input = screen.getByLabelText("Expires In") as HTMLInputElement;
    expect(input.max).toBe("168");
  });

  // Invitation creation tests
  it("calls createInvitation with correct parameters", async () => {
    const user = userEvent.setup();
    render(<InvitationManager />);

    const createButton = screen.getByRole("button", {
      name: /create invitation/i,
    });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockUseInvitations.createInvitation).toHaveBeenCalledWith({
        level: "guest",
        expiresInHours: 24,
      });
    });
  });

  it("calls onInvitationCreated callback when invitation is created", async () => {
    const user = userEvent.setup();
    const onInvitationCreated = vi.fn();

    render(<InvitationManager onInvitationCreated={onInvitationCreated} />);

    const createButton = screen.getByRole("button", {
      name: /create invitation/i,
    });
    await user.click(createButton);

    await waitFor(() => {
      expect(onInvitationCreated).toHaveBeenCalledWith(mockInvitation);
    });
  });

  it("shows loading state during creation", () => {
    mockUseInvitations.isCreating = true;

    render(<InvitationManager />);

    expect(screen.getByText("Creating...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
  });

  it("displays error message when creation fails", () => {
    mockUseInvitations.error = "Failed to create invitation";

    render(<InvitationManager />);

    expect(screen.getByText("Failed to create invitation")).toBeInTheDocument();
  });

  // QR code display tests
  it("displays QR code after successful creation", () => {
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    expect(screen.getByText("Invitation Created")).toBeInTheDocument();
    expect(
      screen.getByText("Share this QR code or link with the recipient"),
    ).toBeInTheDocument();
  });

  it("renders QR code SVG correctly", () => {
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    const { container } = render(<InvitationManager />);

    // Check for the QR code container div
    const qrContainer = container.querySelector(
      ".p-4.bg-white.rounded-lg.border",
    );
    expect(qrContainer).toBeInTheDocument();
  });

  it("displays invitation details", () => {
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    expect(screen.getByText("member")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.100:3000")).toBeInTheDocument();
    expect(screen.getByText(/2\/12\/2026/)).toBeInTheDocument(); // Formatted date
  });

  // Copy actions tests
  it("copies QR code to clipboard when Copy QR is clicked", async () => {
    const user = userEvent.setup();
    const writeSpy = vi.spyOn(navigator.clipboard, "write");
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    const copyQrButton = screen.getByRole("button", { name: /copy qr/i });
    await user.click(copyQrButton);

    expect(writeSpy).toHaveBeenCalled();
  });

  it("copies invitation link to clipboard when Copy Link is clicked", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    const copyLinkButton = screen.getByRole("button", { name: /copy link/i });
    await user.click(copyLinkButton);

    const expectedLink = `edwinpai://invite/${btoa(JSON.stringify(mockInvitation))}`;
    expect(writeTextSpy).toHaveBeenCalledWith(expectedLink);
  });

  it("does not crash when copying without QR code", async () => {
    const user = userEvent.setup();
    const writeSpy = vi.spyOn(navigator.clipboard, "write");
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = null;

    render(<InvitationManager />);

    const copyQrButton = screen.getByRole("button", { name: /copy qr/i });
    await user.click(copyQrButton);

    // Should not call clipboard API when QR is null
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("does not crash when copying without invitation", async () => {
    mockUseInvitations.currentInvitation = null;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    const copyLinkButton = screen.queryByRole("button", { name: /copy link/i });
    expect(copyLinkButton).not.toBeInTheDocument();
  });

  // Create Another button tests
  it("shows Create Another button when invitation exists", () => {
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    expect(
      screen.getByRole("button", { name: /create another/i }),
    ).toBeInTheDocument();
  });

  it("reloads page when Create Another is clicked", async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    const createAnotherButton = screen.getByRole("button", {
      name: /create another/i,
    });
    await user.click(createAnotherButton);

    expect(reloadMock).toHaveBeenCalled();
  });

  // Security notice tests
  it("displays security notice with correct access level", () => {
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    expect(screen.getByText(/Security Notice:/)).toBeInTheDocument();
    expect(screen.getByText(/with member access/)).toBeInTheDocument();
  });

  it("shows one-time use warning", () => {
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    expect(
      screen.getByText(/This invitation can only be used once/),
    ).toBeInTheDocument();
  });

  // Edge cases
  it("handles invitation with no petname", () => {
    const invitationNoPetname: InvitationData = {
      ...mockInvitation,
      petname: undefined,
    };

    mockUseInvitations.currentInvitation = invitationNoPetname;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    expect(screen.getByText("Invitation Created")).toBeInTheDocument();
  });

  it("formats expiration date correctly", () => {
    mockUseInvitations.currentInvitation = mockInvitation;
    mockUseInvitations.qrCodeSvg = mockQrCodeSvg;

    render(<InvitationManager />);

    // Date should be formatted using toLocaleString()
    const expiresAt = new Date(
      mockInvitation.invitation.expiresAt,
    ).toLocaleString();
    expect(screen.getByText(expiresAt)).toBeInTheDocument();
  });
});
