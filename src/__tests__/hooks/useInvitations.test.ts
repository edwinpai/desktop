/**
 * useInvitations Hook Tests
 *
 * Tests invitation creation, QR scanning, acceptance
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInvitations } from '@/hooks/useInvitations';
import type { InvitationData } from '@/types/api';

// Create mock handlers in vi.hoisted()
type MockHandler = unknown | ((args?: unknown) => unknown);

const { mockHandlers, mockInvoke } = vi.hoisted(() => {
  const mockHandlers = new Map<string, MockHandler>();
  
  return {
    mockHandlers,
    mockInvoke: vi.fn(async (command: string, args?: unknown) => {
      const handler = mockHandlers.get(command);
      if (!handler) {
        throw new Error(`No mock handler for command: ${command}`);
      }
      return typeof handler === 'function' ? handler(args) : handler;
    }),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Create mockIPC helper object for test convenience
const mockIPC = {
  mock: (command: string, response: MockHandler) => {
    mockHandlers.set(command, response);
  },
  clear: () => {
    mockHandlers.clear();
  },
  getInvokeMock: () => mockInvoke,
};

describe('useInvitations', () => {
  const mockInvitation: InvitationData = {
    version: 'edwinpai-invite-v1',
    invitation: {
      token: 'abc123',
      level: 'member',
      gatewayAddress: 'http://localhost:3000',
      gatewayPubkey: 'pubkey123',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
    petname: 'test-gateway',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useInvitations());

    expect(result.current.currentInvitation).toBeNull();
    expect(result.current.qrCodeSvg).toBeNull();
    expect(result.current.deepLink).toBeNull();
    expect(result.current.isCreating).toBe(false);
    expect(result.current.isScanning).toBe(false);
    expect(result.current.isAccepting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should create an invitation', async () => {
    mockIPC.mock('create_invitation', {
      invitation: mockInvitation,
      qrCodeSvg: '<svg>...</svg>',
      deepLink: 'edwinpai://invite/abc123',
    });

    const { result } = renderHook(() => useInvitations());

    const invitation = await act(async () => {
      return await result.current.createInvitation({
        level: 'member',
        expiresInHours: 24,
      });
    });

    expect(invitation).toEqual(mockInvitation);
    expect(result.current.currentInvitation).toEqual(mockInvitation);
    expect(result.current.qrCodeSvg).toBe('<svg>...</svg>');
    expect(result.current.deepLink).toBe('edwinpai://invite/abc123');
  });

  it('should handle create errors', async () => {
    mockIPC.mock('create_invitation', () => {
      throw new Error('Failed to create');
    });

    const { result } = renderHook(() => useInvitations());

    const invitation = await act(async () => {
      return await result.current.createInvitation({
        level: 'guest',
        expiresInHours: 1,
      });
    });

    expect(invitation).toBeNull();
    expect(result.current.error).toBe('Failed to create');
  });

  it('should scan QR code', async () => {
    mockIPC.mock('scan_qr_code', {
      invitation: mockInvitation,
      isValid: true,
    });

    const { result } = renderHook(() => useInvitations());

    const invitation = await act(async () => {
      return await result.current.scanQRCode('edwinpai://invite/abc123');
    });

    expect(invitation).toEqual(mockInvitation);
    expect(result.current.currentInvitation).toEqual(mockInvitation);
  });

  it('should handle scan errors', async () => {
    mockIPC.mock('scan_qr_code', () => {
      throw new Error('Invalid QR code');
    });

    const { result } = renderHook(() => useInvitations());

    const invitation = await act(async () => {
      return await result.current.scanQRCode('invalid-data');
    });

    expect(invitation).toBeNull();
    expect(result.current.error).toBe('Invalid QR code');
  });

  it('should accept an invitation', async () => {
    mockIPC.mock('accept_invitation', {
      success: true,
      gatewayAddress: 'http://localhost:3000',
      gatewayPubkey: 'pubkey123',
      level: 'member',
    });

    const { result } = renderHook(() => useInvitations());

    const success = await act(async () => {
      return await result.current.acceptInvitation({ invitation: mockInvitation });
    });

    expect(success).toBe(true);
  });

  it('should handle accept errors', async () => {
    mockIPC.mock('accept_invitation', () => {
      throw new Error('Invitation expired');
    });

    const { result } = renderHook(() => useInvitations());

    const success = await act(async () => {
      return await result.current.acceptInvitation({ invitation: mockInvitation });
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Invitation expired');
  });

  it('should clear invitation', async () => {
    mockIPC.mock('create_invitation', {
      invitation: mockInvitation,
      qrCodeSvg: '<svg>...</svg>',
      deepLink: 'edwinpai://invite/abc123',
    });

    const { result } = renderHook(() => useInvitations());

    // First create an invitation to set the state
    await act(async () => {
      await result.current.createInvitation({
        level: 'member',
        expiresInHours: 24,
      });
    });

    // Verify state is set
    expect(result.current.currentInvitation).toEqual(mockInvitation);

    // Then clear it
    act(() => {
      result.current.clearInvitation();
    });

    expect(result.current.currentInvitation).toBeNull();
    expect(result.current.qrCodeSvg).toBeNull();
    expect(result.current.deepLink).toBeNull();
  });
});
