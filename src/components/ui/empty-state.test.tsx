/**
 * EmptyState Component Tests - Group G
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Inbox, MessageSquare } from "lucide-react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No messages" />);
    expect(screen.getByText("No messages")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(
      <EmptyState
        title="No messages"
        description="Start a conversation to see messages here"
      />
    );
    expect(screen.getByText("Start a conversation to see messages here")).toBeInTheDocument();
  });

  it("renders icon", () => {
    render(<EmptyState title="No messages" icon={Inbox} />);
    const svg = screen.getByRole("status").querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("does not render icon when not provided", () => {
    render(<EmptyState title="No messages" />);
    const svg = screen.getByRole("status").querySelector("svg");
    expect(svg).not.toBeInTheDocument();
  });

  it("renders action button", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No messages"
        action={{
          label: "New Message",
          onClick,
        }}
      />
    );
    expect(screen.getByRole("button", { name: "New Message" })).toBeInTheDocument();
  });

  it("calls action onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <EmptyState
        title="No messages"
        action={{
          label: "New Message",
          onClick,
        }}
      />
    );

    const button = screen.getByRole("button", { name: "New Message" });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not render action button when not provided", () => {
    render(<EmptyState title="No messages" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<EmptyState title="No messages" className="custom-class" />);
    const container = screen.getByRole("status");
    expect(container).toHaveClass("custom-class");
  });

  it("uses default button variant", () => {
    render(
      <EmptyState
        title="No messages"
        action={{
          label: "New Message",
          onClick: () => {},
        }}
      />
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-primary"); // Default variant class
  });

  it("uses outline button variant", () => {
    render(
      <EmptyState
        title="No messages"
        action={{
          label: "New Message",
          onClick: () => {},
          variant: "outline",
        }}
      />
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-background"); // Outline variant class
  });

  it("applies muted icon color", () => {
    render(<EmptyState title="No messages" icon={Inbox} iconColor="muted" />);
    const iconContainer = screen.getByRole("status").querySelector("div");
    expect(iconContainer).toHaveClass("text-muted-foreground");
  });

  it("applies primary icon color", () => {
    render(<EmptyState title="No messages" icon={Inbox} iconColor="primary" />);
    const iconContainer = screen.getByRole("status").querySelector("div");
    expect(iconContainer).toHaveClass("text-primary");
  });

  it("applies destructive icon color", () => {
    render(<EmptyState title="No messages" icon={Inbox} iconColor="destructive" />);
    const iconContainer = screen.getByRole("status").querySelector("div");
    expect(iconContainer).toHaveClass("text-destructive");
  });

  it("has accessible role and label", () => {
    render(<EmptyState title="No messages" />);
    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-label", "No messages");
  });

  it("renders complete example", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={MessageSquare}
        title="No conversations"
        description="Create your first conversation to get started"
        iconColor="primary"
        action={{
          label: "Start Conversation",
          onClick,
          variant: "default",
        }}
      />
    );

    expect(screen.getByText("No conversations")).toBeInTheDocument();
    expect(screen.getByText("Create your first conversation to get started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Conversation" })).toBeInTheDocument();
  });
});
