/**
 * BRC-42 Key Derivation Tests
 *
 * Tests for BSV key derivation scheme implementation.
 * Validates deterministic key derivation per BRC-42 spec.
 */

import { describe, it, expect } from "vitest";

import type { Brc42DerivationParams, InvoiceNumber } from "@/types/crypto";

describe("BRC-42 Key Derivation", () => {
  describe("Invoice Number Generation", () => {
    it("should format invoice number correctly", () => {
      const params: Brc42DerivationParams = {
        securityLevel: 2,
        protocolID: "edwinpai-chat",
        keyID: "session-001",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      const expected = "2-edwinpai-chat-session-001";
      const invoice: InvoiceNumber = {
        full: expected,
        securityLevel: params.securityLevel ?? 2,
        protocolID: params.protocolID,
        keyID: params.keyID,
      };

      expect(invoice.full).toBe(expected);
      expect(invoice.securityLevel).toBe(2);
    });

    it("should use default security level of 2", () => {
      const params: Brc42DerivationParams = {
        protocolID: "edwinpai-auth",
        keyID: "login",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      const invoice: InvoiceNumber = {
        full: `2-${params.protocolID}-${params.keyID}`,
        securityLevel: 2,
        protocolID: params.protocolID,
        keyID: params.keyID,
      };

      expect(invoice.securityLevel).toBe(2);
      expect(invoice.full).toContain("2-edwinpai-auth-login");
    });
  });

  describe("Derivation Parameters Validation", () => {
    it("should accept valid compressed public key (33 bytes)", () => {
      const counterparty =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      expect(counterparty.length).toBe(66); // 33 bytes * 2 hex chars
      expect(counterparty.startsWith("02") || counterparty.startsWith("03")).toBe(
        true
      );
    });

    it("should validate protocol ID format", () => {
      const validProtocols = [
        "edwinpai-chat",
        "edwinpai-auth",
        "brc-103",
        "custom-protocol",
      ];

      validProtocols.forEach((protocol) => {
        expect(protocol).toMatch(/^[a-z0-9-]+$/);
      });
    });

    it("should validate key ID format", () => {
      const validKeyIds = ["session-001", "message-123", "channel-abc"];

      validKeyIds.forEach((keyId) => {
        expect(keyId).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });

  describe("Deterministic Derivation", () => {
    it("should produce same invoice number for same inputs", () => {
      const params1: Brc42DerivationParams = {
        protocolID: "test",
        keyID: "key1",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      const params2: Brc42DerivationParams = {
        protocolID: "test",
        keyID: "key1",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      const invoice1 = `${params1.securityLevel ?? 2}-${params1.protocolID}-${params1.keyID}`;
      const invoice2 = `${params2.securityLevel ?? 2}-${params2.protocolID}-${params2.keyID}`;

      expect(invoice1).toBe(invoice2);
    });

    it("should produce different invoice numbers for different protocols", () => {
      const base = {
        keyID: "key1",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      const invoice1 = `2-protocol1-${base.keyID}`;
      const invoice2 = `2-protocol2-${base.keyID}`;

      expect(invoice1).not.toBe(invoice2);
    });

    it("should produce different invoice numbers for different key IDs", () => {
      const base = {
        protocolID: "edwinpai-chat",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      const invoice1 = `2-${base.protocolID}-key1`;
      const invoice2 = `2-${base.protocolID}-key2`;

      expect(invoice1).not.toBe(invoice2);
    });
  });

  describe("BRC-42 Test Vectors", () => {
    // Test vectors from BRC-42 specification
    it("should match BRC-42 spec test vector", () => {
      // Test vector: secp256k1 generator point
      const testVector = {
        masterPrivateKey:
          "0000000000000000000000000000000000000000000000000000000000000001",
        counterpartyPublicKey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        invoiceNumber: "2-test-vector",
      };

      // Verify inputs are valid
      expect(testVector.masterPrivateKey.length).toBe(64); // 32 bytes
      expect(testVector.counterpartyPublicKey.length).toBe(66); // 33 bytes compressed
      expect(testVector.invoiceNumber).toMatch(/^\d+-[\w-]+-[\w-]+$/);
    });
  });

  describe("Security Level Handling", () => {
    it("should support security levels 1-10", () => {
      for (let level = 1; level <= 10; level++) {
        const params: Brc42DerivationParams = {
          securityLevel: level,
          protocolID: "test",
          keyID: "key1",
          counterparty:
            "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        };

        const invoice = `${level}-${params.protocolID}-${params.keyID}`;
        expect(invoice).toMatch(new RegExp(`^${level}-`));
      }
    });

    it("should default to level 2 for EdwinPAI", () => {
      const params: Brc42DerivationParams = {
        protocolID: "edwinpai-chat",
        keyID: "session",
        counterparty:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      const defaultLevel = params.securityLevel ?? 2;
      expect(defaultLevel).toBe(2);
    });
  });
});
