// Subscription Domain type definitions (SPEC §5.6)
//
// UTXO-based subscription states and lifecycle.

use serde::{Deserialize, Serialize};

use crate::spv_domain::types::SubscriptionUtxo as SpvSubscriptionUtxo;

// --- Subscription State Machine (SPEC §5.6) ---

/// Subscription states per SPEC §5.6:
///
/// - Active: UTXO unspent, verified within 72h → full operation
/// - Cached: UTXO unspent (last check), offline >0h <72h → full operation, periodic retry
/// - Expired: UTXO spent on-chain → EdwinPAI stops, shows re-subscribe prompt
/// - GraceExceeded: Cannot verify, offline >72h → degraded mode (local-only)
/// - NotFound: No subscription UTXO exists → onboarding prompts subscription setup
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SubscriptionState {
    Active,
    Cached,
    Expired,
    GraceExceeded,
    NotFound,
}

impl SubscriptionState {
    /// Whether subscription allows full operation
    pub fn allows_full_operation(&self) -> bool {
        matches!(self, Self::Active | Self::Cached)
    }

    /// Whether subscription allows channel I/O
    pub fn allows_channel_io(&self) -> bool {
        matches!(self, Self::Active | Self::Cached)
    }

    /// Human-readable description
    pub fn description(&self) -> &'static str {
        match self {
            Self::Active => "UTXO unspent, verified within 72h",
            Self::Cached => "UTXO unspent (last check), offline <72h",
            Self::Expired => "UTXO spent on-chain",
            Self::GraceExceeded => "Cannot verify, offline >72h",
            Self::NotFound => "No subscription UTXO exists",
        }
    }
}

impl std::fmt::Display for SubscriptionState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Active => write!(f, "Active"),
            Self::Cached => write!(f, "Cached"),
            Self::Expired => write!(f, "Expired"),
            Self::GraceExceeded => write!(f, "GraceExceeded"),
            Self::NotFound => write!(f, "NotFound"),
        }
    }
}

// --- Subscription Info ---

/// UTXO reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UtxoRef {
    pub txid: String,
    pub vout: u32,
}

/// Cached SPV proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedProof {
    pub txid: String,
    pub vout: u32,
    pub merkle_proof: String, // hex-encoded or JSON
    pub block_height: u32,
    pub verified_at: String, // ISO 8601
}

/// Subscription information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionInfo {
    pub state: SubscriptionState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utxo: Option<UtxoRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_proof: Option<CachedProof>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grace_expires_at: Option<String>,
}

/// Subscription status (IPC response)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionStatus {
    pub state: SubscriptionState,
    /// TXID of the subscription UTXO, if known
    #[serde(skip_serializing_if = "Option::is_none")]
    pub txid: Option<String>,
    /// Output index of the subscription UTXO
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vout: Option<u32>,
    /// ISO 8601 timestamp of last successful verification
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<String>,
    /// Whether the current proof is from cache
    pub cached_proof: bool,
    /// Block height at which the UTXO was confirmed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_height: Option<u32>,
    /// Number of confirmations
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmations: Option<u32>,
}

impl SubscriptionStatus {
    /// Create NotFound status
    pub fn not_found() -> Self {
        Self {
            state: SubscriptionState::NotFound,
            txid: None,
            vout: None,
            verified_at: None,
            cached_proof: false,
            block_height: None,
            confirmations: None,
        }
    }

    /// Create Active status from UTXO
    pub fn active(utxo: &SpvSubscriptionUtxo, block_height: u32, confirmations: u32) -> Self {
        Self {
            state: SubscriptionState::Active,
            txid: Some(utxo.txid.clone()),
            vout: Some(utxo.vout),
            verified_at: Some(chrono::Utc::now().to_rfc3339()),
            cached_proof: false,
            block_height: Some(block_height),
            confirmations: Some(confirmations),
        }
    }

    /// Create Cached status from cached proof
    pub fn cached(cached: &CachedProof) -> Self {
        Self {
            state: SubscriptionState::Cached,
            txid: Some(cached.txid.clone()),
            vout: Some(cached.vout),
            verified_at: Some(cached.verified_at.clone()),
            cached_proof: true,
            block_height: Some(cached.block_height),
            confirmations: None,
        }
    }

    /// Create Expired status
    pub fn expired(txid: String, vout: u32) -> Self {
        Self {
            state: SubscriptionState::Expired,
            txid: Some(txid),
            vout: Some(vout),
            verified_at: None,
            cached_proof: false,
            block_height: None,
            confirmations: None,
        }
    }

    /// Create GraceExceeded status from stale cache
    pub fn grace_exceeded(cached: &CachedProof) -> Self {
        Self {
            state: SubscriptionState::GraceExceeded,
            txid: Some(cached.txid.clone()),
            vout: Some(cached.vout),
            verified_at: Some(cached.verified_at.clone()),
            cached_proof: true,
            block_height: Some(cached.block_height),
            confirmations: None,
        }
    }
}

// --- Subscription Operations ---

/// Subscription manager configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionConfig {
    /// Overlay topic ID for subscriptions
    pub topic_id: String,
    /// Cache duration (milliseconds)
    pub cache_duration_ms: i64,
    /// Grace period (milliseconds)
    pub grace_period_ms: i64,
}

impl Default for SubscriptionConfig {
    fn default() -> Self {
        Self {
            topic_id: "edwinpai-subscriptions".to_string(),
            cache_duration_ms: 72 * 60 * 60 * 1000,    // 72 hours
            grace_period_ms: 72 * 60 * 60 * 1000,       // 72 hours
        }
    }
}

/// Subscription check request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckSubscriptionRequest {
    /// Force refresh from overlay (default: false, uses cache if <72h)
    #[serde(default)]
    pub force_refresh: bool,
}

/// Subscription check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckSubscriptionResponse {
    pub status: SubscriptionStatus,
}
