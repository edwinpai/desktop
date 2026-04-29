// Topic Manager
//
// Manages overlay topics and UTXO tracking for subscription verification.
// Coordinates between Arcade client, SPV verifier, and subscription state machine.

use super::client::OverlayClient;
use super::types::{
    ArcadeConfig, ArcadeSubmission, OverlayTopic, TopicUtxo, UtxoFilter, UtxoQueryResult,
};
use crate::spv_domain::types::SubscriptionUtxo;
use std::collections::HashMap;

pub struct TopicManager {
    /// Overlay client for API calls
    client: OverlayClient,
    /// Arcade configuration
    config: ArcadeConfig,
    /// Registered topics
    topics: HashMap<String, OverlayTopic>,
}

impl TopicManager {
    pub fn new(config: ArcadeConfig) -> Self {
        let client = OverlayClient::new(config.base_url.clone());

        Self {
            client,
            config,
            topics: HashMap::new(),
        }
    }

    /// Register a topic for tracking
    pub fn register_topic(&mut self, topic: OverlayTopic) {
        self.topics.insert(topic.topic_id.clone(), topic);
    }

    /// Submit BEEF to Arcade
    pub async fn submit_to_arcade(
        &self,
        submission: &ArcadeSubmission,
    ) -> Result<String, String> {
        let result = self.client.submit_beef(submission).await?;

        if result.accepted {
            if let Some(receipt) = result.receipt {
                Ok(receipt.txid)
            } else {
                Err("Submission accepted but no receipt returned".to_string())
            }
        } else {
            if let Some(rejection) = result.rejection {
                Err(format!("{}: {}", rejection.code, rejection.message))
            } else {
                Err("Submission rejected with no reason".to_string())
            }
        }
    }

    /// Query subscription UTXO by script hash
    ///
    /// Used by subscription state machine to check if subscription is active.
    pub async fn query_subscription_utxo(
        &self,
        script_hash: &str,
    ) -> Result<Option<SubscriptionUtxo>, String> {
        let filter = UtxoFilter {
            script_hash: Some(script_hash.to_string()),
            min_satoshis: None,
            max_satoshis: None,
            include_spent: false,
            block_height_range: None,
            pagination: None,
        };

        let result = self
            .client
            .query_utxos(&self.config.subscription_topic, &filter)
            .await?;

        // Convert first UTXO to SubscriptionUtxo
        if let Some(utxo) = result.utxos.first() {
            Ok(Some(self.convert_topic_utxo_to_subscription(utxo)?))
        } else {
            Ok(None)
        }
    }

    /// Check if subscription UTXO is spent
    pub async fn check_utxo_spent(
        &self,
        txid: &str,
        vout: u32,
    ) -> Result<bool, String> {
        let utxo = self
            .client
            .get_utxo(&self.config.subscription_topic, txid, vout)
            .await?;

        Ok(utxo.map(|u| u.spent).unwrap_or(true))
    }

    /// Get all UTXOs for a topic
    pub async fn get_topic_utxos(
        &self,
        topic_id: &str,
        filter: &UtxoFilter,
    ) -> Result<UtxoQueryResult, String> {
        self.client.query_utxos(topic_id, filter).await
    }

    /// Convert TopicUtxo to SubscriptionUtxo
    fn convert_topic_utxo_to_subscription(
        &self,
        utxo: &TopicUtxo,
    ) -> Result<SubscriptionUtxo, String> {
        // Parse script_pubkey from hex
        let script_pubkey = hex::decode(&utxo.script_pubkey)
            .map_err(|e| format!("Invalid script_pubkey: {}", e))?;

        // TODO: Extract Merkle proof from overlay response
        let proof = None;

        Ok(SubscriptionUtxo {
            txid: utxo.txid.clone(),
            vout: utxo.vout,
            satoshis: utxo.satoshis,
            script_pubkey,
            proof,
            spent: utxo.spent,
        })
    }

    /// Get configuration
    pub fn config(&self) -> &ArcadeConfig {
        &self.config
    }

    /// Get registered topics
    pub fn topics(&self) -> &HashMap<String, OverlayTopic> {
        &self.topics
    }
}

impl Default for TopicManager {
    fn default() -> Self {
        Self::new(ArcadeConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_topic_manager_creation() {
        let config = ArcadeConfig::default();
        let manager = TopicManager::new(config.clone());

        assert_eq!(manager.config.base_url, config.base_url);
        assert!(manager.topics.is_empty());
    }

    #[test]
    fn test_register_topic() {
        let mut manager = TopicManager::default();

        let topic = OverlayTopic {
            topic_id: "test-topic".to_string(),
            description: "Test topic".to_string(),
            manager_url: "https://overlay.example.com".to_string(),
            admission_rules: None,
        };

        manager.register_topic(topic.clone());
        assert!(manager.topics.contains_key("test-topic"));
        assert_eq!(manager.topics.get("test-topic").unwrap().description, "Test topic");
    }

    #[tokio::test]
    async fn test_query_subscription_utxo_not_found() {
        let manager = TopicManager::default();
        let result = manager.query_subscription_utxo("test_hash").await.unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_convert_topic_utxo() {
        let manager = TopicManager::default();

        let topic_utxo = TopicUtxo {
            txid: "a".repeat(64),
            vout: 0,
            satoshis: 1000,
            script_pubkey: "76a9".to_string(),
            block_height: Some(100),
            spent: false,
            spent_by: None,
            metadata: None,
        };

        let result = manager.convert_topic_utxo_to_subscription(&topic_utxo);
        assert!(result.is_ok());

        let sub_utxo = result.unwrap();
        assert_eq!(sub_utxo.txid, topic_utxo.txid);
        assert_eq!(sub_utxo.satoshis, 1000);
        assert!(!sub_utxo.spent);
    }
}
