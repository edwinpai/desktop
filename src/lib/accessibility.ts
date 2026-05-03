/**
 * Accessibility Utilities - Group F Implementation
 *
 * WCAG 2.1 AA color contrast verification and accessibility helpers.
 */

/**
 * WCAG 2.1 contrast ratio requirements
 */
export const WCAG_CONTRAST_RATIOS = {
  AA_NORMAL: 4.5, // Normal text (< 18pt or < 14pt bold)
  AA_LARGE: 3.0, // Large text (>= 18pt or >= 14pt bold)
  AAA_NORMAL: 7.0, // Enhanced contrast for normal text
  AAA_LARGE: 4.5, // Enhanced contrast for large text
} as const;

export type ContrastLevel = "AA" | "AAA";
export type TextSize = "normal" | "large";

export interface ContrastResult {
  ratio: number;
  passes: boolean;
  level: ContrastLevel;
  textSize: TextSize;
}

/**
 * Calculate relative luminance of a color (WCAG 2.1 formula)
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @returns Relative luminance (0-1)
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

/**
 * Calculate contrast ratio between two colors (WCAG 2.1 formula)
 *
 * @param l1 - Luminance of color 1 (0-1)
 * @param l2 - Luminance of color 2 (0-1)
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse hex color to RGB
 *
 * @param hex - Hex color string (#RGB, #RRGGBB, #RRGGBBAA)
 * @returns RGB tuple [r, g, b] or null if invalid
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1] ?? "0", 16);
  const g = parseInt(result[2] ?? "0", 16);
  const b = parseInt(result[3] ?? "0", 16);

  return [r, g, b];
}

/**
 * Verify color contrast meets WCAG AA standards
 *
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @param textSize - Text size category
 * @param level - WCAG level (AA or AAA)
 * @returns Contrast verification result
 *
 * @example
 * ```ts
 * const result = verifyContrast("#000000", "#FFFFFF", "normal", "AA");
 * console.log(result.passes); // true
 * console.log(result.ratio); // 21
 * ```
 */
export function verifyContrast(
  foreground: string,
  background: string,
  textSize: TextSize = "normal",
  level: ContrastLevel = "AA",
): ContrastResult {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    return {
      ratio: 0,
      passes: false,
      level,
      textSize,
    };
  }

  const fgLuminance = getRelativeLuminance(...fgRgb);
  const bgLuminance = getRelativeLuminance(...bgRgb);
  const ratio = getContrastRatio(fgLuminance, bgLuminance);

  const threshold =
    level === "AAA"
      ? textSize === "large"
        ? WCAG_CONTRAST_RATIOS.AAA_LARGE
        : WCAG_CONTRAST_RATIOS.AAA_NORMAL
      : textSize === "large"
        ? WCAG_CONTRAST_RATIOS.AA_LARGE
        : WCAG_CONTRAST_RATIOS.AA_NORMAL;

  return {
    ratio: Math.round(ratio * 100) / 100,
    passes: ratio >= threshold,
    level,
    textSize,
  };
}

/**
 * Batch verify multiple color pairs
 *
 * @example
 * ```ts
 * const results = batchVerifyContrast([
 *   { fg: "#000", bg: "#FFF", size: "normal", label: "Primary text" },
 *   { fg: "#666", bg: "#FFF", size: "normal", label: "Secondary text" }
 * ]);
 * ```
 */
export function batchVerifyContrast(
  pairs: Array<{
    fg: string;
    bg: string;
    size?: TextSize;
    level?: ContrastLevel;
    label?: string;
  }>,
): Array<ContrastResult & { label?: string }> {
  return pairs.map(({ fg, bg, size = "normal", level = "AA", label }) => ({
    ...verifyContrast(fg, bg, size, level),
    label,
  }));
}

/**
 * Generate accessibility report for color palette
 */
export function generateAccessibilityReport(palette: Record<string, string>): {
  total: number;
  passed: number;
  failed: number;
  results: Array<ContrastResult & { pair: string }>;
} {
  const results: Array<ContrastResult & { pair: string }> = [];

  // Test common combinations
  const combinations = [
    { fg: "foreground", bg: "background" },
    { fg: "primary", bg: "background" },
    { fg: "secondary", bg: "background" },
    { fg: "muted-foreground", bg: "background" },
    { fg: "card-foreground", bg: "card" },
  ];

  for (const { fg, bg } of combinations) {
    const fgColor = palette[fg];
    const bgColor = palette[bg];

    if (fgColor && bgColor) {
      const result = verifyContrast(fgColor, bgColor, "normal", "AA");
      results.push({
        ...result,
        pair: `${fg} on ${bg}`,
      });
    }
  }

  const passed = results.filter((r) => r.passes).length;
  const failed = results.filter((r) => !r.passes).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

/**
 * Focus trap helper for modals (WCAG 2.4.3)
 */
export function createFocusTrap(element: HTMLElement): () => void {
  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");

  const focusableElements =
    element.querySelectorAll<HTMLElement>(focusableSelectors);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;

    if (event.shiftKey) {
      // Shift+Tab
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  element.addEventListener("keydown", handleKeyDown);

  // Focus first element
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    element.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: "polite" | "assertive" = "polite",
): void {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}
