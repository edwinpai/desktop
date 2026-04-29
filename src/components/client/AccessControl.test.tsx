import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessControl } from './AccessControl';

import * as cryptoDomain from '@/lib/crypto-domain';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === 'list_users') return { users: [] };
    if (command === 'list_invitations') return { invitations: [] };
    return null;
  }),
}));

vi.mock('@/hooks/useInvitations', () => ({
  useInvitations: () => ({
    currentInvitation: null,
    qrCodeSvg: null,
    deepLink: null,
    isCreating: false,
    error: null,
    createInvitation: vi.fn(),
    viewInvitation: vi.fn(),
    clearInvitation: vi.fn(),
  }),
}));

vi.mock('@/lib/crypto-domain', () => ({
  getIdentity: vi.fn(),
  signMessage: vi.fn(),
  verifyMessage: vi.fn(),
}));

describe('AccessControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cryptoDomain.getIdentity).mockResolvedValue({
      public_key: '02abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      petname: 'Swift Falcon',
      avatar_svg: '<svg></svg>',
      short_id: 'edw:12345678',
    });
  });

  it('loads and renders local identity via crypto-domain wrapper', async () => {
    render(<AccessControl currentUserLevel="owner" currentMode="client" />);

    await waitFor(() => {
      expect(cryptoDomain.getIdentity).toHaveBeenCalled();
    });

    expect(await screen.findByRole('button', { name: /self-check/i })).toBeInTheDocument();
    expect(screen.getAllByText('edw:12345678').length).toBeGreaterThan(0);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('runs self-check through crypto-domain sign/verify helpers', async () => {
    const user = userEvent.setup();
    vi.mocked(cryptoDomain.signMessage).mockResolvedValue({
      signature: [1, 2, 3],
      public_key: '02abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    });
    vi.mocked(cryptoDomain.verifyMessage).mockResolvedValue({ valid: true });

    render(<AccessControl currentUserLevel="owner" currentMode="client" />);

    const button = await screen.findByRole('button', { name: /self-check/i });
    await user.click(button);

    await waitFor(() => {
      expect(cryptoDomain.signMessage).toHaveBeenCalled();
      expect(cryptoDomain.verifyMessage).toHaveBeenCalled();
    });

    const signArgs = vi.mocked(cryptoDomain.signMessage).mock.calls[0];
    const signParams = signArgs?.[0];
    expect(signParams).toBeDefined();
    expect(ArrayBuffer.isView(signParams?.data)).toBe(true);
    const signedText = new TextDecoder().decode(signParams?.data ?? new Uint8Array());
    expect(signedText.startsWith('edwinpai-self-check-')).toBe(true);
    expect(signParams?.useIdentityKey).toBe(true);

    const signedData = signParams?.data;
    const verifyArgs = vi.mocked(cryptoDomain.verifyMessage).mock.calls[0];
    expect(verifyArgs?.[0]).toBe(signedData);
    expect(Array.from(verifyArgs?.[1] ?? [])).toEqual([1, 2, 3]);
    expect(verifyArgs?.[2]).toBe('02abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

    expect(await screen.findByText('Verified')).toBeInTheDocument();
  });
});
