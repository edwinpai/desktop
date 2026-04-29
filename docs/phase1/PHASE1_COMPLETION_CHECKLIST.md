# Phase 1: Completion Checklist

**Phase**: Phase 1 — Crypto Domain & BSV Identity
**Status**: NOT STARTED
**Date**: 2026-02-09

Use this checklist to track Phase 1 implementation progress. Check off each item as completed.

---

## PLAN.md Task Verification

Per `PLAN.md` Phase 1, verify all 6 core tasks:

### ✅ Task 1: Crypto Domain Daemon (Rust)

Implementation:
- [ ] Separate process architecture (sidecar or embedded)
  - [ ] Crypto Domain runs as isolated process/service
  - [ ] IPC channel established (JSON over stdin/stdout or Unix socket)
- [ ] Message types implemented:
  - [ ] `SignRequest` / `SignResponse` — ECDSA signing
  - [ ] `VerifyRequest` / `VerifyResponse` — signature verification
  - [ ] `GetPublicKeyRequest` / `GetPublicKeyResponse` — identity pubkey retrieval
  - [ ] `EncryptRequest` / `EncryptResponse` — scaffolding (full impl in Phase 2)
  - [ ] `DecryptRequest` / `DecryptResponse` — scaffolding (full impl in Phase 2)
- [ ] Audit logging:
  - [ ] Append-only log at `~/.edwinpai/audit/crypto.jsonl`
  - [ ] Every signing operation logged (timestamp, operation, protocolID, keyID, hash)
  - [ ] AI Domain can read (transparency) but not write (immutability)
- [ ] Memory security:
  - [ ] Memory zeroing on process exit (`Drop` trait with `Zeroize`)

**Verification Commands**:
```bash
# Check process is running
ps aux | grep edwinpai

# Check audit log exists and is append-only
cat ~/.edwinpai/audit/crypto.jsonl
# Should contain JSON lines for each crypto operation

# Check file permissions
ls -la ~/.edwinpai/audit/crypto.jsonl
# Should be -rw-r--r-- (AI Domain can read, only Crypto Domain can write)
```

---

### ✅ Task 2: OS Keychain Integration

Implementation:
- [ ] macOS: Keychain Services integration
  - [ ] Uses `keyring` crate with macOS backend
  - [ ] Stores keys in login keychain
  - [ ] Service: `com.edwinpai.desktop`, Account: `master-identity-key`
- [ ] Windows: Windows Credential Manager integration
  - [ ] Uses `keyring` crate with Windows backend
  - [ ] Stores keys in Credential Manager
- [ ] Linux: Secret Service (libsecret) integration
  - [ ] Uses `keyring` crate with Secret Service backend
  - [ ] Works with GNOME Keyring / KWallet
  - [ ] Fallback if Secret Service unavailable (encrypted file - Phase 6)
- [ ] Key storage:
  - [ ] `edwinpai.identity.privateKey` — 32-byte private key (hex-encoded)
  - [ ] `edwinpai.identity.publicKey` — 33-byte compressed public key (hex-encoded)
- [ ] Memory zeroing on process exit

**Verification Commands**:
```bash
# macOS
security find-generic-password -s "com.edwinpai.desktop" -a "master-identity-key"
# Should show: account="master-identity-key" where="com.edwinpai.desktop"

# Linux (GNOME Keyring)
secret-tool search service com.edwinpai.desktop
# Should show: label = edwinpai.identity.privateKey

# Windows (PowerShell)
cmdkey /list | findstr edwinpai
# Should show: Target: com.edwinpai.desktop
```

---

### ✅ Task 3: BSV Keypair Generation

Implementation:
- [ ] secp256k1 keypair generation using `secp256k1` crate
  - [ ] 32 bytes of cryptographic randomness (OS CSPRNG via `rand::thread_rng()`)
  - [ ] `PrivateKey::from_slice()` for private key
  - [ ] `PublicKey::from_secret_key()` for compressed public key
- [ ] First-run detection:
  - [ ] Check keychain for existing `edwinpai.identity.privateKey`
  - [ ] If none exists, generate and store
  - [ ] If exists, load from keychain
- [ ] Public key format: compressed (33 bytes, starts with 02 or 03)
- [ ] Private key format: 32-byte scalar

**Verification Commands**:
```bash
# First run: key should be generated
rm -rf ~/.edwinpai
npm run dev
# Check logs: "Generated new identity keypair"

# Second run: key should be loaded
npm run dev
# Check logs: "Loaded existing identity keypair"

# Verify same public key on both runs
cat ~/.edwinpai/audit/crypto.jsonl | grep "get_public_key"
# Should show same pubkey on subsequent runs
```

---

### ✅ Task 4: BRC-42 Key Derivation

Implementation:
- [ ] ECDH shared secret computation:
  - [ ] `sharedSecret = senderPrivateKey * recipientPublicKey`
  - [ ] Symmetry verified: both parties compute same secret
- [ ] HMAC-SHA256 derivation:
  - [ ] `hmac = HMAC-SHA256(sharedSecret, invoiceNumber)`
  - [ ] Invoice number format: `<securityLevel>-<protocolID>-<keyID>`
  - [ ] Example: `2-edwinpai-subscription`
- [ ] Scalar-to-point multiplication:
  - [ ] `point = scalar * G` (generator point)
- [ ] Public key derivation:
  - [ ] `childPublicKey = point + basePublicKey`
- [ ] Private key derivation:
  - [ ] `childPrivateKey = (hmacScalar + basePrivateKey) mod N`
- [ ] Test vectors:
  - [ ] All 10 official BRC-42 test vectors pass
  - [ ] Test vectors sourced from: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md

**Verification Commands**:
```bash
# Run BRC-42 test suite
npm run test crypto/brc42.test.ts
cargo test brc42

# Expected output: 10/10 PASS
# Tests:  10 passed, 10 total
```

---

### ✅ Task 5: Human-Readable Identity

Implementation:
- [ ] Petname derivation:
  - [ ] `SHA-256(publicKey)` → first 2 bytes for adjective, next 2 for noun
  - [ ] 256-word adjective list, 256-word noun list
  - [ ] Format: "Adjective Noun" (e.g., "Swift Falcon")
  - [ ] Deterministic: same pubkey → same petname
- [ ] Avatar generation:
  - [ ] Deterministic identicon/blockies SVG from public key
  - [ ] Size: 64x64px (default, configurable)
  - [ ] Color palette: deterministic from hash
  - [ ] SVG format for scalability
- [ ] Short ID:
  - [ ] Format: `edw:<first 8 hex chars of SHA-256(publicKey)>`
  - [ ] Example: `edw:a3f7b2c1`
- [ ] React components:
  - [ ] `IdentityBadge.tsx`: compact display (avatar + petname)
  - [ ] `IdentityCard.tsx`: full card (avatar + petname + shortId + pubkey)
  - [ ] `useIdentity` hook: load identity from Crypto Domain

**Verification Commands**:
```bash
# Run identity tests
npm run test identity/petname.test.ts
npm run test identity/identicon.test.ts

# Visual verification
npm run dev
# Open app, check TopBar shows: avatar + petname (e.g., "Swift Falcon")
# Open Settings → Identity
# Should show: full public key + petname + short ID + avatar
```

---

### ✅ Task 6: BRC-103 Request Signing

Implementation:
- [ ] Session management:
  - [ ] Nonce generation: 32 bytes cryptographic random
  - [ ] Nonce cache with TTL (default: 5 minutes)
  - [ ] Nonce uniqueness check (reject duplicates)
- [ ] `initialRequest` / `initialResponse` handshake:
  - [ ] Client sends: `{ publicKey, nonce }`
  - [ ] Server responds: `{ publicKey, nonce, clientNonceEcho, signature }`
  - [ ] Client verifies server's signature
- [ ] Request signing:
  - [ ] `X-BSV-Identity: <publicKey>` header (66 hex chars)
  - [ ] `X-BSV-Nonce: <sessionNonce>` header (64 hex chars)
  - [ ] `X-BSV-Signature: <signature>` header (DER-encoded, hex)
  - [ ] Signature over: `body + nonce`
- [ ] Replay protection:
  - [ ] Duplicate nonces rejected (403 Forbidden)
  - [ ] Timing anomaly detection: reject if timestamp >30s from server time

**Verification Commands**:
```bash
# Start mock gateway (Phase 3 stub endpoint for testing)
# Use curl to test BRC-103 handshake:

curl -X POST http://localhost:3117/v1/edwinpai/auth/initial \
  -H "Content-Type: application/json" \
  -d '{"publicKey":"02abc...", "nonce":"def..."}'

# Expected: 200 OK with signature response

# Test replay attack
curl -X POST http://localhost:3117/v1/chat/completions \
  -H "X-BSV-Identity: 02abc..." \
  -H "X-BSV-Nonce: def..." \
  -H "X-BSV-Signature: ghi..." \
  -d '{"message":"test"}'

# Re-run same request (same nonce)
# Expected: 403 Forbidden (nonce reused)
```

---

## Code Quality Checks

- [ ] **No ESLint errors**
  ```bash
  npm run lint
  # Expected: 0 errors, 0 warnings (or only known warnings)
  ```

- [ ] **No TypeScript errors**
  ```bash
  npm run typecheck
  # Expected: Found 0 errors
  ```

- [ ] **No Rust warnings**
  ```bash
  cd src-tauri && cargo build
  # Expected: warning: 0 warnings emitted
  ```

- [ ] **Vite build succeeds**
  ```bash
  npm run build
  # Expected: ✓ built in X ms
  ```

- [ ] **Tauri build succeeds**
  ```bash
  npm run tauri build
  # Expected: Finished 3 bundles
  ```

---

## Test Verification

- [ ] **TypeScript unit tests: 35/35 PASS**
  ```bash
  npm run test
  # Expected: Tests:  35 passed, 35 total
  ```

- [ ] **Rust unit tests: 45/45 PASS**
  ```bash
  cd src-tauri && cargo test
  # Expected: test result: ok. 45 passed; 0 failed
  ```

- [ ] **BRC-42 test vectors: 10/10 PASS** (critical)
  ```bash
  npm run test crypto/brc42.test.ts
  cargo test brc42
  # Expected: 10/10 PASS (no failures allowed)
  ```

- [ ] **Integration tests: 5/5 PASS** (manual)
  - [ ] IT-01: Keychain First Run (macOS + Windows + Linux)
  - [ ] IT-02: Keychain Retrieval (all platforms)
  - [ ] IT-03: Identity Display (all platforms)
  - [ ] IT-04: BRC-42 Handshake (all platforms)
  - [ ] IT-05: Audit Log Persistence (all platforms)

---

## Coverage Verification

- [ ] **Crypto Domain (Rust): >90% coverage**
  ```bash
  cd src-tauri && cargo tarpaulin --out Html
  # Check: coverage.html shows >90% for crypto_domain/*
  ```

- [ ] **lib/crypto (TS): >95% coverage**
  ```bash
  npm run test -- --coverage
  # Check: lib/crypto.ts, lib/identity.ts, lib/brc42.ts all >95%
  ```

---

## Security Audit

- [ ] **AI Domain isolation verified**
  - [ ] AI Domain cannot read keychain
  - [ ] AI Domain cannot access `~/.edwinpai/keys/` (if fallback used)
  - [ ] AI Domain can read audit log but not write
  - [ ] Crypto Domain paths excluded from AI sandbox

- [ ] **Memory zeroing verified**
  - [ ] Private keys zeroed on process exit (`Drop` trait)
  - [ ] No private keys in swap (mlock in Phase 6)

- [ ] **Audit log completeness**
  - [ ] Every `sign()` call logged
  - [ ] Every `verify()` call logged
  - [ ] Every `get_public_key()` call logged
  - [ ] Timestamps accurate (UTC)

- [ ] **Dependency security**
  ```bash
  cd src-tauri && cargo audit
  # Expected: 0 vulnerabilities found
  ```

---

## Platform Verification

Test on all 3 target platforms:

### macOS (arm64 + x86_64)

- [ ] Build succeeds
  ```bash
  npm run tauri build -- --target universal-apple-darwin
  ```
- [ ] Keychain integration works (manual test)
- [ ] Identity display correct (manual test)
- [ ] .dmg installer created

### Windows (x86_64)

- [ ] Build succeeds
  ```bash
  npm run tauri build
  ```
- [ ] Credential Manager integration works (manual test)
- [ ] Identity display correct (manual test)
- [ ] .msi installer created

### Linux (x86_64)

- [ ] Build succeeds
  ```bash
  npm run tauri build
  ```
- [ ] Secret Service integration works (GNOME Keyring)
- [ ] KDE/KWallet compatibility verified (manual test)
- [ ] Identity display correct (manual test)
- [ ] .deb and .AppImage created

---

## CI Verification

- [ ] **GitHub Actions: all workflows green**
  - [ ] Lint workflow: ✅ PASS
  - [ ] Typecheck workflow: ✅ PASS
  - [ ] Test workflow: ✅ PASS (all platforms)
  - [ ] Build workflow: ✅ PASS (all platforms)

- [ ] **No flaky tests**
  - [ ] Run CI 3 times consecutively
  - [ ] All 3 runs: green
  - [ ] No intermittent failures

---

## Documentation

- [ ] **PHASE1_DELIVERABLES.md reviewed and approved**
- [ ] **PHASE1_FILE_MANIFEST.txt updated with actual file counts**
- [ ] **PHASE1_DEPENDENCY_AUDIT.md reviewed (no CVEs)**
- [ ] **PHASE1_TEST_COVERAGE.md: all tests passing**
- [ ] **API documentation updated** (if public APIs changed)
- [ ] **Handoff notes for Phase 2 written** (see below)

---

## Handoff to Phase 2

Before starting Phase 2, verify:

- [ ] **Crypto Domain API surface ready**:
  - [ ] `sign(payload, protocolID, keyID, counterparty)` — works
  - [ ] `verify(payload, signature, publicKey)` — works
  - [ ] `derive_child_public_key(params)` — works (BRC-42)
  - [ ] `get_identity_public_key()` — works
  - [ ] `check_subscription(forceRefresh)` — stub present (impl in Phase 2)

- [ ] **Scaffolding for Phase 2 complete**:
  - [ ] `subscription.rs` module exists with stub functions
  - [ ] `CheckSubscriptionRequest` / `CheckSubscriptionResponse` types defined
  - [ ] BEEF proof types defined (parser in Phase 2)

- [ ] **Open questions resolved**:
  - [ ] Transaction construction location decided (Rust or TS?)
  - [ ] Overlay node URL strategy decided (hardcode OCI or config?)
  - [ ] Cached proof format decided (JSON or CBOR?)

- [ ] **Known limitations documented**:
  - [ ] Keychain on headless Linux (fallback strategy in Phase 6)
  - [ ] Memory zeroing (mlock in Phase 6)
  - [ ] Identicon collisions (petname collision detection in Phase 4)
  - [ ] BRC-42 invoice number format confirmed with OCI

---

## Final Approval

Phase 1 is **COMPLETE** and ready for Phase 2 when:

- [ ] All 6 PLAN.md tasks verified ✅
- [ ] All code quality checks pass ✅
- [ ] All tests pass (80 automated + 5 manual) ✅
- [ ] BRC-42 test vectors: 10/10 PASS ✅
- [ ] Coverage targets met (>90% crypto, >95% identity) ✅
- [ ] Security audit complete ✅
- [ ] Platform verification complete (macOS + Windows + Linux) ✅
- [ ] CI verification complete (3 consecutive green runs) ✅
- [ ] Documentation complete ✅
- [ ] Handoff to Phase 2 ready ✅

**Approvers**:
- [ ] Technical Lead: _________________ (Date: ______)
- [ ] Security Reviewer: _____________ (Date: ______)
- [ ] QA Lead: ______________________ (Date: ______)

**Phase 1 Completion Date**: ________________

---

**Next Phase**: Phase 2 — Subscription System (UTXO-based subscription + SPV verification)

*Checklist version: 1.0 (2026-02-09)*
