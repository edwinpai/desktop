/**
 * useChannels Hook Tests
 *
 * Tests channel CRUD operations, validation, and state management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ChannelConfig } from "@/types/channels";

// Mock channels API
vi.mock("@/lib/channels", () => ({
  listChannels: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
  toggleChannel: vi.fn(),
  validateChannelCredentials: vi.fn(),
}));

import { useChannels } from "@/hooks/useChannels";
import * as channelsApi from "@/lib/channels";
const mockChannelsApi = vi.mocked(channelsApi);

describe("useChannels", () => {
  const mockChannel: ChannelConfig = {
    channel: "telegram",
    enabled: true,
    configuredBy: "test-user",
    configuredAt: new Date().toISOString(),
    credentials: { bot_token: "test-token" },
    settings: { autoReply: false, allowedChatIds: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChannelsApi.listChannels.mockResolvedValue([mockChannel]);
  });

  it("should initialize with empty state and auto-load", async () => {
    const { result } = renderHook(() => useChannels());

    expect(result.current.loading).toBe(true);
    expect(result.current.channels).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.channels).toHaveLength(1);
    expect(mockChannelsApi.listChannels).toHaveBeenCalled();
  });

  it("should skip auto-load when disabled", () => {
    const { result } = renderHook(() => useChannels(false));

    expect(result.current.channels).toEqual([]);
    expect(mockChannelsApi.listChannels).not.toHaveBeenCalled();
  });

  it("should refresh channels", async () => {
    const { result } = renderHook(() => useChannels(false));

    await act(async () => {
      await result.current.refreshChannels();
    });

    expect(mockChannelsApi.listChannels).toHaveBeenCalled();
    expect(result.current.channels).toHaveLength(1);
  });

  it("should create a channel", async () => {
    mockChannelsApi.createChannel.mockResolvedValue(mockChannel);

    const { result } = renderHook(() => useChannels(false));

    await act(async () => {
      await result.current.createChannel(
        "telegram",
        "test-user",
        { bot_token: "test-token" },
        { autoReply: false, allowedChatIds: [] },
      );
    });

    expect(mockChannelsApi.createChannel).toHaveBeenCalledWith(
      "telegram",
      "test-user",
      { bot_token: "test-token" },
      { autoReply: false, allowedChatIds: [] },
    );
    expect(mockChannelsApi.listChannels).toHaveBeenCalled();
  });

  it("should update a channel", async () => {
    const updated = { ...mockChannel, enabled: false };
    mockChannelsApi.updateChannel.mockResolvedValue(updated);

    const { result } = renderHook(() => useChannels(false));

    await act(async () => {
      await result.current.updateChannel("telegram", false);
    });

    expect(mockChannelsApi.updateChannel).toHaveBeenCalledWith(
      "telegram",
      false,
      undefined,
      undefined,
    );
    expect(mockChannelsApi.listChannels).toHaveBeenCalled();
  });

  it("should delete a channel", async () => {
    mockChannelsApi.deleteChannel.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChannels(false));

    await act(async () => {
      await result.current.deleteChannel("telegram");
    });

    expect(mockChannelsApi.deleteChannel).toHaveBeenCalledWith("telegram");
    expect(mockChannelsApi.listChannels).toHaveBeenCalled();
  });

  it("should toggle a channel", async () => {
    const toggled = { ...mockChannel, enabled: false };
    mockChannelsApi.toggleChannel.mockResolvedValue(toggled);

    const { result } = renderHook(() => useChannels(false));

    await act(async () => {
      await result.current.toggleChannel("telegram", false);
    });

    expect(mockChannelsApi.toggleChannel).toHaveBeenCalledWith(
      "telegram",
      false,
    );
    expect(mockChannelsApi.listChannels).toHaveBeenCalled();
  });

  it("should validate credentials", async () => {
    const validationResult = { valid: true };
    mockChannelsApi.validateChannelCredentials.mockResolvedValue(
      validationResult,
    );

    const { result } = renderHook(() => useChannels(false));

    const response = await act(async () => {
      return await result.current.validateCredentials("telegram", {
        bot_token: "test",
      });
    });

    expect(response).toEqual(validationResult);
    expect(mockChannelsApi.validateChannelCredentials).toHaveBeenCalledWith(
      "telegram",
      { bot_token: "test" },
    );
  });

  it("should handle errors during create", async () => {
    mockChannelsApi.createChannel.mockRejectedValue(new Error("Create failed"));

    const { result } = renderHook(() => useChannels(false));

    await act(async () => {
      try {
        await result.current.createChannel(
          "telegram",
          "user",
          {},
          { autoReply: false, allowedChatIds: [] },
        );
      } catch (err) {
        // Expected error
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe("Create failed");
      }
    });

    expect(result.current.error).toBe("Create failed");
  });

  it("should handle errors during refresh", async () => {
    mockChannelsApi.listChannels.mockRejectedValue(new Error("Refresh failed"));

    const { result } = renderHook(() => useChannels());

    await waitFor(() => {
      expect(result.current.error).toBe("Refresh failed");
    });
  });
});
