/**
 * Phase 3 Report Schema Contracts
 *
 * Defines TypeScript interfaces for Phase 3 completion reporting, following
 * patterns established in Phase 1 (crypto backend) and Phase 2 (overlay/SPV).
 *
 * References:
 * - Phase 1: PHASE1_FINAL_DELIVERABLE.md, PHASE1_TEST_MANIFEST.md
 * - Phase 2: PHASE2_DELIVERABLES.md, PHASE2_FILE_MANIFEST.txt
 */

// ============================================================================
// (1) File Manifest Entry
// ============================================================================

export type FileStatus = 'new' | 'modified';

export interface FileManifestEntry {
  /** Absolute or relative path to the file */
  path: string;

  /** Whether this is a new file or modification of existing file */
  status: FileStatus;

  /** Total lines of code (excluding blank lines and comments) */
  lineCount: number;

  /** Brief description of file's purpose and responsibilities */
  purpose: string;

  /** Optional: Dependencies this file imports/requires */
  dependencies?: string[];

  /** Optional: Module category (e.g., "gateway", "discovery", "overlay") */
  category?: string;
}

// ============================================================================
// (2) Dependency Change
// ============================================================================

export type DependencyType = 'rust' | 'npm' | 'system';

export interface DependencyChange {
  /** Package/crate name (e.g., "tokio", "@bsv/sdk") */
  package: string;

  /** Version string (e.g., "1.42.0", "^2.0.0") */
  version: string;

  /** Explanation of why this dependency is needed */
  justification: string;

  /** Type of dependency */
  type: DependencyType;

  /** Optional: License information for audit trail */
  license?: string;

  /** Optional: Security audit status */
  audited?: boolean;
}

// ============================================================================
// (3) Test Coverage Summary
// ============================================================================

export type TestStatus = 'pass' | 'fail' | 'skipped' | 'pending';

export interface TestCategoryBreakdown {
  /** Category name (e.g., "Components", "SPV", "Crypto") */
  category: string;

  /** Number of tests in this category */
  count: number;

  /** Optional: Percentage coverage for this category */
  coverage?: number;
}

export interface TestCoverageSummary {
  /** Number of Rust unit tests */
  rustUnit: number;

  /** Number of Rust async tests (using #[tokio::test]) */
  rustAsync: number;

  /** Number of Rust integration tests (in tests/ directory) */
  rustIntegration: number;

  /** Frontend tests broken down by category */
  frontendByCategory: TestCategoryBreakdown[];

  /** Overall pass/fail status for the entire test suite */
  passFailStatus: TestStatus;

  /** Total test count (sum of all categories) */
  totalTests: number;

  /** Optional: Test execution time in milliseconds */
  executionTimeMs?: number;

  /** Optional: Overall code coverage percentage */
  overallCoverage?: number;

  /** Optional: Tests that were skipped with reason */
  skippedTests?: Array<{ name: string; reason: string }>;
}

// ============================================================================
// (4) Integration Checklist Item
// ============================================================================

export type EvidenceType =
  | 'test_output'
  | 'file_reference'
  | 'code_snippet'
  | 'documentation'
  | 'manual_verification';

export interface Evidence {
  /** Type of evidence provided */
  type: EvidenceType;

  /** Description or location of evidence */
  description: string;

  /** Optional: File path or URL reference */
  reference?: string;
}

export interface IntegrationChecklistItem {
  /** SPEC or PLAN requirement reference (e.g., "§7.2", "Phase 3 Task 2") */
  requirement: string;

  /** Whether this requirement has been verified as complete */
  verified: boolean;

  /** Evidence supporting verification status */
  evidence: Evidence | Evidence[];

  /** Optional: Additional notes or context */
  notes?: string;

  /** Optional: Blockers if not verified */
  blockers?: string[];
}

// ============================================================================
// (5) Deviation Entry
// ============================================================================

export type DeviationCategory =
  | 'architecture'
  | 'implementation'
  | 'testing'
  | 'dependency'
  | 'tooling'
  | 'specification';

export type DeviationImpact = 'none' | 'low' | 'medium' | 'high';

export interface DeviationEntry {
  /** Category of deviation from original plan/spec */
  category: DeviationCategory;

  /** Detailed description of what differs from plan/spec */
  description: string;

  /** Rationale for why deviation was necessary or beneficial */
  justification: string;

  /** Assessment of impact on project goals/timeline */
  impact: DeviationImpact;

  /** Optional: Reference to original requirement */
  originalRequirement?: string;

  /** Optional: Mitigation strategy if impact is medium/high */
  mitigation?: string;
}

// ============================================================================
// (6) Phase 4 Readiness Checklist
// ============================================================================

export type ReadinessStatus = 'ready' | 'blocked' | 'at_risk' | 'unknown';

export interface Phase4Prerequisite {
  /** Prerequisite description */
  item: string;

  /** Current status */
  status: ReadinessStatus;

  /** Optional: Blocking issues if not ready */
  blockingIssues?: string[];

  /** Optional: Estimated completion date if blocked */
  eta?: string;
}

export interface Phase4ReadinessChecklist {
  /** Overall readiness to begin Phase 4 */
  overallStatus: ReadinessStatus;

  /** List of prerequisites and their status */
  prerequisites: Phase4Prerequisite[];

  /** Code that must be completed before Phase 4 */
  codeCompleteness: {
    /** Phase 3 backend modules complete */
    backendComplete: boolean;

    /** Phase 3 frontend components complete */
    frontendComplete: boolean;

    /** All tests passing in CI */
    testsPassingInCI: boolean;
  };

  /** Documentation requirements */
  documentationCompleteness: {
    /** Implementation guide exists and is accurate */
    implementationGuide: boolean;

    /** API/IPC contracts documented */
    apiContractsDocumented: boolean;

    /** Integration examples provided */
    integrationExamples: boolean;
  };

  /** Infrastructure readiness */
  infrastructureReadiness: {
    /** CI pipeline passing for all targets */
    ciPipelinePassing: boolean;

    /** Build artifacts generated successfully */
    buildArtifactsGenerated: boolean;

    /** Dependencies audited and approved */
    dependenciesAudited: boolean;
  };

  /** Optional: Risks to Phase 4 start */
  risks?: Array<{ description: string; severity: DeviationImpact }>;

  /** Optional: Recommendations before starting Phase 4 */
  recommendations?: string[];
}

// ============================================================================
// Aggregate Report Structure
// ============================================================================

export interface Phase3CompletionReport {
  /** Report metadata */
  metadata: {
    generatedAt: string; // ISO 8601 timestamp
    phase: 'Phase 3';
    author: string;
    version: string;
  };

  /** File changes in this phase */
  fileManifest: FileManifestEntry[];

  /** Dependency changes */
  dependencies: DependencyChange[];

  /** Test coverage summary */
  testCoverage: TestCoverageSummary;

  /** Integration checklist against SPEC/PLAN */
  integrationChecklist: IntegrationChecklistItem[];

  /** Documented deviations from plan */
  deviations: DeviationEntry[];

  /** Phase 4 readiness assessment */
  phase4Readiness: Phase4ReadinessChecklist;

  /** Optional: Executive summary */
  summary?: {
    totalFilesChanged: number;
    totalLinesOfCode: number;
    totalTests: number;
    compliancePercentage: number;
    estimatedPhase4StartDate?: string;
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a Phase 3 completion report has all required fields
 * and meets minimum quality thresholds.
 */
export function validatePhase3Report(report: Phase3CompletionReport): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required sections
  if (!report.metadata) errors.push('Missing metadata section');
  if (!report.fileManifest || report.fileManifest.length === 0) {
    errors.push('File manifest is empty');
  }
  if (!report.testCoverage) errors.push('Missing test coverage summary');
  if (!report.integrationChecklist || report.integrationChecklist.length === 0) {
    warnings.push('Integration checklist is empty');
  }

  // Quality thresholds (based on Phase 1 & 2 standards)
  if (report.testCoverage) {
    const totalTests = report.testCoverage.totalTests;
    if (totalTests < 50) {
      warnings.push(`Test count (${totalTests}) below Phase 1/2 standards (>50)`);
    }

    if (report.testCoverage.passFailStatus !== 'pass') {
      errors.push('Test suite is not passing');
    }

    if (report.testCoverage.overallCoverage && report.testCoverage.overallCoverage < 85) {
      warnings.push(`Coverage (${report.testCoverage.overallCoverage}%) below 85% target`);
    }
  }

  // Readiness validation
  if (report.phase4Readiness?.overallStatus === 'blocked') {
    warnings.push('Phase 4 start is currently blocked');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculates summary statistics from a Phase 3 report
 */
export function calculatePhase3Summary(report: Phase3CompletionReport): NonNullable<Phase3CompletionReport['summary']> {
  const totalFilesChanged = report.fileManifest.length;
  const totalLinesOfCode = report.fileManifest.reduce((sum, f) => sum + f.lineCount, 0);
  const totalTests = report.testCoverage.totalTests;

  const verifiedItems = report.integrationChecklist.filter(item => item.verified).length;
  const totalItems = report.integrationChecklist.length;
  const compliancePercentage = totalItems > 0
    ? Math.round((verifiedItems / totalItems) * 100)
    : 0;

  return {
    totalFilesChanged,
    totalLinesOfCode,
    totalTests,
    compliancePercentage,
    estimatedPhase4StartDate: report.phase4Readiness.overallStatus === 'ready'
      ? new Date(Date.now() + 86400000).toISOString().split('T')[0] // Next day if ready
      : undefined
  };
}
