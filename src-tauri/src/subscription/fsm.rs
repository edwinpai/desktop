// Subscription Finite State Machine (FSM)
//
// Implements 5-state subscription lifecycle per SPEC §5.6:
// - Active: UTXO unspent, verified within 72h → full operation
// - Cached: UTXO unspent (last check), offline >0h <72h → full operation, periodic retry
// - Expired: UTXO spent on-chain → EdwinPAI stops, re-subscribe prompt
// - GraceExceeded: Cannot verify, offline >72h → degraded mode (local-only)
// - NotFound: No subscription UTXO exists → onboarding prompts subscription setup

use super::types::{
    CachedProof, CheckSubscriptionRequest, CheckSubscriptionResponse, SubscriptionConfig,
    SubscriptionInfo, SubscriptionState, SubscriptionStatus, UtxoRef,
};
use crate::overlay_domain::manager::TopicManager;
use crate::spv_domain::verifier::SpvVerifier;
use chrono::{DateTime, Duration, Utc};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct SubscriptionFSM {
    /// Current subscription state
    state: Arc<Mutex<SubscriptionInfo>>,
    /// SPV verifier
    _spv_verifier: Arc<Mutex<SpvVerifier>>,
    /// Topic manager (overlay client)
    topic_manager: Arc<Mutex<TopicManager>>,
    /// Configuration
    config: SubscriptionConfig,
}

impl SubscriptionFSM {
    pub fn new(
        spv_verifier: Arc<Mutex<SpvVerifier>>,
        topic_manager: Arc<Mutex<TopicManager>>,
        config: SubscriptionConfig,
    ) -> Self {
        let initial_state = SubscriptionInfo {
            state: SubscriptionState::NotFound,
            utxo: None,
            verified_at: None,
            cached_proof: None,
            grace_expires_at: None,
        };

        Self {
            state: Arc::new(Mutex::new(initial_state)),
            _spv_verifier: spv_verifier,
            topic_manager,
            config,
        }
    }

    /// Check subscription status
    ///
    /// State transition logic:
    /// 1. NotFound → try to find UTXO via overlay
    /// 2. Active/Cached → check if grace period expired
    /// 3. Expired → check if UTXO is spent
    /// 4. GraceExceeded → check if can reconnect
    pub async fn check_subscription(
        &self,
        request: &CheckSubscriptionRequest,
    ) -> Result<CheckSubscriptionResponse, String> {
        let mut state = self.state.lock().await;

        // Force refresh or check grace period
        let needs_refresh = request.force_refresh
            || state.verified_at.is_none()
            || self.is_grace_period_exceeded(&state);

        if needs_refresh {
            // Try to verify from overlay
            drop(state); // Release lock before async call
            self.refresh_from_overlay().await?;
            state = self.state.lock().await;
        }

        // Build response from current state
        let status = self.build_status(&state);

        Ok(CheckSubscriptionResponse { status })
    }

    /// Refresh subscription state from overlay
    async fn refresh_from_overlay(&self) -> Result<(), String> {
        // Query overlay for subscription UTXO
        // For now, use a mock script hash (in practice, derived from identity key)
        let script_hash = "mock_script_hash"; // TODO: compute from BRC-42 derived key

        // Query UTXO without holding lock across await
        let utxo = {
            let manager = self.topic_manager.lock().await;
            manager.query_subscription_utxo(script_hash).await?
        };

        let mut state = self.state.lock().await;

        if let Some(ref utxo) = utxo {
            // UTXO found
            if utxo.spent {
                // UTXO is spent → Expired
                state.state = SubscriptionState::Expired;
                state.utxo = Some(UtxoRef {
                    txid: utxo.txid.clone(),
                    vout: utxo.vout,
                });
                state.verified_at = Some(Utc::now().to_rfc3339());
            } else {
                // UTXO unspent → Active
                state.state = SubscriptionState::Active;
                state.utxo = Some(UtxoRef {
                    txid: utxo.txid.clone(),
                    vout: utxo.vout,
                });
                state.verified_at = Some(Utc::now().to_rfc3339());

                // Cache proof if available
                if let Some(ref proof) = utxo.proof {
                    state.cached_proof = Some(CachedProof {
                        txid: utxo.txid.clone(),
                        vout: utxo.vout,
                        merkle_proof: serde_json::to_string(proof)
                            .unwrap_or_else(|_| "{}".to_string()),
                        block_height: proof.block_height,
                        verified_at: Utc::now().to_rfc3339(),
                    });
                }

                // Clear grace expiration
                state.grace_expires_at = None;
            }
        } else {
            // No UTXO found
            if state.cached_proof.is_some() {
                // Had a cached proof, but can't verify online
                if self.is_grace_period_exceeded(&state) {
                    state.state = SubscriptionState::GraceExceeded;
                } else {
                    state.state = SubscriptionState::Cached;
                    // Set grace expiration if not already set
                    if state.grace_expires_at.is_none() {
                        let grace_expires = Utc::now()
                            + Duration::milliseconds(self.config.grace_period_ms);
                        state.grace_expires_at = Some(grace_expires.to_rfc3339());
                    }
                }
            } else {
                // No cached proof, no UTXO
                state.state = SubscriptionState::NotFound;
                state.utxo = None;
                state.verified_at = None;
                state.cached_proof = None;
                state.grace_expires_at = None;
            }
        }

        Ok(())
    }

    /// Check if grace period has been exceeded
    fn is_grace_period_exceeded(&self, state: &SubscriptionInfo) -> bool {
        if let Some(verified_at_str) = &state.verified_at {
            if let Ok(verified_at) = DateTime::parse_from_rfc3339(verified_at_str) {
                let verified_utc = verified_at.with_timezone(&Utc);
                let elapsed = Utc::now().signed_duration_since(verified_utc);
                return elapsed.num_milliseconds() > self.config.grace_period_ms;
            }
        }
        false
    }

    /// Build SubscriptionStatus from SubscriptionInfo
    fn build_status(&self, info: &SubscriptionInfo) -> SubscriptionStatus {
        SubscriptionStatus {
            state: info.state,
            txid: info.utxo.as_ref().map(|u| u.txid.clone()),
            vout: info.utxo.as_ref().map(|u| u.vout),
            verified_at: info.verified_at.clone(),
            cached_proof: info.cached_proof.is_some(),
            block_height: info
                .cached_proof
                .as_ref()
                .map(|c| c.block_height),
            confirmations: None, // TODO: calculate from chain tip
        }
    }

    /// Get current state
    pub async fn get_state(&self) -> SubscriptionState {
        self.state.lock().await.state
    }

    /// Get current info
    pub async fn get_info(&self) -> SubscriptionInfo {
        self.state.lock().await.clone()
    }

    /// Set state manually (for testing)
    #[cfg(test)]
    pub async fn set_state(&self, info: SubscriptionInfo) {
        let mut state = self.state.lock().await;
        *state = info;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::overlay_domain::types::ArcadeConfig;

    fn create_test_fsm() -> SubscriptionFSM {
        let spv_verifier = Arc::new(tokio::sync::Mutex::new(SpvVerifier::new()));
        let topic_manager = Arc::new(tokio::sync::Mutex::new(TopicManager::new(ArcadeConfig::default())));
        let config = SubscriptionConfig::default();

        SubscriptionFSM::new(spv_verifier, topic_manager, config)
    }

    #[tokio::test]
    async fn test_fsm_initial_state() {
        let fsm = create_test_fsm();
        let state = fsm.get_state().await;
        assert_eq!(state, SubscriptionState::NotFound);
    }

    #[tokio::test]
    async fn test_fsm_get_info() {
        let fsm = create_test_fsm();
        let info = fsm.get_info().await;
        assert_eq!(info.state, SubscriptionState::NotFound);
        assert!(info.utxo.is_none());
        assert!(info.cached_proof.is_none());
    }

    #[tokio::test]
    async fn test_check_subscription_not_found() {
        let fsm = create_test_fsm();
        let request = CheckSubscriptionRequest {
            force_refresh: false,
        };

        let response = fsm.check_subscription(&request).await.unwrap();
        assert_eq!(response.status.state, SubscriptionState::NotFound);
    }

    #[test]
    fn test_is_grace_period_exceeded_no_verified_at() {
        let fsm = create_test_fsm();
        let info = SubscriptionInfo {
            state: SubscriptionState::Cached,
            utxo: None,
            verified_at: None,
            cached_proof: None,
            grace_expires_at: None,
        };

        assert!(!fsm.is_grace_period_exceeded(&info));
    }

    #[test]
    fn test_is_grace_period_exceeded_recent() {
        let fsm = create_test_fsm();
        let info = SubscriptionInfo {
            state: SubscriptionState::Active,
            utxo: None,
            verified_at: Some(Utc::now().to_rfc3339()),
            cached_proof: None,
            grace_expires_at: None,
        };

        assert!(!fsm.is_grace_period_exceeded(&info));
    }

    #[test]
    fn test_is_grace_period_exceeded_old() {
        let fsm = create_test_fsm();
        let old_time = Utc::now() - Duration::days(4); // 96 hours ago
        let info = SubscriptionInfo {
            state: SubscriptionState::Cached,
            utxo: None,
            verified_at: Some(old_time.to_rfc3339()),
            cached_proof: None,
            grace_expires_at: None,
        };

        assert!(fsm.is_grace_period_exceeded(&info));
    }

    #[test]
    fn test_build_status_not_found() {
        let fsm = create_test_fsm();
        let info = SubscriptionInfo {
            state: SubscriptionState::NotFound,
            utxo: None,
            verified_at: None,
            cached_proof: None,
            grace_expires_at: None,
        };

        let status = fsm.build_status(&info);
        assert_eq!(status.state, SubscriptionState::NotFound);
        assert!(status.txid.is_none());
        assert!(!status.cached_proof);
    }

    #[test]
    fn test_build_status_active() {
        let fsm = create_test_fsm();
        let info = SubscriptionInfo {
            state: SubscriptionState::Active,
            utxo: Some(UtxoRef {
                txid: "test_txid".to_string(),
                vout: 0,
            }),
            verified_at: Some(Utc::now().to_rfc3339()),
            cached_proof: Some(CachedProof {
                txid: "test_txid".to_string(),
                vout: 0,
                merkle_proof: "{}".to_string(),
                block_height: 100,
                verified_at: Utc::now().to_rfc3339(),
            }),
            grace_expires_at: None,
        };

        let status = fsm.build_status(&info);
        assert_eq!(status.state, SubscriptionState::Active);
        assert_eq!(status.txid, Some("test_txid".to_string()));
        assert!(status.cached_proof);
        assert_eq!(status.block_height, Some(100));
    }
}
