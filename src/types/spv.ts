/**
 * SPV (Simplified Payment Verification) types
 *
 * Based on BRC-8 (Transaction Envelopes), BRC-9 (SPV), BRC-62 (BEEF), BRC-67 (SPV)
 * Sources: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/
 *
 * BEEF = Background Evaluation Extended Format
 * Provides recursive transaction proofs for SPV validation without full blockchain.
 */

// --- BRC-62 BEEF (Background Evaluation Extended Format) ---

/**
 * BEEF envelope containing transactions and their Merkle proofs
 * Enables SPV validation without requiring full blockchain
 */
export interface BeefEnvelope {
  /** Version (currently 0x0100) */
  version: number;
  /** List of transactions in topological order (parents before children) */
  transactions: BRC62Transaction[];
  /** Merkle proofs for unconfirmed transactions */
  merkleProofs: MerkleProof[];
  /** Block header references for SPV validation */
  blockHeaders?: BlockHeader[];
}

/**
 * BRC-62 transaction format (extends standard Bitcoin transaction)
 */
export interface BRC62Transaction {
  /** Transaction ID (hex-encoded, 32 bytes) */
  txid: string;
  /** Raw transaction bytes (hex-encoded) */
  rawTx: Uint8Array;
  /** Input references */
  inputs: TransactionInput[];
  /** Output scripts */
  outputs: TransactionOutput[];
  /** Merkle proof if transaction is confirmed */
  proof?: MerkleProof;
  /** Whether this transaction is mined (has merkle proof) */
  isMined: boolean;
}

export interface TransactionInput {
  /** Previous transaction ID */
  prevTxid: string;
  /** Previous output index */
  prevVout: number;
  /** Unlocking script (scriptSig) */
  scriptSig: Uint8Array;
  /** Sequence number */
  sequence: number;
}

export interface TransactionOutput {
  /** Amount in satoshis */
  satoshis: number;
  /** Locking script (scriptPubKey) */
  scriptPubKey: Uint8Array;
}

// --- BRC-8/BRC-9/BRC-67 Merkle Proof Types ---

/**
 * Merkle proof for SPV validation (BRC-67)
 * Proves transaction inclusion in a block without downloading entire block
 */
export interface MerkleProof {
  /** Transaction index in block */
  txIndex: number;
  /** Block height */
  blockHeight: number;
  /** Merkle root from block header */
  merkleRoot: string;
  /** Merkle path nodes (ordered from leaf to root) */
  nodes: MerkleProofNode[];
  /** Total transactions in block (for validation) */
  txCount?: number;
}

/**
 * Single node in Merkle proof path
 */
export interface MerkleProofNode {
  /** Node hash (hex-encoded, 32 bytes) */
  hash: string;
  /** Whether this node is on the left (true) or right (false) */
  isLeft: boolean;
}

/**
 * Compact Merkle path format (BRC-71 binary format)
 */
export interface CompactMerklePath {
  /** Block height */
  blockHeight: number;
  /** Merkle tree path as compact binary */
  path: Uint8Array;
}

// --- Block Header (for SPV chain validation) ---

/**
 * Bitcoin block header (80 bytes)
 */
export interface BlockHeader {
  /** Block height */
  height: number;
  /** Block hash (hex-encoded, 32 bytes) */
  hash: string;
  /** Version */
  version: number;
  /** Previous block hash */
  prevHash: string;
  /** Merkle root */
  merkleRoot: string;
  /** Timestamp (Unix epoch) */
  timestamp: number;
  /** Difficulty target */
  bits: number;
  /** Nonce */
  nonce: number;
}

// --- SPV Verification Result ---

/**
 * Result of SPV verification
 */
export interface SpvVerification {
  /** Whether the transaction is valid */
  valid: boolean;
  /** Transaction ID that was verified */
  txid: string;
  /** Block height (if confirmed) */
  blockHeight?: number;
  /** Number of confirmations */
  confirmations?: number;
  /** Error message if validation failed */
  error?: string;
  /** Whether proof was from cache */
  cached: boolean;
}

// --- Subscription SPV Types (SPEC §5.6) ---

/**
 * Subscription UTXO reference with SPV proof
 */
export interface SubscriptionUtxo {
  /** Transaction ID */
  txid: string;
  /** Output index */
  vout: number;
  /** Amount in satoshis */
  satoshis: number;
  /** Locking script */
  scriptPubKey: Uint8Array;
  /** Merkle proof (if confirmed) */
  proof?: MerkleProof;
  /** Whether UTXO is spent */
  spent: boolean;
}

/**
 * SPV proof cache entry
 */
export interface SpvProofCache {
  /** Transaction ID */
  txid: string;
  /** Merkle proof */
  proof: MerkleProof;
  /** Block header */
  blockHeader: BlockHeader;
  /** Timestamp when cached (ISO 8601) */
  cachedAt: string;
  /** Timestamp when last verified (ISO 8601) */
  verifiedAt: string;
}

// --- BEEF Parsing/Serialization ---

/**
 * Options for BEEF parsing
 */
export interface BeefParseOptions {
  /** Whether to validate Merkle proofs */
  validateProofs?: boolean;
  /** Whether to verify transaction signatures */
  verifySignatures?: boolean;
  /** Maximum transaction depth to process */
  maxDepth?: number;
}

/**
 * BEEF serialization result
 */
export interface BeefSerialized {
  /** Serialized BEEF bytes */
  bytes: Uint8Array;
  /** Hex-encoded BEEF */
  hex: string;
  /** Human-readable summary */
  summary: {
    version: number;
    txCount: number;
    proofCount: number;
    totalBytes: number;
  };
}
