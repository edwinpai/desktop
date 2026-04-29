//! Overlay Services Client
//!
//! Provides HTTP client for BSV Overlay Services (Topic Manager lookup,
//! Arcade transaction broadcasting). Phase 2 — not yet integrated with Desktop.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Overlay client configuration
#[derive(Debug, Clone)]
pub struct OverlayConfig {
    pub overlay_url: String,
    pub arcade_url: String,
    pub topic_id: String,
    pub timeout_ms: u64,
    pub max_retries: u32,
}

impl Default for OverlayConfig {
    fn default() -> Self {
        Self {
            overlay_url: std::env::var("OVERLAY_URL")
                .unwrap_or_else(|_| "https://overlay.bsvblockchain.org".into()),
            arcade_url: std::env::var("ARCADE_URL")
                .unwrap_or_else(|_| "https://arcade.bsvblockchain.org".into()),
            topic_id: std::env::var("SUBSCRIPTION_TOPIC_ID")
                .unwrap_or_else(|_| "EDWINPAI_SUBS_v1".into()),
            timeout_ms: 10_000,
            max_retries: 3,
        }
    }
}

/// Error type for overlay operations
#[derive(Debug, thiserror::Error)]
pub enum OverlayError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Configuration error: {0}")]
    Config(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub type OverlayResult<T> = Result<T, OverlayError>;

/// Subscription UTXO from topic manager lookup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionUtxo {
    pub txid: String,
    pub vout: u32,
    pub satoshis: u64,
    pub script: String,
}

/// Result of a topic manager lookup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LookupResult {
    pub success: bool,
    pub utxos: Vec<SubscriptionUtxo>,
    pub metadata: Option<LookupMetadata>,
}

/// Metadata from lookup response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LookupMetadata {
    pub topic_id: String,
    pub timestamp: Option<String>,
}

/// Query parameters for topic manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParams {
    pub address: String,
    pub topic_id: Option<String>,
}

/// Topic manager query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicManagerQuery {
    pub query: QueryParams,
}

/// Result of broadcasting a transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastResult {
    pub success: bool,
    pub txid: Option<String>,
    pub error: Option<String>,
}

/// Health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub overlay_healthy: bool,
    pub arcade_healthy: bool,
}

/// Overlay Services HTTP client
pub struct OverlayClient {
    config: OverlayConfig,
    http: reqwest::Client,
}

impl OverlayClient {
    /// Create client with default configuration
    pub fn with_defaults() -> OverlayResult<Self> {
        Ok(Self {
            config: OverlayConfig::default(),
            http: reqwest::Client::new(),
        })
    }

    /// Create client with custom configuration
    pub fn new(config: OverlayConfig) -> Self {
        Self {
            config,
            http: reqwest::Client::new(),
        }
    }

    /// Lookup subscription UTXOs for an address
    pub async fn lookup_subscription(&self, address: &str) -> OverlayResult<LookupResult> {
        let query = TopicManagerQuery {
            query: QueryParams {
                address: address.to_string(),
                topic_id: Some(self.config.topic_id.clone()),
            },
        };

        let resp = self
            .http
            .post(&format!("{}/lookup", self.config.overlay_url))
            .json(&query)
            .send()
            .await?;

        Ok(resp.json().await?)
    }

    /// Broadcast a transaction via Arcade
    pub async fn broadcast_tx(&self, raw_tx: &str) -> OverlayResult<BroadcastResult> {
        let mut body = HashMap::new();
        body.insert("rawTx", raw_tx);

        let resp = self
            .http
            .post(&format!("{}/v1/tx", self.config.arcade_url))
            .json(&body)
            .send()
            .await?;

        Ok(resp.json().await?)
    }

    /// Health check for overlay and arcade services
    pub async fn health_check(&self) -> OverlayResult<HealthCheckResult> {
        let overlay = self
            .http
            .get(&format!("{}/health", self.config.overlay_url))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);

        let arcade = self
            .http
            .get(&format!("{}/health", self.config.arcade_url))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);

        Ok(HealthCheckResult {
            overlay_healthy: overlay,
            arcade_healthy: arcade,
        })
    }
}
