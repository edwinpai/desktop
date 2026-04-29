/**
 * Verification Result Types and Contracts
 *
 * Type definitions for test suite verification, integration testing,
 * and comprehensive verification reporting across all phases.
 *
 * @module types/verification
 */

/**
 * Test Suite Result
 *
 * Represents the outcome of running a test suite (Rust cargo test, Frontend vitest, etc.)
 */
export interface TestSuiteResult {
  /** Name of the test suite (e.g., "Phase 1 Crypto Backend", "Frontend Components") */
  suiteName: string;

  /** Total number of tests in the suite */
  totalTests: number;

  /** Number of tests that passed */
  passing: number;

  /** Number of tests that failed */
  failing: number;

  /** Duration of test suite execution in milliseconds */
  duration: number;

  /** Array of error messages from failed tests */
  errors: string[];
}

/**
 * Integration Test Result
 *
 * Represents a single step in an integration test scenario
 * (e.g., BRC-103 handshake flow, channel encryption end-to-end)
 */
export interface IntegrationTestResult {
  /** Description of the integration test step */
  step: string;

  /** Status of this step: "pass" | "fail" | "skip" */
  status: "pass" | "fail" | "skip";

  /** ISO 8601 timestamp when this step was executed */
  timestamp: string;

  /** Optional path to screenshot (for E2E/Playwright tests) */
  screenshot?: string;

  /** Optional error message if status === "fail" */
  error?: string;
}

/**
 * Verification Report
 *
 * Comprehensive report aggregating all test suite results, integration tests,
 * pass rates, and final conclusion for a phase or full project verification.
 */
export interface VerificationReport {
  /** ISO 8601 timestamp when verification was completed */
  timestamp: string;

  /** Array of all test suite results (Rust, Frontend, E2E) */
  testResults: TestSuiteResult[];

  /** Array of all integration test results */
  integrationResults: IntegrationTestResult[];

  /** Pass rate percentages for different test categories */
  passRates: {
    /** Overall pass rate across all tests (0-100) */
    overall: number;

    /** Backend (Rust) pass rate (0-100) */
    backend: number;

    /** Frontend (TypeScript/React) pass rate (0-100) */
    frontend: number;

    /** End-to-end (Playwright) pass rate (0-100) */
    e2e: number;

    /** Integration test pass rate (0-100) */
    integration: number;
  };

  /** Final conclusion: "PASS" if all critical tests pass, "FAIL" otherwise */
  conclusion: "PASS" | "FAIL";
}
