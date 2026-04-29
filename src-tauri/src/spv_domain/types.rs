// SPV Domain type definitions
//
// Based on BRC-8 (Transaction Envelopes), BRC-9 (SPV), BRC-62 (BEEF), BRC-67 (SPV)
// Sources: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/

use serde::{Deserialize, Serialize};

// --- BRC-62 BEEF (Background Evaluation Extended Format) ---

/// BEEF envelope containing transactions and their Merkle proofs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeefEnvelope {
    /// Version (currently 0x0100)
    pub version: u16,
    /// List of transactions in topological order (parents before children)
    pub transactions: Vec<Brc62Transaction>,
    /// Merkle proofs for confirmed transactions
    pub merkle_proofs: Vec<MerkleProof>,
    /// Block header references for SPV validation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_headers: Option<Vec<BlockHeader>>,
}

impl BeefEnvelope {
    /// Deserialize BEEF from hex-encoded bytes
    pub fn from_hex(hex: &str) -> Result<Self, String> {
        let bytes = hex::decode(hex).map_err(|e| format!("Invalid hex: {}", e))?;
        Self::from_bytes(&bytes)
    }

    /// Deserialize BEEF from raw bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        crate::spv_domain::beef::parse_beef(bytes)
    }

    /// Serialize BEEF to bytes
    pub fn to_bytes(&self) -> Result<Vec<u8>, String> {
        crate::spv_domain::beef::serialize_beef(self)
    }

    /// Serialize BEEF to hex-encoded string
    pub fn to_hex(&self) -> Result<String, String> {
        let bytes = self.to_bytes()?;
        Ok(hex::encode(bytes))
    }
}

/// BRC-62 transaction format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Brc62Transaction {
    /// Transaction ID (hex-encoded, 32 bytes)
    pub txid: String,
    /// Raw transaction bytes (hex-encoded)
    pub raw_tx: Vec<u8>,
    /// Input references
    pub inputs: Vec<TransactionInput>,
    /// Output scripts
    pub outputs: Vec<TransactionOutput>,
    /// Merkle proof if transaction is confirmed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof: Option<MerkleProof>,
    /// Whether this transaction is mined (has merkle proof)
    pub is_mined: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionInput {
    /// Previous transaction ID
    pub prev_txid: String,
    /// Previous output index
    pub prev_vout: u32,
    /// Unlocking script (scriptSig)
    pub script_sig: Vec<u8>,
    /// Sequence number
    pub sequence: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionOutput {
    /// Amount in satoshis
    pub satoshis: u64,
    /// Locking script (scriptPubKey)
    pub script_pubkey: Vec<u8>,
}

// --- Merkle Proof Types (BRC-8/BRC-9/BRC-67) ---

/// Merkle proof for SPV validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleProof {
    /// Transaction index in block
    pub tx_index: u32,
    /// Block height
    pub block_height: u32,
    /// Merkle root from block header
    pub merkle_root: String,
    /// Merkle path nodes (ordered from leaf to root)
    pub nodes: Vec<MerkleProofNode>,
    /// Total transactions in block (for validation)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tx_count: Option<u32>,
}

impl MerkleProof {
    /// Verify Merkle proof for a given transaction hash
    pub fn verify(&self, txid: &str) -> bool {
        crate::spv_domain::merkle::verify_merkle_proof(txid, self).unwrap_or(false)
    }
}

/// Single node in Merkle proof path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleProofNode {
    /// Node hash (hex-encoded, 32 bytes)
    pub hash: String,
    /// Whether this node is on the left (true) or right (false)
    pub is_left: bool,
}

/// Compact Merkle path format (BRC-71 binary format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactMerklePath {
    /// Block height
    pub block_height: u32,
    /// Merkle tree path as compact binary
    pub path: Vec<u8>,
}

// --- Block Header (for SPV chain validation) ---

/// Bitcoin block header (80 bytes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockHeader {
    /// Block height
    pub height: u32,
    /// Block hash (hex-encoded, 32 bytes)
    pub hash: String,
    /// Version
    pub version: u32,
    /// Previous block hash
    pub prev_hash: String,
    /// Merkle root
    pub merkle_root: String,
    /// Timestamp (Unix epoch)
    pub timestamp: u32,
    /// Difficulty target
    pub bits: u32,
    /// Nonce
    pub nonce: u32,
}

impl BlockHeader {
    /// Calculate block hash from header fields
    pub fn calculate_hash(&self) -> String {
        crate::spv_domain::merkle::calculate_block_hash(self).unwrap_or_else(|_| self.hash.clone())
    }

    /// Verify proof-of-work (hash < target)
    pub fn verify_pow(&self) -> bool {
        crate::spv_domain::merkle::verify_block_header_pow(self).unwrap_or(false)
    }
}

// --- SPV Verification Result ---

/// Result of SPV verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpvVerification {
    /// Whether the transaction is valid
    pub valid: bool,
    /// Transaction ID that was verified
    pub txid: String,
    /// Block height (if confirmed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_height: Option<u32>,
    /// Number of confirmations
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmations: Option<u32>,
    /// Error message if validation failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Whether proof was from cache
    pub cached: bool,
}

// --- Subscription SPV Types (SPEC §5.6) ---

/// Subscription UTXO reference with SPV proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionUtxo {
    /// Transaction ID
    pub txid: String,
    /// Output index
    pub vout: u32,
    /// Amount in satoshis
    pub satoshis: u64,
    /// Locking script
    pub script_pubkey: Vec<u8>,
    /// Merkle proof (if confirmed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof: Option<MerkleProof>,
    /// Whether UTXO is spent
    pub spent: bool,
}

/// SPV proof cache entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpvProofCache {
    /// Transaction ID
    pub txid: String,
    /// Merkle proof
    pub proof: MerkleProof,
    /// Block header
    pub block_header: BlockHeader,
    /// Timestamp when cached (ISO 8601)
    pub cached_at: String,
    /// Timestamp when last verified (ISO 8601)
    pub verified_at: String,
}

impl SpvProofCache {
    /// Check if cache entry is still valid (within grace period)
    pub fn is_valid(&self, grace_period_ms: i64) -> bool {
        use chrono::{DateTime, Utc};

        let verified_at = DateTime::parse_from_rfc3339(&self.verified_at)
            .ok()
            .and_then(|dt| Some(dt.with_timezone(&Utc)));

        if let Some(verified) = verified_at {
            let now = Utc::now();
            let elapsed = now.signed_duration_since(verified);
            elapsed.num_milliseconds() < grace_period_ms
        } else {
            false
        }
    }
}

// --- BEEF Parsing/Serialization ---

/// Options for BEEF parsing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeefParseOptions {
    /// Whether to validate Merkle proofs
    #[serde(default = "default_true")]
    pub validate_proofs: bool,
    /// Whether to verify transaction signatures
    #[serde(default)]
    pub verify_signatures: bool,
    /// Maximum transaction depth to process
    #[serde(default = "default_max_depth")]
    pub max_depth: usize,
}

fn default_true() -> bool {
    true
}

fn default_max_depth() -> usize {
    100
}

impl Default for BeefParseOptions {
    fn default() -> Self {
        Self {
            validate_proofs: true,
            verify_signatures: false,
            max_depth: 100,
        }
    }
}

/// BEEF serialization result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeefSerialized {
    /// Serialized BEEF bytes
    pub bytes: Vec<u8>,
    /// Hex-encoded BEEF
    pub hex: String,
    /// Human-readable summary
    pub summary: BeefSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeefSummary {
    pub version: u16,
    pub tx_count: usize,
    pub proof_count: usize,
    pub total_bytes: usize,
}
