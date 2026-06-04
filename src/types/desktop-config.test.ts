import { describe, expect, it } from "vitest";

import {
  DEFAULT_DESKTOP_CONFIG,
  hasClientSession,
  isConnectMode,
  isValidAppConnectionMode,
  isValidOperatingMode,
  toAppConnectionMode,
  toPersistedOperatingMode,
} from "./desktop-config";
import type { ConnectSessionConfig, DesktopConfig } from "./desktop-config";

describe("desktop-config Connect Mode compatibility helpers", () => {
  it("keeps client as the canonical persisted compatibility value", () => {
    expect(isValidOperatingMode("client")).toBe(true);
    expect(isValidOperatingMode("connect")).toBe(false);
    expect(toPersistedOperatingMode("connect")).toBe("client");
  });

  it("exposes Connect Mode vocabulary for UI/domain code", () => {
    const config: DesktopConfig = {
      ...DEFAULT_DESKTOP_CONFIG,
      mode: "client",
    };

    expect(isConnectMode(config)).toBe(true);
    expect(toAppConnectionMode(config.mode)).toBe("connect");
    expect(isValidAppConnectionMode("connect")).toBe(true);
  });

  it("aliases ConnectSessionConfig without changing lastClientSession shape", () => {
    const session: ConnectSessionConfig = {
      gatewayPubkey: "02".padEnd(66, "0"),
      gatewayAddress: "gateway.local:18789",
      gatewayPetname: "home-gateway",
      connectedAt: "2026-05-20T19:26:00.000Z",
      permission: "member",
    };
    const config: DesktopConfig = {
      ...DEFAULT_DESKTOP_CONFIG,
      mode: "client",
      lastClientSession: session,
    };

    expect(hasClientSession(config)).toBe(true);
    expect(config.lastClientSession).toEqual(session);
  });
});
