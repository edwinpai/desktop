/**
 * BUMP (Bitcoin Unified Merkle Path) Parser
 *
 * Based on BRC-71: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0071.md
 *
 * BUMP is a compact binary format for Merkle proofs that proves transaction inclusion
 * in a block without requiring the full block data.
 *
 * Format:
 * - Block height (VarInt)
 * - Tree height (1 byte)
 * - Transaction index (VarInt)
 * - Flags (bit array indicating left/right path)
 * - Hashes (32 bytes each, only for non-computed nodes)
 */

import type { MerkleProof, MerkleProofNode, BlockHeader } from '@/types';

/**
 * Parse BUMP (Binary Unified Merkle Path) format
 * @param bumpBytes Raw BUMP data
 * @returns Parsed Merkle proof
 */
export function parseBump(bumpBytes: Uint8Array): MerkleProof {
  const reader = new BumpReader(bumpBytes);

  // Read block height
  const blockHeight = reader.readVarInt();

  // Read tree height (number of levels in Merkle tree)
  const treeHeight = reader.readUint8();

  // Read transaction index
  const txIndex = reader.readVarInt();

  // Read flags (bit array for path direction)
  const flagsLength = Math.ceil(treeHeight / 8);
  const flags = reader.readBytes(flagsLength);

  // Parse Merkle path nodes
  const nodes: MerkleProofNode[] = [];

  for (let level = 0; level < treeHeight; level++) {
    const byteIndex = Math.floor(level / 8);
    const bitIndex = level % 8;
    const flagByte = flags[byteIndex] ?? 0;
    const isLeft = ((flagByte >> bitIndex) & 1) === 1;

    // Read the hash for this level (32 bytes)
    const hash = reader.readBytes(32).reverse(); // Reverse for display

    nodes.push({
      hash: Buffer.from(hash).toString('hex'),
      isLeft,
    });
  }

  // Merkle root is computed from the path, not stored in BUMP
  // It will be calculated during verification
  return {
    txIndex,
    blockHeight,
    merkleRoot: '', // Will be computed during verification
    nodes,
  };
}

/**
 * Serialize Merkle proof to BUMP format
 * @param proof Merkle proof
 * @returns Raw BUMP bytes
 */
export function serializeBump(proof: MerkleProof): Uint8Array {
  const writer = new BumpWriter();

  // Write block height
  writer.writeVarInt(proof.blockHeight);

  // Write tree height
  writer.writeUint8(proof.nodes.length);

  // Write transaction index
  writer.writeVarInt(proof.txIndex);

  // Write flags (bit array for path direction)
  const flagsLength = Math.ceil(proof.nodes.length / 8);
  const flags = new Uint8Array(flagsLength);

  for (let i = 0; i < proof.nodes.length; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;

    const node = proof.nodes[i];
    if (node?.isLeft) {
      flags[byteIndex] = (flags[byteIndex] ?? 0) | (1 << bitIndex);
    }
  }

  writer.writeBytes(flags);

  // Write hashes (reverse for wire format)
  for (const node of proof.nodes) {
    const hashBytes = Buffer.from(node.hash, 'hex').reverse();
    writer.writeBytes(hashBytes);
  }

  return writer.toBytes();
}

/**
 * Parse block header from raw bytes (80 bytes)
 * @param headerBytes Raw block header data
 * @returns Parsed block header
 */
export function parseBlockHeader(headerBytes: Uint8Array): BlockHeader {
  if (headerBytes.length !== 80) {
    throw new Error(`Invalid block header length: ${headerBytes.length} (expected 80)`);
  }

  const reader = new BumpReader(headerBytes);

  // Parse version (4 bytes)
  const version = reader.readUint32LE();

  // Parse previous block hash (32 bytes)
  const prevHash = reader.readBytes(32).reverse();

  // Parse merkle root (32 bytes)
  const merkleRoot = reader.readBytes(32).reverse();

  // Parse timestamp (4 bytes)
  const timestamp = reader.readUint32LE();

  // Parse bits (difficulty target, 4 bytes)
  const bits = reader.readUint32LE();

  // Parse nonce (4 bytes)
  const nonce = reader.readUint32LE();

  // Calculate block hash (double SHA-256 of header)
  const hash = calculateBlockHash(headerBytes);

  return {
    height: 0, // Height not included in header, must be provided separately
    hash,
    version,
    prevHash: Buffer.from(prevHash).toString('hex'),
    merkleRoot: Buffer.from(merkleRoot).toString('hex'),
    timestamp,
    bits,
    nonce,
  };
}

/**
 * Serialize block header to raw bytes
 * @param header Block header
 * @returns Raw header bytes (80 bytes)
 */
export function serializeBlockHeader(header: BlockHeader): Uint8Array {
  const writer = new BumpWriter();

  // Write version
  writer.writeUint32LE(header.version);

  // Write previous block hash (reverse for wire format)
  const prevHashBytes = Buffer.from(header.prevHash, 'hex').reverse();
  writer.writeBytes(prevHashBytes);

  // Write merkle root (reverse for wire format)
  const merkleRootBytes = Buffer.from(header.merkleRoot, 'hex').reverse();
  writer.writeBytes(merkleRootBytes);

  // Write timestamp
  writer.writeUint32LE(header.timestamp);

  // Write bits
  writer.writeUint32LE(header.bits);

  // Write nonce
  writer.writeUint32LE(header.nonce);

  return writer.toBytes();
}

/**
 * Calculate block hash (double SHA-256 of header)
 */
function calculateBlockHash(headerBytes: Uint8Array): string {
  // Use Web Crypto API for SHA-256
  const hash1 = sha256(headerBytes);
  const hash2 = sha256(hash1);
  return Buffer.from(hash2).reverse().toString('hex');
}

/**
 * SHA-256 hash (synchronous version)
 * Note: In production, use Web Crypto API or a proper crypto library
 */
function sha256(_data: Uint8Array): Uint8Array {
  void _data;
  // Placeholder - in real implementation, use:
  // - Web Crypto API: crypto.subtle.digest('SHA-256', data)
  // - Or @noble/hashes: sha256(data)

  // For now, throw error - implementation required
  throw new Error('SHA-256 not implemented - use Web Crypto API or crypto library');
}

/**
 * Validate block header proof-of-work
 * @param header Block header to validate
 * @param targetBits Difficulty target bits
 * @returns True if header meets difficulty target
 */
export function validateBlockHeaderPoW(header: BlockHeader): boolean {
  // Calculate target from bits (compact representation)
  const target = calculateTargetFromBits(header.bits);

  // Block hash must be less than target
  const hashValue = BigInt('0x' + header.hash);

  return hashValue < target;
}

/**
 * Calculate difficulty target from compact bits representation
 */
function calculateTargetFromBits(bits: number): bigint {
  const exponent = bits >> 24;
  const mantissa = bits & 0xffffff;

  if (exponent <= 3) {
    return BigInt(mantissa) >> BigInt(8 * (3 - exponent));
  } else {
    return BigInt(mantissa) << BigInt(8 * (exponent - 3));
  }
}

/**
 * Helper class for reading binary BUMP data
 */
class BumpReader {
  public position = 0;

  constructor(public data: Uint8Array) {}

  readUint8(): number {
    const value = this.data[this.position];
    if (value === undefined) {
      throw new Error('Unexpected end of BUMP data');
    }
    this.position += 1;
    return value;
  }

  readUint32LE(): number {
    const value = new DataView(this.data.buffer, this.data.byteOffset + this.position, 4)
      .getUint32(0, true);
    this.position += 4;
    return value;
  }

  readVarInt(): number {
    const first = this.readUint8();

    if (first < 0xfd) {
      return first;
    } else if (first === 0xfd) {
      return this.readUint16LE();
    } else if (first === 0xfe) {
      return this.readUint32LE();
    } else {
      // 0xff - 64-bit (not commonly used)
      return Number(this.readUint64LE());
    }
  }

  readUint16LE(): number {
    const value = new DataView(this.data.buffer, this.data.byteOffset + this.position, 2)
      .getUint16(0, true);
    this.position += 2;
    return value;
  }

  readUint64LE(): bigint {
    const value = new DataView(this.data.buffer, this.data.byteOffset + this.position, 8)
      .getBigUint64(0, true);
    this.position += 8;
    return value;
  }

  readBytes(length: number): Uint8Array {
    const bytes = this.data.slice(this.position, this.position + length);
    this.position += length;
    return bytes;
  }

  hasMore(): boolean {
    return this.position < this.data.length;
  }
}

/**
 * Helper class for writing binary BUMP data
 */
class BumpWriter {
  private buffers: Uint8Array[] = [];

  writeUint8(value: number): void {
    this.buffers.push(new Uint8Array([value]));
  }

  writeUint32LE(value: number): void {
    const buffer = new Uint8Array(4);
    new DataView(buffer.buffer).setUint32(0, value, true);
    this.buffers.push(buffer);
  }

  writeVarInt(value: number): void {
    if (value < 0xfd) {
      this.writeUint8(value);
    } else if (value <= 0xffff) {
      this.writeUint8(0xfd);
      this.writeUint16LE(value);
    } else if (value <= 0xffffffff) {
      this.writeUint8(0xfe);
      this.writeUint32LE(value);
    } else {
      this.writeUint8(0xff);
      this.writeUint64LE(BigInt(value));
    }
  }

  writeUint16LE(value: number): void {
    const buffer = new Uint8Array(2);
    new DataView(buffer.buffer).setUint16(0, value, true);
    this.buffers.push(buffer);
  }

  writeUint64LE(value: bigint): void {
    const buffer = new Uint8Array(8);
    new DataView(buffer.buffer).setBigUint64(0, value, true);
    this.buffers.push(buffer);
  }

  writeBytes(bytes: Uint8Array): void {
    this.buffers.push(bytes);
  }

  toBytes(): Uint8Array {
    const totalLength = this.buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of this.buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }

    return result;
  }
}
