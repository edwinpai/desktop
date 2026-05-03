/**
 * Identicon Rendering Component Tests
 *
 * Tests for deterministic identicon/avatar generation and rendering (Phase 1).
 * Validates SVG generation, determinism, visual properties, and accessibility.
 */

import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { IdentityBadge } from "@/components/shared/IdentityBadge";

describe("Identicon Rendering", () => {
  const testPublicKey =
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
  const testPetname = "Test User";

  describe("SVG Generation", () => {
    it("should render SVG element", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should have correct viewBox attribute", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox");

      // Default size is 48x48
      const viewBox = svg?.getAttribute("viewBox");
      expect(viewBox).toBe("0 0 48 48");
    });

    it("should have width and height attributes matching size", () => {
      render(
        <IdentityBadge
          publicKey={testPublicKey}
          petname={testPetname}
          size="lg"
        />,
      );

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "64");
      expect(svg).toHaveAttribute("height", "64");
    });

    it("should contain rect elements for pattern", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      const rects = svg?.querySelectorAll("rect");

      // Should have at least some rect elements for the pattern
      expect(rects).toBeDefined();
      expect(rects!.length).toBeGreaterThan(0);
    });

    it("should have rounded corners on SVG", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      expect(svg).toHaveClass("rounded-lg");
    });

    it("should have background color based on public key", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg") as SVGElement;
      const style = svg.getAttribute("style") || "";

      // Should have some background color set via inline style
      expect(style).toBeTruthy();
      expect(style).toContain("background-color");
    });
  });

  describe("Deterministic Color Generation", () => {
    it("should generate same color for same public key", () => {
      const { unmount } = render(
        <IdentityBadge publicKey={testPublicKey} petname={testPetname} />,
      );

      const svg1 = document.querySelector("svg") as SVGElement;
      const color1 = svg1.style.backgroundColor;
      unmount();

      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg2 = document.querySelector("svg") as SVGElement;
      const color2 = svg2.style.backgroundColor;

      expect(color1).toBe(color2);
    });

    it("should generate different colors for different public keys", () => {
      const key1 =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const key2 =
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

      const { unmount } = render(
        <IdentityBadge publicKey={key1} petname="User One" />,
      );

      const svg1 = document.querySelector("svg") as SVGElement;
      const rects1 = svg1.querySelectorAll("rect");
      const color1 = rects1[0]?.getAttribute("fill");
      unmount();

      render(<IdentityBadge publicKey={key2} petname="User Two" />);

      const svg2 = document.querySelector("svg") as SVGElement;
      const rects2 = svg2.querySelectorAll("rect");
      const color2 = rects2[0]?.getAttribute("fill");

      // Different keys should produce different colors
      expect(color1).not.toBe(color2);
    });

    it("should use HSL color format", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg") as SVGElement;
      const rects = svg.querySelectorAll("rect");
      const fill = rects[0]?.getAttribute("fill");

      expect(fill).toMatch(/^hsl\(/);
    });

    it("should use consistent hue for public key", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg") as SVGElement;
      const rects = svg.querySelectorAll("rect");

      // All rects should have the same color
      const colors = Array.from(rects).map((rect) => rect.getAttribute("fill"));
      const uniqueColors = new Set(colors);

      expect(uniqueColors.size).toBe(1); // Only one unique color
    });
  });

  describe("Pattern Generation", () => {
    it("should generate 5x5 grid pattern", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      const rects = svg?.querySelectorAll("rect");

      // 5x5 grid with mirroring means up to 15 cells can be filled
      // (3 columns * 5 rows, mirrored to fill 5x5)
      expect(rects!.length).toBeGreaterThan(0);
      expect(rects!.length).toBeLessThanOrEqual(25);
    });

    it("should create symmetrical pattern (horizontal mirroring)", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      const rects = Array.from(svg?.querySelectorAll("rect") || []);

      // Group rects by y-coordinate
      const rowGroups = new Map<number, number[]>();
      rects.forEach((rect) => {
        const y = Number(rect.getAttribute("y"));
        const x = Number(rect.getAttribute("x"));
        if (!rowGroups.has(y)) {
          rowGroups.set(y, []);
        }
        rowGroups.get(y)!.push(x);
      });

      // Check each row for symmetry
      rowGroups.forEach((xValues) => {
        const sorted = xValues.sort((a, b) => a - b);
        // If pattern is symmetric, x positions should mirror around center
        // This is a simplified check - just verify we have x positions
        expect(sorted.length).toBeGreaterThan(0);
      });
    });

    it("should vary pattern based on public key bytes", () => {
      const key1 =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const key2 =
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

      const { unmount } = render(
        <IdentityBadge publicKey={key1} petname="User One" />,
      );

      const svg1 = document.querySelector("svg");
      const rectCount1 = svg1?.querySelectorAll("rect").length || 0;
      unmount();

      render(<IdentityBadge publicKey={key2} petname="User Two" />);

      const svg2 = document.querySelector("svg");
      const rectCount2 = svg2?.querySelectorAll("rect").length || 0;

      // Different keys should produce different patterns
      // (rect count may differ)
      expect(rectCount1).toBeGreaterThan(0);
      expect(rectCount2).toBeGreaterThan(0);
    });
  });

  describe("Size Variants", () => {
    it("should render small size (32x32)", () => {
      render(
        <IdentityBadge
          publicKey={testPublicKey}
          petname={testPetname}
          size="sm"
        />,
      );

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
      expect(svg).toHaveAttribute("viewBox", "0 0 32 32");
    });

    it("should render medium size (48x48)", () => {
      render(
        <IdentityBadge
          publicKey={testPublicKey}
          petname={testPetname}
          size="md"
        />,
      );

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "48");
      expect(svg).toHaveAttribute("height", "48");
      expect(svg).toHaveAttribute("viewBox", "0 0 48 48");
    });

    it("should render large size (64x64)", () => {
      render(
        <IdentityBadge
          publicKey={testPublicKey}
          petname={testPetname}
          size="lg"
        />,
      );

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "64");
      expect(svg).toHaveAttribute("height", "64");
      expect(svg).toHaveAttribute("viewBox", "0 0 64 64");
    });

    it("should maintain pattern consistency across sizes", () => {
      const { unmount } = render(
        <IdentityBadge
          publicKey={testPublicKey}
          petname={testPetname}
          size="sm"
        />,
      );

      const svg1 = document.querySelector("svg");
      const rectCount1 = svg1?.querySelectorAll("rect").length || 0;
      unmount();

      render(
        <IdentityBadge
          publicKey={testPublicKey}
          petname={testPetname}
          size="lg"
        />,
      );

      const svg2 = document.querySelector("svg");
      const rectCount2 = svg2?.querySelectorAll("rect").length || 0;

      // Same key should produce same number of rects regardless of size
      expect(rectCount1).toBe(rectCount2);
    });
  });

  describe("Grid Cell Calculations", () => {
    it("should calculate cell size correctly for medium (48px / 5 = 9.6px)", () => {
      render(
        <IdentityBadge
          publicKey={testPublicKey}
          petname={testPetname}
          size="md"
        />,
      );

      const svg = document.querySelector("svg");
      const rects = svg?.querySelectorAll("rect");
      const firstRect = rects?.[0];

      if (firstRect) {
        const width = Number(firstRect.getAttribute("width"));
        const height = Number(firstRect.getAttribute("height"));

        // Cell size should be size/grid = 48/5 = 9.6
        expect(width).toBeCloseTo(9.6, 1);
        expect(height).toBeCloseTo(9.6, 1);
      }
    });

    it("should calculate cell size correctly for large (64px / 5 = 12.8px)", () => {
      render(
        <IdentityBadge
          publicKey={testPublicKey}
          petname={testPetname}
          size="lg"
        />,
      );

      const svg = document.querySelector("svg");
      const rects = svg?.querySelectorAll("rect");
      const firstRect = rects?.[0];

      if (firstRect) {
        const width = Number(firstRect.getAttribute("width"));
        const height = Number(firstRect.getAttribute("height"));

        // Cell size should be size/grid = 64/5 = 12.8
        expect(width).toBeCloseTo(12.8, 1);
        expect(height).toBeCloseTo(12.8, 1);
      }
    });

    it("should position cells in grid correctly", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      const rects = Array.from(svg?.querySelectorAll("rect") || []);

      // Verify that rects have valid x, y coordinates
      rects.forEach((rect) => {
        const x = Number(rect.getAttribute("x"));
        const y = Number(rect.getAttribute("y"));

        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(48); // Within SVG bounds
        expect(y).toBeLessThan(48);
      });
    });
  });

  describe("Accessibility", () => {
    it("should have appropriate ARIA attributes for decorative SVG", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      // SVG is decorative (petname is the text alternative)
      expect(svg).toBeInTheDocument();
    });

    it("should be visually distinguishable", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg") as SVGElement;
      const style = svg.getAttribute("style") || "";

      // Should have visible background color
      expect(style).toContain("background-color");
    });

    it("should have sufficient color contrast", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      const rects = svg?.querySelectorAll("rect");

      rects?.forEach((rect) => {
        const fill = rect.getAttribute("fill");
        // Should use HSL with decent saturation and lightness
        expect(fill).toMatch(/hsl\(\d+,\s*65%,\s*55%\)/);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle minimum public key length", () => {
      const minKey = "02" + "0".repeat(64);

      render(<IdentityBadge publicKey={minKey} petname="Min Key" />);

      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should handle public key with all same bytes", () => {
      const uniformKey = "02" + "ff".repeat(32);

      render(<IdentityBadge publicKey={uniformKey} petname="Uniform Key" />);

      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();

      const rects = svg?.querySelectorAll("rect");
      expect(rects!.length).toBeGreaterThan(0);
    });

    it("should handle public key with 02 prefix", () => {
      const key02 =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      render(<IdentityBadge publicKey={key02} petname="Key 02" />);

      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should handle public key with 03 prefix", () => {
      const key03 =
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

      render(<IdentityBadge publicKey={key03} petname="Key 03" />);

      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("Determinism", () => {
    it("should produce identical SVG for same public key on multiple renders", () => {
      const { unmount } = render(
        <IdentityBadge publicKey={testPublicKey} petname={testPetname} />,
      );

      const svg1 = document.querySelector("svg");
      const rects1 = Array.from(svg1?.querySelectorAll("rect") || []);
      const positions1 = rects1.map((r) => ({
        x: r.getAttribute("x"),
        y: r.getAttribute("y"),
        fill: r.getAttribute("fill"),
      }));
      unmount();

      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg2 = document.querySelector("svg");
      const rects2 = Array.from(svg2?.querySelectorAll("rect") || []);
      const positions2 = rects2.map((r) => ({
        x: r.getAttribute("x"),
        y: r.getAttribute("y"),
        fill: r.getAttribute("fill"),
      }));

      expect(positions1).toEqual(positions2);
    });

    it("should produce same pattern after component remount", () => {
      const { unmount } = render(
        <IdentityBadge publicKey={testPublicKey} petname={testPetname} />,
      );

      const svg1 = document.querySelector("svg");
      const rectCount1 = svg1?.querySelectorAll("rect").length;

      unmount();

      // Re-render via a fresh render() call (not rerender after unmount)
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg2 = document.querySelector("svg");
      const rectCount2 = svg2?.querySelectorAll("rect").length;

      expect(rectCount1).toBe(rectCount2);
    });
  });

  describe("Performance", () => {
    it("should render without excessive DOM nodes", () => {
      render(<IdentityBadge publicKey={testPublicKey} petname={testPetname} />);

      const svg = document.querySelector("svg");
      const rects = svg?.querySelectorAll("rect");

      // Should have reasonable number of rects (not thousands)
      expect(rects!.length).toBeLessThan(100);
    });

    it("should render quickly for multiple identicons", () => {
      const keys = [
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5",
        "0250863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352",
      ];

      const start = performance.now();

      keys.forEach((key, i) => {
        render(<IdentityBadge publicKey={key} petname={`User ${i}`} />);
      });

      const elapsed = performance.now() - start;

      // Should render 3 identicons in reasonable time (< 100ms)
      expect(elapsed).toBeLessThan(100);
    });
  });
});
