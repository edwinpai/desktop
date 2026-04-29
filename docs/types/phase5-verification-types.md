# Phase 5 Verification Contract Types

**Date**: 2026-02-11
**Phase**: 5 (Channels)
**Purpose**: Type definitions for verification output and validation reports

---

## Type Definitions

### 1. TestExecutionResult

Records outcome of individual test execution.

```typescript
interface TestExecutionResult {
  test_name: string;           // Fully qualified test name (e.g., "channelStore::test_create_channel")
  status: TestStatus;          // Pass | Fail | Skip | Timeout
  duration: number;            // Execution time in milliseconds
  error_msg: string | null;    // Error message if status === Fail, otherwise null
  suite: string;               // Test suite name (e.g., "Frontend", "Backend", "E2E")
  file_path: string;           // Relative path to test file
  line_number: number | null;  // Line number of failure (if applicable)
}

enum TestStatus {
  Pass = "pass",
  Fail = "fail",
  Skip = "skip",
  Timeout = "timeout"
}

// Aggregate summary
interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  timeout: number;
  pass_rate: number;           // Percentage (0-100)
  total_duration: number;      // Total execution time in milliseconds
  results: TestExecutionResult[];
}
```

**Example**:
```json
{
  "test_name": "channel_domain::encryption::test_encrypt_credentials",
  "status": "pass",
  "duration": 23,
  "error_msg": null,
  "suite": "Backend",
  "file_path": "src-tauri/src/channel_domain/encryption.rs",
  "line_number": null
}
```

---

### 2. ImportResolutionReport

Validates Rust module imports and dependencies.

```typescript
interface ImportResolutionReport {
  file_path: string;                    // Relative path (e.g., "src-tauri/src/channel_domain/mod.rs")
  imports: ImportDeclaration[];         // All import statements in file
  resolved: string[];                   // Successfully resolved import paths
  unresolved: UnresolvedImport[];       // Failed imports with reason
  circular_dependencies: string[][];    // Detected cycles (array of import chains)
  external_crates: string[];            // Third-party dependencies used
  loc: number;                          // Lines of code (excluding comments/blanks)
}

interface ImportDeclaration {
  module: string;                       // Module path (e.g., "crate::crypto_domain::types")
  items: string[];                      // Imported items (e.g., ["KeyPair", "SignRequest"])
  is_wildcard: boolean;                 // true if `use module::*;`
  line_number: number;                  // Line in source file
}

interface UnresolvedImport {
  module: string;
  reason: ImportFailureReason;
  suggestion: string | null;            // Suggested fix if available
}

enum ImportFailureReason {
  ModuleNotFound = "module_not_found",
  ItemNotExported = "item_not_exported",
  CircularDependency = "circular_dependency",
  VisibilityError = "visibility_error"
}

// Aggregate summary
interface ImportResolutionSummary {
  total_files: number;
  total_imports: number;
  resolved_count: number;
  unresolved_count: number;
  circular_dependency_count: number;
  reports: ImportResolutionReport[];
}
```

**Example**:
```json
{
  "file_path": "src-tauri/src/channel_domain/config.rs",
  "imports": [
    {
      "module": "crate::crypto_domain::brc42",
      "items": ["derive_key", "EncryptionKey"],
      "is_wildcard": false,
      "line_number": 3
    }
  ],
  "resolved": ["crate::crypto_domain::brc42"],
  "unresolved": [],
  "circular_dependencies": [],
  "external_crates": ["serde", "tokio", "hex"],
  "loc": 651
}
```

---

### 3. CommandRegistrationCheck

Validates Tauri IPC command registration.

```typescript
interface CommandRegistrationCheck {
  command_name: string;               // IPC command name (e.g., "create_channel")
  registered: boolean;                // true if found in tauri::Builder::invoke_handler
  handler_path: string;               // Relative path to handler function
  handler_function: string;           // Function name (e.g., "create_channel_cmd")
  signature: CommandSignature;        // Function signature validation
  phase: number;                      // Phase where command was introduced (1-7)
  dependencies: string[];             // Required domain modules
}

interface CommandSignature {
  parameters: Parameter[];
  return_type: string;                // Return type (e.g., "Result<Channel, String>")
  is_async: boolean;                  // true if async fn
  line_number: number;                // Line in handler file
}

interface Parameter {
  name: string;
  param_type: string;                 // Type annotation (e.g., "State<'_, AppState>")
  is_state: boolean;                  // true if Tauri State<> parameter
}

// Aggregate summary
interface CommandRegistrationSummary {
  total_commands: number;
  registered_count: number;
  unregistered_count: number;
  phase_breakdown: { [phase: number]: number };  // Commands per phase
  checks: CommandRegistrationCheck[];
}
```

**Example**:
```json
{
  "command_name": "create_channel",
  "registered": true,
  "handler_path": "src-tauri/src/commands/channels.rs",
  "handler_function": "create_channel_cmd",
  "signature": {
    "parameters": [
      { "name": "name", "param_type": "String", "is_state": false },
      { "name": "platform", "param_type": "Platform", "is_state": false },
      { "name": "credentials", "param_type": "PlatformCredentials", "is_state": false }
    ],
    "return_type": "Result<Channel, String>",
    "is_async": true,
    "line_number": 42
  },
  "phase": 5,
  "dependencies": ["channel_domain::config", "crypto_domain::brc42"]
}
```

---

### 4. BuildToolResult

Records output from build/validation tools.

```typescript
interface BuildToolResult {
  tool: BuildTool;                    // Tool identifier
  exit_code: number;                  // Process exit code (0 = success)
  errors: BuildDiagnostic[];          // Error-level issues
  warnings: BuildDiagnostic[];        // Warning-level issues
  duration: number;                   // Execution time in milliseconds
  command: string;                    // Full command executed
  stdout_summary: string;             // First 500 chars of stdout
  success: boolean;                   // exit_code === 0 && errors.length === 0
}

enum BuildTool {
  CargoCheck = "cargo check",
  CargoTest = "cargo test",
  CargoClippy = "cargo clippy",
  Tsc = "tsc",
  EslintCheck = "eslint",
  ViteBuild = "vite build",
  Vitest = "vitest",
  PlaywrightTest = "playwright test"
}

interface BuildDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  file_path: string | null;           // Null if not file-specific
  line_number: number | null;
  column: number | null;
  code: string | null;                // Error code (e.g., "E0425", "TS2304")
  suggestion: string | null;          // Compiler suggestion if available
}

// Aggregate summary
interface BuildToolSummary {
  total_tools: number;
  successful_count: number;
  failed_count: number;
  total_errors: number;
  total_warnings: number;
  total_duration: number;
  results: BuildToolResult[];
}
```

**Example**:
```json
{
  "tool": "cargo test",
  "exit_code": 0,
  "errors": [],
  "warnings": [
    {
      "severity": "warning",
      "message": "unused import: `chrono::Duration`",
      "file_path": "src-tauri/src/channel_domain/validation.rs",
      "line_number": 5,
      "column": 17,
      "code": "unused_imports",
      "suggestion": "remove the unused import"
    }
  ],
  "duration": 8420,
  "command": "cargo test --workspace --all-features",
  "stdout_summary": "running 69 tests\ntest channel_domain::config::tests::test_create_channel ... ok\n...",
  "success": true
}
```

---

## Composite Verification Report

Top-level report aggregating all verification types.

```typescript
interface Phase5VerificationReport {
  phase: number;                      // 5
  generated_at: string;               // ISO 8601 timestamp
  commit_hash: string | null;         // Git commit (null if not in repo)

  // Test execution
  test_summary: TestSummary;

  // Import validation
  import_summary: ImportResolutionSummary;

  // Command registration
  command_summary: CommandRegistrationSummary;

  // Build tools
  build_summary: BuildToolSummary;

  // File manifest
  file_manifest: {
    total_files: number;
    total_loc: number;                // Production code only
    test_loc: number;
    backend_files: number;
    frontend_files: number;
    test_files: number;
  };

  // Quality metrics
  quality_metrics: {
    backend_test_coverage: number;    // Percentage (0-100)
    frontend_test_coverage: number;
    test_to_code_ratio: number;       // test_loc / total_loc
    pass_rate: number;                // Percentage (0-100)
  };

  // Phase completion criteria
  completion_criteria: {
    all_tests_pass: boolean;          // target: true
    backend_coverage_target_met: boolean;  // target: >90%
    frontend_coverage_target_met: boolean; // target: >85%
    all_commands_registered: boolean; // target: true
    no_import_errors: boolean;        // target: true
    all_builds_succeed: boolean;      // target: true
  };

  // Overall status
  status: "COMPLETE" | "INCOMPLETE" | "BLOCKED";
  blocking_issues: string[];          // Empty if status === "COMPLETE"
}
```

---

## Type Index for Verification Output

### File: `phase5-verification-output/type-index.json`

```json
{
  "version": "1.0.0",
  "generated_at": "2026-02-11T00:00:00Z",
  "types": {
    "TestExecutionResult": {
      "file": "types/test-execution.ts",
      "description": "Individual test outcome with duration and error details",
      "schema_version": "1.0"
    },
    "TestSummary": {
      "file": "types/test-execution.ts",
      "description": "Aggregate test results across all suites",
      "schema_version": "1.0"
    },
    "ImportResolutionReport": {
      "file": "types/import-resolution.ts",
      "description": "Rust module import validation per file",
      "schema_version": "1.0"
    },
    "ImportResolutionSummary": {
      "file": "types/import-resolution.ts",
      "description": "Aggregate import validation across workspace",
      "schema_version": "1.0"
    },
    "CommandRegistrationCheck": {
      "file": "types/command-registration.ts",
      "description": "Tauri IPC command registration validation",
      "schema_version": "1.0"
    },
    "CommandRegistrationSummary": {
      "file": "types/command-registration.ts",
      "description": "Aggregate command registration status",
      "schema_version": "1.0"
    },
    "BuildToolResult": {
      "file": "types/build-tools.ts",
      "description": "Build/validation tool execution outcome",
      "schema_version": "1.0"
    },
    "BuildToolSummary": {
      "file": "types/build-tools.ts",
      "description": "Aggregate build tool results",
      "schema_version": "1.0"
    },
    "Phase5VerificationReport": {
      "file": "types/verification-report.ts",
      "description": "Composite report for Phase 5 completion validation",
      "schema_version": "1.0"
    }
  },
  "output_files": {
    "test_results": "phase5-verification-output/test-summary.json",
    "import_validation": "phase5-verification-output/import-resolution.json",
    "command_check": "phase5-verification-output/command-registration.json",
    "build_results": "phase5-verification-output/build-tools.json",
    "final_report": "phase5-verification-output/verification-report.json"
  },
  "validation_scripts": {
    "run_all_tests": "scripts/verify-tests.sh",
    "check_imports": "scripts/verify-imports.sh",
    "validate_commands": "scripts/verify-commands.sh",
    "run_builds": "scripts/verify-builds.sh",
    "generate_report": "scripts/generate-verification-report.sh"
  }
}
```

---

## Usage Examples

### 1. Test Execution Validation

```bash
# Run all tests and generate TestSummary
cargo test --workspace --all-features --no-fail-fast -- --format json > backend-tests.json
npm run test -- --reporter=json > frontend-tests.json

# Parse and aggregate into TestSummary
node scripts/aggregate-test-results.js \
  --backend backend-tests.json \
  --frontend frontend-tests.json \
  --output phase5-verification-output/test-summary.json
```

### 2. Import Resolution Check

```bash
# Validate all Rust imports
cargo check --workspace --all-features --message-format=json 2>&1 | \
  node scripts/parse-import-errors.js > phase5-verification-output/import-resolution.json
```

### 3. Command Registration Audit

```bash
# Extract registered commands from lib.rs and validate handlers exist
node scripts/validate-command-registration.js \
  --lib-rs src-tauri/src/lib.rs \
  --commands-dir src-tauri/src/commands \
  --output phase5-verification-output/command-registration.json
```

### 4. Build Tool Execution

```bash
# Run all build tools and capture results
./scripts/run-all-builds.sh > phase5-verification-output/build-tools.json
```

---

## Quality Targets (Phase 5)

Based on Phase 4 metrics and MEMORY.md requirements:

| Metric | Target | Phase 5 Status |
|--------|--------|----------------|
| Backend test coverage | >90% | ✅ 97.1% (69 tests, 34 unit + 35 integration) |
| Frontend test coverage | >85% | ⚠️ 51.8% (110 tests, 57 passing / 43 failing) |
| Test-to-code ratio | 40-60% | ✅ 80.4% (1,930 test LOC / 2,399 production LOC) |
| Test pass rate | >95% | ⚠️ 51.8% (needs wizard test fixes) |
| Command registration | 100% | ✅ 8/8 commands registered |
| Import resolution | 100% | ✅ 0 unresolved imports |
| Build success | 100% | ⏳ Awaiting CI validation |

---

## Related Documentation

- **Phase 4 Verification**: `phase4-verification-report.md` [1]
- **Phase 1 Test Manifest**: `phase1-test-manifest.md` [2]
- **Phase 2 Test Strategy**: `PHASE2_TEST_MANIFEST.md`
- **Import Resolution (Phase 1)**: `import-resolution-report.md` [3]
- **Type Contracts (Phase 4)**: `phase4-type-contracts-validation.md` [4]

---

## Schema Validation

All JSON output should validate against JSON Schema:

```typescript
// TypeScript interfaces above serve as documentation
// Generate JSON Schema with: npx typescript-json-schema tsconfig.json Phase5VerificationReport
```

---

**Next Steps**:
1. Implement validation scripts in `scripts/` directory
2. Run verification suite in CI pipeline
3. Generate final Phase 5 verification report
4. Update MEMORY.md with Phase 5 completion status

---

**References**:
[1] edwinpai-desktop/phase4-verification-report.md
[2] edwinpai-desktop/phase1-test-manifest.md
[3] edwinpai-desktop/import-resolution-report.md
[4] edwinpai-desktop/phase4-type-contracts-validation.md
