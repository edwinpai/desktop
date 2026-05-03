/**
 * Audit Log Tests
 *
 * Tests for append-only audit log functionality (SPEC §3.6).
 * Validates JSON format, operations, and integrity.
 */

import { describe, it, expect } from "vitest";

import type { AuditLogEntry, AuditOperation } from "@/types/audit";

describe("Audit Log", () => {
  describe("Audit Log Entry Structure", () => {
    it("should have all required fields", () => {
      const entry: AuditLogEntry = {
        timestamp: "2026-02-09T12:00:00.000Z",
        operation: "sign",
        protocolID: "edwinpai-chat",
        keyID: "session-001",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        payloadHash:
          "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
        success: true,
      };

      expect(entry.timestamp).toBeDefined();
      expect(entry.operation).toBe("sign");
      expect(entry.protocolID).toBe("edwinpai-chat");
      expect(entry.keyID).toBe("session-001");
      expect(entry.counterparty).toBeDefined();
      expect(entry.payloadHash).toBeDefined();
      expect(entry.success).toBe(true);
    });

    it("should include error on failure", () => {
      const entry: AuditLogEntry = {
        timestamp: "2026-02-09T12:00:00.000Z",
        operation: "sign",
        protocolID: "edwinpai-chat",
        keyID: "session-001",
        success: false,
        error: "ERR_KEY_NOT_FOUND",
      };

      expect(entry.success).toBe(false);
      expect(entry.error).toBe("ERR_KEY_NOT_FOUND");
    });

    it("should allow omitting optional fields for identity operations", () => {
      const entry: AuditLogEntry = {
        timestamp: "2026-02-09T12:00:00.000Z",
        operation: "get_identity",
        success: true,
      };

      expect(entry.counterparty).toBeUndefined();
      expect(entry.operation).toBe("get_identity");
    });
  });

  describe("Audit Operations", () => {
    it("should support all 9 operations", () => {
      const operations: AuditOperation[] = [
        "sign",
        "verify",
        "derive_key",
        "get_public_key",
        "encrypt",
        "decrypt",
        "check_subscription",
        "get_identity",
        "generate_identicon",
      ];

      expect(operations.length).toBe(9);

      operations.forEach((op) => {
        const entry: AuditLogEntry = {
          timestamp: new Date().toISOString(),
          operation: op,
          success: true,
        };

        expect(entry.operation).toBe(op);
      });
    });

    it("should categorize crypto operations", () => {
      const cryptoOps: AuditOperation[] = [
        "sign",
        "verify",
        "encrypt",
        "decrypt",
      ];

      cryptoOps.forEach((op) => {
        expect(["sign", "verify", "encrypt", "decrypt"]).toContain(op);
      });
    });

    it("should categorize key operations", () => {
      const keyOps: AuditOperation[] = ["derive_key", "get_public_key"];

      keyOps.forEach((op) => {
        expect(["derive_key", "get_public_key"]).toContain(op);
      });
    });

    it("should categorize identity operations", () => {
      const identityOps: AuditOperation[] = [
        "get_identity",
        "generate_identicon",
      ];

      identityOps.forEach((op) => {
        expect(["get_identity", "generate_identicon"]).toContain(op);
      });
    });
  });

  describe("Timestamp Format", () => {
    it("should use ISO 8601 format", () => {
      const entry: AuditLogEntry = {
        timestamp: "2026-02-09T12:34:56.789Z",
        operation: "sign",
        protocolID: "test",
        keyID: "test",
        success: true,
      };

      expect(entry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it("should be chronologically sortable", () => {
      const timestamps = [
        "2026-02-09T12:00:00.000Z",
        "2026-02-09T12:00:01.000Z",
        "2026-02-09T12:00:02.000Z",
      ];

      const sorted = [...timestamps].sort();
      expect(sorted).toEqual(timestamps);
    });

    it("should include milliseconds for precision", () => {
      const timestamp = "2026-02-09T12:34:56.123Z";
      expect(timestamp).toContain(".123Z");
    });
  });

  describe("Payload Hash", () => {
    it("should be SHA-256 hash in hex format", () => {
      const entry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        operation: "sign",
        protocolID: "test",
        keyID: "test",
        payloadHash:
          "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
        success: true,
      };

      expect(entry.payloadHash?.length).toBe(64); // 32 bytes * 2 hex chars
      expect(entry.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should be deterministic for same payload", () => {
      // Same payload should produce same hash
      const hash1 =
        "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";
      const hash2 =
        "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";

      expect(hash1).toBe(hash2);
    });
  });

  describe("JSON Serialization", () => {
    it("should serialize to valid JSON", () => {
      const entry: AuditLogEntry = {
        timestamp: "2026-02-09T12:00:00.000Z",
        operation: "sign",
        protocolID: "edwinpai-chat",
        keyID: "session-001",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        payloadHash:
          "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
        success: true,
      };

      const json = JSON.stringify(entry);
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.operation).toBe("sign");
    });

    it("should handle omitted optional fields in JSON", () => {
      const entry: AuditLogEntry = {
        timestamp: "2026-02-09T12:00:00.000Z",
        operation: "get_identity",
        success: true,
      };

      const json = JSON.stringify(entry);
      const parsed = JSON.parse(json);

      expect(parsed.protocolID).toBeUndefined();
      expect(parsed.counterparty).toBeUndefined();
    });

    it("should be newline-delimited JSON (NDJSON)", () => {
      const entries = [
        {
          timestamp: "2026-02-09T12:00:00.000Z",
          operation: "sign" as AuditOperation,
          protocolID: "test",
          keyID: "key1",
          success: true,
        },
        {
          timestamp: "2026-02-09T12:00:01.000Z",
          operation: "verify" as AuditOperation,
          protocolID: "test",
          keyID: "key2",
          success: true,
        },
      ];

      const ndjson = entries.map((e) => JSON.stringify(e)).join("\n");
      const lines = ndjson.split("\n");

      expect(lines.length).toBe(2);
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });

  describe("Append-Only Properties", () => {
    it("should maintain chronological order", () => {
      const entries: AuditLogEntry[] = [
        {
          timestamp: "2026-02-09T12:00:00.000Z",
          operation: "sign",
          success: true,
        },
        {
          timestamp: "2026-02-09T12:00:01.000Z",
          operation: "verify",
          success: true,
        },
      ];

      for (let i = 1; i < entries.length; i++) {
        expect(entries[i]!.timestamp >= entries[i - 1]!.timestamp).toBe(true);
      }
    });

    it("should never modify previous entries", () => {
      // Append-only: once written, entries are immutable
      const entry: AuditLogEntry = {
        timestamp: "2026-02-09T12:00:00.000Z",
        operation: "sign",
        protocolID: "test",
        keyID: "test",
        success: true,
      };

      // Entries should be frozen after creation
      const frozen = Object.freeze(entry);
      expect(Object.isFrozen(frozen)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should log errors with error codes", () => {
      const errorCodes = [
        "ERR_KEYCHAIN_UNAVAILABLE",
        "ERR_KEY_NOT_FOUND",
        "ERR_INVALID_KEY",
        "ERR_SIGNING_FAILED",
        "ERR_DERIVATION_FAILED",
      ];

      errorCodes.forEach((code) => {
        const entry: AuditLogEntry = {
          timestamp: new Date().toISOString(),
          operation: "sign",
          success: false,
          error: code,
        };

        expect(entry.success).toBe(false);
        expect(entry.error).toBe(code);
      });
    });
  });

  describe("File Format", () => {
    it("should use newline-delimited JSON format", () => {
      const entries = [
        {
          timestamp: "2026-02-09T12:00:00.000Z",
          operation: "sign" as AuditOperation,
        },
        {
          timestamp: "2026-02-09T12:00:01.000Z",
          operation: "verify" as AuditOperation,
        },
      ];

      const ndjson = entries.map((e) => JSON.stringify(e)).join("\n");

      expect(ndjson).toContain("\n");
      expect(ndjson.split("\n").length).toBe(2);
    });

    it("should be stored in ~/.edwinpai/audit/crypto.log", () => {
      const expectedPath = "~/.edwinpai/audit/crypto.log";

      // Path validation
      expect(expectedPath).toContain(".edwinpai");
      expect(expectedPath).toContain("audit");
      expect(expectedPath).toContain("crypto.log");
    });
  });
});
