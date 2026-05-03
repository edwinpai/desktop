/**
 * Config Module Tests
 */

import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readConfig, updateConfig } from "@/lib/config";
import { DEFAULT_DESKTOP_CONFIG, isValidDesktopConfig } from "@/types";
import type { DesktopConfig } from "@/types";

type TauriInternals = Window["__TAURI_INTERNALS__"];

// Mock Tauri filesystem API
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: {
    AppData: "AppData",
  },
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
}));

describe("Config Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exists).mockResolvedValue(true);
  });

  describe("isValidDesktopConfig", () => {
    it("validates correct config", () => {
      const config: DesktopConfig = {
        gatewayUrl: "http://localhost:3000",
        gatewayPort: 3000,
        gatewayToken: "token-1",
        gatewayProfiles: [
          {
            id: "default",
            name: "Default Gateway",
            gatewayUrl: "http://localhost:3000",
            gatewayPort: 3000,
            gatewayToken: "token-1",
          },
        ],
        activeGatewayProfileId: "default",
        autoStartGateway: true,
        theme: "dark",
        defaultModel: "claude-sonnet-4-5",
        chat: {
          enableStreaming: true,
          temperature: 0.7,
          maxTokens: 4096,
        },
        gateway: {
          autoRestart: true,
          maxRestarts: 5,
          healthCheckInterval: 30000,
        },
      };

      expect(isValidDesktopConfig(config)).toBe(true);
    });

    it("rejects invalid config", () => {
      expect(isValidDesktopConfig(null)).toBe(false);
      expect(isValidDesktopConfig(undefined)).toBe(false);
      expect(isValidDesktopConfig({})).toBe(false);
      expect(isValidDesktopConfig("invalid")).toBe(false);
    });

    it("rejects config with missing fields", () => {
      const incomplete = {
        gatewayPort: 3000,
        // Missing other required fields
      };

      expect(isValidDesktopConfig(incomplete)).toBe(false);
    });
  });

  describe("DEFAULT_DESKTOP_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_DESKTOP_CONFIG.gatewayPort).toBe(18789);
      expect(DEFAULT_DESKTOP_CONFIG.gatewayProfiles).toHaveLength(1);
      expect(DEFAULT_DESKTOP_CONFIG.activeGatewayProfileId).toBe("default");
      expect(DEFAULT_DESKTOP_CONFIG.autoStartGateway).toBe(true);
      expect(DEFAULT_DESKTOP_CONFIG.theme).toBe("system");
      expect(DEFAULT_DESKTOP_CONFIG.chat.enableStreaming).toBe(true);
      expect(DEFAULT_DESKTOP_CONFIG.chat.temperature).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_DESKTOP_CONFIG.chat.temperature).toBeLessThanOrEqual(1);
    });

    it("validates successfully", () => {
      expect(isValidDesktopConfig(DEFAULT_DESKTOP_CONFIG)).toBe(true);
    });
  });

  describe("browser fallback", () => {
    it("returns default config when Tauri internals are unavailable", async () => {
      const previous: TauriInternals = window.__TAURI_INTERNALS__;
      delete window.__TAURI_INTERNALS__;

      const config = await readConfig();

      expect(config).toEqual(DEFAULT_DESKTOP_CONFIG);
      expect(vi.mocked(exists)).not.toHaveBeenCalled();

      window.__TAURI_INTERNALS__ = previous;
    });
  });

  describe("gateway profile migration and persistence", () => {
    it("migrates a legacy single-gateway config into a default gateway profile", async () => {
      vi.mocked(readTextFile).mockResolvedValue(
        JSON.stringify({
          gatewayUrl: "http://127.0.0.1:3000",
          gatewayPort: 3000,
          gatewayToken: "legacy-token",
          autoStartGateway: true,
          theme: "system",
          defaultModel: "claude-sonnet-4-5",
          chat: {
            enableStreaming: true,
            temperature: 0.7,
            maxTokens: 4096,
          },
          gateway: {
            autoRestart: true,
            maxRestarts: 5,
            healthCheckInterval: 30000,
          },
        }),
      );

      const config = await readConfig();

      expect(config.gatewayProfiles).toEqual([
        {
          id: "default",
          name: "Default Gateway",
          gatewayUrl: "http://localhost:3000/",
          gatewayPort: 3000,
          gatewayToken: "legacy-token",
        },
      ]);
      expect(config.activeGatewayProfileId).toBe("default");
      expect(config.gatewayUrl).toBe("http://localhost:3000/");
      expect(config.gatewayToken).toBe("legacy-token");
    });

    it("mirrors updates to gatewayUrl and gatewayToken into the active gateway profile", async () => {
      vi.mocked(readTextFile).mockResolvedValue(
        JSON.stringify(DEFAULT_DESKTOP_CONFIG),
      );

      const config = await updateConfig({
        gatewayUrl: "http://gateway.example:4010",
        gatewayPort: 4010,
        gatewayToken: "updated-token",
      });

      expect(config.gatewayProfiles[0]).toMatchObject({
        id: "default",
        gatewayUrl: "http://gateway.example:4010",
        gatewayPort: 4010,
        gatewayToken: "updated-token",
      });
      expect(config.activeGatewayProfileId).toBe("default");
      expect(vi.mocked(writeTextFile)).toHaveBeenCalled();
    });

    it("switches the legacy top-level gateway fields when the active profile changes", async () => {
      vi.mocked(readTextFile).mockResolvedValue(
        JSON.stringify({
          ...DEFAULT_DESKTOP_CONFIG,
          gatewayProfiles: [
            DEFAULT_DESKTOP_CONFIG.gatewayProfiles[0],
            {
              id: "remote",
              name: "Remote Gateway",
              gatewayUrl: "https://gateway.example",
              gatewayPort: 443,
              gatewayToken: "remote-token",
            },
          ],
        }),
      );

      const config = await updateConfig({
        activeGatewayProfileId: "remote",
      });

      expect(config.activeGatewayProfileId).toBe("remote");
      expect(config.gatewayUrl).toBe("https://gateway.example");
      expect(config.gatewayPort).toBe(443);
      expect(config.gatewayToken).toBe("remote-token");
    });
  });
});
