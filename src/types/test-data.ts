/**
 * Test data types and constants for Phase 1 testing
 * Defines concrete test data structures that implement the test fixture interfaces
 */

import type {
  BRC42TestVector,
  SigningTestVector,
  VerificationTestCase,
  PetnameTestCase,
  IdenticonTestCase,
} from './test-fixtures';

// ============================================================================
// BRC-42 Test Vector Constants
// ============================================================================

/**
 * Official BRC-42 test vectors from the specification
 * Source: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md
 */
export const OFFICIAL_BRC42_VECTORS: readonly BRC42TestVector[] = [
  // These will be populated from the official spec
  // Vector 1: Basic derivation test
  {
    id: 'vector_1',
    description: 'Basic BRC-42 key derivation',
    senderPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
    recipientPrivateKey: '0000000000000000000000000000000000000000000000000000000000000002',
    invoiceNumber: 'test-invoice-1',
    expectedPublicKey: '', // Populated from spec
    expectedPrivateKey: '', // Populated from spec
  },
  // Additional vectors will be added based on official spec
] as const;

/**
 * Custom BRC-42 test vectors for edge cases
 */
export const CUSTOM_BRC42_VECTORS: readonly BRC42TestVector[] = [
  {
    id: 'edge_max_invoice',
    description: 'Maximum length invoice number',
    senderPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
    recipientPrivateKey: '0000000000000000000000000000000000000000000000000000000000000002',
    invoiceNumber: 'x'.repeat(255),
    expectedPublicKey: '',
    expectedPrivateKey: '',
  },
  {
    id: 'edge_unicode_invoice',
    description: 'Unicode characters in invoice number',
    senderPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
    recipientPrivateKey: '0000000000000000000000000000000000000000000000000000000000000002',
    invoiceNumber: '测试-🔑-キー',
    expectedPublicKey: '',
    expectedPrivateKey: '',
  },
] as const;

// ============================================================================
// Signing Test Vector Constants
// ============================================================================

/**
 * Standard signing test vectors
 */
export const SIGNING_TEST_VECTORS: readonly SigningTestVector[] = [
  {
    id: 'sign_basic',
    description: 'Basic message signing',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001',
    message: 'Hello, BSV!',
    shouldVerify: true,
  },
  {
    id: 'sign_empty',
    description: 'Empty message signing',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001',
    message: '',
    shouldVerify: true,
  },
  {
    id: 'sign_long',
    description: 'Long message signing',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001',
    message: 'x'.repeat(10000),
    shouldVerify: true,
  },
  {
    id: 'sign_binary',
    description: 'Binary data signing',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001',
    message: '00ff00ff00ff',
    shouldVerify: true,
  },
] as const;

/**
 * Verification test cases including invalid signatures
 */
export const VERIFICATION_TEST_CASES: readonly VerificationTestCase[] = [
  {
    id: 'verify_valid',
    description: 'Valid signature verification',
    publicKey: '', // Derived from private key above
    message: 'Hello, BSV!',
    signature: '', // Generated signature
    expectedValid: true,
  },
  {
    id: 'verify_wrong_message',
    description: 'Signature with modified message',
    publicKey: '',
    message: 'Goodbye, BSV!',
    signature: '', // Signature for different message
    expectedValid: false,
  },
  {
    id: 'verify_wrong_key',
    description: 'Signature with wrong public key',
    publicKey: '', // Different public key
    message: 'Hello, BSV!',
    signature: '',
    expectedValid: false,
  },
  {
    id: 'verify_malformed',
    description: 'Malformed signature',
    publicKey: '',
    message: 'Hello, BSV!',
    signature: 'invalid_signature',
    expectedValid: false,
  },
] as const;

// ============================================================================
// Identity Test Data
// ============================================================================

/**
 * Petname test cases for deterministic generation
 */
export const PETNAME_TEST_CASES: readonly PetnameTestCase[] = [
  {
    id: 'petname_basic',
    description: 'Basic petname generation',
    publicKey: '02' + '00'.repeat(32),
    expectedPetname: '', // Generated from public key hash
    deterministic: true,
  },
  {
    id: 'petname_all_ff',
    description: 'Petname from max value public key',
    publicKey: '02' + 'ff'.repeat(32),
    expectedPetname: '',
    deterministic: true,
  },
  {
    id: 'petname_collision',
    description: 'Different keys should produce different petnames',
    publicKey: '03' + '00'.repeat(32),
    expectedPetname: '',
    deterministic: true,
  },
] as const;

/**
 * Identicon test cases
 */
export const IDENTICON_TEST_CASES: readonly IdenticonTestCase[] = [
  {
    id: 'identicon_basic',
    description: 'Basic identicon generation',
    publicKey: '02' + '00'.repeat(32),
    validation: {
      mustBeSvg: true,
      mustBeDeterministic: true,
      dimensions: { width: 64, height: 64 },
    },
  },
  {
    id: 'identicon_deterministic',
    description: 'Same key produces same identicon',
    publicKey: '02' + '00'.repeat(32),
    validation: {
      mustBeSvg: true,
      mustBeDeterministic: true,
    },
  },
  {
    id: 'identicon_unique',
    description: 'Different keys produce different identicons',
    publicKey: '03' + '00'.repeat(32),
    validation: {
      mustBeSvg: true,
      mustBeDeterministic: true,
    },
  },
] as const;

// ============================================================================
// Error Test Cases
// ============================================================================

/**
 * Expected error scenarios for negative testing
 */
export const ERROR_TEST_CASES = {
  invalidPrivateKey: {
    id: 'error_invalid_privkey',
    input: 'not_a_hex_string',
    expectedError: 'Invalid private key format',
  },
  invalidPublicKey: {
    id: 'error_invalid_pubkey',
    input: 'not_33_bytes',
    expectedError: 'Invalid public key format',
  },
  invalidSignature: {
    id: 'error_invalid_sig',
    input: 'malformed_der',
    expectedError: 'Invalid signature format',
  },
  emptyInvoice: {
    id: 'error_empty_invoice',
    input: '',
    expectedError: 'Invoice number cannot be empty',
  },
  keychainNotFound: {
    id: 'error_keychain_missing',
    input: 'nonexistent_key',
    expectedError: 'Key not found in keychain',
  },
} as const;

// ============================================================================
// Mock Response Templates
// ============================================================================

/**
 * Standard mock responses for successful operations
 */
export const MOCK_SUCCESS_RESPONSES = {
  getPublicKey: {
    success: true,
    publicKey: '02' + '00'.repeat(32),
  },
  sign: {
    success: true,
    signature: '3045022100' + '00'.repeat(32) + '0220' + '00'.repeat(32),
  },
  verify: {
    success: true,
    valid: true,
  },
  deriveKey: {
    success: true,
    publicKey: '02' + '00'.repeat(32),
    privateKey: '00'.repeat(32),
  },
  checkSubscription: {
    success: true,
    status: 'active' as const,
  },
} as const;

/**
 * Standard mock responses for error scenarios
 */
export const MOCK_ERROR_RESPONSES = {
  getPublicKey: {
    success: false,
    error: 'Failed to retrieve public key',
  },
  sign: {
    success: false,
    error: 'Signing operation failed',
  },
  verify: {
    success: false,
    error: 'Verification operation failed',
  },
  deriveKey: {
    success: false,
    error: 'Key derivation failed',
  },
  checkSubscription: {
    success: false,
    error: 'Subscription check failed',
  },
} as const;

// ============================================================================
// Test Timing Constants
// ============================================================================

/**
 * Timing constants for async operation testing
 */
export const TEST_TIMEOUTS = {
  /** Standard operation timeout (ms) */
  standard: 5000,
  /** Quick operation timeout (ms) */
  quick: 1000,
  /** Long operation timeout (ms) */
  long: 10000,
  /** Keychain operation timeout (ms) */
  keychain: 3000,
  /** Network operation timeout (ms) */
  network: 5000,
} as const;

/**
 * Latency simulation values (ms)
 */
export const MOCK_LATENCIES = {
  /** Instant response */
  instant: 0,
  /** Fast local operation */
  fast: 10,
  /** Normal operation */
  normal: 50,
  /** Slow operation */
  slow: 200,
  /** Very slow operation */
  verySlow: 500,
} as const;

// ============================================================================
// Validation Pattern Constants
// ============================================================================

/**
 * Regular expressions for validation
 */
export const VALIDATION_PATTERNS = {
  /** Hex string pattern (any length) */
  hex: /^[0-9a-fA-F]*$/,
  /** Compressed public key (33 bytes, 66 hex chars) */
  compressedPublicKey: /^0[23][0-9a-fA-F]{64}$/,
  /** Uncompressed public key (65 bytes, 130 hex chars) */
  uncompressedPublicKey: /^04[0-9a-fA-F]{128}$/,
  /** Private key (32 bytes, 64 hex chars) */
  privateKey: /^[0-9a-fA-F]{64}$/,
  /** DER signature pattern (approximate) */
  derSignature: /^30[0-9a-fA-F]{2}02[0-9a-fA-F]+$/,
  /** Petname pattern (adjective-noun format) */
  petname: /^[a-z]+-[a-z]+$/,
  /** SVG data URI pattern */
  svgDataUri: /^data:image\/svg\+xml[;,]/,
  /** ISO 8601 timestamp */
  iso8601: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
} as const;

// ============================================================================
// Export All Test Data
// ============================================================================

/**
 * Consolidated test data export
 */
export const TEST_DATA = {
  brc42: {
    official: OFFICIAL_BRC42_VECTORS,
    custom: CUSTOM_BRC42_VECTORS,
  },
  signing: {
    vectors: SIGNING_TEST_VECTORS,
    verification: VERIFICATION_TEST_CASES,
  },
  identity: {
    petname: PETNAME_TEST_CASES,
    identicon: IDENTICON_TEST_CASES,
  },
  errors: ERROR_TEST_CASES,
  mocks: {
    success: MOCK_SUCCESS_RESPONSES,
    error: MOCK_ERROR_RESPONSES,
  },
  timeouts: TEST_TIMEOUTS,
  latencies: MOCK_LATENCIES,
  patterns: VALIDATION_PATTERNS,
} as const;

export type TestData = typeof TEST_DATA;
