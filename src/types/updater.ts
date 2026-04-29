/**
 * Phase 6: Onboarding & Updates - Auto-Updater Type Definitions
 *
 * Defines type contracts for the Tauri auto-updater system with BSV signature verification.
 *
 * @module types/updater
 */

/**
 * Update availability status.
 *
 * State machine flow:
 * `Idle` → `Checking` → `Available` → `Downloading` → `ReadyToInstall` → `Idle`
 *
 * Error states return to `Idle`.
 */
export enum UpdateStatus {
  /** No update check in progress */
  Idle = 'idle',

  /** Checking for updates from endpoint */
  Checking = 'checking',

  /** Update available for download */
  Available = 'available',

  /** Update download in progress */
  Downloading = 'downloading',

  /** Update downloaded and ready to install */
  ReadyToInstall = 'ready_to_install',

  /** Error occurred during update process */
  Error = 'error',
}

/**
 * Update metadata from release endpoint.
 *
 * @example
 * ```ts
 * const update: UpdateInfo = {
 *   version: '1.2.0',
 *   date: '2026-02-11',
 *   body: '## New Features\n- Auto-updater with BSV signatures',
 *   signature: '304402207a3b...', // DER-encoded ECDSA signature
 *   pubkey: '02abc123...', // Public key for verification
 *   downloadUrl: 'https://releases.edwinpai.ai/v1.2.0/edwinpai-desktop_1.2.0_amd64.AppImage',
 *   size: 75894016
 * };
 * ```
 */
export interface UpdateInfo {
  /** Semantic version string (e.g., "1.2.0") */
  version: string;

  /** Current installed version */
  currentVersion: string;

  /** Release date in ISO 8601 format */
  date: string;

  /** Release notes in Markdown format */
  body: string;

  /** BSV signature of the update binary (hex-encoded DER) */
  signature: string;

  /** Public key for signature verification (hex-encoded compressed) */
  pubkey: string;

  /** Direct download URL for the update binary */
  downloadUrl: string;

  /** Binary size in bytes */
  size: number;
}

/**
 * Auto-updater configuration.
 *
 * Persisted to app config file.
 *
 * @example
 * ```ts
 * const config: UpdateConfig = {
 *   endpoint: 'https://releases.edwinpai.ai/updates.json',
 *   checkInterval: 3600000, // 1 hour
 *   autoDownload: true,
 *   autoInstall: false,
 *   allowPrerelease: false,
 *   trustedPubkeys: ['02abc123...', '03def456...']
 * };
 * ```
 */
export interface UpdateConfig {
  /** Update manifest endpoint URL */
  endpoint: string;

  /** Check interval in milliseconds (0 = manual only) */
  checkInterval: number;

  /** Automatically download available updates */
  autoDownload: boolean;

  /** Automatically install after download (requires restart) */
  autoInstall: boolean;

  /** Allow pre-release versions */
  allowPrerelease: boolean;

  /** Trusted public keys for signature verification */
  trustedPubkeys: string[];
}

/**
 * Download progress event.
 */
export interface DownloadProgress {
  /** Bytes downloaded so far */
  downloaded: number;

  /** Total bytes to download */
  total: number;

  /** Download speed in bytes/second */
  speed: number;

  /** Estimated time remaining in seconds */
  eta: number;
}

/**
 * Update check result.
 */
export interface UpdateCheckResult {
  /** Whether an update is available */
  available: boolean;

  /** Current installed version */
  currentVersion: string;

  /** Latest available version (if available) */
  latestVersion?: string;

  /** Update metadata (if available) */
  updateInfo?: UpdateInfo;

  /** Error message (if check failed) */
  error?: string;
}

/**
 * IPC request to check for updates.
 */
export interface CheckForUpdatesRequest {
  /** Force check even if within checkInterval */
  force?: boolean;
}

/**
 * IPC response for update check.
 */
export interface CheckForUpdatesResponse {
  result: UpdateCheckResult;
}

/**
 * IPC request to download available update.
 */
export interface DownloadUpdateRequest {
  /** Update version to download */
  version: string;
}

/**
 * IPC response for download request.
 */
export interface DownloadUpdateResponse {
  success: boolean;
  error?: string;
}

/**
 * IPC request to apply downloaded update.
 *
 * This will restart the application.
 */
export interface ApplyUpdateRequest {
  /** Update version to apply */
  version: string;
}

/**
 * IPC response for apply request.
 */
export interface ApplyUpdateResponse {
  success: boolean;
  error?: string;
}

/**
 * IPC request to cancel ongoing download.
 */
export type CancelDownloadRequest = Record<string, never>;

/**
 * IPC response for cancel request.
 */
export interface CancelDownloadResponse {
  success: boolean;
}

/**
 * IPC request to get current update status.
 */
export type GetUpdateStatusRequest = Record<string, never>;

/**
 * IPC response for status request.
 */
export interface GetUpdateStatusResponse {
  status: UpdateStatus;
  updateInfo?: UpdateInfo;
  progress?: DownloadProgress;
}

/**
 * IPC request to update updater config.
 */
export interface SetUpdateConfigRequest {
  config: Partial<UpdateConfig>;
}

/**
 * IPC response for config update.
 */
export interface SetUpdateConfigResponse {
  success: boolean;
  error?: string;
}

/**
 * Event emitted when update status changes.
 *
 * Listen via Tauri event system:
 * ```ts
 * import { listen } from '@tauri-apps/api/event';
 *
 * listen<UpdateStatusEvent>('updater:status', (event) => {
 *   console.log('Update status:', event.payload.status);
 * });
 * ```
 */
export interface UpdateStatusEvent {
  status: UpdateStatus;
  updateInfo?: UpdateInfo;
  progress?: DownloadProgress;
  error?: string;
}
