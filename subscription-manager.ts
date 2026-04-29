/**
 * Subscription Manager
 *
 * Orchestrates subscription verification for EdwinPAI desktop application.
 * Integrates: Overlay Client, Cache Layer, State Machine, and SPV Verification.
 *
 * Key Features:
 * - Query overlay services with cache fallback
 * - Automatic state transitions based on verification results
 * - Periodic refresh to detect state changes
 * - Integration with SPV verification layer
 * - Graceful degradation for offline scenarios
 *
 * Architecture:
 * ┌─────────────────────────────────────────┐
 * │      Subscription Manager               │
 * ├─────────────────────────────────────────┤
 * │  ┌──────────┐  ┌──────────┐  ┌────────┐│
 * │  │ Overlay  │→ │  Cache   │→ │  SPV   ││
 * │  │  Client  │  │  Layer   │  │ Verify ││
 * │  └──────────┘  └──────────┘  └────────┘│
 * │         ↓            ↓            ↓     │
 * │  ┌─────────────────────────────────┐   │
 * │  │      State Machine              │   │
 * │  └─────────────────────────────────┘   │
 * └─────────────────────────────────────────┘
 */

import { OverlayClient, SubscriptionUtxo, LookupResult } from './overlay-services-client';
import { SubscriptionCache, CachedSubscription } from './subscription-cache';
import {
  SubscriptionStateMachine,
  SubscriptionState,
  StateContext,
  StateChangeListener,
} from './subscription-state-machine';
import { SpvVerificationResult } from './types_contracts/spv';
import { SpvVerifier } from './implementation_spv'; // Import from SPV implementation

// ============================================================================
// Configuration
// ============================================================================

export interface SubscriptionManagerConfig {
  /** User's payment address */
  userAddress: string;
  /** Overlay client instance */
  overlayClient: OverlayClient;
  /** Cache instance */
  cache: SubscriptionCache;
  /** SPV verifier instance */
  spvVerifier: SpvVerifier;
  /** Auto-refresh interval (milliseconds, default: 5 minutes) */
  refreshInterval?: number;
  /** Enable offline mode (cache-only) */
  offlineMode?: boolean;
}

export interface SubscriptionStatus {
  /** Current state */
  state: SubscriptionState;
  /** Whether subscription is active (Active or Expiring) */
  isActive: boolean;
  /** Expiry timestamp (Unix seconds) */
  expiresAt?: number;
  /** Days until expiry */
  daysUntilExpiry?: number;
  /** Verification result */
  verification?: SpvVerificationResult;
  /** Source of data (overlay, cache, or none) */
  source: 'overlay' | 'cache' | 'none';
  /** Last update timestamp */
  lastUpdated: number;
}

// ============================================================================
// Subscription Manager
// ============================================================================

export class SubscriptionManager {
  private config: Required<Omit<SubscriptionManagerConfig, 'offlineMode'>> & {
    offlineMode: boolean;
  };
  private stateMachine: SubscriptionStateMachine;
  private refreshTimer?: NodeJS.Timeout;
  private isRefreshing: boolean = false;

  constructor(config: SubscriptionManagerConfig) {
    this.config = {
      userAddress: config.userAddress,
      overlayClient: config.overlayClient,
      cache: config.cache,
      spvVerifier: config.spvVerifier,
      refreshInterval: config.refreshInterval || 5 * 60 * 1000, // 5 minutes
      offlineMode: config.offlineMode || false,
    };

    this.stateMachine = new SubscriptionStateMachine(config.userAddress);
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Initialize subscription manager.
   * Loads cached state and starts periodic refresh.
   */
  async initialize(): Promise<void> {
    // Try to restore state from cache
    const cached = await this.config.cache.get(this.config.userAddress);
    if (cached && this.config.cache.isCacheValid(cached)) {
      await this.restoreFromCache(cached);
    }

    // Perform initial verification
    await this.refresh();

    // Start periodic refresh
    this.startPeriodicRefresh();
  }

  private async restoreFromCache(cached: CachedSubscription): Promise<void> {
    // Restore state machine from cached data
    const expiresAt = this.calculateExpiry(cached.utxos);

    if (cached.verification?.isValid && expiresAt) {
      const now = Date.now() / 1000;

      if (now < expiresAt) {
        // Subscription still valid
        this.stateMachine.verifySubscription(cached.verification, cached.utxos);

        // Check if in grace period
        const daysUntilExpiry = (expiresAt - now) / (24 * 60 * 60);
        if (daysUntilExpiry <= 7) {
          this.stateMachine.startGracePeriod();
        }
      } else {
        // Subscription expired
        this.stateMachine.expire();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Query and Verification
  // --------------------------------------------------------------------------

  /**
   * Query subscription status with cache fallback.
   * Priority: Overlay → Cache → None
   */
  async querySubscription(): Promise<SubscriptionStatus> {
    // If offline mode, use cache only
    if (this.config.offlineMode) {
      return this.queryCacheOnly();
    }

    // Try overlay services first
    try {
      const result = await this.queryOverlay();
      if (result.source === 'overlay') {
        return result;
      }
    } catch (error) {
      console.warn('[SubscriptionManager] Overlay query failed:', error);
    }

    // Fallback to cache
    return this.queryCacheOnly();
  }

  /**
   * Query overlay services and verify subscription.
   */
  private async queryOverlay(): Promise<SubscriptionStatus> {
    const lookupResult = await this.config.overlayClient.lookupSubscription(
      this.config.userAddress
    );

    if (!lookupResult.success || lookupResult.utxos.length === 0) {
      // No subscription found
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

  /**
   * Query cache-only (offline mode or overlay failure).
   */
  private async queryCacheOnly(): Promise<SubscriptionStatus> {
    const cached = await this.config.cache.get(this.config.userAddress);

    if (cached && this.config.cache.isCacheValid(cached)) {
      return this.buildStatus('cache', cached.utxos, cached.verification);
    }

    // No cached data available
    return this.buildStatus('none', []);
  }

  /**
   * Verify subscription UTXOs using SPV.
   */
  private async verifySubscription(
    utxos: SubscriptionUtxo[]
  ): Promise<SpvVerificationResult> {
    // Find UTXO with merkle proof
    const utxoWithProof = utxos.find(utxo => utxo.merkleProof);

    if (!utxoWithProof || !utxoWithProof.merkleProof) {
      return {
        isValid: false,
        error: 'No merkle proof available',
        txid: utxos[0]?.txid,
      };
    }

    // Verify using SPV verifier from implementation_spv
    try {
      const result = await this.config.spvVerifier.verify({
        txid: utxoWithProof.txid,
        merkleProof: utxoWithProof.merkleProof,
        blockHeight: utxoWithProof.blockHeight,
      });

      return result;
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
        txid: utxoWithProof.txid,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Periodic Refresh
  // --------------------------------------------------------------------------

  /**
   * Start periodic refresh to detect state changes.
   */
  private startPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(async () => {
      await this.refresh();
    }, this.config.refreshInterval);
  }

  /**
   * Manually refresh subscription status.
   */
  async refresh(): Promise<SubscriptionStatus> {
    if (this.isRefreshing) {
      // Prevent concurrent refreshes
      return this.getStatus();
    }

    this.isRefreshing = true;

    try {
      const status = await this.querySubscription();

      // Check for state transitions
      this.checkStateTransitions(status);

      return status;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Check if state transitions are needed based on current status.
   */
  private checkStateTransitions(status: SubscriptionStatus): void {
    const currentState = this.stateMachine.getState();

    // Check for expiration
    if (status.expiresAt) {
      const now = Date.now() / 1000;

      if (now >= status.expiresAt && currentState !== SubscriptionState.Expired) {
        this.stateMachine.expire();
      } else if (status.daysUntilExpiry && status.daysUntilExpiry <= 7) {
        if (currentState === SubscriptionState.Active) {
          this.stateMachine.startGracePeriod();
        }
      }
    }

    // Check if subscription became invalid
    if (
      !status.isActive &&
      currentState !== SubscriptionState.Unsubscribed &&
      currentState !== SubscriptionState.Expired
    ) {
      if (status.verification && !status.verification.isValid) {
        this.stateMachine.reset();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Status Management
  // --------------------------------------------------------------------------

  /**
   * Get current subscription status.
   */
  getStatus(): SubscriptionStatus {
    const context = this.stateMachine.getContext();

    return this.buildStatus(
      'none',
      context.utxos,
      context.verification,
      context.expiresAt
    );
  }

  /**
   * Build subscription status from current data.
   */
  private buildStatus(
    source: 'overlay' | 'cache' | 'none',
    utxos: SubscriptionUtxo[],
    verification?: SpvVerificationResult,
    expiresAt?: number
  ): SubscriptionStatus {
    const context = this.stateMachine.getContext();
    const expiry = expiresAt || this.calculateExpiry(utxos);

    let daysUntilExpiry: number | undefined;
    if (expiry) {
      const now = Date.now() / 1000;
      daysUntilExpiry = Math.max(0, (expiry - now) / (24 * 60 * 60));
    }

    return {
      state: context.state,
      isActive: this.stateMachine.isActive(),
      expiresAt: expiry,
      daysUntilExpiry,
      verification,
      source,
      lastUpdated: context.lastUpdated,
    };
  }

  /**
   * Check if user has an active subscription.
   */
  async hasActiveSubscription(): Promise<boolean> {
    const status = await this.querySubscription();
    return status.isActive;
  }

  // --------------------------------------------------------------------------
  // Payment Submission
  // --------------------------------------------------------------------------

  /**
   * Submit a new subscription payment.
   * Broadcasts transaction and updates state.
   */
  async submitPayment(rawTx: string): Promise<{ success: boolean; txid?: string; error?: string }> {
    // Broadcast via Arcade
    const result = await this.config.overlayClient.broadcast(rawTx);

    if (!result.success) {
      return result;
    }

    // Update state machine
    this.stateMachine.submitPayment(result.txid!);

    // Invalidate cache
    await this.config.cache.invalidate(this.config.userAddress);

    // Start polling for confirmation
    this.startConfirmationPolling(result.txid!);

    return result;
  }

  /**
   * Poll for payment confirmation after broadcast.
   */
  private startConfirmationPolling(txid: string): void {
    const pollInterval = 30000; // 30 seconds
    const maxAttempts = 20; // 10 minutes total
    let attempts = 0;

    const pollTimer = setInterval(async () => {
      attempts++;

      const status = await this.querySubscription();

      // Check if payment confirmed
      if (status.state === SubscriptionState.Active) {
        clearInterval(pollTimer);
        return;
      }

      // Stop after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(pollTimer);
        console.warn('[SubscriptionManager] Payment confirmation timeout');
      }
    }, pollInterval);
  }

  // --------------------------------------------------------------------------
  // State Machine Integration
  // --------------------------------------------------------------------------

  /**
   * Register listener for state changes.
   */
  onStateChange(listener: StateChangeListener): () => void {
    return this.stateMachine.onStateChange(listener);
  }

  /**
   * Get current state machine context.
   */
  getStateContext(): Readonly<StateContext> {
    return this.stateMachine.getContext();
  }

  /**
   * Manually trigger state machine reset.
   */
  async resetState(): Promise<void> {
    this.stateMachine.reset();
    await this.config.cache.invalidate(this.config.userAddress);
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Calculate expiry timestamp from UTXOs.
   */
  private calculateExpiry(utxos: SubscriptionUtxo[]): number | undefined {
    if (utxos.length === 0) return undefined;
    return Math.max(...utxos.map(utxo => utxo.expiresAt));
  }

  /**
   * Enable offline mode (cache-only).
   */
  setOfflineMode(enabled: boolean): void {
    this.config.offlineMode = enabled;
  }

  /**
   * Get cache statistics.
   */
  getCacheStats() {
    return this.config.cache.getStats();
  }

  /**
   * Gracefully shutdown manager.
   */
  async shutdown(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.stateMachine.dispose();
    await this.config.cache.shutdown();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and initialize a SubscriptionManager.
 */
export async function createSubscriptionManager(
  config: SubscriptionManagerConfig
): Promise<SubscriptionManager> {
  const manager = new SubscriptionManager(config);
  await manager.initialize();
  return manager;
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Simple API for checking subscription status.
 * Abstracts away manager complexity for basic use cases.
 */
export class SubscriptionAPI {
  constructor(private manager: SubscriptionManager) {}

  /**
   * Check if user has active subscription.
   */
  async isActive(): Promise<boolean> {
    return this.manager.hasActiveSubscription();
  }

  /**
   * Get subscription status with plain-language description.
   */
  async getStatus(): Promise<{
    active: boolean;
    message: string;
    daysRemaining?: number;
  }> {
    const status = await this.manager.querySubscription();

    let message: string;
    let daysRemaining: number | undefined;

    switch (status.state) {
      case SubscriptionState.Unsubscribed:
        message = 'No active subscription. Subscribe to activate EdwinPAI.';
        break;
      case SubscriptionState.Pending:
        message = 'Payment submitted. Waiting for confirmation...';
        break;
      case SubscriptionState.Active:
        daysRemaining = status.daysUntilExpiry
          ? Math.floor(status.daysUntilExpiry)
          : undefined;
        message = `Subscription active. ${daysRemaining ? `${daysRemaining} days remaining.` : ''}`;
        break;
      case SubscriptionState.Expiring:
        daysRemaining = status.daysUntilExpiry
          ? Math.floor(status.daysUntilExpiry)
          : undefined;
        message = `Subscription expiring soon. ${daysRemaining ? `${daysRemaining} days remaining.` : ''} Please renew.`;
        break;
      case SubscriptionState.Expired:
        message = 'Subscription expired. Please renew to continue using EdwinPAI.';
        break;
    }

    return {
      active: status.isActive,
      message,
      daysRemaining,
    };
  }

  /**
   * Subscribe with a new payment.
   */
  async subscribe(rawTx: string): Promise<{ success: boolean; message: string }> {
    const result = await this.manager.submitPayment(rawTx);

    if (!result.success) {
      return {
        success: false,
        message: `Payment failed: ${result.error}`,
      };
    }

    return {
      success: true,
      message: 'Payment submitted. Your subscription will be active once confirmed.',
    };
  }

  /**
   * Manually refresh subscription status.
   */
  async refresh(): Promise<void> {
    await this.manager.refresh();
  }
}
