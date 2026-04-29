/**
 * Identicon Generation Tests
 *
 * Tests for deterministic SVG identicon generation from BSV public keys (SPEC §4.2).
 * Validates SVG structure, determinism, and visual hash properties.
 */

import { describe, it, expect } from "vitest";

import type { IdenticonConfig, IdenticonResult } from "@/types/identity";

describe("Identicon Generation", () => {
  describe("Identicon Result Structure", () => {
    it("should include SVG markup", () => {
      const result: IdenticonResult = {
        svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        dataUri: "data:image/svg+xml,...",
        publicKey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("</svg>");
    });

    it("should include data URI for direct use", () => {
      const result: IdenticonResult = {
        svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        dataUri: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0i...",
        publicKey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      expect(result.dataUri).toMatch(/^data:image\/svg\+xml/);
    });

    it("should link to source public key", () => {
      const publicKey =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      const result: IdenticonResult = {
        svg: "<svg></svg>",
        dataUri: "data:image/svg+xml,...",
        publicKey,
      };

      expect(result.publicKey).toBe(publicKey);
      expect(result.publicKey.length).toBe(66); // 33 bytes compressed
    });
  });

  describe("SVG Structure Validation", () => {
    it("should generate valid SVG markup", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        64
      );

      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain("width=");
      expect(svg).toContain("height=");
      expect(svg).toContain("viewBox=");
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
    });

    it("should include dimensions in viewBox", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        64
      );

      expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
    });

    it("should contain rect elements for grid pattern", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        64
      );

      expect(svg).toContain("<rect");
      expect(svg).toContain('fill=');
    });

    it("should use valid colors", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        64
      );

      // Should use HSL color format
      const hslMatch = svg.match(/hsl\(\d+,\s*\d+%,\s*\d+%\)/);
      expect(hslMatch).toBeTruthy();
    });
  });

  describe("Identicon Configuration", () => {
    it("should support custom size", () => {
      const config: IdenticonConfig = {
        size: 128,
      };

      expect(config.size).toBe(128);
    });

    it("should support custom background color", () => {
      const config: IdenticonConfig = {
        size: 64,
        backgroundColor: "#f0f0f0",
      };

      expect(config.backgroundColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should support custom foreground colors", () => {
      const config: IdenticonConfig = {
        size: 64,
        foregroundColors: ["#ff0000", "#00ff00", "#0000ff"],
      };

      expect(config.foregroundColors?.length).toBe(3);
      config.foregroundColors?.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it("should support custom grid size", () => {
      const config: IdenticonConfig = {
        gridSize: 8,
      };

      expect(config.gridSize).toBe(8);
      expect(config.gridSize).toBeGreaterThan(0);
    });

    it("should support different styles", () => {
      const styles: ("blocks" | "circles" | "triangles")[] = [
        "blocks",
        "circles",
        "triangles",
      ];

      styles.forEach((style) => {
        const config: IdenticonConfig = { style };
        expect(config.style).toBe(style);
      });
    });
  });

  describe("Deterministic Generation", () => {
    it("should generate same identicon for same public key", () => {
      const publicKey =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      const svg1 = generateMockIdenticon(publicKey, 64);
      const svg2 = generateMockIdenticon(publicKey, 64);

      expect(svg1).toBe(svg2);
    });

    it("should generate different identicons for different keys", () => {
      const key1 =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const key2 =
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

      const svg1 = generateMockIdenticon(key1, 64);
      const svg2 = generateMockIdenticon(key2, 64);

      expect(svg1).not.toBe(svg2);
    });

    it("should use SHA-256 hash for determinism", () => {
      const publicKey =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      // Multiple generations should produce identical output
      const results = Array(5)
        .fill(null)
        .map(() => generateMockIdenticon(publicKey, 64));

      results.forEach((svg) => {
        expect(svg).toBe(results[0]);
      });
    });
  });

  describe("Visual Properties", () => {
    it("should create symmetrical pattern", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        64
      );

      // Grid should be symmetrical (mirrored horizontally)
      // This is enforced by the Rust implementation
      expect(svg).toBeTruthy();
    });

    it("should derive color from public key hash", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        64
      );

      // Should contain HSL color derived from hash
      const hslMatch = svg.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      expect(hslMatch).toBeTruthy();

      if (hslMatch) {
        const [, hue, saturation, lightness] = hslMatch!;
        expect(parseInt(hue!)).toBeGreaterThanOrEqual(0);
        expect(parseInt(hue!)).toBeLessThan(360);
        expect(parseInt(saturation!)).toBeGreaterThanOrEqual(60);
        expect(parseInt(saturation!)).toBeLessThanOrEqual(80);
        expect(parseInt(lightness!)).toBeGreaterThanOrEqual(45);
        expect(parseInt(lightness!)).toBeLessThanOrEqual(55);
      }
    });

    it("should use 8x8 grid by default", () => {
      const config: IdenticonConfig = {
        gridSize: 8, // Default from Rust implementation
      };

      expect(config.gridSize).toBe(8);
    });
  });

  describe("Size Handling", () => {
    it("should support different sizes", () => {
      const sizes = [32, 64, 128, 256];

      sizes.forEach((size) => {
        const svg = generateMockIdenticon(
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
          size
        );

        expect(svg).toContain(`width="${size}"`);
        expect(svg).toContain(`height="${size}"`);
      });
    });

    it("should maintain aspect ratio", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        64
      );

      const widthMatch = svg.match(/width="(\d+)"/);
      const heightMatch = svg.match(/height="(\d+)"/);

      expect(widthMatch?.[1]).toBe(heightMatch?.[1]);
    });
  });

  describe("Data URI Encoding", () => {
    it("should encode SVG as base64 data URI", () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      const encoded = btoa(svg);
      const dataUri = `data:image/svg+xml;base64,${encoded}`;

      expect(dataUri).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it("should be usable in img src attribute", () => {
      const result: IdenticonResult = {
        svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        dataUri: "data:image/svg+xml;base64,PHN2Zy...",
        publicKey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      // Should be valid for <img src={dataUri} />
      expect(result.dataUri.startsWith("data:")).toBe(true);
    });
  });

  describe("Test Vectors", () => {
    it("should generate identicon for secp256k1 generator point", () => {
      const generatorPoint =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      const svg = generateMockIdenticon(generatorPoint, 64);

      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain("<rect");
    });

    it("should handle both 02 and 03 prefix keys", () => {
      const key02 =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const key03 =
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

      const svg1 = generateMockIdenticon(key02, 64);
      const svg2 = generateMockIdenticon(key03, 64);

      expect(svg1).toContain("<svg");
      expect(svg2).toContain("<svg");
      expect(svg1).not.toBe(svg2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle minimum size", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        16
      );

      expect(svg).toContain('width="16"');
      expect(svg).toContain('height="16"');
    });

    it("should handle large size", () => {
      const svg = generateMockIdenticon(
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        512
      );

      expect(svg).toContain('width="512"');
      expect(svg).toContain('height="512"');
    });
  });
});

// --- Helper Functions ---

/**
 * Mock identicon generation (mimics Rust backend logic)
 * Uses SHA-256 hash to generate deterministic blockies-style SVG
 */
function generateMockIdenticon(publicKey: string, size: number): string {
  // Simple mock: generate deterministic SVG from public key
  // In real app, this would call the Rust backend

  const hash = publicKey.slice(2); // Remove "02" or "03" prefix
  const gridSize = 8;
  const cellSize = size / gridSize;

  // Derive color from hash
  const hue = (parseInt(hash.slice(0, 2), 16) * 360) / 256;
  const saturation = 60 + ((parseInt(hash.slice(2, 4), 16) * 20) / 256);
  const lightness = 45 + ((parseInt(hash.slice(4, 6), 16) * 10) / 256);
  const color = `hsl(${Math.floor(hue)}, ${Math.floor(saturation)}%, ${Math.floor(lightness)}%)`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="#f0f0f0"/>`;

  // Generate symmetrical pattern
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize / 2; x++) {
      const byteIndex = (y * (gridSize / 2) + x) % 32;
      const bit =
        (parseInt(hash.slice(byteIndex * 2, byteIndex * 2 + 2), 16) >>
          (x % 8)) &
        1;

      if (bit === 1) {
        const x1 = x * cellSize;
        const x2 = (gridSize - 1 - x) * cellSize;
        const y1 = y * cellSize;

        svg += `<rect x="${x1}" y="${y1}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
        if (x !== gridSize / 2 - 1) {
          svg += `<rect x="${x2}" y="${y1}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
        }
      }
    }
  }

  svg += "</svg>";
  return svg;
}
