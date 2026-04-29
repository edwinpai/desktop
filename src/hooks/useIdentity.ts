/**
 * useIdentity hook (Phase 1)
 *
 * React hook for interacting with the Crypto Domain's identity operations.
 * Provides methods to get identity, derive keys, sign messages, and generate identicons.
 */

import { useCallback, useEffect, useState } from "react";

import {
  deriveKey as deriveCryptoKey,
  generateIdenticon as generateCryptoIdenticon,
  getIdentity,
  signMessage as signCryptoMessage,
  verifyMessage as verifyCryptoMessage,
} from "@/lib/crypto-domain";
import type { Identity } from "@/types/identity";

interface DeriveKeyRequest {
  protocolId: string;
  keyId: string;
  counterparty: string;
  securityLevel?: number;
}

// --- Hook State ---

interface UseIdentityReturn {
  identity: Identity | null;
  loading: boolean;
  error: string | null;

  // Operations
  loadIdentity: () => Promise<void>;
  deriveKey: (params: DeriveKeyRequest) => Promise<string>;
  signMessage: (
    data: Uint8Array,
    params?: {
      protocolId?: string;
      keyId?: string;
      counterparty?: string;
      useIdentityKey?: boolean;
    }
  ) => Promise<{ signature: Uint8Array; publicKey: string }>;
  verifyMessage: (data: Uint8Array, signature: Uint8Array, publicKey: string) => Promise<boolean>;
  generateIdenticon: (publicKey: string, size?: number) => Promise<string>;
}

export function useIdentity(): UseIdentityReturn {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIdentity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getIdentity();
      setIdentity({
        publicKey: response.public_key,
        petname: response.petname,
        avatarSvg: response.avatar_svg,
        shortId: response.short_id,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error("Failed to load identity:", errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const deriveKey = useCallback(async (params: DeriveKeyRequest): Promise<string> => {
    try {
      const response = await deriveCryptoKey(
        params.protocolId,
        params.keyId,
        params.counterparty,
        params.securityLevel,
      );
      return response.public_key;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to derive key:", errorMsg);
      throw new Error(errorMsg);
    }
  }, []);

  const signMessage = useCallback(
    async (
      data: Uint8Array,
      params?: {
        protocolId?: string;
        keyId?: string;
        counterparty?: string;
        useIdentityKey?: boolean;
      },
    ): Promise<{ signature: Uint8Array; publicKey: string }> => {
      try {
        const response = await signCryptoMessage({ data, ...params });

        return {
          signature: new Uint8Array(response.signature),
          publicKey: response.public_key,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to sign message:", errorMsg);
        throw new Error(errorMsg);
      }
    },
    [],
  );

  const verifyMessage = useCallback(
    async (data: Uint8Array, signature: Uint8Array, publicKey: string): Promise<boolean> => {
      try {
        const response = await verifyCryptoMessage(data, signature, publicKey);
        return response.valid;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to verify message:", errorMsg);
        throw new Error(errorMsg);
      }
    },
    [],
  );

  const generateIdenticon = useCallback(async (publicKey: string, size?: number): Promise<string> => {
    try {
      const response = await generateCryptoIdenticon(publicKey, size);
      return response.svg;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to generate identicon:", errorMsg);
      throw new Error(errorMsg);
    }
  }, []);

  // Auto-load identity on mount
  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  return {
    identity,
    loading,
    error,
    loadIdentity,
    deriveKey,
    signMessage,
    verifyMessage,
    generateIdenticon,
  };
}
