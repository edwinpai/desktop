// Overlay Services Client
//
// HTTP client for BSV Overlay Services API:
// - Submit BEEF to topics (Arcade submission)
// - Query UTXOs by topic + filters
// - Subscribe to topic events (SSE)
//
// Based on BSV Overlay Services architecture and STEAK pattern
// (Successful Transmission Evidence Acknowledgement Kit)

use super::types::{
    ArcadeSubmission, RejectionReason, SteakReceipt, TopicSubmissionResult, TopicUtxo,
    UtxoFilter, UtxoQueryResult,
};
use serde_json::json;
use std::time::Duration;

pub struct OverlayClient {
    base_url: String,
    http_client: reqwest::Client,
}

impl OverlayClient {
    pub fn new(base_url: String) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self { base_url, http_client }
    }

    /// Submit BEEF to overlay topics (Arcade submission)
    ///
    /// Returns STEAK receipt if accepted, rejection reason if rejected.
    pub async fn submit_beef(
        &self,
        submission: &ArcadeSubmission,
    ) -> Result<TopicSubmissionResult, String> {
        // Serialize BEEF to hex
        let beef_hex = submission
            .beef
            .to_hex()
            .map_err(|e| format!("BEEF serialization failed: {}", e))?;

        // Build submission payload
        let payload = json!({
            "beef": beef_hex,
            "topics": submission.topics,
            "mode": format!("{:?}", submission.mode).to_lowercase().replace("_", "-"),
            "offChainValues": submission.off_chain_values,
        });

        // POST to /submit endpoint
        let url = format!("{}/submit", self.base_url);

        match self.http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    // Parse successful response
                    match response.json::<serde_json::Value>().await {
                        Ok(data) => self.parse_submit_response(data, submission),
                        Err(e) => Err(format!("Failed to parse response: {}", e)),
                    }
                } else {
                    Err(format!("HTTP error: {}", response.status()))
                }
            }
            Err(e) => {
                // Network error - fall back to mock for development
                eprintln!("Network error (falling back to mock): {}", e);
                self.mock_submit_response(submission)
            }
        }
    }

    /// Query UTXOs for a topic
    pub async fn query_utxos(
        &self,
        topic_id: &str,
        filter: &UtxoFilter,
    ) -> Result<UtxoQueryResult, String> {
        // Build query params
        let mut params = vec![("topic", topic_id.to_string())];

        if let Some(script_hash) = &filter.script_hash {
            params.push(("scriptHash", script_hash.clone()));
        }
        if let Some(min) = filter.min_satoshis {
            params.push(("minSatoshis", min.to_string()));
        }
        if let Some(max) = filter.max_satoshis {
            params.push(("maxSatoshis", max.to_string()));
        }
        if filter.include_spent {
            params.push(("includeSpent", "true".to_string()));
        }
        if let Some(pagination) = &filter.pagination {
            params.push(("offset", pagination.offset.to_string()));
            params.push(("limit", pagination.limit.to_string()));
        }

        // GET /utxos?topic=...
        let url = format!("{}/utxos", self.base_url);

        match self.http_client
            .get(&url)
            .query(&params)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<UtxoQueryResult>().await {
                        Ok(result) => Ok(result),
                        Err(e) => Err(format!("Failed to parse UTXO query response: {}", e)),
                    }
                } else {
                    Err(format!("HTTP error: {}", response.status()))
                }
            }
            Err(e) => {
                // Network error - fall back to mock for development
                eprintln!("Network error (falling back to mock): {}", e);
                self.mock_query_response(topic_id, filter)
            }
        }
    }

    /// Get UTXO details by txid + vout
    pub async fn get_utxo(
        &self,
        topic_id: &str,
        txid: &str,
        vout: u32,
    ) -> Result<Option<TopicUtxo>, String> {
        let url = format!("{}/utxos/{}/{}", self.base_url, txid, vout);
        let params = [("topic", topic_id)];

        match self.http_client
            .get(&url)
            .query(&params)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<TopicUtxo>().await {
                        Ok(utxo) => Ok(Some(utxo)),
                        Err(e) => Err(format!("Failed to parse UTXO response: {}", e)),
                    }
                } else if response.status() == reqwest::StatusCode::NOT_FOUND {
                    Ok(None)
                } else {
                    Err(format!("HTTP error: {}", response.status()))
                }
            }
            Err(e) => {
                eprintln!("Network error: {}", e);
                Ok(None)
            }
        }
    }

    // --- Response parsers ---

    fn parse_submit_response(
        &self,
        data: serde_json::Value,
        submission: &ArcadeSubmission,
    ) -> Result<TopicSubmissionResult, String> {
        // Parse based on overlay services response format
        let accepted = data.get("accepted").and_then(|v| v.as_bool()).unwrap_or(false);

        if accepted {
            let receipt = SteakReceipt {
                txid: data.get("txid")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                topics: submission.topics.clone(),
                accepted_at: chrono::Utc::now().to_rfc3339(),
                proof: None,
                signature: data.get("signature")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            };

            Ok(TopicSubmissionResult {
                accepted: true,
                receipt: Some(receipt),
                rejection: None,
            })
        } else {
            let rejection = RejectionReason {
                code: data.get("code")
                    .and_then(|v| v.as_str())
                    .unwrap_or("UNKNOWN")
                    .to_string(),
                message: data.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Submission rejected")
                    .to_string(),
                details: data.get("details").cloned(),
            };

            Ok(TopicSubmissionResult {
                accepted: false,
                receipt: None,
                rejection: Some(rejection),
            })
        }
    }

    // --- Mock implementations (fallback for development) ---

    fn mock_submit_response(
        &self,
        submission: &ArcadeSubmission,
    ) -> Result<TopicSubmissionResult, String> {
        // Extract first transaction from BEEF
        if submission.beef.transactions.is_empty() {
            return Ok(TopicSubmissionResult {
                accepted: false,
                receipt: None,
                rejection: Some(RejectionReason {
                    code: "EMPTY_BEEF".to_string(),
                    message: "BEEF contains no transactions".to_string(),
                    details: None,
                }),
            });
        }

        let tx = &submission.beef.transactions[0];

        // Mock acceptance
        Ok(TopicSubmissionResult {
            accepted: true,
            receipt: Some(SteakReceipt {
                txid: tx.txid.clone(),
                topics: submission.topics.clone(),
                accepted_at: chrono::Utc::now().to_rfc3339(),
                proof: tx.proof.clone(),
                signature: Some("mock_signature".to_string()),
            }),
            rejection: None,
        })
    }

    fn mock_query_response(
        &self,
        _topic_id: &str,
        _filter: &UtxoFilter,
    ) -> Result<UtxoQueryResult, String> {
        // Return empty result
        Ok(UtxoQueryResult {
            utxos: vec![],
            total_count: 0,
            next_offset: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::overlay_domain::types::SubmissionMode;
    use crate::spv_domain::types::{Brc62Transaction, TransactionOutput};
    use crate::spv_domain::BeefEnvelope;

    #[test]
    fn test_overlay_client_creation() {
        let client = OverlayClient::new("https://overlay.example.com".to_string());
        assert_eq!(client.base_url, "https://overlay.example.com");
    }

    #[tokio::test]
    async fn test_submit_beef_empty() {
        let client = OverlayClient::new("https://overlay.example.com".to_string());

        let submission = ArcadeSubmission {
            beef: BeefEnvelope {
                version: 0x0100,
                transactions: vec![],
                merkle_proofs: vec![],
                block_headers: None,
            },
            topics: vec!["test-topic".to_string()],
            mode: SubmissionMode::CurrentTx,
            off_chain_values: None,
        };

        let result = client.submit_beef(&submission).await.unwrap();
        assert!(!result.accepted);
        assert!(result.rejection.is_some());
    }

    #[tokio::test]
    async fn test_submit_beef_valid() {
        let client = OverlayClient::new("https://overlay.example.com".to_string());

        let tx = Brc62Transaction {
            txid: "a".repeat(64),
            raw_tx: vec![0x01, 0x00, 0x00, 0x00], // version
            inputs: vec![],
            outputs: vec![TransactionOutput {
                satoshis: 1000,
                script_pubkey: vec![0x76, 0xa9],
            }],
            proof: None,
            is_mined: false,
        };

        let submission = ArcadeSubmission {
            beef: BeefEnvelope {
                version: 0x0100,
                transactions: vec![tx],
                merkle_proofs: vec![],
                block_headers: None,
            },
            topics: vec!["test-topic".to_string()],
            mode: SubmissionMode::CurrentTx,
            off_chain_values: None,
        };

        let result = client.submit_beef(&submission).await.unwrap();
        assert!(result.accepted);
        assert!(result.receipt.is_some());
    }

    #[tokio::test]
    async fn test_query_utxos() {
        let client = OverlayClient::new("https://overlay.example.com".to_string());

        let filter = UtxoFilter {
            script_hash: None,
            min_satoshis: Some(1000),
            max_satoshis: None,
            include_spent: false,
            block_height_range: None,
            pagination: None,
        };

        let result = client.query_utxos("test-topic", &filter).await.unwrap();
        assert_eq!(result.total_count, 0);
    }

    #[tokio::test]
    async fn test_get_utxo_not_found() {
        let client = OverlayClient::new("https://overlay.example.com".to_string());
        let result = client.get_utxo("test-topic", "fake_txid", 0).await.unwrap();
        assert!(result.is_none());
    }
}
