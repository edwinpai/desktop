/**
 * BSV Identity utilities (SPEC §4.2)
 *
 * Generates human-readable identities from BSV public keys:
 * - Petname: deterministic adjective-noun combination
 * - Avatar: deterministic identicon/visual hash
 * - Short ID: edw:<first 8 hex chars of hash>
 */

import { getPetnameFromIndices, WORDLISTS } from "./petname-wordlists";
import { generateIdenticon } from "./identicon-generator";

import type { Identity, Petname } from "@/types/identity";

/**
 * Generate SHA-256 hash from a hex public key
 */
async function sha256(publicKeyHex: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKeyHex);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

/**
 * Synchronous hash for petname generation (fallback)
 */
function sha256Sync(publicKeyHex: string): Uint8Array {
  // This is a simple fallback - in production, use crypto.subtle or a proper implementation
  let hash = 0;
  for (let i = 0; i < publicKeyHex.length; i++) {
    hash = (hash << 5) - hash + publicKeyHex.charCodeAt(i);
    hash = hash & hash;
  }

  const result = new Uint8Array(32);
  let currentHash = hash;
  for (let i = 0; i < 32; i++) {
    currentHash = (currentHash * 1103515245 + 12345) & 0x7fffffff;
    result[i] = (currentHash >> 16) & 0xff;
  }

  return result;
}

/**
 * Generate a deterministic petname from a public key
 * Uses first 4 bytes of SHA-256(publicKey) to index into word lists
 */
export async function generatePetname(publicKey: string): Promise<Petname> {
  const hash = await sha256(publicKey);

  // Use first 2 bytes for adjective index (0-255)
  const adjectiveIndex = hash[0];
  if (adjectiveIndex === undefined) {
    throw new Error("Invalid hash: missing adjective index");
  }

  // Use next 2 bytes for noun index (0-255)
  const nounIndex = hash[1];
  if (nounIndex === undefined) {
    throw new Error("Invalid hash: missing noun index");
  }

  const result = getPetnameFromIndices(adjectiveIndex, nounIndex);

  return {
    adjective: result.adjective,
    noun: result.noun,
    display: result.display,
  };
}

/**
 * Synchronous petname generation (for testing/fallback)
 */
export function generatePetnameSync(publicKey: string): Petname {
  const hash = sha256Sync(publicKey);

  const adjectiveIndex = hash[0];
  if (adjectiveIndex === undefined) {
    throw new Error("Invalid hash: missing adjective index");
  }

  const nounIndex = hash[1];
  if (nounIndex === undefined) {
    throw new Error("Invalid hash: missing noun index");
  }

  const result = getPetnameFromIndices(adjectiveIndex, nounIndex);

  return {
    adjective: result.adjective,
    noun: result.noun,
    display: result.display,
  };
}

/**
 * Generate a short ID from a public key
 * Format: edw:<first 8 hex chars of SHA-256(publicKey)>
 */
export async function generateShortId(publicKey: string): Promise<string> {
  const hash = await sha256(publicKey);

  // Convert first 4 bytes to hex
  const hexChars = Array.from(hash.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `edw:${hexChars}`;
}

/**
 * Synchronous short ID generation
 */
export function generateShortIdSync(publicKey: string): string {
  const hash = sha256Sync(publicKey);

  const hexChars = Array.from(hash.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `edw:${hexChars}`;
}

/**
 * Generate a complete BSV identity from a public key
 */
export async function generateIdentity(publicKey: string): Promise<Identity> {
  const [petname, identiconResult, shortId] = await Promise.all([
    generatePetname(publicKey),
    generateIdenticon(publicKey, { size: 64 }),
    generateShortId(publicKey),
  ]);

  return {
    publicKey,
    petname: petname.display,
    avatarSvg: identiconResult.svg,
    shortId,
  };
}

/**
 * Validate a BSV public key format
 * Compressed public key should be 66 hex characters (33 bytes)
 */
export function isValidPublicKey(publicKey: string): boolean {
  // Compressed public key: 33 bytes = 66 hex chars
  if (publicKey.length !== 66) {
    return false;
  }

  // Must start with 02 or 03 (compressed key prefix)
  if (!publicKey.startsWith("02") && !publicKey.startsWith("03")) {
    return false;
  }

  // Must be valid hex
  return /^[0-9a-fA-F]+$/.test(publicKey);
}

/**
 * Get word lists for petname generation
 */
export function getPetnameWordLists() {
  return WORDLISTS;
}

/**
 * Get a random petname (for testing/preview)
 */
export function getRandomPetname(): Petname {
  const adjectiveIndex = Math.floor(Math.random() * 256);
  const nounIndex = Math.floor(Math.random() * 256);

  return {
    ...getPetnameFromIndices(adjectiveIndex, nounIndex),
  };
}
