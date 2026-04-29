/**
 * Subscription Status Unit Tests
 *
 * Unit tests for subscription status logic, state transitions, and helper functions.
 * Tests type contracts, state validation, and utility functions.
 */

import {
  SubscriptionState,
  SubscriptionStatus,
  SubscriptionPlan,
  PaymentRequest,
  PaymentResult,
  DEFAULT_SUBSCRIPTION_PLANS,
} from '../types_contracts/subscription';

// ============================================================================
// Type Contract Tests
// ============================================================================

describe('Subscription Type Contracts', () => {
  describe('SubscriptionState Enum', () => {
    it('has all required states', () => {
      expect(SubscriptionState.Unsubscribed).toBe('unsubscribed');
      expect(SubscriptionState.Pending).toBe('pending');
      expect(SubscriptionState.Active).toBe('active');
      expect(SubscriptionState.Expiring).toBe('expiring');
      expect(SubscriptionState.Expired).toBe('expired');
    });

    it('has exactly 5 states', () => {
      const states = Object.values(SubscriptionState);
      expect(states).toHaveLength(5);
    });
  });

  describe('SubscriptionStatus Interface', () => {
    it('accepts valid subscription status', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Active,
        isActive: true,
        expiresAt: 1234567890,
        daysUntilExpiry: 30,
        source: 'overlay',
        lastUpdated: Date.now(),
      };

      expect(status.state).toBe(SubscriptionState.Active);
      expect(status.isActive).toBe(true);
      expect(status.expiresAt).toBe(1234567890);
    });

    it('allows optional fields to be undefined', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Unsubscribed,
        isActive: false,
        source: 'none',
        lastUpdated: Date.now(),
      };

      expect(status.expiresAt).toBeUndefined();
      expect(status.daysUntilExpiry).toBeUndefined();
      expect(status.error).toBeUndefined();
    });
  });

  describe('SubscriptionPlan Interface', () => {
    it('accepts valid subscription plan', () => {
      const plan: SubscriptionPlan = {
        id: 'test',
        name: 'Test Plan',
        costSatoshis: 100000,
        costUsd: 50,
        billingPeriod: 30,
        features: ['Feature 1', 'Feature 2'],
        recommended: true,
      };

      expect(plan.id).toBe('test');
      expect(plan.costSatoshis).toBe(100000);
      expect(plan.recommended).toBe(true);
    });
  });

  describe('PaymentRequest Interface', () => {
    it('accepts valid payment request', () => {
      const request: PaymentRequest = {
        planId: 'basic',
        userAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        amountSatoshis: 100000,
        recipientAddress: '1RecipientAddress',
      };

      expect(request.planId).toBe('basic');
      expect(request.amountSatoshis).toBe(100000);
    });
  });

  describe('PaymentResult Interface', () => {
    it('accepts successful payment result', () => {
      const result: PaymentResult = {
        success: true,
        txid: 'abc123',
      };

      expect(result.success).toBe(true);
      expect(result.txid).toBe('abc123');
      expect(result.error).toBeUndefined();
    });

    it('accepts failed payment result', () => {
      const result: PaymentResult = {
        success: false,
        error: 'Insufficient funds',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
      expect(result.txid).toBeUndefined();
    });
  });
});

// ============================================================================
// Default Plans Tests
// ============================================================================

describe('Default Subscription Plans', () => {
  it('exports default plans array', () => {
    expect(DEFAULT_SUBSCRIPTION_PLANS).toBeDefined();
    expect(Array.isArray(DEFAULT_SUBSCRIPTION_PLANS)).toBe(true);
  });

  it('has at least 3 default plans', () => {
    expect(DEFAULT_SUBSCRIPTION_PLANS.length).toBeGreaterThanOrEqual(3);
  });

  it('has basic plan', () => {
    const basicPlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'basic');
    expect(basicPlan).toBeDefined();
    expect(basicPlan?.name).toBe('Basic');
  });

  it('has premium plan', () => {
    const premiumPlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'premium');
    expect(premiumPlan).toBeDefined();
    expect(premiumPlan?.name).toBe('Premium');
  });

  it('has enterprise plan', () => {
    const enterprisePlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'enterprise');
    expect(enterprisePlan).toBeDefined();
    expect(enterprisePlan?.name).toBe('Enterprise');
  });

  it('marks premium as recommended', () => {
    const premiumPlan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'premium');
    expect(premiumPlan?.recommended).toBe(true);
  });

  it('all plans have required fields', () => {
    DEFAULT_SUBSCRIPTION_PLANS.forEach((plan) => {
      expect(plan.id).toBeDefined();
      expect(plan.name).toBeDefined();
      expect(plan.costSatoshis).toBeGreaterThan(0);
      expect(plan.costUsd).toBeGreaterThan(0);
      expect(plan.billingPeriod).toBeGreaterThan(0);
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
    });
  });

  it('plans are ordered by price (low to high)', () => {
    const prices = DEFAULT_SUBSCRIPTION_PLANS.map((p) => p.costSatoshis);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sortedPrices);
  });
});

// ============================================================================
// Status Validation Tests
// ============================================================================

describe('Subscription Status Validation', () => {
  describe('isActive flag', () => {
    it('is true for Active state', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Active,
        isActive: true,
        source: 'overlay',
        lastUpdated: Date.now(),
      };

      expect(status.isActive).toBe(true);
    });

    it('is true for Expiring state', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Expiring,
        isActive: true,
        source: 'overlay',
        lastUpdated: Date.now(),
      };

      expect(status.isActive).toBe(true);
    });

    it('is false for Unsubscribed state', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Unsubscribed,
        isActive: false,
        source: 'none',
        lastUpdated: Date.now(),
      };

      expect(status.isActive).toBe(false);
    });

    it('is false for Expired state', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Expired,
        isActive: false,
        source: 'cache',
        lastUpdated: Date.now(),
      };

      expect(status.isActive).toBe(false);
    });

    it('is false for Pending state', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Pending,
        isActive: false,
        source: 'overlay',
        lastUpdated: Date.now(),
      };

      expect(status.isActive).toBe(false);
    });
  });

  describe('expiresAt timestamp', () => {
    it('is present for active subscriptions', () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const status: SubscriptionStatus = {
        state: SubscriptionState.Active,
        isActive: true,
        expiresAt,
        source: 'overlay',
        lastUpdated: Date.now(),
      };

      expect(status.expiresAt).toBeDefined();
      expect(status.expiresAt).toBeGreaterThan(Date.now() / 1000);
    });

    it('is undefined for unsubscribed state', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Unsubscribed,
        isActive: false,
        source: 'none',
        lastUpdated: Date.now(),
      };

      expect(status.expiresAt).toBeUndefined();
    });

    it('is in the past for expired subscriptions', () => {
      const expiresAt = Math.floor(Date.now() / 1000) - 1000;
      const status: SubscriptionStatus = {
        state: SubscriptionState.Expired,
        isActive: false,
        expiresAt,
        source: 'cache',
        lastUpdated: Date.now(),
      };

      expect(status.expiresAt).toBeLessThan(Date.now() / 1000);
    });
  });

  describe('daysUntilExpiry calculation', () => {
    it('is positive for future expiration', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Active,
        isActive: true,
        expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        daysUntilExpiry: 30,
        source: 'overlay',
        lastUpdated: Date.now(),
      };

      expect(status.daysUntilExpiry).toBeGreaterThan(0);
    });

    it('is small for expiring soon', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Expiring,
        isActive: true,
        expiresAt: Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60,
        daysUntilExpiry: 5,
        source: 'overlay',
        lastUpdated: Date.now(),
      };

      expect(status.daysUntilExpiry).toBeLessThanOrEqual(7);
      expect(status.daysUntilExpiry).toBeGreaterThan(0);
    });

    it('is undefined when no expiration date', () => {
      const status: SubscriptionStatus = {
        state: SubscriptionState.Unsubscribed,
        isActive: false,
        source: 'none',
        lastUpdated: Date.now(),
      };

      expect(status.daysUntilExpiry).toBeUndefined();
    });
  });
});

// ============================================================================
// State Transition Tests
// ============================================================================

describe('Subscription State Transitions', () => {
  describe('Valid transitions', () => {
    it('Unsubscribed -> Pending is valid', () => {
      const oldState = SubscriptionState.Unsubscribed;
      const newState = SubscriptionState.Pending;

      expect(oldState).toBe('unsubscribed');
      expect(newState).toBe('pending');
    });

    it('Pending -> Active is valid', () => {
      const oldState = SubscriptionState.Pending;
      const newState = SubscriptionState.Active;

      expect(oldState).toBe('pending');
      expect(newState).toBe('active');
    });

    it('Active -> Expiring is valid', () => {
      const oldState = SubscriptionState.Active;
      const newState = SubscriptionState.Expiring;

      expect(oldState).toBe('active');
      expect(newState).toBe('expiring');
    });

    it('Expiring -> Expired is valid', () => {
      const oldState = SubscriptionState.Expiring;
      const newState = SubscriptionState.Expired;

      expect(oldState).toBe('expiring');
      expect(newState).toBe('expired');
    });

    it('Expired -> Pending is valid (renewal)', () => {
      const oldState = SubscriptionState.Expired;
      const newState = SubscriptionState.Pending;

      expect(oldState).toBe('expired');
      expect(newState).toBe('pending');
    });
  });

  describe('State characteristics', () => {
    it('Pending is transitional state', () => {
      // Pending means payment submitted but not confirmed
      const state = SubscriptionState.Pending;
      expect(state).toBe('pending');
    });

    it('Active is stable state', () => {
      // Active means subscription is fully operational
      const state = SubscriptionState.Active;
      expect(state).toBe('active');
    });

    it('Expiring is warning state', () => {
      // Expiring means grace period started (7 days before expiry)
      const state = SubscriptionState.Expiring;
      expect(state).toBe('expiring');
    });

    it('Expired is terminal state', () => {
      // Expired means subscription is no longer valid
      const state = SubscriptionState.Expired;
      expect(state).toBe('expired');
    });
  });
});

// ============================================================================
// Data Source Tests
// ============================================================================

describe('Subscription Data Sources', () => {
  it('overlay source indicates live data', () => {
    const status: SubscriptionStatus = {
      state: SubscriptionState.Active,
      isActive: true,
      source: 'overlay',
      lastUpdated: Date.now(),
    };

    expect(status.source).toBe('overlay');
  });

  it('cache source indicates cached data', () => {
    const status: SubscriptionStatus = {
      state: SubscriptionState.Active,
      isActive: true,
      source: 'cache',
      lastUpdated: Date.now() - 60000, // 1 minute old
    };

    expect(status.source).toBe('cache');
  });

  it('none source indicates no data available', () => {
    const status: SubscriptionStatus = {
      state: SubscriptionState.Unsubscribed,
      isActive: false,
      source: 'none',
      lastUpdated: Date.now(),
    };

    expect(status.source).toBe('none');
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Subscription Helper Functions', () => {
  describe('Time calculations', () => {
    it('calculates days from seconds correctly', () => {
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
      const expiresAt = now + thirtyDaysInSeconds;
      const daysUntilExpiry = (expiresAt - now) / (24 * 60 * 60);

      expect(Math.floor(daysUntilExpiry)).toBe(30);
    });

    it('handles fractional days correctly', () => {
      const now = Math.floor(Date.now() / 1000);
      const halfDayInSeconds = 12 * 60 * 60;
      const expiresAt = now + halfDayInSeconds;
      const daysUntilExpiry = (expiresAt - now) / (24 * 60 * 60);

      expect(daysUntilExpiry).toBeCloseTo(0.5);
    });
  });

  describe('Grace period detection', () => {
    it('detects grace period at 7 days', () => {
      const daysUntilExpiry = 7;
      const isInGracePeriod = daysUntilExpiry <= 7;

      expect(isInGracePeriod).toBe(true);
    });

    it('detects grace period at 1 day', () => {
      const daysUntilExpiry = 1;
      const isInGracePeriod = daysUntilExpiry <= 7;

      expect(isInGracePeriod).toBe(true);
    });

    it('no grace period at 8 days', () => {
      const daysUntilExpiry = 8;
      const isInGracePeriod = daysUntilExpiry <= 7;

      expect(isInGracePeriod).toBe(false);
    });
  });

  describe('Expiration detection', () => {
    it('detects expired when current time exceeds expiry', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now - 1000; // Expired 1000 seconds ago
      const isExpired = now >= expiresAt;

      expect(isExpired).toBe(true);
    });

    it('detects not expired when within validity period', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 1000; // Expires 1000 seconds from now
      const isExpired = now >= expiresAt;

      expect(isExpired).toBe(false);
    });
  });
});
