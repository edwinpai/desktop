import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "../App";

vi.mock("@/lib/config", () => ({
  readConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/hooks/useDesktopNotifications", () => ({
  useDesktopNotifications: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === "has_app_lock") return Promise.resolve(false);
    if (cmd === "get_config") return Promise.reject(new Error("not configured"));
    if (cmd === "get_edwinpai_config") return Promise.resolve({ config: {} });
    if (cmd === "probe_gateway") return Promise.resolve({ found: false });
    if (cmd === "check_runtime") return Promise.resolve({ nodeAvailable: false, edwinpaiAvailable: false, ready: false });
    return Promise.reject(new Error(`unmocked command: ${cmd}`));
  }),
}));

describe("App", () => {
  it("renders the onboarding heading", async () => {
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /welcome to edwinpai/i,
        })
      ).toBeInTheDocument();
    });
  });
});
