/**
 * Phase 6: Onboarding & Updates - Updater Module
 *
 * Auto-updater system with BSV signature verification.
 *
 * ## Architecture
 *
 * - `types.rs`: Type definitions (UpdateInfo, UpdateConfig, UpdateStatus)
 * - `checker.rs`: Update availability checking and version comparison
 * - `downloader.rs`: Binary download with progress tracking
 * - `verifier.rs`: BSV signature verification using crypto_domain
 * - `installer.rs`: Update installation and app restart
 * - `manager.rs`: Global updater state machine and lifecycle
 *
 * ## State Machine
 *
 * ```text
 * Idle → Checking → Available → Downloading → ReadyToInstall → [restart] → Idle
 *              ↓         ↓            ↓                ↓
 *            Error ←────────────────────────────────────
 * ```
 *
 * ## BSV Signature Verification
 *
 * 1. Fetch update manifest from endpoint (UpdateInfo JSON)
 * 2. Verify manifest signature using trusted pubkeys (Phase 1 crypto_domain)
 * 3. Download binary from downloadUrl
 * 4. Compute SHA-256 hash of downloaded binary
 * 5. Verify hash signature matches manifest signature
 * 6. Install verified binary
 *
 * ## Usage
 *
 * ```rust
 * use updater::{UpdaterManager, UpdateConfig};
 *
 * // Initialize updater with config
 * let config = UpdateConfig::default();
 * UpdaterManager::init(config)?;
 *
 * // Check for updates
 * let result = UpdaterManager::check_for_updates(false).await?;
 * if result.available {
 *     // Download update
 *     UpdaterManager::download_update(&result.update_info.unwrap()).await?;
 *
 *     // Apply update (restarts app)
 *     UpdaterManager::apply_update().await?;
 * }
 * ```
 */

pub mod types;

pub use types::{
    DownloadProgress, UpdateCheckResult, UpdateConfig, UpdateEndpoint, UpdateInfo, UpdateStatus,
};
