//! EdwinPAI Overlay Services Client Library
//!
//! This library provides a Rust HTTP client for BSV Overlay Services,
//! implementing Topic Manager lookup and Arcade transaction broadcasting.
//!
//! # Features
//!
//! - Topic Manager UTXO lookup via POST requests
//! - Arcade transaction broadcasting via POST /v1/tx
//! - Configurable overlay and Arcade URLs (default or environment variables)
//! - Retry logic with exponential backoff and jitter
//! - Circuit breaker pattern for fault tolerance
//! - Health check support
//!
//! # Quick Start
//!
//! ```no_run
//! use edwinpai_overlay_client::OverlayClient;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let mut client = OverlayClient::with_defaults()?;
//!
//!     let result = client.lookup_subscription("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa").await?;
//!
//!     if result.success {
//!         println!("Found {} subscription UTXOs", result.utxos.len());
//!     }
//!
//!     Ok(())
//! }
//! ```
//!
//! # Configuration
//!
//! Configure via `OverlayConfig` struct or environment variables:
//!
//! ```bash
//! export OVERLAY_URL=https://overlay.bsvblockchain.org
//! export ARCADE_URL=https://arcade.bsvblockchain.org
//! export SUBSCRIPTION_TOPIC_ID=EDWINPAI_SUBS_v1
//! ```
//!
//! # References
//!
//! - Overlay Services: qmd://edwinpai-ux/sources/github-com/overlay-services/
//! - TypeScript implementation: overlay-services-client.ts
//! - Subscription state machine: SUBSCRIPTION_STATE_MACHINE_SPEC.md

mod overlay;

pub use overlay::{
    BroadcastResult, HealthCheckResult, LookupMetadata, LookupResult, OverlayClient, OverlayConfig,
    OverlayError, OverlayResult, QueryParams, SubscriptionUtxo, TopicManagerQuery,
};
