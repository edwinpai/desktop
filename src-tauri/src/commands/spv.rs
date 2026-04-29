// SPV Domain Tauri commands (Phase 2)
//
// IPC layer for SPV verification and subscription checking.

use crate::overlay_domain::manager::TopicManager;
use crate::overlay_domain::types::{ArcadeConfig, ArcadeSubmission};
use crate::spv_domain::types::BeefEnvelope;
use crate::spv_domain::verifier::SpvVerifier;
use crate::subscription::fsm::SubscriptionFSM;
use crate::subscription::types::{
    CheckSubscriptionRequest, CheckSubscriptionResponse, SubscriptionConfig,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

// Global state (in a real app, this would be managed by Tauri state)
// Using tokio::sync::Mutex for Send + Sync compatibility with async functions
lazy_static::lazy_static! {
    static ref SPV_VERIFIER: Arc<Mutex<SpvVerifier>> = Arc::new(Mutex::new(SpvVerifier::new()));
    static ref TOPIC_MANAGER: Arc<Mutex<TopicManager>> = {
        let config = ArcadeConfig::default();
        Arc::new(Mutex::new(TopicManager::new(config)))
    };
    static ref SUBSCRIPTION_FSM: Arc<Mutex<SubscriptionFSM>> = {
        let sub_config = SubscriptionConfig::default();
        let arcade_config = ArcadeConfig::default();
        let spv = Arc::new(Mutex::new(SpvVerifier::new()));
        let manager = Arc::new(Mutex::new(TopicManager::new(arcade_config)));
        Arc::new(Mutex::new(SubscriptionFSM::new(spv, manager, sub_config)))
    };
}

// --- Command Types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpvVerifyRequest {
    /// BEEF envelope (hex-encoded)
    pub beef_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpvVerifyResponse {
    /// Whether the transaction is valid
    pub valid: bool,
    /// Transaction ID
    pub txid: String,
    /// Block height (if confirmed)
    pub block_height: Option<u32>,
    /// Number of confirmations
    pub confirmations: Option<u32>,
    /// Error message (if validation failed)
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitToArcadeRequest {
    /// BEEF envelope (hex-encoded)
    pub beef_hex: String,
    /// Topics to submit to
    pub topics: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitToArcadeResponse {
    /// Transaction ID
    pub txid: String,
    /// Whether submission was accepted
    pub accepted: bool,
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn spv_verify(request: SpvVerifyRequest) -> Result<SpvVerifyResponse, String> {
    let verifier = SPV_VERIFIER.lock().await;
    let (verification, _utxo) = verifier.verify_beef(&request.beef_hex)?;

    Ok(SpvVerifyResponse {
        valid: verification.valid,
        txid: verification.txid,
        block_height: verification.block_height,
        confirmations: verification.confirmations,
        error: verification.error,
    })
}

#[tauri::command]
pub async fn check_subscription(
    request: CheckSubscriptionRequest,
) -> Result<CheckSubscriptionResponse, String> {
    let fsm = SUBSCRIPTION_FSM.lock().await;
    fsm.check_subscription(&request).await
}

#[tauri::command]
pub async fn submit_to_arcade(
    request: SubmitToArcadeRequest,
) -> Result<SubmitToArcadeResponse, String> {
    // Parse BEEF
    let beef = BeefEnvelope::from_hex(&request.beef_hex)?;

    let submission = ArcadeSubmission {
        beef,
        topics: request.topics,
        mode: crate::overlay_domain::types::SubmissionMode::CurrentTx,
        off_chain_values: None,
    };

    let manager = TOPIC_MANAGER.lock().await;
    let txid = manager.submit_to_arcade(&submission).await?;

    Ok(SubmitToArcadeResponse {
        txid,
        accepted: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_spv_verify_invalid_hex() {
        let request = SpvVerifyRequest {
            beef_hex: "invalid_hex".to_string(),
        };

        let result = spv_verify(request).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_check_subscription_not_found() {
        let request = CheckSubscriptionRequest {
            force_refresh: false,
        };

        let response = check_subscription(request).await.unwrap();
        assert_eq!(
            response.status.state,
            crate::subscription::types::SubscriptionState::NotFound
        );
    }

    #[tokio::test]
    async fn test_submit_to_arcade_invalid_beef() {
        let request = SubmitToArcadeRequest {
            beef_hex: "invalid".to_string(),
            topics: vec!["test-topic".to_string()],
        };

        let result = submit_to_arcade(request).await;
        assert!(result.is_err());
    }
}
