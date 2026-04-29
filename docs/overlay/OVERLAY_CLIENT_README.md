# Overlay Services Rust Client

HTTP client for interacting with BSV Overlay Services, implementing Topic Manager lookup and Arcade transaction broadcasting with retry logic and circuit breaker pattern.

## Features

- **Topic Manager Lookup**: Query overlay services for subscription UTXOs via GET requests
- **Arcade Broadcasting**: Submit transactions via POST to `/v1/tx` endpoint
- **Configurable URLs**: Support for custom overlay and Arcade endpoints (default or environment variables)
- **Retry Logic**: Exponential backoff with jitter for failed requests
- **Circuit Breaker**: Automatic service degradation protection (opens after 5 failures, 60s cooldown)
- **Health Checks**: Connectivity testing for both overlay and Arcade services
- **Comprehensive Tests**: Unit tests with mocked HTTP responses using mockito

## Architecture

Based on the TypeScript implementation in `overlay-services-client.ts` and overlay services documentation:
- **qmd://edwinpai-ux/sources/github-com/overlay-services/** - Overlay Services specification
- **qmd://edwinpai-ux/sources/github-com/brcs/** - BRC standards for transactions

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
thiserror = "1.0"
rand = "0.8"

[dev-dependencies]
mockito = "1.2"
```

## Quick Start

### Default Configuration

```rust
use edwinpai_overlay_client::OverlayClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = OverlayClient::with_defaults()?;

    // Lookup subscription
    let result = client.lookup_subscription("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa").await?;

    if result.success {
        println!("Found {} UTXOs", result.utxos.len());
    }

    Ok(())
}
```

### Custom Configuration

```rust
use edwinpai_overlay_client::{OverlayClient, OverlayConfig};

let config = OverlayConfig {
    overlay_url: "https://overlay.bsvblockchain.org".to_string(),
    arcade_url: "https://arcade.bsvblockchain.org".to_string(),
    subscription_topic_id: "EDWINPAI_SUBS_v1".to_string(),
    timeout_ms: 10000,
    max_retries: 3,
    initial_backoff_ms: 500,
};

let mut client = OverlayClient::new(config)?;
```

### Environment Variables

Set environment variables to override defaults:

```bash
export OVERLAY_URL=https://custom-overlay.example.com
export ARCADE_URL=https://custom-arcade.example.com
export SUBSCRIPTION_TOPIC_ID=CUSTOM_TOPIC_v1
```

Then use the default constructor:

```rust
let mut client = OverlayClient::with_defaults()?;
// Will use environment variables if set
```

## Usage Examples

### 1. Lookup Subscription UTXOs

```rust
let result = client.lookup_subscription("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa").await?;

if result.success {
    for utxo in result.utxos {
        println!("UTXO: {}:{}", utxo.txid, utxo.vout);
        println!("  Amount: {} satoshis", utxo.amount);
        println!("  Expires: {}", utxo.expires_at);

        if let Some(proof) = utxo.merkle_proof {
            println!("  Merkle Proof: {}", proof);
        }
    }
}
```

### 2. Broadcast Transaction

```rust
let raw_tx = "0100000001..."; // Raw transaction hex

let result = client.broadcast(raw_tx).await?;

if result.success {
    println!("Transaction broadcast: {}", result.txid.unwrap());
} else {
    eprintln!("Broadcast failed: {}", result.error.unwrap());
}
```

### 3. Health Check

```rust
let health = client.health_check().await?;

println!("Overlay Services: {}", if health.overlay { "UP" } else { "DOWN" });
println!("Arcade: {}", if health.arcade { "UP" } else { "DOWN" });
```

### 4. Error Handling

```rust
use edwinpai_overlay_client::OverlayError;

match client.lookup_subscription("address").await {
    Ok(result) => {
        if result.success {
            // Process result
        } else {
            // Handle application-level error
            eprintln!("Lookup failed: {}", result.error.unwrap());
        }
    }
    Err(OverlayError::HttpStatus { status, message }) => {
        eprintln!("HTTP error {}: {}", status, message);
    }
    Err(OverlayError::CircuitOpen) => {
        eprintln!("Service temporarily unavailable");
    }
    Err(e) => {
        eprintln!("Unexpected error: {}", e);
    }
}
```

## API Reference

### Types

#### `OverlayConfig`

Configuration for the overlay client.

```rust
pub struct OverlayConfig {
    pub overlay_url: String,           // Default: https://overlay.bsvblockchain.org
    pub arcade_url: String,             // Default: https://arcade.bsvblockchain.org
    pub subscription_topic_id: String,  // Default: EDWINPAI_SUBS_v1
    pub timeout_ms: u64,                // Default: 10000 (10 seconds)
    pub max_retries: u32,               // Default: 3
    pub initial_backoff_ms: u64,        // Default: 500
}
```

#### `SubscriptionUtxo`

Represents a subscription UTXO from the overlay services.

```rust
pub struct SubscriptionUtxo {
    pub txid: String,
    pub vout: u32,
    pub amount: u64,
    pub locking_script: String,
    pub expires_at: u64,
    pub user_address: String,
    pub merkle_proof: Option<String>,
    pub block_height: Option<u64>,
}
```

#### `LookupResult`

Result of a topic manager lookup.

```rust
pub struct LookupResult {
    pub success: bool,
    pub utxos: Vec<SubscriptionUtxo>,
    pub metadata: Option<LookupMetadata>,
    pub error: Option<String>,
}
```

#### `BroadcastResult`

Result of an Arcade transaction broadcast.

```rust
pub struct BroadcastResult {
    pub success: bool,
    pub txid: Option<String>,
    pub error: Option<String>,
    pub arcade_response: Option<serde_json::Value>,
}
```

### Methods

#### `OverlayClient::new(config: OverlayConfig) -> OverlayResult<Self>`

Create a new client with custom configuration.

#### `OverlayClient::with_defaults() -> OverlayResult<Self>`

Create a new client with default configuration (respects environment variables).

#### `async fn lookup_subscription(&mut self, user_address: &str) -> OverlayResult<LookupResult>`

Query the Topic Manager for subscription UTXOs associated with a user address.

**Retry Behavior**: Retries on failure with exponential backoff up to `max_retries` attempts.

#### `async fn broadcast(&mut self, raw_tx: &str) -> OverlayResult<BroadcastResult>`

Broadcast a raw transaction to the Arcade endpoint.

**Retry Behavior**: Retries on failure with exponential backoff up to `max_retries` attempts.

#### `async fn health_check(&self) -> OverlayResult<HealthCheckResult>`

Check connectivity to both overlay and Arcade services.

## Retry Logic

The client implements exponential backoff with jitter:

1. **Initial Delay**: `initial_backoff_ms` (default: 500ms)
2. **Exponential Factor**: 2x per attempt
3. **Jitter**: ±30% randomization to prevent thundering herd
4. **Max Delay**: Capped at 10 seconds per attempt
5. **Max Attempts**: `max_retries + 1` (default: 4 total attempts)

Example delays for default config:
- Attempt 0: Initial request
- Attempt 1: ~500ms ± 30%
- Attempt 2: ~1000ms ± 30%
- Attempt 3: ~2000ms ± 30%

## Circuit Breaker

Protects against cascading failures:

- **Threshold**: Opens after 5 consecutive failures
- **Cooldown**: 60 seconds before attempting to close
- **Behavior**: While open, requests fail immediately with `CircuitOpen` error
- **Recovery**: Automatically resets on first successful request

## Error Types

```rust
pub enum OverlayError {
    HttpError(reqwest::Error),
    HttpStatus { status: StatusCode, message: String },
    Timeout(u64),
    CircuitOpen,
    MaxRetriesExceeded { attempts: u32, last_error: String },
    InvalidResponse(String),
    ConfigError(String),
}
```

## Testing

Run tests with:

```bash
cargo test
```

Tests include:
- ✅ Successful lookup with mocked HTTP responses
- ✅ Successful broadcast with mocked HTTP responses
- ✅ HTTP error handling (500, 400, etc.)
- ✅ Circuit breaker behavior
- ✅ Exponential backoff calculation
- ✅ Health check connectivity
- ✅ Configuration from environment variables

### Example Test

```rust
#[tokio::test]
async fn test_lookup_subscription_success() {
    let _m = mock("POST", "/lookup")
        .with_status(200)
        .with_body(r#"{"outputs": [...]}"#)
        .create();

    let mut client = OverlayClient::new(test_config()).unwrap();
    let result = client.lookup_subscription("test_address").await.unwrap();

    assert!(result.success);
    assert_eq!(result.utxos.len(), 1);
}
```

## Integration with EdwinPAI Desktop

This client is designed for Phase 2 subscription verification in the EdwinPAI Desktop application:

1. **Subscription Check**: Query Topic Manager for user's subscription UTXO
2. **SPV Verification**: Extract Merkle proof from UTXO data
3. **Payment Broadcast**: Submit subscription payment transactions via Arcade
4. **State Management**: Integrate with subscription state machine (see `SUBSCRIPTION_STATE_MACHINE_SPEC.md`)

### Integration Example

```rust
use edwinpai_overlay_client::OverlayClient;
use subscription_state_machine::SubscriptionStateMachine;

async fn verify_subscription(
    user_pubkey: &str,
    client: &mut OverlayClient,
) -> SubscriptionState {
    // Lookup subscription UTXO
    let lookup = client.lookup_subscription(user_pubkey).await?;

    if lookup.success && !lookup.utxos.is_empty() {
        let utxo = &lookup.utxos[0];

        // Verify SPV proof (if available)
        if let Some(proof) = &utxo.merkle_proof {
            // SPV verification logic
            verify_merkle_proof(proof, &utxo.txid)?;
        }

        // Check expiry
        let now = current_timestamp();
        if utxo.expires_at > now {
            SubscriptionState::Active
        } else {
            SubscriptionState::Expired
        }
    } else {
        SubscriptionState::NotFound
    }
}
```

## Performance Considerations

- **Connection Pooling**: `reqwest::Client` maintains connection pool for efficiency
- **Timeout**: Default 10-second timeout prevents hanging requests
- **Circuit Breaker**: Prevents wasted resources on failing services
- **Jittered Backoff**: Reduces load spikes during recovery

## References

- **Overlay Services**: qmd://edwinpai-ux/sources/github-com/overlay-services/
- **BRC Standards**: qmd://edwinpai-ux/sources/github-com/brcs/
- **TypeScript Implementation**: `overlay-services-client.ts`
- **Subscription Spec**: `SUBSCRIPTION_STATE_MACHINE_SPEC.md`
- **Type Contracts**: `TYPE_CONTRACT_MANIFEST.md`

## License

See `LICENSE` file in the repository root.

## Contributing

Contributions welcome! Please ensure:
1. All tests pass (`cargo test`)
2. Code is formatted (`cargo fmt`)
3. No clippy warnings (`cargo clippy`)
4. New features include tests

## Changelog

### v0.1.0 (2026-02-10)
- Initial implementation
- Topic Manager lookup support
- Arcade broadcast integration
- Retry logic with exponential backoff
- Circuit breaker pattern
- Comprehensive test suite
