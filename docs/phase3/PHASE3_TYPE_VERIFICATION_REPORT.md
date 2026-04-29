# Phase 3: Type Definition Verification Report

**Date**: 2026-02-11
**Phase**: 3 of 7
**Status**: ⚠️ PARTIAL PASS — Critical issues found

---

## Executive Summary

Verification of type definitions against Phase 3 requirements reveals **2 critical blocking issues** and **1 warning**:

1. **❌ BLOCKING**: TypeScript compilation fails (48 errors in navigation.ts and tray.ts)
2. **❌ BLOCKING**: Rust compilation fails (missing `tauri-plugin-tray` dependency)
3. **⚠️ WARNING**: Type duplication exists between `crypto_domain/types.rs` and `crypto_domain/ipc_types.rs`

**Recommendation**: Fix TypeScript export conflicts and Cargo.toml dependency before proceeding with Phase 3 implementation.

---

## Verification Checklist

| Criterion | Status | Details |
|-----------|--------|---------|
| (1) Rust types compile with `cargo check` | ❌ FAIL | Missing `tauri-plugin-tray` crate (does not exist in v2) |
| (2) TypeScript types pass `tsc --noEmit` | ❌ FAIL | 48 errors: duplicate exports in navigation.ts (27) and tray.ts (21) |
| (3) Rust-to-TypeScript IPC type alignment | ✅ PASS | Field names, serde annotations match (see §3) |
| (4) Import resolution for export indexes | ✅ PASS | All export indexes resolve correctly |
| (5) No type duplication | ⚠️ WARNING | Duplicate `SignRequest`/`SignResponse` types in Rust (see §5) |

---

## 1. Rust Type Compilation (`cargo check`)

### Status: ❌ FAIL

**Error**:
```
error: no matching package named `tauri-plugin-tray` found
location searched: crates.io index
required by package `edwinpai-desktop v0.1.0`
```

**Root Cause**:
`src-tauri/Cargo.toml:47` declares `tauri-plugin-tray = "2"`, but this crate does not exist. Tauri v2 has **built-in tray support** via the core `tauri` crate, not a separate plugin.

**Impact**:
- Cannot run `cargo check` or `cargo build` locally
- CI builds will fail
- Phase 3 backend implementation is blocked

**Fix Required**:
1. Remove line 47 from `src-tauri/Cargo.toml`: `tauri-plugin-tray = "2"`
2. Update tray implementation to use built-in Tauri v2 tray API:
   ```rust
   use tauri::tray::{TrayIconBuilder, Menu, MenuItem};
   ```
3. Reference: [Tauri v2 Tray Documentation](https://v2.tauri.app/reference/javascript/tray/)

**Deviation from SPEC.md**:
SPEC.md §6.4 does not specify which tray API to use. This is a Phase 3 implementation detail that needs correction.

---

## 2. TypeScript Type Checking (`tsc --noEmit`)

### Status: ❌ FAIL (48 errors)

**Errors**:

#### 2.1 `src/types/navigation.ts` (27 errors)
- Line 269: `Cannot redeclare exported variable 'ROUTE_METADATA'`
- Lines 371-381: Export conflicts for 13 types (AppRoute, ParameterizedRoute, Route, etc.)
- Lines 384-393: Export conflicts for 10 IPC request/response types
- Lines 396-399: Export conflicts for 4 event types

**Root Cause**:
The file exports types inline (e.g., `export type AppRoute = ...`) and then **re-exports** them again at the end in a `export type { ... }` block (lines 370-400). This creates duplicate export declarations.

**Fix Required**:
Remove the duplicate export block at lines 370-402. Types are already exported inline.

```diff
- // ============================================================================
- // Exports
- // ============================================================================
-
- export type {
-   AppRoute,
-   ParameterizedRoute,
-   // ... (all re-exports)
- };
-
- export { ROUTE_METADATA };
```

#### 2.2 `src/types/tray.ts` (21 errors)
- Line 83: `Cannot redeclare exported variable 'DEFAULT_TRAY_MENU_STATE'`
- Line 188: `Cannot redeclare exported variable 'buildTrayMenu'`
- Lines 320-339: Export conflicts for 19 types

**Root Cause**: Same as navigation.ts — duplicate export block at the end of the file.

**Fix Required**: Remove duplicate export block at end of file.

---

## 3. Rust-to-TypeScript IPC Type Alignment

### Status: ✅ PASS

All IPC types correctly align between Rust and TypeScript:

#### 3.1 Crypto Domain IPC Types

**Files**:
- Rust: `src-tauri/src/crypto_domain/ipc_types.rs`
- TypeScript: `src/types/ipc.ts`

**Verification**:

| Type | Rust Struct | TypeScript Interface | Field Alignment | Serde Annotations |
|------|-------------|---------------------|-----------------|-------------------|
| SignRequest | ✅ | ✅ | ✅ `payload`, `protocolID`, `keyID`, `counterparty` | ✅ `#[serde(rename = "protocolID")]` |
| SignResponse | ✅ | ✅ | ✅ `signature`, `publicKey` | ✅ `#[serde(rename = "publicKey")]` |
| VerifyRequest | ✅ | ✅ | ✅ `payload`, `signature`, `publicKey` | ✅ |
| VerifyResponse | ✅ | ✅ | ✅ `valid` | ✅ |
| GetPublicKeyRequest | ✅ | ✅ | ✅ `identityKey?`, `protocolID?`, `keyID?`, `counterparty?` | ✅ |
| GetPublicKeyResponse | ✅ | ✅ | ✅ `publicKey` | ✅ |
| CheckSubscriptionRequest | ✅ | ✅ | ✅ `forceRefresh?` | ✅ `#[serde(rename = "forceRefresh")]` |
| CheckSubscriptionResponse | ✅ | ✅ | ✅ All 7 fields match | ✅ |
| EncryptRequest | ✅ | ✅ | ✅ `plaintext`, `protocolID`, `keyID`, `counterparty` | ✅ |
| EncryptResponse | ✅ | ✅ | ✅ `ciphertext` | ✅ |
| DecryptRequest | ✅ | ✅ | ✅ `ciphertext`, `protocolID`, `keyID`, `counterparty` | ✅ |
| DecryptResponse | ✅ | ✅ | ✅ `plaintext` | ✅ |

**Key Observations**:
- All TypeScript camelCase fields (e.g., `protocolID`) correctly map to Rust snake_case fields (e.g., `protocol_id`) via `#[serde(rename = "...")]`
- All `Uint8Array` (TypeScript) map to `Vec<u8>` (Rust) with `#[serde(with = "serde_bytes")]` for efficient serialization
- All optional fields (`?` in TypeScript) map to `Option<T>` in Rust

#### 3.2 Gateway Process IPC Types

**Files**:
- Rust: `src-tauri/src/gateway/ipc_types.rs`
- TypeScript: `src/types/gateway.ts`

**Verification**:

| Type | Rust Struct | TypeScript Interface | Field Alignment | Serde Annotations |
|------|-------------|---------------------|-----------------|-------------------|
| GatewayStatus | ✅ enum | ✅ type (union) | ✅ 6 states match | ✅ `#[serde(rename_all = "lowercase")]` |
| GatewayProcessInfo | ✅ | ✅ | ✅ All 7 fields match | ✅ |
| StartGatewayRequest | ✅ | ✅ | ✅ `port?`, `autoRestart?` | ✅ `#[serde(rename = "autoRestart")]` |
| StartGatewayResponse | ✅ | ✅ | ✅ `success`, `pid`, `port`, `message?` | ✅ |
| StopGatewayRequest | ✅ | ✅ | ✅ `force?`, `timeout?` | ✅ |
| StopGatewayResponse | ✅ | ✅ | ✅ `success`, `message?` | ✅ |
| GetGatewayStatusRequest | ✅ | ✅ | ✅ (empty struct) | ✅ |
| GetGatewayStatusResponse | ✅ | ✅ | ✅ `info` | ✅ |
| HealthCheckResponse | ✅ | ✅ | ✅ All 4 fields match | ✅ |

**Key Observations**:
- Rust `enum GatewayStatus` correctly maps to TypeScript union type via `#[serde(rename_all = "lowercase")]`
- All default values (e.g., `port: 3000`, `autoRestart: true`) implemented via Rust `fn default_*()` helpers
- TypeScript `number | null` correctly maps to Rust `Option<u32>` for PID field

#### 3.3 Tray Menu IPC Types

**Files**:
- Rust: `src-tauri/src/tray/types.rs`
- TypeScript: `src/types/tray.ts`

**Verification**:

| Type | Rust Definition | TypeScript Definition | Alignment |
|------|----------------|----------------------|-----------|
| TrayMenuItemType | ✅ enum | ✅ type (union) | ✅ 4 types match |
| TrayMenuItemId | ✅ enum | ✅ type (union) | ✅ 13 IDs match |
| TrayMenuItem | ✅ struct | ✅ interface | ✅ All 7 fields match |
| TrayMenu | ✅ struct | ✅ interface | ✅ `items` field matches |
| TrayMenuState | ✅ struct | ✅ interface | ✅ All 5 bool fields match |

**Key Observations**:
- Rust `enum TrayMenuItemId` uses `as_str()` method for string serialization
- TypeScript types include `UpdateTrayMenuRequest`, `GetTrayMenuStateRequest`, etc. — **no Rust equivalents found** (Phase 3 TODO)

---

## 4. Import Resolution for Export Indexes

### Status: ✅ PASS

All export index files correctly re-export types from their respective modules:

#### 4.1 TypeScript: `src/types/index.ts`

**Exports**:
- ✅ Lines 1-34: Crypto IPC types from `./ipc`
- ✅ Lines 36-68: Gateway API types from `./api`
- ✅ Lines 70-81: Identity types from `./identity`
- ✅ Lines 83-90: Subscription types from `./subscription`
- ✅ Lines 92-110: Access control types from `./access`
- ✅ Lines 112-125: Crypto utility types from `./crypto`
- ✅ Lines 127-134: Audit log types from `./audit`
- ✅ Lines 136-150: SPV types from `./spv`
- ✅ Lines 152-170: Overlay/Arcade types from `./overlay`
- ✅ Lines 172-190: Identity setup wizard types from `./identity-setup`
- ✅ Lines 192-217: Gateway process types from `./gateway`
- ✅ Lines 219-257: Chat/SSE streaming types from `./chat`
- ✅ Lines 259-271: Desktop config types from `./config`
- ✅ Lines 273-284: Tauri command types from `./tauri-commands`
- ✅ Lines 289-325: Test types from `./test`

**Total**: 326 lines, **0 import resolution errors** (when duplicate export blocks are removed from navigation.ts and tray.ts).

**Note**: Navigation and tray types are NOT yet exported from `index.ts` — this is expected for Phase 3 (not yet implemented).

#### 4.2 Rust: `src-tauri/src/crypto_domain/mod.rs`

**Exports**:
- ✅ Lines 14-19: Core types from `types` module (18 type re-exports)
- ✅ Lines 21-23: Traits from `traits` module (5 trait re-exports)
- ✅ Line 25: Domain implementation from `domain` module
- ✅ Lines 28-38: IPC types from `ipc_types` module (28 type re-exports)

**Total**: 51 re-exported types, **0 import resolution errors**.

#### 4.3 Rust: `src-tauri/src/gateway/mod.rs`

**Exports**:
- ✅ Lines 10-13: Core types from `types` module (9 type re-exports)
- ✅ Lines 16-21: IPC message types from `ipc_types` module (10 type re-exports)
- ✅ Line 24: Event types from `ipc_types` module (1 event type)
- ✅ Line 27: Error types from `ipc_types` module (2 error types)

**Total**: 22 re-exported types, **0 import resolution errors**.

---

## 5. Type Duplication Analysis

### Status: ⚠️ WARNING (Duplication exists but follows documented pattern)

#### 5.1 Rust: Crypto Domain Types

**Duplication Found**:
- `SignRequest` defined in **both** `crypto_domain/types.rs` (line 147) and `crypto_domain/ipc_types.rs` (line 12)
- `SignResponse` defined in **both** `crypto_domain/types.rs` (line 155) and `crypto_domain/ipc_types.rs` (line 18)
- `VerifyRequest` defined in **both** files
- `VerifyResponse` defined in **both** files
- `EncryptRequest` defined in **both** files
- `EncryptResponse` defined in **both** files
- `DecryptRequest` defined in **both** files
- `DecryptResponse` defined in **both** files

**Purpose**:
- **`types.rs`**: Domain-internal types (used by `CryptoDomain` trait implementations)
- **`ipc_types.rs`**: IPC bridge types (used by Tauri commands, with `#[serde(tag = "type")]` for type discrimination)

**Field Differences**:

| Type | `types.rs` Fields | `ipc_types.rs` Fields | Difference |
|------|------------------|----------------------|------------|
| SignRequest | `data: Vec<u8>`, `derivation: Option<Brc42Params>` | `payload: Vec<u8>`, `protocolID: String`, `keyID: String`, `counterparty: Option<String>` | **Different structure** |
| EncryptRequest | `plaintext: Vec<u8>`, `derivation: Brc42Params` | `plaintext: Vec<u8>`, `protocolID: String`, `keyID: String`, `counterparty: String` | **Different structure** |

**Verdict**: ⚠️ **Acceptable duplication**. The types serve different purposes:
1. `types.rs` types are **domain-internal** (used by trait implementations)
2. `ipc_types.rs` types are **IPC-facing** (directly serialized from TypeScript via Tauri)
3. Tauri commands translate from `ipc_types` → `types` before calling the `CryptoDomain` trait

**Documented in**: `PHASE1_TYPE_ALIGNMENT_SUMMARY.md` lines 96-130 (explicit re-export strategy).

**Recommendation**: Add comments to both files clarifying the distinction:

```rust
// crypto_domain/types.rs
/// Domain-internal signing request (used by CryptoDomain trait)
/// For IPC types, see ipc_types::SignRequest
pub struct SignRequest { ... }

// crypto_domain/ipc_types.rs
/// IPC bridge signing request (matches src/types/ipc.ts)
/// Translated to domain types before processing
pub struct SignRequest { ... }
```

#### 5.2 TypeScript: No Duplication Found

- ✅ All types defined once in their respective module files
- ✅ `index.ts` only re-exports types (does not redefine them)
- ✅ No namespace collisions detected

---

## 6. Deviations from SPEC.md

### 6.1 Deviation: `tauri-plugin-tray` Does Not Exist

**SPEC.md Reference**: §6.4 "System Tray"

**Issue**: SPEC.md does not specify which Tauri tray API to use. Cargo.toml incorrectly assumes a separate `tauri-plugin-tray` crate exists for Tauri v2.

**Reality**: Tauri v2 has **built-in tray support** via the core `tauri` crate.

**Fix**: Update `src-tauri/Cargo.toml` and tray implementation to use `tauri::tray` module.

**Documentation Update Needed**: Update SPEC.md §6.4 to specify:
```markdown
- **Tauri v2 Tray API**: Use built-in `tauri::tray` module (NOT a separate plugin)
- **API Reference**: https://v2.tauri.app/reference/javascript/tray/
```

### 6.2 Deviation: Navigation and Tray Types Not Yet in Phase 1-2

**SPEC.md Reference**: §7 "Navigation" and §6.4 "System Tray"

**Status**: Navigation and tray types exist in `src/types/navigation.ts` and `src/types/tray.ts` but are:
1. ❌ Not exported from `src/types/index.ts`
2. ❌ Not implemented in Rust (no `src-tauri/src/navigation/` module)
3. ⚠️ Contain TypeScript compilation errors (duplicate exports)

**Verdict**: This is **expected** for Phase 3. These types are scaffolded but not yet integrated.

**Phase 3 TODO**:
1. Fix TypeScript export conflicts
2. Implement Rust navigation command handlers (if needed)
3. Export navigation/tray types from `index.ts` when ready for integration

---

## 7. Recommendations

### 7.1 Immediate Actions (Blocking)

1. **Fix TypeScript compilation errors** (Priority: CRITICAL):
   ```bash
   # Edit src/types/navigation.ts: Remove lines 366-402 (duplicate export block)
   # Edit src/types/tray.ts: Remove lines 316-342 (duplicate export block)
   npm run typecheck  # Should pass with 0 errors
   ```

2. **Fix Cargo.toml dependency** (Priority: CRITICAL):
   ```bash
   # Edit src-tauri/Cargo.toml: Remove line 47 (tauri-plugin-tray)
   # Update tray implementation to use tauri::tray module
   cargo check  # Should pass (if system deps installed)
   ```

### 7.2 Phase 3 Implementation Guidance

1. **Tray Implementation**:
   - Use `tauri::tray::{TrayIconBuilder, Menu, MenuItem}` API
   - Reference existing types in `src-tauri/src/tray/types.rs`
   - Implement Tauri commands: `update_tray_menu`, `get_tray_menu_state`, etc.

2. **Navigation Integration**:
   - Current TypeScript types in `navigation.ts` are well-structured
   - May not need Rust-side navigation module (frontend can handle routing)
   - Only implement Rust commands if deep linking or system-level routing is needed

3. **Type Alignment Verification**:
   - Re-run this verification after Phase 3 implementation
   - Ensure all new IPC types follow Phase 1/2 patterns (camelCase → snake_case via `#[serde(rename)]`)

### 7.3 Documentation Updates

1. Update `PHASE3_REQUIREMENTS.md` to clarify tray API usage
2. Add type duplication rationale comments to `crypto_domain/types.rs` and `crypto_domain/ipc_types.rs`
3. Document navigation routing approach (frontend-only vs. Rust-assisted)

---

## 8. Summary

| Verification Criterion | Status | Blocker? |
|------------------------|--------|----------|
| Rust types compile | ❌ FAIL | **YES** — Missing dependency |
| TypeScript types compile | ❌ FAIL | **YES** — 48 duplicate export errors |
| Rust ↔ TypeScript alignment | ✅ PASS | No |
| Import resolution | ✅ PASS | No |
| Type duplication | ⚠️ WARNING | No (acceptable pattern) |

**Overall Status**: ⚠️ **PARTIAL PASS** — 2 blocking issues, 1 warning

**Next Steps**:
1. Fix TypeScript export conflicts (5 min fix)
2. Fix Cargo.toml tray dependency (5 min fix + implementation effort)
3. Re-run verification: `npm run typecheck && cargo check`
4. Proceed with Phase 3 implementation once both pass

---

**Generated**: 2026-02-11
**Tool**: Claude Code (Sonnet 4.5)
**Context**: Phase 3 type verification per PLAN.md and SPEC.md requirements
