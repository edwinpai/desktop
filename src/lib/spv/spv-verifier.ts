/**
 * SPV (Simplified Payment Verification) Verifier Orchestrator
 *
 * Coordinates BEEF parsing, BUMP parsing, and Merkle proof verification
 * to provide complete SPV validation for Bitcoin transactions.
 *
 * Based on:
 * - BRC-62 (BEEF): https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0062.md
 * - BRC-67 (SPV): https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0067.md
 * - BRC-71 (BUMP): https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0071.md
 */

import { parseBeef } from "./beef-parser";
import {
  parseBlockHeader,
  parseBump,
  validateBlockHeaderPoW,
} from "./bump-parser";
import {
  calculateConfirmations,
  validateMerkleProofStructure,
  verifyMerkleProof,
  verifyMerkleProofWithHeader,
} from "./merkle-calculator";

import type {
  BeefParseOptions,
  BlockHeader,
  BRC62Transaction,
  MerkleProof,
  SpvVerification,
} from "@/types";

/**
 * SPV verification options
 */
export interface SpvVerificationOptions {
  /** Whether to validate block header proof-of-work */
  validatePoW?: boolean;
  /** Whether to require minimum confirmations */
  minConfirmations?: number;
  /** Current blockchain tip height (for confirmation calculation) */
  currentBlockHeight?: number;
  /** Whether to use cached proofs */
  allowCached?: boolean;
}

/**
 * SPV verification result with detailed information
 */
export interface SpvVerificationResult extends SpvVerification {
  /** Verified transaction data */
  transaction?: BRC62Transaction;
  /** Block header used for verification */
  blockHeader?: BlockHeader;
  /** Merkle proof used */
  merkleProof?: MerkleProof;
  /** Verification timestamp */
  verifiedAt: string;
}

/**
 * Main SPV verifier class
 * Orchestrates parsing and verification of SPV proofs
 */
export class SpvVerifier {
  constructor(private options: SpvVerificationOptions = {}) {}

  /**
   * Verify a transaction using BEEF envelope
   * @param beefBytes Raw BEEF data
   * @param txid Transaction ID to verify
   * @returns Verification result
   */
  async verifyBeef(
    beefBytes: Uint8Array,
    txid: string,
  ): Promise<SpvVerificationResult> {
    try {
      // Parse BEEF envelope
      const parseOptions: BeefParseOptions = {
        validateProofs: true,
      };

      const beef = parseBeef(beefBytes, parseOptions);

      // Find transaction in BEEF
      const transaction = beef.transactions.find((tx) => tx.txid === txid);

      if (!transaction) {
        return this.createErrorResult(
          txid,
          `Transaction ${txid} not found in BEEF envelope`,
        );
      }

      // Verify transaction has proof
      if (!transaction.isMined || !transaction.proof) {
        return this.createErrorResult(
          txid,
          "Transaction does not have Merkle proof (not mined)",
        );
      }

      // Get corresponding merkle proof
      const proof = transaction.proof;

      // Validate proof structure
      if (!validateMerkleProofStructure(proof)) {
        return this.createErrorResult(txid, "Invalid Merkle proof structure");
      }

      // Get block header from BEEF (if available)
      const blockHeader = beef.blockHeaders?.find(
        (header) => header.height === proof.blockHeight,
      );

      if (!blockHeader) {
        return this.createErrorResult(
          txid,
          "Block header not found in BEEF envelope",
        );
      }

      // Verify Merkle proof against block header
      const proofValid = verifyMerkleProofWithHeader(txid, proof, blockHeader);

      if (!proofValid) {
        return this.createErrorResult(txid, "Merkle proof verification failed");
      }

      // Validate block header PoW if requested
      if (this.options.validatePoW) {
        if (!validateBlockHeaderPoW(blockHeader)) {
          return this.createErrorResult(
            txid,
            "Block header PoW validation failed",
          );
        }
      }

      // Calculate confirmations
      const confirmations = this.options.currentBlockHeight
        ? calculateConfirmations(
            proof.blockHeight,
            this.options.currentBlockHeight,
          )
        : undefined;

      // Check minimum confirmations
      if (this.options.minConfirmations && confirmations) {
        if (confirmations < this.options.minConfirmations) {
          return this.createErrorResult(
            txid,
            `Insufficient confirmations: ${confirmations} < ${this.options.minConfirmations}`,
          );
        }
      }

      // Success!
      return {
        valid: true,
        txid,
        blockHeight: proof.blockHeight,
        confirmations,
        cached: false,
        transaction,
        blockHeader,
        merkleProof: proof,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.createErrorResult(
        txid,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Verify a transaction using BUMP proof and block header
   * @param txid Transaction ID to verify
   * @param bumpBytes Raw BUMP data
   * @param headerBytes Raw block header bytes
   * @returns Verification result
   */
  async verifyBump(
    txid: string,
    bumpBytes: Uint8Array,
    headerBytes: Uint8Array,
  ): Promise<SpvVerificationResult> {
    try {
      // Parse BUMP proof
      const proof = parseBump(bumpBytes);

      // Parse block header
      const blockHeader = parseBlockHeader(headerBytes);
      blockHeader.height = proof.blockHeight; // Set height from proof

      // Validate proof structure
      if (!validateMerkleProofStructure(proof)) {
        return this.createErrorResult(txid, "Invalid Merkle proof structure");
      }

      // Verify Merkle proof
      const proofValid = verifyMerkleProof(txid, proof, blockHeader.merkleRoot);

      if (!proofValid) {
        return this.createErrorResult(txid, "Merkle proof verification failed");
      }

      // Validate block header PoW if requested
      if (this.options.validatePoW) {
        if (!validateBlockHeaderPoW(blockHeader)) {
          return this.createErrorResult(
            txid,
            "Block header PoW validation failed",
          );
        }
      }

      // Calculate confirmations
      const confirmations = this.options.currentBlockHeight
        ? calculateConfirmations(
            proof.blockHeight,
            this.options.currentBlockHeight,
          )
        : undefined;

      // Check minimum confirmations
      if (this.options.minConfirmations && confirmations) {
        if (confirmations < this.options.minConfirmations) {
          return this.createErrorResult(
            txid,
            `Insufficient confirmations: ${confirmations} < ${this.options.minConfirmations}`,
          );
        }
      }

      // Success!
      return {
        valid: true,
        txid,
        blockHeight: proof.blockHeight,
        confirmations,
        cached: false,
        blockHeader,
        merkleProof: proof,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.createErrorResult(
        txid,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Verify a transaction using standalone Merkle proof
   * @param txid Transaction ID to verify
   * @param proof Merkle proof
   * @param blockHeader Block header
   * @returns Verification result
   */
  async verifyMerkleProof(
    txid: string,
    proof: MerkleProof,
    blockHeader: BlockHeader,
  ): Promise<SpvVerificationResult> {
    try {
      // Validate proof structure
      if (!validateMerkleProofStructure(proof)) {
        return this.createErrorResult(txid, "Invalid Merkle proof structure");
      }

      // Verify proof
      const proofValid = verifyMerkleProofWithHeader(txid, proof, blockHeader);

      if (!proofValid) {
        return this.createErrorResult(txid, "Merkle proof verification failed");
      }

      // Validate block header PoW if requested
      if (this.options.validatePoW) {
        if (!validateBlockHeaderPoW(blockHeader)) {
          return this.createErrorResult(
            txid,
            "Block header PoW validation failed",
          );
        }
      }

      // Calculate confirmations
      const confirmations = this.options.currentBlockHeight
        ? calculateConfirmations(
            proof.blockHeight,
            this.options.currentBlockHeight,
          )
        : undefined;

      // Success!
      return {
        valid: true,
        txid,
        blockHeight: proof.blockHeight,
        confirmations,
        cached: false,
        blockHeader,
        merkleProof: proof,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.createErrorResult(
        txid,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Batch verify multiple transactions from BEEF envelope
   * @param beefBytes Raw BEEF data
   * @param txids Transaction IDs to verify
   * @returns Array of verification results
   */
  async verifyBatch(
    beefBytes: Uint8Array,
    txids: string[],
  ): Promise<SpvVerificationResult[]> {
    // Parse BEEF once
    const beef = parseBeef(beefBytes, { validateProofs: true });

    // Verify each transaction
    const results: SpvVerificationResult[] = [];

    for (const txid of txids) {
      // Find transaction
      const transaction = beef.transactions.find((tx) => tx.txid === txid);

      if (!transaction || !transaction.isMined || !transaction.proof) {
        results.push(
          this.createErrorResult(txid, "Transaction not found or not mined"),
        );
        continue;
      }

      // Find block header
      const proof = transaction.proof;
      const blockHeader = beef.blockHeaders?.find(
        (header) => header.height === proof.blockHeight,
      );

      if (!blockHeader) {
        results.push(this.createErrorResult(txid, "Block header not found"));
        continue;
      }

      // Verify
      const result = await this.verifyMerkleProof(
        txid,
        transaction.proof,
        blockHeader,
      );

      results.push(result);
    }

    return results;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    txid: string,
    error: string,
  ): SpvVerificationResult {
    return {
      valid: false,
      txid,
      error,
      cached: false,
      verifiedAt: new Date().toISOString(),
    };
  }
}

/**
 * Convenience function to verify BEEF envelope
 * @param beefBytes Raw BEEF data
 * @param txid Transaction ID to verify
 * @param options Verification options
 * @returns Verification result
 */
export async function verifyBeef(
  beefBytes: Uint8Array,
  txid: string,
  options?: SpvVerificationOptions,
): Promise<SpvVerificationResult> {
  const verifier = new SpvVerifier(options);
  return verifier.verifyBeef(beefBytes, txid);
}

/**
 * Convenience function to verify BUMP proof
 * @param txid Transaction ID to verify
 * @param bumpBytes Raw BUMP data
 * @param headerBytes Raw block header bytes
 * @param options Verification options
 * @returns Verification result
 */
export async function verifyBump(
  txid: string,
  bumpBytes: Uint8Array,
  headerBytes: Uint8Array,
  options?: SpvVerificationOptions,
): Promise<SpvVerificationResult> {
  const verifier = new SpvVerifier(options);
  return verifier.verifyBump(txid, bumpBytes, headerBytes);
}

/**
 * Convenience function for batch verification
 * @param beefBytes Raw BEEF data
 * @param txids Transaction IDs to verify
 * @param options Verification options
 * @returns Array of verification results
 */
export async function verifyBatch(
  beefBytes: Uint8Array,
  txids: string[],
  options?: SpvVerificationOptions,
): Promise<SpvVerificationResult[]> {
  const verifier = new SpvVerifier(options);
  return verifier.verifyBatch(beefBytes, txids);
}
