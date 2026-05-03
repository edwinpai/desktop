/**
 * BRC-103 compliant identicon generator
 * (SPEC §4.2)
 *
 * Generates deterministic visual hashes (identicons) from BSV public keys.
 * Uses a symmetric 8x8 grid with geometric shapes derived from the hash.
 */

import type { IdenticonConfig, IdenticonResult } from "@/types/identity";

/**
 * Default identicon configuration
 */
const DEFAULT_CONFIG: Required<IdenticonConfig> = {
  size: 64,
  backgroundColor: "transparent",
  foregroundColors: [
    "#3b82f6", // blue-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#f59e0b", // amber-500
    "#10b981", // emerald-500
  ],
  gridSize: 8,
  style: "blocks",
};

/**
 * Generate a SHA-256 hash from a hex public key
 */
async function sha256(publicKeyHex: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKeyHex);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

/**
 * Generate an identicon from a BSV public key
 */
export async function generateIdenticon(
  publicKey: string,
  config: IdenticonConfig = {},
): Promise<IdenticonResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { size, backgroundColor, foregroundColors, gridSize, style } =
    finalConfig;

  // Hash the public key
  const hash = await sha256(publicKey);

  // Determine color from first byte
  const firstByte = hash[0];
  if (firstByte === undefined) {
    throw new Error("Invalid hash: missing first byte");
  }
  const colorIndex = firstByte % foregroundColors.length;
  const color = foregroundColors[colorIndex];
  if (!color) {
    throw new Error("Invalid color index");
  }

  // Generate symmetric grid pattern
  const cellSize = size / gridSize;
  const halfGrid = Math.floor(gridSize / 2);

  // Build SVG
  let svgPaths = "";

  // For each cell in the left half + center (symmetric)
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x <= halfGrid; x++) {
      // Use hash bytes to determine if cell is filled
      const byteIndex = (y * halfGrid + x) % hash.length;
      const bitIndex = (y * halfGrid + x) % 8;
      const byte = hash[byteIndex];
      if (byte === undefined) continue;
      const isFilled = (byte >> bitIndex) & 1;

      if (isFilled) {
        // Draw cell
        const xPos = x * cellSize;
        const yPos = y * cellSize;

        // Also draw mirrored cell (unless it's the center column)
        const mirrorX = (gridSize - 1 - x) * cellSize;

        svgPaths += renderCell(xPos, yPos, cellSize, color, style);
        if (x !== halfGrid) {
          svgPaths += renderCell(mirrorX, yPos, cellSize, color, style);
        }
      }
    }
  }

  // Construct SVG
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${backgroundColor};">
  ${svgPaths}
</svg>`;

  // Create data URI
  const dataUri = `data:image/svg+xml;base64,${btoa(svg)}`;

  return {
    svg,
    dataUri,
    publicKey,
  };
}

/**
 * Render a single cell based on style
 */
function renderCell(
  x: number,
  y: number,
  size: number,
  color: string,
  style: "blocks" | "circles" | "triangles",
): string {
  switch (style) {
    case "blocks":
      return `  <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" />\n`;

    case "circles": {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const r = size / 2;
      return `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />\n`;
    }

    case "triangles": {
      // Random triangle orientation based on position
      const variant = ((x + y) * 7) % 4;
      let points = "";

      switch (variant) {
        case 0: // Top-left triangle
          points = `${x},${y} ${x + size},${y} ${x},${y + size}`;
          break;
        case 1: // Top-right triangle
          points = `${x},${y} ${x + size},${y} ${x + size},${y + size}`;
          break;
        case 2: // Bottom-right triangle
          points = `${x + size},${y} ${x + size},${y + size} ${x},${y + size}`;
          break;
        case 3: // Bottom-left triangle
          points = `${x},${y} ${x + size},${y + size} ${x},${y + size}`;
          break;
      }

      return `  <polygon points="${points}" fill="${color}" />\n`;
    }

    default:
      return "";
  }
}

/**
 * Synchronous identicon generation using Canvas API (for Node.js/testing)
 * Falls back to hash-based pattern generation without crypto.subtle
 */
export function generateIdenticonSync(
  publicKey: string,
  config: IdenticonConfig = {},
): IdenticonResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { size, backgroundColor, foregroundColors, gridSize, style } =
    finalConfig;

  // Simple hash function for sync operation (not cryptographically secure, but deterministic)
  let hash = 0;
  for (let i = 0; i < publicKey.length; i++) {
    hash = (hash << 5) - hash + publicKey.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate pseudo-random bytes from hash
  const pseudoHash = new Uint8Array(32);
  let currentHash = hash;
  for (let i = 0; i < 32; i++) {
    currentHash = (currentHash * 1103515245 + 12345) & 0x7fffffff;
    pseudoHash[i] = (currentHash >> 16) & 0xff;
  }

  // Determine color
  const colorIndex = Math.abs(hash) % foregroundColors.length;
  const color = foregroundColors[colorIndex];
  if (!color) {
    throw new Error("Invalid color index");
  }

  // Generate symmetric grid pattern
  const cellSize = size / gridSize;
  const halfGrid = Math.floor(gridSize / 2);

  let svgPaths = "";

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x <= halfGrid; x++) {
      const byteIndex = (y * halfGrid + x) % pseudoHash.length;
      const bitIndex = (y * halfGrid + x) % 8;
      const byte = pseudoHash[byteIndex];
      if (byte === undefined) continue;
      const isFilled = (byte >> bitIndex) & 1;

      if (isFilled) {
        const xPos = x * cellSize;
        const yPos = y * cellSize;
        const mirrorX = (gridSize - 1 - x) * cellSize;

        svgPaths += renderCell(xPos, yPos, cellSize, color, style);
        if (x !== halfGrid) {
          svgPaths += renderCell(mirrorX, yPos, cellSize, color, style);
        }
      }
    }
  }

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${backgroundColor};">
  ${svgPaths}
</svg>`;

  const dataUri = `data:image/svg+xml;base64,${btoa(svg)}`;

  return {
    svg,
    dataUri,
    publicKey,
  };
}

/**
 * Generate identicon and return as a data URL for use in <img> tags
 */
export async function generateIdenticonDataUrl(
  publicKey: string,
  config?: IdenticonConfig,
): Promise<string> {
  const result = await generateIdenticon(publicKey, config);
  return result.dataUri;
}

/**
 * React hook helper: generate identicon with loading state
 */
export function useIdenticonGenerator() {
  return {
    generate: generateIdenticon,
    generateDataUrl: generateIdenticonDataUrl,
    generateSync: generateIdenticonSync,
  };
}
