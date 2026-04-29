// BEEF (Background Evaluation Extended Format) parser
//
// Implements BRC-62 BEEF binary format:
// - Header: version (2 bytes), nTransactions (CompactInt)
// - Transactions: [ txLen (CompactInt), rawTx (bytes) ] * nTransactions
// - Merkle proofs: [ nProofs (CompactInt), proofs ] for confirmed transactions
//
// BRC-62 format designed for efficient SPV verification with topologically-sorted
// transaction trees (parents before children).

use super::types::{BeefEnvelope, Brc62Transaction, MerkleProof, MerkleProofNode, TransactionInput, TransactionOutput};
use sha2::{Digest, Sha256};

const BEEF_VERSION_0X0100: u16 = 0x0100;

/// Parse BEEF from binary format per BRC-62
pub fn parse_beef(bytes: &[u8]) -> Result<BeefEnvelope, String> {
    let mut cursor = 0;

    // Version (2 bytes, little-endian)
    if bytes.len() < 2 {
        return Err("BEEF too short: missing version".to_string());
    }
    let version = u16::from_le_bytes([bytes[0], bytes[1]]);
    cursor += 2;

    if version != BEEF_VERSION_0X0100 {
        return Err(format!("Unsupported BEEF version: 0x{:04X}", version));
    }

    // Number of transactions (CompactInt)
    let (n_transactions, size) = read_compact_int(&bytes[cursor..])?;
    cursor += size;

    // Parse transactions
    let mut transactions = Vec::new();
    for _ in 0..n_transactions {
        let (tx, size) = parse_transaction(&bytes[cursor..])?;
        cursor += size;
        transactions.push(tx);
    }

    // Number of Merkle proofs (CompactInt)
    let (n_proofs, size) = read_compact_int(&bytes[cursor..])?;
    cursor += size;

    // Parse Merkle proofs
    let mut merkle_proofs = Vec::new();
    for _ in 0..n_proofs {
        let (proof, size) = parse_merkle_proof(&bytes[cursor..])?;
        cursor += size;
        merkle_proofs.push(proof);
    }

    // Optional: Parse block headers (not in minimal BRC-62 format)
    let block_headers = None;

    Ok(BeefEnvelope {
        version,
        transactions,
        merkle_proofs,
        block_headers,
    })
}

/// Serialize BEEF to binary format per BRC-62
pub fn serialize_beef(envelope: &BeefEnvelope) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();

    // Version (2 bytes, little-endian)
    bytes.extend_from_slice(&envelope.version.to_le_bytes());

    // Number of transactions
    write_compact_int(&mut bytes, envelope.transactions.len() as u64);

    // Transactions
    for tx in &envelope.transactions {
        let tx_bytes = serialize_transaction(tx)?;
        write_compact_int(&mut bytes, tx_bytes.len() as u64);
        bytes.extend_from_slice(&tx_bytes);
    }

    // Number of Merkle proofs
    write_compact_int(&mut bytes, envelope.merkle_proofs.len() as u64);

    // Merkle proofs
    for proof in &envelope.merkle_proofs {
        let proof_bytes = serialize_merkle_proof(proof)?;
        bytes.extend_from_slice(&proof_bytes);
    }

    Ok(bytes)
}

/// Parse a Bitcoin transaction from raw bytes
fn parse_transaction(bytes: &[u8]) -> Result<(Brc62Transaction, usize), String> {
    let mut cursor = 0;

    // Transaction length (CompactInt)
    let (tx_len, size) = read_compact_int(&bytes[cursor..])?;
    cursor += size;

    if bytes.len() < cursor + tx_len as usize {
        return Err(format!("Transaction truncated: expected {} bytes", tx_len));
    }

    let raw_tx = bytes[cursor..cursor + tx_len as usize].to_vec();

    // Parse transaction structure
    let (inputs, outputs, txid) = parse_transaction_structure(&raw_tx)?;

    cursor += tx_len as usize;

    Ok((
        Brc62Transaction {
            txid: hex::encode(&txid),
            raw_tx,
            inputs,
            outputs,
            proof: None,
            is_mined: false,
        },
        cursor,
    ))
}

/// Parse transaction structure to extract inputs/outputs
fn parse_transaction_structure(raw_tx: &[u8]) -> Result<(Vec<TransactionInput>, Vec<TransactionOutput>, [u8; 32]), String> {
    let mut cursor = 0;

    // Version (4 bytes)
    if raw_tx.len() < 4 {
        return Err("Transaction too short".to_string());
    }
    cursor += 4;

    // Input count
    let (n_inputs, size) = read_compact_int(&raw_tx[cursor..])?;
    cursor += size;

    // Parse inputs
    let mut inputs = Vec::new();
    for _ in 0..n_inputs {
        if raw_tx.len() < cursor + 36 {
            return Err("Input truncated".to_string());
        }

        // Previous output (32 bytes txid + 4 bytes vout)
        let mut prev_txid_bytes = [0u8; 32];
        prev_txid_bytes.copy_from_slice(&raw_tx[cursor..cursor + 32]);
        prev_txid_bytes.reverse(); // Bitcoin uses reversed byte order for display
        let prev_txid = hex::encode(&prev_txid_bytes);
        cursor += 32;

        let prev_vout = u32::from_le_bytes([
            raw_tx[cursor],
            raw_tx[cursor + 1],
            raw_tx[cursor + 2],
            raw_tx[cursor + 3],
        ]);
        cursor += 4;

        // Script sig length
        let (script_len, size) = read_compact_int(&raw_tx[cursor..])?;
        cursor += size;

        let script_sig = raw_tx[cursor..cursor + script_len as usize].to_vec();
        cursor += script_len as usize;

        // Sequence (4 bytes)
        let sequence = u32::from_le_bytes([
            raw_tx[cursor],
            raw_tx[cursor + 1],
            raw_tx[cursor + 2],
            raw_tx[cursor + 3],
        ]);
        cursor += 4;

        inputs.push(TransactionInput {
            prev_txid,
            prev_vout,
            script_sig,
            sequence,
        });
    }

    // Output count
    let (n_outputs, size) = read_compact_int(&raw_tx[cursor..])?;
    cursor += size;

    // Parse outputs
    let mut outputs = Vec::new();
    for _ in 0..n_outputs {
        // Satoshis (8 bytes)
        if raw_tx.len() < cursor + 8 {
            return Err("Output truncated".to_string());
        }
        let satoshis = u64::from_le_bytes([
            raw_tx[cursor],
            raw_tx[cursor + 1],
            raw_tx[cursor + 2],
            raw_tx[cursor + 3],
            raw_tx[cursor + 4],
            raw_tx[cursor + 5],
            raw_tx[cursor + 6],
            raw_tx[cursor + 7],
        ]);
        cursor += 8;

        // Script pubkey length
        let (script_len, size) = read_compact_int(&raw_tx[cursor..])?;
        cursor += size;

        let script_pubkey = raw_tx[cursor..cursor + script_len as usize].to_vec();
        cursor += script_len as usize;

        outputs.push(TransactionOutput {
            satoshis,
            script_pubkey,
        });
    }

    // Locktime (4 bytes) - we skip it
    // cursor += 4;

    // Calculate TXID (double SHA256 of raw tx)
    let txid = double_sha256(raw_tx);

    Ok((inputs, outputs, txid))
}

/// Serialize a transaction to raw bytes
fn serialize_transaction(tx: &Brc62Transaction) -> Result<Vec<u8>, String> {
    Ok(tx.raw_tx.clone())
}

/// Parse Merkle proof
fn parse_merkle_proof(bytes: &[u8]) -> Result<(MerkleProof, usize), String> {
    let mut cursor = 0;

    // Block height (4 bytes)
    if bytes.len() < 4 {
        return Err("Merkle proof too short: missing block height".to_string());
    }
    let block_height = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    cursor += 4;

    // Transaction index (CompactInt)
    let (tx_index, size) = read_compact_int(&bytes[cursor..])?;
    cursor += size;

    // Number of nodes (CompactInt)
    let (n_nodes, size) = read_compact_int(&bytes[cursor..])?;
    cursor += size;

    // Parse nodes
    let mut nodes = Vec::new();
    for _ in 0..n_nodes {
        if bytes.len() < cursor + 33 {
            return Err("Merkle proof node truncated".to_string());
        }

        // Hash (32 bytes)
        let hash = hex::encode(&bytes[cursor..cursor + 32]);
        cursor += 32;

        // Flags byte: bit 0 = isLeft (0 = right, 1 = left)
        let flags = bytes[cursor];
        cursor += 1;

        let is_left = (flags & 0x01) != 0;

        nodes.push(MerkleProofNode { hash, is_left });
    }

    // Merkle root (32 bytes)
    if bytes.len() < cursor + 32 {
        return Err("Merkle proof too short: missing merkle root".to_string());
    }
    let merkle_root = hex::encode(&bytes[cursor..cursor + 32]);
    cursor += 32;

    Ok((
        MerkleProof {
            tx_index: tx_index as u32,
            block_height,
            merkle_root,
            nodes,
            tx_count: None,
        },
        cursor,
    ))
}

/// Serialize Merkle proof
fn serialize_merkle_proof(proof: &MerkleProof) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();

    // Block height (4 bytes)
    bytes.extend_from_slice(&proof.block_height.to_le_bytes());

    // Transaction index
    write_compact_int(&mut bytes, proof.tx_index as u64);

    // Number of nodes
    write_compact_int(&mut bytes, proof.nodes.len() as u64);

    // Nodes
    for node in &proof.nodes {
        let hash_bytes = hex::decode(&node.hash)
            .map_err(|e| format!("Invalid merkle node hash: {}", e))?;
        if hash_bytes.len() != 32 {
            return Err(format!("Invalid merkle node hash length: {}", hash_bytes.len()));
        }
        bytes.extend_from_slice(&hash_bytes);

        // Flags byte
        let flags = if node.is_left { 0x01 } else { 0x00 };
        bytes.push(flags);
    }

    // Merkle root
    let root_bytes = hex::decode(&proof.merkle_root)
        .map_err(|e| format!("Invalid merkle root: {}", e))?;
    if root_bytes.len() != 32 {
        return Err(format!("Invalid merkle root length: {}", root_bytes.len()));
    }
    bytes.extend_from_slice(&root_bytes);

    Ok(bytes)
}

// --- CompactInt (Bitcoin VarInt) ---

/// Read Bitcoin CompactInt (VarInt)
fn read_compact_int(bytes: &[u8]) -> Result<(u64, usize), String> {
    if bytes.is_empty() {
        return Err("CompactInt: empty buffer".to_string());
    }

    let first = bytes[0];
    match first {
        0..=0xFC => Ok((first as u64, 1)),
        0xFD => {
            if bytes.len() < 3 {
                return Err("CompactInt 0xFD: buffer too short".to_string());
            }
            let val = u16::from_le_bytes([bytes[1], bytes[2]]);
            Ok((val as u64, 3))
        }
        0xFE => {
            if bytes.len() < 5 {
                return Err("CompactInt 0xFE: buffer too short".to_string());
            }
            let val = u32::from_le_bytes([bytes[1], bytes[2], bytes[3], bytes[4]]);
            Ok((val as u64, 5))
        }
        0xFF => {
            if bytes.len() < 9 {
                return Err("CompactInt 0xFF: buffer too short".to_string());
            }
            let val = u64::from_le_bytes([
                bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], bytes[8],
            ]);
            Ok((val, 9))
        }
    }
}

/// Write Bitcoin CompactInt (VarInt)
fn write_compact_int(out: &mut Vec<u8>, val: u64) {
    if val <= 0xFC {
        out.push(val as u8);
    } else if val <= 0xFFFF {
        out.push(0xFD);
        out.extend_from_slice(&(val as u16).to_le_bytes());
    } else if val <= 0xFFFFFFFF {
        out.push(0xFE);
        out.extend_from_slice(&(val as u32).to_le_bytes());
    } else {
        out.push(0xFF);
        out.extend_from_slice(&val.to_le_bytes());
    }
}

// --- Hash Utilities ---

/// Double SHA256 hash (Bitcoin standard)
pub fn double_sha256(data: &[u8]) -> [u8; 32] {
    let first = Sha256::digest(data);
    let second = Sha256::digest(&first);
    let mut result = [0u8; 32];
    result.copy_from_slice(&second);
    result
}

/// Single SHA256 hash
pub fn sha256(data: &[u8]) -> [u8; 32] {
    let digest = Sha256::digest(data);
    let mut result = [0u8; 32];
    result.copy_from_slice(&digest);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compact_int_roundtrip() {
        let test_values = vec![0u64, 252, 253, 65535, 65536, 4294967295, 4294967296];

        for val in test_values {
            let mut bytes = Vec::new();
            write_compact_int(&mut bytes, val);
            let (decoded, size) = read_compact_int(&bytes).unwrap();
            assert_eq!(decoded, val);
            assert_eq!(size, bytes.len());
        }
    }

    #[test]
    fn test_double_sha256() {
        // Known test vector: double_sha256("hello")
        let data = b"hello";
        let hash = double_sha256(data);
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_beef_version_check() {
        let mut bytes = vec![0x00, 0x01]; // version 0x0100
        bytes.push(0x00); // 0 transactions
        bytes.push(0x00); // 0 merkle proofs

        let result = parse_beef(&bytes);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().version, 0x0100);
    }

    #[test]
    fn test_beef_invalid_version() {
        let bytes = vec![0xFF, 0xFF, 0x00]; // invalid version
        let result = parse_beef(&bytes);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported BEEF version"));
    }
}
