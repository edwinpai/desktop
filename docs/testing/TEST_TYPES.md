# Test Type System Documentation

## Overview

The Phase 1 test type system provides comprehensive type contracts and interfaces for testing cryptographic operations, BRC-42 key derivation, identity generation, and Tauri IPC interactions. This document explains the test infrastructure architecture and usage patterns.

## Architecture

### File Structure

```
src/types/
├── test-fixtures.ts    # Type contracts and interfaces
├── test-data.ts        # Concrete test data and constants
└── test.ts             # Consolidated exports and utilities
```

### Design Principles

1. **Separation of Concerns**: Type contracts (`test-fixtures.ts`) are separate from concrete data (`test-data.ts`)
2. **Type Safety**: All test data is strongly typed with readonly arrays and const assertions
3. **Extensibility**: Builder interfaces allow creating custom test fixtures programmatically
4. **Reusability**: Common validation helpers and assertions can be shared across tests
5. **Documentation**: Each type includes TSDoc comments explaining purpose and usage

## Core Type Categories

### 1. BRC-42 Test Vectors

BRC-42 test vectors validate key derivation according to the official specification.

#### Key Types

```typescript
interface BRC42TestVector {
  id: string;                      // Unique identifier
  description: string;             // What this tests
  senderPrivateKey: string;        // Hex string, 32 bytes
  recipientPrivateKey: string;     // Hex string, 32 bytes
  invoiceNumber: string;           // Derivation context
  expectedPublicKey: string;       // Expected result (compressed)
  expectedPrivateKey: string;      // Expected result
  isCounterparty?: boolean;        // Optional flag
}

interface BRC42TestResult {
  vectorId: string;
  passed: boolean;
  publicKeyMatch: boolean;
  privateKeyMatch: boolean;
  actualPublicKey?: string;
  actualPrivateKey?: string;
  error?: string;
}
```

#### Usage Example

```typescript
import { OFFICIAL_BRC42_VECTORS, BRC42TestVector } from '@/types/test';

// Iterate through official test vectors
for (const vector of OFFICIAL_BRC42_VECTORS) {
  const result = await testBRC42Derivation(vector);
  expect(result.passed).toBe(true);
  expect(result.publicKeyMatch).toBe(true);
  expect(result.privateKeyMatch).toBe(true);
}
```

#### Test Vector Sources

- **Official Vectors**: From BRC-42 specification (10 vectors)
- **Custom Vectors**: Edge cases (unicode, max length, etc.)
- **Source**: https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md

### 2. Signing & Verification Test Types

Types for ECDSA signing and signature verification tests.

#### Key Types

```typescript
interface SigningTestVector {
  id: string;
  description: string;
  privateKey: string;              // Hex string, 32 bytes
  message: string;                 // UTF-8 or hex
  expectedSignature?: string;      // Optional (deterministic)
  shouldVerify: boolean;
}

interface VerificationTestCase {
  id: string;
  description: string;
  publicKey: string;               // Compressed, 33 bytes
  message: string;
  signature: string;               // DER format
  expectedValid: boolean;
}
```

#### Usage Example

```typescript
import { SIGNING_TEST_VECTORS, VERIFICATION_TEST_CASES } from '@/types/test';

// Test signing
for (const vector of SIGNING_TEST_VECTORS) {
  const signature = await sign(vector.privateKey, vector.message);
  const isValid = await verify(publicKey, vector.message, signature);
  expect(isValid).toBe(vector.shouldVerify);
}

// Test verification (including negative cases)
for (const testCase of VERIFICATION_TEST_CASES) {
  const result = await verify(
    testCase.publicKey,
    testCase.message,
    testCase.signature
  );
  expect(result).toBe(testCase.expectedValid);
}
```

### 3. Tauri IPC Mock Types

Mock types for simulating Tauri IPC in React component tests.

#### Key Types

```typescript
type MockTauriInvoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
) => Promise<T>;

interface TauriMockContext {
  invoke: MockTauriInvoke;
  emit: (event: string, payload?: unknown) => void;
  listen: (event: string, handler: (event: unknown) => void) => () => void;
  reset: () => void;
}

interface CryptoDomainMockResponses {
  getPublicKey?: { success: boolean; publicKey?: string; error?: string };
  sign?: { success: boolean; signature?: string; error?: string };
  verify?: { success: boolean; valid?: boolean; error?: string };
  deriveKey?: { success: boolean; publicKey?: string; privateKey?: string; error?: string };
  checkSubscription?: { success: boolean; status?: 'active' | 'expired' | 'not_found'; error?: string };
}
```

#### Usage Example

```typescript
import { createTauriMock, MOCK_SUCCESS_RESPONSES } from '@/types/test';

// Create mock with standard success responses
const mockTauri = createTauriMock()
  .withMockResponses(MOCK_SUCCESS_RESPONSES)
  .withLatency(50)  // Simulate 50ms latency
  .build();

// Use in React component test
render(<IdentitySetup />, {
  wrapper: ({ children }) => (
    <TauriProvider value={mockTauri}>
      {children}
    </TauriProvider>
  )
});

// Verify IPC calls
await waitFor(() => {
  expect(mockTauri.invoke).toHaveBeenCalledWith('get_public_key', {});
});
```

### 4. Identity Validation Types

Types for testing petname and identicon generation.

#### Key Types

```typescript
interface PetnameTestCase {
  id: string;
  description: string;
  publicKey: string;
  expectedPetname: string;
  deterministic: boolean;          // Must produce same output?
}

interface IdenticonTestCase {
  id: string;
  description: string;
  publicKey: string;
  expectedIdenticon?: string;
  validation: {
    mustBeSvg: boolean;
    mustBeDeterministic: boolean;
    dimensions?: { width: number; height: number };
  };
}
```

#### Usage Example

```typescript
import { PETNAME_TEST_CASES, IDENTICON_TEST_CASES } from '@/types/test';

// Test petname generation
for (const testCase of PETNAME_TEST_CASES) {
  const petname1 = generatePetname(testCase.publicKey);
  const petname2 = generatePetname(testCase.publicKey);

  if (testCase.deterministic) {
    expect(petname1).toBe(petname2);
  }

  expect(petname1).toMatch(/^[a-z]+-[a-z]+$/);
}

// Test identicon generation
for (const testCase of IDENTICON_TEST_CASES) {
  const identicon = generateIdenticon(testCase.publicKey);

  if (testCase.validation.mustBeSvg) {
    expect(identicon).toMatch(/^data:image\/svg\+xml/);
  }

  if (testCase.validation.mustBeDeterministic) {
    const identicon2 = generateIdenticon(testCase.publicKey);
    expect(identicon).toBe(identicon2);
  }
}
```

### 5. Validation Helper Interfaces

Reusable validation helpers for common test operations.

#### Key Types

```typescript
interface HexValidator {
  isValid(hex: string): boolean;
  isLength(hex: string, bytes: number): boolean;
  normalize(hex: string): string;
  toBytes(hex: string): Uint8Array;
  fromBytes(bytes: Uint8Array): string;
}

interface PublicKeyValidator {
  isCompressed(publicKey: string): boolean;
  isUncompressed(publicKey: string): boolean;
  isOnCurve(publicKey: string): boolean;
}

interface SignatureValidator {
  isDER(signature: string): boolean;
  parseComponents(signature: string): { r: string; s: string } | null;
  isValidRange(signature: string): boolean;
}
```

#### Usage Example

```typescript
import { createHexValidator, createPublicKeyValidator } from '@/lib/test-utils';

const hexValidator = createHexValidator();
const pkValidator = createPublicKeyValidator();

// Validate hex strings
expect(hexValidator.isValid('deadbeef')).toBe(true);
expect(hexValidator.isValid('zzzz')).toBe(false);
expect(hexValidator.isLength('deadbeef', 4)).toBe(true);

// Validate public keys
const pubkey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
expect(pkValidator.isCompressed(pubkey)).toBe(true);
expect(pkValidator.isOnCurve(pubkey)).toBe(true);
```

### 6. Test Environment Builder

Builder pattern for setting up comprehensive test environments.

#### Key Types

```typescript
interface TestEnvironment {
  tauri: TauriMockContext;
  keychain: MockKeychainStorage;
  fixtures: {
    brc42: BRC42FixtureBuilder;
    identity: IdentityFixtureBuilder;
    signing: SigningFixtureBuilder;
  };
  validators: {
    hex: HexValidator;
    publicKey: PublicKeyValidator;
    signature: SignatureValidator;
    auditLog: AuditLogValidator;
  };
  assertions: TestAssertions;
  cleanup: () => Promise<void>;
}

interface TestEnvironmentBuilder {
  withTauriMocks(config?: Partial<CryptoDomainMockResponses>): TestEnvironmentBuilder;
  withKeychainMocks(storage?: MockKeychainStorage): TestEnvironmentBuilder;
  withFixtures(types: Array<'brc42' | 'identity' | 'signing'>): TestEnvironmentBuilder;
  build(): TestEnvironment;
}
```

#### Usage Example

```typescript
import { createTestEnvironment } from '@/lib/test-utils';

describe('Crypto Domain Integration', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = createTestEnvironment()
      .withTauriMocks({ sign: MOCK_SUCCESS_RESPONSES.sign })
      .withKeychainMocks()
      .withFixtures(['brc42', 'signing'])
      .build();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should sign messages', async () => {
    const vector = env.fixtures.signing.createSigningVector({
      message: 'test message'
    });

    const signature = await sign(vector.privateKey, vector.message);

    env.assertions.assertValidSignature(signature);
    expect(env.validators.signature.isDER(signature)).toBe(true);
  });
});
```

## Test Data Constants

### Common Test Keys

```typescript
import { TEST_PUBLIC_KEYS, TEST_PRIVATE_KEYS } from '@/types/test';

// Pre-defined test keys for deterministic testing
const pubkey = TEST_PUBLIC_KEYS.zero;        // All zeros
const privkey = TEST_PRIVATE_KEYS.one;       // Minimal value
```

### Validation Patterns

```typescript
import { VALIDATION_PATTERNS } from '@/types/test';

// Regular expressions for validation
expect(signature).toMatch(VALIDATION_PATTERNS.derSignature);
expect(pubkey).toMatch(VALIDATION_PATTERNS.compressedPublicKey);
expect(petname).toMatch(VALIDATION_PATTERNS.petname);
```

### Timing Constants

```typescript
import { TEST_TIMEOUTS, MOCK_LATENCIES } from '@/types/test';

// Timeout configurations
jest.setTimeout(TEST_TIMEOUTS.standard);      // 5000ms

// Latency simulation
mockTauri.withLatency(MOCK_LATENCIES.normal); // 50ms
```

## Best Practices

### 1. Type Safety

Always import from `@/types/test` for full type information:

```typescript
import { BRC42TestVector, OFFICIAL_BRC42_VECTORS } from '@/types/test';

// ✅ Good: Type-safe
const vector: BRC42TestVector = OFFICIAL_BRC42_VECTORS[0];

// ❌ Bad: Loses type information
const vector = OFFICIAL_BRC42_VECTORS[0];
```

### 2. Const Assertions

Test data uses `as const` for immutability:

```typescript
// Arrays are readonly
OFFICIAL_BRC42_VECTORS.push({}); // ❌ Type error

// Objects are deeply readonly
MOCK_SUCCESS_RESPONSES.sign.success = false; // ❌ Type error
```

### 3. Mock Cleanup

Always clean up mocks after tests:

```typescript
afterEach(async () => {
  await env.cleanup();
  mockTauri.reset();
});
```

### 4. Deterministic Testing

Use pre-defined test keys for reproducibility:

```typescript
import { TEST_PRIVATE_KEYS, TEST_INVOICE_NUMBERS } from '@/types/test';

// ✅ Good: Deterministic
const result = deriveKey(
  TEST_PRIVATE_KEYS.one,
  TEST_PRIVATE_KEYS.two,
  TEST_INVOICE_NUMBERS.basic
);

// ❌ Bad: Non-deterministic
const result = deriveKey(
  generateRandomKey(),
  generateRandomKey(),
  Math.random().toString()
);
```

### 5. Validation Helpers

Use built-in validators instead of ad-hoc checks:

```typescript
// ✅ Good: Reusable validator
expect(hexValidator.isLength(pubkey, 33)).toBe(true);

// ❌ Bad: Ad-hoc validation
expect(pubkey.length).toBe(66); // Doesn't handle 0x prefix
```

## Integration with Test Frameworks

### Vitest

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnvironment, OFFICIAL_BRC42_VECTORS } from '@/types/test';

describe('BRC-42 Key Derivation', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = createTestEnvironment()
      .withFixtures(['brc42'])
      .build();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it.each(OFFICIAL_BRC42_VECTORS)(
    'should pass vector: $id',
    async (vector) => {
      const result = await testBRC42Derivation(vector);
      expect(result.passed).toBe(true);
    }
  );
});
```

### React Testing Library

```typescript
import { render, waitFor } from '@testing-library/react';
import { createTauriMock, MOCK_SUCCESS_RESPONSES } from '@/types/test';

it('should display identity', async () => {
  const mockTauri = createTauriMock()
    .withMockResponses(MOCK_SUCCESS_RESPONSES)
    .build();

  render(
    <TauriProvider value={mockTauri}>
      <IdentityCard />
    </TauriProvider>
  );

  await waitFor(() => {
    expect(screen.getByText(/petname/i)).toBeInTheDocument();
  });
});
```

## Critical Test Requirements

### BRC-42 Test Vectors

**Non-negotiable**: All 10 official BRC-42 test vectors MUST pass:

```typescript
import { OFFICIAL_BRC42_VECTORS } from '@/types/test';

// This is required by PHASE1_TEST_COVERAGE.md
describe('BRC-42 Official Test Vectors', () => {
  it.each(OFFICIAL_BRC42_VECTORS)(
    'MUST pass official vector: $id',
    async (vector) => {
      const result = await testBRC42Derivation(vector);

      // ALL assertions must pass
      expect(result.passed).toBe(true);
      expect(result.publicKeyMatch).toBe(true);
      expect(result.privateKeyMatch).toBe(true);
    }
  );
});
```

### Deterministic Signing

RFC 6979 ensures deterministic ECDSA:

```typescript
it('should produce deterministic signatures', async () => {
  const sig1 = await sign(privateKey, message);
  const sig2 = await sign(privateKey, message);

  // Same input MUST produce same signature
  expect(sig1).toBe(sig2);
});
```

### Identity Generation

Petnames and identicons must be deterministic:

```typescript
it('should generate deterministic identities', () => {
  const identity1 = generateIdentity(publicKey);
  const identity2 = generateIdentity(publicKey);

  expect(identity1.petname).toBe(identity2.petname);
  expect(identity1.identicon).toBe(identity2.identicon);
});
```

## Next Steps

1. **Implementation**: Create test utility implementations in `src/lib/test-utils/`
2. **Integration Tests**: Write BRC-42 test vector runner in `tests/brc42-vectors.test.ts`
3. **Unit Tests**: Create component tests using Tauri mocks
4. **CI Integration**: Ensure all tests run in GitHub Actions workflow

## References

- [BRC-42 Specification](https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md)
- [PHASE1_TEST_COVERAGE.md](../PHASE1_TEST_COVERAGE.md)
- [PHASE1_CRYPTO_IMPLEMENTATION.md](../PHASE1_CRYPTO_IMPLEMENTATION.md)
- [RFC 6979 - Deterministic ECDSA](https://datatracker.ietf.org/doc/html/rfc6979)

---

**Last Updated**: 2026-02-09
**Phase**: 1 (Crypto Domain & BSV Identity)
**Status**: Type contracts defined, awaiting implementation
