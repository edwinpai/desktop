/**
 * Overlay Services Client
 *
 * Implements BSV Overlay Services integration for EdwinPAI subscription verification.
 * Based on: qmd://edwinpai-ux/sources/github-com/overlay-services/
 *
 * Key Features:
 * - Topic Manager lookup for subscription UTXOs
 * - Arcade broadcast integration for transaction submission
 * - HTTP retry logic with exponential backoff
 * - Circuit breaker pattern for fault tolerance
 */

import { SpvVerificationResult } from './types_contracts/spv';
import { SubscriptionState } from './types_contracts/subscription';

// ============================================================================
// Type Definitions
// ============================================================================

export interface OverlayConfig {
  /** Base URL for the Overlay Services endpoint (OCI or custom) */
  overlayUrl: string;
  /** Arcade API endpoint for broadcast */
  arcadeUrl: string;
  /** Topic ID for EdwinPAI subscriptions (EDWINPAI_SUBS topic) */
  subscriptionTopicId: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Max retry attempts for failed requests */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds */
  initialBackoffMs?: number;
}

export interface TopicManagerQuery {
  topicId: string;
  query: {
    /** Find UTXOs for a specific user address */
    address?: string;
    /** Filter by transaction ID */
    txid?: string;
    /** Custom query parameters */
    [key: string]: any;
  };
}

export interface SubscriptionUtxo {
  txid: string;
  vout: number;
  amount: number;
  lockingScript: string;
  /** Subscription expiry timestamp (Unix seconds) */
  expiresAt: number;
  /** User's payment address */
  userAddress: string;
  /** Merkle proof for SPV verification */
  merkleProof?: string;
  /** Block height where UTXO was confirmed */
  blockHeight?: number;
}

export interface LookupResult {
  success: boolean;
  utxos: SubscriptionUtxo[];
  /** Overlay Services metadata */
  metadata?: {
    topicId: string;
    lookupTimestamp: number;
    cacheHit?: boolean;
  };
  error?: string;
}

export interface BroadcastResult {
  success: boolean;
  txid?: string;
  error?: string;
  /** Arcade-specific response data */
  arcadeResponse?: any;
}

// ============================================================================
// Overlay Services Client
// ============================================================================

export class OverlayClient {
  private config: Required<OverlayConfig>;
  private circuitOpen: boolean = false;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;

  /** Circuit breaker threshold: open after 5 consecutive failures */
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  /** Circuit breaker cooldown: 60 seconds */
  private readonly CIRCUIT_BREAKER_COOLDOWN_MS = 60000;

  constructor(config: OverlayConfig) {
    this.config = {
      overlayUrl: config.overlayUrl,
      arcadeUrl: config.arcadeUrl,
      subscriptionTopicId: config.subscriptionTopicId,
      timeout: config.timeout || 10000,
      maxRetries: config.maxRetries || 3,
      initialBackoffMs: config.initialBackoffMs || 500,
    };
  }

  // --------------------------------------------------------------------------
  // Topic Manager Lookup
  // --------------------------------------------------------------------------

  /**
   * Query Topic Manager for subscription UTXOs.
   * Implements exponential backoff retry logic.
   */
  async lookupSubscription(userAddress: string): Promise<LookupResult> {
    if (this.isCircuitOpen()) {
      return {
        success: false,
        utxos: [],
        error: 'Circuit breaker open - service temporarily unavailable',
      };
    }

    const query: TopicManagerQuery = {
      topicId: this.config.subscriptionTopicId,
      query: { address: userAddress },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeLookup(query);
        this.recordSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          const delayMs = this.calculateBackoff(attempt);
          await this.sleep(delayMs);
        }
      }
    }

    this.recordFailure();
    return {
      success: false,
      utxos: [],
      error: `Lookup failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
    };
  }

  /**
   * Execute a single lookup request against the Overlay Services API.
   */
  private async executeLookup(query: TopicManagerQuery): Promise<LookupResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.overlayUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        utxos: this.parseUtxoResponse(data),
        metadata: {
          topicId: query.topicId,
          lookupTimestamp: Date.now(),
          cacheHit: data.cacheHit,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Parse Overlay Services response into SubscriptionUtxo format.
   */
  private parseUtxoResponse(data: any): SubscriptionUtxo[] {
    if (!Array.isArray(data.outputs)) {
      return [];
    }

    return data.outputs.map((output: any) => ({
      txid: output.txid,
      vout: output.vout,
      amount: output.satoshis,
      lockingScript: output.lockingScript,
      expiresAt: output.expiresAt,
      userAddress: output.userAddress,
      merkleProof: output.merkleProof,
      blockHeight: output.blockHeight,
    }));
  }

  // --------------------------------------------------------------------------
  // Arcade Broadcast Integration
  // --------------------------------------------------------------------------

  /**
   * Broadcast a transaction via Arcade.
   * Used for subscription payments and renewals.
   */
  async broadcast(rawTx: string): Promise<BroadcastResult> {
    if (this.isCircuitOpen()) {
      return {
        success: false,
        error: 'Circuit breaker open - service temporarily unavailable',
      };
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeBroadcast(rawTx);
        this.recordSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          const delayMs = this.calculateBackoff(attempt);
          await this.sleep(delayMs);
        }
      }
    }

    this.recordFailure();
    return {
      success: false,
      error: `Broadcast failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
    };
  }

  /**
   * Execute a single broadcast request to Arcade.
   */
  private async executeBroadcast(rawTx: string): Promise<BroadcastResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.arcadeUrl}/tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rawTx }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        txid: data.txid,
        arcadeResponse: data,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Circuit Breaker Logic
  // --------------------------------------------------------------------------

  private isCircuitOpen(): boolean {
    if (!this.circuitOpen) {
      return false;
    }

    // Check if cooldown period has elapsed
    const now = Date.now();
    if (now - this.lastFailureTime > this.CIRCUIT_BREAKER_COOLDOWN_MS) {
      this.circuitOpen = false;
      this.failureCount = 0;
      return false;
    }

    return true;
  }

  private recordSuccess(): void {
    this.failureCount = 0;
    this.circuitOpen = false;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpen = true;
    }
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Calculate exponential backoff delay with jitter.
   */
  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.config.initialBackoffMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
    return Math.min(exponentialDelay + jitter, 10000); // Cap at 10s
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check: test connectivity to overlay services.
   */
  async healthCheck(): Promise<{ overlay: boolean; arcade: boolean }> {
    const overlayHealth = await this.checkEndpoint(this.config.overlayUrl);
    const arcadeHealth = await this.checkEndpoint(this.config.arcadeUrl);

    return {
      overlay: overlayHealth,
      arcade: arcadeHealth,
    };
  }

  private async checkEndpoint(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an OverlayClient with default production configuration.
 * For Phase 2 MVP, hardcodes OCI endpoint per phase1-synthesis-summary.md.
 */
export function createOverlayClient(config?: Partial<OverlayConfig>): OverlayClient {
  const defaultConfig: OverlayConfig = {
    overlayUrl: config?.overlayUrl || 'https://overlay.bsvblockchain.org',
    arcadeUrl: config?.arcadeUrl || 'https://arcade.bsvblockchain.org',
    subscriptionTopicId: config?.subscriptionTopicId || 'EDWINPAI_SUBS_v1',
    ...config,
  };

  return new OverlayClient(defaultConfig);
}
