# Authorization Domain - Implementation Checklist

**Date**: 2026-02-11
**Status**: ✅ COMPLETE

## File Creation ✅

- [x] `src-tauri/src/auth/users.rs` (452 LOC)
- [x] `src-tauri/src/auth/invitations.rs` (545 LOC)
- [x] `src-tauri/src/commands/auth.rs` (463 LOC)
- [x] Updated `src-tauri/src/auth/mod.rs` (re-exports)
- [x] Updated `src-tauri/src/commands/mod.rs` (module declaration)

**Total Files**: 5 Rust modules in auth domain

## Module Integration ✅

### auth/mod.rs
- [x] Import `users` module
- [x] Import `invitations` module
- [x] Re-export `UserManager`, `InvitationManager`
- [x] Re-export `get_user_manager`, `get_invitation_manager`
- [x] Re-export `init_user_manager`, `init_invitation_manager`

### lib.rs
- [x] Declare `pub mod auth`
- [x] Register 10 auth commands in `invoke_handler!`
- [x] Initialize auth domain in `.setup()` hook
- [x] Initialize config manager in `.setup()` hook

### Tauri Commands Registered
1. `commands::auth::list_users`
2. `commands::auth::get_user`
3. `commands::auth::remove_user`
4. `commands::auth::update_user_activity`
5. `commands::auth::create_invitation` (aliased as `auth_create_invitation`)
6. `commands::auth::redeem_invitation`
7. `commands::auth::revoke_invitation`
8. `commands::auth::list_invitations`
9. `commands::auth::check_authorization`
10. `commands::auth::verify_brc103_signature`

**Total Commands**: 10 IPC endpoints

## Test Coverage ✅

### users.rs
- [x] `test_user_manager_creation`
- [x] `test_file_path_format`
- [x] `test_add_and_remove_user`
- [x] `test_duplicate_user_error`
- [x] `test_remove_nonexistent_user_error`
- [x] `test_list_users`
- [x] `test_update_last_active`
- [x] `test_check_authorization`
- [x] `test_save_and_load`
- [x] `test_atomic_write`

**Subtotal**: 10 tests

### invitations.rs
- [x] `test_invitation_manager_creation`
- [x] `test_file_path_format`
- [x] `test_create_invitation`
- [x] `test_cannot_create_owner_invitation`
- [x] `test_redeem_invitation`
- [x] `test_cannot_redeem_twice`
- [x] `test_revoke_invitation`
- [x] `test_cannot_revoke_accepted_invitation`
- [x] `test_list_invitations`
- [x] `test_generate_invitation_data`
- [x] `test_save_and_load`
- [x] `test_cleanup_expired`
- [x] `test_atomic_write`

**Subtotal**: 13 tests

### commands/auth.rs
- [x] `test_init_auth_domain`
- [x] `test_list_users_command`
- [x] `test_get_user_command`
- [x] `test_create_invitation_command`
- [x] `test_list_invitations_command`
- [x] `test_check_authorization_command`
- [x] `test_invitation_lifecycle_commands`
- [x] `test_redeem_invitation_flow`
- [x] `test_remove_user_command`

**Subtotal**: 9 tests

### Pre-existing Tests
- `auth/types.rs`: 8 tests (AccessLevel, UserDatabase, Invitation, NonceTracker)
- `auth/ipc_types.rs`: 4 tests (IPC serialization)

**TOTAL TEST COUNT**: 44 tests (32 new + 12 existing)

## Dependencies ✅

All required dependencies already present in `Cargo.toml`:
- [x] `serde` + `serde_json` (serialization)
- [x] `tokio` (async I/O)
- [x] `chrono` (timestamps)
- [x] `rand` (token generation)
- [x] `hex` (encoding)
- [x] `dirs` (platform paths)
- [x] `once_cell` (singletons)

**No new dependencies added**

## Persistence Files ✅

Both managers create files in `~/.edwinpai/`:

1. **Users**: `~/.edwinpai/authorized_users.json`
   - [x] Atomic writes (tmp + rename)
   - [x] Load-on-demand strategy
   - [x] Pretty-printed JSON

2. **Invitations**: `~/.edwinpai/invitations.json`
   - [x] Atomic writes (tmp + rename)
   - [x] Load-on-demand strategy
   - [x] Pretty-printed JSON
   - [x] Auto-cleanup expired on load

## Integration Points ✅

### Crypto Domain
- [x] `verify_brc103_signature()` → `commands::crypto::verify_message()`
- [x] Proper hex decoding for signature bytes
- [x] Delegates to existing secp256k1 verification

### Config Domain
- [x] Follows same file-based persistence pattern
- [x] Uses same atomic write strategy
- [x] Reuses `dirs::home_dir()` for paths

### Application Lifecycle
- [x] `init_auth_domain()` called in `lib.rs::setup()`
- [x] Managers initialized before window creation
- [x] No errors during initialization silently logged

## Access Control Matrix ✅

Implementation follows SPEC §12.2:

| Level  | Manage Users | Read/Write | Read-Only |
|--------|--------------|------------|-----------|
| Owner  | ✓            | ✓          | ✓         |
| Member | ✗            | ✓          | ✓         |
| Guest  | ✗            | ✗          | ✓         |

- [x] `AccessLevel` enum with 3 variants
- [x] `can_manage_users()` method
- [x] `can_write()` method
- [x] `can_read()` method
- [x] Type enforcement in invitation creation (no owner invites)

## Documentation ✅

- [x] `AUTH_DOMAIN_IMPLEMENTATION.md` (comprehensive summary)
- [x] `AUTH_DOMAIN_CHECKLIST.md` (this file)
- [x] Inline code comments in all modules
- [x] Rustdoc comments on public functions
- [x] Test documentation

## Known Issues / TODOs ⚠️

1. **Nonce Tracking**: Not integrated in `verify_brc103_signature()`
   - `NonceTracker` exists in types but not used
   - Need to add to command implementation

2. **Petname Derivation**: Placeholder in `redeem_invitation()`
   - Current: `format!("User {}", &pubkey[..8])`
   - Should use crypto domain's derivation

3. **Gateway Context**: Hardcoded in `create_invitation()`
   - Current: `"03gateway..."` and `"192.168.1.100:3000"`
   - Should inject from config or discovery

4. **Middleware**: Access control not enforced in REST API
   - Types and checks exist but no middleware yet
   - Need HTTP layer to verify caller pubkey

5. **E2E Tests**: Only unit/integration tests
   - No Playwright flows for QR scanning
   - No multi-user chat authorization tests

## CI Validation

Run tests with:
```bash
cd src-tauri
cargo test auth::
```

Expected output:
```
running 44 tests
test auth::types::tests::... ok
test auth::ipc_types::tests::... ok
test auth::users::tests::... ok
test auth::invitations::tests::... ok
test commands::auth::tests::... ok

test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Sign-off

✅ **Authorization domain implementation COMPLETE**

**Ready for**:
- Phase 4B: REST API middleware integration
- Phase 5: Client mode UI (connect to gateway, redeem invitations)
- Phase 6: Multi-user chat with access control enforcement

**Blockers**: None

**Next Steps**:
1. Push to GitHub for CI validation
2. Implement REST API middleware (Phase 4B)
3. Build frontend UI for invitation management (Phase 5)
