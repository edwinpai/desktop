# Phase 2: SPV & Overlay Type Definitions

**Date**: 2026-02-10
**Status**: Type definitions complete, awaiting implementation

## Overview

Defined TypeScript and Rust types for SPV verification, Overlay Services (Arcade/STEAK), and enhanced subscription management per SPEC §5.6.

## TypeScript Types

### 1. SPV Types (`src/types/spv.ts`)

**BRC Standards**: BRC-8 (Transaction Envelopes), BRC-9 (SPV), BRC-62 (BEEF), BRC-67 (SPV)

Key interfaces:
- `BeefEnvelope` - Background Evaluation Extended Format for transaction proofs
- `BRC62Transaction` - Transaction format with inputs, outputs, and optional Merkle proof
- `MerkleProof` - Merkle path for SPV validation (block height, merkle root, proof nodes)
- `MerkleProofNode` - Single node in Merkle path (hash + left/right flag)
- `BlockHeader` - Bitcoin block header (80 bytes: version, prevHash, merkleRoot, timestamp, bits, nonce)
- `SpvVerification` - Verification result (valid, txid, blockHeight, confirmations, cached, error)
- `SubscriptionUtxo` - Subscription UTXO with SPV proof
- `SpvProofCache` - Cached proof entry with timestamps
- `BeefParseOptions` - Options for BEEF parsing (validateProofs, verifySignatures, maxDepth)
- `BeefSerialized` - Serialization result (bytes, hex, summary)

**Total**: 15 interfaces, 197 LOC

### 2. Overlay Types (`src/types/overlay.ts`)

**Source**: BSV Overlay Services architecture (https://github.com/bitcoin-sv/overlay-services)

Key interfaces:
- `OverlayTopic` - Topic configuration (topicId, description, managerUrl, admissionRules)
- `AdmissionRules` - Topic membership rules (scriptPattern, min/max satoshis, required protocols)
- `TopicManager` - Interface for topic operations (submit, query, subscribe)
- `ArcadeSubmission` - Submission request (BEEF, topics, mode, offChainValues)
- `SteakReceipt` - Successful Transmission Evidence Acknowledgement Kit (proof of submission)
- `TopicSubmissionResult` - Submission outcome (accepted, receipt, rejection)
- `UtxoFilter` - Query filter (scriptHash, satoshi range, spent flag, blockHeight range, pagination)
- `UtxoQueryResult` - Query results (utxos, totalCount, nextOffset)
- `TopicUtxo` - UTXO in overlay topic (txid, vout, satoshis, scriptPubKey, blockHeight, spent, metadata)
- `TopicEvent` - SSE events (utxo_added, utxo_spent, utxo_confirmed, topic_updated)
- `ArcadeConfig` - Configuration (baseUrl, subscriptionTopic, spvMode, cacheDuration, gracePeriod)

**Defaults**: `DEFAULT_ARCADE_CONFIG` (overlay.bsvblockchain.org, 72h cache/grace)

**Total**: 20 interfaces + 1 constant, 271 LOC

### 3. IPC Extensions (`src/types/ipc.ts`)

Added Phase 2 commands:
- `SpvVerifyRequest` / `SpvVerifyResponse` - Verify transaction with optional BEEF, cache flag
- `SubmitToArcadeRequest` / `SubmitToArcadeResponse` - Submit BEEF to overlay topics, receive STEAK
- `CheckSubscriptionRequest` / `CheckSubscriptionResponse` - Enhanced with state machine (5 states)

**Updated unions**:
- `CryptoRequest` - Added `SpvVerifyRequest`, `SubmitToArcadeRequest`
- `CryptoResponse` - Added `SpvVerifyResponse`, `SubmitToArcadeResponse`

**Total additions**: 6 interfaces, 87 LOC

### 4. Index Export (`src/types/index.ts`)

Re-exported all new types:
- SPV: 13 types from `./spv`
- Overlay: 16 types + `DEFAULT_ARCADE_CONFIG` from `./overlay`
- IPC: 4 new request/response pairs

## Rust Types

### 1. SPV Domain (`src-tauri/src/spv_domain/`)

**Files**: `types.rs` (372 LOC), `mod.rs` (19 LOC)

Key structs:
- `BeefEnvelope` - With `from_hex`, `to_hex`, `from_bytes`, `to_bytes` methods
- `Brc62Transaction` - Transaction with inputs, outputs, proof, is_mined flag
- `TransactionInput` / `TransactionOutput` - Input (prev_txid, prev_vout, script_sig, sequence) / Output (satoshis, script_pubkey)
- `MerkleProof` - With `verify(&self, txid: &str) -> bool` method (TODO: implement)
- `MerkleProofNode` - Proof path node
- `BlockHeader` - With `calculate_hash()` and `verify_pow()` methods (TODO: implement)
- `SpvVerification` - Verification result
- `SubscriptionUtxo` - Subscription UTXO with proof
- `SpvProofCache` - With `is_valid(&self, grace_period_ms: i64) -> bool` cache validation
- `BeefParseOptions` - Defaults: `validate_proofs: true`, `verify_signatures: false`, `max_depth: 100`

**Dependencies**: `serde`, `hex`, `chrono` (already in Cargo.toml from Phase 1)

**Total**: 15 structs, 391 LOC (types + mod)

### 2. Overlay Domain (`src-tauri/src/overlay_domain/`)

**Files**: `types.rs` (243 LOC), `mod.rs` (20 LOC)

Key structs:
- `OverlayTopic` - Topic configuration
- `AdmissionRules` - Membership rules
- `ArcadeSubmission` - With `SubmissionMode` enum (CurrentTx, HistoricalTx, HistoricalTxNoSpv)
- `SteakReceipt` - Proof of submission
- `TopicSubmissionResult` - Outcome with optional `RejectionReason`
- `UtxoFilter` - With `BlockHeightRange` and `Pagination` nested structs
- `UtxoQueryResult` - Query results
- `TopicUtxo` - UTXO with optional `SpentBy` info
- `TopicEvent` - Enum: `UtxoAdded`, `UtxoSpent`, `UtxoConfirmed`, `TopicUpdated`
- `ArcadeConfig` - With `SpvMode` enum (Full, Cached, Trust), implements `Default`

**Defaults**:
```rust
ArcadeConfig {
    base_url: "https://overlay.bsvblockchain.org",
    subscription_topic: "edwinpai-subscriptions",
    spv_mode: SpvMode::Cached,
    cache_duration: 72h,
    grace_period: 72h,
}
```

**Total**: 18 structs + 2 enums, 263 LOC (types + mod)

### 3. Subscription Domain (`src-tauri/src/subscription/`)

**Files**: `types.rs` (186 LOC), `mod.rs` (15 LOC)

Key types:
- `SubscriptionState` - Enum: `Active`, `Cached`, `Expired`, `GraceExceeded`, `NotFound`
  - Methods: `allows_full_operation()`, `allows_channel_io()`, `description()`, `Display`
- `UtxoRef` - (txid, vout)
- `CachedProof` - (txid, vout, merkle_proof, block_height, verified_at)
- `SubscriptionInfo` - Full subscription details
- `SubscriptionStatus` - IPC response with 6 factory methods:
  - `not_found()`, `active(utxo, height, confs)`, `cached(proof)`, `expired(txid, vout)`, `grace_exceeded(proof)`
- `SubscriptionConfig` - Defaults: 72h cache_duration_ms, 72h grace_period_ms

**State machine** (SPEC §5.6):
| State | Full Operation | Channel I/O | Description |
|-------|---------------|-------------|-------------|
| Active | ✅ | ✅ | UTXO unspent, verified <72h |
| Cached | ✅ | ✅ | UTXO unspent (last check), offline <72h |
| Expired | ❌ | ❌ | UTXO spent on-chain |
| GraceExceeded | ❌ | ❌ | Cannot verify, offline >72h |
| NotFound | ❌ | ❌ | No subscription UTXO exists |

**Total**: 7 structs + 1 enum, 201 LOC (types + mod)

### 4. IPC Types (`src-tauri/src/crypto_domain/ipc_types.rs`)

**Additions** (140 LOC):
- `SpvVerifyRequest` - With optional BEEF, use_cache flag
- `SpvVerifyResponse` - valid, txid, block_height, confirmations, cached, error
- `SubmitToArcadeRequest` - BEEF hex, topics, mode string
- `SubmitToArcadeResponse` - accepted, txid, topics, optional receipt/rejection
- `SteakReceiptData` - accepted_at, optional signature
- `RejectionData` - code, message
- `CheckSubscriptionResponse` - **Enhanced** with state, txid, vout, verified_at, cached_proof, block_height, confirmations (replaces old 3-field version)

**New error constructors**:
- `IpcError::spv_verification_failed(reason)`
- `IpcError::beef_parse_failed(reason)`
- `IpcError::overlay_submission_failed(reason)`

**Updated enums**:
- `CryptoRequest` - Added `SpvVerifyRequest`, `SubmitToArcadeRequest`
- `CryptoResponse` - Added `SpvVerifyResponse`, `SubmitToArcadeResponse`
- `CryptoMessage` - Added all 4 new types

**Total additions**: 6 structs + 3 error methods + enum variants, ~140 LOC

### 5. Main Library (`src-tauri/src/lib.rs`)

**Added**:
```rust
pub mod spv_domain;
pub mod overlay_domain;
pub mod subscription;
```

### 6. Module Exports (`src-tauri/src/crypto_domain/mod.rs`)

**Added exports**:
```rust
pub use ipc_types::{
    RejectionData, SteakReceiptData,
    SpvVerifyRequest, SpvVerifyResponse,
    SubmitToArcadeRequest, SubmitToArcadeResponse,
    // ... (updated CheckSubscriptionResponse)
};
```

## IPC Command Contracts

### 1. `spv_verify`

**Request** (`SpvVerifyRequest`):
```typescript
{
  txid: string;                // Transaction ID to verify
  beef?: string;               // Optional hex-encoded BEEF envelope
  useCache?: boolean;          // Default: true
}
```

**Response** (`SpvVerifyResponse`):
```typescript
{
  valid: boolean;              // Whether tx is valid
  txid: string;                // Transaction ID
  blockHeight?: number;        // Block height (if confirmed)
  confirmations?: number;      // Number of confirmations
  cached: boolean;             // Whether proof was from cache
  error?: string;              // Error message if validation failed
}
```

**Error codes**: `ERR_SPV_VERIFICATION_FAILED`, `ERR_BEEF_PARSE_FAILED`

### 2. `submit_to_arcade`

**Request** (`SubmitToArcadeRequest`):
```typescript
{
  beef: string;                // Hex-encoded BEEF envelope
  topics: string[];            // Topics to submit to (e.g., ["edwinpai-subscriptions"])
  mode?: string;               // "current-tx" (default) | "historical-tx" | "historical-tx-no-spv"
}
```

**Response** (`SubmitToArcadeResponse`):
```typescript
{
  accepted: boolean;           // Whether submission was accepted
  txid: string;                // Transaction ID
  topics: string[];            // Topics that accepted the submission
  receipt?: {                  // STEAK receipt (if accepted)
    acceptedAt: string;        // ISO 8601 timestamp
    signature?: string;        // Overlay manager signature
  };
  rejection?: {                // Rejection reason (if not accepted)
    code: string;              // Error code
    message: string;           // Human-readable message
  };
}
```

**Error codes**: `ERR_OVERLAY_SUBMISSION_FAILED`, `ERR_BEEF_PARSE_FAILED`

### 3. `check_subscription` (Enhanced)

**Request** (`CheckSubscriptionRequest`):
```typescript
{
  forceRefresh?: boolean;      // Force refresh from overlay (default: false, uses cache if <72h)
}
```

**Response** (`CheckSubscriptionResponse`):
```typescript
{
  state: "Active" | "Cached" | "Expired" | "GraceExceeded" | "NotFound";
  txid?: string;               // TXID of subscription UTXO (if known)
  vout?: number;               // Output index
  verifiedAt?: string;         // ISO 8601 timestamp of last verification
  cachedProof: boolean;        // Whether proof is from cache
  blockHeight?: number;        // Block height of UTXO confirmation
  confirmations?: number;      // Number of confirmations
}
```

**Breaking change**: Replaces Phase 1 `CheckSubscriptionResponse` with richer state machine.

## File Summary

### TypeScript (4 new files)
| File | LOC | Interfaces | Enums | Constants |
|------|-----|------------|-------|-----------|
| `src/types/spv.ts` | 197 | 15 | - | - |
| `src/types/overlay.ts` | 271 | 20 | - | 1 |
| `src/types/ipc.ts` (additions) | 87 | 6 | - | - |
| `src/types/index.ts` (additions) | 35 | - | - | - |
| **Total** | **590** | **41** | **0** | **1** |

### Rust (10 new files)
| File | LOC | Structs | Enums | Traits | Impls |
|------|-----|---------|-------|--------|-------|
| `spv_domain/types.rs` | 372 | 14 | - | - | 6 |
| `spv_domain/mod.rs` | 19 | - | - | - | - |
| `overlay_domain/types.rs` | 243 | 16 | 2 | - | 1 |
| `overlay_domain/mod.rs` | 20 | - | - | - | - |
| `subscription/types.rs` | 186 | 6 | 1 | - | 5 |
| `subscription/mod.rs` | 15 | - | - | - | - |
| `crypto_domain/ipc_types.rs` (additions) | 140 | 6 | - | - | - |
| `crypto_domain/mod.rs` (additions) | 5 | - | - | - | - |
| `lib.rs` (additions) | 3 | - | - | - | - |
| **Total** | **1,003** | **42** | **3** | **0** | **12** |

**Grand total**: 1,593 LOC (590 TypeScript + 1,003 Rust)

## Implementation Checklist

### Rust Backend (Phase 2a)
- [ ] SPV verification logic (`spv_domain/verifier.rs`)
  - [ ] `verify_merkle_proof(proof: &MerkleProof, txid: &str) -> bool`
  - [ ] `verify_block_header(header: &BlockHeader) -> bool`
  - [ ] `parse_beef(hex: &str) -> Result<BeefEnvelope>`
  - [ ] `serialize_beef(envelope: &BeefEnvelope) -> Result<String>`
- [ ] Overlay client (`overlay_domain/client.rs`)
  - [ ] `submit_to_arcade(submission: ArcadeSubmission) -> Result<TopicSubmissionResult>`
  - [ ] `query_utxos(topic: &str, filter: UtxoFilter) -> Result<UtxoQueryResult>`
  - [ ] `subscribe_to_topic(topic: &str) -> Result<TopicSubscription>` (SSE)
- [ ] Subscription manager (`subscription/manager.rs`)
  - [ ] `check_subscription(force_refresh: bool) -> Result<SubscriptionStatus>`
  - [ ] `cache_proof(proof: SpvProofCache) -> Result<()>`
  - [ ] `get_cached_proof(txid: &str) -> Option<SpvProofCache>`
- [ ] Tauri commands (`commands/spv.rs`, `commands/overlay.rs`)
  - [ ] `spv_verify(req: SpvVerifyRequest) -> Result<SpvVerifyResponse>`
  - [ ] `submit_to_arcade(req: SubmitToArcadeRequest) -> Result<SubmitToArcadeResponse>`
  - [ ] Update `check_subscription(req: CheckSubscriptionRequest) -> Result<CheckSubscriptionResponse>`
- [ ] Register commands in `lib.rs`

### TypeScript Frontend (Phase 2b)
- [ ] SPV hooks (`src/hooks/useSpvVerification.ts`)
  - [ ] `useSpvVerification(txid, beef?) -> { verify, result, loading, error }`
- [ ] Overlay hooks (`src/hooks/useOverlay.ts`)
  - [ ] `useArcadeSubmission() -> { submit, receipt, loading, error }`
  - [ ] `useTopicQuery(topic, filter) -> { utxos, loading, error, refetch }`
- [ ] Subscription hook updates (`src/hooks/useSubscription.ts`)
  - [ ] Update to use new 5-state machine
  - [ ] Handle `Active`, `Cached`, `Expired`, `GraceExceeded`, `NotFound`
- [ ] UI components (`src/components/subscription/`)
  - [ ] `SubscriptionBanner.tsx` - Status indicator with state-specific messaging
  - [ ] `SubscriptionModal.tsx` - Re-subscribe flow for `Expired` state
  - [ ] `GraceExceededNotice.tsx` - Warning for offline >72h

### Integration Tests (Phase 2c)
- [ ] SPV verification tests (`tests/spv_verification.rs`)
  - [ ] Test with real BEEF from testnet
  - [ ] Test Merkle proof validation
  - [ ] Test cache hit/miss
- [ ] Overlay submission tests (`tests/overlay_submission.rs`)
  - [ ] Test successful submission → STEAK receipt
  - [ ] Test rejection scenarios
- [ ] Subscription state machine tests (`tests/subscription_states.rs`)
  - [ ] Test all 5 state transitions
  - [ ] Test grace period expiration
  - [ ] Test cache invalidation

### Documentation (Phase 2d)
- [ ] Update SPEC.md §5.6 with implementation details
- [ ] Document BEEF format and parsing
- [ ] Document overlay topic admission rules
- [ ] Update PLAN.md Phase 2 status

## Dependencies

**No new dependencies required** - all Phase 2 types use existing crates from Phase 1:
- `serde` / `serde_json` - Serialization
- `hex` - Hex encoding/decoding
- `chrono` - Timestamp handling

**Future dependencies** (for implementation):
- `reqwest` - HTTP client for overlay services
- `tokio` - Async runtime (already included by Tauri)
- `sha2` - SHA-256 hashing for Merkle proofs (already in Cargo.toml)

## BRC Compliance

| BRC | Title | Status |
|-----|-------|--------|
| BRC-8 | Transaction Envelopes | Types defined ✅ |
| BRC-9 | Simplified Payment Verification | Types defined ✅ |
| BRC-62 | BEEF Transactions | Types defined ✅ |
| BRC-67 | SPV | Types defined ✅ |
| BRC-71 | Merkle Path Binary Format | Types defined ✅ |
| BSV Overlay Services | Topic-based UTXO tracking | Types defined ✅ |

## Next Steps

1. **Implement SPV verification** - `spv_domain/verifier.rs` (~300 LOC)
2. **Implement overlay client** - `overlay_domain/client.rs` (~400 LOC)
3. **Implement subscription manager** - `subscription/manager.rs` (~200 LOC)
4. **Add Tauri commands** - `commands/spv.rs`, `commands/overlay.rs` (~150 LOC)
5. **Build frontend hooks** - `useSpvVerification`, `useOverlay`, update `useSubscription` (~300 LOC)
6. **Create UI components** - Subscription status UI (~200 LOC)
7. **Write integration tests** - SPV, overlay, subscription (~400 LOC)

**Estimated Phase 2 implementation**: ~2,000 LOC (Rust) + ~500 LOC (TypeScript) = 2,500 LOC

---

**References**:
- BRC-8: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0008.md
- BRC-9: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0009.md
- BRC-62: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0062.md
- BRC-67: https://github.com/bitcoin-sv/BRCs/blob/master/transactions/0067.md
- Overlay Services: https://github.com/bitcoin-sv/overlay-services
