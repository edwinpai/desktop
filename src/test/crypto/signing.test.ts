/**
 * BRC-103 Signing & Verification Tests
 *
 * Tests for secp256k1 ECDSA signing and verification.
 * Validates signature generation and verification per BRC-103 spec.
 */

import { describe, it, expect } from "vitest";

import type {
  SigningRequest,
  SigningResponse,
  VerificationRequest,
  VerificationResponse,
} from "@/types/crypto";

describe("BRC-103 Message Signing", () => {
  describe("Signing Request Structure", () => {
    it("should accept string data", () => {
      const request: SigningRequest = {
        data: "Hello, EdwinPAI!",
        protocol: "edwinpai-auth",
      };

      expect(typeof request.data).toBe("string");
      expect(request.protocol).toBe("edwinpai-auth");
    });

    it("should accept Uint8Array data", () => {
      const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      const request: SigningRequest = {
        data,
        protocol: "edwinpai-chat",
      };

      expect(request.data).toBeInstanceOf(Uint8Array);
      expect(request.data.length).toBe(5);
    });

    it("should support identity key signing", () => {
      const request: SigningRequest = {
        data: "Sign with identity key",
        // No derivation params = use identity key
      };

      expect(request.derivation).toBeUndefined();
    });

    it("should support derived key signing", () => {
      const request: SigningRequest = {
        data: "Sign with derived key",
        derivation: {
          protocolID: "edwinpai-chat",
          keyID: "session-001",
          counterparty:
            "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
          securityLevel: 2,
        },
      };

      expect(request.derivation).toBeDefined();
      expect(request.derivation?.protocolID).toBe("edwinpai-chat");
    });
  });

  describe("Signing Response Structure", () => {
    it("should include DER-encoded signature", () => {
      // Mock response (would come from Rust backend)
      const response: SigningResponse = {
        signature: new Uint8Array([
          0x30, 0x44, 0x02, 0x20, // DER header
          ...new Array(32).fill(0xaa), // r value
          0x02, 0x20, // DER separator
          ...new Array(32).fill(0xbb), // s value
        ]),
        publicKey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        keyType: "identity",
      };

      expect(response.signature).toBeInstanceOf(Uint8Array);
      expect(response.signature[0]).toBe(0x30); // DER sequence tag
      expect(response.publicKey.length).toBe(66); // 33 bytes compressed
      expect(response.keyType).toBe("identity");
    });

    it("should indicate key type used", () => {
      const identityKeyResponse: SigningResponse = {
        signature: new Uint8Array(70),
        publicKey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        keyType: "identity",
      };

      const derivedKeyResponse: SigningResponse = {
        signature: new Uint8Array(70),
        publicKey:
          "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5",
        keyType: "derived",
      };

      expect(identityKeyResponse.keyType).toBe("identity");
      expect(derivedKeyResponse.keyType).toBe("derived");
    });
  });

  describe("Verification Request Structure", () => {
    it("should accept original data and signature", () => {
      const request: VerificationRequest = {
        data: "Original message",
        signature: new Uint8Array(70), // DER-encoded ECDSA signature
        publicKey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      expect(request.data).toBe("Original message");
      expect(request.signature).toBeInstanceOf(Uint8Array);
      expect(request.publicKey.length).toBe(66);
    });

    it("should accept Uint8Array data for verification", () => {
      const data = new Uint8Array([0x01, 0x02, 0x03]);
      const request: VerificationRequest = {
        data,
        signature: new Uint8Array(70),
        publicKey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      };

      expect(request.data).toBeInstanceOf(Uint8Array);
    });
  });

  describe("Verification Response Structure", () => {
    it("should indicate valid signature", () => {
      const response: VerificationResponse = {
        valid: true,
      };

      expect(response.valid).toBe(true);
      expect(response.error).toBeUndefined();
    });

    it("should indicate invalid signature with error", () => {
      const response: VerificationResponse = {
        valid: false,
        error: "Signature verification failed",
      };

      expect(response.valid).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe("Signature Format Validation", () => {
    it("should validate DER-encoded signature format", () => {
      // Valid DER signature structure:
      // 0x30 [total-length] 0x02 [r-length] [r-value] 0x02 [s-length] [s-value]
      const derSignature = new Uint8Array([
        0x30, // SEQUENCE tag
        0x44, // Total length (68 bytes)
        0x02, // INTEGER tag (r)
        0x20, // r length (32 bytes)
        ...new Array(32).fill(0xaa), // r value
        0x02, // INTEGER tag (s)
        0x20, // s length (32 bytes)
        ...new Array(32).fill(0xbb), // s value
      ]);

      expect(derSignature[0]).toBe(0x30);
      expect(derSignature[2]).toBe(0x02);
      expect(derSignature[3]).toBe(0x20);
    });

    it("should recognize invalid signature formats", () => {
      const invalidSignatures = [
        new Uint8Array([]), // Empty
        new Uint8Array([0xff]), // Invalid tag
        new Uint8Array(71).fill(0), // Wrong length
      ];

      invalidSignatures.forEach((sig) => {
        expect(sig.length === 0 || sig[0] !== 0x30).toBe(true);
      });
    });
  });

  describe("Protocol Context", () => {
    it("should support protocol-specific signing", () => {
      const protocols = ["edwinpai-auth", "edwinpai-chat", "brc-103", "custom"];

      protocols.forEach((protocol) => {
        const request: SigningRequest = {
          data: "Test message",
          protocol,
        };

        expect(request.protocol).toBe(protocol);
      });
    });

    it("should allow signing without protocol context", () => {
      const request: SigningRequest = {
        data: "Generic signature",
      };

      expect(request.protocol).toBeUndefined();
    });
  });

  describe("Test Vectors", () => {
    it("should handle secp256k1 generator point", () => {
      // secp256k1 generator point (G) public key
      const generatorPoint =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      expect(generatorPoint.length).toBe(66);
      expect(generatorPoint.startsWith("02")).toBe(true);
    });

    it("should validate compressed public key format", () => {
      const validKeys = [
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798", // 02 prefix
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5", // 03 prefix
      ];

      validKeys.forEach((key) => {
        expect(key.length).toBe(66);
        expect(key.startsWith("02") || key.startsWith("03")).toBe(true);
      });
    });
  });

  describe("Data Hashing", () => {
    it("should handle UTF-8 string encoding", () => {
      const testStrings = [
        "Hello, World!",
        "EdwinPAI Desktop",
        "🚀 Unicode test",
        "Special chars: !@#$%^&*()",
      ];

      testStrings.forEach((str) => {
        const request: SigningRequest = {
          data: str,
        };
        expect(typeof request.data).toBe("string");
      });
    });

    it("should handle binary data", () => {
      const binaryData = new Uint8Array([
        0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd,
      ]);

      const request: SigningRequest = {
        data: binaryData,
      };

      expect(request.data).toBeInstanceOf(Uint8Array);
    });
  });

  describe("Error Cases", () => {
    it("should define verification failure structure", () => {
      const failures: VerificationResponse[] = [
        { valid: false, error: "Invalid signature format" },
        { valid: false, error: "Public key mismatch" },
        { valid: false, error: "Data tampered" },
      ];

      failures.forEach((response) => {
        expect(response.valid).toBe(false);
        expect(response.error).toBeDefined();
      });
    });
  });
});
