// Gateway Log Management (NEW in Phase 7)
//
// Defines type contracts for:
// - Log entry structure (timestamp, level, message, metadata)
// - Log query/filtering
// - Log persistence (file-based append-only log)
//
// Mirrors TypeScript types in src/types/phase7.ts (GatewayLog, LogQueryFilters)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Log Entry Types
// ============================================================================

/// Log level severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
}

impl LogLevel {
    /// Parse log level from string (case-insensitive)
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "trace" => Some(LogLevel::Trace),
            "debug" => Some(LogLevel::Debug),
            "info" => Some(LogLevel::Info),
            "warn" => Some(LogLevel::Warn),
            "error" => Some(LogLevel::Error),
            _ => None,
        }
    }

    /// Convert log level to string
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Trace => "trace",
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }
}

/// Gateway log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// Log timestamp (ISO 8601)
    pub timestamp: String,

    /// Log severity level
    pub level: LogLevel,

    /// Log message
    pub message: String,

    /// Optional structured metadata (JSON-serializable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Source module/component (e.g., "gateway.chat", "gateway.auth")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

impl LogEntry {
    /// Create a new log entry
    pub fn new(level: LogLevel, message: String) -> Self {
        Self {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level,
            message,
            metadata: None,
            source: None,
        }
    }

    /// Create a log entry with source
    pub fn with_source(level: LogLevel, message: String, source: String) -> Self {
        Self {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level,
            message,
            metadata: None,
            source: Some(source),
        }
    }

    /// Create a log entry with metadata
    pub fn with_metadata(
        level: LogLevel,
        message: String,
        metadata: HashMap<String, serde_json::Value>,
    ) -> Self {
        Self {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level,
            message,
            metadata: Some(metadata),
            source: None,
        }
    }

    /// Create a log entry with source and metadata
    pub fn with_source_and_metadata(
        level: LogLevel,
        message: String,
        source: String,
        metadata: HashMap<String, serde_json::Value>,
    ) -> Self {
        Self {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level,
            message,
            metadata: Some(metadata),
            source: Some(source),
        }
    }
}

// ============================================================================
// Log Query/Filtering
// ============================================================================

/// Log query filters
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogQueryFilters {
    /// Start timestamp (ISO 8601, inclusive)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub since: Option<String>,

    /// End timestamp (ISO 8601, exclusive)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub until: Option<String>,

    /// Filter by minimum log level (inclusive, e.g., "warn" includes warn+error)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_level: Option<LogLevel>,

    /// Filter by source module
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,

    /// Maximum number of log entries to return
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

impl LogQueryFilters {
    /// Check if a log entry matches the filters
    pub fn matches(&self, entry: &LogEntry) -> bool {
        // Check timestamp range (since)
        if let Some(ref since) = self.since {
            if entry.timestamp < *since {
                return false;
            }
        }

        // Check timestamp range (until)
        if let Some(ref until) = self.until {
            if entry.timestamp >= *until {
                return false;
            }
        }

        // Check minimum log level
        if let Some(min_level) = self.min_level {
            if entry.level < min_level {
                return false;
            }
        }

        // Check source module
        if let Some(ref source_filter) = self.source {
            match &entry.source {
                Some(entry_source) => {
                    if !entry_source.contains(source_filter) {
                        return false;
                    }
                }
                None => return false,
            }
        }

        true
    }
}

// ============================================================================
// Log Storage Types (Internal)
// ============================================================================

/// Log file configuration
pub struct LogFileConfig {
    /// Log file path
    pub file_path: std::path::PathBuf,

    /// Maximum file size before rotation (bytes)
    pub max_file_size: u64,

    /// Number of rotated log files to keep
    pub max_files: usize,
}

impl Default for LogFileConfig {
    fn default() -> Self {
        Self {
            file_path: std::path::PathBuf::from("~/.edwinpai/gateway.log"),
            max_file_size: 10 * 1024 * 1024, // 10 MB
            max_files: 5,
        }
    }
}

// ============================================================================
// IPC Types (Commands)
// ============================================================================

/// Request: Get gateway logs
#[derive(Debug, Deserialize)]
pub struct GetGatewayLogsRequest {
    /// Query filters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<LogQueryFilters>,
}

/// Response: Gateway logs
#[derive(Debug, Serialize)]
pub struct GetGatewayLogsResponse {
    /// Log entries matching query
    pub logs: Vec<LogEntry>,

    /// Total count of matching entries (before limit applied)
    pub total_count: usize,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_level_ordering() {
        assert!(LogLevel::Error > LogLevel::Warn);
        assert!(LogLevel::Warn > LogLevel::Info);
        assert!(LogLevel::Info > LogLevel::Debug);
        assert!(LogLevel::Debug > LogLevel::Trace);
    }

    #[test]
    fn test_log_level_from_str() {
        assert_eq!(LogLevel::from_str("trace"), Some(LogLevel::Trace));
        assert_eq!(LogLevel::from_str("DEBUG"), Some(LogLevel::Debug));
        assert_eq!(LogLevel::from_str("Info"), Some(LogLevel::Info));
        assert_eq!(LogLevel::from_str("invalid"), None);
    }

    #[test]
    fn test_log_level_as_str() {
        assert_eq!(LogLevel::Trace.as_str(), "trace");
        assert_eq!(LogLevel::Info.as_str(), "info");
        assert_eq!(LogLevel::Error.as_str(), "error");
    }

    #[test]
    fn test_log_entry_new() {
        let entry = LogEntry::new(LogLevel::Info, "test message".to_string());
        assert_eq!(entry.level, LogLevel::Info);
        assert_eq!(entry.message, "test message");
        assert!(entry.metadata.is_none());
        assert!(entry.source.is_none());
    }

    #[test]
    fn test_log_entry_with_source() {
        let entry =
            LogEntry::with_source(LogLevel::Warn, "warning".to_string(), "gateway.chat".to_string());
        assert_eq!(entry.level, LogLevel::Warn);
        assert_eq!(entry.message, "warning");
        assert_eq!(entry.source, Some("gateway.chat".to_string()));
    }

    #[test]
    fn test_log_entry_serialization() {
        let entry = LogEntry::new(LogLevel::Error, "error message".to_string());
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"level\":\"error\""));
        assert!(json.contains("\"message\":\"error message\""));
    }

    #[test]
    fn test_log_query_filters_matches_level() {
        let entry = LogEntry::new(LogLevel::Warn, "test".to_string());
        let filters = LogQueryFilters {
            since: None,
            until: None,
            min_level: Some(LogLevel::Info),
            source: None,
            limit: None,
        };
        assert!(filters.matches(&entry)); // Warn >= Info

        let filters_strict = LogQueryFilters {
            since: None,
            until: None,
            min_level: Some(LogLevel::Error),
            source: None,
            limit: None,
        };
        assert!(!filters_strict.matches(&entry)); // Warn < Error
    }

    #[test]
    fn test_log_query_filters_matches_source() {
        let entry =
            LogEntry::with_source(LogLevel::Info, "test".to_string(), "gateway.chat".to_string());
        let filters = LogQueryFilters {
            since: None,
            until: None,
            min_level: None,
            source: Some("chat".to_string()),
            limit: None,
        };
        assert!(filters.matches(&entry)); // "gateway.chat" contains "chat"

        let filters_no_match = LogQueryFilters {
            since: None,
            until: None,
            min_level: None,
            source: Some("auth".to_string()),
            limit: None,
        };
        assert!(!filters_no_match.matches(&entry)); // "gateway.chat" does not contain "auth"
    }

    #[test]
    fn test_log_file_config_default() {
        let config = LogFileConfig::default();
        assert_eq!(config.max_file_size, 10 * 1024 * 1024);
        assert_eq!(config.max_files, 5);
    }
}
