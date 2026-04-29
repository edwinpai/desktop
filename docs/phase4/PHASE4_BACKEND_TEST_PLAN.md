# Phase 4 Backend Test Plan

**Generated:** 2026-02-11
**Phase:** 4 - Client Mode & Multi-User Authorization
**Purpose:** Comprehensive test plan for Phase 4 backend (unit + integration tests)

---

## Test Summary

| Category | Test Files | Test Count | LOC Estimate | Coverage Target |
|----------|------------|------------|--------------|-----------------|
| Unit Tests - Client Domain | 1 | 35 | 420 | >90% |
| Unit Tests - Discovery Domain | 1 | 12 | 185 | >90% |
| Unit Tests - Command Handlers | 1 | 14 | 265 | >90% |
| Integration Tests | 1 | 16 | 385 | >85% |
| **Total** | **4** | **77** | **1255** | **>85%** |

---

## 1. Unit Tests: Client Domain

**File:** `src-tauri/src/tests/client_tests.rs`
**Test Count:** 35
**LOC Estimate:** 420
**Coverage Target:** >90%

### 1.1 BRC-103 Authorization (18 tests)

#### Authentication Flow
```rust
#[tokio::test]
async fn test_initiate_handshake_success() {
    // Mock HTTP server returns valid challenge
    // Assert: Challenge has nonce, gateway_pubkey, expires_at
}

#[tokio::test]
async fn test_sign_challenge_valid_keypair() {
    // Mock keypair from Phase 1 crypto_domain
    // Assert: Signature is DER-encoded, 64-72 bytes
}

#[tokio::test]
async fn test_submit_response_success() {
    // Mock HTTP server returns session token
    // Assert: SessionToken has token, expires_at, user_id
}

#[tokio::test]
async fn test_verify_session_token_valid() {
    // Mock session token with expires_at = now + 24h
    // Assert: verify_session_token() returns true
}
```

### 1.2 HTTP Client (7 tests)

```rust
#[tokio::test]
async fn test_http_get_success() {
    // Mock HTTP server returns 200 + JSON payload
    // Assert: Deserialized response matches expected type
}

#[tokio::test]
async fn test_http_post_success() {
    // Mock HTTP server returns 201 + created resource
    // Assert: Response includes resource ID
}
```

### 1.3 User CRUD (5 tests)

```rust
#[tokio::test]
async fn test_create_user_success() {
    // Mock HTTP POST /users with NewUser payload
    // Assert: Returns User with generated ID
}

#[tokio::test]
async fn test_list_users_pagination() {
    // Mock HTTP GET /users?page=2&limit=10
    // Assert: Returns 10 users, total_count includes all users
}
```

### 1.4 Invitation Lifecycle (5 tests)

```rust
#[tokio::test]
async fn test_create_invitation_success() {
    // Mock HTTP POST /invitations with NewInvitation
    // Assert: Returns Invitation with status=Pending
}

#[tokio::test]
async fn test_accept_invitation_success() {
    // Mock HTTP POST /invitations/{id}/accept
    // Assert: Returns User, invitation status=Accepted
}
```

---

## 2. Unit Tests: Discovery Domain

**File:** `src-tauri/src/tests/discovery_tests.rs`
**Test Count:** 12
**LOC Estimate:** 185

### 2.1 mDNS Scanning (6 tests)

```rust
#[tokio::test]
async fn test_scan_gateways_timeout() {
    // Mock mDNS scanner with 1s timeout, no responses
    // Assert: Returns empty Vec after 1s
}

#[tokio::test]
async fn test_scan_gateways_multiple_results() {
    // Mock mDNS scanner returns 3 gateways
    // Assert: Vec contains 3 unique gateways
}
```

### 2.2 TXT Record Parsing (3 tests)

```rust
#[tokio::test]
async fn test_parse_txt_records_complete() {
    // Mock TXT records: pubkey, petname, version, signature, capabilities
    // Assert: All fields parsed correctly
}
```

### 2.3 Gateway Filtering (3 tests)

```rust
#[tokio::test]
async fn test_filter_compatible_versions() {
    // Mock 3 gateways: v1.0.0, v2.0.0, v2.1.0 (client v2.0.0)
    // Assert: Only v2.0.0 and v2.1.0 returned (semver compatible)
}
```

---

## 3. Unit Tests: Command Handlers

**File:** `src-tauri/src/tests/commands_client_tests.rs`
**Test Count:** 14

### 3.1 Gateway Connection (4 tests)

```rust
#[tokio::test]
async fn test_connect_gateway_command_success() {
    // Mock AppState, call connect_gateway()
    // Assert: AppState.client_connection is Some(GatewayClient)
}

#[tokio::test]
async fn test_disconnect_gateway_command() {
    // Mock AppState with active connection
    // Assert: AppState.client_connection is None
}
```

### 3.2 User Commands (6 tests)

```rust
#[tokio::test]
async fn test_create_user_command() {
    // Mock AppState with client_connection
    // Assert: Returns User, HTTP POST sent
}
```

### 3.3 Invitation Commands (4 tests)

```rust
#[tokio::test]
async fn test_create_invitation_command() {
    // Mock AppState
    // Assert: Returns Invitation with status=Pending
}
```

---

## 4. Integration Tests

**File:** `src-tauri/tests/phase4_integration.rs`
**Test Count:** 16
**LOC Estimate:** 385

### 4.1 End-to-End BRC-103 Handshake (3 tests)

```rust
#[tokio::test]
async fn test_full_brc103_handshake() {
    // 1. Mock gateway HTTP server
    // 2. initiate_handshake() → Challenge
    // 3. sign_challenge() → ChallengeResponse
    // 4. submit_response() → SessionToken
    // Assert: Token valid
}
```

### 4.2 Multi-User Scenario (4 tests)

```rust
#[tokio::test]
async fn test_owner_invites_member() {
    // Owner creates invitation
    // Assert: Invitation stored
}

#[tokio::test]
async fn test_member_accepts_invitation() {
    // Member accepts invitation
    // Assert: User created with role=Member
}
```

### 4.3 Session Token Lifecycle (2 tests)

```rust
#[tokio::test]
async fn test_session_token_refresh() {
    // Token expired → auto-refresh
    // Assert: New token received
}
```

### 4.4 Discovery + Connect Flow (2 tests)

```rust
#[tokio::test]
async fn test_discover_and_connect() {
    // 1. mDNS scan → gateways
    // 2. Connect to selected gateway
    // Assert: BRC-103 handshake completes
}
```

### 4.5 Subscription Gating (2 tests)

```rust
#[tokio::test]
async fn test_subscription_required_for_client_requests() {
    // Expired subscription → connection blocked
    // Assert: Returns SubscriptionError
}
```

### 4.6 Permission Enforcement (3 tests)

```rust
#[tokio::test]
async fn test_owner_full_permissions() {
    // Owner can create/update/delete users
    // Assert: All operations succeed
}

#[tokio::test]
async fn test_member_limited_permissions() {
    // Member attempts to delete user
    // Assert: Returns 403 Forbidden
}
```

---

## 5. CI Validation Checklist

### 5.1 Rust Backend Tests

**Commands:**
```bash
cd edwinpai-desktop/src-tauri
cargo test --lib          # Unit tests (61 tests)
cargo test --test '*'     # Integration tests (16 tests)
cargo test                # All tests (77 tests)
```

**Expected Output:**
```
test result: ok. 77 passed; 0 failed; 0 ignored
```

**Time Estimate:** ~8.5s (77 tests)

---

### 5.2 Linting & Type Checking

**Commands:**
```bash
cargo fmt --check         # Format check
cargo clippy -- -D warnings  # Lint
cargo check --all-targets    # Type check
```

**Expected Output:**
```
✅ cargo fmt --check: All files formatted
✅ cargo clippy: 0 warnings, 0 errors
✅ cargo check: Finished in 2.3s
```

---

### 5.3 Coverage Report

**Tool:** `cargo-tarpaulin`

**Commands:**
```bash
cargo tarpaulin --out Html --output-dir coverage/
```

**Expected Coverage:**
- `client/auth.rs`: >95%
- `client/connection.rs`: >90%
- `client/users.rs`: >90%
- `client/invitations.rs`: >90%
- `discovery/mdns.rs`: >90%
- `commands/client.rs`: >85%
- **Overall:** >85% line coverage

---

## Summary

**Phase 4 Test Plan:**
- ✅ 77 total tests (61 unit + 16 integration)
- ✅ 1,255 LOC test code (~50% of implementation LOC)
- ✅ >85% code coverage target
- ✅ Fast feedback loop (~11s local, ~4min CI)

**Ready for Implementation:** ✅ All test specifications complete
