// Audit log writer (SPEC §3.6)
//
// Append-only structured log of all Crypto Domain operations.
// Logs are stored at ~/.edwinpai/audit/crypto.jsonl (JSON Lines format).

use chrono::Utc;
use std::fs::{create_dir_all, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

use super::traits::AuditLogger;
use super::types::{AuditLogEntry, CryptoError, CryptoErrorCode, CryptoResult};

pub struct FileAuditLogger {
    log_path: PathBuf,
}

impl FileAuditLogger {
    pub fn new() -> CryptoResult<Self> {
        // Use platform-specific data directory
        // Linux: ~/.local/share/com.edwinpai.desktop/audit/
        // macOS: ~/Library/Application Support/com.edwinpai.desktop/audit/
        // Windows: %APPDATA%/com.edwinpai.desktop/audit/
        let data_dir = dirs::data_local_dir()
            .ok_or_else(|| CryptoError {
                code: CryptoErrorCode::KeychainUnavailable,
                message: "Cannot determine platform data directory".to_string(),
            })?;

        let log_dir = data_dir.join("com.edwinpai.desktop").join("audit");
        create_dir_all(&log_dir).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Cannot create audit directory: {}", e),
        })?;

        let log_path = log_dir.join("crypto.jsonl");

        Ok(Self { log_path })
    }
}

impl AuditLogger for FileAuditLogger {
    fn append(&self, entry: AuditLogEntry) -> CryptoResult<()> {
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
            .map_err(|e| CryptoError {
                code: CryptoErrorCode::KeychainUnavailable,
                message: format!("Cannot open audit log: {}", e),
            })?;

        let json = serde_json::to_string(&entry).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Cannot serialize audit entry: {}", e),
        })?;

        writeln!(file, "{}", json).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Cannot write audit log: {}", e),
        })?;

        Ok(())
    }

    fn read(&self, limit: Option<usize>) -> CryptoResult<Vec<AuditLogEntry>> {
        if !self.log_path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(&self.log_path).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Cannot open audit log: {}", e),
        })?;

        let reader = BufReader::new(file);
        let mut entries = Vec::new();

        for line in reader.lines() {
            let line = line.map_err(|e| CryptoError {
                code: CryptoErrorCode::KeychainUnavailable,
                message: format!("Cannot read audit log line: {}", e),
            })?;

            if line.trim().is_empty() {
                continue;
            }

            let entry: AuditLogEntry = serde_json::from_str(&line).map_err(|e| CryptoError {
                code: CryptoErrorCode::KeychainUnavailable,
                message: format!("Cannot parse audit entry: {}", e),
            })?;

            entries.push(entry);

            if let Some(max) = limit {
                if entries.len() >= max {
                    break;
                }
            }
        }

        Ok(entries)
    }

    fn count(&self) -> CryptoResult<usize> {
        if !self.log_path.exists() {
            return Ok(0);
        }

        let file = File::open(&self.log_path).map_err(|e| CryptoError {
            code: CryptoErrorCode::KeychainUnavailable,
            message: format!("Cannot open audit log: {}", e),
        })?;

        let reader = BufReader::new(file);
        Ok(reader.lines().filter_map(Result::ok).filter(|l| !l.trim().is_empty()).count())
    }
}

impl Default for FileAuditLogger {
    fn default() -> Self {
        Self::new().expect("Failed to initialize audit logger")
    }
}

/// Helper to create an audit log entry
pub fn create_audit_entry(
    operation: super::types::AuditOperation,
    success: bool,
    error: Option<String>,
) -> AuditLogEntry {
    AuditLogEntry {
        timestamp: Utc::now().to_rfc3339(),
        operation,
        protocol_id: None,
        key_id: None,
        counterparty: None,
        payload_hash: None,
        success,
        error,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::types::AuditOperation;

    #[test]
    fn test_audit_log_lifecycle() {
        let logger = FileAuditLogger::new().unwrap();

        let entry = create_audit_entry(AuditOperation::GetIdentity, true, None);

        // Append
        let result = logger.append(entry);
        assert!(result.is_ok());

        // Read
        let entries = logger.read(Some(10)).unwrap();
        assert!(!entries.is_empty());

        // Count
        let count = logger.count().unwrap();
        assert!(count > 0);
    }
}
