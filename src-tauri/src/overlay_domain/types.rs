// Overlay Domain type definitions
//
// Based on BSV Overlay Services architecture and UTXO topic management.
// Sources: https://github.com/bitcoin-sv/overlay-services

use serde::{Deserialize, Serialize};

use crate::spv_domain::types::{BeefEnvelope, MerkleProof};

// --- Topic Manager Types ---

/// Overlay topic configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayTopic {
    /// Topic identifier (e.g., "edwinpai-subscriptions", "edwinpai-channels")
    pub topic_id: String,
    /// Human-readable description
    pub description: String,
    /// Manager endpoint URL (e.g., https://overlay.example.com)
    pub manager_url: String,
    /// Admission rules (script templates, payment requirements)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admission_rules: Option<AdmissionRules>,
}

/// Admission rules for topic membership
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdmissionRules {
    /// Required locking script pattern (e.g., OP_RETURN <topic_id> <payload>)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script_pattern: Option<String>,
    /// Minimum satoshi amount
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_satoshis: Option<u64>,
    /// Maximum satoshi amount
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_satoshis: Option<u64>,
    /// Required protocol IDs (BRC-43)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_protocols: Option<Vec<String>>,
    /// Custom validation rules
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_validation: Option<String>,
}

// --- BEEF Submission (Arcade/STEAK pattern) ---

/// Arcade submission request
/// "Arcade" = overlay service submission endpoint
/// "STEAK" = Successful Transmission Evidence Acknowledgement Kit (receipt)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArcadeSubmission {
    /// Tagged BEEF envelope
    pub beef: BeefEnvelope,
    /// Topics to submit to
    pub topics: Vec<String>,
    /// Submission mode
    #[serde(default = "default_submission_mode")]
    pub mode: SubmissionMode,
    /// Off-chain value assignments (for internal accounting)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub off_chain_values: Option<Vec<u64>>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SubmissionMode {
    CurrentTx,
    HistoricalTx,
    HistoricalTxNoSpv,
}

fn default_submission_mode() -> SubmissionMode {
    SubmissionMode::CurrentTx
}

/// STEAK receipt (proof of submission)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteakReceipt {
    /// Transaction ID
    pub txid: String,
    /// Topics accepted
    pub topics: Vec<String>,
    /// Timestamp of acceptance (ISO 8601)
    pub accepted_at: String,
    /// Merkle proof (if tx is mined)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof: Option<MerkleProof>,
    /// STEAK signature (overlay manager signature over receipt)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

/// Topic submission result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicSubmissionResult {
    /// Whether submission was accepted
    pub accepted: bool,
    /// STEAK receipt
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt: Option<SteakReceipt>,
    /// Rejection reason
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection: Option<RejectionReason>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectionReason {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

// --- UTXO Queries ---

/// UTXO filter for topic queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UtxoFilter {
    /// Script hash (for P2PKH lookups)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script_hash: Option<String>,
    /// Minimum satoshi amount
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_satoshis: Option<u64>,
    /// Maximum satoshi amount
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_satoshis: Option<u64>,
    /// Whether to include spent UTXOs
    #[serde(default)]
    pub include_spent: bool,
    /// Block height range
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_height_range: Option<BlockHeightRange>,
    /// Pagination
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pagination: Option<Pagination>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockHeightRange {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub offset: usize,
    pub limit: usize,
}

/// UTXO query result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UtxoQueryResult {
    /// Matching UTXOs
    pub utxos: Vec<TopicUtxo>,
    /// Total count (before pagination)
    pub total_count: usize,
    /// Next page offset (if more results exist)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_offset: Option<usize>,
}

/// UTXO tracked in overlay topic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicUtxo {
    /// Transaction ID
    pub txid: String,
    /// Output index
    pub vout: u32,
    /// Amount in satoshis
    pub satoshis: u64,
    /// Locking script (hex-encoded)
    pub script_pubkey: String,
    /// Block height (if confirmed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_height: Option<u32>,
    /// Whether UTXO is spent
    pub spent: bool,
    /// Spending transaction (if spent)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spent_by: Option<SpentBy>,
    /// Topic-specific metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpentBy {
    pub txid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_height: Option<u32>,
}

// --- Topic Events (SSE) ---

/// Topic event (SSE stream)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TopicEvent {
    UtxoAdded { utxo: TopicUtxo },
    UtxoSpent { txid: String, vout: u32, spending_txid: String },
    UtxoConfirmed { txid: String, vout: u32, block_height: u32, confirmations: u32 },
    TopicUpdated { topic_id: String, changes: TopicChanges },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicChanges {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manager_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admission_rules: Option<AdmissionRules>,
}

// --- Arcade Configuration (SPEC §5.6, subscription tracking) ---

/// Arcade configuration for subscription management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArcadeConfig {
    /// Overlay manager base URL
    pub base_url: String,
    /// Topic ID for subscriptions (e.g., "edwinpai-subscriptions")
    pub subscription_topic: String,
    /// SPV verification mode
    pub spv_mode: SpvMode,
    /// Cache duration for proofs (milliseconds)
    pub cache_duration: i64,
    /// Grace period before marking subscription expired (milliseconds)
    pub grace_period: i64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SpvMode {
    Full,
    Cached,
    Trust,
}

impl Default for ArcadeConfig {
    fn default() -> Self {
        Self {
            base_url: "https://overlay.bsvblockchain.org".to_string(),
            subscription_topic: "edwinpai-subscriptions".to_string(),
            spv_mode: SpvMode::Cached,
            cache_duration: 72 * 60 * 60 * 1000,    // 72 hours
            grace_period: 72 * 60 * 60 * 1000,       // 72 hours
        }
    }
}
