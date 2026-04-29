//! Example usage of the OverlayClient
//!
//! Demonstrates:
//! - Configuration setup (default and custom)
//! - Topic Manager lookup for subscription UTXOs
//! - Arcade transaction broadcasting
//! - Health check
//! - Error handling

use edwinpai_overlay_client::{OverlayClient, OverlayConfig};

// Note: When running as an example, use `cargo run --example overlay_example`
// The library will be available as `edwinpai_overlay_client`

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== EdwinPAI Overlay Client Example ===\n");

    // Example 1: Create client with default configuration
    println!("1. Creating client with default config...");
    let mut client = OverlayClient::with_defaults()?;
    println!("   ✓ Client created\n");

    // Example 2: Health check
    println!("2. Running health check...");
    match client.health_check().await {
        Ok(health) => {
            println!(
                "   Overlay Services: {}",
                if health.overlay { "✓" } else { "✗" }
            );
            println!("   Arcade: {}\n", if health.arcade { "✓" } else { "✗" });
        }
        Err(e) => {
            println!("   Health check failed: {}\n", e);
        }
    }

    // Example 3: Lookup subscription UTXO
    println!("3. Looking up subscription for user address...");
    let user_address = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";

    match client.lookup_subscription(user_address).await {
        Ok(result) => {
            if result.success {
                println!("   ✓ Lookup successful");
                println!("   Found {} UTXO(s)", result.utxos.len());

                for (i, utxo) in result.utxos.iter().enumerate() {
                    println!("\n   UTXO #{}:", i + 1);
                    println!("     TXID: {}", utxo.txid);
                    println!("     VOUT: {}", utxo.vout);
                    println!("     Amount: {} satoshis", utxo.amount);
                    println!("     Expires: {}", utxo.expires_at);
                    if let Some(height) = utxo.block_height {
                        println!("     Block Height: {}", height);
                    }
                }

                if let Some(metadata) = result.metadata {
                    println!("\n   Metadata:");
                    println!("     Topic ID: {}", metadata.topic_id);
                    println!("     Timestamp: {}", metadata.lookup_timestamp);
                    if let Some(cache_hit) = metadata.cache_hit {
                        println!("     Cache Hit: {}", cache_hit);
                    }
                }
            } else {
                println!("   ✗ Lookup failed: {}", result.error.unwrap_or_default());
            }
        }
        Err(e) => {
            println!("   ✗ Error: {}", e);
        }
    }

    println!("\n");

    // Example 4: Broadcast transaction
    println!("4. Broadcasting transaction...");
    let raw_tx = "0100000001..."; // Example raw transaction hex

    match client.broadcast(raw_tx).await {
        Ok(result) => {
            if result.success {
                println!("   ✓ Broadcast successful");
                if let Some(txid) = result.txid {
                    println!("   Transaction ID: {}", txid);
                }
            } else {
                println!(
                    "   ✗ Broadcast failed: {}",
                    result.error.unwrap_or_default()
                );
            }
        }
        Err(e) => {
            println!("   ✗ Error: {}", e);
        }
    }

    println!("\n");

    // Example 5: Custom configuration
    println!("5. Creating client with custom config...");
    let custom_config = OverlayConfig {
        overlay_url: "https://custom-overlay.example.com".to_string(),
        arcade_url: "https://custom-arcade.example.com".to_string(),
        subscription_topic_id: "CUSTOM_TOPIC_v1".to_string(),
        timeout_ms: 15000, // 15 seconds
        max_retries: 5,
        initial_backoff_ms: 1000, // 1 second
    };

    let _custom_client = OverlayClient::new(custom_config)?;
    println!("   ✓ Custom client created\n");

    // Example 6: Configuration from environment variables
    println!("6. Using environment variable configuration:");
    println!("   Set OVERLAY_URL, ARCADE_URL, and SUBSCRIPTION_TOPIC_ID");
    println!("   to customize the default configuration.\n");

    println!("   Example:");
    println!("   export OVERLAY_URL=https://my-overlay.example.com");
    println!("   export ARCADE_URL=https://my-arcade.example.com");
    println!("   export SUBSCRIPTION_TOPIC_ID=MY_TOPIC_v1\n");

    println!("=== Example Complete ===");

    Ok(())
}
