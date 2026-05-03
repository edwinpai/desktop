/**
 * Test fixture types for Phase 1 cryptographic testing
 * Defines type contracts for BRC-42 test vectors, Tauri IPC mocks,
 * and validation helpers used across the test suite.
 */

// ============================================================================
// BRC-42 Test Vector Types
// ============================================================================

/**
 * BRC-42 official test vector structure
 * Based on https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md
 */
export interface BRC42TestVector {
  /** Test vector identifier (e.g., "vector_1", "vector_2") */
  id: string;
  /** Human-readable description of what this vector tests */
  description: string;
  /** Sender's private key (hex string, 32 bytes) */
  senderPrivateKey: string;
  /** Recipient's private key (hex string, 32 bytes) */
  recipientPrivateKey: string;
  /** Invoice number for key derivation */
  invoiceNumber: string;
  /** Expected derived public key (hex string, 33 bytes compressed) */
  expectedPublicKey: string;
  /** Expected derived private key (hex string, 32 bytes) */
  expectedPrivateKey: string;
  /** Whether this is a counterparty derivation test */
  isCounterparty?: boolean;
}

/**
 * Collection of all official BRC-42 test vectors
 */
export interface BRC42TestVectorSuite {
  /** Test suite version/source identifier */
  version: string;
  /** Array of all test vectors */
  vectors: BRC42TestVector[];
  /** Metadata about test vector source */
  metadata: {
    source: string;
    date: string;
    totalVectors: number;
  };
}

/**
 * BRC-42 derivation test result
 */
export interface BRC42TestResult {
  vectorId: string;
  passed: boolean;
  publicKeyMatch: boolean;
  privateKeyMatch: boolean;
  actualPublicKey?: string;
  actualPrivateKey?: string;
  error?: string;
}

// ============================================================================
// Signing Test Fixture Types
// ============================================================================

/**
 * ECDSA signing test vector
 */
export interface SigningTestVector {
  id: string;
  description: string;
  /** Private key for signing (hex string) */
  privateKey: string;
  /** Message to sign (UTF-8 string or hex) */
  message: string;
  /** Expected signature (hex string, DER format) */
  expectedSignature?: string; // Optional since RFC 6979 is deterministic
  /** Expected signature verification result */
  shouldVerify: boolean;
}

/**
 * Signature verification test case
 */
export interface VerificationTestCase {
  id: string;
  description: string;
  /** Public key for verification (hex string, 33 bytes compressed) */
  publicKey: string;
  /** Message that was signed */
  message: string;
  /** Signature to verify (hex string, DER format) */
  signature: string;
  /** Expected verification result */
  expectedValid: boolean;
}

// ============================================================================
// Tauri IPC Mock Types
// ============================================================================

/**
 * Mock Tauri invoke function type
 * Simulates Tauri's IPC bridge for frontend tests
 */
export type MockTauriInvoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T>;

/**
 * Tauri IPC mock context for React component tests
 */
export interface TauriMockContext {
  /** Mock invoke function */
  invoke: MockTauriInvoke;
  /** Mock event emitter */
  emit: (event: string, payload?: unknown) => void;
  /** Mock event listener */
  listen: (event: string, handler: (event: unknown) => void) => () => void;
  /** Reset all mocks */
  reset: () => void;
}

/**
 * Mock responses for crypto domain commands
 */
export interface CryptoDomainMockResponses {
  getPublicKey?: {
    success: boolean;
    publicKey?: string;
    error?: string;
  };
  sign?: {
    success: boolean;
    signature?: string;
    error?: string;
  };
  verify?: {
    success: boolean;
    valid?: boolean;
    error?: string;
  };
  deriveKey?: {
    success: boolean;
    publicKey?: string;
    privateKey?: string;
    error?: string;
  };
  checkSubscription?: {
    success: boolean;
    status?: "active" | "expired" | "not_found";
    error?: string;
  };
}

/**
 * Tauri mock builder for test setup
 */
export interface TauriMockBuilder {
  /** Configure mock responses for specific commands */
  withMockResponses(responses: CryptoDomainMockResponses): TauriMockBuilder;
  /** Configure mock to throw errors */
  withErrors(commands: string[]): TauriMockBuilder;
  /** Configure latency simulation */
  withLatency(ms: number): TauriMockBuilder;
  /** Build the mock context */
  build(): TauriMockContext;
}

// ============================================================================
// Identity Validation Test Types
// ============================================================================

/**
 * Petname validation test case
 */
export interface PetnameTestCase {
  id: string;
  description: string;
  /** Input public key (hex string) */
  publicKey: string;
  /** Expected petname output */
  expectedPetname: string;
  /** Whether this should be deterministic */
  deterministic: boolean;
}

/**
 * Identicon validation test case
 */
export interface IdenticonTestCase {
  id: string;
  description: string;
  /** Input public key (hex string) */
  publicKey: string;
  /** Expected identicon SVG or data URI */
  expectedIdenticon?: string; // Optional, may just validate structure
  /** Validation rules */
  validation: {
    /** Must be valid SVG */
    mustBeSvg: boolean;
    /** Must be deterministic (same input → same output) */
    mustBeDeterministic: boolean;
    /** Expected dimensions */
    dimensions?: { width: number; height: number };
  };
}

/**
 * Identity generation test fixture
 */
export interface IdentityTestFixture {
  publicKey: string;
  expectedIdentity: {
    petname: string;
    identicon: string;
    shortId: string;
  };
}

// ============================================================================
// Keychain Test Mock Types
// ============================================================================

/**
 * Mock keychain storage for testing
 */
export interface MockKeychainStorage {
  /** Store a key-value pair */
  set(key: string, value: string): Promise<void>;
  /** Retrieve a value by key */
  get(key: string): Promise<string | null>;
  /** Delete a key */
  delete(key: string): Promise<void>;
  /** Clear all stored values */
  clear(): Promise<void>;
  /** Check if a key exists */
  has(key: string): Promise<boolean>;
}

/**
 * Keychain test scenario
 */
export interface KeychainTestScenario {
  id: string;
  description: string;
  /** Operations to perform */
  operations: Array<{
    action: "set" | "get" | "delete" | "clear";
    key?: string;
    value?: string;
    expectedResult?: string | null;
    shouldSucceed: boolean;
  }>;
}

// ============================================================================
// Audit Log Test Types
// ============================================================================

/**
 * Audit log test entry
 */
export interface AuditLogTestEntry {
  timestamp: string; // ISO 8601
  level: "info" | "warn" | "error";
  event: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit log validation helper
 */
export interface AuditLogValidator {
  /** Validate JSON Lines format */
  validateFormat(logContent: string): boolean;
  /** Parse log entries */
  parseEntries(logContent: string): AuditLogTestEntry[];
  /** Find entries matching criteria */
  findEntries(
    entries: AuditLogTestEntry[],
    criteria: Partial<AuditLogTestEntry>,
  ): AuditLogTestEntry[];
  /** Validate timestamp ordering */
  validateOrdering(entries: AuditLogTestEntry[]): boolean;
}

// ============================================================================
// Test Helper Interfaces
// ============================================================================

/**
 * Hex string validation helper
 */
export interface HexValidator {
  /** Check if string is valid hex */
  isValid(hex: string): boolean;
  /** Check if hex string is specific byte length */
  isLength(hex: string, bytes: number): boolean;
  /** Normalize hex string (remove 0x prefix, lowercase) */
  normalize(hex: string): string;
  /** Convert hex to Uint8Array */
  toBytes(hex: string): Uint8Array;
  /** Convert Uint8Array to hex */
  fromBytes(bytes: Uint8Array): string;
}

/**
 * Public key validation helper
 */
export interface PublicKeyValidator {
  /** Validate compressed public key format (33 bytes) */
  isCompressed(publicKey: string): boolean;
  /** Validate uncompressed public key format (65 bytes) */
  isUncompressed(publicKey: string): boolean;
  /** Check if public key is on secp256k1 curve */
  isOnCurve(publicKey: string): boolean;
}

/**
 * Signature validation helper
 */
export interface SignatureValidator {
  /** Validate DER signature format */
  isDER(signature: string): boolean;
  /** Extract r and s components from DER signature */
  parseComponents(signature: string): { r: string; s: string } | null;
  /** Validate signature components are in valid range */
  isValidRange(signature: string): boolean;
}

/**
 * Test assertion utilities
 */
export interface TestAssertions {
  /** Assert hex strings are equal (normalized) */
  assertHexEqual(actual: string, expected: string, message?: string): void;
  /** Assert public key is valid */
  assertValidPublicKey(publicKey: string, message?: string): void;
  /** Assert signature is valid */
  assertValidSignature(signature: string, message?: string): void;
  /** Assert petname matches format */
  assertValidPetname(petname: string, message?: string): void;
  /** Assert identicon is valid SVG */
  assertValidIdenticon(identicon: string, message?: string): void;
}

// ============================================================================
// Test Fixture Builders
// ============================================================================

/**
 * BRC-42 test fixture builder
 */
export interface BRC42FixtureBuilder {
  /** Load official test vectors */
  loadOfficialVectors(): BRC42TestVectorSuite;
  /** Create custom test vector */
  createVector(params: Partial<BRC42TestVector>): BRC42TestVector;
  /** Generate random test vector */
  generateRandomVector(): BRC42TestVector;
}

/**
 * Identity test fixture builder
 */
export interface IdentityFixtureBuilder {
  /** Create identity test fixture from public key */
  fromPublicKey(publicKey: string): IdentityTestFixture;
  /** Generate random identity fixture */
  generateRandom(): IdentityTestFixture;
  /** Create batch of fixtures */
  createBatch(count: number): IdentityTestFixture[];
}

/**
 * Signing test fixture builder
 */
export interface SigningFixtureBuilder {
  /** Create signing test vector */
  createSigningVector(params: {
    privateKey?: string;
    message: string;
  }): SigningTestVector;
  /** Create verification test case */
  createVerificationCase(params: {
    publicKey: string;
    message: string;
    signature: string;
    expectedValid: boolean;
  }): VerificationTestCase;
  /** Generate test cases for edge cases */
  generateEdgeCases(): SigningTestVector[];
}

// ============================================================================
// Test Environment Setup
// ============================================================================

/**
 * Test environment configuration
 */
export interface TestEnvironment {
  /** Mock Tauri context */
  tauri: TauriMockContext;
  /** Mock keychain storage */
  keychain: MockKeychainStorage;
  /** Test fixtures */
  fixtures: {
    brc42: BRC42FixtureBuilder;
    identity: IdentityFixtureBuilder;
    signing: SigningFixtureBuilder;
  };
  /** Validation helpers */
  validators: {
    hex: HexValidator;
    publicKey: PublicKeyValidator;
    signature: SignatureValidator;
    auditLog: AuditLogValidator;
  };
  /** Test assertions */
  assertions: TestAssertions;
  /** Cleanup function */
  cleanup: () => Promise<void>;
}

/**
 * Test environment builder
 */
export interface TestEnvironmentBuilder {
  /** Configure Tauri mocks */
  withTauriMocks(
    config?: Partial<CryptoDomainMockResponses>,
  ): TestEnvironmentBuilder;
  /** Configure keychain mocks */
  withKeychainMocks(storage?: MockKeychainStorage): TestEnvironmentBuilder;
  /** Load test fixtures */
  withFixtures(
    types: Array<"brc42" | "identity" | "signing">,
  ): TestEnvironmentBuilder;
  /** Build test environment */
  build(): TestEnvironment;
}

// ============================================================================
// Export Helper Types
// ============================================================================

/**
 * Re-export all test utilities for convenience
 */
export interface TestUtilities {
  builders: {
    environment: TestEnvironmentBuilder;
    brc42: BRC42FixtureBuilder;
    identity: IdentityFixtureBuilder;
    signing: SigningFixtureBuilder;
    tauriMock: TauriMockBuilder;
  };
  validators: {
    hex: HexValidator;
    publicKey: PublicKeyValidator;
    signature: SignatureValidator;
    auditLog: AuditLogValidator;
  };
  assertions: TestAssertions;
}
