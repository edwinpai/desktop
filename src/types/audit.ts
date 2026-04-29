/**
 * Audit log types (SPEC §3.6)
 *
 * Append-only audit log for all Crypto Domain operations.
 * Stored in ~/.edwinpai/audit/crypto.log
 */

// --- Audit Log Entry ---

export type AuditOperation =
  | "sign"
  | "verify"
  | "derive_key"
  | "get_public_key"
  | "encrypt"
  | "decrypt"
  | "check_subscription"
  | "get_identity"
  | "generate_identicon";

export interface AuditLogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Operation performed */
  operation: AuditOperation;

  /** Protocol ID (BRC-43), if applicable */
  protocolID?: string;

  /** Key ID (BRC-43), if applicable */
  keyID?: string;

  /** Counterparty public key, if applicable */
  counterparty?: string;

  /** SHA-256 hash of payload (for sign/verify/encrypt/decrypt) */
  payloadHash?: string;

  /** Whether the operation succeeded */
  success: boolean;

  /** Error message if success=false */
  error?: string;

  /** Additional context (e.g., signature length, derived key) */
  metadata?: Record<string, unknown>;
}

// --- Audit Log Query ---

export interface AuditLogQuery {
  /** Filter by operation type */
  operation?: AuditOperation;

  /** Filter by protocol ID */
  protocolID?: string;

  /** Filter by key ID */
  keyID?: string;

  /** Filter by counterparty */
  counterparty?: string;

  /** Filter by success status */
  success?: boolean;

  /** Start timestamp (ISO 8601) */
  startTime?: string;

  /** End timestamp (ISO 8601) */
  endTime?: string;

  /** Maximum number of entries to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  hasMore: boolean;
}

// --- Audit Log Statistics ---

export interface AuditStats {
  /** Total number of operations logged */
  totalOperations: number;

  /** Number of successful operations */
  successfulOperations: number;

  /** Number of failed operations */
  failedOperations: number;

  /** Success rate (0-1) */
  successRate: number;

  /** Operations by type */
  operationCounts: Record<AuditOperation, number>;

  /** Most recent operation timestamp */
  lastOperationTime?: string;

  /** First operation timestamp */
  firstOperationTime?: string;
}

// --- Audit Log Format (on-disk) ---

export interface AuditLogFileFormat {
  /** Version of the audit log format */
  version: number;

  /** Entries (newline-delimited JSON) */
  entries: AuditLogEntry[];
}
