# Overlay Client Quick Reference

## Installation

```bash
cd /home/jake/Desktop/shad
cargo build --release
```

## Run Tests

```bash
cargo test              # Run all tests
cargo test --verbose    # Verbose output
cargo clippy            # Lint check
cargo fmt               # Format code
```

## Quick Start

```rust
use edwinpai_overlay_client::OverlayClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = OverlayClient::with_defaults()?;

    // Lookup subscription
    let result = client.lookup_subscription("address").await?;
    println!("Found {} UTXOs", result.utxos.len());

    // Broadcast transaction
    let broadcast = client.broadcast("raw_tx_hex").await?;
    println!("TXID: {}", broadcast.txid.unwrap());

    Ok(())
}
```

## Environment Variables

```bash
export OVERLAY_URL=https://overlay.bsvblockchain.org
export ARCADE_URL=https://arcade.bsvblockchain.org
export SUBSCRIPTION_TOPIC_ID=EDWINPAI_SUBS_v1
```

## Run Example

```bash
cargo run --example overlay_example
```

## Key Features

✅ Topic Manager lookup (POST /lookup)
✅ Arcade broadcasting (POST /v1/tx)
✅ Retry with exponential backoff
✅ Circuit breaker (5 failures → 60s cooldown)
✅ Configurable timeouts (default: 10s)
✅ Environment variable support
✅ Comprehensive error handling
✅ Health checks

## API Highlights

```rust
// Create client
let client = OverlayClient::with_defaults()?;
let client = OverlayClient::new(custom_config)?;

// Lookup
let result = client.lookup_subscription("address").await?;

// Broadcast
let result = client.broadcast("raw_tx").await?;

// Health check
let health = client.health_check().await?;
```

## Test Coverage

- ✅ 9/9 unit tests passing
- ✅ HTTP success scenarios
- ✅ HTTP error handling
- ✅ Circuit breaker behavior
- ✅ Exponential backoff
- ✅ Environment configuration

## File Structure

```
/home/jake/Desktop/shad/
├── overlay.rs                    # Core implementation (700+ LOC)
├── lib.rs                        # Library entry
├── Cargo.toml                    # Dependencies
├── examples/overlay_example.rs   # Usage examples
├── OVERLAY_CLIENT_README.md      # Full documentation
└── OVERLAY_IMPLEMENTATION_SUMMARY.md
```

## Integration Points

1. **Subscription State Machine** (`subscription-state-machine.ts`)
   - NotFound → no UTXOs
   - Active → valid UTXO
   - Expired → past expiry

2. **SPV Verification** (`spv.ts`)
   - Extract merkle_proof from UTXO
   - Verify block inclusion

3. **Payment Flow** (`subscription-manager.ts`)
   - Create payment TX
   - Broadcast via Arcade
   - Monitor TXID

## Performance

- Connection pooling via reqwest
- Async I/O (tokio runtime)
- Jittered backoff prevents thundering herd
- Circuit breaker protects failing services

## Error Handling

```rust
match client.lookup_subscription("addr").await {
    Ok(result) if result.success => {
        // Process UTXOs
    }
    Ok(result) => {
        eprintln!("Lookup failed: {}", result.error.unwrap());
    }
    Err(OverlayError::CircuitOpen) => {
        eprintln!("Service unavailable");
    }
    Err(e) => {
        eprintln!("Error: {}", e);
    }
}
```

## Common Tasks

### Custom timeout
```rust
let config = OverlayConfig {
    timeout_ms: 20000,  // 20 seconds
    ..Default::default()
};
```

### More retries
```rust
let config = OverlayConfig {
    max_retries: 5,
    initial_backoff_ms: 1000,
    ..Default::default()
};
```

### Custom endpoints
```rust
let config = OverlayConfig {
    overlay_url: "https://custom-overlay.com".to_string(),
    arcade_url: "https://custom-arcade.com".to_string(),
    ..Default::default()
};
```

## References

- Full docs: `OVERLAY_CLIENT_README.md`
- Implementation summary: `OVERLAY_IMPLEMENTATION_SUMMARY.md`
- TypeScript reference: `overlay-services-client.ts`
- Tests: Run `cargo test -- --nocapture` for verbose output
