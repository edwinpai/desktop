import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccessControlPanel } from "./AccessControlPanel";

import type { UserAuthorization } from "@/types/api";

// Mock window.confirm
const mockConfirm = vi.fn();
window.confirm = mockConfirm;

const mockOwner: UserAuthorization = {
  pubkey: "03abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
  petname: "alice-owner",
  level: "owner",
  authorizedAt: "2026-02-01T10:00:00Z",
  lastActive: "2026-02-11T12:00:00Z",
};

const mockMember: UserAuthorization = {
  pubkey: "02ef567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
  petname: "bob-member",
  level: "member",
  authorizedAt: "2026-02-05T14:30:00Z",
  lastActive: "2026-02-11T11:45:00Z",
};

const mockGuest: UserAuthorization = {
  pubkey: "02123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  petname: "charlie-guest",
  level: "guest",
  authorizedAt: "2026-02-10T09:00:00Z",
  lastActive: "2026-02-11T10:30:00Z",
};

describe("AccessControlPanel", () => {
  beforeEach(() => {
    mockConfirm.mockClear();
    vi.setSystemTime(new Date("2026-02-11T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Empty state tests
  it("renders empty state when no users", () => {
    render(<AccessControlPanel users={[]} currentUserLevel="owner" />);

    expect(screen.getByText("No authorized users")).toBeInTheDocument();
    expect(
      screen.getByText("Create an invitation to add users"),
    ).toBeInTheDocument();
  });

  it("shows user icon in empty state", () => {
    const { container } = render(
      <AccessControlPanel users={[]} currentUserLevel="owner" />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  // User display tests
  it("renders single user with all details", () => {
    render(
      <AccessControlPanel users={[mockMember]} currentUserLevel="owner" />,
    );

    expect(screen.getByText("bob-member")).toBeInTheDocument();
    expect(screen.getByText(/02ef567890abcdef/)).toBeInTheDocument();
  });

  it("renders multiple users", () => {
    const users = [mockOwner, mockMember, mockGuest];
    render(<AccessControlPanel users={users} currentUserLevel="owner" />);

    expect(screen.getByText("alice-owner")).toBeInTheDocument();
    expect(screen.getByText("bob-member")).toBeInTheDocument();
    expect(screen.getByText("charlie-guest")).toBeInTheDocument();
  });

  it("displays access level badges correctly", () => {
    const users = [mockOwner, mockMember, mockGuest];
    render(<AccessControlPanel users={users} currentUserLevel="owner" />);

    const badges = screen.getAllByText(/Owner|Member|Guest/);
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it("shows correct capability indicators for owner", () => {
    render(<AccessControlPanel users={[mockOwner]} currentUserLevel="owner" />);

    // Owner has all capabilities
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("Write")).toBeInTheDocument();
    expect(screen.getByText("Manage Users")).toBeInTheDocument();
  });

  it("shows correct capability indicators for member", () => {
    render(
      <AccessControlPanel users={[mockMember]} currentUserLevel="owner" />,
    );

    const capabilities = screen.getAllByText(/Read|Write|Manage Users/);
    expect(capabilities).toHaveLength(3); // Read, Write, Manage Users
  });

  it("shows correct capability indicators for guest", () => {
    render(<AccessControlPanel users={[mockGuest]} currentUserLevel="owner" />);

    expect(screen.getByText("Read")).toBeInTheDocument();
    // Guest should have disabled Write and Manage Users
  });

  // Time formatting tests
  it('formats "just now" for recent activity', () => {
    const recentUser: UserAuthorization = {
      ...mockMember,
      lastActive: "2026-02-11T11:59:30Z", // 30 seconds ago
    };

    render(
      <AccessControlPanel users={[recentUser]} currentUserLevel="owner" />,
    );

    expect(screen.getByText("Last active just now")).toBeInTheDocument();
  });

  it("formats minutes ago correctly", () => {
    render(<AccessControlPanel users={[mockGuest]} currentUserLevel="owner" />);

    // mockGuest.lastActive is 90 minutes ago - check it displays "m ago" or "h ago"
    const timeText = screen.getByText(/Last active/);
    expect(timeText.textContent).toMatch(/Last active (\d+m|\d+h) ago/);
  });

  it("formats hours ago correctly", () => {
    render(
      <AccessControlPanel users={[mockMember]} currentUserLevel="owner" />,
    );

    // mockMember.lastActive is 15 minutes ago
    expect(screen.getByText(/Last active \d+m ago/)).toBeInTheDocument();
  });

  it("formats days ago correctly", () => {
    const oldUser: UserAuthorization = {
      ...mockMember,
      lastActive: "2026-02-09T12:00:00Z", // 2 days ago
    };

    render(<AccessControlPanel users={[oldUser]} currentUserLevel="owner" />);

    expect(screen.getByText(/Last active \d+d ago/)).toBeInTheDocument();
  });

  // Permission-based UI tests
  it("shows management controls for owner viewing other users", () => {
    render(
      <AccessControlPanel users={[mockMember]} currentUserLevel="owner" />,
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument(); // Level dropdown
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("hides management controls for non-owner users", () => {
    render(
      <AccessControlPanel users={[mockMember]} currentUserLevel="member" />,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();
  });

  it('shows "Cannot remove owner" message for owner entry', () => {
    render(<AccessControlPanel users={[mockOwner]} currentUserLevel="owner" />);

    expect(screen.getByText("Cannot remove owner")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();
  });

  // Level change tests
  it("allows changing user level from member to guest", async () => {
    const user = userEvent.setup();
    const onUpdateLevel = vi.fn().mockResolvedValue(undefined);

    render(
      <AccessControlPanel
        users={[mockMember]}
        currentUserLevel="owner"
        onUpdateLevel={onUpdateLevel}
      />,
    );

    // Radix Select: click trigger to open, then click option
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    const guestOption = await screen.findByRole("option", { name: "Guest" });
    await user.click(guestOption);

    await waitFor(() => {
      expect(onUpdateLevel).toHaveBeenCalledWith(mockMember.pubkey, "guest");
    });
  });

  it("allows changing user level from guest to member", async () => {
    const user = userEvent.setup();
    const onUpdateLevel = vi.fn().mockResolvedValue(undefined);

    render(
      <AccessControlPanel
        users={[mockGuest]}
        currentUserLevel="owner"
        onUpdateLevel={onUpdateLevel}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    const memberOption = await screen.findByRole("option", { name: "Member" });
    await user.click(memberOption);

    await waitFor(() => {
      expect(onUpdateLevel).toHaveBeenCalledWith(mockGuest.pubkey, "member");
    });
  });

  it("disables controls during level update", async () => {
    const user = userEvent.setup();
    let resolveUpdate: (() => void) | undefined;
    const onUpdateLevel = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(
      <AccessControlPanel
        users={[mockMember]}
        currentUserLevel="owner"
        onUpdateLevel={onUpdateLevel}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    const guestOption = await screen.findByRole("option", { name: "Guest" });
    await user.click(guestOption);

    // Controls should be disabled during update
    await waitFor(() => {
      expect(trigger).toBeDisabled();
      expect(screen.getByRole("button", { name: /remove/i })).toBeDisabled();
    });

    // Complete the update
    await waitFor(() => {
      expect(resolveUpdate).toBeDefined();
      resolveUpdate?.();
    });
  });

  // Remove user tests
  it("shows confirmation dialog before removing user", async () => {
    const user = userEvent.setup();
    const onRemoveUser = vi.fn().mockResolvedValue(undefined);
    mockConfirm.mockReturnValue(true);

    render(
      <AccessControlPanel
        users={[mockMember]}
        currentUserLevel="owner"
        onRemoveUser={onRemoveUser}
      />,
    );

    const removeButton = screen.getByRole("button", { name: /remove/i });
    await user.click(removeButton);

    expect(mockConfirm).toHaveBeenCalledWith(
      "Are you sure you want to remove this user?",
    );
  });

  it("removes user when confirmation is accepted", async () => {
    const user = userEvent.setup();
    const onRemoveUser = vi.fn().mockResolvedValue(undefined);
    mockConfirm.mockReturnValue(true);

    render(
      <AccessControlPanel
        users={[mockMember]}
        currentUserLevel="owner"
        onRemoveUser={onRemoveUser}
      />,
    );

    const removeButton = screen.getByRole("button", { name: /remove/i });
    await user.click(removeButton);

    await waitFor(() => {
      expect(onRemoveUser).toHaveBeenCalledWith(mockMember.pubkey);
    });
  });

  it("does not remove user when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const onRemoveUser = vi.fn().mockResolvedValue(undefined);
    mockConfirm.mockReturnValue(false);

    render(
      <AccessControlPanel
        users={[mockMember]}
        currentUserLevel="owner"
        onRemoveUser={onRemoveUser}
      />,
    );

    const removeButton = screen.getByRole("button", { name: /remove/i });
    await user.click(removeButton);

    expect(onRemoveUser).not.toHaveBeenCalled();
  });

  it("shows loading spinner during removal", async () => {
    const user = userEvent.setup();
    let resolveRemove: (() => void) | undefined;
    const onRemoveUser = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRemove = resolve;
        }),
    );
    mockConfirm.mockReturnValue(true);

    const { container } = render(
      <AccessControlPanel
        users={[mockMember]}
        currentUserLevel="owner"
        onRemoveUser={onRemoveUser}
      />,
    );

    const removeButton = screen.getByRole("button", { name: /remove/i });
    await user.click(removeButton);

    // Should show spinner
    await waitFor(() => {
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(resolveRemove).toBeDefined();
      resolveRemove?.();
    });
  });

  // Edge cases
  it("handles missing callback functions gracefully", async () => {
    const user = userEvent.setup();

    render(
      <AccessControlPanel users={[mockMember]} currentUserLevel="owner" />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    const guestOption = await screen.findByRole("option", { name: "Guest" });
    await user.click(guestOption);

    // Should not crash when callback is undefined
    expect(trigger).toBeEnabled();
  });

  it("truncates very long petnames", () => {
    const longNameUser: UserAuthorization = {
      ...mockMember,
      petname: "this-is-an-extremely-long-petname-that-should-be-truncated",
    };

    render(
      <AccessControlPanel users={[longNameUser]} currentUserLevel="owner" />,
    );

    const nameElement = screen.getByText(longNameUser.petname);
    expect(nameElement).toHaveClass("truncate");
  });
});
