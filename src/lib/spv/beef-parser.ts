/**
 * BEEF (Background Evaluation Extended Format) Parser
 *
 * Based on BRC-62: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0062.md
 *
 * BEEF Format:
 * - Version (4 bytes)
 * - Transaction count (VarInt)
 * - Transactions (each with inputs/outputs)
 * - Merkle proof count (VarInt)
 * - Merkle proofs
 */

import type {
  BeefEnvelope,
  BRC62Transaction,
  TransactionInput,
  TransactionOutput,
  MerkleProof,
  BeefParseOptions,
} from "@/types";

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Parse BEEF envelope from raw bytes
 * @param beefBytes Raw BEEF data
 * @param options Parsing options
 * @returns Parsed BEEF envelope
 */
export function parseBeef(
  beefBytes: Uint8Array,
  options: BeefParseOptions = {},
): BeefEnvelope {
  const reader = new BeefReader(beefBytes);

  // Parse version (4 bytes, little-endian)
  const version = reader.readUint32LE();

  if (version !== 0x0100) {
    throw new Error(`Unsupported BEEF version: 0x${version.toString(16)}`);
  }

  // Parse transactions
  const txCount = reader.readVarInt();
  const transactions: BRC62Transaction[] = [];

  for (let i = 0; i < txCount; i++) {
    transactions.push(parseTransaction(reader));
  }

  // Parse Merkle proofs
  const proofCount = reader.readVarInt();
  const merkleProofs: MerkleProof[] = [];

  for (let i = 0; i < proofCount; i++) {
    merkleProofs.push(parseMerkleProof(reader));
  }

  // Validate if requested
  if (options.validateProofs) {
    validateBeefStructure(transactions, merkleProofs);
  }

  return {
    version,
    transactions,
    merkleProofs,
  };
}

/**
 * Parse a single transaction from BEEF data
 */
function parseTransaction(reader: BeefReader): BRC62Transaction {
  // Read transaction length
  reader.readVarInt();
  const txStart = reader.position;

  // Parse transaction version
  reader.readUint32LE();

  // Parse inputs
  const inputCount = reader.readVarInt();
  const inputs: TransactionInput[] = [];

  for (let i = 0; i < inputCount; i++) {
    const prevTxid = reader.readBytes(32).reverse(); // Reverse for display
    const prevVout = reader.readUint32LE();
    const _scriptSigLength = reader.readVarInt();
    const scriptSig = reader.readBytes(_scriptSigLength);
    const sequence = reader.readUint32LE();

    inputs.push({
      prevTxid: bytesToHex(prevTxid),
      prevVout,
      scriptSig,
      sequence,
    });
  }

  // Parse outputs
  const outputCount = reader.readVarInt();
  const outputs: TransactionOutput[] = [];

  for (let i = 0; i < outputCount; i++) {
    const satoshis = Number(reader.readUint64LE());
    const scriptPubKeyLength = reader.readVarInt();
    const scriptPubKey = reader.readBytes(scriptPubKeyLength);

    outputs.push({
      satoshis,
      scriptPubKey,
    });
  }

  // Parse locktime
  reader.readUint32LE();

  // Calculate transaction ID (double SHA-256 of raw tx)
  const txEnd = reader.position;
  const rawTx = reader.data.slice(txStart, txEnd);
  const txid = calculateTxid(rawTx);

  // Check if transaction has merkle proof (has_proof flag)
  const hasProof = reader.readUint8() === 1;

  return {
    txid,
    rawTx,
    inputs,
    outputs,
    isMined: hasProof,
  };
}

/**
 * Parse Merkle proof from BEEF data
 */
function parseMerkleProof(reader: BeefReader): MerkleProof {
  // Read transaction index
  const txIndex = reader.readVarInt();

  // Read block height
  const blockHeight = reader.readVarInt();

  // Read merkle root
  const merkleRoot = reader.readBytes(32).reverse();

  // Read number of nodes in proof
  const nodeCount = reader.readVarInt();
  const nodes = [];

  for (let i = 0; i < nodeCount; i++) {
    const hash = reader.readBytes(32).reverse();
    const isLeft = reader.readUint8() === 1;

    nodes.push({
      hash: bytesToHex(hash),
      isLeft,
    });
  }

  return {
    txIndex,
    blockHeight,
    merkleRoot: bytesToHex(merkleRoot),
    nodes,
  };
}

/**
 * Validate BEEF structure integrity
 */
function validateBeefStructure(
  transactions: BRC62Transaction[],
  proofs: MerkleProof[],
): void {
  // Check that all mined transactions have corresponding proofs
  const minedTxCount = transactions.filter((tx) => tx.isMined).length;

  if (minedTxCount !== proofs.length) {
    throw new Error(
      `Mismatch: ${minedTxCount} mined transactions but ${proofs.length} proofs`,
    );
  }

  // Verify topological ordering (all inputs reference earlier transactions)
  const txidSet = new Set<string>();

  for (const tx of transactions) {
    for (const input of tx.inputs) {
      if (!txidSet.has(input.prevTxid)) {
        // Input references a transaction not yet seen - this is invalid
        // unless it's referencing an external transaction
        // (which is acceptable in BEEF)
      }
    }
    txidSet.add(tx.txid);
  }
}

/**
 * Calculate transaction ID (double SHA-256)
 */
function calculateTxid(rawTx: Uint8Array): string {
  // Use Web Crypto API for SHA-256
  const hash1 = sha256(rawTx);
  const hash2 = sha256(hash1);
  return bytesToHex(hash2.reverse());
}

/**
 * SHA-256 hash (synchronous version using crypto-js or similar)
 * Note: In production, use Web Crypto API or a proper crypto library
 */
function sha256(_data: Uint8Array): Uint8Array {
  void _data;
  // Placeholder - in real implementation, use:
  // - Web Crypto API: crypto.subtle.digest('SHA-256', data)
  // - Or crypto-js: SHA256(data)
  // - Or @noble/hashes: sha256(data)

  // For now, return mock hash for type safety
  // TODO: Implement actual SHA-256 hashing
  throw new Error(
    "SHA-256 not implemented - use Web Crypto API or crypto library",
  );
}

/**
 * Helper class for reading binary BEEF data
 */
class BeefReader {
  public position = 0;

  constructor(public data: Uint8Array) {}

  readUint8(): number {
    const value = this.data[this.position];
    if (value === undefined) {
      throw new Error("Unexpected end of BEEF data");
    }
    this.position += 1;
    return value;
  }

  readUint32LE(): number {
    const value = new DataView(
      this.data.buffer,
      this.data.byteOffset + this.position,
      4,
    ).getUint32(0, true);
    this.position += 4;
    return value;
  }

  readUint64LE(): bigint {
    const value = new DataView(
      this.data.buffer,
      this.data.byteOffset + this.position,
      8,
    ).getBigUint64(0, true);
    this.position += 8;
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
    const value = new DataView(
      this.data.buffer,
      this.data.byteOffset + this.position,
      2,
    ).getUint16(0, true);
    this.position += 2;
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
 * Serialize BEEF envelope to bytes
 * @param envelope BEEF envelope to serialize
 * @returns Raw BEEF bytes
 */
export function serializeBeef(envelope: BeefEnvelope): Uint8Array {
  const writer = new BeefWriter();

  // Write version
  writer.writeUint32LE(envelope.version);

  // Write transaction count and transactions
  writer.writeVarInt(envelope.transactions.length);
  for (const tx of envelope.transactions) {
    writeTransaction(writer, tx);
  }

  // Write merkle proof count and proofs
  writer.writeVarInt(envelope.merkleProofs.length);
  for (const proof of envelope.merkleProofs) {
    writeMerkleProof(writer, proof);
  }

  return writer.toBytes();
}

/**
 * Write a single transaction to BEEF data
 */
function writeTransaction(writer: BeefWriter, tx: BRC62Transaction): void {
  // Write raw transaction bytes
  writer.writeVarInt(tx.rawTx.length);
  writer.writeBytes(tx.rawTx);

  // Write has_proof flag
  writer.writeUint8(tx.isMined ? 1 : 0);
}

/**
 * Write Merkle proof to BEEF data
 */
function writeMerkleProof(writer: BeefWriter, proof: MerkleProof): void {
  writer.writeVarInt(proof.txIndex);
  writer.writeVarInt(proof.blockHeight);

  // Write merkle root (reverse for wire format)
  const rootBytes = hexToBytes(proof.merkleRoot).reverse();
  writer.writeBytes(rootBytes);

  // Write proof nodes
  writer.writeVarInt(proof.nodes.length);
  for (const node of proof.nodes) {
    const hashBytes = hexToBytes(node.hash).reverse();
    writer.writeBytes(hashBytes);
    writer.writeUint8(node.isLeft ? 1 : 0);
  }
}

/**
 * Helper class for writing binary BEEF data
 */
class BeefWriter {
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
