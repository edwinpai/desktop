import React from "react";

interface IdentityBadgeProps {
  publicKey: string;
  petname: string;
  size?: "sm" | "md" | "lg";
}

// Generate a deterministic color from public key
function keyColor(pk: string): string {
  const hue = parseInt(pk.slice(2, 6), 16) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

// Generate a simple identicon-style SVG from public key bytes
function Identicon({ publicKey, size }: { publicKey: string; size: number }) {
  const bytes: number[] = [];
  for (let i = 2; i < Math.min(publicKey.length, 22); i += 2) {
    bytes.push(parseInt(publicKey.slice(i, i + 2), 16));
  }
  // Ensure at least one byte is even so the pattern always has some filled cells
  if (bytes.length > 0 && bytes.every((b) => b % 2 !== 0)) {
    const firstByte = bytes[0];
    if (firstByte !== undefined) {
      bytes[0] = firstByte & 0xfe; // Force first byte even
    }
  }

  const cells: React.ReactElement[] = [];
  const grid = 5;
  const cellSize = size / grid;

  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < Math.ceil(grid / 2); x++) {
      const idx = y * Math.ceil(grid / 2) + x;
      const byte = bytes[idx % bytes.length];
      if (byte !== undefined && byte % 2 === 0) {
        // Mirror horizontally for symmetry
        cells.push(
          <rect
            key={`${x}-${y}`}
            x={x * cellSize}
            y={y * cellSize}
            width={cellSize}
            height={cellSize}
            fill={keyColor(publicKey)}
          />,
        );
        if (x !== Math.floor(grid / 2)) {
          cells.push(
            <rect
              key={`${grid - 1 - x}-${y}`}
              x={(grid - 1 - x) * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={keyColor(publicKey)}
            />,
          );
        }
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-lg"
      style={{
        backgroundColor: keyColor(publicKey)
          .replace(")", ", 0.13)")
          .replace("hsl(", "hsla("),
      }}
    >
      {cells}
    </svg>
  );
}

export function IdentityBadge({
  publicKey,
  petname,
  size = "md",
}: IdentityBadgeProps) {
  const iconSize = size === "sm" ? 32 : size === "md" ? 48 : 64;
  const shortId = `edw:${publicKey.slice(2, 10)}`;

  return (
    <div className="flex items-center gap-3">
      <Identicon publicKey={publicKey} size={iconSize} />
      <div>
        <p
          className={
            size === "sm"
              ? "text-sm font-medium"
              : size === "lg"
                ? "text-xl font-bold"
                : "text-base font-semibold"
          }
        >
          {petname}
        </p>
        <p className="text-xs text-muted-foreground font-mono">{shortId}</p>
      </div>
    </div>
  );
}
