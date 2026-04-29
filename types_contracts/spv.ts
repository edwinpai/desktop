/**
 * SPV (Simplified Payment Verification) Type Contracts
 *
 * Type definitions for SPV verification layer.
 * These types are imported by subscription-manager and overlay-services-client.
 */

export interface SpvVerificationResult {
  /** Whether the verification succeeded */
  isValid: boolean;
  /** Transaction ID that was verified */
  txid?: string;
  /** Block height where transaction was confirmed */
  blockHeight?: number;
  /** Error message if verification failed */
  error?: string;
  /** Merkle root from block header */
  merkleRoot?: string;
  /** Number of confirmations */
  confirmations?: number;
  /** Timestamp of verification */
  verifiedAt?: number;
}

export interface MerkleProof {
  /** Transaction ID being proven */
  txid: string;
  /** Merkle tree path (sibling hashes) */
  path: string[];
  /** Position of transaction in block (index) */
  index: number;
  /** Block hash containing the transaction */
  blockHash: string;
  /** Block height */
  blockHeight: number;
}

export interface SpvVerificationRequest {
  /** Transaction ID to verify */
  txid: string;
  /** Merkle proof (JSON string or hex) */
  merkleProof: string;
  /** Block height (optional, for validation) */
  blockHeight?: number;
}
