/**
 * Phase 6 Requirements Type Contracts (Rust)
 * Generated: 2026-02-11
 * Purpose: Rust equivalents of TypeScript phase6.ts types for backend validation
 * Status: Complete schemas for requirements document generation
 */

use serde::{Deserialize, Serialize};

/// Task group definition for phased implementation
/// Represents a logical grouping of related implementation work
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TaskGroup {
    /// Unique identifier for the task group
    pub id: String,

    /// Human-readable name describing the task group
    pub name: String,

    /// List of task group IDs that must complete before this one can start
    pub blocking_deps: Vec<String>,

    /// Criteria that must be met for this task group to be considered complete
    pub acceptance_criteria: Vec<String>,

    /// Estimated lines of code for this task group
    pub estimated_loc: usize,
}

/// Error category enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ErrorCategory {
    TypeScript,
    Rust,
}

/// Severity level enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

/// Error inventory categorization
/// Tracks known issues by category, severity, and affected files
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorInventory {
    /// Error category - either TypeScript or Rust compilation/test errors
    pub category: ErrorCategory,

    /// Total count of errors in this category
    pub count: usize,

    /// Severity level of the errors
    pub severity: Severity,

    /// List of files affected by these errors
    pub files_affected: Vec<String>,

    /// Optional description of the error type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Success criteria metric definition
/// Defines measurable targets for phase completion
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SuccessCriteria {
    /// Name of the metric being measured
    pub metric: String,

    /// Target value to achieve for success (stored as string for flexibility)
    pub target: String,

    /// Current baseline value before phase work begins
    pub current_baseline: String,

    /// Method used to verify this metric
    pub verification_method: String,

    /// Optional: whether this is a blocking criterion
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocking: Option<bool>,
}

/// Phase status enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PhaseStatus {
    NotStarted,
    InProgress,
    Complete,
    Blocked,
}

/// Phase implementation state tracking
/// Captures the current state of a phase's implementation progress
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PhaseState {
    /// Phase number (1-7 per PLAN.md)
    pub phase_num: u8,

    /// Current status of the phase
    pub status: PhaseStatus,

    /// Total number of files created/modified in this phase
    pub file_count: usize,

    /// Total lines of code written in this phase
    pub loc_count: usize,

    /// Total number of tests written for this phase
    pub test_count: usize,

    /// List of domain modules completed in this phase
    pub domains_completed: Vec<String>,

    /// Optional: list of blocking issues preventing completion
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocking_issues: Option<Vec<String>>,

    /// Optional: ISO 8601 timestamp when phase was started
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,

    /// Optional: ISO 8601 timestamp when phase was completed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

/// Phase dependency definition
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PhaseDependency {
    /// Dependent phase number
    pub phase_num: u8,

    /// Required deliverables from the dependent phase
    pub required_deliverables: Vec<String>,
}

/// Risk likelihood enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

/// Risk assessment entry
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Risk {
    /// Description of the risk
    pub description: String,

    /// Likelihood of the risk occurring
    pub likelihood: RiskLevel,

    /// Impact if the risk occurs
    pub impact: RiskLevel,

    /// Mitigation strategy
    pub mitigation: String,
}

/// Complete Phase 6 requirements document structure
/// Aggregates all requirement types for the phase
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Phase6Requirements {
    /// Phase metadata
    pub phase: PhaseState,

    /// Task groups defining implementation work
    pub task_groups: Vec<TaskGroup>,

    /// Known errors to be addressed
    pub error_inventory: Vec<ErrorInventory>,

    /// Success criteria for phase completion
    pub success_criteria: Vec<SuccessCriteria>,

    /// Optional: dependencies from previous phases
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase_dependencies: Option<Vec<PhaseDependency>>,

    /// Optional: risk assessment
    #[serde(skip_serializing_if = "Option::is_none")]
    pub risks: Option<Vec<Risk>>,
}

impl TaskGroup {
    /// Validates that the task group has all required fields populated
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("TaskGroup id cannot be empty".to_string());
        }
        if self.name.is_empty() {
            return Err("TaskGroup name cannot be empty".to_string());
        }
        if self.acceptance_criteria.is_empty() {
            return Err("TaskGroup must have at least one acceptance criterion".to_string());
        }
        if self.estimated_loc == 0 {
            return Err("TaskGroup estimated_loc must be greater than 0".to_string());
        }
        Ok(())
    }

    /// Checks if this task group has any blocking dependencies
    pub fn has_dependencies(&self) -> bool {
        !self.blocking_deps.is_empty()
    }
}

impl ErrorInventory {
    /// Returns true if this error is critical or high severity
    pub fn is_high_priority(&self) -> bool {
        matches!(self.severity, Severity::Critical | Severity::High)
    }

    /// Returns the total number of affected files
    pub fn affected_file_count(&self) -> usize {
        self.files_affected.len()
    }
}

impl SuccessCriteria {
    /// Returns true if this criterion is blocking
    pub fn is_blocking(&self) -> bool {
        self.blocking.unwrap_or(false)
    }
}

impl PhaseState {
    /// Returns true if the phase is complete
    pub fn is_complete(&self) -> bool {
        self.status == PhaseStatus::Complete
    }

    /// Returns true if the phase is blocked
    pub fn is_blocked(&self) -> bool {
        self.status == PhaseStatus::Blocked
    }

    /// Calculates test-to-code ratio (test LOC / production LOC)
    /// Returns None if loc_count is 0
    pub fn test_coverage_ratio(&self) -> Option<f64> {
        if self.loc_count == 0 {
            None
        } else {
            Some(self.test_count as f64 / self.loc_count as f64)
        }
    }
}

impl Phase6Requirements {
    /// Validates the entire requirements document structure
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Validate phase state
        if self.phase.phase_num < 1 || self.phase.phase_num > 7 {
            errors.push("Phase number must be between 1 and 7".to_string());
        }

        // Validate task groups
        for (idx, tg) in self.task_groups.iter().enumerate() {
            if let Err(e) = tg.validate() {
                errors.push(format!("TaskGroup[{}]: {}", idx, e));
            }
        }

        // Validate error inventory
        if self.error_inventory.is_empty() {
            errors.push("ErrorInventory cannot be empty - document known issues or mark as []".to_string());
        }

        // Validate success criteria
        if self.success_criteria.is_empty() {
            errors.push("SuccessCriteria cannot be empty - define measurable targets".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Returns all high-priority errors from the inventory
    pub fn high_priority_errors(&self) -> Vec<&ErrorInventory> {
        self.error_inventory
            .iter()
            .filter(|ei| ei.is_high_priority())
            .collect()
    }

    /// Returns all blocking success criteria
    pub fn blocking_criteria(&self) -> Vec<&SuccessCriteria> {
        self.success_criteria
            .iter()
            .filter(|sc| sc.is_blocking())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_group_validation() {
        let valid_tg = TaskGroup {
            id: "tg1".to_string(),
            name: "Test Group".to_string(),
            blocking_deps: vec![],
            acceptance_criteria: vec!["Criterion 1".to_string()],
            estimated_loc: 100,
        };
        assert!(valid_tg.validate().is_ok());

        let invalid_tg = TaskGroup {
            id: "".to_string(),
            name: "Test Group".to_string(),
            blocking_deps: vec![],
            acceptance_criteria: vec![],
            estimated_loc: 0,
        };
        assert!(invalid_tg.validate().is_err());
    }

    #[test]
    fn test_error_inventory_priority() {
        let critical = ErrorInventory {
            category: ErrorCategory::Rust,
            count: 5,
            severity: Severity::Critical,
            files_affected: vec!["file1.rs".to_string()],
            description: None,
        };
        assert!(critical.is_high_priority());

        let low = ErrorInventory {
            category: ErrorCategory::TypeScript,
            count: 2,
            severity: Severity::Low,
            files_affected: vec!["file2.ts".to_string()],
            description: None,
        };
        assert!(!low.is_high_priority());
    }

    #[test]
    fn test_phase_state_coverage_ratio() {
        let phase = PhaseState {
            phase_num: 6,
            status: PhaseStatus::InProgress,
            file_count: 10,
            loc_count: 1000,
            test_count: 500,
            domains_completed: vec!["ai_domain".to_string()],
            blocking_issues: None,
            started_at: None,
            completed_at: None,
        };
        assert_eq!(phase.test_coverage_ratio(), Some(0.5));
    }

    #[test]
    fn test_phase6_requirements_validation() {
        let valid_reqs = Phase6Requirements {
            phase: PhaseState {
                phase_num: 6,
                status: PhaseStatus::InProgress,
                file_count: 0,
                loc_count: 0,
                test_count: 0,
                domains_completed: vec![],
                blocking_issues: None,
                started_at: None,
                completed_at: None,
            },
            task_groups: vec![TaskGroup {
                id: "tg1".to_string(),
                name: "Group 1".to_string(),
                blocking_deps: vec![],
                acceptance_criteria: vec!["Criterion".to_string()],
                estimated_loc: 100,
            }],
            error_inventory: vec![],
            success_criteria: vec![SuccessCriteria {
                metric: "test_coverage".to_string(),
                target: "90%".to_string(),
                current_baseline: "85%".to_string(),
                verification_method: "npm run test".to_string(),
                blocking: Some(true),
            }],
            phase_dependencies: None,
            risks: None,
        };
        assert!(valid_reqs.validate().is_ok());
    }

    #[test]
    fn test_serde_roundtrip() {
        let reqs = Phase6Requirements {
            phase: PhaseState {
                phase_num: 6,
                status: PhaseStatus::Complete,
                file_count: 25,
                loc_count: 5000,
                test_count: 150,
                domains_completed: vec!["ai_domain".to_string()],
                blocking_issues: None,
                started_at: Some("2026-02-11T00:00:00Z".to_string()),
                completed_at: Some("2026-02-15T00:00:00Z".to_string()),
            },
            task_groups: vec![],
            error_inventory: vec![],
            success_criteria: vec![],
            phase_dependencies: None,
            risks: None,
        };

        let json = serde_json::to_string(&reqs).unwrap();
        let deserialized: Phase6Requirements = serde_json::from_str(&json).unwrap();
        assert_eq!(reqs, deserialized);
    }
}
