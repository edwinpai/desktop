# Subscription State Machine Specification

**Version:** 1.0
**Last Updated:** 2026-02-10
**Sources:** edwinpai-ux/spec.md, edwinpai-ux/edwinpai-desktop/phase1-handoff-phase2.md

## Overview

The EdwinPAI Desktop subscription system implements a 5-state finite state machine (FSM) to manage subscription lifecycle, verification, and grace period handling. The state machine balances security (regular verification) with user experience (offline grace period).

## State Definitions

### 1. **NotFound**
- **Description:** No subscription UTXO exists for the user's identity
- **UI Behavior:** Display subscription explanation with payment initiation
- **Backend State:** No cached proof exists
- **Next States:** `Active` (after successful payment)

### 2. **Active**
- **Description:** Subscription UTXO verified on-chain within verification interval
- **Verification:** UTXO is unspent and valid
- **Backend State:** Fresh proof from overlay services
- **Cache Behavior:** Store proof with timestamp
- **Next States:** `Cached` (when verification fails but within grace period)

### 3. **Cached**
- **Description:** Using cached subscription proof due to temporary network unavailability
- **Grace Period:** 72 hours from last successful verification
- **UI Indicator:** Show "Using cached subscription" notice
- **Backend State:** Proof loaded from `~/.edwinpai/subscription_cache.json`
- **Next States:**
  - `Active` (when verification succeeds again)
  - `Expired` (when verification fails after grace period)

### 4. **Expired**
- **Description:** Grace period exceeded without successful verification
- **Grace Period:** >72 hours since last verification
- **UI Behavior:** Block feature access, show "Subscription verification failed" error
- **Error Code:** `ERR_SUBSCRIPTION_GRACE_EXCEEDED` (402)
- **Next States:**
  - `Active` (when verification succeeds)
  - `GraceExceeded` (confirmation state before requiring re-subscription)

### 5. **GraceExceeded**
- **Description:** Subscription UTXO spent or permanently unverifiable
- **Verification:** UTXO is spent or does not exist
- **UI Behavior:** Require new subscription purchase
- **Error Code:** `ERR_SUBSCRIPTION_INACTIVE` (402)
- **Next States:** `NotFound` → `Active` (after new payment)

## State Transition Diagram

```
┌─────────────┐
│  NotFound   │ ─────────────────────┐
└─────────────┘                      │
      ▲                              │ Payment creates
      │ Subscription spent           │ subscription UTXO
      │                              ▼
┌─────────────┐                ┌──────────┐
│GraceExceeded│◄───────────────│  Active  │
└─────────────┘   UTXO spent   └──────────┘
      ▲              OR              │ │
      │         Invalid proof        │ │ Verification
      │                              │ │ succeeds again
      │                              │ │
      │                              │ ▼
      │                              │ (stays Active)
      │                              │
      │         Grace period         ▼
      │         exceeded      ┌─────────────┐
      └──────────────────────│   Cached    │
            >72h no          └─────────────┘
            verification           │ │
                                   │ │ Verification
                                   │ │ fails (within
                                   │ │ grace period)
                                   │ │
                                   │ ▼
                                   │ (stays Cached)
                                   │
                                   ▼
                            ┌─────────────┐
                            │   Expired   │
                            └─────────────┘
                                   │
                                   │ Confirm spent
                                   ▼
                            ┌─────────────┐
                            │GraceExceeded│
                            └─────────────┘
```

## Grace Period Timing Logic

### Verification Interval
- **Default:** 1 hour (3600 seconds)
- **Configuration:** Adjustable per deployment
- **Trigger:** Periodic background check + on-demand verification

### Grace Period Calculation
```typescript
interface GracePeriodConfig {
  gracePeriodHours: 72;  // 72 hours = 3 days
  gracePeriodMs: 259200000;  // 72 * 60 * 60 * 1000
}

interface CachedProof {
  txid: string;
  vout: number;
  timestamp: number;  // Unix timestamp (ms) of last successful verification
  proof: object;      // Raw overlay services proof
}

function calculateTimeRemaining(cachedProof: CachedProof): number {
  const now = Date.now();
  const elapsed = now - cachedProof.timestamp;
  const gracePeriodMs = 72 * 60 * 60 * 1000;
  return Math.max(0, gracePeriodMs - elapsed);
}

function isWithinGracePeriod(cachedProof: CachedProof): boolean {
  return calculateTimeRemaining(cachedProof) > 0;
}
```

### State Transition Logic
```typescript
async function determineSubscriptionState(
  identityKey: string,
  cachedProof?: CachedProof
): Promise<SubscriptionState> {

  // Attempt live verification
  const verificationResult = await verifySubscriptionUTXO(identityKey);

  if (verificationResult.success) {
    // Store fresh proof with current timestamp
    await cachePoof({
      txid: verificationResult.txid,
      vout: verificationResult.vout,
      timestamp: Date.now(),
      proof: verificationResult.proof
    });
    return { state: 'Active', txid: verificationResult.txid, vout: verificationResult.vout };
  }

  // Verification failed - check cached proof
  if (!cachedProof) {
    return { state: 'NotFound' };
  }

  // Check grace period
  if (isWithinGracePeriod(cachedProof)) {
    const timeRemaining = calculateTimeRemaining(cachedProof);
    return {
      state: 'Cached',
      txid: cachedProof.txid,
      vout: cachedProof.vout,
      graceTimeRemaining: timeRemaining
    };
  }

  // Grace period exceeded
  // Attempt to confirm UTXO is actually spent
  const utxoStatus = await checkUTXOStatus(cachedProof.txid, cachedProof.vout);

  if (utxoStatus === 'spent' || utxoStatus === 'not_found') {
    return { state: 'GraceExceeded' };
  }

  // Network issue preventing verification but UTXO might still be valid
  return { state: 'Expired' };
}
```

## Cache Storage Format

**File:** `~/.edwinpai/subscription_cache.json`

```json
{
  "version": "1.0",
  "identity_key": "02a1b2c3...",
  "subscription": {
    "txid": "abc123...",
    "vout": 0,
    "timestamp": 1707580800000,
    "proof": {
      "merkleRoot": "...",
      "merklePath": [...],
      "blockHeight": 850000
    }
  },
  "lastVerificationAttempt": 1707584400000,
  "consecutiveFailures": 2
}
```

## Error Codes and UI Mapping

| State | Error Code | HTTP Status | User Message |
|-------|-----------|-------------|--------------|
| NotFound | - | 200 | "To activate EdwinPAI, you need a subscription." |
| Active | - | 200 | No error, full feature access |
| Cached | - | 200 | "Using cached subscription (offline mode)" |
| Expired | `ERR_SUBSCRIPTION_GRACE_EXCEEDED` | 402 | "Subscription verification failed. Please check your connection." |
| GraceExceeded | `ERR_SUBSCRIPTION_INACTIVE` | 402 | "Subscription expired or spent. Please renew." |

## Periodic Verification Strategy

### Background Verification Loop
```typescript
class SubscriptionManager {
  private verificationIntervalMs = 3600000; // 1 hour
  private verificationTimer?: NodeJS.Timer;

  startPeriodicVerification() {
    this.verificationTimer = setInterval(
      async () => {
        const state = await this.checkSubscription();
        await this.updateUIState(state);

        // Alert user if entering Cached state
        if (state.state === 'Cached') {
          this.notifyGracePeriod(state.graceTimeRemaining);
        }
      },
      this.verificationIntervalMs
    );
  }

  stopPeriodicVerification() {
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
    }
  }
}
```

## Security Considerations

1. **Cache Tampering:** Proof cache includes cryptographic proof (Merkle path) that can be independently verified
2. **Time Manipulation:** Grace period calculation uses both local timestamp and blockchain height for validation
3. **Offline Grace Period:** 72-hour window balances user experience with subscription enforcement
4. **UTXO Monitoring:** Active subscriptions should monitor for spending events via webhook or polling

## References

- **Subscription Creation Flow:** edwinpai-ux/spec.md (lines 64-67)
- **State Machine Implementation:** edwinpai-ux/edwinpai-desktop/phase1-handoff-phase2.md (lines 69-72)
- **Error Code Definitions:** edwinpai-ux/spec.md (lines 34-37)
- **Phase 2 Implementation Plan:** edwinpai-ux/edwinpai-desktop/phase2-implementation.md (lines 94-97)
