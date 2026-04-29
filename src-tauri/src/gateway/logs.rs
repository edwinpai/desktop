// Gateway Log Ring Buffer
//
// In-memory log storage using VecDeque ring buffer:
// - 500 entry capacity (FIFO eviction)
// - Thread-safe with Arc<Mutex<VecDeque<LogEntry>>>
// - Query/filter support
//
// SPEC References:
// - §7.5: Log management
// - Phase 7: AI provider integration

use super::log::{LogEntry, LogQueryFilters};
#[cfg(test)]
use super::log::LogLevel;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

/// Ring buffer capacity (max log entries)
const LOG_BUFFER_CAPACITY: usize = 500;

/// In-memory log ring buffer
pub struct LogRingBuffer {
    buffer: Arc<Mutex<VecDeque<LogEntry>>>,
    capacity: usize,
}

impl LogRingBuffer {
    /// Create a new log ring buffer with default capacity
    pub fn new() -> Self {
        Self::with_capacity(LOG_BUFFER_CAPACITY)
    }

    /// Create a log ring buffer with custom capacity
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            buffer: Arc::new(Mutex::new(VecDeque::with_capacity(capacity))),
            capacity,
        }
    }

    /// Append a log entry to the buffer
    ///
    /// If buffer is at capacity, removes oldest entry (FIFO).
    pub fn push(&self, entry: LogEntry) {
        let mut buffer = self.buffer.lock().unwrap();

        // Remove oldest if at capacity
        if buffer.len() >= self.capacity {
            buffer.pop_front();
        }

        buffer.push_back(entry);
    }

    /// Get all log entries (no filtering)
    pub fn get_all(&self) -> Vec<LogEntry> {
        let buffer = self.buffer.lock().unwrap();
        buffer.iter().cloned().collect()
    }

    /// Query log entries with filters
    pub fn query(&self, filters: &LogQueryFilters) -> Vec<LogEntry> {
        let buffer = self.buffer.lock().unwrap();

        let mut results: Vec<LogEntry> = buffer
            .iter()
            .filter(|entry| filters.matches(entry))
            .cloned()
            .collect();

        // Apply limit if specified
        if let Some(limit) = filters.limit {
            results.truncate(limit);
        }

        results
    }

    /// Get log entry count
    pub fn len(&self) -> usize {
        let buffer = self.buffer.lock().unwrap();
        buffer.len()
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        let buffer = self.buffer.lock().unwrap();
        buffer.is_empty()
    }

    /// Clear all log entries
    pub fn clear(&self) {
        let mut buffer = self.buffer.lock().unwrap();
        buffer.clear();
    }

    /// Get the most recent N log entries
    pub fn get_recent(&self, n: usize) -> Vec<LogEntry> {
        let buffer = self.buffer.lock().unwrap();
        let start = buffer.len().saturating_sub(n);
        buffer.iter().skip(start).cloned().collect()
    }
}

impl Default for LogRingBuffer {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_new() {
        let buffer = LogRingBuffer::new();
        assert_eq!(buffer.len(), 0);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_ring_buffer_push() {
        let buffer = LogRingBuffer::new();

        let entry1 = LogEntry::new(LogLevel::Info, "test 1".to_string());
        let entry2 = LogEntry::new(LogLevel::Warn, "test 2".to_string());

        buffer.push(entry1);
        buffer.push(entry2);

        assert_eq!(buffer.len(), 2);
        assert!(!buffer.is_empty());
    }

    #[test]
    fn test_ring_buffer_overflow() {
        let buffer = LogRingBuffer::with_capacity(3);

        // Push 5 entries (capacity is 3)
        for i in 1..=5 {
            let entry = LogEntry::new(LogLevel::Info, format!("message {}", i));
            buffer.push(entry);
        }

        // Should only have 3 entries (last 3)
        assert_eq!(buffer.len(), 3);

        let entries = buffer.get_all();
        assert_eq!(entries[0].message, "message 3");
        assert_eq!(entries[1].message, "message 4");
        assert_eq!(entries[2].message, "message 5");
    }

    #[test]
    fn test_ring_buffer_get_all() {
        let buffer = LogRingBuffer::new();

        buffer.push(LogEntry::new(LogLevel::Info, "test 1".to_string()));
        buffer.push(LogEntry::new(LogLevel::Warn, "test 2".to_string()));
        buffer.push(LogEntry::new(LogLevel::Error, "test 3".to_string()));

        let entries = buffer.get_all();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].message, "test 1");
        assert_eq!(entries[2].message, "test 3");
    }

    #[test]
    fn test_ring_buffer_query_level() {
        let buffer = LogRingBuffer::new();

        buffer.push(LogEntry::new(LogLevel::Debug, "debug".to_string()));
        buffer.push(LogEntry::new(LogLevel::Info, "info".to_string()));
        buffer.push(LogEntry::new(LogLevel::Warn, "warn".to_string()));
        buffer.push(LogEntry::new(LogLevel::Error, "error".to_string()));

        // Query for warnings and above
        let filters = LogQueryFilters {
            since: None,
            until: None,
            min_level: Some(LogLevel::Warn),
            source: None,
            limit: None,
        };

        let results = buffer.query(&filters);
        assert_eq!(results.len(), 2); // warn + error
        assert_eq!(results[0].level, LogLevel::Warn);
        assert_eq!(results[1].level, LogLevel::Error);
    }

    #[test]
    fn test_ring_buffer_query_limit() {
        let buffer = LogRingBuffer::new();

        for i in 1..=10 {
            buffer.push(LogEntry::new(LogLevel::Info, format!("message {}", i)));
        }

        // Query with limit
        let filters = LogQueryFilters {
            since: None,
            until: None,
            min_level: None,
            source: None,
            limit: Some(5),
        };

        let results = buffer.query(&filters);
        assert_eq!(results.len(), 5);
    }

    #[test]
    fn test_ring_buffer_clear() {
        let buffer = LogRingBuffer::new();

        buffer.push(LogEntry::new(LogLevel::Info, "test".to_string()));
        assert_eq!(buffer.len(), 1);

        buffer.clear();
        assert_eq!(buffer.len(), 0);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_ring_buffer_get_recent() {
        let buffer = LogRingBuffer::new();

        for i in 1..=10 {
            buffer.push(LogEntry::new(LogLevel::Info, format!("message {}", i)));
        }

        // Get last 3 entries
        let recent = buffer.get_recent(3);
        assert_eq!(recent.len(), 3);
        assert_eq!(recent[0].message, "message 8");
        assert_eq!(recent[1].message, "message 9");
        assert_eq!(recent[2].message, "message 10");
    }

    #[test]
    fn test_ring_buffer_get_recent_empty() {
        let buffer = LogRingBuffer::new();
        let recent = buffer.get_recent(5);
        assert_eq!(recent.len(), 0);
    }
}
