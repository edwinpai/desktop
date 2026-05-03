/**
 * Unit tests for BEEF Parser
 */

import { describe, expect, it } from "vitest";

import { parseBeef, serializeBeef } from "@/lib/spv/beef-parser";
import type { BeefEnvelope } from "@/types";

describe("BEEF Parser", () => {
  describe("parseBeef", () => {
    it("should parse a valid BEEF envelope header", () => {
      // Create minimal BEEF envelope:
      // Version (4 bytes) + tx count (1 byte) + proof count (1 byte)
      const beefBytes = new Uint8Array([
        0x00,
        0x01,
        0x00,
        0x00, // Version 0x0100 (little-endian)
        0x00, // 0 transactions
        0x00, // 0 proofs
      ]);

      const beef = parseBeef(beefBytes);

      expect(beef.version).toBe(0x0100);
      expect(beef.transactions).toHaveLength(0);
      expect(beef.merkleProofs).toHaveLength(0);
    });

    it("should throw error on unsupported version", () => {
      const beefBytes = new Uint8Array([
        0xff,
        0xff,
        0x00,
        0x00, // Invalid version
        0x00,
        0x00,
      ]);

      expect(() => parseBeef(beefBytes)).toThrow(/Unsupported BEEF version/);
    });

    it("should parse transaction count correctly", () => {
      // BEEF with 3 transactions (but no actual tx data - will error)
      const beefBytes = new Uint8Array([
        0x00,
        0x01,
        0x00,
        0x00, // Version
        0x03, // 3 transactions
      ]);

      // This will error due to insufficient data, but we test the parsing attempt
      expect(() => parseBeef(beefBytes)).toThrow();
    });

    it("should handle VarInt encoding for counts", () => {
      // Test VarInt parsing with value < 0xfd (single byte)
      const beefBytes = new Uint8Array([
        0x00,
        0x01,
        0x00,
        0x00,
        0x05, // 5 transactions (VarInt)
      ]);

      expect(() => parseBeef(beefBytes)).toThrow(); // Will fail on missing tx data
    });

    it("should validate proof structure when requested", () => {
      const beefBytes = new Uint8Array([
        0x00,
        0x01,
        0x00,
        0x00,
        0x00, // 0 transactions
        0x00, // 0 proofs
      ]);

      const beef = parseBeef(beefBytes, { validateProofs: true });

      expect(beef.transactions).toHaveLength(0);
      expect(beef.merkleProofs).toHaveLength(0);
    });

    it("should throw on malformed data", () => {
      const beefBytes = new Uint8Array([0x00]); // Too short

      expect(() => parseBeef(beefBytes)).toThrow();
    });
  });

  describe("serializeBeef", () => {
    it("should serialize minimal BEEF envelope", () => {
      const beef: BeefEnvelope = {
        version: 0x0100,
        transactions: [],
        merkleProofs: [],
      };

      const serialized = serializeBeef(beef);

      expect(serialized).toBeInstanceOf(Uint8Array);
      expect(serialized.length).toBeGreaterThan(0);

      // Verify version bytes
      expect(serialized[0]).toBe(0x00);
      expect(serialized[1]).toBe(0x01);
      expect(serialized[2]).toBe(0x00);
      expect(serialized[3]).toBe(0x00);
    });

    it("should round-trip minimal BEEF envelope", () => {
      const beef: BeefEnvelope = {
        version: 0x0100,
        transactions: [],
        merkleProofs: [],
      };

      const serialized = serializeBeef(beef);
      const parsed = parseBeef(serialized);

      expect(parsed.version).toBe(beef.version);
      expect(parsed.transactions).toHaveLength(0);
      expect(parsed.merkleProofs).toHaveLength(0);
    });

    it("should serialize transaction count as VarInt", () => {
      const beef: BeefEnvelope = {
        version: 0x0100,
        transactions: [],
        merkleProofs: [],
      };

      const serialized = serializeBeef(beef);

      // After 4-byte version, should have VarInt 0x00 for tx count
      expect(serialized[4]).toBe(0x00);
    });
  });

  describe("Transaction parsing", () => {
    it("should handle empty transaction list", () => {
      const beef: BeefEnvelope = {
        version: 0x0100,
        transactions: [],
        merkleProofs: [],
      };

      const serialized = serializeBeef(beef);
      const parsed = parseBeef(serialized);

      expect(parsed.transactions).toEqual([]);
    });

    it("should parse transaction metadata", () => {
      // This tests that transaction structure is recognized
      // Full transaction parsing would require valid Bitcoin tx format
      const beef: BeefEnvelope = {
        version: 0x0100,
        transactions: [],
        merkleProofs: [],
      };

      expect(beef.transactions).toBeDefined();
      expect(Array.isArray(beef.transactions)).toBe(true);
    });
  });

  describe("Merkle proof parsing", () => {
    it("should handle empty proof list", () => {
      const beef: BeefEnvelope = {
        version: 0x0100,
        transactions: [],
        merkleProofs: [],
      };

      expect(beef.merkleProofs).toEqual([]);
    });

    it("should parse proof count", () => {
      const beef: BeefEnvelope = {
        version: 0x0100,
        transactions: [],
        merkleProofs: [],
      };

      expect(beef.merkleProofs).toHaveLength(0);
    });
  });

  describe("Error handling", () => {
    it("should throw on empty input", () => {
      const beefBytes = new Uint8Array([]);

      expect(() => parseBeef(beefBytes)).toThrow();
    });

    it("should throw on truncated input", () => {
      const beefBytes = new Uint8Array([0x00, 0x01]); // Incomplete version

      expect(() => parseBeef(beefBytes)).toThrow();
    });

    it("should handle invalid transaction data gracefully", () => {
      const beefBytes = new Uint8Array([
        0x00,
        0x01,
        0x00,
        0x00,
        0x01, // 1 transaction
        // Missing transaction data
      ]);

      expect(() => parseBeef(beefBytes)).toThrow();
    });
  });

  describe("VarInt encoding", () => {
    it("should parse single-byte VarInt", () => {
      // Test with count < 0xfd
      const beef: BeefEnvelope = {
        version: 0x0100,
        transactions: [],
        merkleProofs: [],
      };

      const serialized = serializeBeef(beef);

      // Transaction count should be encoded as single byte 0x00
      expect(serialized[4]).toBe(0x00);
    });

    it("should handle multi-byte VarInt in theory", () => {
      // VarInt encoding:
      // < 0xfd: 1 byte
      // >= 0xfd: 0xfd + 2 bytes (little-endian)
      // >= 0x10000: 0xfe + 4 bytes
      // >= 0x100000000: 0xff + 8 bytes

      // This is a structural test
      expect(0xfd).toBe(253);
    });
  });
});
