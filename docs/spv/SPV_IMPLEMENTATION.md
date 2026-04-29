# SPV (Simplified Payment Verification) Implementation

**File:** `spv.rs`
**Generated:** 2026-02-10
**Purpose:** Binary parsing and verification for BEEF/BUMP formats with SPV validation

## Overview

This implementation provides complete SPV verification for BSV transactions, supporting:

- **BEEF (Background Evaluation Extended Format)** - BRC-62
- **BUMP (BSV Unified Merkle Path)** - BRC-74
- **Merkle Root Calculation** - Using SHA-256 double hashing
- **Block Header Verification** - Proof-of-work validation
- **Transaction Parsing** - Binary format extraction

## Architecture

```
┌─────────────────────────────────────────────────┐
│              SPV Verification Flow               │
├─────────────────────────────────────────────────┤
│                                                  │
│  1. Parse BEEF/BUMP                              │
│     ├── Extract version                          │
│     ├── Parse BUMP array                         │
│     └── Parse transactions                       │
│                                                  │
│  2. Calculate Merkle Root                        │
│     ├── Start with TXID                          │
│     ├── Hash with siblings (left/right)          │
│     └── Double SHA-256 each level                │
│                                                  │
│  3. Verify Block Header                          │
│     ├── Parse 80-byte header                     │
│     ├── Validate proof-of-work                   │
│     └── Compare merkle roots                     │
│                                                  │
│  4. Return Verification Result                   │
│     └── { isValid, txid, blockHeight, ... }     │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Key Functions

### 1. `parse_beef(beef_data: &[u8]) -> Result<BeefData, SpvError>`

Parses BEEF binary format with version extraction.

**BEEF Structure:**
```
┌────────────────┬──────────────┬─────────────────┐
│  Version (4B)  │  BUMP Array  │  Transactions   │
│  0x0100BEEF    │  (variable)  │   (variable)    │
└────────────────┴──────────────┴─────────────────┘
```

**Supported Versions:**
- `0x0100BEEF` - BEEF v1.0
- `0x0101BEEF` - BEEF v1.1

**Returns:**
```rust
BeefData {
    version: u32,           // BEEF version
    bump_array: Vec<BumpEntry>,
    transactions: Vec<Transaction>,
}
```

### 2. `parse_bump_array<R: Read>(reader: &mut R) -> Result<Vec<BumpEntry>, SpvError>`

Parses BUMP array containing Merkle paths.

**BUMP Structure:**
```
┌─────────────────────────────────────────┐
│  Entry Count (varint)                   │
├─────────────────────────────────────────┤
│  For each entry:                        │
│    ├── Block Height (varint)            │
│    ├── Path Count (varint)              │
│    └── Merkle Paths                     │
│         ├── Offset (varint)             │
│         ├── Tree Height (1 byte)        │
│         ├── Flags (ceil(height/8))      │
│         └── Hashes (32 bytes each)      │
└─────────────────────────────────────────┘
```

**Returns:**
```rust
Vec<BumpEntry> {
    block_height: u32,
    merkle_paths: Vec<MerklePath>,
}
```

### 3. `extract_transaction_data(tx_data: &[u8]) -> Result<Transaction, SpvError>`

Parses Bitcoin transaction format.

**Transaction Structure:**
```
┌─────────────────────────────────────────┐
│  Version (4 bytes LE)                   │
├─────────────────────────────────────────┤
│  Input Count (varint)                   │
├─────────────────────────────────────────┤
│  Inputs:                                │
│    ├── Previous TXID (32 bytes)         │
│    ├── Previous Index (4 bytes)         │
│    ├── Script Sig Length (varint)       │
│    ├── Script Sig                       │
│    └── Sequence (4 bytes)               │
├─────────────────────────────────────────┤
│  Output Count (varint)                  │
├─────────────────────────────────────────┤
│  Outputs:                               │
│    ├── Value (8 bytes LE)               │
│    ├── Script Length (varint)           │
│    └── Script PubKey                    │
├─────────────────────────────────────────┤
│  Lock Time (4 bytes LE)                 │
└─────────────────────────────────────────┘
```

**Returns:**
```rust
Transaction {
    txid: [u8; 32],         // Double SHA-256 of raw tx
    raw_data: Vec<u8>,
    version: u32,
    inputs: Vec<TxInput>,
    outputs: Vec<TxOutput>,
    lock_time: u32,
}
```

### 4. `calculate_merkle_root(txid: &[u8; 32], merkle_path: &[[u8; 32]], index: u32) -> [u8; 32]`

Calculates Merkle root using SHA-256 double hashing.

**Algorithm:**
1. Start with transaction TXID as current hash
2. For each sibling in path:
   - Determine left/right based on index (even = left, odd = right)
   - Concatenate current hash with sibling (order matters)
   - Hash concatenation: `SHA-256(SHA-256(concat))`
   - Update current hash
   - Divide index by 2 for next level
3. Final hash is the Merkle root

**Example (4-transaction block):**
```
       Root
      /    \
    H01    H23
   /  \   /  \
  T0  T1 T2  T3

To verify T2 (index=2):
  Path = [T3, H01]

  Level 0: H23 = SHA256(SHA256(T2 || T3))  // index=2 (even, left)
  Level 1: Root = SHA256(SHA256(H01 || H23)) // index=1 (odd, right)
```

### 5. `verify_block_header(header: &BlockHeader, header_data: &[u8]) -> Result<bool, SpvError>`

Verifies block header proof-of-work.

**Block Header Structure (80 bytes):**
```
┌─────────────────────────────────────┐
│  Version (4 bytes LE)               │
│  Previous Block Hash (32 bytes)     │
│  Merkle Root (32 bytes)             │
│  Timestamp (4 bytes LE)             │
│  Bits (4 bytes LE) - Difficulty     │
│  Nonce (4 bytes LE)                 │
└─────────────────────────────────────┘
```

**Validation Steps:**
1. Parse header structure
2. Calculate block hash: `SHA-256(SHA-256(header))`
3. Extract target from `bits` field (compact format)
4. Verify: `block_hash < target` (proof-of-work)

### 6. `verify_spv(request: &SpvVerificationRequest, block_header_data: &[u8]) -> Result<SpvVerificationResult, SpvError>`

Complete end-to-end SPV verification.

**Steps:**
1. Parse block header
2. Verify block header proof-of-work
3. Parse Merkle proof from request
4. Calculate Merkle root from TXID + path
5. Compare calculated root with block header root
6. Return verification result

## Type Contracts

### Input Types
```rust
pub struct SpvVerificationRequest {
    pub txid: String,              // Transaction ID to verify
    pub merkle_proof: String,      // JSON or hex encoded proof
    pub block_height: Option<u32>, // Optional validation
}

pub struct MerkleProof {
    pub txid: String,
    pub path: Vec<String>,         // Sibling hashes
    pub index: u32,                // Position in block
    pub block_hash: String,
    pub block_height: u32,
}
```

### Output Types
```rust
pub struct SpvVerificationResult {
    pub is_valid: bool,
    pub txid: Option<String>,
    pub block_height: Option<u32>,
    pub error: Option<String>,
    pub merkle_root: Option<String>,
    pub confirmations: Option<u32>,
    pub verified_at: Option<u64>,   // Unix timestamp
}
```

## Error Handling

```rust
pub enum SpvError {
    ParseError(String),              // Invalid binary format
    InvalidFormat(String),           // Wrong structure
    MerkleVerificationFailed,        // Root mismatch
    InvalidBlockHeader,              // Header validation failed
    IoError(std::io::Error),         // Read/write error
}
```

## Usage Examples

### Example 1: Parse BEEF Transaction

```rust
use spv::{parse_beef, BeefData};

// Raw BEEF data from overlay service
let beef_bytes = fetch_beef_from_overlay(txid);

// Parse BEEF structure
let beef = parse_beef(&beef_bytes)?;

println!("BEEF Version: 0x{:08x}", beef.version);
println!("Block Height: {}", beef.bump_array[0].block_height);
println!("Transactions: {}", beef.transactions.len());
```

### Example 2: Verify Transaction SPV

```rust
use spv::{verify_spv, SpvVerificationRequest};

// Create verification request
let request = SpvVerificationRequest {
    txid: "abcd1234...".to_string(),
    merkle_proof: r#"{
        "txid": "abcd1234...",
        "path": ["hash1", "hash2"],
        "index": 2,
        "blockHash": "00000000...",
        "blockHeight": 800000
    }"#.to_string(),
    block_height: Some(800000),
};

// Fetch block header from header service
let block_header = fetch_header(800000)?;

// Verify
let result = verify_spv(&request, &block_header)?;

if result.is_valid {
    println!("✓ Transaction verified!");
    println!("  Merkle Root: {}", result.merkle_root.unwrap());
    println!("  Confirmations: {}", result.confirmations.unwrap());
} else {
    println!("✗ Verification failed: {}", result.error.unwrap());
}
```

### Example 3: Calculate Merkle Root

```rust
use spv::calculate_merkle_root;

// Transaction ID (32 bytes)
let txid = hex::decode("abcd1234...").unwrap();
let mut txid_array = [0u8; 32];
txid_array.copy_from_slice(&txid);

// Merkle path (sibling hashes)
let path = vec![
    hex_to_array("hash1..."),
    hex_to_array("hash2..."),
];

// Calculate root
let merkle_root = calculate_merkle_root(&txid_array, &path, 2);

println!("Merkle Root: {}", hex::encode(merkle_root));
```

## Test Coverage

### Unit Tests (14 tests)

1. **Merkle Calculation**
   - `test_calculate_merkle_root_single_path` - Simple 2-tx block
   - `test_calculate_merkle_root_multi_level` - 4-tx block with 2 levels
   - `test_merkle_root_deterministic` - Same input = same output

2. **Block Header Parsing**
   - `test_parse_block_header` - Genesis block parsing
   - `test_verify_block_header_genesis` - Genesis block PoW validation
   - `test_error_handling_invalid_header` - Error handling

3. **BEEF Parsing**
   - `test_parse_beef_invalid_version` - Version validation
   - `test_parse_beef_version_extraction` - Version field extraction
   - `test_varint_parsing` - Variable integer encoding
   - `test_parse_bump_array_empty` - Empty BUMP array

4. **Transaction Parsing**
   - `test_calculate_txid` - TXID calculation
   - `test_hex_conversion` - Hex encoding/decoding

5. **Difficulty Calculation**
   - `test_bits_to_target` - Compact bits to target conversion

### Integration Tests (8 tests)

See `spv_integration_test.rs` for:
- Full BEEF parsing with BUMP and transactions
- Transaction parsing with inputs/outputs
- Multi-path BUMP parsing
- Complete SPV verification flow
- Varint edge cases
- Merkle proof verification

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Parse BEEF | O(n) | n = transaction count |
| Parse BUMP | O(m*p) | m = entries, p = paths per entry |
| Parse Transaction | O(i+o) | i = inputs, o = outputs |
| Calculate Merkle Root | O(h) | h = tree height (log₂ txCount) |
| Verify Block Header | O(1) | Fixed 80-byte header |
| Full SPV Verification | O(h) | Dominated by Merkle calculation |

**Memory Usage:**
- BEEF: ~(tx_size * tx_count) + (32 * path_count)
- Transaction: ~(input_size * input_count) + (output_size * output_count)
- Merkle Path: 32 bytes * tree_height

## Dependencies

```toml
[dependencies]
sha2 = "0.10"          # SHA-256 hashing for Merkle calculations
serde = "1.0"          # Serialization framework
serde_json = "1.0"     # JSON parsing for Merkle proofs
hex = "0.4"            # Hex encoding/decoding

[dev-dependencies]
hex = "0.4"            # Test data encoding
```

## Integration Points

### Frontend (TypeScript)

Matches type contracts in `types_contracts/spv.ts`:

```typescript
interface SpvVerificationResult {
  isValid: boolean;
  txid?: string;
  blockHeight?: number;
  error?: string;
  merkleRoot?: string;
  confirmations?: number;
  verifiedAt?: number;
}
```

### Subscription Manager

Used by `subscription-manager.ts` for:
- Verifying subscription payment transactions
- Confirming transaction inclusion in blocks
- Checking confirmation depth

### Overlay Services Client

Used by `overlay-services-client.ts` for:
- Parsing BEEF responses from Topic Manager
- Verifying transaction proofs
- Validating UTXO existence

## BRC Compliance

### BRC-62: BEEF Transactions ✓
- Version field extraction
- BUMP array parsing
- Transaction array parsing
- Backwards compatibility (v1.0, v1.1)

### BRC-67: Simplified Payment Verification ✓
- Merkle proof verification
- Block header validation
- Proof-of-work checking
- Transaction inclusion proof

### BRC-74: BUMP Format ✓
- Block height encoding
- Merkle path parsing
- Tree height and flags
- Offset calculation

### BRC-76: Graph Aware Sync Protocol (Partial)
- Binary parsing compatible
- Ready for GASP extension
- Structure supports DAG traversal

## Security Considerations

1. **Double SHA-256**: All hashing uses double SHA-256 per Bitcoin spec
2. **Byte Order**: Little-endian for integers, big-endian for hashes
3. **VarInt Validation**: Checks for canonical encoding
4. **Header Validation**: Verifies proof-of-work before trusting merkle root
5. **Buffer Overflow**: Uses safe Rust patterns, no unsafe code
6. **DOS Protection**: Validates lengths before allocation

## Future Enhancements

1. **Binary Merkle Proof Format**: Add support for binary (non-JSON) proofs
2. **GASP Integration**: Full Graph Aware Sync Protocol support
3. **Header Chain Service**: Integrate with header validation service
4. **Async Operations**: Add async parsing for large BEEF files
5. **Streaming Parser**: Support streaming BEEF data for large transactions
6. **Optimized Hashing**: SIMD acceleration for SHA-256 operations

## References

- [BRC-62: BEEF Transactions](https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0062.md)
- [BRC-67: Simplified Payment Verification](https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0067.md)
- [BRC-74: BUMP Format](https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0074.md)
- [BRC-76: GASP](https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0076.md)

---

**Implementation Status:** ✅ Complete
**Test Coverage:** 22 tests (14 unit + 8 integration)
**LOC:** ~750 lines (implementation + tests)
**Compliance:** BRC-62, BRC-67, BRC-74
