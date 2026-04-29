# CI-Only Build Constraints - EdwinPAI Desktop Phase 1

**Document Version:** 1.0
**Date:** 2026-02-10
**Status:** Active Constraint

---

## Overview

The EdwinPAI Desktop project has a **hard constraint** on local Rust compilation due to missing system libraries on the development machine. All Rust backend testing and validation **must occur in CI environments** (GitHub Actions).

This document explains the constraint, its impact, mitigation strategies, and validation workflow.

---

## The Constraint

### Root Cause
Development machine lacks **sudo access** and cannot install required system libraries for Tauri v2 on Linux.

### Missing Dependencies
The following packages are required but not available:

1. **WebKit2GTK 4.1** — `libwebkit2gtk-4.1-dev`
2. **App Indicator** — `libappindicator3-dev`
3. **SVG Rendering** — `librsvg2-dev`
4. **ELF Patching** — `patchelf`
5. **GTK 3** — `libgtk-3-dev`
6. **Soup 3.0** — `libsoup-3.0-dev`
7. **JavaScriptCore** — `libjavascriptcoregtk-4.1-dev`

### Failed Commands
```bash
$ cargo check
error: failed to run custom build command for `webkit2gtk-sys v2.0.1`
  --- stderr
  Package webkit2gtk-4.1 was not found in the pkg-config search path.

$ cargo test
error: linking with `cc` failed: exit status: 1
  = note: /usr/bin/ld: cannot find -lwebkit2gtk-4.1

$ cargo build --release
error: could not compile `edwinpai-desktop` (bin "edwinpai-desktop") due to 15 previous errors
```

---

## Impact Analysis

### ❌ Blocked Locally
| Command | Status | Reason |
|---------|--------|--------|
| `cargo check` | ❌ BLOCKED | Cannot compile without WebKit libs |
| `cargo test` | ❌ BLOCKED | Cannot run Rust tests |
| `cargo build` | ❌ BLOCKED | Cannot link final binary |
| `cargo clippy` | ❌ BLOCKED | Requires compilation |
| Backend debugging | ❌ BLOCKED | Cannot run Tauri in dev mode |

### ✅ Works Locally
| Command | Status | Notes |
|---------|--------|-------|
| `npm install` | ✅ WORKS | No system deps |
| `tsc --noEmit` | ✅ WORKS | TypeScript type checking |
| `eslint src/` | ✅ WORKS | Frontend linting |
| `vite build` | ✅ WORKS | Frontend bundle (no backend) |
| `vitest run` | ✅ WORKS | Frontend unit tests |
| File editing | ✅ WORKS | Code authoring unrestricted |
| Git operations | ✅ WORKS | Version control functional |

### Partial Validation Possible
During Phase 0, we validated:
- ✅ TypeScript compiles (`tsc` PASS)
- ✅ ESLint rules enforced (0 errors, 5 warnings)
- ✅ Vite builds frontend (`dist/` bundle created)
- ✅ Vitest runs 1 test (placeholder)

This gave **frontend confidence** but **zero backend validation** before CI.

---

## Mitigation Strategy

### 1. GitHub Actions CI Workflow

**File:** `.github/workflows/ci.yml`

**Strategy:** Run all Rust operations in cloud runners with pre-installed system libraries.

**Workflow Stages:**
```yaml
1. lint:
   - runs: npm run lint (eslint)
   - platform: ubuntu-latest

2. typecheck:
   - runs: tsc --noEmit
   - platform: ubuntu-latest

3. test:
   - runs: npm test (vitest)
   - runs: cargo test --all (Rust unit + integration)
   - platform: ubuntu-latest, macos-latest, windows-latest

4. build:
   - runs: npm run tauri build
   - artifacts: .deb, .AppImage, .dmg, .msi
   - platform: ubuntu-latest, macos-latest, windows-latest
```

**Key Features:**
- ✅ Ubuntu runner has all required `.deb` packages pre-installed
- ✅ macOS runner uses Homebrew for system deps
- ✅ Windows runner uses MSVC toolchain (no WebKit needed)
- ✅ Parallel execution across all 3 platforms
- ✅ Artifact uploads for distribution testing

### 2. Test-Driven Development Adaptation

**Workflow:**
```
1. Write Rust code locally (editor, LSP, syntax highlighting)
2. Write tests alongside implementation
3. Commit to git branch
4. Push to GitHub
5. Wait for CI to run tests
6. Review CI logs for failures
7. Fix locally, repeat from step 3
```

**Pros:**
- Still get full test coverage
- CI validates across 3 platforms (better than local)
- No local environment pollution

**Cons:**
- Slower feedback loop (2-5 min per CI run)
- Cannot debug with breakpoints locally
- Must rely on `println!` debugging via CI logs

### 3. Docker Alternative (Not Chosen)

**Option:** Use Docker with Ubuntu image + system libs
**Reason for Rejection:**
- Would require Docker Desktop with sudo
- No sudo access on dev machine
- Docker CLI alone insufficient (needs daemon)
- CI already provides same environment

### 4. Remote Development (Not Chosen)

**Option:** SSH into cloud VM with full toolchain
**Reason for Rejection:**
- Adds complexity to auth/networking
- CI already solves the problem
- Would duplicate CI environment

---

## CI Validation Workflow

### Pre-Push Checklist
Before pushing code that needs backend validation:

- [ ] TypeScript compiles: `tsc --noEmit`
- [ ] ESLint passes: `npm run lint`
- [ ] Frontend tests pass: `npm test`
- [ ] Git status clean: `git status`
- [ ] Branch up-to-date: `git pull origin main`
- [ ] Commit message follows convention
- [ ] Rust code has `#[test]` functions written

### Push & Monitor
```bash
# Push to trigger CI
git push origin <branch-name>

# Monitor CI run
gh run watch  # GitHub CLI (if installed)
# OR visit: https://github.com/<user>/edwinpai-desktop/actions
```

### CI Success Criteria
For Phase 1 backend, CI **must** show:
- ✅ `cargo test` — 58/58 tests PASS
- ✅ `cargo clippy` — 0 warnings
- ✅ `cargo build --release` — Binary builds on all 3 platforms
- ✅ BRC-42 test vectors — 10/10 PASS (non-negotiable)

### CI Failure Response
If CI fails:
1. Click failed job in GitHub Actions UI
2. Download logs or view in browser
3. Identify failing test(s)
4. Copy error message to local notes
5. Fix code locally (tests still compile in editor)
6. Commit fix
7. Push again → new CI run
8. Repeat until green

---

## Phase-Specific Impacts

### Phase 0 (Foundation Setup)
- **Impact:** Medium
- **Workaround:** Frontend-only validation (tsc, eslint, vite)
- **Outcome:** Successfully completed without Rust testing

### Phase 1 (Crypto Domain)
- **Impact:** High
- **Workaround:** Write all tests, validate in CI
- **Outcome:** 58 tests written, awaiting CI run
- **Risk:** BRC-42 vectors might fail on first CI run (requires fix iteration)

### Phase 2 (Gateway Integration)
- **Impact:** High
- **Workaround:** Same as Phase 1 (CI-only Rust testing)
- **Outcome:** Not started yet
- **Risk:** HTTP client tests need network mocking (works in CI)

### Phase 3-7 (UI/Features)
- **Impact:** Low-Medium
- **Workaround:** Frontend tests run locally, backend IPC tests in CI
- **Outcome:** Not started yet
- **Risk:** Manual testing of Tauri app requires CI-built binaries

---

## Import Resolution Validation

### Problem
Without running `cargo check`, how do we verify imports resolve correctly?

### Solution: Multi-Layered Validation

#### 1. Rust Analyzer (LSP)
- **Tool:** rust-analyzer VSCode extension
- **Validation:** Inline import resolution, red squiggles on errors
- **Limitation:** May not catch all issues without full compilation
- **Status:** Used during development, no red squiggles observed

#### 2. TypeScript Compilation
- **Tool:** `tsc --noEmit`
- **Validation:** Ensures TypeScript side of IPC bridge type-safe
- **Limitation:** Doesn't validate Rust side
- **Status:** ✅ PASS locally (0 errors)

#### 3. Manual Dependency Graph Analysis
- **Method:** Trace `use` statements across all `.rs` files
- **Validation:** Check for circular deps, missing exports
- **Limitation:** Human error possible
- **Status:** ✅ Verified in PHASE1_TEST_MANIFEST.md (no cycles found)

#### 4. CI `cargo check`
- **Tool:** Rust compiler's borrow checker + type system
- **Validation:** Definitive proof of import correctness
- **Limitation:** Only runs in CI
- **Status:** ⏳ Pending first CI run

#### 5. Import Resolution Report
Created in `PHASE1_TEST_MANIFEST.md` § "Import Resolution Validation":
```
✅ All `use crate::crypto_domain::types::*` imports resolve
✅ All `use crate::crypto_domain::traits::*` imports resolve
✅ `pub use keypair::{...}` in `mod.rs` exports correct items
✅ Integration test `use edwinpai_desktop::crypto_domain::brc42::*` valid
✅ No circular dependencies detected
```

---

## Risk Mitigation

### Risk 1: BRC-42 Test Vectors Fail in CI
**Likelihood:** Medium (first-time implementation)
**Impact:** High (blocks Phase 1 completion)
**Mitigation:**
- Official test vectors copied directly from BRC spec
- Derivation logic follows spec exactly (HMAC-SHA512 + ECDH)
- If CI fails, iterate fix→push→CI until green
- Budget 2-3 CI iterations for BRC-42 tuning

### Risk 2: CI Environment Differs from Production
**Likelihood:** Low (Ubuntu runner matches target platform)
**Impact:** Medium (user-facing bugs)
**Mitigation:**
- CI builds artifacts for all 3 platforms (Linux, macOS, Windows)
- Manual smoke testing on each platform before release
- GitHub Actions uses same OS versions as target users

### Risk 3: Long Feedback Loop Slows Development
**Likelihood:** High (confirmed reality)
**Impact:** Medium (slower velocity)
**Mitigation:**
- Write comprehensive tests upfront (avoid multiple CI fix cycles)
- Use Rust Analyzer for instant feedback where possible
- Batch related changes into single commit (fewer CI runs)
- 2-5 min CI runs acceptable for backend validation

### Risk 4: Cannot Debug Rust Code Locally
**Likelihood:** Certain (by design)
**Impact:** Medium (harder to diagnose issues)
**Mitigation:**
- Heavy use of `println!` debugging in tests
- CI logs show full `cargo test -- --nocapture` output
- Extract complex logic into pure functions (easier to test)
- Use `#[should_panic]` tests for error paths

---

## Alternative Approaches Considered

### ❌ Podman Rootless Containers
- **Idea:** Use rootless Podman instead of Docker Desktop
- **Rejected:** Still requires daemon setup, adds complexity

### ❌ Nix Package Manager
- **Idea:** Use Nix to install deps without sudo
- **Rejected:** Steep learning curve, non-standard for team

### ❌ WSL2 on Windows
- **Idea:** Develop in WSL2 with apt-get access
- **Rejected:** Dev machine is Linux native, not Windows

### ❌ Cloud IDE (GitHub Codespaces)
- **Idea:** Develop entirely in cloud VM
- **Rejected:** Requires internet, slower than local editing

### ✅ GitHub Actions CI (CHOSEN)
- **Pros:** No local setup, validates 3 platforms, free for open source
- **Cons:** Slower feedback loop, cannot debug interactively
- **Decision:** Best balance of simplicity vs. capability

---

## Documentation Cross-References

This constraint is referenced in:
1. **MEMORY.md** — "Rust backend can only compile in CI or containers"
2. **PHASE1_TEST_MANIFEST.md** — "Not run locally (requires system libs)"
3. **PHASE1_BACKEND_VERIFICATION.md** — "CI validation required"
4. **PHASE1_COMPLETION_REPORT.md** — "Local Rust builds impossible"

All Phase 1+ deliverables acknowledge this constraint upfront.

---

## Future Resolution

### If Sudo Access Granted
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libgtk-3-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev

cargo test  # Would now work locally
```

### If Moving to Different Machine
Ensure new environment has:
- Ubuntu 22.04+ or macOS 12+
- Rust 1.70+ toolchain
- System libraries listed above
- sudo access for `apt` or `brew`

### If Adopting Tauri v3
Tauri v3 may have different system dependencies. Re-evaluate constraint at migration time.

---

## Conclusion

The CI-only constraint is a **known limitation** with **documented workarounds**. It does **not block development**, but shifts backend validation from local to cloud. This is an **acceptable trade-off** given:

1. ✅ Frontend validation works locally
2. ✅ CI provides multi-platform validation (better than local)
3. ✅ GitHub Actions free tier sufficient for project
4. ✅ 2-5 min CI feedback loop manageable
5. ✅ Team familiar with git push → CI → iterate workflow

Phase 1 backend code is **complete and committed**. Next step: **git push** to trigger first CI validation run.

---

**Document Status:** ✅ Complete
**Last Updated:** 2026-02-10
**Next Review:** Upon gaining sudo access or migrating to new machine
