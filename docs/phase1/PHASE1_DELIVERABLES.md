# Phase 1 Deliverables — Crypto Domain & BSV Identity

**Status**: Not Yet Started
**Target**: Implement security-critical crypto operations and BSV identity system
**Expected Duration**: 3-4 weeks
**Prerequisites**: Phase 0 ✅ Complete

---

## 1. File Manifest

### New Files (Expected)

#### Rust Backend — Crypto Domain (`src-tauri/src/crypto_domain/`)
| File | Purpose | Est. LOC |
|------|---------|----------|
| `mod.rs` | Module exports and re-exports | 30 |
| `types.rs` | Type definitions for crypto operations | 150 |
| `traits.rs` | Trait definitions for domain interfaces | 100 |
| `domain.rs` | Main `EdwinPAICryptoDomain` orchestrator | 200 |
| `signing.rs` | ECDSA signing/verification primitives | 120 |
| `brc42.rs` | BRC-42 key derivation implementation | 250 |
| `identity.rs` | Petname + identicon generation | 180 |
| `keychain.rs` | OS keychain integration (macOS/Windows/Linux) | 150 |
| `audit.rs` | Append-only audit log writer | 100 |
| `subscription.rs` | UTXO verification scaffolding (Phase 2 stub) | 80 |

**Subtotal**: ~1,360 LOC

#### Rust Backend — Tauri Commands (`src-tauri/src/commands/`)
| File | Purpose | Est. LOC |
|------|---------|----------|
| `crypto.rs` | IPC bridge to Crypto Domain | 180 |
| `keychain.rs` | Keychain read/write commands | 80 |

**Modified**: `mod.rs`, `main.rs`
**Subtotal**: ~260 LOC

#### TypeScript Frontend — Crypto Library (`src/lib/`)
| File | Purpose | Est. LOC |
|------|---------|----------|
| `crypto.ts` | Tauri IPC wrappers for crypto operations | 150 |
| `identity.ts` | Petname/avatar/shortId derivation | 180 |
| `petname-wordlists.ts` | Adjective/noun word lists (256 each) | 600 |
| `identicon-generator.ts` | Deterministic SVG identicon renderer | 200 |
| `brc42.ts` | BRC-42 key derivation helpers (frontend validation) | 100 |

**Subtotal**: ~1,230 LOC

#### TypeScript Frontend — React Components (`src/components/`)
| File | Purpose | Est. LOC |
|------|---------|----------|
| `onboarding/IdentitySetup.tsx` | First-run identity generation UI | 150 |
| `shared/IdentityBadge.tsx` | Petname + avatar + short ID display | 80 |
| `shared/IdentityCard.tsx` | Full identity card with public key | 100 |
| `settings/IdentitySettings.tsx` | View/export identity settings | 120 |

**Subtotal**: ~450 LOC

#### TypeScript Frontend — Hooks & Stores (`src/hooks/`, `src/stores/`)
| File | Purpose | Est. LOC |
|------|---------|----------|
| `hooks/useIdentity.ts` | Identity state management hook | 80 |
| `stores/identityStore.ts` | Zustand store for identity | 100 |

**Subtotal**: ~180 LOC

#### TypeScript Frontend — Types (`src/types/`)
| File | Purpose | Est. LOC |
|------|---------|----------|
| `crypto.ts` | Crypto operation types (IPC messages) | 120 |
| `identity.ts` | Identity-related types | 80 |
| `identity-setup.ts` | Onboarding wizard state types | 60 |

**Already created in Phase 0** (from type definitions task)

#### Tests (`src/test/`, `src-tauri/src/`)
| File | Purpose | Est. LOC |
|------|---------|----------|
| `test/crypto/brc42.test.ts` | BRC-42 test vectors (10 cases) | 200 |
| `test/crypto/signing.test.ts` | Signing/verification tests | 120 |
| `test/identity/petname.test.ts` | Petname generation tests | 80 |
| `test/identity/identicon.test.ts` | Identicon determinism tests | 80 |
| `test/audit/audit-log.test.ts` | Audit log write/read tests | 100 |
| `crypto_domain/mod.rs` (unit tests) | Rust unit tests for crypto_domain | 300 |

**Subtotal**: ~880 LOC

### Modified Files

| File | Changes | Impact |
|------|---------|--------|
| `src-tauri/Cargo.toml` | Add crypto dependencies (see §2) | +8 lines |
| `src-tauri/src/main.rs` | Register crypto commands | +15 lines |
| `src-tauri/src/lib.rs` | Export crypto_domain module | +5 lines |
| `src-tauri/tauri.conf.json` | Add keychain capability | +10 lines |
| `package.json` | Add @bsv/sdk (already present from Phase 0) | 0 lines |
| `src/App.tsx` | Add identity initialization on mount | +20 lines |

### Summary

| Category | New Files | Modified Files | Est. New LOC |
|----------|-----------|----------------|--------------|
| Rust backend | 12 | 4 | ~1,620 |
| TypeScript frontend | 12 | 1 | ~1,860 |
| Tests | 6 | 0 | ~880 |
| **TOTAL** | **30** | **5** | **~4,360** |

---

## 2. Dependency Audit

### Cargo.toml Changes

**Added Dependencies** (Crypto & Keychain):
```toml
# Crypto primitives
secp256k1 = { version = "0.29", features = ["rand", "recovery", "global-context"] }
sha2 = "0.10"
hmac = "0.12"

# Keychain integration
keyring = "3.5"

# Identicon generation
hex = "0.4"

# Audit logging
chrono = { version = "0.4", features = ["serde"] }
```

**Version Locks**:
- `secp256k1 = 0.29.1` (latest stable as of 2026-02)
- `sha2 = 0.10.8`
- `hmac = 0.12.1`
- `keyring = 3.5.0` (cross-platform keychain abstraction)
- `hex = 0.4.3`
- `chrono = 0.4.38`

**Security Audit**:
- ✅ `secp256k1` — widely used Bitcoin library, maintained by rust-bitcoin team
- ✅ `sha2` — RustCrypto implementation, audited
- ✅ `hmac` — RustCrypto implementation, audited
- ✅ `keyring` — actively maintained, supports macOS/Windows/Linux
- ✅ No known CVEs in selected versions

**Total Rust Dependencies**: +6

### package.json Changes

**No new dependencies required**. Phase 0 already added `@bsv/sdk`:
```json
"@bsv/sdk": "^1.1.51"
```

Phase 1 uses `@bsv/sdk` for:
- Public key validation (frontend)
- Transaction construction scaffolding (Phase 2 prep)

**Total npm Dependencies**: 0 (no change from Phase 0)

### Dependency Graph Impact

```
Phase 1 Runtime Dependencies:
edwinpai-desktop (Tauri)
  ├── secp256k1 (new) ← Bitcoin elliptic curve operations
  │   └── (no network access)
  ├── sha2 (new) ← Hashing for identity derivation
  ├── hmac (new) ← BRC-42 HMAC-SHA256
  ├── keyring (new) ← OS keychain access
  │   ├── macOS: Security.framework (system)
  │   ├── Windows: wincred (system)
  │   └── Linux: libsecret (system)
  ├── chrono (new) ← Timestamp generation for audit log
  └── @bsv/sdk (Phase 0) ← Public key utilities (frontend)
```

### Build Size Impact

| Platform | Phase 0 Binary Size | Phase 1 Estimate | Δ |
|----------|---------------------|------------------|---|
| Linux (x86_64) | ~4.2 MB | ~5.8 MB | +1.6 MB |
| macOS (arm64) | ~3.8 MB | ~5.2 MB | +1.4 MB |
| Windows (x86_64) | ~4.5 MB | ~6.1 MB | +1.6 MB |

**Size increase primarily from**: `secp256k1` static library (~1.2 MB)

---

## 3. Test Coverage Report

### Unit Tests (TypeScript)

| Suite | File | Test Count | Coverage Target |
|-------|------|------------|-----------------|
| BRC-42 Derivation | `crypto/brc42.test.ts` | 10 | 100% (test vectors) |
| Signing/Verification | `crypto/signing.test.ts` | 8 | 100% |
| Petname Generation | `identity/petname.test.ts` | 6 | 100% (determinism) |
| Identicon Generation | `identity/identicon.test.ts` | 5 | 100% (determinism) |
| Audit Log | `audit/audit-log.test.ts` | 6 | 90% |

**Total TypeScript Unit Tests**: 35
**Expected Coverage**: 95%+ for crypto/identity modules

### Unit Tests (Rust)

| Module | Test Count | Coverage Target |
|--------|------------|-----------------|
| `brc42.rs` | 12 (BRC-42 test vectors) | 100% |
| `signing.rs` | 8 (sign/verify primitives) | 100% |
| `identity.rs` | 6 (petname/identicon) | 100% |
| `keychain.rs` | 5 (read/write/error cases) | 85% (platform-dependent) |
| `audit.rs` | 4 (log write/read/rotation) | 90% |
| `domain.rs` | 10 (integration tests) | 80% |

**Total Rust Unit Tests**: 45
**Expected Coverage**: 90%+ for crypto_domain

### Integration Tests

| Test | Purpose | Status |
|------|---------|--------|
| IPC Bridge | Tauri command → Crypto Domain round-trip | Pending |
| Keychain First Run | Generate + store + retrieve key | Pending |
| BRC-42 End-to-End | Derive key between two parties | Pending |
| Identity Display | Generate identity → render in UI | Pending |
| Audit Log Persistence | Write log → restart → read log | Pending |

**Total Integration Tests**: 5
**Expected Runtime**: <10s

### Test Execution

```bash
# TypeScript tests
npm run test              # Run all frontend unit tests (vitest)

# Rust tests
cd src-tauri && cargo test  # Run all backend unit tests

# Integration tests (manual for Phase 1)
npm run dev                # Start app
# Follow test checklist in docs/PHASE1_TEST_PLAN.md
```

### BRC-42 Test Vectors

**Critical**: Must pass all 10 official BRC-42 test vectors from the spec:
- Test vectors sourced from: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md#test-vectors
- Validates: ECDH computation, HMAC derivation, scalar math, point addition
- **Non-negotiable**: 100% pass rate required for Phase 1 completion

---

## 4. Phase 1 Completion Checklist

Per PLAN.md §Phase 1, the following 6 tasks must be verified:

### ✅ Task 1: Crypto Domain Daemon (Rust)

- [ ] Separate process architecture (sidecar or embedded service)
- [ ] IPC channel between Tauri shell and Crypto Domain
- [ ] Message types implemented:
  - [ ] `SignRequest` / `SignResponse`
  - [ ] `VerifyRequest` / `VerifyResponse`
  - [ ] `GetPublicKeyRequest` / `GetPublicKeyResponse`
  - [ ] `EncryptRequest` / `EncryptResponse` (scaffolding)
  - [ ] `DecryptRequest` / `DecryptResponse` (scaffolding)
- [ ] Audit logging: append-only log at `~/.edwinpai/audit/crypto.jsonl`
- [ ] Memory zeroing on process exit

**Verification**:
```bash
# Start app, check process list
ps aux | grep edwinpai
# Should see: edwinpai-desktop (Tauri) + crypto-domain (if separate process)

# Check audit log exists
cat ~/.edwinpai/audit/crypto.jsonl
# Should contain JSON lines for each crypto operation
```

### ✅ Task 2: OS Keychain Integration

- [ ] macOS: Keychain Services via `security-framework` or `keyring` crate
- [ ] Windows: Windows Credential Manager via `wincred` / `keyring`
- [ ] Linux: Secret Service (libsecret) via `keyring` crate
- [ ] Store/retrieve `edwinpai.identity.privateKey` (hex-encoded, 32 bytes)
- [ ] Store/retrieve `edwinpai.identity.publicKey` (compressed, 33 bytes hex)
- [ ] Memory zeroing on process exit

**Verification**:
```bash
# macOS
security find-generic-password -s "edwinpai.identity.privateKey" -a "$USER"

# Linux (GNOME Keyring)
secret-tool search service edwinpai.identity.privateKey

# Windows (PowerShell)
cmdkey /list | findstr edwinpai
```

### ✅ Task 3: BSV Keypair Generation

- [ ] Generate secp256k1 keypair using `secp256k1` crate
- [ ] First-run detection: check keychain for existing key
- [ ] If none exists, generate and store
- [ ] Public key derivation (compressed format: 33 bytes)
- [ ] Private key format: 32-byte scalar

**Verification**:
```bash
# First run: key generated
# Second run: existing key loaded (check audit log for "keychain_read" vs "keychain_write")
```

### ✅ Task 4: BRC-42 Key Derivation

- [ ] ECDH shared secret computation: `privKey * counterpartyPubKey`
- [ ] HMAC-SHA256 over invoice number: `HMAC-SHA256(sharedSecret, invoiceNumber)`
- [ ] Scalar-to-point multiplication: `scalar * G`
- [ ] Scalar addition (mod N): `(hmacScalar + basePrivKey) mod N`
- [ ] Public key derivation: `hmacPoint + basePubKey`
- [ ] Validate against BRC-42 test vectors (10 cases)

**Verification**:
```bash
# Run test suite
npm run test crypto/brc42.test.ts
# Expected: 10/10 test vectors PASS
```

### ✅ Task 5: Human-Readable Identity

- [ ] Petname derivation:
  - [ ] `SHA-256(publicKey)` → first 2 bytes for adjective, next 2 for noun
  - [ ] Word list lookup (256 adjectives, 256 nouns)
  - [ ] Display format: "Adjective Noun" (e.g., "Swift Falcon")
- [ ] Avatar generation:
  - [ ] Deterministic identicon/blockies SVG from public key
  - [ ] Size: 64x64px (configurable)
  - [ ] Color palette: deterministic from hash
- [ ] Short ID:
  - [ ] Format: `edw:<first 8 hex chars of SHA-256(publicKey)>`
  - [ ] Example: `edw:a3f7b2c1`
- [ ] React components:
  - [ ] `IdentityBadge.tsx`: compact display (avatar + petname)
  - [ ] `IdentityCard.tsx`: full card (avatar + petname + shortId + public key)
  - [ ] `useIdentity` hook: load identity from Crypto Domain

**Verification**:
```bash
# Run app, check identity display in TopBar
# Should show: avatar + petname (e.g., "Swift Falcon")

# Open Settings → Identity
# Should show: full public key + petname + short ID
```

### ✅ Task 6: BRC-103 Request Signing

- [ ] Session management: nonce generation (32 bytes random)
- [ ] Nonce cache with TTL (default: 5 minutes)
- [ ] `initialRequest` / `initialResponse` handshake:
  - [ ] Client sends: `{ publicKey, nonce }`
  - [ ] Server responds: `{ publicKey, nonce, clientNonceEcho, signature }`
- [ ] Request signing:
  - [ ] `X-BSV-Identity: <publicKey>` header
  - [ ] `X-BSV-Nonce: <sessionNonce>` header
  - [ ] `X-BSV-Signature: <signature>` header (signature over body + nonce)
- [ ] Replay protection:
  - [ ] Nonce uniqueness check (reject duplicates)
  - [ ] Timing anomaly detection (reject if timestamp >30s from server time)

**Verification**:
```bash
# Start gateway (Phase 3 dependency — stub endpoint for Phase 1 testing)
# Use curl to test BRC-103 handshake:

curl -X POST http://localhost:3117/v1/edwinpai/auth/initial \
  -H "Content-Type: application/json" \
  -d '{"publicKey":"02abc...", "nonce":"def..."}'

# Expected: 200 OK with signature response
```

---

## 5. Handoff Notes for Phase 2

### Crypto Domain API Surface

**Ready for Phase 2**:
- ✅ `EdwinPAICryptoDomain::sign(payload, protocolID, keyID, counterparty)` — used for subscription UTXO signing
- ✅ `EdwinPAICryptoDomain::verify(payload, signature, publicKey)` — used for BEEF proof validation
- ✅ `EdwinPAICryptoDomain::derive_child_public_key(params)` — used for subscription key derivation with OCI
- ✅ `EdwinPAICryptoDomain::get_identity_public_key()` — used for OCI handshake

**Scaffolded (not implemented)**:
- ⏸️ `EdwinPAICryptoDomain::check_subscription(forceRefresh)` — stub in `subscription.rs`, full implementation in Phase 2
- ⏸️ BEEF proof parsing — types defined, parser implementation in Phase 2
- ⏸️ UTXO tracking — Overlay Services integration in Phase 2

### Pending Integrations

#### Phase 2 Dependencies
1. **Subscription UTXO Creation**:
   - Uses: `derive_child_public_key(protocolID="edwinpai", keyID="subscription", counterparty=OCI_PUBKEY)`
   - Uses: `sign(txData, protocolID="edwinpai", keyID="subscription", counterparty=OCI_PUBKEY)`
   - Needs: Transaction construction via `@bsv/sdk` (frontend or backend?)

2. **SPV Verification**:
   - Uses: `verify(merkleRoot, proof, blockHeaderSignature)`
   - Needs: Block header fetching (Arcade client)
   - Needs: BEEF proof parser (BRC-62 implementation)

3. **Subscription State Management**:
   - Uses: `check_subscription(forceRefresh=false)` → queries overlay, returns status
   - Needs: Overlay Services client (HTTP or WebSocket)
   - Needs: Cached proof storage (`~/.edwinpai/subscription_cache.json`)

#### Open Questions for Phase 2
- [ ] **Transaction construction location**: Should subscription UTXO creation happen in Rust (Crypto Domain) or TypeScript (frontend + Tauri command)? Recommend Rust for security.
- [ ] **Overlay node URL**: Hardcode OCI's overlay endpoint or make configurable?
- [ ] **Fallback strategy**: If OCI overlay is down, fall back to direct Arcade query or fail fast?
- [ ] **Cached proof format**: JSON or binary (CBOR)? JSON recommended for debuggability.
- [ ] **Grace period UX**: Should "cached" state be visually distinct from "active"? Or only show warning at 48h?

### Known Limitations

1. **Keychain on headless Linux**: `keyring` crate requires a running Secret Service (D-Bus). Headless servers need encrypted file fallback.
2. **Memory zeroing**: Rust `Drop` implementation zeros memory, but OS can still swap to disk. Phase 6 should explore `mlock()` for sensitive pages.
3. **Identicon collisions**: 256×256 petname space = 65,536 unique names. Rare but possible. Phase 4 multi-user should check for petname collisions in same household.
4. **BRC-42 invoice number format**: Using `2-edwinpai-subscription` per BRC-43. If OCI uses different format, derivation will fail. Confirm with OCI before Phase 2.

### Files to Review Before Phase 2

| File | Why |
|------|-----|
| `src-tauri/src/crypto_domain/subscription.rs` | Stub implementation — expand in Phase 2 |
| `src/types/subscription.ts` | State machine types — validate against SPEC §5.6 |
| `src/hooks/useSubscription.ts` | Polling logic — implement in Phase 2 |
| `SPEC.md §5` | Subscription protocol details — ensure alignment |

### Handoff Checklist

Before starting Phase 2:
- [ ] All Phase 1 tests passing (35 TS + 45 Rust = 80 tests)
- [ ] Crypto Domain audit log verified (contains all sign/verify operations)
- [ ] BRC-42 test vectors 100% pass rate
- [ ] Keychain storage verified on all 3 platforms (macOS/Windows/Linux)
- [ ] Identity displayed correctly in UI (petname + avatar + shortId)
- [ ] No compiler warnings in `cargo build` or `npm run build`
- [ ] Security review: confirm AI Domain cannot access keychain paths

---

## 6. Metrics Summary

| Metric | Target | Expected |
|--------|--------|----------|
| **New Files** | 25-35 | 30 |
| **New LOC** | 4,000-5,000 | 4,360 |
| **Test Count** | 70-90 | 80 |
| **Test Coverage** | >85% | 90%+ |
| **Build Time Δ** | <30s | +15s (secp256k1 compile) |
| **Binary Size Δ** | <2MB | +1.5MB |
| **Dependencies Added** | 5-8 | 6 (Rust only) |
| **CI Pass Rate** | 100% | TBD |

---

## Approval Criteria

Phase 1 is **COMPLETE** when:

1. ✅ All 6 PLAN.md Phase 1 tasks checked off
2. ✅ All 80 tests passing (35 TS + 45 Rust)
3. ✅ BRC-42 test vectors: 10/10 PASS
4. ✅ Keychain storage works on macOS, Windows, Linux (manual verification)
5. ✅ Identity displayed in UI matches keychain-stored public key
6. ✅ Audit log contains all crypto operations with correct timestamps
7. ✅ No ESLint errors, no Rust warnings
8. ✅ CI builds pass on all 3 platforms
9. ✅ Security review: AI Domain isolated from keychain (manual audit)
10. ✅ Handoff document reviewed and approved (this document)

**Review**: Technical lead + security reviewer
**Estimated Completion**: Week 4-5 of development

---

*This document should be updated as Phase 1 progresses. Version: 1.0 (2026-02-09)*
