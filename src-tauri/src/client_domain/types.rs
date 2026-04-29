// Client Domain Types
//
// Authorization levels for client connections.

use serde::{Deserialize, Serialize};

/// Authorization level for a connected user/client
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthorizationLevel {
    /// No access
    None,
    /// Read-only access
    Guest,
    /// Standard user access
    User,
    /// Administrative access
    Admin,
    /// Full owner access
    Owner,
}

impl Default for AuthorizationLevel {
    fn default() -> Self {
        Self::None
    }
}

impl std::fmt::Display for AuthorizationLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::None => write!(f, "none"),
            Self::Guest => write!(f, "guest"),
            Self::User => write!(f, "user"),
            Self::Admin => write!(f, "admin"),
            Self::Owner => write!(f, "owner"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_authorization_level_default() {
        assert_eq!(AuthorizationLevel::default(), AuthorizationLevel::None);
    }

    #[test]
    fn test_authorization_level_serialization() {
        let level = AuthorizationLevel::Admin;
        let json = serde_json::to_string(&level).unwrap();
        assert_eq!(json, "\"admin\"");
    }
}
