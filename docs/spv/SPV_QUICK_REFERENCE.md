# SPV Quick Reference Guide

## Installation

### Add to Cargo.toml
```toml
[dependencies]
sha2 = "0.10"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
hex = "0.4"
```

### Add to your Rust project
```bash
# Copy spv.rs to your src/ directory
cp spv.rs src-tauri/src/spv.rs

# Add module declaration in main.rs or lib.rs
mod spv;
```

## Common Operations

### 1. Parse BEEF Transaction
```rust
use crate::spv::parse_beef;

let beef_data = fetch_beef_from_overlay(txid).await?;
let beef = parse_beef(&beef_data)?;

println!("Version: 0x{:08x}", beef.version);
println!("Transactions: {}", beef.transactions.len());
```

### 2. Verify Transaction with SPV
```rust
use crate::spv::{verify_spv, SpvVerificationRequest};

let request = SpvVerificationRequest {
    txid: "abc123...".to_string(),
    merkle_proof: proof_json,
    block_height: Some(800000),
};

let block_header = fetch_header(800000).await?;
let result = verify_spv(&request, &block_header)?;

if result.is_valid {
    println!("✓ Verified! Confirmations: {}", result.confirmations.unwrap());
}
```

### 3. Calculate Merkle Root
```rust
use crate::spv::calculate_merkle_root;

let txid: [u8; 32] = hex_to_array("abc123...");
let path: Vec<[u8; 32]> = vec![
    hex_to_array("sibling1..."),
    hex_to_array("sibling2..."),
];

let root = calculate_merkle_root(&txid, &path, 2);
println!("Root: {}", hex::encode(root));
```

### 4. Parse Transaction
```rust
use crate::spv::extract_transaction_data;

let tx_bytes = hex::decode(raw_tx_hex)?;
let tx = extract_transaction_data(&tx_bytes)?;

println!("TXID: {}", hex::encode(tx.txid));
println!("Inputs: {}, Outputs: {}", tx.inputs.len(), tx.outputs.len());
println!("Total value: {} satoshis",
    tx.outputs.iter().map(|o| o.value).sum::<u64>());
```

### 5. Verify Block Header
```rust
use crate::spv::{parse_block_header, verify_block_header};

let header_bytes = fetch_header_raw(block_height).await?;
let header = parse_block_header(&header_bytes)?;
let valid = verify_block_header(&header, &header_bytes)?;

if valid {
    println!("✓ Valid PoW");
    println!("Merkle root: {}", hex::encode(header.merkle_root));
}
```

## Type Reference

### Input Types
```rust
// Verification request
SpvVerificationRequest {
    txid: String,
    merkle_proof: String,  // JSON or hex
    block_height: Option<u32>,
}

// Merkle proof (JSON format)
{
  "txid": "abc123...",
  "path": ["hash1", "hash2", ...],
  "index": 2,
  "blockHash": "000000...",
  "blockHeight": 800000
}
```

### Output Types
```rust
// Verification result
SpvVerificationResult {
    is_valid: bool,
    txid: Option<String>,
    block_height: Option<u32>,
    error: Option<String>,
    merkle_root: Option<String>,
    confirmations: Option<u32>,
    verified_at: Option<u64>,
}

// Parsed transaction
Transaction {
    txid: [u8; 32],
    raw_data: Vec<u8>,
    version: u32,
    inputs: Vec<TxInput>,
    outputs: Vec<TxOutput>,
    lock_time: u32,
}
```

## Error Handling

```rust
use crate::spv::SpvError;

match verify_spv(&request, &header) {
    Ok(result) => {
        if result.is_valid {
            println!("✓ Valid");
        } else {
            println!("✗ Invalid: {}", result.error.unwrap());
        }
    }
    Err(SpvError::ParseError(msg)) => {
        eprintln!("Parse error: {}", msg);
    }
    Err(SpvError::InvalidFormat(msg)) => {
        eprintln!("Invalid format: {}", msg);
    }
    Err(SpvError::MerkleVerificationFailed) => {
        eprintln!("Merkle verification failed");
    }
    Err(e) => {
        eprintln!("Error: {:?}", e);
    }
}
```

## Integration Patterns

### With Tauri Commands
```rust
#[tauri::command]
async fn verify_transaction_spv(
    txid: String,
    merkle_proof: String,
    block_height: u32,
) -> Result<SpvVerificationResult, String> {
    let request = SpvVerificationRequest {
        txid,
        merkle_proof,
        block_height: Some(block_height),
    };

    let header = fetch_block_header(block_height)
        .await
        .map_err(|e| e.to_string())?;

    verify_spv(&request, &header)
        .map_err(|e| format!("{:?}", e))
}
```

### With Subscription Manager
```rust
pub async fn verify_subscription_payment(
    subscription_txid: &str,
) -> Result<bool, Error> {
    // Fetch proof from overlay
    let proof = overlay_client
        .lookup_transaction(subscription_txid)
        .await?;

    // Get block header
    let header = header_service
        .get_header(proof.block_height)
        .await?;

    // Verify
    let request = SpvVerificationRequest {
        txid: subscription_txid.to_string(),
        merkle_proof: proof.merkle_proof,
        block_height: Some(proof.block_height),
    };

    let result = verify_spv(&request, &header)?;

    // Require 6 confirmations
    Ok(result.is_valid && result.confirmations.unwrap_or(0) >= 6)
}
```

### With Caching
```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct SpvCache {
    cache: Arc<RwLock<HashMap<String, SpvVerificationResult>>>,
}

impl SpvCache {
    pub async fn verify_cached(
        &self,
        request: &SpvVerificationRequest,
        header: &[u8],
    ) -> Result<SpvVerificationResult, SpvError> {
        // Check cache
        {
            let cache = self.cache.read().await;
            if let Some(result) = cache.get(&request.txid) {
                return Ok(result.clone());
            }
        }

        // Verify and cache
        let result = verify_spv(request, header)?;

        if result.is_valid {
            let mut cache = self.cache.write().await;
            cache.insert(request.txid.clone(), result.clone());
        }

        Ok(result)
    }
}
```

## Testing

### Run Tests
```bash
# All tests
cargo test

# SPV module only
cargo test --test spv_integration_test

# With output
cargo test -- --nocapture

# Specific test
cargo test test_calculate_merkle_root
```

### Example Test
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_my_verification() {
        let beef = parse_beef(&SAMPLE_BEEF_DATA).unwrap();
        assert_eq!(beef.version, 0x0100BEEF);
    }
}
```

## Performance Tips

1. **Cache Block Headers** - Headers don't change, cache them
2. **Reuse Parsers** - Parse BEEF once, verify multiple transactions
3. **Parallel Verification** - Use `tokio::spawn` for multiple verifications
4. **Pre-allocate Buffers** - Use `Vec::with_capacity()` for known sizes

## Common Pitfalls

❌ **Wrong byte order**
```rust
// DON'T: Use big-endian for integers
let version = u32::from_be_bytes(buf);

// DO: Use little-endian
let version = u32::from_le_bytes(buf);
```

❌ **Reversed TXID**
```rust
// DON'T: Use raw hash
let txid = sha256(sha256(tx_data));

// DO: Reverse for display
let mut txid = sha256(sha256(tx_data));
txid.reverse();
```

❌ **Missing double-hash**
```rust
// DON'T: Single SHA-256
let hash = sha256(&data);

// DO: Double SHA-256
let hash = sha256(sha256(&data));
```

❌ **Wrong Merkle concatenation order**
```rust
// DON'T: Always left then right
hash(current || sibling)

// DO: Check index for order
if index % 2 == 0 {
    hash(current || sibling)  // Left child
} else {
    hash(sibling || current)  // Right child
}
```

## Helper Functions

```rust
// Hex conversions
fn hex_to_array(hex: &str) -> [u8; 32] {
    let bytes = hex::decode(hex.trim_start_matches("0x")).unwrap();
    let mut array = [0u8; 32];
    array.copy_from_slice(&bytes);
    array
}

fn array_to_hex(arr: &[u8]) -> String {
    hex::encode(arr)
}

// Endianness conversions
fn reverse_bytes(data: &[u8]) -> Vec<u8> {
    data.iter().rev().copied().collect()
}

// VarInt encoding
fn encode_varint(n: u64) -> Vec<u8> {
    match n {
        0..=0xfc => vec![n as u8],
        0xfd..=0xffff => {
            let mut v = vec![0xfd];
            v.extend_from_slice(&(n as u16).to_le_bytes());
            v
        }
        0x10000..=0xffffffff => {
            let mut v = vec![0xfe];
            v.extend_from_slice(&(n as u32).to_le_bytes());
            v
        }
        _ => {
            let mut v = vec![0xff];
            v.extend_from_slice(&n.to_le_bytes());
            v
        }
    }
}
```

## Debugging

```rust
// Enable debug output
use log::{debug, info, warn};

let beef = parse_beef(data)?;
debug!("Parsed BEEF version: 0x{:08x}", beef.version);
info!("Transaction count: {}", beef.transactions.len());

// Print hex for inspection
println!("TXID: {}", hex::encode(tx.txid));
println!("Merkle root: {}", hex::encode(header.merkle_root));

// Validate intermediate steps
let root1 = calculate_merkle_root(&txid, &path[..1], index);
let root2 = calculate_merkle_root(&txid, &path, index);
debug!("Intermediate root: {}", hex::encode(root1));
debug!("Final root: {}", hex::encode(root2));
```

## Resources

- **BRC Standards**: https://github.com/bitcoin-sv/BRCs
- **Overlay Services**: https://github.com/bitcoin-sv/overlay-services
- **SPV Wallet**: https://github.com/bitcoin-sv/spv-wallet
- **BSV SDK**: https://github.com/bitcoin-sv/ts-sdk

## Support

For issues or questions:
1. Check test suite for examples
2. Review BRC specifications
3. Debug with `cargo test -- --nocapture`
4. Check retrieved context from edwinpai-ux vault
