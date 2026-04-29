import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import { getAuthIdentity, getIdentity, signChallenge } from '@/lib/crypto-domain';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('crypto-domain wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls get_identity', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      public_key: '02abcdef',
      petname: 'Swift Falcon',
      avatar_svg: '<svg />',
      short_id: 'edw:12345678',
    });

    await expect(getIdentity()).resolves.toEqual({
      public_key: '02abcdef',
      petname: 'Swift Falcon',
      avatar_svg: '<svg />',
      short_id: 'edw:12345678',
    });
    expect(invoke).toHaveBeenCalledWith('get_identity');
  });

  it('calls get_auth_identity', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      publicKey: '02abcdef',
      shortId: 'edw:12345678',
      petname: 'Swift Falcon',
      fingerprint: '0f715baf5d4c2ed3',
    });

    await expect(getAuthIdentity()).resolves.toEqual({
      publicKey: '02abcdef',
      shortId: 'edw:12345678',
      petname: 'Swift Falcon',
      fingerprint: '0f715baf5d4c2ed3',
    });
    expect(invoke).toHaveBeenCalledWith('get_auth_identity');
  });

  it('calls sign_challenge with challenge payload', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      publicKey: '02abcdef',
      signature: 'deadbeef',
      shortId: 'edw:12345678',
    });

    await expect(signChallenge('hello')).resolves.toEqual({
      publicKey: '02abcdef',
      signature: 'deadbeef',
      shortId: 'edw:12345678',
    });
    expect(invoke).toHaveBeenCalledWith('sign_challenge', { challenge: 'hello' });
  });
});
