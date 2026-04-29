// SPV Domain - Simplified Payment Verification
//
// Based on BRC-8 (Transaction Envelopes), BRC-9 (SPV), BRC-62 (BEEF), BRC-67 (SPV)
//
// This module provides SPV verification for Bitcoin transactions without requiring
// a full blockchain. It implements BEEF (Background Evaluation Extended Format)
// for transaction proofs and Merkle path validation.

pub mod types;
pub mod beef;
pub mod merkle;
pub mod verifier;

// Re-export key types for clean API
pub use types::{
    BeefEnvelope,
    BeefParseOptions,
    BeefSerialized,
    BeefSummary,
    BlockHeader,
    Brc62Transaction,
    CompactMerklePath,
    MerkleProof,
    MerkleProofNode,
    SpvProofCache,
    SpvVerification,
    SubscriptionUtxo,
    TransactionInput,
    TransactionOutput,
};

// Re-export verifier
pub use verifier::SpvVerifier;
