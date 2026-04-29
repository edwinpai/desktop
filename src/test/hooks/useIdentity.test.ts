import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIdentity } from '@/hooks/useIdentity';
import * as cryptoDomain from '@/lib/crypto-domain';

vi.mock('@/lib/crypto-domain', () => ({
  getIdentity: vi.fn(),
  deriveKey: vi.fn(),
  signMessage: vi.fn(),
  verifyMessage: vi.fn(),
  generateIdenticon: vi.fn(),
}));

describe('useIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cryptoDomain.getIdentity).mockResolvedValue({
      public_key: '02abcdef',
      petname: 'Swift Falcon',
      avatar_svg: '<svg />',
      short_id: 'edw:12345678',
    });
  });

  it('loads identity on mount and maps wrapper fields to UI identity shape', async () => {
    const { result } = renderHook(() => useIdentity());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(cryptoDomain.getIdentity).toHaveBeenCalled();
    expect(result.current.identity).toEqual({
      publicKey: '02abcdef',
      petname: 'Swift Falcon',
      avatarSvg: '<svg />',
      shortId: 'edw:12345678',
    });
  });

  it('derives keys through the crypto-domain wrapper', async () => {
    vi.mocked(cryptoDomain.deriveKey).mockResolvedValue({ public_key: '03feedface' });
    const { result } = renderHook(() => useIdentity());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      result.current.deriveKey({
        protocolId: 'edwinpai',
        keyId: 'chat',
        counterparty: '02counterparty',
        securityLevel: 3,
      }),
    ).resolves.toBe('03feedface');

    expect(cryptoDomain.deriveKey).toHaveBeenCalledWith('edwinpai', 'chat', '02counterparty', 3);
  });

  it('signs and verifies messages through the crypto-domain wrapper', async () => {
    vi.mocked(cryptoDomain.signMessage).mockResolvedValue({
      signature: [1, 2, 3],
      public_key: '02abcdef',
    });
    vi.mocked(cryptoDomain.verifyMessage).mockResolvedValue({ valid: true });

    const { result } = renderHook(() => useIdentity());
    const data = new Uint8Array([9, 8, 7]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const signed = await result.current.signMessage(data, {
      protocolId: 'edwinpai',
      keyId: 'msg',
      counterparty: '02counterparty',
      useIdentityKey: true,
    });

    expect(cryptoDomain.signMessage).toHaveBeenCalledWith(data, {
      protocolId: 'edwinpai',
      keyId: 'msg',
      counterparty: '02counterparty',
      useIdentityKey: true,
    });
    expect(Array.from(signed.signature)).toEqual([1, 2, 3]);
    expect(signed.publicKey).toBe('02abcdef');

    await expect(result.current.verifyMessage(data, signed.signature, signed.publicKey)).resolves.toBe(true);
    expect(cryptoDomain.verifyMessage).toHaveBeenCalledWith(data, signed.signature, '02abcdef');
  });

  it('generates identicons through the crypto-domain wrapper', async () => {
    vi.mocked(cryptoDomain.generateIdenticon).mockResolvedValue({ svg: '<svg>identicon</svg>' });
    const { result } = renderHook(() => useIdentity());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(result.current.generateIdenticon('02abcdef', 96)).resolves.toBe('<svg>identicon</svg>');
    expect(cryptoDomain.generateIdenticon).toHaveBeenCalledWith('02abcdef', 96);
  });

  it('surfaces identity load errors', async () => {
    vi.mocked(cryptoDomain.getIdentity).mockRejectedValueOnce(new Error('identity unavailable'));

    const { result } = renderHook(() => useIdentity());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('identity unavailable');
    expect(result.current.identity).toBeNull();
  });
});
