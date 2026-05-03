import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { DEFAULT_DESKTOP_CONFIG } from "@/types";

vi.mock("@/lib/config", () => ({
  readConfig: vi.fn(),
  updateConfig: vi.fn(),
  resetConfig: vi.fn(),
}));

import { useConfig } from "@/hooks/useConfig";
import * as configApi from "@/lib/config";

const mockConfigApi = vi.mocked(configApi);

describe("useConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigApi.readConfig.mockResolvedValue(DEFAULT_DESKTOP_CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads config on mount", async () => {
    const { result } = renderHook(() => useConfig());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.config).toEqual(DEFAULT_DESKTOP_CONFIG);
    expect(mockConfigApi.readConfig).toHaveBeenCalled();
  });

  it("handles load errors", async () => {
    mockConfigApi.readConfig.mockRejectedValue(new Error("Failed to load"));

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.error).toBe("Failed to load");
    });
  });

  it("updates config fields", async () => {
    const updated = { ...DEFAULT_DESKTOP_CONFIG, theme: "dark" as const };
    mockConfigApi.updateConfig.mockResolvedValue(updated);

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.update({ theme: "dark" });
    });

    expect(result.current.config.theme).toBe("dark");
  });

  it("resets config to defaults", async () => {
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

  it("reloads config from disk", async () => {
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

  it("exposes gateway profiles and active profile from config", async () => {
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

  it("saves a new gateway profile and makes it active", async () => {
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

  it("deletes a non-default gateway profile and falls back to the default active profile", async () => {
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
