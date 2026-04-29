/**
 * Subscription System Integration Example
 *
 * Demonstrates how to integrate the overlay services client, cache layer,
 * state machine, and subscription manager into an application.
 *
 * This example shows:
 * 1. System initialization
 * 2. Subscription status checking
 * 3. Payment submission
 * 4. State change monitoring
 * 5. Graceful shutdown
 */

import { createOverlayClient, OverlayClient } from './overlay-services-client';
import { createSubscriptionCache, SubscriptionCache } from './subscription-cache';
import {
  createSubscriptionManager,
  SubscriptionManager,
  SubscriptionAPI,
} from './subscription-manager';
import { createSpvVerifier, SpvVerifier } from './implementation_spv';
import { SubscriptionState } from './subscription-state-machine';

// ============================================================================
// Configuration
// ============================================================================

interface EdwinPAIConfig {
  userAddress: string;
  overlayUrl?: string;
  arcadeUrl?: string;
  redisUrl?: string;
  offlineMode?: boolean;
}

// ============================================================================
// Application Integration
// ============================================================================

export class EdwinPAISubscriptionService {
  private overlayClient: OverlayClient;
  private cache: SubscriptionCache;
  private spvVerifier: SpvVerifier;
  private manager!: SubscriptionManager;
  private api!: SubscriptionAPI;
  private initialized: boolean = false;

  constructor(private config: EdwinPAIConfig) {
    // Initialize components
    this.overlayClient = createOverlayClient({
      overlayUrl: config.overlayUrl,
      arcadeUrl: config.arcadeUrl,
      subscriptionTopicId: 'EDWINPAI_SUBS_v1',
    });

    this.cache = new SubscriptionCache({
      redisUrl: config.redisUrl,
      ttl: 72 * 60 * 60 * 1000, // 72 hours
    });

    this.spvVerifier = createSpvVerifier();
  }

  /**
   * Initialize the subscription service.
   * Must be called before using other methods.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize cache (connects to Redis or falls back to memory)
    await this.cache.initialize();

    // Create subscription manager
    this.manager = await createSubscriptionManager({
      userAddress: this.config.userAddress,
      overlayClient: this.overlayClient,
      cache: this.cache,
      spvVerifier: this.spvVerifier,
      refreshInterval: 5 * 60 * 1000, // 5 minutes
      offlineMode: this.config.offlineMode,
    });

    // Create high-level API
    this.api = new SubscriptionAPI(this.manager);

    // Set up state change listener
    this.setupStateChangeListener();

    this.initialized = true;
    console.log('[EdwinPAISubscription] Service initialized');
  }

  /**
   * Check if user has an active subscription.
   */
  async hasActiveSubscription(): Promise<boolean> {
    this.ensureInitialized();
    return this.api.isActive();
  }

  /**
   * Get subscription status with user-friendly message.
   */
  async getStatus(): Promise<{
    active: boolean;
    message: string;
    daysRemaining?: number;
  }> {
    this.ensureInitialized();
    return this.api.getStatus();
  }

  /**
   * Submit a new subscription payment.
   */
  async subscribe(rawTx: string): Promise<{ success: boolean; message: string }> {
    this.ensureInitialized();
    return this.api.subscribe(rawTx);
  }

  /**
   * Manually refresh subscription status.
   */
  async refresh(): Promise<void> {
    this.ensureInitialized();
    await this.api.refresh();
  }

  /**
   * Get detailed subscription context (for debugging).
   */
  getDetailedContext() {
    this.ensureInitialized();
    return {
      state: this.manager.getStateContext(),
      cache: this.manager.getCacheStats(),
    };
  }

  /**
   * Enable/disable offline mode.
   */
  setOfflineMode(enabled: boolean): void {
    this.ensureInitialized();
    this.manager.setOfflineMode(enabled);
  }

  /**
   * Gracefully shutdown the service.
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    await this.manager.shutdown();
    this.initialized = false;
    console.log('[EdwinPAISubscription] Service shut down');
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private setupStateChangeListener(): void {
    this.manager.onStateChange((oldState, newState, context) => {
      console.log(`[EdwinPAISubscription] State changed: ${oldState} → ${newState}`);

      // Emit events for UI updates
      this.emitStateChangeEvent(newState, context);
    });
  }

  private emitStateChangeEvent(state: SubscriptionState, context: any): void {
    // In a real app, this would emit to event bus or update UI
    const event = new CustomEvent('subscription-state-change', {
      detail: { state, context },
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EdwinPAISubscriptionService not initialized. Call initialize() first.');
    }
  }
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example 1: Basic initialization and status check
 */
export async function example1_basicUsage() {
  const service = new EdwinPAISubscriptionService({
    userAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    redisUrl: 'redis://localhost:6379',
  });

  await service.initialize();

  // Check subscription status
  const status = await service.getStatus();
  console.log('Subscription status:', status);

  // Check if active
  const isActive = await service.hasActiveSubscription();
  console.log('Is active:', isActive);

  await service.shutdown();
}

/**
 * Example 2: Submit a subscription payment
 */
export async function example2_submitPayment() {
  const service = new EdwinPAISubscriptionService({
    userAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  });

  await service.initialize();

  // User creates and signs transaction (handled by wallet layer)
  const rawTx = '01000000...'; // Signed transaction hex

  // Submit payment
  const result = await service.subscribe(rawTx);
  console.log('Payment result:', result);

  if (result.success) {
    console.log('Payment submitted successfully!');
    console.log('Waiting for confirmation...');

    // Status will update automatically via periodic refresh
    setTimeout(async () => {
      const status = await service.getStatus();
      console.log('Updated status:', status);
    }, 60000); // Check after 1 minute
  }

  await service.shutdown();
}

/**
 * Example 3: Monitor state changes
 */
export async function example3_stateMonitoring() {
  const service = new EdwinPAISubscriptionService({
    userAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  });

  await service.initialize();

  // Listen for state changes
  if (typeof window !== 'undefined') {
    window.addEventListener('subscription-state-change', ((event: CustomEvent) => {
      console.log('State changed:', event.detail);

      // Update UI based on new state
      switch (event.detail.state) {
        case SubscriptionState.Active:
          console.log('✓ Subscription is now active!');
          break;
        case SubscriptionState.Expiring:
          console.log('⚠ Subscription expiring soon - please renew');
          break;
        case SubscriptionState.Expired:
          console.log('✗ Subscription expired - please subscribe');
          break;
      }
    }) as EventListener);
  }

  // Service will automatically refresh and emit events
  // Keep running...
}

/**
 * Example 4: Offline mode
 */
export async function example4_offlineMode() {
  const service = new EdwinPAISubscriptionService({
    userAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    offlineMode: false, // Start online
  });

  await service.initialize();

  // Check status online
  const onlineStatus = await service.getStatus();
  console.log('Online status:', onlineStatus);

  // Switch to offline mode (uses cache only)
  service.setOfflineMode(true);

  // Check status offline (from cache)
  const offlineStatus = await service.getStatus();
  console.log('Offline status:', offlineStatus);

  // Cache is valid for 72 hours
  console.log('Cache stats:', service.getDetailedContext().cache);

  await service.shutdown();
}

/**
 * Example 5: Integration with EdwinPAI desktop app
 */
export async function example5_edwinpaiIntegration() {
  // Get user address from wallet
  const userAddress = getUserAddressFromWallet();

  // Initialize subscription service
  const subscriptionService = new EdwinPAISubscriptionService({
    userAddress,
    overlayUrl: 'https://overlay.bsvblockchain.org',
    arcadeUrl: 'https://arcade.bsvblockchain.org',
    redisUrl: process.env.REDIS_URL,
  });

  await subscriptionService.initialize();

  // Check subscription before allowing app features
  const hasSubscription = await subscriptionService.hasActiveSubscription();

  if (!hasSubscription) {
    // Show subscription prompt
    showSubscriptionPrompt();

    // Wait for user to subscribe
    const rawTx = await promptUserToSubscribe();

    // Submit payment
    const result = await subscriptionService.subscribe(rawTx);

    if (!result.success) {
      showError(result.message);
      return;
    }
  }

  // Enable EdwinPAI features
  enableEdwinPAIFeatures();

  // Set up periodic status checks
  setInterval(async () => {
    const status = await subscriptionService.getStatus();

    if (status.daysRemaining && status.daysRemaining <= 7) {
      // Show renewal reminder
      showRenewalReminder(status.daysRemaining);
    }
  }, 60 * 60 * 1000); // Check every hour
}

// Stub functions for example 5
function getUserAddressFromWallet(): string {
  return '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
}
function showSubscriptionPrompt(): void {}
async function promptUserToSubscribe(): Promise<string> {
  return '01000000...';
}
function showError(message: string): void {}
function enableEdwinPAIFeatures(): void {}
function showRenewalReminder(days: number): void {}
