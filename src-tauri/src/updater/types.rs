/**
 * Phase 6: Onboarding & Updates - Updater Type Definitions (Rust)
 *
 * Defines Rust-side type contracts for the auto-updater system with BSV signature verification.
 */

use serde::{Deserialize, Serialize};

/// Update availability status.
///
/// State machine flow:
/// `Idle` → `Checking` → `Available` → `Downloading` → `ReadyToInstall` → `Idle`
///
/// Error states return to `Idle`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStatus {
    /// No update check in progress
    Idle,

    /// Checking for updates from endpoint
    Checking,

    /// Update available for download
    Available,

    /// Update download in progress
    Downloading,

    /// Update downloaded and ready to install
    ReadyToInstall,

    /// Error occurred during update process
    Error,
}

impl Default for UpdateStatus {
    fn default() -> Self {
        Self::Idle
    }
}

/// Update metadata from release endpoint.
///
/// # Example
/// ```no_run
/// use updater::types::UpdateInfo;
///
/// let update = UpdateInfo {
///     version: "1.2.0".to_string(),
///     date: "2026-02-11".to_string(),
///     body: "## New Features\n- Auto-updater with BSV signatures".to_string(),
///     signature: "304402207a3b...".to_string(),
///     pubkey: "02abc123...".to_string(),
///     download_url: "https://releases.edwinpai.ai/v1.2.0/edwinpai-desktop_1.2.0_amd64.AppImage".to_string(),
///     size: 75894016,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    /// Semantic version string (e.g., "1.2.0")
    pub version: String,

    /// Release date in ISO 8601 format
    pub date: String,

    /// Release notes in Markdown format
    pub body: String,

    /// BSV signature of the update binary (hex-encoded DER)
    pub signature: String,

    /// Public key for signature verification (hex-encoded compressed)
    pub pubkey: String,

    /// Direct download URL for the update binary
    pub download_url: String,

    /// Binary size in bytes
    pub size: u64,
}

/// Auto-updater configuration.
///
/// Persisted to app config file alongside `AppConfig`.
///
/// # Example
/// ```no_run
/// use updater::types::UpdateConfig;
///
/// let config = UpdateConfig {
///     endpoint: "https://releases.edwinpai.ai/updates.json".to_string(),
///     check_interval: 3600000, // 1 hour
///     auto_download: true,
///     auto_install: false,
///     allow_prerelease: false,
///     trusted_pubkeys: vec![
///         "02abc123...".to_string(),
///         "03def456...".to_string(),
///     ],
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfig {
    /// Update manifest endpoint URL
    pub endpoint: String,

    /// Check interval in milliseconds (0 = manual only)
    pub check_interval: u64,

    /// Automatically download available updates
    pub auto_download: bool,

    /// Automatically install after download (requires restart)
    pub auto_install: bool,

    /// Allow pre-release versions
    pub allow_prerelease: bool,

    /// Trusted public keys for signature verification
    pub trusted_pubkeys: Vec<String>,
}

impl Default for UpdateConfig {
    fn default() -> Self {
        Self {
            endpoint: "https://releases.edwinpai.ai/updates.json".to_string(),
            check_interval: 3600000, // 1 hour
            auto_download: true,
            auto_install: false,
            allow_prerelease: false,
            trusted_pubkeys: vec![
                // Default trusted pubkey (EdwinPAI release signing key)
                "02d0d0f9f8c8b9a8e7d6c5b4a3928180706050403020100ffeeddccbbaa9988".to_string(),
            ],
        }
    }
}

/// Update endpoint configuration.
///
/// Supports multiple endpoints for redundancy.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEndpoint {
    /// Endpoint URL
    pub url: String,

    /// Priority (lower = higher priority)
    pub priority: u8,

    /// Whether this endpoint is currently active
    pub enabled: bool,
}

/// Download progress tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    /// Bytes downloaded so far
    pub downloaded: u64,

    /// Total bytes to download
    pub total: u64,

    /// Download speed in bytes/second
    pub speed: u64,

    /// Estimated time remaining in seconds
    pub eta: u64,
}

/// Update check result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    /// Whether an update is available
    pub available: bool,

    /// Current installed version
    pub current_version: String,

    /// Latest available version (if available)
    pub latest_version: Option<String>,

    /// Update metadata (if available)
    pub update_info: Option<UpdateInfo>,

    /// Error message (if check failed)
    pub error: Option<String>,
}

impl UpdateCheckResult {
    /// Create a result indicating no update available.
    pub fn no_update(current_version: String) -> Self {
        Self {
            available: false,
            current_version,
            latest_version: None,
            update_info: None,
            error: None,
        }
    }

    /// Create a result indicating an update is available.
    pub fn update_available(current_version: String, update_info: UpdateInfo) -> Self {
        let latest_version = update_info.version.clone();
        Self {
            available: true,
            current_version,
            latest_version: Some(latest_version),
            update_info: Some(update_info),
            error: None,
        }
    }

    /// Create a result indicating an error occurred.
    pub fn error(current_version: String, error: String) -> Self {
        Self {
            available: false,
            current_version,
            latest_version: None,
            update_info: None,
            error: Some(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_status_default() {
        assert_eq!(UpdateStatus::default(), UpdateStatus::Idle);
    }

    #[test]
    fn test_update_config_default() {
        let config = UpdateConfig::default();
        assert_eq!(config.endpoint, "https://releases.edwinpai.ai/updates.json");
        assert_eq!(config.check_interval, 3600000);
        assert!(config.auto_download);
        assert!(!config.auto_install);
        assert!(!config.allow_prerelease);
        assert_eq!(config.trusted_pubkeys.len(), 1);
    }

    #[test]
    fn test_update_check_result_no_update() {
        let result = UpdateCheckResult::no_update("1.0.0".to_string());
        assert!(!result.available);
        assert_eq!(result.current_version, "1.0.0");
        assert!(result.latest_version.is_none());
        assert!(result.update_info.is_none());
        assert!(result.error.is_none());
    }

    #[test]
    fn test_update_check_result_update_available() {
        let update_info = UpdateInfo {
            version: "1.2.0".to_string(),
            date: "2026-02-11".to_string(),
            body: "Release notes".to_string(),
            signature: "304402207a3b...".to_string(),
            pubkey: "02abc123...".to_string(),
            download_url: "https://example.com/update.bin".to_string(),
            size: 1024,
        };

        let result = UpdateCheckResult::update_available("1.0.0".to_string(), update_info.clone());
        assert!(result.available);
        assert_eq!(result.current_version, "1.0.0");
        assert_eq!(result.latest_version, Some("1.2.0".to_string()));
        assert!(result.update_info.is_some());
        assert!(result.error.is_none());
    }

    #[test]
    fn test_update_check_result_error() {
        let result = UpdateCheckResult::error("1.0.0".to_string(), "Network error".to_string());
        assert!(!result.available);
        assert_eq!(result.current_version, "1.0.0");
        assert!(result.latest_version.is_none());
        assert!(result.update_info.is_none());
        assert_eq!(result.error, Some("Network error".to_string()));
    }

    #[test]
    fn test_update_info_serialization() {
        let update_info = UpdateInfo {
            version: "1.2.0".to_string(),
            date: "2026-02-11".to_string(),
            body: "Release notes".to_string(),
            signature: "304402207a3b...".to_string(),
            pubkey: "02abc123...".to_string(),
            download_url: "https://example.com/update.bin".to_string(),
            size: 1024,
        };

        let json = serde_json::to_string(&update_info).unwrap();
        let deserialized: UpdateInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.version, update_info.version);
        assert_eq!(deserialized.date, update_info.date);
        assert_eq!(deserialized.size, update_info.size);
    }
}
