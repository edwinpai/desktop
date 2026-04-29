# Phase 2 Migration Guide

**Document Version:** 1.0
**Generated:** 2026-02-10
**Project:** EdwinPAI Desktop - Subscription System
**Phase:** Phase 2 - Production Deployment and Migration

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Cache Migration Scenarios](#cache-migration-scenarios)
4. [Deployment Procedures](#deployment-procedures)
5. [Rollback Strategies](#rollback-strategies)
6. [Data Migration Scripts](#data-migration-scripts)
7. [Production Checklist](#production-checklist)
8. [Monitoring and Validation](#monitoring-and-validation)

---

## Overview

This guide provides step-by-step procedures for migrating to Phase 2 subscription system and deploying to production. It covers:

- Cache migration from standalone to Redis
- Version upgrade procedures
- Deployment strategies (blue-green, rolling)
- Rollback procedures
- Data integrity validation

**Risk Level:** Low-Medium
**Estimated Migration Time:** 1-3 hours
**Downtime Required:** None (zero-downtime migration supported)

---

## Pre-Migration Checklist

### Environment Preparation

- [ ] **Backup existing data**
  ```bash
  # Backup Phase 1 identity data
  cp -r ~/.edwinpai ~/.edwinpai.backup.$(date +%Y%m%d_%H%M%S)

  # Verify backup integrity
  ls -lah ~/.edwinpai.backup.*
  ```

- [ ] **Verify dependencies installed**
  ```bash
  # Node.js dependencies
  npm install

  # Rust dependencies
  cd src-tauri && cargo check

  # Redis (optional, for production)
  redis-cli ping  # Should return PONG
  ```

- [ ] **Environment variables configured**
  ```bash
  # .env file
  REDIS_URL=redis://localhost:6379
  OVERLAY_URL=https://overlay.bsvblockchain.org
  ARCADE_URL=https://arcade.bsvblockchain.org
  NODE_ENV=production
  ```

- [ ] **Test environment validated**
  ```bash
  # Run all tests
  npm test
  cd src-tauri && cargo test
  ```

- [ ] **Documentation reviewed**
  - [PHASE2_INTEGRATION_GUIDE.md](PHASE2_INTEGRATION_GUIDE.md)
  - [PHASE2_COMPLETION_MANIFEST.md](PHASE2_COMPLETION_MANIFEST.md)
  - [TEST_SUITE_SUMMARY.md](TEST_SUITE_SUMMARY.md)

---

## Cache Migration Scenarios

### Scenario 1: Standalone → Redis Migration

**Use Case:** Upgrading from in-memory cache to Redis for multi-instance support

**Pre-Migration State:**
- Using in-memory cache only
- Single EdwinPAI instance
- Cache lost on app restart

**Post-Migration State:**
- Redis primary cache
- In-memory fallback
- Cache persisted across restarts

#### Migration Steps

**Step 1: Install and Configure Redis**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install redis-server

# macOS
brew install redis

# Start Redis
sudo systemctl start redis-server  # Linux
brew services start redis           # macOS

# Verify Redis running
redis-cli ping  # Should return PONG
```

**Step 2: Configure Redis for Production**

Edit `/etc/redis/redis.conf` (Linux) or `/usr/local/etc/redis.conf` (macOS):

```conf
# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1      # Save after 900s if 1 key changed
save 300 10     # Save after 300s if 10 keys changed
save 60 10000   # Save after 60s if 10000 keys changed

# Security
requirepass your_secure_password_here

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

Restart Redis:
```bash
sudo systemctl restart redis-server  # Linux
brew services restart redis           # macOS
```

**Step 3: Update Application Configuration**

```bash
# .env file
REDIS_URL=redis://:your_secure_password_here@localhost:6379
```

**Step 4: Migrate Existing Cache Data (Optional)**

```typescript
// scripts/migrate-cache-to-redis.ts
import { SubscriptionCache } from './subscription-cache';
import * as fs from 'fs';
import * as path from 'path';

async function migrateCacheToRedis() {
  // Read existing in-memory cache file (if exists)
  const cachePath = path.join(os.homedir(), '.edwinpai', 'subscription_cache.json');

  if (!fs.existsSync(cachePath)) {
    console.log('No existing cache to migrate');
    return;
  }

  const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

  // Initialize Redis-backed cache
  const cache = new SubscriptionCache({
    redisUrl: process.env.REDIS_URL,
    ttl: 72 * 60 * 60 * 1000,
  });
  await cache.initialize();

  // Migrate each entry
  for (const [userAddress, cachedSubscription] of Object.entries(cacheData.entries || {})) {
    // Validate cache entry is not expired
    if (Date.now() < cachedSubscription.expiresAt) {
      await cache.set(
        userAddress,
        cachedSubscription.utxos,
        cachedSubscription.verification
      );
      console.log(`Migrated cache for ${userAddress}`);
    } else {
      console.log(`Skipped expired cache for ${userAddress}`);
    }
  }

  // Rename old cache file
  fs.renameSync(cachePath, `${cachePath}.migrated`);
  console.log('Migration complete');
}

migrateCacheToRedis().catch(console.error);
```

Run migration:
```bash
npx ts-node scripts/migrate-cache-to-redis.ts
```

**Step 5: Restart Application**

```bash
# Application automatically detects Redis and uses it
npm run tauri dev  # Development
npm run tauri build && ./target/release/edwinpai  # Production
```

**Step 6: Verify Migration**

```bash
# Check Redis keys
redis-cli --scan --pattern "edwinpai:subscription:*"

# Check cache stats in application
# (Use SubscriptionManager.getCacheStats())
```

---

### Scenario 2: Version Upgrade with Cache Persistence

**Use Case:** Upgrading EdwinPAI from v1.0 to v2.0 while preserving subscription state

#### Migration Steps

**Step 1: Backup Current Installation**

```bash
# Backup EdwinPAI data directory
cp -r ~/.edwinpai ~/.edwinpai.backup.$(date +%Y%m%d_%H%M%S)

# Backup application binary (if upgrading)
cp /usr/local/bin/edwinpai /usr/local/bin/edwinpai.backup
```

**Step 2: Stop Running Instances**

```bash
# Gracefully shutdown EdwinPAI
pkill -SIGTERM edwinpai

# Verify no EdwinPAI processes running
ps aux | grep edwinpai
```

**Step 3: Upgrade Application**

```bash
# Install new version
npm install
npm run build
cd src-tauri && cargo build --release

# Or install from package manager
sudo apt-get update && sudo apt-get upgrade edwinpai
```

**Step 4: Validate Cache Compatibility**

```typescript
// scripts/validate-cache-version.ts
import * as fs from 'fs';
import * as path from 'path';

interface CacheMetadata {
  version: string;
  lastModified: number;
}

function validateCacheVersion(): boolean {
  const cachePath = path.join(os.homedir(), '.edwinpai', 'subscription_cache.json');

  if (!fs.existsSync(cachePath)) {
    console.log('No cache file exists, safe to proceed');
    return true;
  }

  const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  const version = cacheData.version || '1.0';

  if (version === '1.0') {
    console.log('Cache version 1.0 detected, compatible');
    return true;
  }

  console.warn(`Unknown cache version: ${version}`);
  return false;
}

if (!validateCacheVersion()) {
  console.error('Cache validation failed, manual migration required');
  process.exit(1);
}
```

Run validation:
```bash
npx ts-node scripts/validate-cache-version.ts
```

**Step 5: Start New Version**

```bash
# Start upgraded EdwinPAI
./target/release/edwinpai

# Or via package manager
edwinpai
```

**Step 6: Verify Subscription State Preserved**

```typescript
// In application code or developer console
const status = await subscriptionManager.querySubscription();
console.log('Subscription state:', status.state);
console.log('Cache source:', status.source);

// Should show 'cache' if cached data was used
// Should show 'overlay' if fresh verification occurred
```

---

### Scenario 3: Redis Cluster Migration

**Use Case:** Migrating from single Redis instance to Redis Cluster for high availability

#### Migration Steps

**Step 1: Setup Redis Cluster**

```bash
# Install Redis Cluster (3 master nodes minimum)
# Follow Redis Cluster documentation

# Verify cluster status
redis-cli --cluster check localhost:7000
```

**Step 2: Update Application Configuration**

```typescript
// subscription-cache.ts
import Redis from 'ioredis';

export class SubscriptionCache {
  private redis: Redis.Cluster | null = null;

  async initialize(): Promise<void> {
    if (this.config.redisUrl) {
      // Parse cluster nodes from config
      const clusterNodes = this.config.redisUrl
        .split(',')
        .map(url => {
          const [host, port] = url.replace('redis://', '').split(':');
          return { host, port: parseInt(port) };
        });

      this.redis = new Redis.Cluster(clusterNodes, {
        redisOptions: {
          password: this.config.redisPassword,
        },
      });

      this.redis.on('error', (err) => {
        console.error('[SubscriptionCache] Redis cluster error:', err);
        this.redis = null; // Fallback to memory
      });
    }
  }
}
```

**Step 3: Migrate Data to Cluster**

```bash
# Use redis-cli to migrate keys
redis-cli --cluster import localhost:7000 \
  --cluster-from localhost:6379 \
  --cluster-copy \
  --cluster-replace
```

**Step 4: Update Environment Variables**

```bash
# .env
REDIS_URL=redis://node1:7000,redis://node2:7001,redis://node3:7002
REDIS_PASSWORD=your_cluster_password
```

**Step 5: Restart and Verify**

```bash
# Restart application
systemctl restart edwinpai

# Verify cluster usage
redis-cli --cluster nodes localhost:7000
```

---

### Scenario 4: Offline Operation (No Redis)

**Use Case:** User environment without Redis, fallback to in-memory cache only

#### Configuration

```typescript
// subscription-cache.ts handles this automatically
const cache = new SubscriptionCache({
  redisUrl: undefined, // No Redis URL
  ttl: 72 * 60 * 60 * 1000,
});

await cache.initialize();
// Automatically uses MemoryBackend
```

**Behavior:**
- Cache stored in process memory only
- Cache lost on app restart
- Grace period still enforced (72 hours from last verification)
- Automatic fallback, no configuration required

---

## Deployment Procedures

### Blue-Green Deployment

**Strategy:** Run old and new versions side-by-side, switch traffic atomically

#### Deployment Steps

**Step 1: Prepare Green Environment**

```bash
# Clone current production environment
cp -r /opt/edwinpai /opt/edwinpai-green

# Deploy new version to green
cd /opt/edwinpai-green
git pull origin main
npm install
npm run build
cd src-tauri && cargo build --release
```

**Step 2: Validate Green Environment**

```bash
# Start green environment on different port
cd /opt/edwinpai-green
TAURI_PORT=3001 ./target/release/edwinpai &

# Run health checks
curl http://localhost:3001/health
# Expected: {"status": "ok", "version": "2.0.0"}

# Run integration tests
npm test -- --ci
```

**Step 3: Switch Traffic**

```bash
# Update symlink to point to green
ln -sfn /opt/edwinpai-green /opt/edwinpai-current

# Restart service
systemctl restart edwinpai
```

**Step 4: Monitor**

```bash
# Monitor logs for errors
tail -f /var/log/edwinpai/edwinpai.log

# Check subscription queries succeed
# Use monitoring dashboard or manual testing
```

**Step 5: Rollback if Necessary**

```bash
# Revert symlink to blue
ln -sfn /opt/edwinpai-blue /opt/edwinpai-current
systemctl restart edwinpai
```

---

### Rolling Deployment

**Strategy:** Gradually replace instances one at a time

#### Deployment Steps (Multi-Instance Setup)

**Step 1: Deploy to First Instance**

```bash
# SSH to instance 1
ssh edwinpai-instance-1

# Stop EdwinPAI
systemctl stop edwinpai

# Update code
cd /opt/edwinpai
git pull origin main
npm install
npm run build
cd src-tauri && cargo build --release

# Start EdwinPAI
systemctl start edwinpai

# Verify health
curl http://localhost:3000/health
```

**Step 2: Monitor Instance 1**

```bash
# Check logs for 5-10 minutes
tail -f /var/log/edwinpai/edwinpai.log

# Verify subscription queries working
# Check error rate metrics
```

**Step 3: Deploy to Remaining Instances**

```bash
# Repeat Step 1 for each instance
for instance in edwinpai-instance-{2..5}; do
  ssh $instance "cd /opt/edwinpai && git pull && npm run build && systemctl restart edwinpai"
  sleep 60  # Wait between instances
done
```

---

### Canary Deployment

**Strategy:** Deploy to small percentage of users first

#### Deployment Steps

**Step 1: Deploy to 10% of Users**

```bash
# Configure load balancer to route 10% traffic to new version
# (Implementation depends on load balancer used)

# Update canary instances
for instance in edwinpai-canary-{1..2}; do
  ssh $instance "cd /opt/edwinpai && git pull && npm run build && systemctl restart edwinpai"
done
```

**Step 2: Monitor Metrics**

```bash
# Key metrics to monitor:
# - Subscription verification success rate
# - Cache hit rate
# - Error rate
# - Response time

# Compare canary vs production metrics
./scripts/compare-metrics.sh --canary --production
```

**Step 3: Expand to 50%, then 100%**

```bash
# If metrics look good after 24 hours:
# Increase traffic to 50%
# Wait 24 hours
# Increase to 100%
```

---

## Rollback Strategies

### Rollback Scenario 1: Application Crashes

**Symptoms:**
- EdwinPAI crashes on startup
- Critical errors in logs

**Rollback Procedure:**

```bash
# 1. Stop failing version
systemctl stop edwinpai

# 2. Restore backup binary
cp /usr/local/bin/edwinpai.backup /usr/local/bin/edwinpai

# 3. Restore data directory (if needed)
cp -r ~/.edwinpai.backup.* ~/.edwinpai

# 4. Restart
systemctl start edwinpai

# 5. Verify
curl http://localhost:3000/health
```

---

### Rollback Scenario 2: Cache Corruption

**Symptoms:**
- Subscription state incorrect
- Cache validation errors

**Rollback Procedure:**

```bash
# 1. Stop EdwinPAI
systemctl stop edwinpai

# 2. Clear corrupted cache
rm ~/.edwinpai/subscription_cache.json

# Or clear Redis
redis-cli FLUSHDB

# 3. Restart EdwinPAI (will rebuild cache from overlay services)
systemctl start edwinpai

# 4. Verify subscription state
# Check that subscription is re-verified from overlay services
```

---

### Rollback Scenario 3: Redis Connection Issues

**Symptoms:**
- "Redis unavailable" warnings
- Slow performance

**Rollback Procedure:**

```bash
# 1. Disable Redis in configuration
export REDIS_URL=""

# 2. Restart EdwinPAI (will use in-memory cache)
systemctl restart edwinpai

# 3. Fix Redis issues
redis-cli ping
systemctl status redis-server

# 4. Re-enable Redis when fixed
export REDIS_URL="redis://localhost:6379"
systemctl restart edwinpai
```

---

## Data Migration Scripts

### Script 1: Cache Validation

**File:** `scripts/validate-cache.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

interface CacheValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  };
}

export async function validateCache(): Promise<CacheValidationResult> {
  const cachePath = path.join(os.homedir(), '.edwinpai', 'subscription_cache.json');
  const result: CacheValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      totalEntries: 0,
      validEntries: 0,
      expiredEntries: 0,
    },
  };

  // Check if cache file exists
  if (!fs.existsSync(cachePath)) {
    result.warnings.push('No cache file exists');
    return result;
  }

  // Read and parse cache
  let cacheData;
  try {
    const rawData = fs.readFileSync(cachePath, 'utf-8');
    cacheData = JSON.parse(rawData);
  } catch (error) {
    result.isValid = false;
    result.errors.push(`Failed to parse cache: ${error.message}`);
    return result;
  }

  // Validate structure
  if (!cacheData.entries || typeof cacheData.entries !== 'object') {
    result.isValid = false;
    result.errors.push('Invalid cache structure: missing entries object');
    return result;
  }

  // Validate each entry
  const now = Date.now();
  for (const [userAddress, entry] of Object.entries(cacheData.entries)) {
    result.stats.totalEntries++;

    // Check required fields
    if (!entry.utxos || !Array.isArray(entry.utxos)) {
      result.errors.push(`Invalid entry for ${userAddress}: missing utxos array`);
      result.isValid = false;
      continue;
    }

    if (!entry.expiresAt || typeof entry.expiresAt !== 'number') {
      result.errors.push(`Invalid entry for ${userAddress}: missing expiresAt`);
      result.isValid = false;
      continue;
    }

    // Check expiration
    if (now >= entry.expiresAt) {
      result.stats.expiredEntries++;
      result.warnings.push(`Entry for ${userAddress} is expired`);
    } else {
      result.stats.validEntries++;
    }
  }

  return result;
}

// Run validation
if (require.main === module) {
  validateCache().then((result) => {
    console.log('Cache Validation Results:');
    console.log('------------------------');
    console.log(`Valid: ${result.isValid}`);
    console.log(`Total Entries: ${result.stats.totalEntries}`);
    console.log(`Valid Entries: ${result.stats.validEntries}`);
    console.log(`Expired Entries: ${result.stats.expiredEntries}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    process.exit(result.isValid ? 0 : 1);
  });
}
```

Run:
```bash
npx ts-node scripts/validate-cache.ts
```

---

### Script 2: Cleanup Expired Cache Entries

**File:** `scripts/cleanup-cache.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

export async function cleanupExpiredCache(): Promise<number> {
  const cachePath = path.join(os.homedir(), '.edwinpai', 'subscription_cache.json');

  if (!fs.existsSync(cachePath)) {
    console.log('No cache file to clean');
    return 0;
  }

  const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  const now = Date.now();
  let removedCount = 0;

  for (const [userAddress, entry] of Object.entries(cacheData.entries)) {
    if (now >= entry.expiresAt) {
      delete cacheData.entries[userAddress];
      removedCount++;
      console.log(`Removed expired entry for ${userAddress}`);
    }
  }

  // Write cleaned cache back
  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
  console.log(`Cleanup complete: removed ${removedCount} expired entries`);

  return removedCount;
}

// Run cleanup
if (require.main === module) {
  cleanupExpiredCache().catch(console.error);
}
```

Run:
```bash
npx ts-node scripts/cleanup-cache.ts
```

---

## Production Checklist

### Pre-Deployment

- [ ] All tests passing (frontend + backend)
- [ ] Integration tests passing
- [ ] Cache validation passed
- [ ] Backup created
- [ ] Environment variables configured
- [ ] Redis installed and configured (if using)
- [ ] Monitoring and logging configured
- [ ] Rollback plan documented

### Deployment

- [ ] Application deployed to staging environment
- [ ] Staging validation passed
- [ ] Blue-green/canary deployment executed
- [ ] Health checks passing
- [ ] Subscription verification working
- [ ] Cache persistence verified

### Post-Deployment

- [ ] Monitor error logs for 24 hours
- [ ] Verify subscription state for existing users
- [ ] Check cache hit rate metrics
- [ ] Performance metrics baseline established
- [ ] User acceptance testing completed
- [ ] Documentation updated
- [ ] Backup old version retained for 7 days

---

## Monitoring and Validation

### Key Metrics to Monitor

1. **Subscription Verification Success Rate**
   ```typescript
   // Log verification attempts
   const successRate = (successfulVerifications / totalVerifications) * 100;
   console.log(`Verification success rate: ${successRate}%`);
   ```

2. **Cache Hit Rate**
   ```typescript
   const stats = cache.getStats();
   const hitRate = (stats.hits / (stats.hits + stats.misses)) * 100;
   console.log(`Cache hit rate: ${hitRate}%`);
   ```

3. **Grace Period Usage**
   ```typescript
   // Monitor how many users are in grace period
   const gracePeriodUsers = subscriptions.filter(
     s => s.state === 'Cached' || s.state === 'Expired'
   ).length;
   ```

4. **Error Rate**
   ```bash
   # Monitor application logs
   tail -f /var/log/edwinpai/edwinpai.log | grep -i error
   ```

### Validation Queries

```bash
# Check Redis key count
redis-cli DBSIZE

# Check specific user's cache
redis-cli GET "edwinpai:subscription:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"

# Monitor Redis memory usage
redis-cli INFO memory

# Check subscription state distribution
# (Custom query in application)
```

---

## References

- [PHASE2_INTEGRATION_GUIDE.md](PHASE2_INTEGRATION_GUIDE.md)
- [PHASE2_COMPLETION_MANIFEST.md](PHASE2_COMPLETION_MANIFEST.md)
- [SUBSCRIPTION_IMPLEMENTATION_COMPLETE.md](SUBSCRIPTION_IMPLEMENTATION_COMPLETE.md)
- [Redis Documentation](https://redis.io/documentation)
- [Tauri Deployment Guide](https://tauri.app/v1/guides/building/)

---

**Document Status:** Complete
**Last Updated:** 2026-02-10
**Maintained By:** EdwinPAI Development Team
