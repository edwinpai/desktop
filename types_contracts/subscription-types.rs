/**
 * EdwinPAI Desktop - Subscription Type Contracts (Rust)
 * Backend type definitions for subscription state management
 *
 * Reference: qmd://edwinpai-ux/spec.md, qmd://edwinpai-ux/edwinpai-desktop/type-contract-manifest.md
 */

use serde::{Deserialize, Serialize};
use std::fmt;

// ============================================================================
// Core Subscription State Types
// ============================================================================

/// Subscription lifecycle states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionState {
    Uninitialized,
    Checking,
    Active,
    Expired,
    PaymentPending,
    Error,
}

impl fmt::Display for SubscriptionState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SubscriptionState::Uninitialized => write!(f, "uninitialized"),
            SubscriptionState::Checking => write!(f, "checking"),
            SubscriptionState::Active => write!(f, "active"),
            SubscriptionState::Expired => write!(f, "expired"),
            SubscriptionState::PaymentPending => write!(f, "payment_pending"),
            SubscriptionState::Error => write!(f, "error"),
        }
    }
}

/// Complete subscription status information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionStatus {
    pub state: SubscriptionState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>, // Unix timestamp in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utxo_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_checked: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fiat_equivalent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<SubscriptionError>,
}

impl Default for SubscriptionStatus {
    fn default() -> Self {
        Self {
            state: SubscriptionState::Uninitialized,
            expires_at: None,
            utxo_id: None,
            last_checked: None,
            fiat_equivalent: None,
            error: None,
        }
    }
}

/// Subscription error details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionError {
    pub code: SubscriptionErrorCode,
    pub message: String,
    pub recoverable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>, // Seconds until retry allowed
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionErrorCode {
    NetworkError,
    UtxoNotFound,
    InvalidUtxo,
    GatewayUnavailable,
    PaymentFailed,
    Unknown,
}

impl fmt::Display for SubscriptionErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SubscriptionErrorCode::NetworkError => write!(f, "network_error"),
            SubscriptionErrorCode::UtxoNotFound => write!(f, "utxo_not_found"),
            SubscriptionErrorCode::InvalidUtxo => write!(f, "invalid_utxo"),
            SubscriptionErrorCode::GatewayUnavailable => write!(f, "gateway_unavailable"),
            SubscriptionErrorCode::PaymentFailed => write!(f, "payment_failed"),
            SubscriptionErrorCode::Unknown => write!(f, "unknown"),
        }
    }
}

// ============================================================================
// IPC Command Payloads - Frontend to Backend
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SubscriptionCommand {
    CheckSubscription { payload: CheckSubscriptionPayload },
    InitiatePayment { payload: InitiatePaymentPayload },
    ConfirmPayment { payload: ConfirmPaymentPayload },
    CancelPayment { payload: CancelPaymentPayload },
}

#[derive(Debug, Clone, Deserialize)]
pub struct CheckSubscriptionPayload {
    #[serde(default)]
    pub force_refresh: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InitiatePaymentPayload {
    pub duration_months: u8, // 1, 3, 6, 12
    #[serde(default)]
    pub payment_method: PaymentMethod,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentMethod {
    Bitcoin,
    Auto,
}

impl Default for PaymentMethod {
    fn default() -> Self {
        PaymentMethod::Auto
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConfirmPaymentPayload {
    pub txid: String,
    pub utxo_index: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CancelPaymentPayload {
    pub reason: Option<String>,
}

// ============================================================================
// IPC Response Payloads - Backend to Frontend
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SubscriptionResponse {
    CheckSubscriptionResponse {
        success: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        data: Option<SubscriptionStatus>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<SubscriptionError>,
    },
    InitiatePaymentResponse {
        success: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        data: Option<PaymentDetails>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<SubscriptionError>,
    },
    ConfirmPaymentResponse {
        success: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        data: Option<SubscriptionStatus>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<SubscriptionError>,
    },
    CancelPaymentResponse {
        success: bool,
    },
}

/// Payment initiation details returned to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentDetails {
    pub payment_address: String,
    pub amount_satoshis: u64,
    pub fiat_equivalent: String,
    pub duration_months: u8,
    pub expires_at: i64, // Payment window expiration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_code: Option<String>, // Base64-encoded QR code
}

// ============================================================================
// Subscription Cache Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionCache {
    pub status: SubscriptionStatus,
    pub cached_at: i64, // Unix timestamp
    pub ttl: u64,       // Seconds until expiration
}

impl SubscriptionCache {
    pub fn new(status: SubscriptionStatus, ttl: u64) -> Self {
        Self {
            status,
            cached_at: chrono::Utc::now().timestamp(),
            ttl,
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        now - self.cached_at > self.ttl as i64
    }
}

// ============================================================================
// Event Types for Subscription Updates
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SubscriptionEvent {
    SubscriptionStatusChanged {
        payload: StatusChangedPayload,
    },
    SubscriptionError {
        payload: ErrorPayload,
    },
    PaymentInitiated {
        payload: PaymentInitiatedPayload,
    },
    PaymentConfirmed {
        payload: PaymentConfirmedPayload,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusChangedPayload {
    pub old_state: SubscriptionState,
    pub new_state: SubscriptionState,
    pub status: SubscriptionStatus,
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorPayload {
    pub error: SubscriptionError,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaymentInitiatedPayload {
    pub payment_details: PaymentDetails,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaymentConfirmedPayload {
    pub txid: String,
    pub new_status: SubscriptionStatus,
}

// ============================================================================
// Helper Functions
// ============================================================================

impl SubscriptionStatus {
    /// Check if subscription is currently active
    pub fn is_active(&self) -> bool {
        self.state == SubscriptionState::Active
            && self.expires_at.map_or(false, |exp| {
                exp > chrono::Utc::now().timestamp()
            })
    }

    /// Check if subscription is expired
    pub fn is_expired(&self) -> bool {
        self.state == SubscriptionState::Expired
            || self.expires_at.map_or(false, |exp| {
                exp <= chrono::Utc::now().timestamp()
            })
    }

    /// Get seconds remaining until expiration
    pub fn seconds_remaining(&self) -> Option<i64> {
        self.expires_at.map(|exp| {
            (exp - chrono::Utc::now().timestamp()).max(0)
        })
    }

    /// Check if renewal is recommended (< 7 days remaining)
    pub fn needs_renewal(&self, days_threshold: i64) -> bool {
        self.seconds_remaining()
            .map_or(false, |secs| secs > 0 && secs < days_threshold * 86400)
    }
}

impl SubscriptionError {
    /// Create a new subscription error
    pub fn new(code: SubscriptionErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            recoverable: Self::is_code_recoverable(code),
            retry_after: None,
        }
    }

    /// Determine if an error code is recoverable
    fn is_code_recoverable(code: SubscriptionErrorCode) -> bool {
        matches!(
            code,
            SubscriptionErrorCode::NetworkError | SubscriptionErrorCode::GatewayUnavailable
        )
    }

    /// Set retry_after duration
    pub fn with_retry_after(mut self, seconds: u64) -> Self {
        self.retry_after = Some(seconds);
        self
    }
}

// ============================================================================
// Conversion Helpers for Error Handling
// ============================================================================

impl From<std::io::Error> for SubscriptionError {
    fn from(err: std::io::Error) -> Self {
        SubscriptionError::new(
            SubscriptionErrorCode::NetworkError,
            format!("IO error: {}", err),
        )
    }
}

impl From<serde_json::Error> for SubscriptionError {
    fn from(err: serde_json::Error) -> Self {
        SubscriptionError::new(
            SubscriptionErrorCode::Unknown,
            format!("Serialization error: {}", err),
        )
    }
}

// ============================================================================
// Type Validation
// ============================================================================

impl InitiatePaymentPayload {
    /// Validate payment duration
    pub fn validate(&self) -> Result<(), String> {
        match self.duration_months {
            1 | 3 | 6 | 12 => Ok(()),
            _ => Err(format!(
                "Invalid duration: {} months. Must be 1, 3, 6, or 12.",
                self.duration_months
            )),
        }
    }
}

impl ConfirmPaymentPayload {
    /// Validate transaction ID format
    pub fn validate(&self) -> Result<(), String> {
        if self.txid.len() != 64 {
            return Err("Invalid txid: must be 64 characters".to_string());
        }
        if !self.txid.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("Invalid txid: must be hexadecimal".to_string());
        }
        Ok(())
    }
}
