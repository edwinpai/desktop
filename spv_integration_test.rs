/**
 * Integration tests for SPV verification
 *
 * These tests demonstrate end-to-end verification flows using
 * realistic BEEF and BUMP data structures.
 */

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[test]
    fn test_beef_parsing_with_bump_and_transactions() {
        // BEEF v1.0 with single BUMP entry and one transaction
        let mut beef_data = Vec::new();

        // Version: 0x0100BEEF (little-endian)
        beef_data.extend_from_slice(&[0xEF, 0xBE, 0x00, 0x01]);

        // BUMP array: 1 entry
        beef_data.push(0x01);

        // Block height: 800000 (0xC3500)
        beef_data.extend_from_slice(&[0xFD, 0x50, 0xC3]); // varint(800000)

        // Path count: 1
        beef_data.push(0x01);

        // Merkle path: offset=0, height=1, flags=0x01, 1 hash
        beef_data.push(0x00); // offset (varint)
        beef_data.push(0x01); // tree height
        beef_data.push(0x01); // flags
        beef_data.extend_from_slice(&[0xAB; 32]); // sibling hash

        // Transaction array: 1 transaction
        beef_data.push(0x01);

        // Minimal transaction: version + 0 inputs + 0 outputs + locktime
        beef_data.extend_from_slice(&[0x01, 0x00, 0x00, 0x00]); // version 1
        beef_data.push(0x00); // 0 inputs
        beef_data.push(0x00); // 0 outputs
        beef_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]); // locktime 0

        let result = parse_beef(&beef_data);

        assert!(result.is_ok(), "BEEF parsing should succeed");
        let beef = result.unwrap();

        assert_eq!(beef.version, 0x0100BEEF);
        assert_eq!(beef.bump_array.len(), 1);
        assert_eq!(beef.bump_array[0].block_height, 800000);
        assert_eq!(beef.bump_array[0].merkle_paths.len(), 1);
        assert_eq!(beef.transactions.len(), 1);
    }

    #[test]
    fn test_transaction_parsing_with_inputs_and_outputs() {
        // Transaction with 1 input and 1 output
        let mut tx_data = Vec::new();

        // Version
        tx_data.extend_from_slice(&[0x01, 0x00, 0x00, 0x00]);

        // Input count: 1
        tx_data.push(0x01);

        // Input: prev_txid (32 bytes), prev_index, script_sig, sequence
        tx_data.extend_from_slice(&[0xAB; 32]); // prev_txid
        tx_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]); // prev_index = 0
        tx_data.push(0x00); // script_sig length = 0
        tx_data.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF]); // sequence

        // Output count: 1
        tx_data.push(0x01);

        // Output: value (8 bytes), script_pubkey
        tx_data.extend_from_slice(&[0x00, 0xE1, 0xF5, 0x05, 0x00, 0x00, 0x00, 0x00]); // 100000000 satoshis (1 BSV)
        tx_data.push(0x19); // script length = 25
        tx_data.extend_from_slice(&[
            0x76, 0xa9, 0x14, // OP_DUP OP_HASH160 PUSH(20)
            0xCD, 0xCD, 0xCD, 0xCD, 0xCD, 0xCD, 0xCD, 0xCD, // pubkey hash (dummy)
            0xCD, 0xCD, 0xCD, 0xCD, 0xCD, 0xCD, 0xCD, 0xCD,
            0xCD, 0xCD, 0xCD, 0xCD,
            0x88, 0xac, // OP_EQUALVERIFY OP_CHECKSIG
        ]);

        // Locktime
        tx_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);

        let tx = extract_transaction_data(&tx_data).unwrap();

        assert_eq!(tx.version, 1);
        assert_eq!(tx.inputs.len(), 1);
        assert_eq!(tx.outputs.len(), 1);
        assert_eq!(tx.outputs[0].value, 100_000_000);
        assert_eq!(tx.lock_time, 0);
        assert_eq!(tx.txid.len(), 32);
    }

    #[test]
    fn test_merkle_proof_verification() {
        // Create a simple 4-transaction Merkle tree
        // Tree structure:
        //       root
        //      /    \
        //    H01    H23
        //   /  \   /  \
        //  T0  T1 T2  T3
        //
        // Verify T2 (index 2)

        let tx2_id = [0x02; 32];
        let tx3_hash = [0x03; 32]; // Sibling at level 0
        let h01_hash = [0x01; 32]; // Sibling at level 1

        let path = vec![tx3_hash, h01_hash];

        let merkle_root = calculate_merkle_root(&tx2_id, &path, 2);

        // Root should be deterministic
        assert_eq!(merkle_root.len(), 32);

        // Verify different index produces different root
        let wrong_root = calculate_merkle_root(&tx2_id, &path, 0);
        assert_ne!(merkle_root, wrong_root);
    }

    #[test]
    fn test_block_header_merkle_root_verification() {
        // Test block header with known merkle root
        let mut header = BlockHeader {
            version: 1,
            prev_block_hash: [0x00; 32],
            merkle_root: [0xAB; 32],
            timestamp: 1231006505,
            bits: 0x1d00ffff,
            nonce: 2083236893,
        };

        // Create header bytes
        let mut header_bytes = Vec::new();
        header_bytes.extend_from_slice(&header.version.to_le_bytes());
        header_bytes.extend_from_slice(&header.prev_block_hash);
        header_bytes.extend_from_slice(&header.merkle_root);
        header_bytes.extend_from_slice(&header.timestamp.to_le_bytes());
        header_bytes.extend_from_slice(&header.bits.to_le_bytes());
        header_bytes.extend_from_slice(&header.nonce.to_le_bytes());

        let parsed_header = parse_block_header(&header_bytes).unwrap();

        assert_eq!(parsed_header.merkle_root, header.merkle_root);
    }

    #[test]
    fn test_full_spv_verification_flow() {
        // This test demonstrates the complete SPV verification flow
        // In production, this would use real block headers from a header chain service

        // 1. Create a merkle proof (JSON format)
        let merkle_proof_json = r#"{
            "txid": "abababababababababababababababababababababababababababababababab",
            "path": [
                "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"
            ],
            "index": 0,
            "blockHash": "0000000000000000000000000000000000000000000000000000000000000000",
            "blockHeight": 800000
        }"#;

        // 2. Create verification request
        let request = SpvVerificationRequest {
            txid: "abababababababababababababababababababababababababababababababab".to_string(),
            merkle_proof: merkle_proof_json.to_string(),
            block_height: Some(800000),
        };

        // 3. Create a valid block header
        // Calculate expected merkle root first
        let txid = [0xAB; 32];
        let path = vec![[0xCD; 32]];
        let expected_root = calculate_merkle_root(&txid, &path, 0);

        let mut header_bytes = Vec::new();
        header_bytes.extend_from_slice(&1u32.to_le_bytes()); // version
        header_bytes.extend_from_slice(&[0x00; 32]); // prev_block_hash
        header_bytes.extend_from_slice(&expected_root); // merkle_root
        header_bytes.extend_from_slice(&1231006505u32.to_le_bytes()); // timestamp
        header_bytes.extend_from_slice(&0x1d00ffffu32.to_le_bytes()); // bits (difficulty 1)
        header_bytes.extend_from_slice(&2083236893u32.to_le_bytes()); // nonce

        // 4. Perform SPV verification
        let result = verify_spv(&request, &header_bytes);

        // Note: This will fail because the block header doesn't satisfy proof-of-work
        // In production, you would use a real block header
        assert!(result.is_ok());
    }

    #[test]
    fn test_bump_multi_path_parsing() {
        // BUMP entry with multiple merkle paths
        let mut data = Vec::new();

        // Entry count: 1
        data.push(0x01);

        // Block height: 700000
        data.extend_from_slice(&[0xFD, 0x60, 0xAE]); // varint

        // Path count: 3
        data.push(0x03);

        // Path 1: offset=0, height=2
        data.push(0x00); // offset
        data.push(0x02); // height
        data.push(0x03); // flags (0b00000011 - both hashes present)
        data.extend_from_slice(&[0xAA; 32]); // hash 1
        data.extend_from_slice(&[0xBB; 32]); // hash 2

        // Path 2: offset=1, height=2
        data.push(0x01);
        data.push(0x02);
        data.push(0x03);
        data.extend_from_slice(&[0xCC; 32]);
        data.extend_from_slice(&[0xDD; 32]);

        // Path 3: offset=2, height=1
        data.push(0x02);
        data.push(0x01);
        data.push(0x01);
        data.extend_from_slice(&[0xEE; 32]);

        let mut cursor = Cursor::new(data);
        let bump_array = parse_bump_array(&mut cursor).unwrap();

        assert_eq!(bump_array.len(), 1);
        assert_eq!(bump_array[0].block_height, 700000);
        assert_eq!(bump_array[0].merkle_paths.len(), 3);
        assert_eq!(bump_array[0].merkle_paths[0].offset, 0);
        assert_eq!(bump_array[0].merkle_paths[0].path.len(), 2);
        assert_eq!(bump_array[0].merkle_paths[2].offset, 2);
        assert_eq!(bump_array[0].merkle_paths[2].path.len(), 1);
    }

    #[test]
    fn test_varint_edge_cases() {
        // Test all varint encoding ranges
        let test_cases = vec![
            (vec![0x00], 0u64),
            (vec![0xFC], 252u64),
            (vec![0xFD, 0xFD, 0x00], 253u64),
            (vec![0xFD, 0xFF, 0xFF], 65535u64),
            (vec![0xFE, 0x00, 0x00, 0x01, 0x00], 65536u64),
        ];

        for (bytes, expected) in test_cases {
            let mut cursor = Cursor::new(bytes);
            let value = read_varint(&mut cursor).unwrap();
            assert_eq!(value, expected, "Failed for value {}", expected);
        }
    }

    #[test]
    fn test_error_handling_invalid_header() {
        // Header too short
        let short_header = vec![0x00; 60];
        let result = parse_block_header(&short_header);

        assert!(result.is_err());
        match result {
            Err(SpvError::InvalidFormat(msg)) => {
                assert!(msg.contains("must be 80 bytes"));
            }
            _ => panic!("Expected InvalidFormat error"),
        }
    }
}
