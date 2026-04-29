# Phase 1 → Phase 2 Handoff Notes

**From**: Phase 1 — Crypto Domain & BSV Identity
**To**: Phase 2 — Subscription System
**Date**: 2026-02-09
**Status**: PLANNED (Phase 1 not yet complete)

---

## Executive Summary

This document describes what Phase 2 developers will receive from Phase 1, what APIs are ready to use, what remains to be implemented, and critical decisions that need to be made before Phase 2 begins.

**Key Deliverables from Phase 1**:
- ✅ Crypto Domain with BRC-42 key derivation
- ✅ OS keychain integration (macOS, Windows, Linux)
- ✅ BSV identity system (petname, avatar, short ID)
- ✅ Audit logging infrastructure
- ⏸️ Subscription verification scaffolding (stub only)

**Phase 2 Dependencies**: All clear — Phase 1 provides everything Phase 2 needs.

---

## Crypto Domain API Surface

### Ready for Use in Phase 2

The following Crypto Domain functions are **fully implemented and tested**:

#### 1. `sign(payload, protocolID, keyID, counterparty)`

**Purpose**: Sign arbitrary data with derived or identity key

**Signature**:
```rust
pub fn sign(
    &self,
    request: SignRequest
) -> CryptoResult<SignResponse>

// SignRequest:
pub struct SignRequest {
    pub payload: Vec<u8>,           // Data to sign
    pub protocol_id: String,        // "edwinpai", "brc103", etc.
    pub key_id: String,             // "subscription", "auth-<timestamp>", etc.
    pub counterparty: Option<String>, // Counterparty pubkey (for BRC-42 derivation)
}

// SignResponse:
pub struct SignResponse {
    pub signature: Vec<u8>,   // DER-encoded ECDSA signature
    pub public_key: String,   // Public key that signed (hex, 66 chars)
}
```

**Usage in Phase 2**:
```rust
// Sign subscription UTXO spending transaction
let request = SignRequest {
    payload: tx_data,
    protocol_id: "edwinpai".to_string(),
    key_id: "subscription".to_string(),
    counterparty: Some(OCI_PUBKEY.to_string()), // OCI's public key
};

let response = crypto_domain.sign(request)?;
// response.signature → attach to transaction
```

**Audit**: Every call logged to `~/.edwinpai/audit/crypto.jsonl`

---

#### 2. `verify(payload, signature, publicKey)`

**Purpose**: Verify ECDSA signature

**Signature**:
```rust
pub fn verify(
    &self,
    request: VerifyRequest
) -> CryptoResult<VerifyResponse>

// VerifyRequest:
pub struct VerifyRequest {
    pub payload: Vec<u8>,      // Data that was signed
    pub signature: Vec<u8>,    // DER-encoded signature
    pub public_key: String,    // Signer's public key (hex, 66 chars)
}

// VerifyResponse:
pub struct VerifyResponse {
    pub valid: bool,  // true if signature is valid
}
```

**Usage in Phase 2**:
```rust
// Verify BEEF Merkle proof signature (from Arcade or Overlay)
let request = VerifyRequest {
    payload: merkle_root_data,
    signature: proof.signature,
    public_key: arcade_pubkey,
};

let response = crypto_domain.verify(request)?;
if !response.valid {
    return Err(CryptoError::InvalidSignature);
}
```

---

#### 3. `derive_child_public_key(params)`

**Purpose**: BRC-42 key derivation (sender's perspective)

**Signature**:
```rust
pub fn derive_child_public_key(
    &self,
    params: Brc42Params
) -> CryptoResult<String>

// Brc42Params:
pub struct Brc42Params {
    pub protocol_id: String,        // "edwinpai"
    pub key_id: String,             // "subscription"
    pub counterparty_pubkey: String, // OCI's public key
    pub security_level: u8,         // 2 (per BRC-43)
}
```

**Usage in Phase 2**:
```rust
// Derive shared public key for subscription UTXO with OCI
let params = Brc42Params {
    protocol_id: "edwinpai".to_string(),
    key_id: "subscription".to_string(),
    counterparty_pubkey: OCI_PUBKEY.to_string(),
    security_level: 2,
};

let child_pubkey = crypto_domain.derive_child_public_key(params)?;
// child_pubkey → use in P2PKH locking script
```

**Formula** (SPEC §4.3):
1. `sharedSecret = userPrivateKey * OCI_PublicKey` (ECDH)
2. `hmac = HMAC-SHA256(sharedSecret, "2-edwinpai-subscription")`
3. `scalar = bigEndian(hmac)`
4. `point = scalar * G`
5. `childPublicKey = point + OCI_PublicKey`

**Tested**: 10/10 BRC-42 test vectors pass

---

#### 4. `get_identity_public_key()`

**Purpose**: Retrieve user's identity public key

**Signature**:
```rust
pub fn get_identity_public_key(&self) -> CryptoResult<String>
```

**Usage in Phase 2**:
```rust
// Include in subscription UTXO metadata for OCI
let user_pubkey = crypto_domain.get_identity_public_key()?;
// user_pubkey → send to OCI during subscription handshake
```

**Note**: Returns the **master identity public key** (not derived). For derived keys, use `derive_child_public_key()`.

---

### Scaffolded (Not Implemented)

The following functions are **stubbed** in Phase 1 and need full implementation in Phase 2:

#### 5. `check_subscription(forceRefresh)` ⏸️ STUB

**Purpose**: Verify subscription UTXO status via SPV

**Planned Signature**:
```rust
pub fn check_subscription(
    &self,
    request: CheckSubscriptionRequest
) -> CryptoResult<CheckSubscriptionResponse>

// CheckSubscriptionRequest:
pub struct CheckSubscriptionRequest {
    pub force_refresh: bool,  // If true, ignore cached proof
}

// CheckSubscriptionResponse:
pub struct CheckSubscriptionResponse {
    pub active: bool,               // UTXO unspent?
    pub state: SubscriptionState,   // Active/Cached/Expired/GraceExceeded/NotFound
    pub expires_at: Option<String>, // ISO 8601 timestamp (if applicable)
    pub cached_proof: bool,         // Using cached Merkle proof?
    pub verified_at: String,        // ISO 8601 timestamp of last verification
}

// SubscriptionState enum:
pub enum SubscriptionState {
    Active,         // UTXO unspent, verified <72h ago
    Cached,         // UTXO unspent (last check), offline >0h <72h
    Expired,        // UTXO spent on-chain
    GraceExceeded,  // Cannot verify, offline >72h
    NotFound,       // No subscription UTXO exists
}
```

**Phase 2 Implementation Requirements**:
1. **UTXO Lookup**:
   - Query BSV Overlay Services (custom `edwinpai-subscriptions` topic manager)
   - Endpoint: `https://overlay.oci.example/lookup?utxo=<txid>:<vout>`
   - Returns: UTXO state + BEEF proof (BRC-62 format)

2. **BEEF Proof Parsing** (BRC-62):
   - Parse version, BUMP (BSV Unified Merkle Path), transaction list
   - Extract Merkle path from BUMP
   - Calculate Merkle root: `hash(hash(...hash(txid, sibling), sibling)...)`

3. **Merkle Root Verification**:
   - Fetch block header from Arcade: `GET /chain/header/<blockHash>`
   - Verify Merkle root matches header's `merkleRoot` field
   - Verify block header signature (optional, depends on header service)

4. **Cached Proof Storage**:
   - Store valid proof in `~/.edwinpai/subscription_cache.json`:
     ```json
     {
       "txid": "abc123...",
       "vout": 0,
       "merkleProof": "...",
       "blockHeight": 850000,
       "verifiedAt": "2026-02-09T10:30:00Z"
     }
     ```
   - Grace period: 72 hours from `verifiedAt`

5. **State Machine** (SPEC §5.6):
   ```
   NotFound → (create UTXO) → Active
   Active → (72h no verify) → Cached
   Cached → (verify success) → Active
   Cached → (72h timeout) → GraceExceeded
   Active → (UTXO spent) → Expired
   ```

**Stub Location**: `src-tauri/src/crypto_domain/subscription.rs`

**Phase 2 Task**: Implement full SPV verification logic

---

## Pending Integrations

### 1. Transaction Construction

**Question**: Where should subscription UTXO creation happen?

**Option A: Rust (Crypto Domain)**
- Pros: Private key stays in Crypto Domain, never exposed to frontend
- Cons: Need BSV SDK bindings in Rust (use `bsv-rs` or native implementation)

**Option B: TypeScript (Frontend + Crypto Domain signing)**
- Pros: Use existing `@bsv/sdk` (already a dependency), familiar API
- Cons: Frontend constructs unsigned tx, sends to Crypto Domain for signing

**Recommendation**: **Option A** (Rust) for security
- Keep all key operations in Crypto Domain
- Use `bsv-rs` or native implementation (secp256k1 + transaction builder)

**Decision Point**: Before Phase 2 begins

---

### 2. Overlay Services Configuration

**Question**: How should EdwinPAI discover/connect to the `edwinpai-subscriptions` overlay node?

**Option A: Hardcode OCI's Overlay Endpoint**
- Pros: Simple, guaranteed to work (OCI controls overlay)
- Cons: Single point of failure, centralized

**Option B: Configurable Overlay URL**
- Pros: Users can run their own overlay, or use alternative providers
- Cons: Requires UI for configuration, more complex

**Recommendation**: **Option A** for Phase 2 (MVP), **Option B** for Phase 6 (advanced settings)
- Hardcode: `https://overlay.edwinpai.oci.example`
- Phase 6: Add Settings → Advanced → "Custom Overlay URL"

**Decision Point**: Confirm OCI overlay endpoint URL before Phase 2

---

### 3. Fallback Strategy

**Question**: What happens if OCI's overlay is unreachable?

**Option A: Fail Fast**
- Return `SubscriptionState::GraceExceeded` immediately
- Pros: Simple, clear failure mode
- Cons: Poor UX during OCI downtime

**Option B: Fallback to Direct Arcade Query**
- Query Arcade directly: `GET /tx/<txid>` to check UTXO status
- Pros: Resilient to overlay downtime
- Cons: Requires Arcade API client, less efficient (no topic filtering)

**Option C: Cached Proof + 72h Grace**
- Use cached proof during overlay downtime (up to 72h)
- Pros: Best UX, offline-friendly
- Cons: Delayed detection if UTXO spent during outage

**Recommendation**: **Option C** (already in design)
- Primary: Query overlay
- Fallback 1: Use cached proof (if <72h old)
- Fallback 2: After 72h, enter degraded mode (local-only, no channels)

**Decision Point**: Acceptable (no changes needed)

---

### 4. Cached Proof Format

**Question**: JSON or binary (CBOR) for cached Merkle proofs?

**Option A: JSON**
- Pros: Human-readable, easy to debug, standard tooling
- Cons: Larger file size (~20% overhead)

**Option B: CBOR (Concise Binary Object Representation)**
- Pros: Smaller file size, faster parsing
- Cons: Not human-readable, requires CBOR library

**Recommendation**: **Option A** (JSON) for Phase 2
- File size difference negligible (single proof ~1KB vs ~1.2KB)
- Debuggability more important for MVP
- Phase 6: Optimize to CBOR if needed

**Example JSON** (`~/.edwinpai/subscription_cache.json`):
```json
{
  "txid": "abc123def456...",
  "vout": 0,
  "merkleProof": {
    "blockHash": "0000000000000abc...",
    "blockHeight": 850000,
    "merklePath": [
      { "offset": 0, "hash": "123..." },
      { "offset": 1, "hash": "456..." }
    ]
  },
  "verifiedAt": "2026-02-09T10:30:00Z",
  "expiresAt": "2026-02-12T10:30:00Z"
}
```

**Decision Point**: Acceptable (JSON for Phase 2)

---

## Open Questions for Phase 2

Before starting Phase 2 implementation, resolve:

### Critical Questions

1. **OCI Overlay Endpoint URL**:
   - [ ] Confirm production overlay URL: `https://overlay.edwinpai.oci.example`
   - [ ] Confirm API format: REST or WebSocket?
   - [ ] Confirm authentication: None, or BRC-103 signed requests?

2. **BRC-42 Invoice Number Format**:
   - [ ] Confirm OCI uses `2-edwinpai-subscription` (per SPEC §5.2)
   - [ ] If different, update `SPEC.md` and Phase 1 tests

3. **Transaction Construction**:
   - [ ] Decide: Rust (Crypto Domain) or TypeScript (frontend)?
   - [ ] If Rust: Which BSV library? (`bsv-rs`, native, or FFI to `@bsv/sdk`?)

4. **Subscription UTXO Amount**:
   - [ ] Confirm subscription amount (satoshis)
   - [ ] Fiat equivalent display (USD, EUR, etc.)
   - [ ] Payment flow: QR code + wallet deep link, or manual tx construction?

### Non-Critical Questions (Defer to Phase 6)

- [ ] Subscription cancellation UI flow (button placement, confirmation dialog)
- [ ] Subscription renewal flow (before expiration, after expiration)
- [ ] `OP_CHECKLOCKTIMEVERIFY` recovery branch (1-year timeout?)

---

## Known Limitations (from Phase 1)

Phase 2 should be aware of these Phase 1 limitations:

### 1. Keychain on Headless Linux

**Issue**: `keyring` crate requires running Secret Service (D-Bus). Headless servers fail.

**Impact on Phase 2**: None (desktop app always has GUI)

**Future**: Phase 6 can add encrypted file fallback for server deployments.

---

### 2. Memory Zeroing

**Issue**: Rust `Drop` trait zeros memory, but OS can still swap to disk.

**Impact on Phase 2**: Low risk (private keys in memory briefly during signing)

**Future**: Phase 6 can explore `mlock()` to prevent swapping sensitive memory pages.

---

### 3. Identicon Collisions

**Issue**: 256×256 petname space = 65,536 unique names. Rare but possible collisions.

**Impact on Phase 2**: None (single-user mode)

**Future**: Phase 4 multi-user should detect petname collisions within same household.

---

### 4. BRC-42 Invoice Number Format

**Issue**: EdwinPAI uses `2-edwinpai-subscription`. If OCI uses different format, derivation fails.

**Impact on Phase 2**: **Critical** — must confirm with OCI before implementation.

**Mitigation**: Add invoice number to subscription setup API call, let OCI dictate format.

---

## Files to Review Before Phase 2

| File | Purpose | Action |
|------|---------|--------|
| `src-tauri/src/crypto_domain/subscription.rs` | Stub implementation | Replace stub with full SPV logic |
| `src/types/subscription.ts` | State machine types | Validate against SPEC §5.6 |
| `src/hooks/useSubscription.ts` | Polling logic | Implement periodic verification (1h interval) |
| `SPEC.md §5` | Subscription protocol | Review BEEF, UTXO tracking, Overlay Services |
| `PLAN.md Phase 2` | Task breakdown | Follow 5-task structure |

---

## Dependencies Added in Phase 2

Phase 2 will likely need:

### Rust (Cargo.toml)

```toml
# BEEF proof parsing (BRC-62)
# Option: Use existing BSV library or write custom parser
# TBD based on transaction construction decision

# HTTP client for Overlay Services / Arcade
reqwest = { version = "0.11", features = ["json", "rustls-tls"] }

# CBOR parsing (if using binary cached proofs)
# serde_cbor = "0.11"  # Optional, use if choosing CBOR over JSON
```

### TypeScript (package.json)

No new dependencies expected (unless transaction construction happens in frontend).

---

## Phase 2 Deliverables Expected

What Phase 1 expects Phase 2 to deliver:

1. **Subscription UTXO creation flow**:
   - [ ] User initiates payment
   - [ ] BRC-42 key derivation with OCI
   - [ ] Transaction construction and broadcast (via Arcade)
   - [ ] Wait for confirmation + Merkle proof

2. **SPV verification**:
   - [ ] BEEF proof parser (BRC-62)
   - [ ] Merkle root calculation from BUMP
   - [ ] Block header verification (via Arcade)
   - [ ] UTXO tracking via Overlay Services

3. **Subscription state management**:
   - [ ] State machine: `NotFound → Active → Cached → Expired / GraceExceeded`
   - [ ] Periodic verification (1h interval)
   - [ ] Cached proof storage (`~/.edwinpai/subscription_cache.json`)
   - [ ] 72-hour offline grace period

4. **Frontend UI**:
   - [ ] Subscription status card (active/cached/expired indicators)
   - [ ] Setup flow during onboarding (payment, confirmation)
   - [ ] Settings page: status display, cancel button

5. **Tests**:
   - [ ] BEEF proof parser tests (valid/invalid proofs)
   - [ ] State machine tests (all transitions)
   - [ ] Periodic verification tests (mock timer)
   - [ ] Integration tests (create UTXO on testnet, verify)

---

## Handoff Checklist

Before Phase 2 begins:

- [ ] **Phase 1 complete** (all 6 tasks verified)
- [ ] **All Phase 1 tests passing** (80 automated + 5 manual)
- [ ] **BRC-42 test vectors: 10/10 PASS**
- [ ] **Crypto Domain API surface documented** (this document)
- [ ] **Open questions resolved** (OCI endpoint, invoice format, tx construction)
- [ ] **Phase 2 team briefed** (kickoff meeting)

**Handoff Meeting Agenda**:
1. Demo Phase 1 functionality (identity generation, keychain, BRC-42)
2. Walk through Crypto Domain API (sign, verify, derive_child_public_key)
3. Review subscription stub (`subscription.rs`)
4. Discuss open questions (OCI endpoint, tx construction)
5. Review SPEC.md §5 (Subscription Protocol)
6. Q&A

---

## Success Metrics for Phase 2

Phase 2 is successful if:

1. ✅ Subscription UTXO created on BSV testnet
2. ✅ SPV verification of UTXO status via Merkle proof
3. ✅ Offline grace period works (72h cached proof)
4. ✅ Subscription status reflected in UI in real-time
5. ✅ Cancellation flow works (UTXO spent, UI updates)
6. ✅ Gateway starts only if subscription active

---

**Phase 2 Estimated Duration**: 3-4 weeks
**Phase 2 Start Date**: TBD (after Phase 1 complete)

---

*Handoff document version: 1.0 (2026-02-09)*
