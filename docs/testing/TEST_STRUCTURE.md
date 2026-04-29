# Test File Structure

## Overview

This document maps all test files to their corresponding source modules, documents test infrastructure, and defines the canonical test execution order for EdwinPAI Desktop.

**Last Updated:** 2026-02-09
**Phase:** Phase 1 (Crypto Core) Complete

---

## Test Infrastructure

### Rust Test Infrastructure

**Location:** `src-tauri/`

**Configuration:**
- `Cargo.toml` — Test dependencies configured in `[dev-dependencies]` (currently none needed; using std testing only)
- Rust built-in test framework (`#[test]`, `#[cfg(test)]`)
- Integration tests in `tests/` directory
- Unit tests inline with source in `#[cfg(test)]` modules

**Test Execution Commands:**
```bash
cd src-tauri
cargo test              # Run all tests (unit + integration)
cargo test --lib        # Run unit tests only
cargo test --test '*'   # Run integration tests only
cargo test -- --nocapture  # Show println! output
```

### TypeScript Test Infrastructure

**Location:** `src/`

**Configuration:**
- `vitest.config.ts` — Vitest configuration with jsdom environment
- `src/test/setup.ts` — Global test setup (imports @testing-library/jest-dom)
- Path aliases configured for `@/components`, `@/lib`, `@/hooks`, `@/stores`, `@/types`

**Key Settings:**
```typescript
{
  environment: "jsdom",          // Browser-like environment for React
  globals: true,                 // Enable global test APIs
  setupFiles: ["./src/test/setup.ts"]
}
```

**Test Execution Commands:**
```bash
npm test              # Run all tests once (CI mode)
npm run test:watch    # Run tests in watch mode
```

**Dependencies:**
- `vitest` ^4.0.18 — Test runner
- `@testing-library/react` ^16.3.2 — React component testing
- `@testing-library/jest-dom` ^6.9.1 — DOM matchers
- `jsdom` ^28.0.0 — DOM implementation

---

## Rust Test Files

### Unit Tests (Inline with Source)

All Rust source modules contain inline `#[cfg(test)]` modules at the end of each file:

| Source Module | Location | Test Count | Line Number | Test Coverage |
|---------------|----------|------------|-------------|---------------|
| `keypair.rs` | `src-tauri/src/crypto_domain/keypair.rs` | 8 | Line 71+ | Key generation, derivation, serialization |
| `brc42.rs` | `src-tauri/src/crypto_domain/brc42.rs` | 13 | Line 157+ | BRC-42 derivation, invoice numbers, protocol IDs |
| `signing.rs` | `src-tauri/src/crypto_domain/signing.rs` | 12 | Line 88+ | ECDSA sign/verify, message hashing, edge cases |
| `keychain.rs` | `src-tauri/src/crypto_domain/keychain.rs` | 1 | Line 65+ | OS keychain save/load (basic smoke test) |
| `audit.rs` | `src-tauri/src/crypto_domain/audit.rs` | 1 | Line 142+ | Audit log creation (basic smoke test) |
| `identity.rs` | `src-tauri/src/crypto_domain/identity.rs` | 3 | Line 150+ | Petname generation, identicon SVG generation |
| `domain.rs` | `src-tauri/src/crypto_domain/domain.rs` | 2 | Line 230+ | EdwinPAICryptoDomain initialization, basic ops |
| `ipc_types.rs` | `src-tauri/src/crypto_domain/ipc_types.rs` | 4 | Line 418+ | IPC message serialization/deserialization |

**Total Unit Tests:** 44

**Modules WITHOUT Tests:**
- `types.rs` — Pure type definitions (no logic to test)
- `traits.rs` — Pure trait definitions (tested via implementations)
- `mod.rs` — Re-exports only (no logic)
- `subscription.rs` — Phase 2 stub (not implemented yet)

### Integration Tests

| Test File | Tests | Purpose | Critical? |
|-----------|-------|---------|-----------|
| `tests/brc42_test_vectors.rs` | 11 | **Official BRC-42 test vectors** — validates all 10 test cases from BRC-42 spec | ✅ **YES** (100% PASS required) |

**Total Integration Tests:** 11

**Test Vector Sources:**
- BRC-42 Specification: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md
- Test vectors 1-10 cover: standard derivation, invoice numbers, protocol IDs, security level variations, counterparty variations

**Critical Requirement:** All 10 BRC-42 test vectors MUST pass before Phase 1 can be considered complete. These validate cryptographic correctness against the official BSV standard.

---

## TypeScript Test Files

### Component Tests

**Location:** `src/test/`

**Note:** Tests use `.test.ts` suffix (not `__tests__/` directory pattern)

| Test File | Source Module | Purpose | Status |
|-----------|---------------|---------|--------|
| `src/test/App.test.tsx` | `src/App.tsx` | Main application component smoke test | ✅ Exists (1 test) |
| `src/test/crypto/signing.test.ts` | Frontend IPC → `signing.rs` | Sign/verify operations via Tauri IPC | 🚧 Stub |
| `src/test/crypto/brc42.test.ts` | Frontend IPC → `brc42.rs` | Key derivation via Tauri IPC | 🚧 Stub |
| `src/test/identity/identicon.test.ts` | Frontend IPC → `identity.rs` | Identicon generation via Tauri IPC | 🚧 Stub |
| `src/test/identity/petname.test.ts` | Frontend IPC → `identity.rs` | Petname generation via Tauri IPC | 🚧 Stub |
| `src/test/audit/audit-log.test.ts` | Frontend IPC → `audit.rs` | Audit log operations via Tauri IPC | 🚧 Stub |

**Total TypeScript Tests:** 6 files (1 implemented, 5 stubs)

**Future Component Tests** (to be added in later phases):
- `src/components/__tests__/` — Component-specific tests when UI components are built
- Hook tests in `src/hooks/__tests__/`
- Store tests in `src/stores/__tests__/`

---

## Test Execution Order

This is the canonical execution order for all tests, matching CI pipeline flow.

### Local Development Order

```bash
# 1. Rust Unit Tests (fastest, catch Rust logic errors)
cd src-tauri
cargo test --lib

# 2. Rust Integration Tests (BRC-42 test vectors - CRITICAL)
cargo test --test brc42_test_vectors

# 3. TypeScript Type Check (catch type errors before running tests)
cd ..
npm run typecheck

# 4. TypeScript Lint (code quality)
npm run lint

# 5. TypeScript Tests (component/integration tests)
npm test

# 6. Frontend Build (ensure production build works)
npm run build

# 7. Full Tauri Build (integration of frontend + backend)
npm run tauri build
```

### CI Pipeline Order

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) executes in this order:

**Job 1: `lint-and-typecheck` (ubuntu-latest)**
1. `npm run lint` — ESLint check
2. `npm run format:check` — Prettier format check
3. `npm run typecheck` — TypeScript type check
4. `npm test` — Vitest tests

**Job 2: `build` (matrix: ubuntu-22.04, macos-latest, windows-latest)**
1. Install Rust stable
2. Install platform dependencies (Linux only)
3. `npm ci` — Install dependencies
4. `tauri build` — Full Tauri build (includes `cargo test` implicitly)

**Dependency Flow:**
```
lint-and-typecheck (runs first)
       ↓
     build (runs after lint passes)
```

### Quick Test Commands

**Rust only (backend):**
```bash
cd src-tauri && cargo test
```

**TypeScript only (frontend):**
```bash
npm test
```

**All tests (recommended):**
```bash
cd src-tauri && cargo test && cd .. && npm test
```

**BRC-42 vectors only (critical validation):**
```bash
cd src-tauri && cargo test --test brc42_test_vectors -- --nocapture
```

---

## Test Coverage Summary

### Phase 1 Test Coverage

| Layer | Files | Tests | Coverage |
|-------|-------|-------|----------|
| **Rust Backend** | 8 modules + 1 integration | 55 tests | Core crypto logic fully tested |
| **TypeScript Frontend** | 6 test files | 1 implemented, 5 stubs | Awaiting frontend implementation |

### Critical Test Requirements

**Non-Negotiable (MUST PASS):**
- ✅ All 10 BRC-42 official test vectors (in `brc42_test_vectors.rs`)
- ✅ ECDSA signing determinism tests (RFC 6979 compliance)
- ✅ TypeScript type checking (`npm run typecheck`)
- ✅ ESLint rules (`npm run lint`)

**High Priority:**
- Keypair generation tests (secp256k1 correctness)
- Message signing/verification tests
- Identity generation tests (petnames, identicons)

**Medium Priority:**
- Keychain integration tests (cross-platform)
- Audit logging tests
- IPC message serialization tests

---

## Test File Naming Conventions

### Rust Naming
- **Unit tests:** Inline `#[cfg(test)]` module at end of source file
- **Integration tests:** `tests/{feature}_test.rs` or `tests/{feature}_test_vectors.rs`
- **Test functions:** `#[test] fn test_feature_scenario() { ... }`

### TypeScript Naming
- **Test files:** `{module}.test.ts` or `{Component}.test.tsx`
- **Test location:** `src/test/{category}/{module}.test.ts`
- **Future pattern:** `src/{module}/__tests__/{Component}.test.tsx` (when components are built)

---

## Adding New Tests

### Adding Rust Unit Tests

1. Add `#[cfg(test)]` module at end of source file:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_feature() {
        // Test implementation
    }
}
```

2. Run with `cargo test --lib`

### Adding Rust Integration Tests

1. Create new file in `tests/` directory: `tests/feature_test.rs`
2. Import modules: `use edwinpai_desktop_lib::crypto_domain::*;`
3. Add test functions with `#[test]`
4. Run with `cargo test --test feature_test`

### Adding TypeScript Tests

1. Create test file: `src/test/{category}/{module}.test.ts`
2. Import test utilities:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
```
3. Write tests using Vitest/Testing Library APIs
4. Run with `npm test`

---

## Test Execution Performance

**Typical Execution Times** (local development):
- Rust unit tests: ~1-3 seconds
- Rust integration tests: ~1-2 seconds
- TypeScript lint: ~2-4 seconds
- TypeScript typecheck: ~3-5 seconds
- TypeScript tests: ~1-2 seconds
- Full Tauri build: ~30-90 seconds (platform-dependent)

**CI Execution Times:**
- `lint-and-typecheck` job: ~2-3 minutes
- `build` job (per platform): ~5-8 minutes
- Total CI time: ~8-10 minutes (jobs run in parallel)

---

## Known Issues & Workarounds

### Rust Backend Local Compilation

**Issue:** Local machine lacks system dependencies for Tauri (no sudo access)
```
error: failed to run custom build command for `webkit2gtk-sys`
```

**Workaround:** Rust backend tests can only run in:
- CI environment (GitHub Actions with dependencies installed)
- Docker containers with dependencies pre-installed
- Machines with full Tauri dependencies

**Alternative:** Use `cargo check` for syntax validation without building

### Test Isolation

**Keychain Tests:** OS keychain tests may persist data between runs. Use unique key names or manual cleanup if flaky.

**Audit Log Tests:** Ensure test logs write to temporary directories to avoid conflicts.

---

## Next Steps (Phase 2)

**Frontend Test Implementation:**
- Implement 5 stub test files in `src/test/`
- Add Tauri IPC mock layer for testing without backend
- Add React component tests when UI is built

**Backend Test Expansion:**
- Add subscription validation tests (Phase 2)
- Add encryption/decryption tests (if added)
- Expand keychain tests for edge cases

**Test Infrastructure:**
- Add code coverage reporting (cargo-tarpaulin for Rust, vitest coverage for TypeScript)
- Add test result badges to README
- Consider adding mutation testing (cargo-mutants)

---

## References

**Documentation:**
- Rust Testing: https://doc.rust-lang.org/book/ch11-00-testing.html
- Vitest: https://vitest.dev/
- Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- BRC-42 Spec: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md

**Project Documentation:**
- `PLAN.md` — 7-phase implementation plan
- `SPEC.md` — 12-section technical specification
- `PHASE1_CRYPTO_IMPLEMENTATION.md` — Phase 1 backend completion report
- `PHASE1_TEST_COVERAGE.md` — Test vector validation report
