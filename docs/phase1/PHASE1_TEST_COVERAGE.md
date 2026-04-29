# Phase 1: Test Coverage Report

**Date**: 2026-02-09
**Phase**: Phase 1 — Crypto Domain & BSV Identity
**Status**: PLANNED (tests not yet written)

---

## Executive Summary

Phase 1 test plan covers **80 automated tests** across Rust and TypeScript:
- **35 TypeScript unit tests** (frontend crypto/identity libraries)
- **45 Rust unit tests** (Crypto Domain backend)
- **5 manual integration tests** (cross-platform keychain, UI display)

**Target Coverage**: 90%+ for all crypto-critical modules

**Critical Test**: BRC-42 test vectors must achieve 100% pass rate (10/10 official test cases)

---

## Test Matrix

### TypeScript Unit Tests (35 tests)

#### Suite 1: BRC-42 Key Derivation (`test/crypto/brc42.test.ts`)

**Purpose**: Validate BRC-42 key derivation against official test vectors

**Test Count**: 10

| Test | Description | Assertion |
|------|-------------|-----------|
| `brc42-vector-01` | Test vector 1: basic derivation | Derived pubkey matches expected |
| `brc42-vector-02` | Test vector 2: invoice number variation | Derived pubkey matches expected |
| `brc42-vector-03` | Test vector 3: counterparty variation | Derived pubkey matches expected |
| `brc42-vector-04` | Test vector 4: edge case (high scalar) | Derived pubkey matches expected |
| `brc42-vector-05` | Test vector 5: edge case (low scalar) | Derived pubkey matches expected |
| `brc42-vector-06` | Test vector 6: protocolID variation | Derived pubkey matches expected |
| `brc42-vector-07` | Test vector 7: keyID variation | Derived pubkey matches expected |
| `brc42-vector-08` | Test vector 8: both parties derive same shared secret | ECDH symmetry verified |
| `brc42-vector-09` | Test vector 9: child private key derivation | Child privkey can sign for child pubkey |
| `brc42-vector-10` | Test vector 10: invalid invoice number | Throws expected error |

**Coverage Target**: 100% (test vector validation is non-negotiable)

**Data Source**: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md#test-vectors

**Example Test**:
```typescript
describe('BRC-42 Key Derivation', () => {
  it('brc42-vector-01: basic derivation', async () => {
    const senderPrivKey = '0x...' // From test vector
    const recipientPubKey = '0x...' // From test vector
    const invoiceNumber = '2-edwinpai-subscription'
    const expectedChildPubKey = '0x...' // From test vector

    const derived = await deriveBrc42ChildPublicKey({
      senderPrivateKey: senderPrivKey,
      recipientPublicKey: recipientPubKey,
      protocolID: 'edwinpai',
      keyID: 'subscription',
      securityLevel: 2
    })

    expect(derived.publicKey).toBe(expectedChildPubKey)
  })
})
```

---

#### Suite 2: Signing & Verification (`test/crypto/signing.test.ts`)

**Purpose**: Test ECDSA signing and signature verification

**Test Count**: 8

| Test | Description | Assertion |
|------|-------------|-----------|
| `sign-message` | Sign arbitrary payload | Signature produced |
| `verify-valid-signature` | Verify correct signature | Returns true |
| `verify-invalid-signature` | Verify wrong signature | Returns false |
| `verify-wrong-pubkey` | Verify with wrong public key | Returns false |
| `sign-empty-payload` | Sign empty message | Throws error |
| `sign-large-payload` | Sign 1MB payload | Signature produced |
| `deterministic-signing` | Same message → same signature | Signature consistent |
| `signature-format` | Check DER encoding | Valid ASN.1 format |

**Coverage Target**: 100% of signing.ts

**Example Test**:
```typescript
describe('ECDSA Signing', () => {
  it('sign-message: signs arbitrary payload', async () => {
    const privateKey = generateTestPrivateKey()
    const payload = new TextEncoder().encode('Hello EdwinPAI')

    const signature = await sign({ payload, privateKey })

    expect(signature).toBeDefined()
    expect(signature.length).toBeGreaterThan(64) // DER encoding overhead
  })

  it('verify-valid-signature: verifies correct signature', async () => {
    const { publicKey, privateKey } = generateTestKeypair()
    const payload = new TextEncoder().encode('Hello EdwinPAI')
    const signature = await sign({ payload, privateKey })

    const isValid = await verify({ payload, signature, publicKey })

    expect(isValid).toBe(true)
  })
})
```

---

#### Suite 3: Petname Generation (`test/identity/petname.test.ts`)

**Purpose**: Validate deterministic petname generation from public keys

**Test Count**: 6

| Test | Description | Assertion |
|------|-------------|-----------|
| `petname-deterministic` | Same pubkey → same petname | Consistent output |
| `petname-different-pubkeys` | Different pubkeys → different petnames | Unique output |
| `petname-format` | Check "Adjective Noun" format | Matches regex |
| `petname-valid-words` | Both words in wordlists | In ADJECTIVES/NOUNS |
| `petname-collision-rate` | Generate 1000 petnames | <10% collisions |
| `petname-word-distribution` | Generate 1000 petnames | Uniform distribution |

**Coverage Target**: 100% of identity.ts (petname functions)

**Example Test**:
```typescript
describe('Petname Generation', () => {
  it('petname-deterministic: same pubkey produces same petname', async () => {
    const pubkey = '02abc123...'

    const petname1 = await generatePetname(pubkey)
    const petname2 = await generatePetname(pubkey)

    expect(petname1.display).toBe(petname2.display)
    expect(petname1.adjective).toBe('Swift')
    expect(petname1.noun).toBe('Falcon')
  })

  it('petname-collision-rate: low collision rate', async () => {
    const pubkeys = Array.from({ length: 1000 }, (_, i) =>
      generateTestPublicKey(i)
    )

    const petnames = await Promise.all(
      pubkeys.map(pk => generatePetname(pk))
    )

    const uniquePetnames = new Set(petnames.map(p => p.display))
    const collisionRate = 1 - (uniquePetnames.size / petnames.length)

    expect(collisionRate).toBeLessThan(0.1) // <10% collisions
  })
})
```

---

#### Suite 4: Identicon Generation (`test/identity/identicon.test.ts`)

**Purpose**: Validate deterministic SVG identicon generation

**Test Count**: 5

| Test | Description | Assertion |
|------|-------------|-----------|
| `identicon-deterministic` | Same pubkey → same SVG | Consistent output |
| `identicon-valid-svg` | Check SVG format | Valid XML |
| `identicon-size` | Configurable size (32/64/128px) | Correct dimensions |
| `identicon-color-determinism` | Same pubkey → same colors | Consistent palette |
| `identicon-visual-uniqueness` | Different pubkeys → visually distinct | Hamming distance >50% |

**Coverage Target**: 100% of identicon-generator.ts

**Example Test**:
```typescript
describe('Identicon Generation', () => {
  it('identicon-deterministic: same pubkey produces same SVG', async () => {
    const pubkey = '02abc123...'

    const icon1 = await generateIdenticon(pubkey, { size: 64 })
    const icon2 = await generateIdenticon(pubkey, { size: 64 })

    expect(icon1.svg).toBe(icon2.svg)
  })

  it('identicon-valid-svg: generates valid SVG', async () => {
    const pubkey = '02abc123...'

    const icon = await generateIdenticon(pubkey, { size: 64 })

    expect(icon.svg).toMatch(/^<svg.*<\/svg>$/)
    expect(icon.svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })
})
```

---

#### Suite 5: Audit Log (`test/audit/audit-log.test.ts`)

**Purpose**: Validate audit log writing and reading

**Test Count**: 6

| Test | Description | Assertion |
|------|-------------|-----------|
| `audit-log-write` | Write entry to log | File created |
| `audit-log-append` | Write multiple entries | All present |
| `audit-log-format` | Check JSON Lines format | Valid JSONL |
| `audit-log-read` | Read entries back | Matches written data |
| `audit-log-immutable` | Cannot modify existing entries | Append-only verified |
| `audit-log-rotation` | Log rotation at 10MB | Old log archived |

**Coverage Target**: 90% of audit.ts

**Example Test**:
```typescript
describe('Audit Log', () => {
  it('audit-log-write: writes entry to log', async () => {
    const entry = {
      timestamp: new Date().toISOString(),
      operation: 'sign',
      protocolID: 'edwinpai',
      keyID: 'subscription',
      payloadHash: 'abc123...',
      success: true
    }

    await writeAuditLog(entry)

    const logPath = getAuditLogPath()
    const logExists = await fs.promises.access(logPath).then(() => true).catch(() => false)
    expect(logExists).toBe(true)
  })
})
```

---

### Rust Unit Tests (45 tests)

Rust tests are embedded in each module using `#[cfg(test)]` blocks.

#### Module: `brc42.rs` (12 tests)

**Purpose**: BRC-42 key derivation primitives

| Test | Description |
|------|-------------|
| `test_ecdh_shared_secret` | Compute ECDH shared secret |
| `test_ecdh_symmetry` | Both parties compute same secret |
| `test_hmac_derivation` | HMAC-SHA256(secret, invoice) |
| `test_scalar_addition` | Scalar math (mod N) |
| `test_point_addition` | Point addition on curve |
| `test_child_pubkey_derivation` | Derive child public key |
| `test_child_privkey_derivation` | Derive child private key |
| `test_brc42_vector_01` | Test vector 1 |
| `test_brc42_vector_02` | Test vector 2 |
| `test_brc42_vector_03` | Test vector 3 |
| `test_invoice_number_format` | Parse "2-edwinpai-subscription" |
| `test_invalid_invoice_number` | Reject malformed invoice |

**Coverage Target**: 100%

**Example Test**:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ecdh_shared_secret() {
        let secp = Secp256k1::new();
        let (sender_sk, sender_pk) = secp.generate_keypair(&mut rand::thread_rng());
        let (recip_sk, recip_pk) = secp.generate_keypair(&mut rand::thread_rng());

        let secret1 = compute_shared_secret(&sender_sk, &recip_pk);
        let secret2 = compute_shared_secret(&recip_sk, &sender_pk);

        assert_eq!(secret1, secret2, "ECDH shared secret must be symmetric");
    }
}
```

---

#### Module: `signing.rs` (8 tests)

**Purpose**: ECDSA signing/verification primitives

| Test | Description |
|------|-------------|
| `test_sign_message` | Sign arbitrary payload |
| `test_verify_valid_signature` | Verify correct signature |
| `test_verify_invalid_signature` | Reject wrong signature |
| `test_verify_wrong_pubkey` | Reject wrong public key |
| `test_sign_empty_payload` | Handle empty message |
| `test_sign_large_payload` | Handle 1MB message |
| `test_signature_der_encoding` | Check DER format |
| `test_signature_recovery` | Recover pubkey from signature |

**Coverage Target**: 100%

---

#### Module: `identity.rs` (6 tests)

**Purpose**: Petname and identicon generation

| Test | Description |
|------|-------------|
| `test_petname_deterministic` | Same pubkey → same petname |
| `test_petname_format` | Check "Adjective Noun" |
| `test_petname_wordlist_bounds` | Indices in range [0, 255] |
| `test_identicon_deterministic` | Same pubkey → same icon |
| `test_identicon_svg_format` | Valid SVG output |
| `test_shortid_format` | Check "edw:XXXXXXXX" |

**Coverage Target**: 100%

---

#### Module: `keychain.rs` (5 tests)

**Purpose**: OS keychain integration

| Test | Description |
|------|-------------|
| `test_keychain_write` | Store private key |
| `test_keychain_read` | Retrieve private key |
| `test_keychain_overwrite` | Update existing key |
| `test_keychain_delete` | Remove key |
| `test_keychain_not_found` | Handle missing key |

**Coverage Target**: 85% (platform-dependent, some paths untestable in CI)

**Note**: Requires running keychain service (macOS Keychain, Windows Credential Manager, Linux Secret Service). CI may mock this.

---

#### Module: `audit.rs` (4 tests)

**Purpose**: Audit log writer

| Test | Description |
|------|-------------|
| `test_audit_log_create` | Create log file |
| `test_audit_log_append` | Append multiple entries |
| `test_audit_log_read` | Read entries back |
| `test_audit_log_rotation` | Rotate at size limit |

**Coverage Target**: 90%

---

#### Module: `domain.rs` (10 tests)

**Purpose**: EdwinPAICryptoDomain integration tests

| Test | Description |
|------|-------------|
| `test_domain_init` | Initialize Crypto Domain |
| `test_domain_sign_request` | Handle SignRequest IPC |
| `test_domain_verify_request` | Handle VerifyRequest IPC |
| `test_domain_get_pubkey` | Handle GetPublicKeyRequest |
| `test_domain_audit_logging` | All ops logged |
| `test_domain_keychain_integration` | Load key from keychain |
| `test_domain_brc42_integration` | Derive keys end-to-end |
| `test_domain_error_handling` | Invalid requests rejected |
| `test_domain_concurrent_requests` | Thread-safe operations |
| `test_domain_memory_cleanup` | Zeroize on drop |

**Coverage Target**: 80%

---

### Integration Tests (5 manual tests)

**Purpose**: Cross-platform and UI validation (not automated in CI)

| Test | Description | Platforms | Pass Criteria |
|------|-------------|-----------|---------------|
| **IT-01: Keychain First Run** | Generate key on first run | macOS, Windows, Linux | Key stored in OS keychain |
| **IT-02: Keychain Retrieval** | Load existing key on second run | macOS, Windows, Linux | Same pubkey displayed |
| **IT-03: Identity Display** | Show petname + avatar in UI | All platforms | Matches keychain pubkey |
| **IT-04: BRC-42 Handshake** | Derive shared key with mock OCI | All platforms | Derivation succeeds |
| **IT-05: Audit Log Persistence** | Restart app, check audit log | All platforms | Logs persist |

**Execution**: Manual testing by QA team, documented in `docs/PHASE1_TEST_PLAN.md`

---

## Coverage Targets by Module

| Module | Language | Target Coverage | Critical? |
|--------|----------|-----------------|-----------|
| `crypto_domain/brc42.rs` | Rust | 100% | ✅ YES (security) |
| `crypto_domain/signing.rs` | Rust | 100% | ✅ YES (security) |
| `crypto_domain/identity.rs` | Rust | 100% | ✅ YES (UX critical) |
| `crypto_domain/keychain.rs` | Rust | 85% | ✅ YES (security) |
| `crypto_domain/audit.rs` | Rust | 90% | ⚠️ Important |
| `crypto_domain/domain.rs` | Rust | 80% | ⚠️ Important |
| `lib/crypto.ts` | TypeScript | 95% | ✅ YES (security) |
| `lib/identity.ts` | TypeScript | 95% | ✅ YES (UX critical) |
| `lib/brc42.ts` | TypeScript | 95% | ✅ YES (security) |
| `lib/petname-wordlists.ts` | TypeScript | 100% | ⚠️ Important |
| `lib/identicon-generator.ts` | TypeScript | 95% | ⚠️ Important |

**Overall Target**: 90%+ for security-critical modules

---

## BRC-42 Test Vector Compliance

**Critical Success Metric**: 10/10 official BRC-42 test vectors must pass.

**Test Vector Source**: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md#test-vectors

**Execution**:
```bash
npm run test crypto/brc42.test.ts
cargo test brc42
```

**Expected Output**:
```
✓ brc42-vector-01: basic derivation (12ms)
✓ brc42-vector-02: invoice number variation (8ms)
✓ brc42-vector-03: counterparty variation (10ms)
✓ brc42-vector-04: edge case (high scalar) (9ms)
✓ brc42-vector-05: edge case (low scalar) (11ms)
✓ brc42-vector-06: protocolID variation (7ms)
✓ brc42-vector-07: keyID variation (9ms)
✓ brc42-vector-08: ECDH symmetry (13ms)
✓ brc42-vector-09: child privkey derivation (15ms)
✓ brc42-vector-10: invalid invoice number (5ms)

Tests:  10 passed, 10 total
```

**Failure Threshold**: 0 (any failure blocks Phase 1 completion)

---

## Test Execution

### TypeScript Tests

```bash
# Run all tests
npm run test

# Run specific suite
npm run test crypto/brc42.test.ts

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test -- --coverage
```

**Framework**: vitest
**Expected Runtime**: <5 seconds (all 35 tests)

---

### Rust Tests

```bash
# Run all tests
cd src-tauri && cargo test

# Run specific module tests
cargo test brc42

# Run with output
cargo test -- --nocapture

# Coverage report (requires tarpaulin)
cargo tarpaulin --out Html
```

**Expected Runtime**: <10 seconds (all 45 tests)

---

### Integration Tests (Manual)

**Execution Plan**:

1. **IT-01: Keychain First Run**
   - Delete `~/.edwinpai/` directory
   - Launch app
   - Check: Key generated and stored in OS keychain
   - Platform: Test on macOS, Windows, Linux

2. **IT-02: Keychain Retrieval**
   - Restart app (keychain key exists)
   - Check: Same public key loaded
   - Check: Identity display matches first run

3. **IT-03: Identity Display**
   - Open Settings → Identity
   - Check: Petname, avatar, short ID displayed
   - Check: Public key matches keychain

4. **IT-04: BRC-42 Handshake**
   - Mock OCI public key
   - Trigger subscription key derivation
   - Check: Derived key matches expected (use test vector)

5. **IT-05: Audit Log Persistence**
   - Perform crypto operations (sign, verify)
   - Restart app
   - Check: `~/.edwinpai/audit/crypto.jsonl` contains entries

**Documentation**: `docs/PHASE1_TEST_PLAN.md` (to be created)

---

## CI Integration

**GitHub Actions Workflow** (`.github/workflows/test.yml`):

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test-ts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test
      - run: npm run test -- --coverage
      - uses: codecov/codecov-action@v4

  test-rust:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd src-tauri && cargo test
      - run: cd src-tauri && cargo audit
```

**Coverage Reporting**: Upload to Codecov or Coveralls

---

## Phase 1 Completion Criteria (Testing)

Phase 1 testing is **COMPLETE** when:

1. ✅ All 35 TypeScript unit tests passing
2. ✅ All 45 Rust unit tests passing
3. ✅ BRC-42 test vectors: 10/10 PASS
4. ✅ Coverage: >90% for crypto_domain, >95% for lib/crypto
5. ✅ All 5 integration tests verified manually (macOS + Windows + Linux)
6. ✅ CI tests passing on all 3 platforms
7. ✅ No test flakiness (3 consecutive CI runs, all green)

**Review**: QA lead + technical lead
**Estimated Test Writing Time**: 1 week (alongside implementation)

---

*Document version: 1.0 (2026-02-09)*
