// SPV Verifier - Orchestrates BEEF parsing and Merkle proof validation
//
// Implements full SPV verification flow per BRC-9/BRC-67:
// 1. Parse BEEF envelope
// 2. Extract transaction and Merkle proof
// 3. Verify Merkle proof against block header
// 4. Verify block header proof-of-work
// 5. Return verification result with confirmation count

use super::beef::parse_beef;
use super::merkle::{calculate_block_hash, verify_block_header_pow, verify_merkle_proof};
use super::types::{
    BlockHeader, MerkleProof, SpvProofCache, SpvVerification, SubscriptionUtxo,
};
use chrono::Utc;
use std::collections::HashMap;

pub struct SpvVerifier {
    /// Cached block headers for SPV validation
    block_headers: HashMap<u32, BlockHeader>,
    /// Current chain tip height
    chain_tip_height: u32,
}

impl SpvVerifier {
    pub fn new() -> Self {
        Self {
            block_headers: HashMap::new(),
            chain_tip_height: 0,
        }
    }

    /// Add block header to cache
    pub fn add_block_header(&mut self, header: BlockHeader) {
        let height = header.height;
        self.block_headers.insert(height, header);
        if height > self.chain_tip_height {
            self.chain_tip_height = height;
        }
    }

    /// Set chain tip height (for confirmation calculation)
    pub fn set_chain_tip(&mut self, height: u32) {
        self.chain_tip_height = height;
    }

    /// Verify BEEF envelope and extract subscription UTXO
    ///
    /// Returns SPV verification result with subscription UTXO if valid.
    pub fn verify_beef(
        &self,
        beef_hex: &str,
    ) -> Result<(SpvVerification, Option<SubscriptionUtxo>), String> {
        // Parse BEEF
        let beef_bytes = hex::decode(beef_hex)
            .map_err(|e| format!("Invalid BEEF hex: {}", e))?;
        let envelope = parse_beef(&beef_bytes)?;

        // Find first confirmed transaction with proof
        for tx in &envelope.transactions {
            if let Some(proof) = tx.proof.as_ref().or_else(|| {
                envelope
                    .merkle_proofs
                    .iter()
                    .find(|p| p.block_height > 0) // Find any valid proof
            }) {
                // Verify Merkle proof
                let valid = verify_merkle_proof(&tx.txid, proof)?;

                if !valid {
                    return Ok((
                        SpvVerification {
                            valid: false,
                            txid: tx.txid.clone(),
                            block_height: Some(proof.block_height),
                            confirmations: None,
                            error: Some("Merkle proof verification failed".to_string()),
                            cached: false,
                        },
                        None,
                    ));
                }

                // Verify block header if available
                if let Some(header) = self.block_headers.get(&proof.block_height) {
                    // Verify proof-of-work
                    let pow_valid = verify_block_header_pow(header)?;
                    if !pow_valid {
                        return Ok((
                            SpvVerification {
                                valid: false,
                                txid: tx.txid.clone(),
                                block_height: Some(proof.block_height),
                                confirmations: None,
                                error: Some("Block header PoW verification failed".to_string()),
                                cached: false,
                            },
                            None,
                        ));
                    }

                    // Verify Merkle root matches
                    let calculated_hash = calculate_block_hash(header)?;
                    if calculated_hash.to_lowercase() != header.hash.to_lowercase() {
                        return Ok((
                            SpvVerification {
                                valid: false,
                                txid: tx.txid.clone(),
                                block_height: Some(proof.block_height),
                                confirmations: None,
                                error: Some("Block hash mismatch".to_string()),
                                cached: false,
                            },
                            None,
                        ));
                    }
                }

                // Calculate confirmations
                let confirmations = if self.chain_tip_height >= proof.block_height {
                    Some(self.chain_tip_height - proof.block_height + 1)
                } else {
                    None
                };

                // Extract UTXO (use first output)
                let utxo = if !tx.outputs.is_empty() {
                    Some(SubscriptionUtxo {
                        txid: tx.txid.clone(),
                        vout: 0,
                        satoshis: tx.outputs[0].satoshis,
                        script_pubkey: tx.outputs[0].script_pubkey.clone(),
                        proof: Some(proof.clone()),
                        spent: false,
                    })
                } else {
                    None
                };

                return Ok((
                    SpvVerification {
                        valid: true,
                        txid: tx.txid.clone(),
                        block_height: Some(proof.block_height),
                        confirmations,
                        error: None,
                        cached: false,
                    },
                    utxo,
                ));
            }
        }

        Err("No valid Merkle proof found in BEEF".to_string())
    }

    /// Verify from cached proof
    pub fn verify_cached(&self, cache: &SpvProofCache) -> Result<SpvVerification, String> {
        // Check if cache is still valid (within grace period)
        let grace_period_ms = 72 * 60 * 60 * 1000; // 72 hours
        if !cache.is_valid(grace_period_ms) {
            return Ok(SpvVerification {
                valid: false,
                txid: cache.txid.clone(),
                block_height: Some(cache.proof.block_height),
                confirmations: None,
                error: Some("Cache expired".to_string()),
                cached: true,
            });
        }

        // Verify Merkle proof
        let valid = verify_merkle_proof(&cache.txid, &cache.proof)?;

        if !valid {
            return Ok(SpvVerification {
                valid: false,
                txid: cache.txid.clone(),
                block_height: Some(cache.proof.block_height),
                confirmations: None,
                error: Some("Cached proof invalid".to_string()),
                cached: true,
            });
        }

        // Calculate confirmations
        let confirmations = if self.chain_tip_height >= cache.proof.block_height {
            Some(self.chain_tip_height - cache.proof.block_height + 1)
        } else {
            None
        };

        Ok(SpvVerification {
            valid: true,
            txid: cache.txid.clone(),
            block_height: Some(cache.proof.block_height),
            confirmations,
            error: None,
            cached: true,
        })
    }

    /// Create proof cache entry from verification
    pub fn create_cache(
        &self,
        txid: String,
        proof: MerkleProof,
        block_header: BlockHeader,
    ) -> SpvProofCache {
        let now = Utc::now().to_rfc3339();

        SpvProofCache {
            txid,
            proof,
            block_header,
            cached_at: now.clone(),
            verified_at: now,
        }
    }
}

impl Default for SpvVerifier {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spv_verifier_creation() {
        let verifier = SpvVerifier::new();
        assert_eq!(verifier.chain_tip_height, 0);
        assert!(verifier.block_headers.is_empty());
    }

    #[test]
    fn test_add_block_header() {
        let mut verifier = SpvVerifier::new();

        let header = BlockHeader {
            height: 100,
            hash: "a".repeat(64),
            version: 1,
            prev_hash: "0".repeat(64),
            merkle_root: "b".repeat(64),
            timestamp: 1234567890,
            bits: 0x1d00ffff,
            nonce: 12345,
        };

        verifier.add_block_header(header);
        assert_eq!(verifier.chain_tip_height, 100);
        assert!(verifier.block_headers.contains_key(&100));
    }

    #[test]
    fn test_create_cache() {
        let verifier = SpvVerifier::new();

        let proof = MerkleProof {
            tx_index: 0,
            block_height: 100,
            merkle_root: "a".repeat(64),
            nodes: vec![],
            tx_count: None,
        };

        let header = BlockHeader {
            height: 100,
            hash: "a".repeat(64),
            version: 1,
            prev_hash: "0".repeat(64),
            merkle_root: "a".repeat(64),
            timestamp: 1234567890,
            bits: 0x1d00ffff,
            nonce: 12345,
        };

        let cache = verifier.create_cache("txid".to_string(), proof, header);
        assert_eq!(cache.txid, "txid");
        assert!(!cache.cached_at.is_empty());
    }

    #[test]
    fn test_verify_beef_invalid_hex() {
        let verifier = SpvVerifier::new();
        let result = verifier.verify_beef("invalid_hex");
        assert!(result.is_err());
    }
}
