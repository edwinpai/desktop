/**
 * Subscription types (SPEC §5.6)
 *
 * UTXO-based subscription states and lifecycle.
 */

/**
 * Subscription states per SPEC §5.6:
 *
 * - Active: UTXO unspent, verified within 72h → full operation
 * - Cached: UTXO unspent (last check), offline >0h <72h → full operation, periodic retry
 * - Expired: UTXO spent on-chain → EdwinPAI stops, shows re-subscribe prompt
 * - GraceExceeded: Cannot verify, offline >72h → degraded mode (local-only)
 * - NotFound: No subscription UTXO exists → onboarding prompts subscription setup
 */
export type SubscriptionState =
  | "Active"
  | "Cached"
  | "Expired"
  | "GraceExceeded"
  | "NotFound";

export interface UtxoRef {
  txid: string;
  vout: number;
}

export interface CachedProof {
  txid: string;
  vout: number;
  merkleProof: string;
  blockHeight: number;
  verifiedAt: string;
}

export interface SubscriptionInfo {
  state: SubscriptionState;
  utxo?: UtxoRef;
  verifiedAt?: string;
  cachedProof?: CachedProof;
  graceExpiresAt?: string;
}

export interface SubscriptionStatus {
  state: SubscriptionState;
  /** TXID of the subscription UTXO, if known */
  txid?: string;
  /** Output index of the subscription UTXO */
  vout?: number;
  /** ISO 8601 timestamp of last successful verification */
  verifiedAt?: string;
  /** Whether the current proof is from cache */
  cachedProof: boolean;
  /** Block height at which the UTXO was confirmed */
  blockHeight?: number;
}

/** State behavior matrix */
export const SUBSCRIPTION_BEHAVIORS: Record<
  SubscriptionState,
  { fullOperation: boolean; channelIO: boolean; description: string }
> = {
  Active: {
    fullOperation: true,
    channelIO: true,
    description: "UTXO unspent, verified within 72h",
  },
  Cached: {
    fullOperation: true,
    channelIO: true,
    description: "UTXO unspent (last check), offline <72h",
  },
  Expired: {
    fullOperation: false,
    channelIO: false,
    description: "UTXO spent on-chain",
  },
  GraceExceeded: {
    fullOperation: false,
    channelIO: false,
    description: "Cannot verify, offline >72h",
  },
  NotFound: {
    fullOperation: false,
    channelIO: false,
    description: "No subscription UTXO exists",
  },
} as const;
