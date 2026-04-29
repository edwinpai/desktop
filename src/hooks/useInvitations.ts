/**
 * useInvitations - QR code generation and scanning for gateway invitations
 */

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AccessLevel, InvitationData } from '@/types/api';

interface CreateInvitationParams {
  level: AccessLevel;
  expiresInHours: number;
}

interface CreateInvitationResponse {
  token: string;
  invitationData: string; // JSON-encoded InvitationData
  qrCodeSvg: string;
  deepLink: string;
  expiresAt: string;
}

interface ScanQRResponse {
  invitation: InvitationData;
  isValid: boolean;
  error?: string;
}

interface AcceptInvitationParams {
  invitation: InvitationData;
}

interface AcceptInvitationResponse {
  success: boolean;
  gatewayAddress: string;
  gatewayPubkey: string;
  level: AccessLevel;
  error?: string;
}

interface UseInvitationsReturn {
  currentInvitation: InvitationData | null;
  qrCodeSvg: string | null;
  deepLink: string | null;
  isCreating: boolean;
  isScanning: boolean;
  isAccepting: boolean;
  error: string | null;
  createInvitation: (params: CreateInvitationParams) => Promise<InvitationData | null>;
  viewInvitation: (token: string) => Promise<boolean>;
  scanQRCode: (qrData: string) => Promise<InvitationData | null>;
  acceptInvitation: (params: AcceptInvitationParams) => Promise<boolean>;
  clearInvitation: () => void;
}

/**
 * Hook for creating and redeeming gateway invitations via QR codes
 */
export function useInvitations(): UseInvitationsReturn {
  const [currentInvitation, setCurrentInvitation] = useState<InvitationData | null>(
    null
  );
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInvitation = useCallback(
    async (params: CreateInvitationParams): Promise<InvitationData | null> => {
      try {
        setIsCreating(true);
        setError(null);

        const response = await invoke<CreateInvitationResponse>('create_invitation', {
          request: {
            level: params.level,
            expiresInHours: params.expiresInHours,
          },
        });

        // Parse invitation data from JSON string
        const invitationData: InvitationData = JSON.parse(response.invitationData);
        setCurrentInvitation(invitationData);
        setQrCodeSvg(response.qrCodeSvg);
        setDeepLink(response.deepLink);

        return invitationData;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create invitation';
        setError(errorMsg);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const scanQRCode = useCallback(
    async (qrData: string): Promise<InvitationData | null> => {
      try {
        setIsScanning(true);
        setError(null);

        const response = await invoke<ScanQRResponse>('scan_qr_code', {
          request: { qrData },
        });

        if (!response.isValid) {
          setError(response.error || 'Invalid QR code');
          return null;
        }

        setCurrentInvitation(response.invitation);
        return response.invitation;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to scan QR code';
        setError(errorMsg);
        return null;
      } finally {
        setIsScanning(false);
      }
    },
    []
  );

  const acceptInvitation = useCallback(
    async (params: AcceptInvitationParams): Promise<boolean> => {
      try {
        setIsAccepting(true);
        setError(null);

        const response = await invoke<AcceptInvitationResponse>('accept_invitation', {
          request: { invitation: params.invitation },
        });

        if (!response.success) {
          setError(response.error || 'Failed to accept invitation');
          return false;
        }

        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to accept invitation';
        setError(errorMsg);
        return false;
      } finally {
        setIsAccepting(false);
      }
    },
    []
  );

  const viewInvitation = useCallback(
    async (token: string): Promise<boolean> => {
      try {
        setError(null);

        const response = await invoke<CreateInvitationResponse>('get_invitation_qr', { token });

        const invitationData: InvitationData = JSON.parse(response.invitationData);
        setCurrentInvitation(invitationData);
        setQrCodeSvg(response.qrCodeSvg);
        setDeepLink(response.deepLink);

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load invitation';
        setError(errorMsg);
        return false;
      }
    },
    []
  );

  const clearInvitation = useCallback(() => {
    setCurrentInvitation(null);
    setQrCodeSvg(null);
    setDeepLink(null);
    setError(null);
  }, []);

  return {
    currentInvitation,
    qrCodeSvg,
    deepLink,
    isCreating,
    isScanning,
    isAccepting,
    error,
    createInvitation,
    viewInvitation,
    scanQRCode,
    acceptInvitation,
    clearInvitation,
  };
}
