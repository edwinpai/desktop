// Invitation module for Phase 4
//
// Handles invitation token generation, QR code encoding/decoding,
// and invitation status management for multi-user authorization.

pub mod types;
pub mod qr;

// Re-export main types for convenience
pub use types::{InvitationToken, QRData, InvitationStatus};
pub use qr::QRCodeGenerator;
