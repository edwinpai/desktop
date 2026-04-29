// Multi-User Authorization Domain
//
// Manages BRC-103 authentication, user authorization, invitation lifecycle, and nonce tracking.
//
// Phase 4 implementation per PLAN.md

pub mod ipc_types;
pub mod invitations;
pub mod types;
pub mod users;

// Re-export commonly used types
pub use types::{
    AccessLevel, AuthUser, Brc103AuthHeaders, Invitation, InvitationData, InvitationDatabase,
    InvitationDetails, InvitationStatus, NonceError, NonceTracker, UserDatabase,
};

// Re-export managers
pub use invitations::{get_invitation_manager, init_invitation_manager, InvitationManager};
pub use users::{get_user_manager, init_user_manager, UserManager};
