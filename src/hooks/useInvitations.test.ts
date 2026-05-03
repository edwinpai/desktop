import { renderHook, act, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInvitations } from "./useInvitations";

import type { AccessLevel, InvitationData } from "@/types/api";

type CreateInvitationResponse = {
  token: string;
  invitationData: string;
  qrCodeSvg: string;
  deepLink: string;
  expiresAt: string;
};

type ScanInvitationResponse = {
  invitation: InvitationData | null;
  isValid: boolean;
  error?: string;
};

type AcceptInvitationResponse = {
  success: boolean;
  gatewayAddress: string;
  gatewayPubkey: string;
  level: AccessLevel;
  error?: string;
};

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("useInvitations", () => {
  const mockInvoke = invoke as ReturnType<typeof vi.fn>;

  const mockInvitation: InvitationData = {
    version: "edwinpai-invite-v1",
    invitation: {
      gatewayPubkey:
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      gatewayAddress: "192.168.1.100:3000",
      level: "member",
      expiresAt: "2026-02-12T10:00:00Z",
      token: "a".repeat(64),
    },
    petname: "alice-gateway",
  };

  const mockQrCodeSvg = "<svg>...</svg>";
  const mockDeepLink = "edwinpai://invite?token=aaa...";

  // Backend response shape for create_invitation
  const mockCreateResponse = {
    token: "a".repeat(64),
    invitationData: JSON.stringify(mockInvitation),
    qrCodeSvg: mockQrCodeSvg,
    deepLink: mockDeepLink,
    expiresAt: "2026-02-12T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("initializes with null invitation and loading states false", () => {
      const { result } = renderHook(() => useInvitations());

      expect(result.current.currentInvitation).toBeNull();
      expect(result.current.qrCodeSvg).toBeNull();
      expect(result.current.deepLink).toBeNull();
      expect(result.current.isCreating).toBe(false);
      expect(result.current.isScanning).toBe(false);
      expect(result.current.isAccepting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("provides all required functions", () => {
      const { result } = renderHook(() => useInvitations());

      expect(typeof result.current.createInvitation).toBe("function");
      expect(typeof result.current.scanQRCode).toBe("function");
      expect(typeof result.current.acceptInvitation).toBe("function");
      expect(typeof result.current.clearInvitation).toBe("function");
    });
  });

  describe("createInvitation", () => {
    it("creates member invitation with 24 hour expiry", async () => {
      mockInvoke.mockResolvedValue(mockCreateResponse);

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });

      expect(mockInvoke).toHaveBeenCalledWith("create_invitation", {
        request: {
          level: "member",
          expiresInHours: 24,
        },
      });
      expect(invitation).toEqual(mockInvitation);
      expect(result.current.currentInvitation).toEqual(mockInvitation);
      expect(result.current.qrCodeSvg).toBe(mockQrCodeSvg);
      expect(result.current.deepLink).toBe(mockDeepLink);
      expect(result.current.error).toBeNull();
    });

    it("creates guest invitation with 1 hour expiry", async () => {
      const guestInvitation: InvitationData = {
        ...mockInvitation,
        invitation: { ...mockInvitation.invitation, level: "guest" },
      };

      mockInvoke.mockResolvedValue({
        token: "a".repeat(64),
        invitationData: JSON.stringify(guestInvitation),
        qrCodeSvg: mockQrCodeSvg,
        deepLink: mockDeepLink,
        expiresAt: "2026-02-12T10:00:00Z",
      });

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.createInvitation({
          level: "guest",
          expiresInHours: 1,
        });
      });

      expect(mockInvoke).toHaveBeenCalledWith("create_invitation", {
        request: {
          level: "guest",
          expiresInHours: 1,
        },
      });
      expect(invitation).not.toBeNull();
      expect(result.current.currentInvitation?.invitation.level).toBe("guest");
    });

    it("sets isCreating during creation", async () => {
      let resolveCreate: (value: CreateInvitationResponse) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });

      mockInvoke.mockReturnValue(createPromise);

      const { result } = renderHook(() => useInvitations());

      act(() => {
        result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });

      // Should be creating immediately
      await waitFor(() => {
        expect(result.current.isCreating).toBe(true);
      });

      // Resolve the creation
      await act(async () => {
        resolveCreate!(mockCreateResponse);
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });
    });

    it("handles creation error", async () => {
      mockInvoke.mockRejectedValue(new Error("Subscription inactive"));

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });

      expect(invitation).toBeNull();
      expect(result.current.error).toBe("Subscription inactive");
      expect(result.current.isCreating).toBe(false);
    });

    it("handles non-Error exceptions", async () => {
      mockInvoke.mockRejectedValue("String error");

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });

      expect(invitation).toBeNull();
      expect(result.current.error).toBe("Failed to create invitation");
    });

    it("clears previous error on successful creation", async () => {
      mockInvoke
        .mockRejectedValueOnce(new Error("First error"))
        .mockResolvedValueOnce(mockCreateResponse);

      const { result } = renderHook(() => useInvitations());

      // First creation fails
      await act(async () => {
        await result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });
      expect(result.current.error).toBe("First error");

      // Second creation succeeds
      await act(async () => {
        await result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe("scanQRCode", () => {
    it("scans valid QR code", async () => {
      mockInvoke.mockResolvedValue({
        invitation: mockInvitation,
        isValid: true,
      });

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.scanQRCode(
          "edwinpai://invite?token=aaa...",
        );
      });

      expect(mockInvoke).toHaveBeenCalledWith("scan_qr_code", {
        request: { qrData: "edwinpai://invite?token=aaa..." },
      });
      expect(invitation).toEqual(mockInvitation);
      expect(result.current.currentInvitation).toEqual(mockInvitation);
      expect(result.current.error).toBeNull();
    });

    it("sets isScanning during scan", async () => {
      let resolveScan: (value: ScanInvitationResponse) => void;
      const scanPromise = new Promise((resolve) => {
        resolveScan = resolve;
      });

      mockInvoke.mockReturnValue(scanPromise);

      const { result } = renderHook(() => useInvitations());

      act(() => {
        result.current.scanQRCode("edwinpai://invite?token=aaa...");
      });

      // Should be scanning immediately
      await waitFor(() => {
        expect(result.current.isScanning).toBe(true);
      });

      // Resolve the scan
      await act(async () => {
        resolveScan!({
          invitation: mockInvitation,
          isValid: true,
        });
      });

      await waitFor(() => {
        expect(result.current.isScanning).toBe(false);
      });
    });

    it("handles invalid QR code", async () => {
      mockInvoke.mockResolvedValue({
        invitation: null,
        isValid: false,
        error: "Invalid invitation format",
      });

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.scanQRCode("invalid-qr-data");
      });

      expect(invitation).toBeNull();
      expect(result.current.error).toBe("Invalid invitation format");
      expect(result.current.currentInvitation).toBeNull();
    });

    it("handles expired invitation", async () => {
      mockInvoke.mockResolvedValue({
        invitation: mockInvitation,
        isValid: false,
        error: "Invitation expired",
      });

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.scanQRCode(
          "edwinpai://invite?token=expired",
        );
      });

      expect(invitation).toBeNull();
      expect(result.current.error).toBe("Invitation expired");
    });

    it("handles scan exception", async () => {
      mockInvoke.mockRejectedValue(new Error("Camera access denied"));

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.scanQRCode("some-qr-data");
      });

      expect(invitation).toBeNull();
      expect(result.current.error).toBe("Camera access denied");
      expect(result.current.isScanning).toBe(false);
    });

    it("handles non-Error exceptions", async () => {
      mockInvoke.mockRejectedValue("String error");

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.scanQRCode("some-qr-data");
      });

      expect(invitation).toBeNull();
      expect(result.current.error).toBe("Failed to scan QR code");
    });

    it("handles default invalid QR code error message", async () => {
      mockInvoke.mockResolvedValue({
        invitation: null,
        isValid: false,
      });

      const { result } = renderHook(() => useInvitations());

      let invitation: InvitationData | null = null;

      await act(async () => {
        invitation = await result.current.scanQRCode("bad-qr");
      });

      expect(invitation).toBeNull();
      expect(result.current.error).toBe("Invalid QR code");
    });
  });

  describe("acceptInvitation", () => {
    it("accepts valid invitation", async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        gatewayAddress: "192.168.1.100:3000",
        gatewayPubkey:
          "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        level: "member" as AccessLevel,
      });

      const { result } = renderHook(() => useInvitations());

      let success: boolean = false;

      await act(async () => {
        success = await result.current.acceptInvitation({
          invitation: mockInvitation,
        });
      });

      expect(mockInvoke).toHaveBeenCalledWith("accept_invitation", {
        request: { invitation: mockInvitation },
      });
      expect(success).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("sets isAccepting during acceptance", async () => {
      let resolveAccept: (value: AcceptInvitationResponse) => void;
      const acceptPromise = new Promise((resolve) => {
        resolveAccept = resolve;
      });

      mockInvoke.mockReturnValue(acceptPromise);

      const { result } = renderHook(() => useInvitations());

      act(() => {
        result.current.acceptInvitation({
          invitation: mockInvitation,
        });
      });

      // Should be accepting immediately
      await waitFor(() => {
        expect(result.current.isAccepting).toBe(true);
      });

      // Resolve the acceptance
      await act(async () => {
        resolveAccept!({
          success: true,
          gatewayAddress: "192.168.1.100:3000",
          gatewayPubkey:
            "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
          level: "member" as AccessLevel,
        });
      });

      await waitFor(() => {
        expect(result.current.isAccepting).toBe(false);
      });
    });

    it("handles acceptance failure from response", async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: "Invitation already used",
      });

      const { result } = renderHook(() => useInvitations());

      let success: boolean = true;

      await act(async () => {
        success = await result.current.acceptInvitation({
          invitation: mockInvitation,
        });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Invitation already used");
    });

    it("handles default failure error message", async () => {
      mockInvoke.mockResolvedValue({
        success: false,
      });

      const { result } = renderHook(() => useInvitations());

      let success: boolean = true;

      await act(async () => {
        success = await result.current.acceptInvitation({
          invitation: mockInvitation,
        });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Failed to accept invitation");
    });

    it("handles acceptance exception", async () => {
      mockInvoke.mockRejectedValue(new Error("Network timeout"));

      const { result } = renderHook(() => useInvitations());

      let success: boolean = true;

      await act(async () => {
        success = await result.current.acceptInvitation({
          invitation: mockInvitation,
        });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Network timeout");
      expect(result.current.isAccepting).toBe(false);
    });

    it("handles non-Error exceptions", async () => {
      mockInvoke.mockRejectedValue("String error");

      const { result } = renderHook(() => useInvitations());

      let success: boolean = true;

      await act(async () => {
        success = await result.current.acceptInvitation({
          invitation: mockInvitation,
        });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Failed to accept invitation");
    });
  });

  describe("clearInvitation", () => {
    it("clears all invitation state", async () => {
      mockInvoke.mockResolvedValue(mockCreateResponse);

      const { result } = renderHook(() => useInvitations());

      // First create an invitation
      await act(async () => {
        await result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });

      expect(result.current.currentInvitation).not.toBeNull();
      expect(result.current.qrCodeSvg).not.toBeNull();
      expect(result.current.deepLink).not.toBeNull();

      // Then clear it
      act(() => {
        result.current.clearInvitation();
      });

      expect(result.current.currentInvitation).toBeNull();
      expect(result.current.qrCodeSvg).toBeNull();
      expect(result.current.deepLink).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("can be called multiple times safely", () => {
      const { result } = renderHook(() => useInvitations());

      act(() => {
        result.current.clearInvitation();
        result.current.clearInvitation();
        result.current.clearInvitation();
      });

      expect(result.current.currentInvitation).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("clears error state", async () => {
      mockInvoke.mockRejectedValue(new Error("Some error"));

      const { result } = renderHook(() => useInvitations());

      // Trigger an error
      await act(async () => {
        await result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });

      expect(result.current.error).toBe("Some error");

      // Clear invitation
      act(() => {
        result.current.clearInvitation();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("workflow integration", () => {
    it("supports create-clear-create cycle", async () => {
      mockInvoke.mockResolvedValue(mockCreateResponse);

      const { result } = renderHook(() => useInvitations());

      // First creation
      await act(async () => {
        await result.current.createInvitation({
          level: "member",
          expiresInHours: 24,
        });
      });
      expect(result.current.currentInvitation).not.toBeNull();

      // Clear
      act(() => {
        result.current.clearInvitation();
      });
      expect(result.current.currentInvitation).toBeNull();

      // Second creation
      await act(async () => {
        await result.current.createInvitation({
          level: "guest",
          expiresInHours: 1,
        });
      });
      expect(result.current.currentInvitation).not.toBeNull();
    });

    it("supports scan-accept workflow", async () => {
      mockInvoke
        .mockResolvedValueOnce({
          invitation: mockInvitation,
          isValid: true,
        })
        .mockResolvedValueOnce({
          success: true,
          gatewayAddress: "192.168.1.100:3000",
          gatewayPubkey:
            "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
          level: "member" as AccessLevel,
        });

      const { result } = renderHook(() => useInvitations());

      // Scan
      let invitation: InvitationData | null = null;
      await act(async () => {
        invitation = await result.current.scanQRCode(
          "edwinpai://invite?token=aaa...",
        );
      });
      expect(invitation).not.toBeNull();

      // Accept
      let success: boolean = false;
      await act(async () => {
        success = await result.current.acceptInvitation({
          invitation: invitation!,
        });
      });
      expect(success).toBe(true);
    });
  });
});
