/**
 * Identity types (SPEC §4.2)
 *
 * Human-readable identity derived from BSV public key.
 */

// --- Petname Generation (Phase 1) ---

export interface Petname {
  adjective: string;
  noun: string;
  /** Combined display format: "<adjective> <noun>" */
  display: string;
}

export interface PetnameWordLists {
  adjectives: string[];
  nouns: string[];
}

export interface PetnameConfig {
  /** Word lists for petname generation */
  wordLists: PetnameWordLists;

  /** Number of bytes from hash to use for indexing (default: 4) */
  hashBytes?: number;
}

// --- Identicon Generation (Phase 1) ---

export interface IdenticonConfig {
  /** Size in pixels (default: 64) */
  size?: number;

  /** Background color (hex, default: transparent) */
  backgroundColor?: string;

  /** Foreground colors palette (default: auto-generated) */
  foregroundColors?: string[];

  /** Number of grid cells (default: 8x8) */
  gridSize?: number;

  /** Style: "blocks", "circles", "triangles" (default: "blocks") */
  style?: "blocks" | "circles" | "triangles";
}

export interface IdenticonResult {
  /** SVG markup */
  svg: string;

  /** Data URI for direct use in img src */
  dataUri: string;

  /** Public key this identicon represents */
  publicKey: string;
}

// --- BSV Identity (Phase 0 + Phase 1 extensions) ---

export interface Identity {
  /** Compressed public key (33 bytes, 66 hex chars) */
  publicKey: string;

  /** Deterministic human-readable name, e.g. "Swift Falcon" */
  petname: string;

  /** Deterministic visual hash (SVG identicon) from public key */
  avatarSvg: string;

  /** Short ID: edw:<first 8 hex chars of SHA-256(publicKey)> */
  shortId: string;
}

export interface IdentityDisplay {
  petname: string;
  avatarSvg: string;
  shortId: string;
}

// --- BRC-42 Derivation Context (Phase 1) ---

export interface Brc42Context {
  /** Security level (2 for EdwinPAI) */
  securityLevel: number;

  /** Protocol ID */
  protocolID: string;

  /** Key ID (context-specific) */
  keyID: string;

  /** Invoice number: "<securityLevel>-<protocolID>-<keyID>" */
  invoiceNumber: string;
}

export interface DerivedIdentity extends Identity {
  /** BRC-42 derivation context */
  derivation: Brc42Context;

  /** Counterparty public key (for ECDH) */
  counterparty: string;
}

// --- Identity Generation Result (Phase 1) ---

/**
 * Complete result from identity generation operation.
 * Combines all identity components: key, petname, identicon, and metadata.
 */
export interface IdentityGenerationResult {
  /** Generated or imported identity */
  identity: Identity;

  /** Petname components */
  petname: Petname;

  /** Identicon details */
  identicon: IdenticonResult;

  /** Whether this was generated (true) or imported (false) */
  wasGenerated: boolean;

  /** Timestamp when identity was created/imported (ISO 8601) */
  createdAt: string;

  /** Optional: BIP-39 recovery phrase (only for newly generated keys) */
  recoveryPhrase?: string[];
}
