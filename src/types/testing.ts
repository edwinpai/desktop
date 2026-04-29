/**
 * Test Contracts and Mock Interfaces for EdwinPAI Desktop
 *
 * This module defines type-safe test fixtures, mock interfaces, and validation
 * helpers for frontend unit, integration, and E2E testing. These types mirror
 * Rust test contracts in src-tauri/src/test_types.rs to ensure consistency.
 *
 * Organization:
 * (1) Crypto test types (BRC42TestVector, KeychainMock, AuditLogMock)
 * (2) Integration test types (IPCTestScenario, SubscriptionFSMState, ChannelEncryptionTestCase)
 * (3) Frontend test types (HookTestWrapper, StoreTestFixture, E2EPageObject)
 * (4) Coverage report schemas (CoverageThreshold, TestManifest)
 */

import type { ReactElement, ReactNode } from 'react';
import type { RenderOptions } from '@testing-library/react';

// ============================================================================
// (1) Crypto Test Types
// ============================================================================

/**
 * BRC-42 official test vector
 * Maps to Rust BRC42TestVector in test_types.rs
 */
export interface BRC42TestVector {
  /** Test vector identifier (e.g., "vector_01", "vector_02") */
  id: string;
  /** Human-readable description */
  description: string;
  /** Sender's private key (64-char hex string) */
  senderPrivateKey: string;
  /** Recipient's public key (66-char compressed hex) */
  recipientPublicKey: string;
  /** Invoice number for derivation */
  invoiceNumber: string;
  /** Expected derived public key (66-char compressed hex) */
  expectedPublicKey: string;
  /** Expected derived private key (64-char hex string) */
  expectedPrivateKey: string;
  /** Whether this tests counterparty derivation */
  isCounterparty?: boolean;
}

/**
 * BRC-42 derivation test result
 */
export interface BRC42TestResult {
  vectorId: string;
  passed: boolean;
  publicKeyMatch: boolean;
  privateKeyMatch: boolean;
  actualPublicKey?: string;
  actualPrivateKey?: string;
  error?: string;
}

/**
 * Keychain mock for testing
 * Simulates OS keychain without touching system keyring
 */
export class KeychainMock {
  private storage = new Map<string, string>();
  private errorScenarios = new Map<string, string>();

  /** Configure mock to return error for specific service */
  withError(service: string, error: string): this {
    this.errorScenarios.set(service, error);
    return this;
  }

  /** Store password in mock keychain */
  setPassword(service: string, password: string): void {
    const error = this.errorScenarios.get(service);
    if (error) {
      throw new Error(error);
    }
    this.storage.set(service, password);
  }

  /** Retrieve password from mock keychain */
  getPassword(service: string): string {
    const error = this.errorScenarios.get(service);
    if (error) {
      throw new Error(error);
    }
    const password = this.storage.get(service);
    if (!password) {
      throw new Error(`Password not found for service: ${service}`);
    }
    return password;
  }

  /** Delete password from mock keychain */
  deletePassword(service: string): void {
    const error = this.errorScenarios.get(service);
    if (error) {
      throw new Error(error);
    }
    this.storage.delete(service);
  }

  /** Clear all mock data */
  clear(): void {
    this.storage.clear();
    this.errorScenarios.clear();
  }
}

/**
 * Audit log mock for testing
 */
export class AuditLogMock {
  private entries: Array<{
    timestamp: string;
    operation: string;
    success: boolean;
    error?: string;
  }> = [];
  private writeFailure = false;

  /** Configure mock to fail writes */
  withWriteFailure(): this {
    this.writeFailure = true;
    return this;
  }

  /** Log an entry */
  log(entry: {
    timestamp: string;
    operation: string;
    success: boolean;
    error?: string;
  }): void {
    if (this.writeFailure) {
      throw new Error('Mock write failure');
    }
    this.entries.push(entry);
  }

  /** Read all entries */
  readAll(): typeof this.entries {
    return [...this.entries];
  }

  /** Read filtered entries */
  readFiltered(predicate: (entry: typeof this.entries[0]) => boolean): typeof this.entries {
    return this.entries.filter(predicate);
  }

  /** Clear all entries */
  clear(): void {
    this.entries = [];
    this.writeFailure = false;
  }
}

// ============================================================================
// (2) Integration Test Types
// ============================================================================

/**
 * IPC test scenario
 * Maps to Rust IPCTestScenario in test_types.rs
 */
export interface IPCTestScenario {
  /** Scenario identifier */
  id: string;
  /** Description of what this tests */
  description: string;
  /** Command to invoke */
  command: string;
  /** Request payload */
  request: unknown;
  /** Expected response */
  expectedResponse: unknown;
  /** Expected error (if any) */
  expectedError?: string;
  /** Setup steps (e.g., "create_keychain", "start_gateway") */
  setupSteps: string[];
  /** Teardown steps */
  teardownSteps: string[];
}

/**
 * Subscription FSM state for testing
 * Maps to Rust SubscriptionFSMState in test_types.rs
 */
export type SubscriptionFSMState =
  | { type: 'NotFound' }
  | {
      type: 'Active';
      txid: string;
      vout: number;
      verifiedAt: string;
    }
  | {
      type: 'Cached';
      txid: string;
      vout: number;
      verifiedAt: string;
    }
  | {
      type: 'Expired';
      txid: string;
      vout: number;
      verifiedAt: string;
    }
  | {
      type: 'GraceExceeded';
      txid: string;
      vout: number;
      verifiedAt: string;
    };

/**
 * Transition subscription FSM state based on elapsed time
 */
export function transitionSubscriptionState(
  state: SubscriptionFSMState,
  elapsedHours: number
): SubscriptionFSMState {
  if (state.type === 'Active') {
    if (elapsedHours >= 72) {
      return {
        type: 'Expired',
        txid: state.txid,
        vout: state.vout,
        verifiedAt: new Date().toISOString(),
      };
    } else if (elapsedHours >= 24) {
      return {
        type: 'Cached',
        txid: state.txid,
        vout: state.vout,
        verifiedAt: new Date().toISOString(),
      };
    }
  } else if (state.type === 'Cached' && elapsedHours >= 72) {
    return {
      type: 'Expired',
      txid: state.txid,
      vout: state.vout,
      verifiedAt: new Date().toISOString(),
    };
  } else if (state.type === 'Expired' && elapsedHours >= 168) {
    // 7 days
    return {
      type: 'GraceExceeded',
      txid: state.txid,
      vout: state.vout,
      verifiedAt: new Date().toISOString(),
    };
  }
  return state;
}

/**
 * Channel encryption test case (Phase 5)
 */
export interface ChannelEncryptionTestCase {
  id: string;
  description: string;
  /** Channel name (used as BRC-42 keyID) */
  channelName: string;
  /** Plaintext credentials (JSON string) */
  plaintext: string;
  /** Expected ciphertext format (hex-encoded) */
  expectedFormat: string;
  /** Whether decryption should succeed */
  shouldDecrypt: boolean;
}

// ============================================================================
// (3) Frontend Test Types
// ============================================================================

/**
 * Hook test wrapper
 * Provides utilities for testing React hooks in isolation
 */
export interface HookTestWrapper<TProps = unknown> {
  /** Wrapper component (e.g., for context providers) */
  wrapper?: React.ComponentType<{ children: ReactNode }>;
  /** Initial props for the hook */
  initialProps?: TProps;
  /** Mock dependencies */
  mocks?: {
    tauri?: MockTauriInvoke;
    router?: Partial<MockRouter>;
    store?: unknown;
  };
}

/**
 * Store test fixture
 * Provides utilities for testing Zustand stores
 */
export interface StoreTestFixture<TState> {
  /** Store instance */
  store: {
    getState: () => TState;
    setState: (partial: Partial<TState>) => void;
    subscribe: (listener: (state: TState) => void) => () => void;
  };
  /** Initial state */
  initialState: TState;
  /** Reset store to initial state */
  reset: () => void;
  /** Wait for state update */
  waitForState: (predicate: (state: TState) => boolean, timeout?: number) => Promise<TState>;
}

/**
 * E2E page object
 * Encapsulates page interactions for Playwright tests
 */
export interface E2EPageObject {
  /** Navigate to page */
  goto(url?: string): Promise<void>;
  /** Wait for element */
  waitFor(selector: string, timeout?: number): Promise<void>;
  /** Click element */
  click(selector: string): Promise<void>;
  /** Fill input */
  fill(selector: string, value: string): Promise<void>;
  /** Get text content */
  getText(selector: string): Promise<string>;
  /** Check if element is visible */
  isVisible(selector: string): Promise<boolean>;
  /** Take screenshot */
  screenshot(name: string): Promise<void>;
}

/**
 * Mock Tauri invoke function
 */
export type MockTauriInvoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
) => Promise<T>;

/**
 * Tauri mock context
 */
export interface TauriMockContext {
  /** Mock invoke function */
  invoke: MockTauriInvoke;
  /** Mock event emitter */
  emit: (event: string, payload?: unknown) => void;
  /** Mock event listener */
  listen: (event: string, handler: (event: unknown) => void) => () => void;
  /** Reset all mocks */
  reset: () => void;
}

/**
 * Mock router for navigation testing
 */
export interface MockRouter {
  pathname: string;
  query: Record<string, string | string[]>;
  push: (url: string) => Promise<void>;
  replace: (url: string) => Promise<void>;
  back: () => void;
}

/**
 * Custom render options for React Testing Library
 * Includes providers and default mocks
 */
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route */
  initialRoute?: string;
  /** Mock Tauri context */
  tauriMock?: Partial<TauriMockContext>;
  /** Mock router */
  routerMock?: Partial<MockRouter>;
  /** Store initial state */
  storeState?: Record<string, unknown>;
  /** User session */
  userSession?: {
    publicKey: string;
    petname: string;
    accessLevel: 'Owner' | 'Member' | 'Guest';
  };
}

/**
 * Custom render result
 */
export interface CustomRenderResult {
  /** Testing Library utilities */
  container: HTMLElement;
  baseElement: HTMLElement;
  debug: (el?: HTMLElement) => void;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
  asFragment: () => DocumentFragment;
  /** Custom utilities */
  tauriMock: TauriMockContext;
  routerMock: MockRouter;
  /** Wait for next render */
  waitForNextUpdate: () => Promise<void>;
}

/**
 * Component test fixture builder
 */
export interface ComponentTestFixture<TProps = Record<string, unknown>> {
  /** Component props */
  props: TProps;
  /** Render options */
  options?: CustomRenderOptions;
  /** Setup function (called before render) */
  setup?: () => void | Promise<void>;
  /** Teardown function (called after unmount) */
  teardown?: () => void | Promise<void>;
}

// ============================================================================
// (4) Coverage Report Schemas
// ============================================================================

/**
 * Coverage thresholds
 * Maps to Rust CoverageThreshold in test_types.rs
 */
export interface CoverageThreshold {
  /** Minimum line coverage percentage (0-100) */
  lineCoverage: number;
  /** Minimum branch coverage percentage (0-100) */
  branchCoverage: number;
  /** Minimum function coverage percentage (0-100) */
  functionCoverage: number;
}

/**
 * Default coverage thresholds
 */
export const DEFAULT_COVERAGE_THRESHOLD: CoverageThreshold = {
  lineCoverage: 85,
  branchCoverage: 80,
  functionCoverage: 90,
};

/**
 * Coverage report
 */
export interface CoverageReport {
  /** Line coverage percentage */
  lineCoverage: number;
  /** Branch coverage percentage */
  branchCoverage: number;
  /** Function coverage percentage */
  functionCoverage: number;
  /** Per-file coverage (filepath -> percentage) */
  fileCoverage: Record<string, number>;
}

/**
 * Test manifest
 * Maps to Rust TestManifest in test_types.rs
 */
export interface TestManifest {
  /** Phase identifier */
  phase: string;
  /** Total tests */
  totalTests: number;
  /** Passing tests */
  passingTests: number;
  /** Failing tests */
  failingTests: number;
  /** Skipped tests */
  skippedTests: number;
  /** Test categories (category -> count) */
  categories: Record<string, number>;
  /** Coverage threshold */
  coverageThreshold: CoverageThreshold;
  /** Actual coverage */
  actualCoverage?: CoverageReport;
}

/**
 * Calculate test manifest pass rate
 */
export function calculatePassRate(manifest: TestManifest): number {
  if (manifest.totalTests === 0) {
    return 0;
  }
  return (manifest.passingTests / manifest.totalTests) * 100;
}

/**
 * Check if coverage meets threshold
 */
export function meetsThreshold(manifest: TestManifest): boolean {
  if (!manifest.actualCoverage) {
    return false;
  }
  const { actualCoverage, coverageThreshold } = manifest;
  return (
    actualCoverage.lineCoverage >= coverageThreshold.lineCoverage &&
    actualCoverage.branchCoverage >= coverageThreshold.branchCoverage &&
    actualCoverage.functionCoverage >= coverageThreshold.functionCoverage
  );
}

// ============================================================================
// Test Utilities & Helpers
// ============================================================================

/**
 * Test fixture builder
 */
export class TestFixtureBuilder<T extends Record<string, unknown>> {
  constructor(private data: T) {}

  update(updater: (data: T) => Partial<T>): this {
    this.data = { ...this.data, ...updater(this.data) };
    return this;
  }

  build(): T {
    return this.data;
  }
}

/**
 * BRC-42 test vector builder
 */
export class BRC42FixtureBuilder {
  private data: BRC42TestVector;

  private constructor(data: BRC42TestVector) {
    this.data = data;
  }

  static create(id: string): BRC42FixtureBuilder {
    return new BRC42FixtureBuilder({
      id,
      description: '',
      senderPrivateKey: '',
      recipientPublicKey: '',
      invoiceNumber: '',
      expectedPublicKey: '',
      expectedPrivateKey: '',
    });
  }

  withKeys(senderPriv: string, recipientPub: string): this {
    this.data = {
      ...this.data,
      senderPrivateKey: senderPriv,
      recipientPublicKey: recipientPub,
    };
    return this;
  }

  withExpected(pubKey: string, privKey: string): this {
    this.data = {
      ...this.data,
      expectedPublicKey: pubKey,
      expectedPrivateKey: privKey,
    };
    return this;
  }

  build(): BRC42TestVector {
    return this.data;
  }
}

/**
 * IPC scenario builder
 */
export class IPCScenarioBuilder {
  private data: IPCTestScenario;

  private constructor(data: IPCTestScenario) {
    this.data = data;
  }

  static create(id: string, command: string): IPCScenarioBuilder {
    return new IPCScenarioBuilder({
      id,
      command,
      description: '',
      request: {},
      expectedResponse: {},
      setupSteps: [],
      teardownSteps: [],
    });
  }

  withRequest(request: unknown): this {
    this.data = { ...this.data, request };
    return this;
  }

  withExpectedResponse(expectedResponse: unknown): this {
    this.data = { ...this.data, expectedResponse };
    return this;
  }

  withExpectedError(expectedError: string): this {
    this.data = { ...this.data, expectedError };
    return this;
  }

  withSetup(...steps: string[]): this {
    this.data = {
      ...this.data,
      setupSteps: [...this.data.setupSteps, ...steps],
    };
    return this;
  }

  withTeardown(...steps: string[]): this {
    this.data = {
      ...this.data,
      teardownSteps: [...this.data.teardownSteps, ...steps],
    };
    return this;
  }

  build(): IPCTestScenario {
    return this.data;
  }
}

/**
 * Mock builder for Tauri context
 */
export class TauriMockBuilder {
  private responses = new Map<string, unknown>();
  private errors = new Map<string, string>();
  private latencies = new Map<string, number>();

  /** Configure mock response for command */
  withResponse(command: string, response: unknown): this {
    this.responses.set(command, response);
    return this;
  }

  /** Configure mock error for command */
  withError(command: string, error: string): this {
    this.errors.set(command, error);
    return this;
  }

  /** Configure latency for command */
  withLatency(command: string, ms: number): this {
    this.latencies.set(command, ms);
    return this;
  }

  /** Build the mock context */
  build(): TauriMockContext {
    const invoke: MockTauriInvoke = async (cmd, args) => {
      void args;
      const latency = this.latencies.get(cmd) || 0;
      if (latency > 0) {
        await new Promise((resolve) => setTimeout(resolve, latency));
      }

      const error = this.errors.get(cmd);
      if (error) {
        throw new Error(error);
      }

      const response = this.responses.get(cmd);
      if (response !== undefined) {
        return response as never;
      }

      throw new Error(`No mock configured for command: ${cmd}`);
    };

    const events = new Map<string, Array<(event: unknown) => void>>();

    return {
      invoke,
      emit: (event, payload) => {
        const handlers = events.get(event) || [];
        handlers.forEach((handler) => handler(payload));
      },
      listen: (event, handler) => {
        if (!events.has(event)) {
          events.set(event, []);
        }
        const handlers = events.get(event);
        if (handlers) {
          handlers.push(handler);
        }
        return () => {
          const handlers = events.get(event) || [];
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        };
      },
      reset: () => {
        this.responses.clear();
        this.errors.clear();
        this.latencies.clear();
        events.clear();
      },
    };
  }
}

/**
 * Wait for condition with timeout
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Condition timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Create mock subscription state
 */
export function createMockSubscriptionState(
  type: SubscriptionFSMState['type'],
  options?: {
    txid?: string;
    vout?: number;
    verifiedAt?: string;
  }
): SubscriptionFSMState {
  if (type === 'NotFound') {
    return { type: 'NotFound' };
  }
  return {
    type,
    txid: options?.txid || 'abc123',
    vout: options?.vout || 0,
    verifiedAt: options?.verifiedAt || new Date().toISOString(),
  } as SubscriptionFSMState;
}
