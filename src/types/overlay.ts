/**
 * Overlay Services types
 *
 * Based on BSV Overlay Services architecture and UTXO topic management.
 * Sources: https://github.com/bitcoin-sv/overlay-services
 *
 * Overlay services provide topic-based UTXO tracking and state management
 * for decentralized applications (e.g., subscription tracking, channel state).
 */

import type { BeefEnvelope, MerkleProof } from "./spv";

// --- Topic Manager Types ---

/**
 * Overlay topic configuration
 * Topics organize UTXOs by application-specific categories (e.g., "edwinpai-subscriptions")
 */
export interface OverlayTopic {
  /** Topic identifier (e.g., "edwinpai-subscriptions", "edwinpai-channels") */
  topicId: string;
  /** Human-readable description */
  description: string;
  /** Manager endpoint URL (e.g., https://overlay.example.com) */
  managerUrl: string;
  /** Admission rules (script templates, payment requirements) */
  admissionRules?: AdmissionRules;
}

/**
 * Admission rules for topic membership
 */
export interface AdmissionRules {
  /** Required locking script pattern (e.g., OP_RETURN <topic_id> <payload>) */
  scriptPattern?: string;
  /** Minimum satoshi amount */
  minSatoshis?: number;
  /** Maximum satoshi amount */
  maxSatoshis?: number;
  /** Required protocol IDs (BRC-43) */
  requiredProtocols?: string[];
  /** Custom validation rules */
  customValidation?: string;
}

/**
 * Topic manager interface
 * Tracks UTXOs belonging to a specific topic
 */
export interface TopicManager {
  /** Topic configuration */
  topic: OverlayTopic;
  /** Submit BEEF to topic */
  submit: (beef: BeefEnvelope) => Promise<TopicSubmissionResult>;
  /** Query UTXOs in topic */
  query: (filter: UtxoFilter) => Promise<UtxoQueryResult>;
  /** Subscribe to topic updates (SSE) */
  subscribe: (
    callback: (event: TopicEvent) => void,
  ) => Promise<TopicSubscription>;
}

// --- BEEF Submission (Arcade/STEAK pattern) ---

/**
 * Arcade submission request
 * "Arcade" = overlay service submission endpoint
 * "STEAK" = Successful Transmission Evidence Acknowledgement Kit (receipt)
 */
export interface ArcadeSubmission {
  /** Tagged BEEF envelope */
  beef: BeefEnvelope;
  /** Topics to submit to */
  topics: string[];
  /** Submission mode */
  mode: "current-tx" | "historical-tx" | "historical-tx-no-spv";
  /** Off-chain value assignments (for internal accounting) */
  offChainValues?: number[];
}

/**
 * STEAK receipt (proof of submission)
 */
export interface SteakReceipt {
  /** Transaction ID */
  txid: string;
  /** Topics accepted */
  topics: string[];
  /** Timestamp of acceptance (ISO 8601) */
  acceptedAt: string;
  /** Merkle proof (if tx is mined) */
  proof?: MerkleProof;
  /** STEAK signature (overlay manager signature over receipt) */
  signature?: string;
}

/**
 * Topic submission result
 */
export interface TopicSubmissionResult {
  /** Whether submission was accepted */
  accepted: boolean;
  /** STEAK receipt */
  receipt?: SteakReceipt;
  /** Rejection reason */
  rejection?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// --- UTXO Queries ---

/**
 * UTXO filter for topic queries
 */
export interface UtxoFilter {
  /** Script hash (for P2PKH lookups) */
  scriptHash?: string;
  /** Minimum satoshi amount */
  minSatoshis?: number;
  /** Maximum satoshi amount */
  maxSatoshis?: number;
  /** Whether to include spent UTXOs */
  includeSpent?: boolean;
  /** Block height range */
  blockHeightRange?: {
    min?: number;
    max?: number;
  };
  /** Pagination */
  pagination?: {
    offset: number;
    limit: number;
  };
}

/**
 * UTXO query result
 */
export interface UtxoQueryResult {
  /** Matching UTXOs */
  utxos: TopicUtxo[];
  /** Total count (before pagination) */
  totalCount: number;
  /** Next page offset (if more results exist) */
  nextOffset?: number;
}

/**
 * UTXO tracked in overlay topic
 */
export interface TopicUtxo {
  /** Transaction ID */
  txid: string;
  /** Output index */
  vout: number;
  /** Amount in satoshis */
  satoshis: number;
  /** Locking script (hex-encoded) */
  scriptPubKey: string;
  /** Block height (if confirmed) */
  blockHeight?: number;
  /** Whether UTXO is spent */
  spent: boolean;
  /** Spending transaction (if spent) */
  spentBy?: {
    txid: string;
    blockHeight?: number;
  };
  /** Topic-specific metadata */
  metadata?: Record<string, unknown>;
}

// --- Topic Events (SSE) ---

/**
 * Topic subscription handle
 */
export interface TopicSubscription {
  /** Topic ID */
  topicId: string;
  /** Unsubscribe */
  unsubscribe: () => void;
}

/**
 * Topic event (SSE stream)
 */
export interface TopicEvent {
  /** Event type */
  type: "utxo_added" | "utxo_spent" | "utxo_confirmed" | "topic_updated";
  /** Topic ID */
  topicId: string;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Event data */
  data:
    | UtxoAddedEvent
    | UtxoSpentEvent
    | UtxoConfirmedEvent
    | TopicUpdatedEvent;
}

export interface UtxoAddedEvent {
  utxo: TopicUtxo;
}

export interface UtxoSpentEvent {
  txid: string;
  vout: number;
  spendingTxid: string;
}

export interface UtxoConfirmedEvent {
  txid: string;
  vout: number;
  blockHeight: number;
  confirmations: number;
}

export interface TopicUpdatedEvent {
  topicId: string;
  changes: {
    description?: string;
    managerUrl?: string;
    admissionRules?: AdmissionRules;
  };
}

// --- Arcade Configuration (SPEC §5.6, subscription tracking) ---

/**
 * Arcade configuration for subscription management
 */
export interface ArcadeConfig {
  /** Overlay manager base URL */
  baseUrl: string;
  /** Topic ID for subscriptions (e.g., "edwinpai-subscriptions") */
  subscriptionTopic: string;
  /** SPV verification mode */
  spvMode: "full" | "cached" | "trust";
  /** Cache duration for proofs (milliseconds) */
  cacheDuration: number;
  /** Grace period before marking subscription expired (milliseconds) */
  gracePeriod: number;
}

/**
 * Default Arcade configuration per SPEC §5.6
 */
export const DEFAULT_ARCADE_CONFIG: ArcadeConfig = {
  baseUrl: "https://overlay.bsvblockchain.org",
  subscriptionTopic: "edwinpai-subscriptions",
  spvMode: "cached",
  cacheDuration: 72 * 60 * 60 * 1000, // 72 hours
  gracePeriod: 72 * 60 * 60 * 1000, // 72 hours
};
