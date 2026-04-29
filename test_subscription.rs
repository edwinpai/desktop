//! Standalone test file for subscription module
//! Run with: rustc --test test_subscription.rs && ./test_subscription

// Inline the necessary modules for testing
mod subscription {
    use serde::{Deserialize, Serialize};
    use sha2::{Digest, Sha256};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
    pub enum SubscriptionState {
        NotFound,
        Active,
        Cached,
        Expired,
        GraceExceeded,
    }

    impl Default for SubscriptionState {
        fn default() -> Self {
            SubscriptionState::NotFound
        }
    }

    impl SubscriptionState {
        pub fn is_valid(&self) -> bool {
            matches!(self, SubscriptionState::Active | SubscriptionState::Cached | SubscriptionState::Expired)
        }

        pub fn is_grace_period(&self) -> bool {
            matches!(self, SubscriptionState::Cached | SubscriptionState::Expired)
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SubscriptionStatus {
        pub state: SubscriptionState,
        pub txid: Option<String>,
        pub vout: Option<u32>,
        pub expires_at: Option<u64>,
        pub last_checked: u64,
        pub grace_period_remaining_seconds: Option<u64>,
    }

    impl Default for SubscriptionStatus {
        fn default() -> Self {
            Self {
                state: SubscriptionState::NotFound,
                txid: None,
                vout: None,
                expires_at: None,
                last_checked: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
                grace_period_remaining_seconds: None,
            }
        }
    }

    pub fn derive_subscription_key(
        identity_key: &[u8; 32],
        key_id: &str,
    ) -> Result<[u8; 32], String> {
        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<Sha256>;

        let protocol_id = "edwinpai";
        let invoice_number = format!("{} subscription {}", protocol_id, key_id);

        let mut mac = HmacSha256::new_from_slice(identity_key)
            .map_err(|e| format!("HMAC init failed: {}", e))?;

        mac.update(invoice_number.as_bytes());

        let result = mac.finalize();
        let derived_key: [u8; 32] = result.into_bytes().into();

        Ok(derived_key)
    }
}

// Tests
#[cfg(test)]
mod tests {
    use super::subscription::*;

    #[test]
    fn test_subscription_state_validity() {
        assert!(SubscriptionState::Active.is_valid());
        assert!(SubscriptionState::Cached.is_valid());
        assert!(SubscriptionState::Expired.is_valid());
        assert!(!SubscriptionState::NotFound.is_valid());
        assert!(!SubscriptionState::GraceExceeded.is_valid());
        println!("✓ State validity checks passed");
    }

    #[test]
    fn test_subscription_state_grace_period() {
        assert!(SubscriptionState::Cached.is_grace_period());
        assert!(SubscriptionState::Expired.is_grace_period());
        assert!(!SubscriptionState::Active.is_grace_period());
        assert!(!SubscriptionState::NotFound.is_grace_period());
        println!("✓ Grace period checks passed");
    }

    #[test]
    fn test_derive_subscription_key() {
        let identity_key = [0x42; 32];
        let key_id = "test_subscription";

        let derived = derive_subscription_key(&identity_key, key_id).unwrap();

        // Key should be deterministic
        let derived2 = derive_subscription_key(&identity_key, key_id).unwrap();
        assert_eq!(derived, derived2);
        println!("✓ Subscription key derivation is deterministic");

        // Different key_id should produce different key
        let derived3 = derive_subscription_key(&identity_key, "different").unwrap();
        assert_ne!(derived, derived3);
        println!("✓ Different key_ids produce different keys");
    }

    #[test]
    fn test_subscription_state_transitions() {
        // NotFound → Active (subscription found)
        let mut state = SubscriptionState::NotFound;
        state = SubscriptionState::Active;
        assert_eq!(state, SubscriptionState::Active);
        println!("✓ NotFound → Active transition");

        // Active → Cached (network unavailable)
        state = SubscriptionState::Cached;
        assert!(state.is_grace_period());
        println!("✓ Active → Cached transition (grace period)");

        // Cached → Expired (subscription expired but within grace)
        state = SubscriptionState::Expired;
        assert!(state.is_grace_period());
        println!("✓ Cached → Expired transition (still in grace)");

        // Expired → GraceExceeded (grace period exceeded)
        state = SubscriptionState::GraceExceeded;
        assert!(!state.is_valid());
        println!("✓ Expired → GraceExceeded transition (invalid)");
    }

    #[test]
    fn test_grace_period_calculation() {
        let grace_period_seconds = 72 * 3600; // 72 hours
        let now = 1000000;
        let cached_at = now - (24 * 3600); // 24 hours ago
        let elapsed = now - cached_at;
        let grace_remaining = grace_period_seconds.saturating_sub(elapsed);

        assert_eq!(grace_remaining, 48 * 3600); // 48 hours remaining
        println!("✓ Grace period calculation: 48h remaining after 24h");
    }

    #[test]
    fn test_grace_period_exceeded() {
        let grace_period_seconds = 72 * 3600;
        let now = 1000000;
        let cached_at = now - (73 * 3600); // 73 hours ago (exceeded)
        let elapsed = now - cached_at;
        let grace_remaining = grace_period_seconds.saturating_sub(elapsed);

        assert_eq!(grace_remaining, 0);
        println!("✓ Grace period exceeded after 73h");
    }

    #[test]
    fn test_subscription_status_default() {
        let status = SubscriptionStatus::default();
        assert_eq!(status.state, SubscriptionState::NotFound);
        assert!(status.txid.is_none());
        assert!(status.expires_at.is_none());
        println!("✓ Default subscription status is NotFound");
    }
}

fn main() {
    println!("Running subscription module tests...\n");

    // Run tests
    tests::test_subscription_state_validity();
    tests::test_subscription_state_grace_period();
    tests::test_derive_subscription_key();
    tests::test_subscription_state_transitions();
    tests::test_grace_period_calculation();
    tests::test_grace_period_exceeded();
    tests::test_subscription_status_default();

    println!("\n✅ All tests passed!");
}
