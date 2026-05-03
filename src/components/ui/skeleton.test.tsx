/**
 * Skeleton Component Tests - Group G
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Skeleton, SkeletonVariants } from "./skeleton";

describe("Skeleton", () => {
  it("renders with default variant", () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass("animate-pulse");
  });

  it("renders with pulse variant", () => {
    render(<Skeleton variant="pulse" data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("animate-pulse");
  });

  it("renders with wave variant", () => {
    render(<Skeleton variant="wave" data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("animate-shimmer");
  });

  it("applies custom className", () => {
    render(<Skeleton className="h-12 w-full" data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("h-12", "w-full");
  });

  it("has accessible role and label", () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveAttribute("role", "status");
    expect(skeleton).toHaveAttribute("aria-label", "Loading...");
  });

  it("forwards additional props", () => {
    render(<Skeleton data-custom="test" data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveAttribute("data-custom", "test");
  });

  describe("SkeletonVariants", () => {
    it("renders Text variant", () => {
      render(<SkeletonVariants.Text data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("h-4", "w-full");
    });

    it("renders Heading variant", () => {
      render(<SkeletonVariants.Heading data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("h-8", "w-3/4");
    });

    it("renders Avatar variant", () => {
      render(<SkeletonVariants.Avatar data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("size-12", "rounded-full");
    });

    it("renders Button variant", () => {
      render(<SkeletonVariants.Button data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("h-10", "w-24");
    });

    it("renders Card variant", () => {
      render(<SkeletonVariants.Card data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("h-32", "w-full", "rounded-lg");
    });

    it("renders Image variant", () => {
      render(<SkeletonVariants.Image data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("aspect-video", "w-full");
    });

    it("allows className override in variants", () => {
      render(
        <SkeletonVariants.Avatar className="size-16" data-testid="skeleton" />,
      );
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("size-16", "rounded-full");
    });
  });
});
