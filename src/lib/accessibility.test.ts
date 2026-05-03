/**
 * Accessibility Utilities Tests - Group F
 */

import { describe, it, expect } from "vitest";
import {
  getRelativeLuminance,
  getContrastRatio,
  hexToRgb,
  verifyContrast,
  batchVerifyContrast,
  WCAG_CONTRAST_RATIOS,
} from "./accessibility";

describe("accessibility", () => {
  describe("hexToRgb", () => {
    it("converts hex to RGB", () => {
      expect(hexToRgb("#FFFFFF")).toEqual([255, 255, 255]);
      expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
      expect(hexToRgb("#FF0000")).toEqual([255, 0, 0]);
      expect(hexToRgb("#00FF00")).toEqual([0, 255, 0]);
      expect(hexToRgb("#0000FF")).toEqual([0, 0, 255]);
    });

    it("handles hex without # prefix", () => {
      expect(hexToRgb("FFFFFF")).toEqual([255, 255, 255]);
      expect(hexToRgb("000000")).toEqual([0, 0, 0]);
    });

    it("handles lowercase hex", () => {
      expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
      expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
    });

    it("returns null for invalid hex", () => {
      expect(hexToRgb("#GGGGGG")).toBeNull();
      expect(hexToRgb("invalid")).toBeNull();
      expect(hexToRgb("#FFF")).toBeNull(); // Short form not supported
    });
  });

  describe("getRelativeLuminance", () => {
    it("calculates luminance for white", () => {
      const luminance = getRelativeLuminance(255, 255, 255);
      expect(luminance).toBeCloseTo(1, 2);
    });

    it("calculates luminance for black", () => {
      const luminance = getRelativeLuminance(0, 0, 0);
      expect(luminance).toBe(0);
    });

    it("calculates luminance for gray", () => {
      const luminance = getRelativeLuminance(128, 128, 128);
      expect(luminance).toBeGreaterThan(0);
      expect(luminance).toBeLessThan(1);
    });

    it("calculates luminance for colors", () => {
      const red = getRelativeLuminance(255, 0, 0);
      const green = getRelativeLuminance(0, 255, 0);
      const blue = getRelativeLuminance(0, 0, 255);

      // Green should have highest luminance
      expect(green).toBeGreaterThan(red);
      expect(green).toBeGreaterThan(blue);
    });
  });

  describe("getContrastRatio", () => {
    it("calculates maximum contrast (white vs black)", () => {
      const ratio = getContrastRatio(1, 0);
      expect(ratio).toBe(21);
    });

    it("calculates minimum contrast (same color)", () => {
      const ratio = getContrastRatio(0.5, 0.5);
      expect(ratio).toBe(1);
    });

    it("handles reversed luminance values", () => {
      const ratio1 = getContrastRatio(1, 0);
      const ratio2 = getContrastRatio(0, 1);
      expect(ratio1).toBe(ratio2);
    });

    it("calculates mid-range contrast", () => {
      const ratio = getContrastRatio(1, 0.5);
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(21);
    });
  });

  describe("verifyContrast", () => {
    it("passes for black on white (AA normal)", () => {
      const result = verifyContrast("#000000", "#FFFFFF", "normal", "AA");
      expect(result.ratio).toBe(21);
      expect(result.passes).toBe(true);
      expect(result.level).toBe("AA");
      expect(result.textSize).toBe("normal");
    });

    it("passes for black on white (AAA normal)", () => {
      const result = verifyContrast("#000000", "#FFFFFF", "normal", "AAA");
      expect(result.ratio).toBe(21);
      expect(result.passes).toBe(true);
    });

    it("fails for low contrast (light gray on white)", () => {
      const result = verifyContrast("#CCCCCC", "#FFFFFF", "normal", "AA");
      expect(result.passes).toBe(false);
    });

    it("passes large text with lower contrast", () => {
      const result = verifyContrast("#767676", "#FFFFFF", "large", "AA");
      expect(result.passes).toBe(true);
    });

    it("applies correct thresholds", () => {
      // Test AA normal (4.5:1)
      const aaNormal = verifyContrast("#767676", "#FFFFFF", "normal", "AA");
      expect(aaNormal.ratio).toBeGreaterThanOrEqual(
        WCAG_CONTRAST_RATIOS.AA_NORMAL,
      );

      // Test AA large (3:1)
      const aaLarge = verifyContrast("#959595", "#FFFFFF", "large", "AA");
      expect(aaLarge.ratio).toBeGreaterThanOrEqual(
        WCAG_CONTRAST_RATIOS.AA_LARGE,
      );
    });

    it("returns failure for invalid colors", () => {
      const result = verifyContrast("invalid", "#FFFFFF", "normal", "AA");
      expect(result.passes).toBe(false);
      expect(result.ratio).toBe(0);
    });
  });

  describe("batchVerifyContrast", () => {
    it("verifies multiple color pairs", () => {
      const results = batchVerifyContrast([
        { fg: "#000000", bg: "#FFFFFF", label: "Black on white" },
        { fg: "#FFFFFF", bg: "#000000", label: "White on black" },
        { fg: "#CCCCCC", bg: "#FFFFFF", label: "Light gray on white" },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]?.passes).toBe(true);
      expect(results[0]?.label).toBe("Black on white");
      expect(results[1]?.passes).toBe(true);
      expect(results[2]?.passes).toBe(false);
    });

    it("uses custom text size and level", () => {
      const results = batchVerifyContrast([
        { fg: "#767676", bg: "#FFFFFF", size: "large", level: "AA" },
      ]);

      expect(results[0]?.textSize).toBe("large");
      expect(results[0]?.level).toBe("AA");
      expect(results[0]?.passes).toBe(true);
    });
  });

  describe("WCAG contrast requirements", () => {
    it("defines correct AA thresholds", () => {
      expect(WCAG_CONTRAST_RATIOS.AA_NORMAL).toBe(4.5);
      expect(WCAG_CONTRAST_RATIOS.AA_LARGE).toBe(3.0);
    });

    it("defines correct AAA thresholds", () => {
      expect(WCAG_CONTRAST_RATIOS.AAA_NORMAL).toBe(7.0);
      expect(WCAG_CONTRAST_RATIOS.AAA_LARGE).toBe(4.5);
    });
  });

  describe("Common color combinations", () => {
    it("verifies typical UI colors", () => {
      const commonPairs = [
        { fg: "#000000", bg: "#FFFFFF", name: "Black on white" },
        { fg: "#FFFFFF", bg: "#000000", name: "White on black" },
        { fg: "#0066CC", bg: "#FFFFFF", name: "Blue link on white" },
        { fg: "#CC0000", bg: "#FFFFFF", name: "Red error on white" },
      ];

      for (const pair of commonPairs) {
        const result = verifyContrast(pair.fg, pair.bg, "normal", "AA");
        expect(result.passes).toBe(true);
      }
    });

    it("catches insufficient contrast", () => {
      const insufficientPairs = [
        { fg: "#777777", bg: "#999999", name: "Gray on gray" },
        { fg: "#FFFF00", bg: "#FFFFFF", name: "Yellow on white" },
        { fg: "#DDDDDD", bg: "#FFFFFF", name: "Light gray on white" },
      ];

      for (const pair of insufficientPairs) {
        const result = verifyContrast(pair.fg, pair.bg, "normal", "AA");
        expect(result.passes).toBe(false);
      }
    });
  });

  describe("Edge cases", () => {
    it("handles same foreground and background", () => {
      const result = verifyContrast("#808080", "#808080", "normal", "AA");
      expect(result.ratio).toBe(1);
      expect(result.passes).toBe(false);
    });

    it("rounds ratio to 2 decimal places", () => {
      const result = verifyContrast("#767676", "#FFFFFF", "normal", "AA");
      expect(Number.isInteger(result.ratio * 100)).toBe(true);
    });
  });
});
