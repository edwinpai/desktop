/**
 * IdentitySettings - BSV identity display and management
 *
 * Features:
 * - Display public key, petname, identicon
 * - Export identity (public key + petname)
 * - Import identity (for testing/recovery)
 * - Uses Phase 1 crypto domain via wrapper
 */

import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { getIdentity } from '@/lib/crypto-domain';

interface IdentityData {
  publicKey: string;
  petname: string;
  avatarSvg: string;
  shortId: string;
}

export function IdentitySettings() {
  const [identity, setIdentity] = useState<IdentityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Load identity on mount
  useEffect(() => {
    const loadIdentity = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await getIdentity();
        setIdentity({
          publicKey: response.public_key,
          petname: response.petname,
          avatarSvg: response.avatar_svg,
          shortId: response.short_id,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load identity. Make sure you have a BSV keypair configured.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadIdentity();
  }, []);

  const handleExport = async () => {
    if (!identity) return;

    try {
      const exportData = {
        publicKey: identity.publicKey,
        petname: identity.petname,
        shortId: identity.shortId,
        exportedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `edwinpai-identity-${identity.shortId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export identity');
    }
  };

  const handleCopyPublicKey = async () => {
    if (!identity) return;
    try {
      await navigator.clipboard.writeText(identity.publicKey);
      // Visual feedback could be added here
    } catch {
      setError('Failed to copy public key to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !identity) {
    return (
      <div className="p-6">
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-600 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">
                {error || 'Failed to load identity'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Identity Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your BSV identity and cryptographic public key
        </p>
      </div>

      {/* Identity Display */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Your Identity</h3>
        <div className="flex items-start gap-6">
          {/* Identicon */}
          <div className="shrink-0">
            <div
              className="w-24 h-24 rounded-lg border-2 border-muted overflow-hidden"
              dangerouslySetInnerHTML={{ __html: identity.avatarSvg }}
            />
            <p className="text-xs text-center text-muted-foreground mt-2">
              {identity.shortId}
            </p>
          </div>

          {/* Identity Details */}
          <div className="flex-1 space-y-4">
            <div>
              <Label>Petname</Label>
              <p className="text-2xl font-semibold mt-1">{identity.petname}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Deterministically generated from your public key
              </p>
            </div>

            <div>
              <Label>Public Key</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 p-2 rounded-md bg-muted text-xs font-mono break-all">
                  {identity.publicKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPublicKey}
                  className="shrink-0"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Compressed secp256k1 public key (33 bytes / 66 hex characters)
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Export/Import */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Identity Management</h3>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
            <div className="flex-1">
              <h4 className="font-medium">Export Public Identity</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Download your public identity information for backup or sharing.
                This does not include your private key.
              </p>
            </div>
            <Button onClick={handleExport} variant="outline">
              Export
            </Button>
          </div>

          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border opacity-60">
            <div className="flex-1">
              <h4 className="font-medium">Import Identity</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Import an existing identity from backup. Coming soon.
              </p>
            </div>
            <Button disabled variant="outline">
              Import Identity (Coming Soon)
            </Button>
          </div>
        </div>

        {exportSuccess && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Identity exported successfully</span>
          </div>
        )}
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-muted/50">
        <h4 className="font-medium mb-2">About Your Identity:</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• Your identity is based on BRC-42 and BRC-103 standards</li>
          <li>• Your petname and avatar are deterministically derived from your public key</li>
          <li>• Your private key never leaves the secure crypto domain</li>
          <li>• This identity can be used for cryptographic authentication and signing</li>
        </ul>
      </Card>
    </div>
  );
}
