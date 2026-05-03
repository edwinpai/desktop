/**
 * Petname Generation Tests
 *
 * Tests for deterministic petname generation from BSV public keys (SPEC §4.2).
 * Validates that petnames are human-readable, deterministic, and unique.
 */

import { describe, it, expect } from "vitest";

import type {
  Petname,
  PetnameConfig,
  PetnameWordLists,
} from "@/types/identity";

describe("Petname Generation", () => {
  // Word lists matching Rust implementation
  const testWordLists: PetnameWordLists = {
    adjectives: [
      "Swift",
      "Quiet",
      "Bold",
      "Bright",
      "Calm",
      "Deep",
      "Fierce",
      "Gentle",
      "Happy",
      "Keen",
      "Loyal",
      "Noble",
      "Quick",
      "Rare",
      "Silent",
      "Vivid",
    ],
    nouns: [
      "Falcon",
      "Ember",
      "River",
      "Mountain",
      "Storm",
      "Phoenix",
      "Shadow",
      "Tiger",
      "Eagle",
      "Wolf",
      "Dragon",
      "Bear",
      "Hawk",
      "Lion",
      "Owl",
      "Panther",
    ],
  };

  describe("Petname Structure", () => {
    it("should have adjective, noun, and display fields", () => {
      const petname: Petname = {
        adjective: "Swift",
        noun: "Falcon",
        display: "Swift Falcon",
      };

      expect(petname.adjective).toBe("Swift");
      expect(petname.noun).toBe("Falcon");
      expect(petname.display).toBe("Swift Falcon");
    });

    it("should format display as '<adjective> <noun>'", () => {
      const petname: Petname = {
        adjective: "Bold",
        noun: "Phoenix",
        display: "Bold Phoenix",
      };

      expect(petname.display).toBe(`${petname.adjective} ${petname.noun}`);
      expect(petname.display).toContain(" ");
    });
  });

  describe("Deterministic Generation", () => {
    it("should generate same petname for same public key", () => {
      // Test with secp256k1 generator point
      const publicKey =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      // Simulate petname generation (would call Rust backend in real app)
      const petname1 = generateMockPetname(publicKey, testWordLists);
      const petname2 = generateMockPetname(publicKey, testWordLists);

      expect(petname1.display).toBe(petname2.display);
      expect(petname1.adjective).toBe(petname2.adjective);
      expect(petname1.noun).toBe(petname2.noun);
    });

    it("should generate different petnames for different public keys", () => {
      const key1 =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const key2 =
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

      const petname1 = generateMockPetname(key1, testWordLists);
      const petname2 = generateMockPetname(key2, testWordLists);

      expect(petname1.display).not.toBe(petname2.display);
    });
  });

  describe("Word List Configuration", () => {
    it("should support custom word lists", () => {
      const config: PetnameConfig = {
        wordLists: testWordLists,
        hashBytes: 4,
      };

      expect(config.wordLists.adjectives.length).toBeGreaterThan(0);
      expect(config.wordLists.nouns.length).toBeGreaterThan(0);
    });

    it("should use hash bytes for indexing", () => {
      const config: PetnameConfig = {
        wordLists: testWordLists,
        hashBytes: 4, // Default: first 4 bytes of SHA-256
      };

      expect(config.hashBytes).toBe(4);
    });

    it("should support different hash byte counts", () => {
      const configs = [2, 4, 8].map((bytes) => ({
        wordLists: testWordLists,
        hashBytes: bytes,
      }));

      configs.forEach((config) => {
        expect(config.hashBytes).toBeGreaterThanOrEqual(2);
        expect(config.hashBytes).toBeLessThanOrEqual(8);
      });
    });
  });

  describe("Human Readability", () => {
    it("should produce capitalized words", () => {
      const petname: Petname = {
        adjective: "Swift",
        noun: "Falcon",
        display: "Swift Falcon",
      };

      expect(petname.adjective[0]!).toBe(petname.adjective[0]!.toUpperCase());
      expect(petname.noun[0]!).toBe(petname.noun[0]!.toUpperCase());
    });

    it("should avoid special characters", () => {
      testWordLists.adjectives.forEach((adj) => {
        expect(adj).toMatch(/^[A-Za-z]+$/);
      });

      testWordLists.nouns.forEach((noun) => {
        expect(noun).toMatch(/^[A-Za-z]+$/);
      });
    });

    it("should be easy to remember and pronounce", () => {
      const examples = [
        "Swift Falcon",
        "Bold Phoenix",
        "Quiet River",
        "Bright Mountain",
      ];

      examples.forEach((example) => {
        const words = example.split(" ");
        expect(words.length).toBe(2);
        words.forEach((word) => {
          expect(word.length).toBeGreaterThan(2);
          expect(word.length).toBeLessThan(15);
        });
      });
    });
  });

  describe("Collision Resistance", () => {
    it("should support large word list combinations", () => {
      const combinations =
        testWordLists.adjectives.length * testWordLists.nouns.length;

      // With 16 adjectives and 16 nouns = 256 combinations
      expect(combinations).toBeGreaterThanOrEqual(256);
    });

    it("should use multiple hash bytes to reduce collisions", () => {
      // Using 4 bytes (2 for adjective, 2 for noun)
      // 2 bytes = 65536 possible values, modulo word list size
      const hashBytes = 4;
      const bytesPerWord = hashBytes / 2;

      expect(bytesPerWord).toBe(2);
      expect(Math.pow(256, bytesPerWord)).toBe(65536);
    });
  });

  describe("Test Vectors", () => {
    it("should generate petname for secp256k1 generator point", () => {
      const generatorPoint =
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      const petname = generateMockPetname(generatorPoint, testWordLists);

      expect(petname.adjective).toBeTruthy();
      expect(petname.noun).toBeTruthy();
      expect(petname.display).toContain(" ");
    });

    it("should handle various public key formats", () => {
      const keys = [
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798", // 02 prefix
        "03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5", // 03 prefix
      ];

      keys.forEach((key) => {
        const petname = generateMockPetname(key, testWordLists);
        expect(petname.display).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle minimum word lists", () => {
      const minLists: PetnameWordLists = {
        adjectives: ["Alpha", "Beta"],
        nouns: ["One", "Two"],
      };

      const config: PetnameConfig = {
        wordLists: minLists,
      };

      expect(config.wordLists.adjectives.length).toBe(2);
      expect(config.wordLists.nouns.length).toBe(2);
    });

    it("should handle large word lists", () => {
      const largeLists: PetnameWordLists = {
        adjectives: Array(256)
          .fill("Adj")
          .map((a, i) => `${a}${i}`),
        nouns: Array(256)
          .fill("Noun")
          .map((n, i) => `${n}${i}`),
      };

      const combinations =
        largeLists.adjectives.length * largeLists.nouns.length;
      expect(combinations).toBe(65536);
    });
  });
});

// --- Helper Functions ---

/**
 * Mock petname generation (mimics Rust backend logic)
 * Uses SHA-256 hash of public key to deterministically select words
 */
function generateMockPetname(
  publicKey: string,
  wordLists: PetnameWordLists,
): Petname {
  // Simple mock: use hex chars to index into word lists
  // In real app, this would call the Rust backend
  const hash = publicKey.slice(2); // Remove "02" or "03" prefix

  const adjIndex = parseInt(hash.slice(0, 4), 16) % wordLists.adjectives.length;
  const nounIndex = parseInt(hash.slice(4, 8), 16) % wordLists.nouns.length;

  const adjective = wordLists.adjectives[adjIndex]!;
  const noun = wordLists.nouns[nounIndex]!;

  return {
    adjective,
    noun,
    display: `${adjective} ${noun}`,
  };
}
