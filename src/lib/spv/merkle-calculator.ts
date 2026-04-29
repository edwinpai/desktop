/**
 * Merkle Root Calculator and Verifier
 *
 * Implements Bitcoin's Merkle tree algorithm for SPV verification.
 * Based on BRC-67: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0067.md
 *
 * Merkle trees allow efficient proof of transaction inclusion in a block
 * by providing only the hashes along the path from transaction to root.
 */

import type { MerkleProof, MerkleProofNode, BlockHeader } from '@/types';

/**
 * Calculate Merkle root from a transaction hash and proof path
 * @param txHash Transaction hash (hex string)
 * @param proof Merkle proof containing path to root
 * @returns Calculated Merkle root (hex string)
 */
export function calculateMerkleRoot(
  txHash: string,
  proof: MerkleProof
): string {
  // Start with transaction hash
  let currentHash = txHash;

  // Walk up the Merkle tree, combining with proof nodes
  for (const node of proof.nodes) {
    if (node.isLeft) {
      // Node hash goes on the left, current hash on the right
      currentHash = hashPair(node.hash, currentHash);
    } else {
      // Current hash goes on the left, node hash on the right
      currentHash = hashPair(currentHash, node.hash);
    }
  }

  return currentHash;
}

/**
 * Verify that a transaction is included in a block using Merkle proof
 * @param txHash Transaction hash to verify
 * @param proof Merkle proof
 * @param expectedRoot Expected Merkle root from block header
 * @returns True if proof is valid
 */
export function verifyMerkleProof(
  txHash: string,
  proof: MerkleProof,
  expectedRoot: string
): boolean {
  const calculatedRoot = calculateMerkleRoot(txHash, proof);
  return calculatedRoot.toLowerCase() === expectedRoot.toLowerCase();
}

/**
 * Verify Merkle proof against block header
 * @param txHash Transaction hash
 * @param proof Merkle proof
 * @param blockHeader Block header containing Merkle root
 * @returns True if proof is valid
 */
export function verifyMerkleProofWithHeader(
  txHash: string,
  proof: MerkleProof,
  blockHeader: BlockHeader
): boolean {
  // Check block height matches
  if (proof.blockHeight !== blockHeader.height) {
    return false;
  }

  // Verify Merkle root
  return verifyMerkleProof(txHash, proof, blockHeader.merkleRoot);
}

/**
 * Build complete Merkle tree from transaction IDs
 * @param txids Array of transaction IDs (hex strings)
 * @returns Merkle root hash
 */
export function buildMerkleTree(txids: string[]): string {
  if (txids.length === 0) {
    throw new Error('Cannot build Merkle tree from empty transaction list');
  }

  // Create leaf level (transaction hashes)
  let level = txids.slice();

  // Build tree level by level until we reach the root
  while (level.length > 1) {
    const nextLevel: string[] = [];

    // Process pairs
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        // Hash pair of nodes
        const left = level[i];
        const right = level[i + 1];
        if (!left || !right) {
          throw new Error('Invalid Merkle tree level');
        }
        nextLevel.push(hashPair(left, right));
      } else {
        // Odd number of nodes - duplicate the last one (Bitcoin convention)
        const last = level[i];
        if (!last) {
          throw new Error('Invalid Merkle tree level');
        }
        nextLevel.push(hashPair(last, last));
      }
    }

    level = nextLevel;
  }

  const root = level[0];
  if (!root) {
    throw new Error('Failed to compute Merkle root');
  }
  return root;
}

/**
 * Generate Merkle proof for a transaction at given index
 * @param txids Array of all transaction IDs in block
 * @param txIndex Index of transaction to prove
 * @returns Merkle proof path
 */
export function generateMerkleProof(
  txids: string[],
  txIndex: number
): MerkleProofNode[] {
  if (txIndex < 0 || txIndex >= txids.length) {
    throw new Error(`Invalid transaction index: ${txIndex}`);
  }

  const proof: MerkleProofNode[] = [];
  let level = txids.slice();
  let currentIndex = txIndex;

  while (level.length > 1) {
    const nextLevel: string[] = [];
    const isLeft = currentIndex % 2 === 1;

    // Find sibling node
    let siblingIndex: number;
    if (isLeft) {
      siblingIndex = currentIndex - 1;
    } else {
      siblingIndex = currentIndex + 1;
      if (siblingIndex >= level.length) {
        // Odd number of nodes - sibling is duplicate of current
        siblingIndex = currentIndex;
      }
    }

    proof.push({
      hash: (() => {
        const siblingHash = level[siblingIndex];
        if (!siblingHash) {
          throw new Error('Invalid sibling hash in Merkle proof generation');
        }
        return siblingHash;
      })(),
      isLeft,
    });

    // Build next level
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        const left = level[i];
        const right = level[i + 1];
        if (!left || !right) {
          throw new Error('Invalid Merkle tree level');
        }
        nextLevel.push(hashPair(left, right));
      } else {
        const last = level[i];
        if (!last) {
          throw new Error('Invalid Merkle tree level');
        }
        nextLevel.push(hashPair(last, last));
      }
    }

    level = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
}

/**
 * Calculate tree height from number of transactions
 * @param txCount Number of transactions
 * @returns Tree height (number of levels)
 */
export function calculateTreeHeight(txCount: number): number {
  if (txCount === 0) return 0;
  return Math.ceil(Math.log2(txCount));
}

/**
 * Validate Merkle proof structure
 * @param proof Merkle proof to validate
 * @returns True if proof structure is valid
 */
export function validateMerkleProofStructure(proof: MerkleProof): boolean {
  // Check required fields
  if (proof.txIndex < 0) return false;
  if (proof.blockHeight < 0) return false;
  if (!proof.merkleRoot || proof.merkleRoot.length !== 64) return false;

  // Validate nodes
  if (!Array.isArray(proof.nodes) || proof.nodes.length === 0) return false;

  for (const node of proof.nodes) {
    // Each node must have a valid 32-byte hash (64 hex chars)
    if (!node.hash || node.hash.length !== 64) return false;

    // Hash must be valid hex
    if (!/^[0-9a-fA-F]{64}$/.test(node.hash)) return false;

    // isLeft must be boolean
    if (typeof node.isLeft !== 'boolean') return false;
  }

  // Tree height should be reasonable (max ~30 for billions of txs)
  if (proof.nodes.length > 40) return false;

  return true;
}

/**
 * Hash a pair of Merkle nodes (Bitcoin double-SHA256)
 * @param left Left node hash (hex)
 * @param right Right node hash (hex)
 * @returns Combined hash (hex)
 */
function hashPair(left: string, right: string): string {
  // Convert hex to bytes
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);

  // Concatenate left + right
  const combined = new Uint8Array(64);
  combined.set(leftBytes, 0);
  combined.set(rightBytes, 32);

  // Double SHA-256
  const hash1 = sha256(combined);
  const hash2 = sha256(hash1);

  return bytesToHex(hash2);
}

/**
 * SHA-256 hash function
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
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }

  // Ensure even length
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }

  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculate number of confirmations from block height
 * @param txBlockHeight Block height of transaction
 * @param currentBlockHeight Current blockchain tip height
 * @returns Number of confirmations
 */
export function calculateConfirmations(
  txBlockHeight: number,
  currentBlockHeight: number
): number {
  if (txBlockHeight > currentBlockHeight) {
    return 0; // Transaction in future block (shouldn't happen)
  }

  return currentBlockHeight - txBlockHeight + 1;
}

/**
 * Estimate transaction position in block from Merkle proof depth
 * @param proof Merkle proof
 * @returns Estimated block position (0-1, where 0 is start and 1 is end)
 */
export function estimateBlockPosition(proof: MerkleProof): number {
  if (proof.txCount) {
    return proof.txIndex / proof.txCount;
  }

  // Estimate from tree height if txCount not available
  const maxIndex = Math.pow(2, proof.nodes.length);
  return proof.txIndex / maxIndex;
}
