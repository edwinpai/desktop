# BRC-42 Deriver Interface Reuse Pattern

**Version:** 1.0
**Last Updated:** 2026-02-10
**Context:** EdwinPAI Desktop Phase 1/Phase 2 Implementation

## Overview

The EdwinPAI Desktop implementation follows a **single-responsibility, interface-based** pattern for BRC-42 key derivation. This document describes the reuse patterns for the `Brc42Deriver` interface across identity generation, subscription management, and cryptographic operations.

## Core Interface Definition

### TypeScript Interface
```typescript
/**
 * BRC-42 key derivation interface following the bitcoin-sv/BRCs specification
 * @see https://github.com/bitcoin-sv/BRCs/tree/master/key-derivation
 */
interface Brc42Deriver {
  /**
   * Derives a child private key using BRC-42 protocol-level derivation
   * @param privateKey - Parent private key (hex string)
   * @param invoiceNumber - Protocol ID (e.g., "edwinpai identity 0")
   * @param derivationPath - Optional nested derivation path
   * @returns Derived private key (hex string)
   */
  derivePrivateKey(
    privateKey: string,
    invoiceNumber: string,
    derivationPath?: string
  ): Promise<string>;

  /**
   * Derives a child public key using BRC-42 protocol-level derivation
   * @param publicKey - Parent public key (hex string, compressed)
   * @param invoiceNumber - Protocol ID
   * @param derivationPath - Optional nested derivation path
   * @returns Derived public key (hex string, compressed)
   */
  derivePublicKey(
    publicKey: string,
    invoiceNumber: string,
    derivationPath?: string
  ): Promise<string>;

  /**
   * Derives a symmetric encryption key using BRC-42 key derivation
   * @param privateKey - Private key for derivation
   * @param publicKey - Counterparty public key (for ECDH)
   * @param invoiceNumber - Protocol ID
   * @returns 256-bit symmetric key (hex string)
   */
  deriveSymmetricKey(
    privateKey: string,
    publicKey: string,
    invoiceNumber: string
  ): Promise<string>;
}
```

### Rust Trait Definition
```rust
/// BRC-42 key derivation trait for protocol-level key management
///
/// Implements the BRC-42 specification for deterministic key derivation
/// using protocol IDs (invoice numbers) and optional derivation paths.
pub trait Brc42Deriver {
    /// Derives a child private key from a parent private key
    ///
    /// # Arguments
    /// * `private_key` - Parent private key (32 bytes)
    /// * `invoice_number` - Protocol identifier (e.g., "edwinpai identity 0")
    /// * `derivation_path` - Optional nested path (e.g., "m/0/1")
    ///
    /// # Returns
    /// Derived private key (32 bytes)
    fn derive_private_key(
        &self,
        private_key: &[u8; 32],
        invoice_number: &str,
        derivation_path: Option<&str>
    ) -> Result<[u8; 32], CryptoError>;

    /// Derives a child public key from a parent public key
    fn derive_public_key(
        &self,
        public_key: &[u8; 33],
        invoice_number: &str,
        derivation_path: Option<&str>
    ) -> Result<[u8; 33], CryptoError>;

    /// Derives a symmetric key using ECDH + BRC-42 KDF
    fn derive_symmetric_key(
        &self,
        private_key: &[u8; 32],
        public_key: &[u8; 33],
        invoice_number: &str
    ) -> Result<[u8; 32], CryptoError>;
}
```

## Reuse Pattern 1: Identity Generation

### Protocol ID Convention
```typescript
// Identity generation uses deterministic invoice numbers
const EDWINPAI_IDENTITY_PROTOCOL = "edwinpai identity";

class IdentityGenerator {
  constructor(private deriver: Brc42Deriver) {}

  async generateIdentity(
    masterPrivateKey: string,
    index: number
  ): Promise<EdwinPAIIdentity> {
    const invoiceNumber = `${EDWINPAI_IDENTITY_PROTOCOL} ${index}`;

    const identityPrivateKey = await this.deriver.derivePrivateKey(
      masterPrivateKey,
      invoiceNumber
    );

    const identityPublicKey = await this.deriver.derivePublicKey(
      publicKeyFromPrivate(identityPrivateKey),
      invoiceNumber
    );

    return {
      index,
      privateKey: identityPrivateKey,
      publicKey: identityPublicKey,
      invoiceNumber
    };
  }
}
```

**Reuse Benefit:** Single `Brc42Deriver` instance supports unlimited identity generation with different invoice numbers.

## Reuse Pattern 2: Subscription Key Derivation

### Subscription-Specific Keys
```typescript
const EDWINPAI_SUBSCRIPTION_PROTOCOL = "edwinpai subscription";

class SubscriptionManager {
  constructor(private deriver: Brc42Deriver) {}

  async deriveSubscriptionKey(
    identityPrivateKey: string,
    subscriptionId: string
  ): Promise<string> {
    // Derive subscription-specific key from identity key
    const invoiceNumber = `${EDWINPAI_SUBSCRIPTION_PROTOCOL} ${subscriptionId}`;

    return await this.deriver.derivePrivateKey(
      identityPrivateKey,
      invoiceNumber
    );
  }

  async deriveProofVerificationKey(
    identityPublicKey: string,
    txid: string
  ): Promise<string> {
    // Derive public key for verifying subscription proofs
    const invoiceNumber = `${EDWINPAI_SUBSCRIPTION_PROTOCOL} ${txid}`;

    return await this.deriver.derivePublicKey(
      identityPublicKey,
      invoiceNumber
    );
  }
}
```

**Reuse Benefit:** Same deriver interface handles both identity and subscription key hierarchies without code duplication.

## Reuse Pattern 3: Symmetric Key Exchange

### ECDH-Based Encryption
```typescript
class SecureMessageService {
  constructor(private deriver: Brc42Deriver) {}

  async encryptMessage(
    senderPrivateKey: string,
    recipientPublicKey: string,
    message: string,
    protocol: string
  ): Promise<EncryptedMessage> {
    // Derive shared symmetric key using BRC-42 ECDH
    const symmetricKey = await this.deriver.deriveSymmetricKey(
      senderPrivateKey,
      recipientPublicKey,
      protocol  // e.g., "edwinpai message 0"
    );

    // Use derived key for AES-256-GCM encryption
    const encrypted = await aesGcmEncrypt(message, symmetricKey);

    return {
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      protocol
    };
  }
}
```

**Reuse Benefit:** Single deriver handles both asymmetric (key derivation) and symmetric (encryption) use cases.

## Reuse Pattern 4: Multi-Level Derivation Paths

### Hierarchical Key Trees
```typescript
class WalletManager {
  constructor(private deriver: Brc42Deriver) {}

  async deriveAccountKey(
    masterPrivateKey: string,
    accountIndex: number,
    keyIndex: number
  ): Promise<string> {
    // Multi-level derivation: master → account → key
    const invoiceNumber = `edwinpai wallet ${accountIndex}`;
    const derivationPath = `m/${keyIndex}`;

    return await this.deriver.derivePrivateKey(
      masterPrivateKey,
      invoiceNumber,
      derivationPath
    );
  }
}
```

**Reuse Benefit:** Optional derivation paths enable hierarchical key structures without changing the interface.

## Implementation Registry Pattern

### Dependency Injection for Testing
```typescript
// Registry allows swapping implementations without changing consumers
class Brc42DeriverRegistry {
  private static instance?: Brc42Deriver;

  static register(deriver: Brc42Deriver): void {
    this.instance = deriver;
  }

  static get(): Brc42Deriver {
    if (!this.instance) {
      throw new Error('Brc42Deriver not registered');
    }
    return this.instance;
  }
}

// Production setup
Brc42DeriverRegistry.register(new NativeBrc42Deriver());

// Test setup
Brc42DeriverRegistry.register(new MockBrc42Deriver());

// Consumer code (unchanged)
const identityGen = new IdentityGenerator(Brc42DeriverRegistry.get());
```

## Cross-Language Interop Pattern

### TypeScript → Rust Bridge
```typescript
// TypeScript wrapper calls Rust implementation via Tauri
class TauriBrc42Deriver implements Brc42Deriver {
  async derivePrivateKey(
    privateKey: string,
    invoiceNumber: string,
    derivationPath?: string
  ): Promise<string> {
    return await invoke('derive_private_key', {
      privateKey,
      invoiceNumber,
      derivationPath
    });
  }

  async derivePublicKey(
    publicKey: string,
    invoiceNumber: string,
    derivationPath?: string
  ): Promise<string> {
    return await invoke('derive_public_key', {
      publicKey,
      invoiceNumber,
      derivationPath
    });
  }

  async deriveSymmetricKey(
    privateKey: string,
    publicKey: string,
    invoiceNumber: string
  ): Promise<string> {
    return await invoke('derive_symmetric_key', {
      privateKey,
      publicKey,
      invoiceNumber
    });
  }
}
```

**Reuse Benefit:** TypeScript interface matches Rust trait, enabling seamless IPC without type conversion logic.

## Protocol ID Namespacing Convention

### Recommended Protocol ID Format
```
<application>:<domain>:<version> <identifier>

Examples:
- "edwinpai:identity:0 0"           → First identity
- "edwinpai:subscription:0 tx123"   → Subscription for tx123
- "edwinpai:message:0 conv456"      → Message encryption for conversation 456
- "edwinpai:backup:0 2026-02-10"    → Backup key for date
```

**Benefits:**
- **Collision-free:** Application prefix prevents cross-app key reuse
- **Versioned:** Domain version enables protocol upgrades
- **Auditable:** Clear semantic meaning for each derived key

## Testing Strategy

### Mock Deriver for Unit Tests
```typescript
class MockBrc42Deriver implements Brc42Deriver {
  private derivationLog: Array<{ invoice: string; path?: string }> = [];

  async derivePrivateKey(
    privateKey: string,
    invoiceNumber: string,
    derivationPath?: string
  ): Promise<string> {
    this.derivationLog.push({ invoice: invoiceNumber, path: derivationPath });
    // Deterministic fake derivation for testing
    return sha256(`${privateKey}-${invoiceNumber}-${derivationPath || ''}`);
  }

  getDerivationLog() {
    return this.derivationLog;
  }
}

// Test example
test('IdentityGenerator uses correct invoice numbers', async () => {
  const mockDeriver = new MockBrc42Deriver();
  const generator = new IdentityGenerator(mockDeriver);

  await generator.generateIdentity('test-key', 5);

  const log = mockDeriver.getDerivationLog();
  expect(log[0].invoice).toBe('edwinpai identity 5');
});
```

## Performance Considerations

### Caching Derived Keys
```typescript
class CachedBrc42Deriver implements Brc42Deriver {
  private cache = new Map<string, string>();

  constructor(private inner: Brc42Deriver) {}

  async derivePrivateKey(
    privateKey: string,
    invoiceNumber: string,
    derivationPath?: string
  ): Promise<string> {
    const cacheKey = `priv:${privateKey}:${invoiceNumber}:${derivationPath || ''}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const derived = await this.inner.derivePrivateKey(
      privateKey,
      invoiceNumber,
      derivationPath
    );

    this.cache.set(cacheKey, derived);
    return derived;
  }

  // ... similar for other methods
}
```

## Security Best Practices

1. **Never Log Private Keys:** Deriver implementations must not log sensitive material
2. **Constant-Time Comparisons:** Use timing-safe equality checks for key comparisons
3. **Secure Memory:** Zero out private key buffers after use
4. **Protocol ID Validation:** Reject malformed invoice numbers to prevent injection attacks

## Migration Path for Protocol Changes

### Versioned Protocol IDs
```typescript
// V1 protocol (legacy)
const PROTOCOL_V1 = "edwinpai identity";

// V2 protocol (new format)
const PROTOCOL_V2 = "edwinpai:identity:0";

class VersionedIdentityGenerator {
  constructor(private deriver: Brc42Deriver) {}

  async generateIdentity(
    masterPrivateKey: string,
    index: number,
    version: 1 | 2 = 2
  ): Promise<EdwinPAIIdentity> {
    const protocol = version === 2 ? PROTOCOL_V2 : PROTOCOL_V1;
    const invoiceNumber = `${protocol} ${index}`;

    // Deriver interface remains unchanged
    return await this.deriver.derivePrivateKey(
      masterPrivateKey,
      invoiceNumber
    );
  }
}
```

## Summary of Reuse Benefits

| Pattern | Benefit | Example Use Case |
|---------|---------|------------------|
| Interface Abstraction | Swap implementations (native, WASM, mock) | Unit testing with mock deriver |
| Protocol ID Namespacing | Collision-free key derivation | Identity vs. subscription keys |
| Optional Derivation Paths | Hierarchical key trees | Multi-account wallet structures |
| Symmetric Key Support | Unified crypto interface | Message encryption + key derivation |
| Cross-Language Interop | TypeScript ↔ Rust IPC | Tauri command bridging |
| Caching Wrapper | Performance optimization | Repeated derivations of same key |

## References

- **BRC-42 Specification:** https://github.com/bitcoin-sv/BRCs/tree/master/key-derivation
- **Phase 1 Type Contracts:** edwinpai-ux/edwinpai-desktop/type-contract-manifest.md
- **Test Infrastructure:** edwinpai-ux/edwinpai-desktop/docs/test-types.md
- **Crypto Domain Traits:** edwinpai-ux/edwinpai-desktop/type-contract-manifest.md (lines 80-83)
