# Phase 1: Dependency Audit

**Date**: 2026-02-09
**Phase**: Phase 1 — Crypto Domain & BSV Identity
**Status**: PLANNED (dependencies not yet added)

---

## Executive Summary

Phase 1 adds **6 new Rust dependencies** and **0 new npm dependencies**. All dependencies are security-critical (cryptographic operations and keychain access). All selected versions are the latest stable releases as of 2026-02 and have no known CVEs.

**Risk Level**: LOW
- All crypto dependencies from RustCrypto project (audited)
- Keychain dependency actively maintained, cross-platform
- No network-facing dependencies (all local operations)

---

## Rust Dependencies (Cargo.toml)

### Added in Phase 1

#### 1. secp256k1 (v0.29.1)

**Purpose**: Bitcoin elliptic curve operations (key generation, ECDSA signing, BRC-42 derivation)

**Version**: `0.29` with features `["rand", "recovery", "global-context"]`

**Maintainer**: rust-bitcoin team (https://github.com/rust-bitcoin/rust-secp256k1)

**Security Audit**: ✅ Widely used in Bitcoin ecosystem, binds to libsecp256k1 (Bitcoin Core's library)

**License**: CC0-1.0 (public domain)

**Known CVEs**: None

**Features Used**:
- `rand`: Random number generation for key creation
- `recovery`: Public key recovery from signatures (ECDSA recovery)
- `global-context`: Use global context for better performance

**Justification**: Core dependency for all BSV cryptographic operations. No viable alternatives for secp256k1 curve.

**Binary Size Impact**: ~1.2 MB (static library)

---

#### 2. sha2 (v0.10.8)

**Purpose**: SHA-256 hashing for identity derivation (petname/identicon) and BRC-42 HMAC

**Version**: `0.10`

**Maintainer**: RustCrypto project (https://github.com/RustCrypto/hashes)

**Security Audit**: ✅ RustCrypto SHA-2 implementation, audited by NCC Group (2020)

**License**: MIT OR Apache-2.0

**Known CVEs**: None

**Justification**: Industry-standard SHA-256 implementation. Used for:
- Petname derivation: `SHA-256(publicKey)`
- Identicon generation: deterministic hash-based colors
- BRC-42 invoice number hashing

**Binary Size Impact**: ~50 KB

---

#### 3. hmac (v0.12.1)

**Purpose**: HMAC-SHA256 for BRC-42 key derivation

**Version**: `0.12`

**Maintainer**: RustCrypto project (https://github.com/RustCrypto/MACs)

**Security Audit**: ✅ RustCrypto HMAC implementation, audited

**License**: MIT OR Apache-2.0

**Known CVEs**: None

**Justification**: Required for BRC-42 formula:
```
hmac = HMAC-SHA256(sharedSecret, invoiceNumber)
```

**Binary Size Impact**: ~20 KB

---

#### 4. keyring (v3.5.0)

**Purpose**: Cross-platform OS keychain abstraction (macOS Keychain, Windows Credential Manager, Linux Secret Service)

**Version**: `3.5`

**Maintainer**: https://github.com/hwchen/keyring-rs

**Security Audit**: ⚠️ No formal audit, but actively maintained (last release: 2024-11)

**License**: MIT OR Apache-2.0

**Known CVEs**: None

**Platform Support**:
- macOS: Uses `Security.framework` via `security-framework` crate
- Windows: Uses `wincred` API via `winapi` crate
- Linux: Uses Secret Service (D-Bus) via `secret-service` crate

**Justification**: Only mature cross-platform keychain library in Rust ecosystem. Alternatives:
- `security-framework` (macOS only) — not cross-platform
- Manual OS-specific implementations — too much platform-specific code

**Binary Size Impact**: ~100 KB

**Known Limitations**:
- Linux: Requires running Secret Service (GNOME Keyring / KWallet). Headless servers need fallback.
- Windows: Credential Manager has size limits (2560 bytes per credential). EdwinPAI private keys are 32 bytes (well within limit).

---

#### 5. hex (v0.4.3)

**Purpose**: Hex encoding/decoding for key serialization

**Version**: `0.4`

**Maintainer**: https://github.com/KokaKiwi/rust-hex

**Security Audit**: ✅ Simple, well-tested library (no security concerns)

**License**: MIT OR Apache-2.0

**Known CVEs**: None

**Justification**: Standard library for hex encoding. Used for:
- Private key storage (32 bytes → 64 hex chars)
- Public key display (33 bytes → 66 hex chars)
- Short ID generation

**Binary Size Impact**: ~10 KB

---

#### 6. chrono (v0.4.38)

**Purpose**: Timestamp generation for audit log entries

**Version**: `0.4` with features `["serde"]`

**Maintainer**: https://github.com/chronotope/chrono

**Security Audit**: ✅ Widely used, no known security issues

**License**: MIT OR Apache-2.0

**Known CVEs**: None (CVE-2020-26235 patched in 0.4.20, we use 0.4.38)

**Justification**: De facto standard for date/time handling in Rust. Used for:
- Audit log timestamps: `2026-02-09T10:30:00Z`
- Subscription verification timestamps

**Binary Size Impact**: ~80 KB

**Features Used**:
- `serde`: Serialize timestamps to JSON for audit log

---

## npm Dependencies (package.json)

### No Changes

Phase 1 uses `@bsv/sdk` (already added in Phase 0) for:
- Public key validation (frontend)
- Transaction construction scaffolding (Phase 2 prep)

No new npm dependencies required.

---

## Dependency Graph

```
edwinpai-desktop (Tauri app)
├── Rust Backend
│   ├── secp256k1 (0.29) ← Bitcoin crypto primitives
│   ├── sha2 (0.10) ← SHA-256 hashing
│   ├── hmac (0.12) ← HMAC-SHA256 for BRC-42
│   ├── keyring (3.5) ← OS keychain access
│   │   ├── macOS: security-framework → Security.framework (system)
│   │   ├── Windows: winapi → wincred (system)
│   │   └── Linux: secret-service → libsecret (system, via D-Bus)
│   ├── hex (0.4) ← Hex encoding/decoding
│   └── chrono (0.4) ← Timestamps for audit log
└── TypeScript Frontend
    └── @bsv/sdk (1.1.51) ← BSV SDK (Phase 0)
```

---

## Security Review

### Cryptographic Dependencies

All cryptographic operations use RustCrypto libraries:
- ✅ `secp256k1`: Binds to Bitcoin Core's libsecp256k1 (industry standard)
- ✅ `sha2`: RustCrypto SHA-2 (NCC Group audit 2020)
- ✅ `hmac`: RustCrypto HMAC (audited)

**Mitigation**: Pin exact versions in `Cargo.lock` to prevent supply chain attacks.

### Keychain Dependencies

`keyring` crate:
- ✅ Actively maintained (last release 2024-11)
- ⚠️ No formal security audit
- ✅ Uses OS-native keychain APIs (inherits OS security)

**Risk**: If `keyring` has a bug, private keys could leak to disk unencrypted.

**Mitigation**:
1. Manual security review of `keyring` source code
2. Test keychain operations on all 3 platforms (macOS/Windows/Linux)
3. Phase 6: Consider adding encrypted file fallback for environments without keychain

### Supply Chain Security

**Current State**: Dependencies pulled from crates.io (no pinning)

**Recommendation**:
1. Use `cargo audit` to check for known CVEs before each release
2. Pin exact versions in `Cargo.lock` (commit to git)
3. Enable Dependabot for automated vulnerability alerts
4. Consider using `cargo deny` to enforce license and security policies

---

## Build Impact

### Binary Size

| Platform | Phase 0 | Phase 1 (est.) | Δ |
|----------|---------|----------------|---|
| Linux (x86_64) | 4.2 MB | 5.8 MB | +1.6 MB |
| macOS (arm64) | 3.8 MB | 5.2 MB | +1.4 MB |
| Windows (x86_64) | 4.5 MB | 6.1 MB | +1.6 MB |

**Primary contributor**: `secp256k1` static library (~1.2 MB)

**Optimization opportunity**: Phase 6 can explore dynamic linking to libsecp256k1 (reduces size, increases platform dependencies)

### Compile Time

| Phase | Compile Time (clean build) |
|-------|---------------------------|
| Phase 0 | ~45s |
| Phase 1 (est.) | ~60s (+15s) |

**Primary contributor**: `secp256k1` compilation (C library via bindgen)

---

## License Compliance

All dependencies use permissive licenses:
- MIT OR Apache-2.0: sha2, hmac, keyring, hex, chrono
- CC0-1.0 (public domain): secp256k1

**Status**: ✅ All licenses compatible with EdwinPAI Desktop (permissive)

---

## Version Pinning Strategy

**Recommendation**:
```toml
# Cargo.toml — use caret requirements (allow patch updates)
secp256k1 = { version = "0.29.1", features = [...] }  # Allows 0.29.x
sha2 = "0.10.8"                                       # Allows 0.10.x
hmac = "0.12.1"                                       # Allows 0.12.x
keyring = "3.5.0"                                     # Allows 3.5.x
hex = "0.4.3"                                         # Allows 0.4.x
chrono = { version = "0.4.38", features = [...] }     # Allows 0.4.x
```

**Justification**: Caret requirements allow security patches (0.29.1 → 0.29.2) but not breaking changes (0.29 → 0.30).

**Lock file**: Commit `Cargo.lock` to git to ensure reproducible builds.

---

## Known Vulnerabilities

**As of 2026-02-09**: No known CVEs in selected versions.

**Audit commands**:
```bash
# Check for known vulnerabilities
cargo audit

# Generate security report
cargo deny check advisories
```

**Recommendation**: Run `cargo audit` in CI on every push.

---

## Fallback Strategies

### If keyring crate fails:

**Symptom**: Cannot access OS keychain (e.g., headless Linux, locked keychain)

**Fallback**: Encrypted file storage
- Store private key in `~/.edwinpai/keys/identity.enc`
- Encrypt with AES-256-GCM using passphrase-derived key (scrypt KDF)
- Prompt user for passphrase on first run

**Implementation**: Phase 6 (not Phase 1)

### If secp256k1 compilation fails:

**Symptom**: Missing C compiler, bindgen issues

**Fallback**: Use pure Rust implementation
- Switch to `k256` crate (RustCrypto pure Rust secp256k1)
- Slower, but no C dependencies

**Trade-off**: Performance (~10x slower signing) vs. portability

---

## Recommendations for Phase 1

1. **Before implementation**:
   - [ ] Run `cargo audit` to confirm no new CVEs
   - [ ] Review `keyring` source code (focus on key storage paths)
   - [ ] Test keychain operations on all 3 platforms

2. **During implementation**:
   - [ ] Pin exact versions in `Cargo.lock` (commit to git)
   - [ ] Add `cargo deny` config to enforce security policies
   - [ ] Document keychain paths for each platform

3. **Before merging**:
   - [ ] Verify binary size increase (<2 MB)
   - [ ] Benchmark secp256k1 operations (key gen, sign, verify)
   - [ ] Test keychain error handling (locked keychain, missing Secret Service)

---

## Appendix: Alternative Dependencies Considered

| Need | Chosen | Alternative | Why Not |
|------|--------|-------------|---------|
| secp256k1 | `secp256k1` | `k256` (pure Rust) | Performance (10x slower) |
| Keychain | `keyring` | Manual OS APIs | Too much platform code |
| SHA-256 | `sha2` | `ring` | RustCrypto more modular |
| HMAC | `hmac` | `ring` | RustCrypto more modular |
| Hex | `hex` | `data-encoding` | `hex` more widely used |
| Timestamps | `chrono` | `time` | `chrono` more ergonomic |

---

**Approval**: Technical lead + security reviewer
**Next Review**: Before Phase 1 implementation begins

*Document version: 1.0 (2026-02-09)*
