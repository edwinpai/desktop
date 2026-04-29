// Test type contracts for EdwinPAI Desktop Rust backend
//
// This module defines type-safe test fixtures, mock interfaces, and validation
// helpers for unit, integration, and E2E testing. These types mirror frontend
// test contracts in src/types/testing.ts to ensure consistency across layers.
//
// Organization:
// - Crypto test types (BRC-42 vectors, signing tests, keychain mocks)
// - Integration test types (IPC scenarios, FSM states, channel encryption)
// - Mock interfaces (HTTP, process lifecycle, mDNS, filesystem)
// - Coverage report schemas (thresholds, manifests)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Crypto Test Types (Phase 1)
// ============================================================================

/// BRC-42 official test vector
/// Maps to test vectors from https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BRC42TestVector {
    /// Test vector identifier (e.g., "vector_01", "vector_02")
    pub id: String,
    /// Human-readable description
    pub description: String,
    /// Sender's private key (64-char hex string)
    pub sender_private_key: String,
    /// Recipient's public key (66-char compressed hex)
    pub recipient_public_key: String,
    /// Invoice number for derivation
    pub invoice_number: String,
    /// Expected derived public key (66-char compressed hex)
    pub expected_public_key: String,
    /// Expected derived private key (64-char hex string)
    pub expected_private_key: String,
    /// Whether this tests counterparty derivation
    #[serde(default)]
    pub is_counterparty: bool,
}

impl BRC42TestVector {
    /// Validates that all hex fields are correctly formatted
    pub fn validate(&self) -> Result<(), String> {
        if self.sender_private_key.len() != 64 {
            return Err(format!("Invalid sender_private_key length: {}", self.sender_private_key.len()));
        }
        if self.recipient_public_key.len() != 66 {
            return Err(format!("Invalid recipient_public_key length: {}", self.recipient_public_key.len()));
        }
        if self.expected_public_key.len() != 66 {
            return Err(format!("Invalid expected_public_key length: {}", self.expected_public_key.len()));
        }
        if self.expected_private_key.len() != 64 {
            return Err(format!("Invalid expected_private_key length: {}", self.expected_private_key.len()));
        }
        Ok(())
    }
}

/// BRC-42 test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BRC42TestResult {
    pub vector_id: String,
    pub passed: bool,
    pub public_key_match: bool,
    pub private_key_match: bool,
    pub actual_public_key: Option<String>,
    pub actual_private_key: Option<String>,
    pub error: Option<String>,
}

/// Keychain mock for testing
#[derive(Debug, Clone)]
pub struct KeychainMock {
    /// In-memory key storage (service_name -> password)
    storage: HashMap<String, String>,
    /// Simulated errors for specific services
    error_scenarios: HashMap<String, String>,
}

impl KeychainMock {
    pub fn new() -> Self {
        Self {
            storage: HashMap::new(),
            error_scenarios: HashMap::new(),
        }
    }

    /// Configure mock to return error for specific service
    pub fn with_error(mut self, service: &str, error: &str) -> Self {
        self.error_scenarios.insert(service.to_string(), error.to_string());
        self
    }

    /// Store password in mock keychain
    pub fn set_password(&mut self, service: &str, password: &str) -> Result<(), String> {
        if let Some(error) = self.error_scenarios.get(service) {
            return Err(error.clone());
        }
        self.storage.insert(service.to_string(), password.to_string());
        Ok(())
    }

    /// Retrieve password from mock keychain
    pub fn get_password(&self, service: &str) -> Result<String, String> {
        if let Some(error) = self.error_scenarios.get(service) {
            return Err(error.clone());
        }
        self.storage
            .get(service)
            .cloned()
            .ok_or_else(|| format!("Password not found for service: {}", service))
    }

    /// Delete password from mock keychain
    pub fn delete_password(&mut self, service: &str) -> Result<(), String> {
        if let Some(error) = self.error_scenarios.get(service) {
            return Err(error.clone());
        }
        self.storage.remove(service);
        Ok(())
    }
}

/// Audit log mock for testing
#[derive(Debug, Clone)]
pub struct AuditLogMock {
    /// In-memory log entries
    entries: Vec<crate::crypto_domain::types::AuditLogEntry>,
    /// Whether to fail writes
    write_failure: bool,
}

impl AuditLogMock {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            write_failure: false,
        }
    }

    /// Configure mock to fail writes
    pub fn with_write_failure(mut self) -> Self {
        self.write_failure = true;
        self
    }

    /// Log an entry
    pub fn log(&mut self, entry: crate::crypto_domain::types::AuditLogEntry) -> Result<(), String> {
        if self.write_failure {
            return Err("Mock write failure".to_string());
        }
        self.entries.push(entry);
        Ok(())
    }

    /// Read all entries
    pub fn read_all(&self) -> Vec<crate::crypto_domain::types::AuditLogEntry> {
        self.entries.clone()
    }

    /// Read filtered entries
    pub fn read_filtered<F>(&self, predicate: F) -> Vec<crate::crypto_domain::types::AuditLogEntry>
    where
        F: Fn(&crate::crypto_domain::types::AuditLogEntry) -> bool,
    {
        self.entries.iter().filter(|e| predicate(e)).cloned().collect()
    }
}

// ============================================================================
// Integration Test Types (Phase 2-4)
// ============================================================================

/// IPC test scenario
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IPCTestScenario {
    /// Scenario identifier
    pub id: String,
    /// Description of what this tests
    pub description: String,
    /// Command to invoke
    pub command: String,
    /// Request payload (JSON)
    pub request: serde_json::Value,
    /// Expected response (JSON)
    pub expected_response: serde_json::Value,
    /// Expected error (if any)
    pub expected_error: Option<String>,
    /// Setup steps (e.g., "create_keychain", "start_gateway")
    pub setup_steps: Vec<String>,
    /// Teardown steps
    pub teardown_steps: Vec<String>,
}

/// Subscription FSM state for testing
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SubscriptionFSMState {
    /// No subscription found
    NotFound,
    /// Active subscription (<24h since last check)
    Active {
        txid: String,
        vout: u32,
        verified_at: String,
    },
    /// Cached proof (24-72h since last check)
    Cached {
        txid: String,
        vout: u32,
        verified_at: String,
    },
    /// Expired (>72h since last check)
    Expired {
        txid: String,
        vout: u32,
        verified_at: String,
    },
    /// Grace period exceeded (>7d since expiry)
    GraceExceeded {
        txid: String,
        vout: u32,
        verified_at: String,
    },
}

impl SubscriptionFSMState {
    /// Transition to next state based on elapsed time
    pub fn transition(&self, elapsed_hours: u64) -> Self {
        match self {
            Self::Active { txid, vout, .. } => {
                if elapsed_hours >= 72 {
                    Self::Expired {
                        txid: txid.clone(),
                        vout: *vout,
                        verified_at: chrono::Utc::now().to_rfc3339(),
                    }
                } else if elapsed_hours >= 24 {
                    Self::Cached {
                        txid: txid.clone(),
                        vout: *vout,
                        verified_at: chrono::Utc::now().to_rfc3339(),
                    }
                } else {
                    self.clone()
                }
            }
            Self::Cached { txid, vout, .. } => {
                if elapsed_hours >= 72 {
                    Self::Expired {
                        txid: txid.clone(),
                        vout: *vout,
                        verified_at: chrono::Utc::now().to_rfc3339(),
                    }
                } else {
                    self.clone()
                }
            }
            Self::Expired { txid, vout, .. } => {
                if elapsed_hours >= 168 { // 7 days
                    Self::GraceExceeded {
                        txid: txid.clone(),
                        vout: *vout,
                        verified_at: chrono::Utc::now().to_rfc3339(),
                    }
                } else {
                    self.clone()
                }
            }
            _ => self.clone(),
        }
    }
}

/// Channel encryption test case (Phase 5)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelEncryptionTestCase {
    pub id: String,
    pub description: String,
    /// Channel name (used as BRC-42 keyID)
    pub channel_name: String,
    /// Plaintext credentials (JSON)
    pub plaintext: String,
    /// Expected ciphertext format (hex-encoded)
    pub expected_format: String,
    /// Whether decryption should succeed
    pub should_decrypt: bool,
}

// ============================================================================
// Mock Interfaces (Phase 2-4)
// ============================================================================

/// HTTP mock configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpMock {
    /// Base URL
    pub base_url: String,
    /// Mock responses (path -> response JSON)
    pub responses: HashMap<String, serde_json::Value>,
    /// Mock latencies (path -> ms)
    pub latencies: HashMap<String, u64>,
    /// Mock errors (path -> error message)
    pub errors: HashMap<String, String>,
}

impl HttpMock {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            responses: HashMap::new(),
            latencies: HashMap::new(),
            errors: HashMap::new(),
        }
    }

    /// Configure mock response for path
    pub fn with_response(mut self, path: &str, response: serde_json::Value) -> Self {
        self.responses.insert(path.to_string(), response);
        self
    }

    /// Configure mock latency for path
    pub fn with_latency(mut self, path: &str, ms: u64) -> Self {
        self.latencies.insert(path.to_string(), ms);
        self
    }

    /// Configure mock error for path
    pub fn with_error(mut self, path: &str, error: &str) -> Self {
        self.errors.insert(path.to_string(), error.to_string());
        self
    }
}

/// Process lifecycle mock (Phase 3)
#[derive(Debug, Clone)]
pub struct ProcessMock {
    /// Process ID
    pub pid: Option<u32>,
    /// Whether process is running
    pub is_running: bool,
    /// Exit code (if terminated)
    pub exit_code: Option<i32>,
    /// Stdout output
    pub stdout: String,
    /// Stderr output
    pub stderr: String,
}

impl ProcessMock {
    pub fn new() -> Self {
        Self {
            pid: None,
            is_running: false,
            exit_code: None,
            stdout: String::new(),
            stderr: String::new(),
        }
    }

    /// Simulate process start
    pub fn start(&mut self) -> Result<u32, String> {
        if self.is_running {
            return Err("Process already running".to_string());
        }
        self.pid = Some(12345); // Mock PID
        self.is_running = true;
        Ok(12345)
    }

    /// Simulate process stop
    pub fn stop(&mut self) -> Result<(), String> {
        if !self.is_running {
            return Err("Process not running".to_string());
        }
        self.is_running = false;
        self.exit_code = Some(0);
        Ok(())
    }

    /// Simulate process kill
    pub fn kill(&mut self) -> Result<(), String> {
        if !self.is_running {
            return Err("Process not running".to_string());
        }
        self.is_running = false;
        self.exit_code = Some(137); // SIGKILL
        Ok(())
    }
}

/// mDNS discovery mock (Phase 3-4)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MDnsDiscoveryMock {
    /// Discovered peers (pubkey -> peer info)
    pub peers: HashMap<String, MDnsPeerInfo>,
    /// Discovery timeout (ms)
    pub timeout_ms: u64,
}

impl MDnsDiscoveryMock {
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
            timeout_ms: 5000,
        }
    }

    /// Add mock peer
    pub fn with_peer(mut self, pubkey: &str, hostname: &str, port: u16, petname: &str) -> Self {
        self.peers.insert(
            pubkey.to_string(),
            MDnsPeerInfo {
                hostname: hostname.to_string(),
                port,
                pubkey: pubkey.to_string(),
                petname: petname.to_string(),
                version: "1.0.0".to_string(),
            },
        );
        self
    }

    /// Simulate discovery scan
    pub fn scan(&self) -> Vec<MDnsPeerInfo> {
        self.peers.values().cloned().collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MDnsPeerInfo {
    pub hostname: String,
    pub port: u16,
    pub pubkey: String,
    pub petname: String,
    pub version: String,
}

// ============================================================================
// Coverage Report Schemas (Phase 1-6)
// ============================================================================

/// Coverage thresholds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageThreshold {
    /// Minimum line coverage percentage (0-100)
    pub line_coverage: f64,
    /// Minimum branch coverage percentage (0-100)
    pub branch_coverage: f64,
    /// Minimum function coverage percentage (0-100)
    pub function_coverage: f64,
}

impl Default for CoverageThreshold {
    fn default() -> Self {
        Self {
            line_coverage: 85.0,
            branch_coverage: 80.0,
            function_coverage: 90.0,
        }
    }
}

/// Test manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestManifest {
    /// Phase identifier
    pub phase: String,
    /// Total tests
    pub total_tests: usize,
    /// Passing tests
    pub passing_tests: usize,
    /// Failing tests
    pub failing_tests: usize,
    /// Skipped tests
    pub skipped_tests: usize,
    /// Test categories (category -> count)
    pub categories: HashMap<String, usize>,
    /// Coverage threshold
    pub coverage_threshold: CoverageThreshold,
    /// Actual coverage
    pub actual_coverage: Option<CoverageReport>,
}

impl TestManifest {
    /// Calculate pass rate percentage
    pub fn pass_rate(&self) -> f64 {
        if self.total_tests == 0 {
            return 0.0;
        }
        (self.passing_tests as f64 / self.total_tests as f64) * 100.0
    }

    /// Check if coverage meets threshold
    pub fn meets_threshold(&self) -> bool {
        if let Some(ref coverage) = self.actual_coverage {
            coverage.line_coverage >= self.coverage_threshold.line_coverage
                && coverage.branch_coverage >= self.coverage_threshold.branch_coverage
                && coverage.function_coverage >= self.coverage_threshold.function_coverage
        } else {
            false
        }
    }
}

/// Coverage report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageReport {
    /// Line coverage percentage
    pub line_coverage: f64,
    /// Branch coverage percentage
    pub branch_coverage: f64,
    /// Function coverage percentage
    pub function_coverage: f64,
    /// Per-file coverage (filepath -> percentage)
    pub file_coverage: HashMap<String, f64>,
}

// ============================================================================
// Test Utilities
// ============================================================================

/// Test fixture builder helper
pub struct TestFixtureBuilder<T> {
    data: T,
}

impl<T> TestFixtureBuilder<T> {
    pub fn new(data: T) -> Self {
        Self { data }
    }

    pub fn build(self) -> T {
        self.data
    }
}

/// BRC-42 test vector builder
pub type BRC42FixtureBuilder = TestFixtureBuilder<BRC42TestVector>;

impl BRC42FixtureBuilder {
    pub fn with_id(mut self, id: &str) -> Self {
        self.data.id = id.to_string();
        self
    }

    pub fn with_keys(mut self, sender_priv: &str, recipient_pub: &str) -> Self {
        self.data.sender_private_key = sender_priv.to_string();
        self.data.recipient_public_key = recipient_pub.to_string();
        self
    }

    pub fn with_expected(mut self, pub_key: &str, priv_key: &str) -> Self {
        self.data.expected_public_key = pub_key.to_string();
        self.data.expected_private_key = priv_key.to_string();
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_brc42_vector_validation() {
        let vector = BRC42TestVector {
            id: "test_01".to_string(),
            description: "Test vector".to_string(),
            sender_private_key: "a".repeat(64),
            recipient_public_key: "02".to_owned() + &"a".repeat(64),
            invoice_number: "2-test-001".to_string(),
            expected_public_key: "03".to_owned() + &"b".repeat(64),
            expected_private_key: "b".repeat(64),
            is_counterparty: false,
        };

        assert!(vector.validate().is_ok());
    }

    #[test]
    fn test_keychain_mock() {
        let mut mock = KeychainMock::new();
        mock.set_password("test_service", "test_password").unwrap();

        let password = mock.get_password("test_service").unwrap();
        assert_eq!(password, "test_password");

        mock.delete_password("test_service").unwrap();
        assert!(mock.get_password("test_service").is_err());
    }

    #[test]
    fn test_subscription_fsm_transitions() {
        let active = SubscriptionFSMState::Active {
            txid: "abc123".to_string(),
            vout: 0,
            verified_at: chrono::Utc::now().to_rfc3339(),
        };

        // Transition to Cached after 24h
        let cached = active.transition(25);
        assert!(matches!(cached, SubscriptionFSMState::Cached { .. }));

        // Transition to Expired after 72h
        let expired = cached.transition(73);
        assert!(matches!(expired, SubscriptionFSMState::Expired { .. }));

        // Transition to GraceExceeded after 168h (7 days)
        let grace_exceeded = expired.transition(169);
        assert!(matches!(grace_exceeded, SubscriptionFSMState::GraceExceeded { .. }));
    }

    #[test]
    fn test_test_manifest_pass_rate() {
        let manifest = TestManifest {
            phase: "Phase 1".to_string(),
            total_tests: 100,
            passing_tests: 85,
            failing_tests: 10,
            skipped_tests: 5,
            categories: HashMap::new(),
            coverage_threshold: CoverageThreshold::default(),
            actual_coverage: None,
        };

        assert_eq!(manifest.pass_rate(), 85.0);
    }
}
