/**
 * Config - Configuration management
 *
 * Handles reading/writing app configuration to desktop-config.json
 * Uses Tauri's filesystem API for cross-platform file access
 */

import {
  BaseDirectory,
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";

import type { DesktopConfig, PartialDesktopConfig } from "@/types";
import {
  DEFAULT_DESKTOP_CONFIG,
  DEFAULT_GATEWAY_PROFILE,
  isValidDesktopConfig,
  sanitizeConfig,
  mergeWithDefaults,
} from "@/types";

// ============================================================================
// Config File Path
// ============================================================================

const CONFIG_FILE = import.meta.env.VITE_EDWINPAI_DESKTOP_INSTANCE_ID
  ? `desktop-config.${import.meta.env.VITE_EDWINPAI_DESKTOP_INSTANCE_ID}.json`
  : "desktop-config.json";

function hasTauriFs(): boolean {
  if (typeof window === "undefined") return true;
  const internals = (
    window as Window & { __TAURI_INTERNALS__?: { invoke?: unknown } }
  ).__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function";
}

// ============================================================================
// Config Operations
// ============================================================================

/**
 * Ensure the Tauri AppData directory exists before touching desktop-config.json.
 *
 * On a fresh Windows profile, `%APPDATA%\com.edwinpai.desktop` may not
 * exist yet. Tauri's fs plugin permits writes inside AppData, but the app must
 * create the app-specific directory first. The matching `fs:allow-mkdir`
 * capability is declared in `src-tauri/capabilities/default.json`.
 */
async function ensureConfigDirectory(): Promise<void> {
  await mkdir(".", {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });
}

/**
 * Ensure config file's parent directory exists and create defaults on first run.
 */
async function ensureConfigExists(): Promise<void> {
  if (!hasTauriFs()) return;

  try {
    await ensureConfigDirectory();

    const fileExists = await exists(CONFIG_FILE, {
      baseDir: BaseDirectory.AppData,
    });

    if (!fileExists) {
      // Write default config on first run
      await writeConfig(DEFAULT_DESKTOP_CONFIG);
    }
  } catch (err) {
    console.error("Failed to initialize config:", err);
    throw new Error("Failed to initialize configuration");
  }
}

/**
 * Read configuration from disk
 * Returns default config if file doesn't exist
 */
export async function readConfig(): Promise<DesktopConfig> {
  if (!hasTauriFs()) {
    return DEFAULT_DESKTOP_CONFIG;
  }

  try {
    await ensureConfigExists();

    const contents = await readTextFile(CONFIG_FILE, {
      baseDir: BaseDirectory.AppData,
    });

    const parsed = JSON.parse(contents) as unknown;

    // Validate parsed config
    if (!isValidDesktopConfig(parsed)) {
      console.warn("Invalid config format, using defaults");
      return DEFAULT_DESKTOP_CONFIG;
    }

    // Merge with defaults (in case new fields were added) and sanitize
    const merged = mergeWithDefaults(parsed);
    const sanitized = sanitizeConfig(merged);

    // Auto-migrate loopback gatewayUrl to localhost.
    // Gateway security treats "localhost" as the trusted local control-plane host.
    // Using 127.0.0.1 can cause "The operation is insecure." failures in the Desktop UI.
    const migratedGatewayUrl = migrateLoopbackGatewayUrl(sanitized.gatewayUrl);
    if (migratedGatewayUrl && migratedGatewayUrl !== sanitized.gatewayUrl) {
      const migrated = {
        ...sanitized,
        gatewayUrl: migratedGatewayUrl,
        gatewayProfiles: sanitized.gatewayProfiles.map((profile) =>
          profile.id === sanitized.activeGatewayProfileId
            ? { ...profile, gatewayUrl: migratedGatewayUrl }
            : profile,
        ),
      };
      // Best-effort write: don't fail startup if disk write fails.
      writeConfig(migrated).catch((err) => {
        console.warn("Failed to auto-migrate gatewayUrl:", err);
      });
      return migrated;
    }

    return sanitized;
  } catch (err) {
    console.error("Failed to read config:", err);
    // Return defaults on error
    return DEFAULT_DESKTOP_CONFIG;
  }
}

function isLoopbackHost(hostname: string): boolean {
  // URL.hostname is never bracketed ("[::1]") — it will be "::1".
  if (hostname === "localhost") return true;
  if (hostname === "::1") return true;
  if (hostname === "0.0.0.0") return true;
  // Any IPv4 loopback in 127.0.0.0/8
  if (hostname.startsWith("127.")) return true;
  return false;
}

function migrateLoopbackGatewayUrl(url?: string): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!isLoopbackHost(u.hostname)) return url;
    u.hostname = "localhost";
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Write configuration to disk
 */
export async function writeConfig(config: DesktopConfig): Promise<void> {
  try {
    await ensureConfigDirectory();

    // Sanitize before writing
    const sanitized = sanitizeConfig(config);
    const contents = JSON.stringify(sanitized, null, 2);

    await writeTextFile(CONFIG_FILE, contents, {
      baseDir: BaseDirectory.AppData,
    });
  } catch (err) {
    console.error("Failed to write config:", err);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to save configuration: ${detail}`);
  }
}

/**
 * Update specific config fields
 */
export async function updateConfig(
  updates: PartialDesktopConfig,
): Promise<DesktopConfig> {
  const current = await readConfig();
  const updated: DesktopConfig = {
    ...current,
    ...updates,
    chat: {
      ...current.chat,
      ...(updates.chat || {}),
    },
    gateway: {
      ...current.gateway,
      ...(updates.gateway || {}),
    },
  };

  if (updates.gatewayProfiles) {
    updated.gatewayProfiles = updates.gatewayProfiles;
  }

  if (updates.activeGatewayProfileId) {
    updated.activeGatewayProfileId = updates.activeGatewayProfileId;
  }

  if (!updated.gatewayProfiles || updated.gatewayProfiles.length === 0) {
    updated.gatewayProfiles = [
      {
        ...DEFAULT_GATEWAY_PROFILE,
        gatewayUrl: updated.gatewayUrl,
        gatewayPort: updated.gatewayPort,
        gatewayToken: updated.gatewayToken,
      },
    ];
    updated.activeGatewayProfileId = DEFAULT_GATEWAY_PROFILE.id;
  }

  if (
    updates.gatewayUrl !== undefined ||
    updates.gatewayPort !== undefined ||
    updates.gatewayToken !== undefined
  ) {
    updated.gatewayProfiles = updated.gatewayProfiles.map((profile) =>
      profile.id === updated.activeGatewayProfileId
        ? {
            ...profile,
            gatewayUrl: updates.gatewayUrl ?? profile.gatewayUrl,
            gatewayPort: updates.gatewayPort ?? profile.gatewayPort,
            gatewayToken: updates.gatewayToken ?? profile.gatewayToken,
          }
        : profile,
    );
  }

  await writeConfig(updated);
  return sanitizeConfig(mergeWithDefaults(updated));
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig(): Promise<DesktopConfig> {
  await writeConfig(DEFAULT_DESKTOP_CONFIG);
  return DEFAULT_DESKTOP_CONFIG;
}

// ============================================================================
// Config Utilities
// ============================================================================

/**
 * Get config file path (for debugging)
 */
export function getConfigPath(): string {
  // This returns the logical path, not the actual OS path
  // Actual path varies by platform:
  // - Linux: ~/.local/share/com.edwinpai.desktop/desktop-config.json
  // - macOS: ~/Library/Application Support/com.edwinpai.desktop/desktop-config.json
  // - Windows: %APPDATA%\com.edwinpai.desktop\desktop-config.json
  return CONFIG_FILE;
}
