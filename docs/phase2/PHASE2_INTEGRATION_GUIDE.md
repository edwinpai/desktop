# Phase 2 Integration Guide

**Document Version:** 1.0
**Generated:** 2026-02-10
**Project:** EdwinPAI Desktop - Subscription System
**Phase:** Phase 2 - Integration with Phase 1 Identity Infrastructure

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Integration Architecture](#integration-architecture)
4. [Step-by-Step Integration](#step-by-step-integration)
5. [IPC Setup and Configuration](#ipc-setup-and-configuration)
6. [Code Examples](#code-examples)
7. [Error Handling Patterns](#error-handling-patterns)
8. [Testing Integration](#testing-integration)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides complete integration procedures for connecting the Phase 2 subscription management system with Phase 1 identity infrastructure. The integration enables:

- Seamless subscription verification using Phase 1 identity keys
- BRC-42 key derivation compatibility
- SPV verification integration
- Overlay services client integration
- Unified cache directory structure

**Integration Complexity:** Moderate
**Estimated Integration Time:** 2-4 hours
**Required Expertise:** TypeScript, Rust, Tauri IPC

---

## Prerequisites

### Phase 1 Components Required

1. **Identity Manager** (`src-tauri/src/identity.rs`)
   - BRC-42 key derivation implementation
   - Identity key generation and storage
   - Payment address derivation

2. **SPV Verifier** (`src-tauri/src/spv.rs`)
   - BEEF proof parsing (BRC-62)
   - Merkle proof verification (BRC-67)
   - Block header validation

3. **Overlay Client** (`src-tauri/src/overlay.rs`)
   - HTTP client for overlay services
   - Subscription UTXO lookup
   - Transaction broadcasting

4. **Directory Structure**
   ```
   ~/.edwinpai/
   ├── identity/
   │   └── keys.json          (Phase 1)
   └── audit_log.json         (Phase 1)
   ```

### Phase 2 Components to Integrate

1. **Subscription Manager** (`subscription-manager.ts`)
2. **Subscription State Machine** (`subscription-state-machine.ts`)
3. **Subscription Cache** (`subscription-cache.ts`)
4. **React Hook** (`hooks/useSubscription.tsx`)
5. **UI Components** (`components/SubscriptionSetup.tsx`, `components/SubscriptionSettings.tsx`)

### Dependencies

**Rust (Cargo.toml):**
```toml
[dependencies]
hmac = "0.12"          # HMAC for BRC-42
sha2 = "0.10"          # Hashing
hex = "0.4"            # Hex encoding
serde = "1.0"          # Serialization
serde_json = "1.0"     # JSON serialization
tokio = "1.0"          # Async runtime
reqwest = "0.11"       # HTTP client
```

**TypeScript (package.json):**
```json
{
  "dependencies": {
    "ioredis": "^5.3.0",
    "@tauri-apps/api": "^1.5.0"
  }
}
```

---

## Integration Architecture

### System Overview

```
┌─────────────────────────────────────────────────────┐
│                  EdwinPAI Desktop App                   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐          ┌──────────────────┐    │
│  │   Phase 1    │          │     Phase 2       │    │
│  │   Identity   │──────────│   Subscription    │    │
│  │   Manager    │  Address │    Manager        │    │
│  └──────────────┘          └──────────────────┘    │
│         │                           │                │
│         │                           │                │
│  ┌──────▼──────┐          ┌────────▼──────────┐    │
│  │  BRC-42     │          │  Overlay Client   │    │
│  │  Deriver    │          │  (Subscription    │    │
│  │             │          │   Topic: EDWINPAI)   │    │
│  └─────────────┘          └───────────────────┘    │
│                                    │                 │
│                           ┌────────▼──────────┐    │
│                           │   SPV Verifier    │    │
│                           │   (BEEF Proofs)   │    │
│                           └───────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User launches EdwinPAI
   ↓
2. Identity Manager loads/generates identity → userAddress
   ↓
3. Subscription Manager initialized with userAddress
   ↓
4. Query Overlay Services for subscription UTXO
   ↓
5. SPV Verifier validates BEEF proof
   ↓
6. State Machine updates subscription state
   ↓
7. Cache stores verification result
   ↓
8. UI components display subscription status
```

---

## Step-by-Step Integration

### Step 1: Initialize Identity Manager (Phase 1)

**File:** `src-tauri/src/main.rs`

```rust
use identity::IdentityManager;
use subscription::SubscriptionManager;

#[tauri::command]
async fn initialize_app() -> Result<String, String> {
    // Initialize Phase 1 identity
    let identity_manager = IdentityManager::initialize()
        .await
        .map_err(|e| format!("Identity init failed: {}", e))?;

    // Get user's payment address
    let user_address = identity_manager.get_payment_address()
        .await
        .map_err(|e| format!("Address derivation failed: {}", e))?;

    Ok(user_address)
}
```

**Purpose:** Obtain the user's payment address for subscription lookups.

---

### Step 2: Configure Subscription Manager

**File:** `src/lib/subscription-setup.ts`

```typescript
import { SubscriptionManager, createSubscriptionManager } from './subscription-manager';
import { OverlayClient } from './overlay-services-client';
import { SubscriptionCache } from './subscription-cache';
import { SpvVerifier } from './spv-verifier';
import { invoke } from '@tauri-apps/api';

export async function initializeSubscriptionSystem(): Promise<SubscriptionManager> {
  // Step 1: Get user address from Phase 1 identity
  const userAddress = await invoke<string>('get_user_address');

  // Step 2: Initialize cache
  const cache = new SubscriptionCache({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: 72 * 60 * 60 * 1000, // 72 hours
  });
  await cache.initialize();

  // Step 3: Initialize overlay client
  const overlayClient = new OverlayClient({
    baseUrl: 'https://overlay.bsvblockchain.org',
    topic: 'EDWINPAI',
  });

  // Step 4: Initialize SPV verifier
  const spvVerifier = new SpvVerifier({
    // SPV configuration
  });

  // Step 5: Create subscription manager
  const subscriptionManager = await createSubscriptionManager({
    userAddress,
    overlayClient,
    cache,
    spvVerifier,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
  });

  await subscriptionManager.initialize();

  return subscriptionManager;
}
```

---

### Step 3: Integrate BRC-42 Key Derivation

**File:** `src-tauri/src/subscription.rs`

```rust
use crate::identity::Brc42Deriver;

impl SubscriptionManager {
    /// Derive subscription-specific key using Phase 1 BRC-42 implementation
    pub fn derive_subscription_key(
        identity_key: &[u8; 32],
        key_id: &str,
    ) -> Result<[u8; 32], SubscriptionError> {
        // Use Phase 1 BRC-42 deriver
        let deriver = Brc42Deriver::new();

        // Protocol ID format: "edwinpai subscription {key_id}"
        let invoice_number = format!("edwinpai subscription {}", key_id);

        let derived_key = deriver
            .derive_private_key(identity_key, &invoice_number, None)
            .map_err(|e| SubscriptionError::ConfigError(e.to_string()))?;

        Ok(derived_key)
    }
}
```

**Integration Point:** Reuses Phase 1's `Brc42Deriver` for consistent key derivation.

---

### Step 4: Integrate SPV Verification

**File:** `subscription-manager.ts`

```typescript
import { SpvVerifier } from './implementation_spv';

class SubscriptionManager {
  private async verifySubscription(
    utxos: SubscriptionUtxo[]
  ): Promise<SpvVerificationResult> {
    const utxoWithProof = utxos.find(utxo => utxo.merkleProof);

    if (!utxoWithProof || !utxoWithProof.merkleProof) {
      return { isValid: false, error: 'No merkle proof available' };
    }

    // Call Phase 1 SPV verifier
    const result = await this.config.spvVerifier.verify({
      txid: utxoWithProof.txid,
      merkleProof: utxoWithProof.merkleProof,
      blockHeight: utxoWithProof.blockHeight,
    });

    return result;
  }
}
```

**Integration Point:** Uses Phase 1's `SpvVerifier` for BEEF proof validation.

---

### Step 5: Integrate Overlay Client

**File:** `subscription-manager.ts`

```typescript
class SubscriptionManager {
  private async queryOverlay(): Promise<SubscriptionStatus> {
    // Query overlay services using Phase 1 client
    const lookupResult = await this.config.overlayClient.lookupSubscription(
      this.config.userAddress
    );

    if (!lookupResult.success || lookupResult.utxos.length === 0) {
      return this.buildStatus('overlay', []);
    }

    // Verify subscription with SPV
    const verification = await this.verifySubscription(lookupResult.utxos);

    // Update state machine
    this.stateMachine.verifySubscription(verification, lookupResult.utxos);

    // Cache the result
    await this.config.cache.set(
      this.config.userAddress,
      lookupResult.utxos,
      verification
    );

    return this.buildStatus('overlay', lookupResult.utxos, verification);
  }
}
```

---

### Step 6: Unify Cache Directory Structure

**File:** `subscription-cache.ts`

```typescript
import * as path from 'path';
import * as os from 'os';

export class SubscriptionCache {
  private getCachePath(): string {
    // Use Phase 1's cache directory convention
    const homeDir = os.homedir();
    const edwinpaiDir = path.join(homeDir, '.edwinpai');

    // Ensure directory exists
    if (!fs.existsSync(edwinpaiDir)) {
      fs.mkdirSync(edwinpaiDir, { recursive: true, mode: 0o700 });
    }

    return path.join(edwinpaiDir, 'subscription_cache.json');
  }
}
```

**Directory Structure:**
```
~/.edwinpai/
├── subscription_cache.json    (Phase 2)
├── identity/
│   └── keys.json              (Phase 1)
└── audit_log.json             (Phase 1)
```

---

## IPC Setup and Configuration

### Tauri Command Registration

**File:** `src-tauri/src/main.rs`

```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Phase 1 commands
            generate_identity,
            get_user_address,

            // Phase 2 commands
            get_subscription_status,
            refresh_subscription,
            initiate_payment,
            submit_payment,
            reset_subscription,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### IPC Command Definitions

**File:** `types_contracts/ipc.ts`

```typescript
export const IPC_COMMANDS = {
  // Phase 1 commands
  GET_USER_ADDRESS: 'get_user_address',
  GENERATE_IDENTITY: 'generate_identity',

  // Phase 2 commands
  GET_SUBSCRIPTION_STATUS: 'get_subscription_status',
  REFRESH_SUBSCRIPTION: 'refresh_subscription',
  INITIATE_PAYMENT: 'initiate_payment',
  SUBMIT_PAYMENT: 'submit_payment',
  RESET_SUBSCRIPTION: 'reset_subscription',
} as const;

export const IPC_EVENTS = {
  // Phase 2 events
  SUBSCRIPTION_STATE_CHANGED: 'subscription:state_changed',
  SUBSCRIPTION_STATUS_UPDATED: 'subscription:status_updated',
  PAYMENT_SUBMITTED: 'subscription:payment_submitted',
  PAYMENT_CONFIRMED: 'subscription:payment_confirmed',
  GRACE_PERIOD_STARTED: 'subscription:grace_period_started',
  SUBSCRIPTION_EXPIRED: 'subscription:expired',
} as const;
```

### Rust Command Implementations

**File:** `src-tauri/src/commands/subscription.rs`

```rust
use tauri::State;
use crate::subscription::{SubscriptionManager, SubscriptionStatus};

#[tauri::command]
pub async fn get_subscription_status(
    manager: State<'_, SubscriptionManager>,
) -> Result<SubscriptionStatus, String> {
    manager
        .check_subscription()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn refresh_subscription(
    manager: State<'_, SubscriptionManager>,
) -> Result<SubscriptionStatus, String> {
    // Invalidate cache
    manager.invalidate_cache().await.ok();

    // Fresh check
    manager
        .check_subscription()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn submit_payment(
    manager: State<'_, SubscriptionManager>,
    raw_tx: String,
) -> Result<PaymentResult, String> {
    manager
        .submit_payment(&raw_tx)
        .await
        .map_err(|e| e.to_string())
}
```

### TypeScript IPC Wrapper

**File:** `hooks/useSubscription.tsx`

```typescript
import { invoke, listen } from '@tauri-apps/api';
import { IPC_COMMANDS, IPC_EVENTS } from '../types_contracts/ipc';

export function useSubscription(config: UseSubscriptionConfig) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);

  const refresh = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const result = forceRefresh
        ? await invoke<SubscriptionStatus>(IPC_COMMANDS.REFRESH_SUBSCRIPTION)
        : await invoke<SubscriptionStatus>(IPC_COMMANDS.GET_SUBSCRIPTION_STATUS);

      setStatus(result);
      setLastRefresh(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to real-time events
  useEffect(() => {
    const unlisten = listen<SubscriptionStatus>(
      IPC_EVENTS.SUBSCRIPTION_STATUS_UPDATED,
      (event) => {
        setStatus(event.payload);
      }
    );

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return { status, refresh, /* ... */ };
}
```

---

## Code Examples

### Example 1: Complete Integration Flow

```typescript
// src/App.tsx
import { useEffect } from 'react';
import { initializeSubscriptionSystem } from './lib/subscription-setup';
import { useSubscription } from './hooks/useSubscription';

function App() {
  const [subscriptionManager, setSubscriptionManager] = useState(null);

  // Initialize on mount
  useEffect(() => {
    async function init() {
      const manager = await initializeSubscriptionSystem();
      setSubscriptionManager(manager);
    }
    init();
  }, []);

  // Use subscription hook
  const { status, refresh, submitPayment } = useSubscription({
    userAddress: subscriptionManager?.config.userAddress,
  });

  return (
    <div>
      {status?.state === 'Active' && (
        <p>Subscription active until {new Date(status.expiresAt).toLocaleDateString()}</p>
      )}
      {status?.state === 'NotFound' && (
        <SubscriptionSetup onComplete={refresh} />
      )}
    </div>
  );
}
```

### Example 2: Payment Flow Integration

```typescript
// components/SubscriptionSetup.tsx
import { invoke } from '@tauri-apps/api';
import { IPC_COMMANDS } from '../types_contracts/ipc';

async function handlePayment(plan: SubscriptionPlan) {
  try {
    // Step 1: Initiate payment (creates transaction)
    const paymentRequest = await invoke<PaymentRequest>(
      IPC_COMMANDS.INITIATE_PAYMENT,
      {
        planId: plan.id,
        amountSatoshis: plan.costSatoshis,
      }
    );

    // Step 2: Submit payment (broadcast to network)
    const result = await invoke<PaymentResult>(
      IPC_COMMANDS.SUBMIT_PAYMENT,
      {
        rawTx: paymentRequest.rawTx,
      }
    );

    if (result.success) {
      console.log('Payment submitted:', result.txid);
      // State machine automatically updates to "Pending"
    }
  } catch (error) {
    console.error('Payment failed:', error);
  }
}
```

### Example 3: State Machine Integration

```typescript
// subscription-manager.ts
import { SubscriptionStateMachine, StateEvent } from './subscription-state-machine';

class SubscriptionManager {
  private stateMachine: SubscriptionStateMachine;

  async querySubscription(): Promise<SubscriptionStatus> {
    const result = await this.queryOverlay();

    if (result.source === 'overlay' && result.utxos.length > 0) {
      // Trigger state machine transition
      this.stateMachine.dispatch(StateEvent.VerificationSucceeded, {
        verification: result.verification,
        utxos: result.utxos,
        expiresAt: result.utxos[0].expiresAt,
      });
    } else {
      // Fallback to cache
      const cached = await this.queryCacheOnly();
      if (this.isCacheExpired(cached)) {
        this.stateMachine.dispatch(StateEvent.GracePeriodExceeded);
      }
    }

    return this.stateMachine.getStatus();
  }
}
```

---

## Error Handling Patterns

### Pattern 1: Graceful Degradation

```typescript
async querySubscription(): Promise<SubscriptionStatus> {
  // Try overlay services first
  try {
    const result = await this.queryOverlay();
    if (result.source === 'overlay') {
      return result;
    }
  } catch (error) {
    console.warn('[SubscriptionManager] Overlay query failed:', error);
    // Don't throw, continue to cache fallback
  }

  // Fallback to cache
  try {
    return await this.queryCacheOnly();
  } catch (error) {
    console.error('[SubscriptionManager] Cache query failed:', error);
    // Return default "NotFound" state
    return this.buildStatus('none', []);
  }
}
```

### Pattern 2: Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const status = await retryWithBackoff(() =>
  subscriptionManager.querySubscription()
);
```

### Pattern 3: Error Type Conversion

```rust
// Convert Phase 1 errors to Phase 2 errors
impl From<IdentityError> for SubscriptionError {
    fn from(err: IdentityError) -> Self {
        match err {
            IdentityError::KeyDerivationFailed(msg) => {
                SubscriptionError::ConfigError(format!("Identity error: {}", msg))
            }
            _ => SubscriptionError::ConfigError(err.to_string()),
        }
    }
}

impl From<OverlayError> for SubscriptionError {
    fn from(err: OverlayError) -> Self {
        match err {
            OverlayError::NetworkError(msg) => {
                SubscriptionError::NetworkError(msg)
            }
            OverlayError::ServiceUnavailable => {
                SubscriptionError::GatewayUnavailable
            }
            _ => SubscriptionError::NetworkError(err.to_string()),
        }
    }
}
```

---

## Testing Integration

### Integration Test Setup

**File:** `__tests__/integration/subscription-integration.test.ts`

```typescript
import { invoke } from '@tauri-apps/api';
import { initializeSubscriptionSystem } from '../../lib/subscription-setup';

describe('Subscription Integration', () => {
  let subscriptionManager;

  beforeAll(async () => {
    // Mock Phase 1 identity
    jest.spyOn(invoke, 'invoke').mockImplementation((cmd) => {
      if (cmd === 'get_user_address') {
        return Promise.resolve('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      }
    });

    subscriptionManager = await initializeSubscriptionSystem();
  });

  test('should initialize with Phase 1 identity', async () => {
    expect(subscriptionManager.config.userAddress).toBe(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
    );
  });

  test('should query subscription using overlay client', async () => {
    const status = await subscriptionManager.querySubscription();
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('source');
  });

  test('should fallback to cache when overlay unavailable', async () => {
    // Simulate network failure
    jest.spyOn(subscriptionManager.config.overlayClient, 'lookupSubscription')
      .mockRejectedValue(new Error('Network error'));

    const status = await subscriptionManager.querySubscription();
    expect(status.source).toBe('cache');
  });
});
```

### End-to-End Test

```typescript
describe('E2E: Payment Flow', () => {
  test('complete payment submission flow', async () => {
    // 1. Check initial state (should be NotFound)
    const initialStatus = await invoke('get_subscription_status');
    expect(initialStatus.state).toBe('NotFound');

    // 2. Initiate payment
    const paymentRequest = await invoke('initiate_payment', {
      planId: 'basic-monthly',
      amountSatoshis: 10000,
    });
    expect(paymentRequest).toHaveProperty('rawTx');

    // 3. Submit payment
    const result = await invoke('submit_payment', {
      rawTx: paymentRequest.rawTx,
    });
    expect(result.success).toBe(true);
    expect(result.txid).toBeDefined();

    // 4. Verify state changed to Pending
    const pendingStatus = await invoke('get_subscription_status');
    expect(pendingStatus.state).toBe('Pending');

    // 5. Simulate confirmation (in real scenario, wait for blockchain)
    // State should transition to Active after confirmation
  });
});
```

---

## Troubleshooting

### Issue 1: User Address Not Available

**Symptom:** `SubscriptionManager` initialization fails with "User address undefined"

**Solution:**
```typescript
// Ensure Phase 1 identity is initialized first
async function initializeApp() {
  // MUST initialize identity before subscription
  const identityManager = await initializeIdentityManager();
  const userAddress = await identityManager.getUserAddress();

  if (!userAddress) {
    throw new Error('Identity not initialized');
  }

  const subscriptionManager = await initializeSubscriptionSystem();
  // ...
}
```

### Issue 2: SPV Verification Fails

**Symptom:** Subscription shows "NotFound" even with valid payment

**Debugging:**
```typescript
// Enable verbose logging
const verification = await spvVerifier.verify({
  txid,
  merkleProof,
  blockHeight,
  debug: true, // Enable debug output
});

console.log('Verification result:', verification);
// Check:
// - Is merkleProof valid?
// - Is blockHeight correct?
// - Is merkle root matching?
```

### Issue 3: Cache Not Persisting

**Symptom:** Subscription state resets on app restart

**Solution:**
```typescript
// Verify cache directory permissions
import * as fs from 'fs';
import * as path from 'path';

const edwinpaiDir = path.join(os.homedir(), '.edwinpai');
if (!fs.existsSync(edwinpaiDir)) {
  fs.mkdirSync(edwinpaiDir, { recursive: true, mode: 0o700 });
}

// Ensure cache file is writable
const cachePath = path.join(edwinpaiDir, 'subscription_cache.json');
fs.accessSync(cachePath, fs.constants.W_OK);
```

### Issue 4: IPC Command Not Found

**Symptom:** `Error: Command "get_subscription_status" not found`

**Solution:**
```rust
// Verify command is registered in src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_subscription_status,  // ← Must be listed here
            refresh_subscription,
            // ...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Next Steps

After completing integration:

1. **Run Integration Tests:** `npm test -- --testPathPattern=integration`
2. **Test Payment Flow:** Use testnet for payment submission
3. **Verify State Transitions:** Monitor state machine events
4. **Check Cache Persistence:** Restart app and verify state retained
5. **Production Deployment:** Follow [PHASE2_MIGRATION_GUIDE.md](PHASE2_MIGRATION_GUIDE.md)

---

## References

- [Phase 2 Completion Manifest](PHASE2_COMPLETION_MANIFEST.md)
- [Type Contract Manifest](TYPE_CONTRACT_MANIFEST.md)
- [Subscription Implementation Complete](SUBSCRIPTION_IMPLEMENTATION_COMPLETE.md)
- [Test Suite Summary](TEST_SUITE_SUMMARY.md)

---

**Document Status:** Complete
**Last Updated:** 2026-02-10
**Maintained By:** EdwinPAI Development Team
