# EdwinPAI Desktop - Type Contracts

Complete type contract definitions for the subscription system, ensuring frontend-backend type safety.

## Files

### `subscription-types.ts`
**Purpose:** TypeScript type definitions for React frontend

**Exports:**
- `SubscriptionState` - Enum of subscription lifecycle states
- `SubscriptionStatus` - Complete subscription status information
- `SubscriptionError` - Error details with recovery information
- `SubscriptionCommand` - Union type for all IPC commands
- `SubscriptionResponse` - Union type for all IPC responses
- `UseSubscriptionReturn` - React hook return type
- `PaymentDetails` - Payment initiation response
- Type guards: `isActiveSubscription()`, `isExpiredSubscription()`, `needsRenewal()`

### `subscription-types.rs`
**Purpose:** Rust type definitions for Tauri backend

**Exports:**
- `SubscriptionState` - Enum matching TypeScript definition
- `SubscriptionStatus` - Status struct with serialization
- `SubscriptionError` - Error struct with `From` trait implementations
- `SubscriptionCommand` - Command enum with tagged union deserialization
- `SubscriptionResponse` - Response enum with tagged union serialization
- `PaymentDetails` - Payment details struct
- Helper methods: `is_active()`, `is_expired()`, `needs_renewal()`, `validate()`

### `ipc-bridge.ts`
**Purpose:** Type-safe IPC communication layer

**Exports:**
- `IPC_COMMANDS` - Command name constants
- `IPC_EVENTS` - Event name constants
- `SubscriptionIPC` - Type-safe IPC client class
- `IPCError` - IPC-specific error class
- Validation helpers: `validateSubscriptionResponse()`, `validatePaymentDetails()`, `validateSubscriptionStatus()`
- `MockSubscriptionIPC` - Testing mock

## Type Contract Guarantees

### 1. State Consistency
Both TypeScript and Rust define identical subscription states:
```
uninitialized | checking | active | expired | payment_pending | error
```

### 2. Timestamp Format
All timestamps use **Unix seconds** (i64/number):
- `expiresAt` - Subscription expiration
- `lastChecked` - Last status check
- `cachedAt` - Cache timestamp

### 3. Command-Response Pairing
Every command has a matching response type:
- `CheckSubscriptionCommand` → `CheckSubscriptionResponse`
- `InitiatePaymentCommand` → `InitiatePaymentResponse`
- `ConfirmPaymentCommand` → `ConfirmPaymentResponse`
- `CancelPaymentCommand` → `CancelPaymentResponse`

### 4. Error Handling
Errors include:
- `code` - Typed error code for programmatic handling
- `message` - Human-readable error description
- `recoverable` - Whether retry is possible
- `retryAfter` - Optional retry delay in seconds

### 5. Serialization Format
- Rust → TypeScript: `snake_case` → `camelCase` (via `#[serde(rename_all = "camelCase")]`)
- Tagged unions use `type` field for discriminated unions
- Optional fields use `Option<T>` (Rust) / `T | undefined` (TypeScript)

## Usage Examples

### TypeScript (Frontend)
```typescript
import { SubscriptionIPC, IPC_COMMANDS } from './types_contracts/ipc-bridge';
import type { SubscriptionStatus } from './types_contracts/subscription-types';

const ipc = new SubscriptionIPC(invoke);

// Check subscription
const status: SubscriptionStatus = await ipc.checkSubscription(true);

// Initiate payment
const payment = await ipc.initiatePayment(12, 'bitcoin');

// Confirm payment
const newStatus = await ipc.confirmPayment(txid, 0);
```

### Rust (Backend)
```rust
use crate::types_contracts::subscription_types::*;

#[tauri::command]
async fn check_subscription(
    payload: CheckSubscriptionPayload
) -> Result<SubscriptionResponse, String> {
    let status = fetch_subscription_status(payload.force_refresh).await?;

    Ok(SubscriptionResponse::CheckSubscriptionResponse {
        success: true,
        data: Some(status),
        error: None,
    })
}
```

### React Hook
```typescript
import { useSubscription } from './hooks/useSubscription';

function SubscriptionBanner() {
  const {
    status,
    isActive,
    daysRemaining,
    initiatePayment,
    checkSubscription,
  } = useSubscription();

  if (isActive) {
    return <div>Active until {status.expiresAt}</div>;
  }

  return (
    <button onClick={() => initiatePayment(12)}>
      Subscribe Now
    </button>
  );
}
```

## Validation Rules

### Payment Duration
Valid durations: `1`, `3`, `6`, or `12` months
- TypeScript: Enforced by IPC client
- Rust: Validated via `InitiatePaymentPayload::validate()`

### Transaction ID
- Must be 64 characters
- Must be hexadecimal
- Rust: Validated via `ConfirmPaymentPayload::validate()`

### Subscription State Transitions
```
uninitialized → checking → active
                       → expired
                       → error
active → checking → active (renewal)
                → expired (timeout)
payment_pending → active (confirmed)
                → error (failed)
```

## Testing

### Mock IPC Client
```typescript
import { MockSubscriptionIPC } from './types_contracts/ipc-bridge';

const mockIPC = new MockSubscriptionIPC();

mockIPC.setMockResponse('check_subscription', {
  type: 'check_subscription_response',
  success: true,
  data: {
    state: 'active',
    expiresAt: Date.now() / 1000 + 86400 * 30,
  },
});

const status = await mockIPC.checkSubscription();
```

## References

- **Spec:** `qmd://edwinpai-ux/spec.md`
- **Type Contract Manifest:** `qmd://edwinpai-ux/edwinpai-desktop/type-contract-manifest.md`
- **Phase 1 Summary:** `qmd://edwinpai-ux/edwinpai-desktop/phase1-synthesis-summary.md`

## Import Paths

Frontend imports:
```typescript
import type { SubscriptionStatus, UseSubscriptionReturn } from '@/types_contracts/subscription-types';
import { SubscriptionIPC, IPC_COMMANDS } from '@/types_contracts/ipc-bridge';
```

Backend imports:
```rust
use crate::types_contracts::subscription_types::*;
```
