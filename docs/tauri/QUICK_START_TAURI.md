# Quick Start Guide - Tauri Subscription Commands

Fast reference for integrating subscription management into EdwinPAI Desktop.

## Installation

```bash
# 1. Install Tauri CLI
npm install -g @tauri-apps/cli

# 2. Install frontend dependencies
npm install @tauri-apps/api

# 3. Build Rust backend
cd src-tauri
cargo build
```

## Basic Setup (Frontend)

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

// Initialize subscription manager
await invoke('initialize_subscription_manager', {
  payload: {
    user_address: 'your-bsv-address'
  }
});

// Check subscription
const status = await invoke('check_subscription', { forceRefresh: false });

// Listen for changes
listen('subscription-status-changed', (event) => {
  console.log('Status:', event.payload);
});
```

## Essential Commands

| Command | Purpose | Network | Cache |
|---------|---------|---------|-------|
| `check_subscription(force_refresh)` | Get subscription status | ✓ | ✓ |
| `get_subscription_status()` | Get cached status only | ✗ | ✓ |
| `authorize_spend(payload)` | Show payment dialog | ✗ | ✗ |
| `invalidate_subscription_cache()` | Clear cache | ✗ | ✗ |

## Response Format

```typescript
interface SubscriptionStatusResponse {
  state: 'uninitialized' | 'checking' | 'active' | 'expired' | 'payment_pending';
  expires_at?: number;      // Unix timestamp
  utxo_id?: string;         // "txid:vout"
  last_checked?: number;    // Unix timestamp
  error_message?: string;
}
```

## Common Patterns

### Check if User Has Active Subscription

```typescript
const status = await invoke('check_subscription');
const isActive = status.state === 'active';
```

### Payment Authorization

```typescript
const authorized = await invoke('authorize_spend', {
  payload: {
    amount: 100000,  // 0.001 BSV
    recipient: 'payment-address',
    description: '1 Month Subscription'
  }
});

if (authorized) {
  // Broadcast transaction
  // Invalidate cache
  await invoke('invalidate_subscription_cache');
}
```

### Offline Mode

```typescript
// Use cached status (instant, no network)
const status = await invoke('get_subscription_status');

if (status.state === 'active') {
  // Allow access with cached proof
} else {
  // Require network verification
  await invoke('check_subscription', { forceRefresh: true });
}
```

### Event Listening

```typescript
// Status changes
listen('subscription-status-changed', (event) => {
  updateUI(event.payload);
});

// Errors
listen('subscription-error', (event) => {
  showError(event.payload.message);
});
```

## State Transitions

```
Uninitialized → Checking → Active
                            ↓
                         Cached (offline, <72h)
                            ↓
                         Expired (offline, >72h)
```

## Troubleshooting

### Manager Not Initialized
```
Error: "Subscription manager not initialized"
Solution: Call initialize_subscription_manager() first
```

### Network Errors
```
Error: "Failed to check subscription: network error"
Solution: Check internet connection or use get_subscription_status()
```

### Grace Period Exceeded
```
State: "expired"
Solution: User must reconnect to network for verification
```

## Configuration

### Cache Location
Default: `~/.edwinpai/subscription_cache.json`

Custom:
```typescript
await invoke('initialize_subscription_manager', {
  payload: {
    user_address: 'address',
    cache_path: '/custom/path/cache.json'
  }
});
```

### Grace Period
- **Duration:** 72 hours
- **Configured in:** `src-tauri/subscription_manager.rs`
- **Change:** Modify `SubscriptionManagerConfig::default()`

## React Hook (Copy-Paste Ready)

```typescript
function useSubscription(userAddress: string) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await invoke('initialize_subscription_manager', {
        payload: { user_address: userAddress }
      });

      listen('subscription-status-changed', (e) => setStatus(e.payload));

      const initial = await invoke('check_subscription');
      setStatus(initial);
      setLoading(false);
    })();
  }, [userAddress]);

  return { status, loading };
}
```

## Common Mistakes

❌ **Don't:**
```typescript
// Calling check_subscription too frequently
setInterval(() => invoke('check_subscription'), 1000); // BAD
```

✅ **Do:**
```typescript
// Use cached status for frequent checks
setInterval(() => invoke('get_subscription_status'), 1000); // Good

// Network verification every 5 minutes
setInterval(() => invoke('check_subscription', { forceRefresh: true }), 300000);
```

---

❌ **Don't:**
```typescript
// Ignoring authorization response
await invoke('authorize_spend', { payload });
// Always proceeds regardless of user choice
```

✅ **Do:**
```typescript
const response = await invoke('authorize_spend', { payload });
if (response.authorized) {
  // Only proceed if authorized
}
```

## Testing Checklist

- [ ] Initialize manager successfully
- [ ] Check subscription returns valid state
- [ ] Cached status works offline
- [ ] Authorize spend shows dialog
- [ ] Events are emitted correctly
- [ ] Grace period behavior correct
- [ ] Error handling works

## File Locations

- **Commands:** `src-tauri/commands.rs`
- **Manager:** `src-tauri/subscription_manager.rs`
- **Types:** `types_contracts/subscription-types.rs`
- **Config:** `src-tauri/tauri.conf.json`
- **Examples:** `examples/tauri-subscription-integration.ts`

## Need Help?

See full documentation: `TAURI_BACKEND_IMPLEMENTATION.md`
