// Merkle Proof Validation
//
// Implements SPV Merkle proof verification per BRC-9, BRC-67:
// 1. Start with transaction hash (leaf)
// 2. Iterate through proof nodes, hashing left/right pairs
// 3. Verify final hash matches the Merkle root in block header
//
// BRC-67: "Bitcoin's security model is built upon widespread distribution of
// block headers, where applications run SPV. This ensures anyone can identify
// attempts to commit fraud using tampered data."

use super::beef::double_sha256;
use super::types::{BlockHeader, MerkleProof};

/// Verify Merkle proof for a transaction
///
/// Returns true if the txid, when combined with the proof nodes,
/// produces the expected Merkle root.
pub fn verify_merkle_proof(txid: &str, proof: &MerkleProof) -> Result<bool, String> {
    // Parse txid as 32-byte hash
    let txid_bytes = hex::decode(txid)
        .map_err(|e| format!("Invalid txid hex: {}", e))?;

    if txid_bytes.len() != 32 {
        return Err(format!("Invalid txid length: expected 32, got {}", txid_bytes.len()));
    }

    // Start with txid as current hash (Bitcoin uses reversed byte order)
    let mut current_hash = txid_bytes;
    current_hash.reverse();

    // Iterate through Merkle proof nodes
    for node in &proof.nodes {
        let node_bytes = hex::decode(&node.hash)
            .map_err(|e| format!("Invalid node hash: {}", e))?;

        if node_bytes.len() != 32 {
            return Err(format!("Invalid node hash length: expected 32, got {}", node_bytes.len()));
        }

        // Concatenate hashes based on isLeft flag
        let combined = if node.is_left {
            // Node is on left, current is on right
            [&node_bytes[..], &current_hash[..]].concat()
        } else {
            // Current is on left, node is on right
            [&current_hash[..], &node_bytes[..]].concat()
        };

        // Hash the combined pair
        current_hash = double_sha256(&combined).to_vec();
    }

    // Reverse back to display format
    current_hash.reverse();

    // Compare with expected Merkle root
    let computed_root = hex::encode(&current_hash);
    let expected_root = proof.merkle_root.to_lowercase();

    Ok(computed_root.to_lowercase() == expected_root)
}

/// Verify block header proof-of-work (hash < target)
pub fn verify_block_header_pow(header: &BlockHeader) -> Result<bool, String> {
    // Calculate block hash from header fields
    let calculated_hash = calculate_block_hash(header)?;

    // Verify hash matches header.hash
    if calculated_hash.to_lowercase() != header.hash.to_lowercase() {
        return Ok(false);
    }

    // Verify proof-of-work: hash < target
    let target = bits_to_target(header.bits);
    let hash_num = hash_to_number(&calculated_hash)?;

    Ok(hash_num < target)
}

/// Calculate block hash from header fields
///
/// Block header structure (80 bytes):
/// - version (4 bytes)
/// - prev_hash (32 bytes)
/// - merkle_root (32 bytes)
/// - timestamp (4 bytes)
/// - bits (4 bytes)
/// - nonce (4 bytes)
///
/// Hash = double_sha256(header_bytes)
pub fn calculate_block_hash(header: &BlockHeader) -> Result<String, String> {
    let mut header_bytes = Vec::with_capacity(80);

    // Version (4 bytes, little-endian)
    header_bytes.extend_from_slice(&header.version.to_le_bytes());

    // Previous block hash (32 bytes, reversed)
    let mut prev_hash = hex::decode(&header.prev_hash)
        .map_err(|e| format!("Invalid prev_hash: {}", e))?;
    if prev_hash.len() != 32 {
        return Err(format!("Invalid prev_hash length: {}", prev_hash.len()));
    }
    prev_hash.reverse();
    header_bytes.extend_from_slice(&prev_hash);

    // Merkle root (32 bytes, reversed)
    let mut merkle_root = hex::decode(&header.merkle_root)
        .map_err(|e| format!("Invalid merkle_root: {}", e))?;
    if merkle_root.len() != 32 {
        return Err(format!("Invalid merkle_root length: {}", merkle_root.len()));
    }
    merkle_root.reverse();
    header_bytes.extend_from_slice(&merkle_root);

    // Timestamp (4 bytes, little-endian)
    header_bytes.extend_from_slice(&header.timestamp.to_le_bytes());

    // Bits (4 bytes, little-endian)
    header_bytes.extend_from_slice(&header.bits.to_le_bytes());

    // Nonce (4 bytes, little-endian)
    header_bytes.extend_from_slice(&header.nonce.to_le_bytes());

    // Double SHA256
    let hash = double_sha256(&header_bytes);

    // Reverse for display format
    let mut display_hash = hash.to_vec();
    display_hash.reverse();

    Ok(hex::encode(&display_hash))
}

/// Convert difficulty bits to target (256-bit number)
fn bits_to_target(bits: u32) -> [u8; 32] {
    let exponent = (bits >> 24) as usize;
    let mantissa = bits & 0x00FFFFFF;

    let mut target = [0u8; 32];

    if exponent <= 3 {
        let mantissa_bytes = mantissa.to_be_bytes();
        for i in 0..exponent {
            if i < 3 {
                target[32 - exponent + i] = mantissa_bytes[1 + i];
            }
        }
    } else {
        let mantissa_bytes = mantissa.to_be_bytes();
        let offset = 32 - exponent;
        target[offset] = mantissa_bytes[1];
        target[offset + 1] = mantissa_bytes[2];
        target[offset + 2] = mantissa_bytes[3];
    }

    target
}

/// Convert hash string to 256-bit number (big-endian)
fn hash_to_number(hash: &str) -> Result<[u8; 32], String> {
    let bytes = hex::decode(hash)
        .map_err(|e| format!("Invalid hash hex: {}", e))?;

    if bytes.len() != 32 {
        return Err(format!("Invalid hash length: {}", bytes.len()));
    }

    let mut result = [0u8; 32];
    result.copy_from_slice(&bytes);

    Ok(result)
}

/// Build Merkle root from transaction hashes
///
/// Used for testing and Merkle tree construction.
/// Transactions must be in block order.
pub fn build_merkle_root(tx_hashes: &[String]) -> Result<String, String> {
    if tx_hashes.is_empty() {
        return Err("Cannot build Merkle root from empty list".to_string());
    }

    // Parse all hashes
    let mut current_level: Vec<Vec<u8>> = tx_hashes
        .iter()
        .map(|h| {
            let mut bytes = hex::decode(h).map_err(|e| format!("Invalid hash: {}", e))?;
            bytes.reverse(); // Bitcoin internal format
            Ok(bytes)
        })
        .collect::<Result<Vec<_>, String>>()?;

    // Build tree bottom-up
    while current_level.len() > 1 {
        let mut next_level = Vec::new();

        // Process pairs
        for i in (0..current_level.len()).step_by(2) {
            let left = &current_level[i];
            let right = if i + 1 < current_level.len() {
                &current_level[i + 1]
            } else {
                // Odd number of hashes: duplicate last one
                &current_level[i]
            };

            // Hash pair
            let combined = [&left[..], &right[..]].concat();
            let hash = double_sha256(&combined).to_vec();
            next_level.push(hash);
        }

        current_level = next_level;
    }

    // Return root (reversed to display format)
    let mut root = current_level[0].clone();
    root.reverse();
    Ok(hex::encode(&root))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_merkle_root_single() {
        let tx_hashes = vec![
            "a".repeat(64), // 32 bytes hex
        ];
        let root = build_merkle_root(&tx_hashes);
        assert!(root.is_ok());
    }

    #[test]
    fn test_build_merkle_root_pair() {
        let tx1 = "a".repeat(64);
        let tx2 = "b".repeat(64);
        let root = build_merkle_root(&vec![tx1, tx2]);
        assert!(root.is_ok());
    }

    #[test]
    fn test_bits_to_target() {
        // Difficulty bits for a typical block
        let bits = 0x1d00ffff;
        let target = bits_to_target(bits);
        assert_eq!(target.len(), 32);
    }

    #[test]
    fn test_verify_merkle_proof_invalid_txid() {
        let proof = MerkleProof {
            tx_index: 0,
            block_height: 100,
            merkle_root: "a".repeat(64),
            nodes: vec![],
            tx_count: None,
        };

        let result = verify_merkle_proof("invalid", &proof);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_block_hash() {
        // Genesis block header
        let header = BlockHeader {
            height: 0,
            hash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f".to_string(),
            version: 1,
            prev_hash: "0".repeat(64),
            merkle_root: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b".to_string(),
            timestamp: 1231006505,
            bits: 0x1d00ffff,
            nonce: 2083236893,
        };

        let calculated = calculate_block_hash(&header).unwrap();
        assert_eq!(calculated.to_lowercase(), header.hash.to_lowercase());
    }
}
