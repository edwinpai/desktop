/**
 * useConfig Hook Tests
 *
 * Tests configuration management, persistence, debouncing
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConfig } from "@/hooks/useConfig";
import * as configApi from "@/lib/config";
import { DEFAULT_DESKTOP_CONFIG } from "@/types";

// Mock config API
vi.mock("@/lib/config", () => ({
  readConfig: vi.fn(),
  updateConfig: vi.fn(),
  resetConfig: vi.fn(),
}));

// Mock debounce utility
vi.mock("@/lib/debounce", () => ({
  useDebouncedCallback: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => void,
  ) => fn,
}));

const mockConfigApi = vi.mocked(configApi);

describe("useConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigApi.readConfig.mockResolvedValue(DEFAULT_DESKTOP_CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should load config on mount", async () => {
    const { result } = renderHook(() => useConfig());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.config).toEqual(DEFAULT_DESKTOP_CONFIG);
    expect(mockConfigApi.readConfig).toHaveBeenCalled();
  });

  it("should handle load errors", async () => {
    mockConfigApi.readConfig.mockRejectedValue(new Error("Failed to load"));

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.error).toBe("Failed to load");
    });
  });

  it("should update config fields", async () => {
    const updated = { ...DEFAULT_DESKTOP_CONFIG, theme: "dark" as const };
    mockConfigApi.updateConfig.mockResolvedValue(updated);

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.update({ theme: "dark" });
    });

    await waitFor(() => {
      expect(result.current.config.theme).toBe("dark");
    });
  });

  it("should reset config to defaults", async () => {
    mockConfigApi.resetConfig.mockResolvedValue(DEFAULT_DESKTOP_CONFIG);

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.reset();
    });

    expect(mockConfigApi.resetConfig).toHaveBeenCalled();
    expect(result.current.config).toEqual(DEFAULT_DESKTOP_CONFIG);
  });

  it("should reload config from disk", async () => {
    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockConfigApi.readConfig.mockClear();

    await act(async () => {
      await result.current.reload();
    });

    expect(mockConfigApi.readConfig).toHaveBeenCalled();
  });

  it("should handle update errors", async () => {
    mockConfigApi.updateConfig.mockRejectedValue(new Error("Update failed"));

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.update({ theme: "dark" });
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Update failed");
    });
  });

  it("should handle reset errors", async () => {
    mockConfigApi.resetConfig.mockRejectedValue(new Error("Reset failed"));

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      try {
        await result.current.reset();
      } catch (err) {
        // Expected error
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe("Reset failed");
      }
    });

    expect(result.current.error).toBe("Reset failed");
  });

  it("should handle reload errors", async () => {
    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockConfigApi.readConfig.mockRejectedValue(new Error("Reload failed"));

    await act(async () => {
      try {
        await result.current.reload();
      } catch (err) {
        // Expected error
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe("Reload failed");
      }
    });

    expect(result.current.error).toBe("Reload failed");
  });

  it("should not update state after unmount", async () => {
    mockConfigApi.readConfig.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(DEFAULT_DESKTOP_CONFIG), 100),
        ),
    );

    const { unmount } = renderHook(() => useConfig());

    unmount();

    // Wait to ensure no state updates after unmount
    await new Promise((resolve) => setTimeout(resolve, 150));

    // No errors should be thrown (handled by mounted flag)
  });

  it("should expose gateway profiles and active profile from config", async () => {
    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.gatewayProfiles).toEqual(
      DEFAULT_DESKTOP_CONFIG.gatewayProfiles,
    );
    expect(result.current.activeGatewayProfile).toEqual(
      DEFAULT_DESKTOP_CONFIG.gatewayProfiles[0],
    );
  });

  it("should save a new gateway profile and make it active", async () => {
    const createdConfig = {
      ...DEFAULT_DESKTOP_CONFIG,
      gatewayUrl: "https://gateway.example",
      gatewayPort: 443,
      gatewayToken: "remote-token",
      activeGatewayProfileId: "remote-gateway",
      gatewayProfiles: [
        ...DEFAULT_DESKTOP_CONFIG.gatewayProfiles,
        {
          id: "remote-gateway",
          name: "Remote Gateway",
          gatewayUrl: "https://gateway.example",
          gatewayPort: 443,
          gatewayToken: "remote-token",
        },
      ],
    };
    mockConfigApi.updateConfig.mockResolvedValue(createdConfig);

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveGatewayProfile({
        name: "Remote Gateway",
        gatewayUrl: "https://gateway.example",
        gatewayPort: 443,
        gatewayToken: "remote-token",
      });
    });

    expect(mockConfigApi.updateConfig).toHaveBeenCalledWith({
      activeGatewayProfileId: "remote-gateway",
      gatewayProfiles: createdConfig.gatewayProfiles,
    });
    expect(result.current.activeGatewayProfile.id).toBe("remote-gateway");
  });

  it("should delete a non-default gateway profile and fall back to default active profile", async () => {
    const loadedConfig = {
      ...DEFAULT_DESKTOP_CONFIG,
      activeGatewayProfileId: "remote",
      gatewayUrl: "https://gateway.example",
      gatewayPort: 443,
      gatewayToken: "remote-token",
      gatewayProfiles: [
        DEFAULT_DESKTOP_CONFIG.gatewayProfiles[0]!,
        {
          id: "remote",
          name: "Remote Gateway",
          gatewayUrl: "https://gateway.example",
          gatewayPort: 443,
          gatewayToken: "remote-token",
        },
      ],
    };
    mockConfigApi.readConfig.mockResolvedValue(loadedConfig);
    mockConfigApi.updateConfig.mockResolvedValue(DEFAULT_DESKTOP_CONFIG);

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteGatewayProfile("remote");
    });

    expect(mockConfigApi.updateConfig).toHaveBeenCalledWith({
      activeGatewayProfileId: "default",
      gatewayProfiles: [DEFAULT_DESKTOP_CONFIG.gatewayProfiles[0]!],
    });
    expect(result.current.activeGatewayProfile.id).toBe("default");
  });
});
