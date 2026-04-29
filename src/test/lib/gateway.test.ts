import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import { GatewayClient } from '@/lib/gateway';
import * as cryptoDomain from '@/lib/crypto-domain';

vi.mock('@/lib/crypto-domain', () => ({
  getIdentity: vi.fn(),
  signMessage: vi.fn(),
}));

describe('gateway auth wrapper integration', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  it('authenticates via crypto-domain wrappers', async () => {
    vi.mocked(cryptoDomain.getIdentity).mockResolvedValue({
      public_key: '02abcdef',
      petname: 'Swift Falcon',
      avatar_svg: '<svg />',
      short_id: 'edw:12345678',
    });
    vi.mocked(cryptoDomain.signMessage).mockResolvedValue({
      signature: [0xde, 0xad, 0xbe, 0xef],
      public_key: '02abcdef',
    });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nonce: 'test-nonce' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, sessionToken: 'session-token', petname: 'Swift Falcon' }),
      });

    const client = new GatewayClient('https://gateway.example/');
    await expect(client.authenticate()).resolves.toEqual({
      success: true,
      petname: 'Swift Falcon',
    });

    expect(cryptoDomain.getIdentity).toHaveBeenCalledTimes(1);
    expect(cryptoDomain.signMessage).toHaveBeenCalledTimes(1);
    expect(invoke).not.toHaveBeenCalled();

    const signCall = vi.mocked(cryptoDomain.signMessage).mock.calls[0]?.[0];
    expect(ArrayBuffer.isView(signCall?.data as ArrayBufferView)).toBe(true);
    expect(new TextDecoder().decode(signCall?.data)).toBe('test-nonce');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://gateway.example/v1/auth/initial',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ publicKey: '02abcdef' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://gateway.example/v1/auth/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          publicKey: '02abcdef',
          nonce: 'test-nonce',
          signature: 'deadbeef',
        }),
      }),
    );
    expect(client.isAuthenticated()).toBe(true);
    expect(client.getPublicKey()).toBe('02abcdef');
  });
});
