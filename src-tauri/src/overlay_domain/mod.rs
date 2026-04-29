// Overlay Domain - BSV Overlay Services
//
// Based on BSV Overlay Services architecture and UTXO topic management.
// Sources: https://github.com/bitcoin-sv/overlay-services
//
// This module provides topic-based UTXO tracking via overlay services,
// enabling subscription management and decentralized state coordination.

pub mod types;
pub mod client;
pub mod manager;

// Re-export key types for clean API
pub use types::{
    AdmissionRules,
    ArcadeConfig,
    ArcadeSubmission,
    BlockHeightRange,
    OverlayTopic,
    Pagination,
    RejectionReason,
    SpentBy,
    SpvMode,
    SteakReceipt,
    SubmissionMode,
    TopicChanges,
    TopicEvent,
    TopicSubmissionResult,
    TopicUtxo,
    UtxoFilter,
    UtxoQueryResult,
};

// Re-export client and manager
pub use client::OverlayClient;
pub use manager::TopicManager;
