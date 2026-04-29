// Subscription Domain - UTXO-based subscription management (SPEC §5.6)
//
// Implements subscription state machine with 5 states:
// - Active: UTXO unspent, verified within 72h → full operation
// - Cached: UTXO unspent (last check), offline >0h <72h → full operation
// - Expired: UTXO spent on-chain → EdwinPAI stops, re-subscribe prompt
// - GraceExceeded: Cannot verify, offline >72h → degraded mode
// - NotFound: No subscription UTXO exists → onboarding flow

pub mod types;
pub mod fsm;

// Re-export key types for clean API
pub use types::{
    CachedProof,
    CheckSubscriptionRequest,
    CheckSubscriptionResponse,
    SubscriptionConfig,
    SubscriptionInfo,
    SubscriptionState,
    SubscriptionStatus,
    UtxoRef,
};

// Re-export FSM
pub use fsm::SubscriptionFSM;
