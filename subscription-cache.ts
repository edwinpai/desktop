/**
 * Subscription Cache Layer
 *
 * Provides Redis-backed caching with in-memory fallback for offline scenarios.
 * Supports 72-hour TTL for subscription proofs as specified in requirements.
 *
 * Cache Strategy:
 * - Primary: Redis (shared across instances)
 * - Fallback: In-memory Map (process-local)
 * - TTL: 72 hours for subscription state
 * - Eviction: LRU policy for in-memory cache
 */

import { SubscriptionUtxo } from './overlay-services-client';
import { SpvVerificationResult } from './types_contracts/spv';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CacheConfig {
  /** Redis connection URL (e.g., redis://localhost:6379) */
  redisUrl?: string;
  /** TTL for subscription cache entries (milliseconds) */
  ttl?: number;
  /** Max in-memory cache size (entries) */
  maxMemoryEntries?: number;
  /** Enable compression for large cache values */
  compress?: boolean;
}

export interface CachedSubscription {
  utxos: SubscriptionUtxo[];
  verification?: SpvVerificationResult;
  timestamp: number;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  backend: 'redis' | 'memory' | 'offline';
  redisConnected: boolean;
}

// ============================================================================
// Cache Interface
// ============================================================================

export interface ICacheBackend {
  get(key: string): Promise<CachedSubscription | null>;
  set(key: string, value: CachedSubscription, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  isConnected(): boolean;
}

// ============================================================================
// Redis Backend
// ============================================================================

/**
 * Redis cache backend with connection pooling.
 * Uses ioredis for robust Redis integration.
 */
class RedisBackend implements ICacheBackend {
  private client: any; // Redis client (dynamic import)
  private connected: boolean = false;

  constructor(private redisUrl: string) {}

  async connect(): Promise<void> {
    try {
      // Dynamic import to avoid bundling Redis in non-server contexts
      const Redis = (await import('ioredis')).default;

      this.client = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.connected = true;
      });

      this.client.on('error', (error: Error) => {
        console.error('[RedisBackend] Error:', error.message);
        this.connected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('[RedisBackend] Failed to connect:', error);
      this.connected = false;
      throw error;
    }
  }

  async get(key: string): Promise<CachedSubscription | null> {
    if (!this.connected) return null;

    try {
      const value = await this.client.get(key);
      if (!value) return null;

      return JSON.parse(value) as CachedSubscription;
    } catch (error) {
      console.error('[RedisBackend] Get error:', error);
      return null;
    }
  }

  async set(key: string, value: CachedSubscription, ttlMs: number): Promise<void> {
    if (!this.connected) return;

    try {
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, 'PX', ttlMs);
    } catch (error) {
      console.error('[RedisBackend] Set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.error('[RedisBackend] Delete error:', error);
    }
  }

  async clear(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.flushdb();
    } catch (error) {
      console.error('[RedisBackend] Clear error:', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
    }
  }
}

// ============================================================================
// In-Memory Backend (Fallback)
// ============================================================================

/**
 * LRU in-memory cache for offline scenarios.
 * Provides graceful degradation when Redis is unavailable.
 */
class MemoryBackend implements ICacheBackend {
  private cache: Map<string, CachedSubscription> = new Map();
  private accessOrder: string[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  async get(key: string): Promise<CachedSubscription | null> {
    const value = this.cache.get(key);
    if (!value) return null;

    // Check if expired
    if (Date.now() > value.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update LRU order
    this.updateAccessOrder(key);
    return value;
  }

  async set(key: string, value: CachedSubscription, ttlMs: number): Promise<void> {
    // Evict LRU entry if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, value);
    this.updateAccessOrder(key);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
  }

  isConnected(): boolean {
    return true; // Always available
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

// ============================================================================
// Subscription Cache
// ============================================================================

export class SubscriptionCache {
  private redis: RedisBackend | null = null;
  private memory: MemoryBackend;
  private config: Required<CacheConfig>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    entries: 0,
    backend: 'offline',
    redisConnected: false,
  };

  /** Default TTL: 72 hours in milliseconds */
  private readonly DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;

  constructor(config?: CacheConfig) {
    this.config = {
      redisUrl: config?.redisUrl || 'redis://localhost:6379',
      ttl: config?.ttl || this.DEFAULT_TTL_MS,
      maxMemoryEntries: config?.maxMemoryEntries || 1000,
      compress: config?.compress || false,
    };

    this.memory = new MemoryBackend(this.config.maxMemoryEntries);
  }

  /**
   * Initialize Redis connection. Falls back to memory-only if unavailable.
   */
  async initialize(): Promise<void> {
    if (this.config.redisUrl) {
      try {
        this.redis = new RedisBackend(this.config.redisUrl);
        await this.redis.connect();
        this.stats.backend = 'redis';
        this.stats.redisConnected = true;
        console.log('[SubscriptionCache] Redis connected');
      } catch (error) {
        console.warn('[SubscriptionCache] Redis unavailable, using memory fallback');
        this.redis = null;
        this.stats.backend = 'memory';
        this.stats.redisConnected = false;
      }
    } else {
      this.stats.backend = 'memory';
    }
  }

  /**
   * Get cached subscription data for a user address.
   * Tries Redis first, falls back to memory cache.
   */
  async get(userAddress: string): Promise<CachedSubscription | null> {
    const key = this.buildKey(userAddress);

    // Try Redis first
    if (this.redis?.isConnected()) {
      const value = await this.redis.get(key);
      if (value) {
        this.stats.hits++;
        return value;
      }
    }

    // Fallback to memory
    const value = await this.memory.get(key);
    if (value) {
      this.stats.hits++;
      return value;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Cache subscription data with 72-hour TTL.
   * Writes to both Redis and memory for redundancy.
   */
  async set(
    userAddress: string,
    utxos: SubscriptionUtxo[],
    verification?: SpvVerificationResult
  ): Promise<void> {
    const key = this.buildKey(userAddress);
    const now = Date.now();
    const cached: CachedSubscription = {
      utxos,
      verification,
      timestamp: now,
      expiresAt: now + this.config.ttl,
    };

    // Write to both backends
    const promises: Promise<void>[] = [
      this.memory.set(key, cached, this.config.ttl),
    ];

    if (this.redis?.isConnected()) {
      promises.push(this.redis.set(key, cached, this.config.ttl));
    }

    await Promise.all(promises);
    this.stats.entries++;
  }

  /**
   * Invalidate cached subscription for a user.
   */
  async invalidate(userAddress: string): Promise<void> {
    const key = this.buildKey(userAddress);

    const promises: Promise<void>[] = [this.memory.delete(key)];

    if (this.redis?.isConnected()) {
      promises.push(this.redis.delete(key));
    }

    await Promise.all(promises);
  }

  /**
   * Clear all cached subscriptions.
   */
  async clear(): Promise<void> {
    const promises: Promise<void>[] = [this.memory.clear()];

    if (this.redis?.isConnected()) {
      promises.push(this.redis.clear());
    }

    await Promise.all(promises);
    this.stats.entries = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      redisConnected: this.redis?.isConnected() || false,
    };
  }

  /**
   * Check if subscription cache is still valid (not expired).
   */
  isCacheValid(cached: CachedSubscription): boolean {
    return Date.now() < cached.expiresAt;
  }

  /**
   * Gracefully shutdown cache connections.
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
    await this.memory.clear();
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private buildKey(userAddress: string): string {
    return `edwinpai:subscription:${userAddress}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and initialize a SubscriptionCache instance.
 */
export async function createSubscriptionCache(
  config?: CacheConfig
): Promise<SubscriptionCache> {
  const cache = new SubscriptionCache(config);
  await cache.initialize();
  return cache;
}
