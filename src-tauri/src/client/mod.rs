// Client Mode Domain
//
// Manages client-side connection to gateway, peer discovery, and session management.
//
// Phase 4 implementation per PLAN.md

pub mod types;

// Re-export commonly used types
pub use types::{
    ClientConfig, ClientConnection, ClientConnectionStatus, ClientSessionState,
    DiscoveredPeer, PeerDiscoveryMethod, PeerDiscoveryResult,
};
