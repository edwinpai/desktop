/**
 * Subscription Type Contracts
 *
 * Type definitions for subscription domain.
 * Used across state machine, manager, and client layers.
 */

export enum SubscriptionState {
  Unsubscribed = 'unsubscribed',
  Pending = 'pending',
  Active = 'active',
  Expiring = 'expiring',
  Expired = 'expired',
}

export interface SubscriptionMetadata {
  /** User's payment address */
  userAddress: string;
  /** Subscription plan tier (basic, premium, enterprise) */
  tier?: string;
  /** Monthly cost in satoshis */
  costSatoshis?: number;
  /** Features enabled for this subscription */
  features?: string[];
}

// ============================================================================
// Frontend-Specific Types
// ============================================================================

/**
 * Subscription status for frontend display
 */
export interface SubscriptionStatus {
  /** Current state */
  state: SubscriptionState;
  /** Whether subscription is active (Active or Expiring) */
  isActive: boolean;
  /** Expiry timestamp (Unix seconds) */
  expiresAt?: number;
  /** Days until expiry */
  daysUntilExpiry?: number;
  /** Source of data (overlay, cache, or none) */
  source: 'overlay' | 'cache' | 'none';
  /** Last update timestamp (milliseconds) */
  lastUpdated: number;
  /** Error message if any */
  error?: string;
  /** User-friendly status message */
  message?: string;
}

/**
 * Subscription plan tier details
 */
export interface SubscriptionPlan {
  /** Plan identifier */
  id: string;
  /** Display name */
  name: string;
  /** Cost in satoshis per month */
  costSatoshis: number;
  /** Cost in fiat equivalent (USD) */
  costUsd: number;
  /** Billing period in days */
  billingPeriod: number;
  /** Features included */
  features: string[];
  /** Whether this is the recommended plan */
  recommended?: boolean;
}

/**
 * Payment request for subscription
 */
export interface PaymentRequest {
  /** Plan being subscribed to */
  planId: string;
  /** User's payment address */
  userAddress: string;
  /** Amount in satoshis */
  amountSatoshis: number;
  /** Recipient address (EdwinPAI subscription service) */
  recipientAddress: string;
}

/**
 * Payment result after broadcast
 */
export interface PaymentResult {
  /** Whether payment was successful */
  success: boolean;
  /** Transaction ID if successful */
  txid?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Subscription UI state
 */
export interface SubscriptionUIState {
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error?: string;
  /** Current status */
  status?: SubscriptionStatus;
  /** Selected plan for purchase */
  selectedPlan?: SubscriptionPlan;
  /** Payment in progress */
  paymentInProgress: boolean;
}

/**
 * Default subscription plans
 */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    costSatoshis: 100000, // ~$50 USD at 50k/BTC
    costUsd: 50,
    billingPeriod: 30,
    features: [
      'Unlimited context reasoning',
      'Local vault access',
      'Desktop application',
      'Basic support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    costSatoshis: 200000, // ~$100 USD at 50k/BTC
    costUsd: 100,
    billingPeriod: 30,
    features: [
      'Unlimited context reasoning',
      'Local vault access',
      'Desktop application',
      'Priority support',
      'Advanced features',
      'Early access to new features',
    ],
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    costSatoshis: 500000, // ~$250 USD at 50k/BTC
    costUsd: 250,
    billingPeriod: 30,
    features: [
      'All Premium features',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'Team collaboration',
      'Advanced analytics',
    ],
  },
];
