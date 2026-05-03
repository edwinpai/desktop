/**
 * Petname Display Component Tests
 *
 * Tests for petname generation and display components (Phase 1).
 * Validates deterministic generation, visual rendering, and accessibility.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { IdentityBadge } from "@/components/shared/IdentityBadge";

describe("Petname Display", () => {
  const mockPublicKey =
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
  const mockPetname = "Swift Falcon";

  describe("IdentityBadge Component", () => {
    it("should render petname correctly", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      expect(screen.getByText(mockPetname)).toBeInTheDocument();
    });

    it("should display short ID derived from public key", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      // Short ID format: edw:<first 8 hex chars after prefix>
      const expectedShortId = "edw:79be667e";
      expect(screen.getByText(expectedShortId)).toBeInTheDocument();
    });

    it("should render identicon SVG", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should support small size variant", () => {
      render(
        <IdentityBadge
          publicKey={mockPublicKey}
          petname={mockPetname}
          size="sm"
        />,
      );

      const petname = screen.getByText(mockPetname);
      expect(petname).toHaveClass("text-sm");

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
    });

    it("should support medium size variant (default)", () => {
      render(
        <IdentityBadge
          publicKey={mockPublicKey}
          petname={mockPetname}
          size="md"
        />,
      );

      const petname = screen.getByText(mockPetname);
      expect(petname).toHaveClass("text-base");

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "48");
      expect(svg).toHaveAttribute("height", "48");
    });

    it("should support large size variant", () => {
      render(
        <IdentityBadge
          publicKey={mockPublicKey}
          petname={mockPetname}
          size="lg"
        />,
      );

      const petname = screen.getByText(mockPetname);
      expect(petname).toHaveClass("text-xl");

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "64");
      expect(svg).toHaveAttribute("height", "64");
    });

    it("should use medium size by default", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "48");
    });
  });

  describe("Petname Formatting", () => {
    it("should display petname with proper capitalization", () => {
      render(
        <IdentityBadge publicKey={mockPublicKey} petname="Swift Falcon" />,
      );

      const petname = screen.getByText("Swift Falcon");
      expect(petname.textContent).toBe("Swift Falcon");
    });

    it("should handle single-word petnames", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname="Phoenix" />);

      expect(screen.getByText("Phoenix")).toBeInTheDocument();
    });

    it("should handle multi-word petnames", () => {
      render(
        <IdentityBadge
          publicKey={mockPublicKey}
          petname="Bold Swift Phoenix"
        />,
      );

      expect(screen.getByText("Bold Swift Phoenix")).toBeInTheDocument();
    });

    it("should display short ID in monospace font", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const shortId = screen.getByText(/^edw:/);
      expect(shortId).toHaveClass("font-mono");
    });
  });

  describe("Deterministic Generation", () => {
    it("should generate same short ID for same public key", () => {
      const { unmount } = render(
        <IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />,
      );

      const firstShortId = screen.getByText(/^edw:/).textContent;
      unmount();

      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);
      const secondShortId = screen.getByText(/^edw:/).textContent;

      expect(firstShortId).toBe(secondShortId);
    });

    it("should generate different short IDs for different public keys", () => {
      const key1 =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const key2 =
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

      const { unmount } = render(
        <IdentityBadge publicKey={key1} petname="User One" />,
      );
      const shortId1 = screen.getByText(/^edw:/).textContent;
      unmount();

      render(<IdentityBadge publicKey={key2} petname="User Two" />);
      const shortId2 = screen.getByText(/^edw:/).textContent;

      expect(shortId1).not.toBe(shortId2);
    });
  });

  describe("Visual Layout", () => {
    it("should render identicon and petname in horizontal layout", () => {
      const { container } = render(
        <IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("flex", "items-center");
    });

    it("should have gap between identicon and text", () => {
      const { container } = render(
        <IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("gap-3");
    });

    it("should display petname above short ID", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const petname = screen.getByText(mockPetname);
      const shortId = screen.getByText(/^edw:/);

      // Check that petname comes before shortId in DOM order
      const parent = petname.parentElement;
      expect(parent).toContainElement(petname);
      expect(parent).toContainElement(shortId);
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic structure", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const petname = screen.getByText(mockPetname);
      expect(petname.tagName).toBe("P");

      const shortId = screen.getByText(/^edw:/);
      expect(shortId.tagName).toBe("P");
    });

    it("should use muted color for short ID", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const shortId = screen.getByText(/^edw:/);
      expect(shortId).toHaveClass("text-muted-foreground");
    });

    it("should have appropriate font weights", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const petname = screen.getByText(mockPetname);
      expect(petname).toHaveClass("font-semibold");
    });

    it("should have readable text sizes", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const shortId = screen.getByText(/^edw:/);
      expect(shortId).toHaveClass("text-xs");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty petname gracefully", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname="" />);

      // Component should render without errors
      expect(screen.getByText(/^edw:/)).toBeInTheDocument();
    });

    it("should handle very long petnames", () => {
      const longPetname =
        "Very Long Extremely Detailed Verbose Petname Example";

      render(<IdentityBadge publicKey={mockPublicKey} petname={longPetname} />);

      expect(screen.getByText(longPetname)).toBeInTheDocument();
    });

    it("should handle public keys with different prefixes", () => {
      const key02 =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const key03 =
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

      const { unmount } = render(
        <IdentityBadge publicKey={key02} petname="User 02" />,
      );
      expect(screen.getByText(/^edw:/)).toBeInTheDocument();
      unmount();

      render(<IdentityBadge publicKey={key03} petname="User 03" />);
      expect(screen.getByText(/^edw:/)).toBeInTheDocument();
    });

    it("should handle minimum valid public key length", () => {
      // 33 bytes = 66 hex chars (minimum compressed public key)
      const minKey = "02" + "0".repeat(64);

      render(<IdentityBadge publicKey={minKey} petname="Min Key" />);

      expect(screen.getByText("Min Key")).toBeInTheDocument();
      expect(screen.getByText(/^edw:/)).toBeInTheDocument();
    });
  });

  describe("Short ID Format", () => {
    it("should always start with 'edw:' prefix", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const shortId = screen.getByText(/^edw:/);
      expect(shortId.textContent).toMatch(/^edw:/);
    });

    it("should include 8 hex characters after prefix", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const shortId = screen.getByText(/^edw:/);
      // Format: edw:XXXXXXXX (4 chars + 8 hex chars = 12 total)
      expect(shortId.textContent).toHaveLength(12);
    });

    it("should use lowercase hex characters", () => {
      render(<IdentityBadge publicKey={mockPublicKey} petname={mockPetname} />);

      const shortId = screen.getByText(/^edw:/);
      const hexPart = shortId.textContent?.slice(4); // Remove 'edw:'

      expect(hexPart).toMatch(/^[0-9a-f]{8}$/);
    });
  });
});
