/**
 * Consolidated test type exports
 *
 * Central export point for all test-related types, fixtures, and utilities.
 * Import from this file in test files to get access to all testing infrastructure.
 *
 * @example
 * ```typescript
 * import {
 *   BRC42TestVector,
 *   MockTauriInvoke,
 *   HexValidator,
 *   TEST_DATA
 * } from '@/types/test';
 * ```
 */

// ============================================================================
// Re-export Test Fixture Types
// ============================================================================

export type {
  // BRC-42 Types
  BRC42TestVector,
  BRC42TestVectorSuite,
  BRC42TestResult,
  BRC42FixtureBuilder,

  // Signing Types
  SigningTestVector,
  VerificationTestCase,
  SigningFixtureBuilder,

  // Tauri Mock Types
  MockTauriInvoke,
  TauriMockContext,
  CryptoDomainMockResponses,
  TauriMockBuilder,

  // Identity Types
  PetnameTestCase,
  IdenticonTestCase,
  IdentityTestFixture,
  IdentityFixtureBuilder,

  // Keychain Mock Types
  MockKeychainStorage,
  KeychainTestScenario,

  // Audit Log Types
  AuditLogTestEntry,
  AuditLogValidator,

  // Validation Helper Interfaces
  HexValidator,
  PublicKeyValidator,
  SignatureValidator,
  TestAssertions,

  // Test Environment
  TestEnvironment,
  TestEnvironmentBuilder,
  TestUtilities,
} from './test-fixtures';

// ============================================================================
// Re-export Test Data
// ============================================================================

export {
  // Vector Constants
  OFFICIAL_BRC42_VECTORS,
  CUSTOM_BRC42_VECTORS,
  SIGNING_TEST_VECTORS,
  VERIFICATION_TEST_CASES,
  PETNAME_TEST_CASES,
  IDENTICON_TEST_CASES,

  // Error Cases
  ERROR_TEST_CASES,

  // Mock Responses
  MOCK_SUCCESS_RESPONSES,
  MOCK_ERROR_RESPONSES,

  // Timing Constants
  TEST_TIMEOUTS,
  MOCK_LATENCIES,

  // Validation Patterns
  VALIDATION_PATTERNS,

  // Consolidated Export
  TEST_DATA,

  // Type Exports
  type TestData,
} from './test-data';

// ============================================================================
// Utility Type Guards
// ============================================================================

/**
 * Type guard for BRC-42 test vectors
 */
export function isBRC42TestVector(obj: unknown): obj is import('./test-fixtures').BRC42TestVector {
  if (typeof obj !== 'object' || obj === null) return false;
  const vec = obj as Record<string, unknown>;
  return (
    typeof vec.id === 'string' &&
    typeof vec.description === 'string' &&
    typeof vec.senderPrivateKey === 'string' &&
    typeof vec.recipientPrivateKey === 'string' &&
    typeof vec.invoiceNumber === 'string' &&
    typeof vec.expectedPublicKey === 'string' &&
    typeof vec.expectedPrivateKey === 'string'
  );
}

/**
 * Type guard for signing test vectors
 */
export function isSigningTestVector(obj: unknown): obj is import('./test-fixtures').SigningTestVector {
  if (typeof obj !== 'object' || obj === null) return false;
  const vec = obj as Record<string, unknown>;
  return (
    typeof vec.id === 'string' &&
    typeof vec.description === 'string' &&
    typeof vec.privateKey === 'string' &&
    typeof vec.message === 'string' &&
    typeof vec.shouldVerify === 'boolean'
  );
}

/**
 * Type guard for audit log entries
 */
export function isAuditLogEntry(obj: unknown): obj is import('./test-fixtures').AuditLogTestEntry {
  if (typeof obj !== 'object' || obj === null) return false;
  const entry = obj as Record<string, unknown>;
  return (
    typeof entry.timestamp === 'string' &&
    typeof entry.level === 'string' &&
    ['info', 'warn', 'error'].includes(entry.level as string) &&
    typeof entry.event === 'string'
  );
}

// ============================================================================
// Test Helper Constants
// ============================================================================

/**
 * Common test public keys for deterministic testing
 */
export const TEST_PUBLIC_KEYS = {
  /** All zeros (compressed) */
  zero: '02' + '00'.repeat(32),
  /** All ones (compressed) */
  one: '02' + '01'.repeat(32),
  /** All max values (compressed) */
  max: '02' + 'ff'.repeat(32),
  /** Generator point (secp256k1) */
  generator: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
} as const;

/**
 * Common test private keys for deterministic testing
 */
export const TEST_PRIVATE_KEYS = {
  /** Minimal valid private key */
  one: '0000000000000000000000000000000000000000000000000000000000000001',
  /** Another minimal private key */
  two: '0000000000000000000000000000000000000000000000000000000000000002',
  /** Mid-range value */
  mid: '8000000000000000000000000000000000000000000000000000000000000000',
} as const;

/**
 * Common test invoice numbers
 */
export const TEST_INVOICE_NUMBERS = {
  basic: 'test-invoice-001',
  withUnicode: 'invoice-测试-🔑',
  long: 'x'.repeat(100),
  alphanumeric: 'ABC123XYZ789',
} as const;

/**
 * Expected test outcomes
 */
export const TEST_EXPECTATIONS = {
  /** Operations that should succeed */
  shouldPass: {
    validKeyDerivation: true,
    validSigning: true,
    validVerification: true,
    validPetnameGeneration: true,
    validIdenticonGeneration: true,
  },
  /** Operations that should fail */
  shouldFail: {
    invalidPrivateKey: true,
    invalidPublicKey: true,
    invalidSignature: true,
    emptyInvoice: true,
    malformedDER: true,
  },
} as const;

// ============================================================================
// Test Configuration Types
// ============================================================================

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  /** Suite name */
  name: string;
  /** Whether to run integration tests */
  runIntegration: boolean;
  /** Whether to run unit tests */
  runUnit: boolean;
  /** Timeout for entire suite (ms) */
  timeout: number;
  /** Whether to fail fast on first error */
  failFast: boolean;
  /** Verbosity level */
  verbose: 'quiet' | 'normal' | 'verbose';
}

/**
 * Test runner options
 */
export interface TestRunnerOptions {
  /** Filter tests by pattern */
  filter?: RegExp;
  /** Run only specific test IDs */
  only?: string[];
  /** Skip specific test IDs */
  skip?: string[];
  /** Enable code coverage */
  coverage?: boolean;
  /** Number of times to repeat tests */
  repeat?: number;
  /** Run tests in parallel */
  parallel?: boolean;
}

/**
 * Test result summary
 */
export interface TestResultSummary {
  /** Total tests run */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Test duration (ms) */
  duration: number;
  /** Coverage percentage */
  coverage?: number;
  /** Individual results */
  results: Array<{
    id: string;
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    error?: string;
  }>;
}

// ============================================================================
// Export Test Configuration Defaults
// ============================================================================

/**
 * Default test suite configuration
 */
export const DEFAULT_TEST_CONFIG: TestSuiteConfig = {
  name: 'Phase 1 Test Suite',
  runIntegration: true,
  runUnit: true,
  timeout: 30000,
  failFast: false,
  verbose: 'normal',
} as const;

/**
 * Default test runner options
 */
export const DEFAULT_RUNNER_OPTIONS: TestRunnerOptions = {
  coverage: true,
  parallel: false,
  repeat: 1,
} as const;
