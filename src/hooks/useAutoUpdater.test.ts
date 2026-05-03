/**
 * Phase 6 Group B: Auto-Updater Hook Tests
 */

import { renderHook, act } from "@testing-library/react";
import * as processPlugin from "@tauri-apps/plugin-process";
import * as updaterPlugin from "@tauri-apps/plugin-updater";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { useAutoUpdater } from "./useAutoUpdater";

import { UpdateStatus } from "@/types/updater";

// Mock Tauri plugins
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

type UpdaterResult = Exclude<
  Awaited<ReturnType<typeof updaterPlugin.check>>,
  null
>;
type DownloadHandler = NonNullable<UpdaterResult["downloadAndInstall"]>;
type DownloadCallback = NonNullable<Parameters<DownloadHandler>[0]>;
type DownloadEvent = Parameters<DownloadCallback>[0];

function createMockUpdate(
  overrides: Partial<UpdaterResult> = {},
): UpdaterResult {
  return {
    version: "1.2.0",
    currentVersion: "1.0.0",
    date: "2026-02-11",
    body: "New features",
    downloadAndInstall: vi.fn(async () => undefined),
    ...overrides,
  } as UpdaterResult;
}

async function emitDownloadEvent(
  callback: DownloadCallback,
  event: DownloadEvent,
): Promise<void> {
  await callback(event);
}

describe("useAutoUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with idle status", () => {
    const { result } = renderHook(() => useAutoUpdater({ checkInterval: 0 }));

    expect(result.current.status).toBe(UpdateStatus.Idle);
    expect(result.current.updateInfo).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should check for updates when checkForUpdates is called", async () => {
    const mockUpdate = createMockUpdate();
    vi.mocked(updaterPlugin.check).mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useAutoUpdater({ checkInterval: 0 }));

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.status).toBe(UpdateStatus.Available);
    expect(result.current.updateInfo).toMatchObject({
      version: "1.2.0",
      currentVersion: "1.0.0",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Update available",
      expect.any(Object),
    );
  });

  it("should show no updates available when check returns null", async () => {
    vi.mocked(updaterPlugin.check).mockResolvedValue(null);

    const { result } = renderHook(() => useAutoUpdater({ checkInterval: 0 }));

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.status).toBe(UpdateStatus.Idle);
    expect(toast.info).toHaveBeenCalledWith(
      "No updates available",
      expect.any(Object),
    );
  });

  it("should handle check errors", async () => {
    const error = new Error("Network error");
    vi.mocked(updaterPlugin.check).mockRejectedValue(error);

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAutoUpdater({ checkInterval: 0, onError }),
    );

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.status).toBe(UpdateStatus.Error);
    expect(result.current.error).toBe("Network error");
    expect(toast.error).toHaveBeenCalledWith(
      "Update check failed",
      expect.any(Object),
    );
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("should auto-download when autoDownload is true", async () => {
    const mockUpdate = createMockUpdate({
      downloadAndInstall: vi.fn(async (callback: DownloadCallback) => {
        await emitDownloadEvent(callback, {
          event: "Started",
          data: { contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Progress",
          data: { chunkLength: 500, contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Finished",
        } as DownloadEvent);
      }),
    });

    vi.mocked(updaterPlugin.check).mockResolvedValue(mockUpdate);

    const { result } = renderHook(() =>
      useAutoUpdater({
        checkInterval: 0,
        autoDownload: false,
        autoInstall: false,
      }),
    );

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.status).toBe(UpdateStatus.Available);

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(result.current.status).toBe(UpdateStatus.ReadyToInstall);
    expect(toast.success).toHaveBeenCalledWith(
      "Update downloaded",
      expect.any(Object),
    );
  });

  it("should install update and relaunch", async () => {
    vi.mocked(processPlugin.relaunch).mockResolvedValue();

    const mockUpdate = createMockUpdate({
      downloadAndInstall: vi.fn(async (callback: DownloadCallback) => {
        await emitDownloadEvent(callback, {
          event: "Started",
          data: { contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Finished",
        } as DownloadEvent);
      }),
    });

    vi.mocked(updaterPlugin.check).mockResolvedValue(mockUpdate);

    const { result } = renderHook(() =>
      useAutoUpdater({ checkInterval: 0, autoDownload: false }),
    );

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(result.current.status).toBe(UpdateStatus.ReadyToInstall);

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(processPlugin.relaunch).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(
      "Installing update...",
      expect.any(Object),
    );
  });

  it("should respect checkInterval", async () => {
    const checkInterval = 60000;
    const mockUpdate = createMockUpdate();

    vi.mocked(updaterPlugin.check).mockResolvedValue(mockUpdate);

    renderHook(() => useAutoUpdater({ checkInterval, autoDownload: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(updaterPlugin.check).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(checkInterval);
    });

    expect(updaterPlugin.check).toHaveBeenCalledTimes(2);
  });

  it("should not check again if within checkInterval", async () => {
    const mockUpdate = createMockUpdate();
    vi.mocked(updaterPlugin.check).mockResolvedValue(mockUpdate);

    const { result } = renderHook(() =>
      useAutoUpdater({ checkInterval: 60000, autoDownload: false }),
    );

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    expect(updaterPlugin.check).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    expect(updaterPlugin.check).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(updaterPlugin.check).toHaveBeenCalledTimes(2);
  });

  it("should track download progress", async () => {
    const mockUpdate = createMockUpdate({
      downloadAndInstall: vi.fn(async (callback: DownloadCallback) => {
        await emitDownloadEvent(callback, {
          event: "Started",
          data: { contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Progress",
          data: { chunkLength: 250, contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Progress",
          data: { chunkLength: 500, contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Progress",
          data: { chunkLength: 750, contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Progress",
          data: { chunkLength: 1000, contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Finished",
        } as DownloadEvent);
      }),
    });

    vi.mocked(updaterPlugin.check).mockResolvedValue(mockUpdate);

    const { result } = renderHook(() =>
      useAutoUpdater({
        checkInterval: 0,
        autoDownload: false,
      }),
    );

    await act(async () => {
      await result.current.checkForUpdates(true);
    });
    expect(result.current.status).toBe(UpdateStatus.Available);

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(result.current.status).toBe(UpdateStatus.ReadyToInstall);
    expect(result.current.progress).toBeNull();
  });

  it("should call onUpdateAvailable callback", async () => {
    const onUpdateAvailable = vi.fn();
    const mockUpdate = createMockUpdate();

    vi.mocked(updaterPlugin.check).mockResolvedValue(mockUpdate);

    const { result } = renderHook(() =>
      useAutoUpdater({
        checkInterval: 0,
        autoDownload: false,
        onUpdateAvailable,
      }),
    );

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(onUpdateAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "1.2.0",
        currentVersion: "1.0.0",
      }),
    );
  });

  it("should call onUpdateDownloaded callback", async () => {
    const onUpdateDownloaded = vi.fn();
    const mockUpdate = createMockUpdate({
      downloadAndInstall: vi.fn(async (callback: DownloadCallback) => {
        await emitDownloadEvent(callback, {
          event: "Started",
          data: { contentLength: 1000 },
        } as DownloadEvent);
        await emitDownloadEvent(callback, {
          event: "Finished",
        } as DownloadEvent);
      }),
    });

    vi.mocked(updaterPlugin.check).mockResolvedValue(mockUpdate);

    const { result } = renderHook(() =>
      useAutoUpdater({
        checkInterval: 0,
        autoDownload: false,
        onUpdateDownloaded,
      }),
    );

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(onUpdateDownloaded).toHaveBeenCalled();
  });

  it("should cleanup on unmount", () => {
    const { unmount } = renderHook(() =>
      useAutoUpdater({ checkInterval: 60000 }),
    );

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
