/**
 * Tauri Subscription Integration Example
 *
 * Demonstrates how to use the Rust backend subscription commands from the TypeScript frontend.
 * This shows the complete integration between the Tauri IPC layer and the subscription system.
 *
 * Reference: src-tauri/commands.rs, src-tauri/subscription_manager.rs
 */

import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

// ============================================================================
// Type Definitions (matching Rust types)
// ============================================================================

interface SubscriptionStatusResponse {
  state: 'uninitialized' | 'checking' | 'active' | 'expired' | 'payment_pending' | 'error';
  expires_at?: number; // Unix timestamp
  utxo_id?: string;
  last_checked?: number;
  fiat_equivalent?: string;
  error_message?: string;
}

interface InitializeSubscriptionManagerPayload {
  user_address: string;
  cache_path?: string;
}

interface AuthorizeSpendPayload {
  amount: number; // Satoshis
  recipient: string;
  description?: string;
}

interface AuthorizeSpendResponse {
  authorized: boolean;
  user_cancelled?: boolean;
}

// ============================================================================
// Subscription Service Wrapper
// ============================================================================

/**
 * TypeScript wrapper for Rust subscription commands
 */
export class SubscriptionService {
  private initialized = false;
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Initialize the subscription manager backend
   */
  async initialize(userAddress: string, cachePath?: string): Promise<void> {
    const payload: InitializeSubscriptionManagerPayload = {
      user_address: userAddress,
      cache_path: cachePath,
    };

    try {
      await invoke('initialize_subscription_manager', { payload });
      this.initialized = true;
      console.log('Subscription manager initialized');

      // Setup event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize subscription manager:', error);
      throw error;
    }
  }

  /**
   * Check subscription status with optional force refresh
   */
  async checkSubscription(forceRefresh = false): Promise<SubscriptionStatusResponse> {
    if (!this.initialized) {
      throw new Error('Subscription manager not initialized');
    }

    try {
      const status = await invoke<SubscriptionStatusResponse>('check_subscription', {
        forceRefresh,
      });

      console.log('Subscription status:', status);
      return status;
    } catch (error) {
      console.error('Failed to check subscription:', error);
      throw error;
    }
  }

  /**
   * Get cached subscription status (offline-friendly)
   */
  async getCachedStatus(): Promise<SubscriptionStatusResponse> {
    if (!this.initialized) {
      throw new Error('Subscription manager not initialized');
    }

    try {
      const status = await invoke<SubscriptionStatusResponse>('get_subscription_status');
      return status;
    } catch (error) {
      console.error('Failed to get cached status:', error);
      throw error;
    }
  }

  /**
   * Authorize a spend with native confirmation dialog
   */
  async authorizeSpend(
    amount: number,
    recipient: string,
    description?: string
  ): Promise<boolean> {
    const payload: AuthorizeSpendPayload = {
      amount,
      recipient,
      description,
    };

    try {
      const response = await invoke<AuthorizeSpendResponse>('authorize_spend', { payload });
      return response.authorized;
    } catch (error) {
      console.error('Failed to authorize spend:', error);
      throw error;
    }
  }

  /**
   * Invalidate subscription cache (after payment)
   */
  async invalidateCache(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Subscription manager not initialized');
    }

    try {
      await invoke('invalidate_subscription_cache');
      console.log('Subscription cache invalidated');
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
      throw error;
    }
  }

  /**
   * Get subscription manager health
   */
  async getHealth(): Promise<any> {
    try {
      const health = await invoke('get_subscription_health');
      return health;
    } catch (error) {
      console.error('Failed to get health:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for backend events
   */
  private setupEventListeners(): void {
    // Listen for subscription status changes
    listen<SubscriptionStatusResponse>('subscription-status-changed', (event) => {
      console.log('Subscription status changed:', event.payload);
      this.emit('status-changed', event.payload);
    });

    // Listen for state changes
    listen('subscription-state-changed', (event) => {
      console.log('Subscription state changed:', event.payload);
      this.emit('state-changed', event.payload);
    });

    // Listen for errors
    listen('subscription-error', (event) => {
      console.error('Subscription error:', event.payload);
      this.emit('error', event.payload);
    });

    // Listen for spend authorization events
    listen('spend-authorization', (event) => {
      console.log('Spend authorization:', event.payload);
      this.emit('spend-authorized', event.payload);
    });
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Emit event to registered listeners
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }
}

// ============================================================================
// React Hook Example
// ============================================================================

/**
 * React hook for subscription management
 */
export function useSubscription(userAddress: string) {
  const [status, setStatus] = React.useState<SubscriptionStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const subscriptionService = React.useRef(new SubscriptionService());

  React.useEffect(() => {
    async function init() {
      try {
        await subscriptionService.current.initialize(userAddress);

        // Setup event listeners
        subscriptionService.current.on('status-changed', (newStatus: SubscriptionStatusResponse) => {
          setStatus(newStatus);
        });

        subscriptionService.current.on('error', (err: any) => {
          setError(err.message);
        });

        // Initial status check
        const initialStatus = await subscriptionService.current.checkSubscription();
        setStatus(initialStatus);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [userAddress]);

  const refreshStatus = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const newStatus = await subscriptionService.current.checkSubscription(forceRefresh);
      setStatus(newStatus);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const authorizePayment = async (amount: number, recipient: string, description?: string) => {
    try {
      const authorized = await subscriptionService.current.authorizeSpend(
        amount,
        recipient,
        description
      );
      return authorized;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  return {
    status,
    loading,
    error,
    refreshStatus,
    authorizePayment,
    service: subscriptionService.current,
  };
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example 1: Basic initialization and status check
 */
export async function example1_basicUsage() {
  const service = new SubscriptionService();

  // Initialize with user address
  await service.initialize('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

  // Check subscription status
  const status = await service.checkSubscription();

  if (status.state === 'active') {
    console.log('Subscription is active');
    console.log('Expires at:', new Date(status.expires_at! * 1000));
  } else if (status.state === 'uninitialized') {
    console.log('No subscription found - show payment UI');
  }
}

/**
 * Example 2: Authorization flow with confirmation
 */
export async function example2_paymentAuthorization() {
  const service = new SubscriptionService();
  await service.initialize('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

  // Request payment authorization
  const amount = 100000; // 0.001 BSV in satoshis
  const recipient = 'subscription-payment-address';
  const description = 'EdwinPAI Desktop - 1 Month Subscription';

  const authorized = await service.authorizeSpend(amount, recipient, description);

  if (authorized) {
    console.log('User authorized payment');

    // Proceed with payment
    // ... broadcast transaction via overlay services ...

    // Invalidate cache after payment
    await service.invalidateCache();

    // Refresh status
    await service.checkSubscription(true);
  } else {
    console.log('User cancelled payment');
  }
}

/**
 * Example 3: React component integration
 */
export function SubscriptionStatus({ userAddress }: { userAddress: string }) {
  const { status, loading, error, refreshStatus, authorizePayment } = useSubscription(userAddress);

  if (loading) {
    return <div>Checking subscription...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!status) {
    return <div>No subscription data</div>;
  }

  const handleSubscribe = async () => {
    const amount = 100000; // Example amount
    const recipient = 'subscription-address';
    const authorized = await authorizePayment(amount, recipient, '1 Month Subscription');

    if (authorized) {
      // Handle successful authorization
      console.log('Payment authorized');
    }
  };

  return (
    <div>
      <h2>Subscription Status</h2>
      <p>State: {status.state}</p>
      {status.expires_at && (
        <p>Expires: {new Date(status.expires_at * 1000).toLocaleDateString()}</p>
      )}
      {status.utxo_id && <p>UTXO: {status.utxo_id}</p>}

      {status.state === 'uninitialized' && (
        <button onClick={handleSubscribe}>Subscribe Now</button>
      )}

      <button onClick={() => refreshStatus(true)}>Refresh Status</button>
    </div>
  );
}

/**
 * Example 4: Offline mode handling
 */
export async function example4_offlineMode() {
  const service = new SubscriptionService();
  await service.initialize('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

  // Listen for state changes
  service.on('status-changed', (status: SubscriptionStatusResponse) => {
    if (status.error_message?.includes('cached')) {
      console.log('Operating in offline mode using cached subscription');
      // Show offline indicator in UI
    }
  });

  // Get cached status first (instant, no network)
  const cachedStatus = await service.getCachedStatus();
  console.log('Cached status:', cachedStatus);

  // Then attempt network verification
  try {
    const liveStatus = await service.checkSubscription();
    console.log('Live status:', liveStatus);
  } catch (error) {
    console.log('Network unavailable, using cached status');
  }
}

/**
 * Example 5: Complete subscription lifecycle
 */
export async function example5_completeLifecycle() {
  const service = new SubscriptionService();

  // 1. Initialize
  await service.initialize('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

  // 2. Check initial status
  let status = await service.checkSubscription();
  console.log('Initial status:', status.state);

  // 3. If not subscribed, request payment
  if (status.state === 'uninitialized') {
    const authorized = await service.authorizeSpend(
      100000,
      'payment-address',
      '1 Month Subscription'
    );

    if (authorized) {
      // 4. Broadcast transaction (would integrate with overlay services)
      // ... transaction broadcast logic ...

      // 5. Invalidate cache
      await service.invalidateCache();

      // 6. Poll for confirmation
      const checkInterval = setInterval(async () => {
        const newStatus = await service.checkSubscription(true);

        if (newStatus.state === 'active') {
          console.log('Subscription activated!');
          clearInterval(checkInterval);
        }
      }, 5000); // Check every 5 seconds
    }
  }

  // 7. Monitor for expiration
  service.on('status-changed', (newStatus: SubscriptionStatusResponse) => {
    if (newStatus.state === 'expired') {
      console.log('Subscription expired - show renewal UI');
    }
  });
}

// Export singleton instance for convenience
export const subscriptionService = new SubscriptionService();
