/**
 * AccessControl - Multi-user authorization management (owner only)
 *
 * Features:
 * - Create invitations with QR codes and deep links
 * - Active invitations list with view/revoke
 * - Redeem invitation (test client flow)
 * - Authorized users list from backend
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle, AlertTriangle, Copy, Shield, RefreshCw, Key, CheckCircle2, XCircle } from 'lucide-react';

import { getIdentity, signMessage, verifyMessage } from '@/lib/crypto-domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInvitations } from '@/hooks/useInvitations';
import type { AccessLevel, Invitation } from '@/types/auth';

interface AuthUser {
  pubkey: string;
  petname: string;
  level: AccessLevel;
  authorizedAt: string;
  lastActive: string;
  invitedBy?: string;
}

interface AccessControlProps {
  /** Current user's access level */
  currentUserLevel: AccessLevel;
  /** Current app mode — gateway or client */
  currentMode?: 'gateway' | 'client';
}

export function AccessControl({
  currentUserLevel,
  currentMode = 'gateway',
}: AccessControlProps) {
  const {
    currentInvitation,
    qrCodeSvg,
    deepLink,
    isCreating,
    error,
    createInvitation,
    viewInvitation,
    clearInvitation,
  } = useInvitations();

  const [activeInvitations, setActiveInvitations] = useState<Invitation[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthUser[]>([]);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    level: 'member' as AccessLevel,
    expiresInHours: 24,
  });
  const [removingUser, setRemovingUser] = useState<string | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);

  // Redeem state
  const [redeemInput, setRedeemInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; message: string } | null>(null);

  // Local identity (BSV Type-42 key from keychain)
  const [localIdentity, setLocalIdentity] = useState<{
    publicKey: string;
    petname: string;
    shortId: string;
    avatarSvg: string;
  } | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [selfCheckResult, setSelfCheckResult] = useState<{
    status: 'idle' | 'running' | 'pass' | 'fail';
    message?: string;
    timestamp?: string;
  }>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  const loadIdentity = useCallback(async () => {
    try {
      const identity = await getIdentity();
      setLocalIdentity({
        publicKey: identity.public_key,
        petname: identity.petname,
        shortId: identity.short_id,
        avatarSvg: identity.avatar_svg,
      });
      setIdentityError(null);
    } catch (err) {
      console.error('Failed to load identity:', err);
      setIdentityError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  const handleCopyPubkey = () => {
    if (localIdentity?.publicKey) {
      navigator.clipboard.writeText(localIdentity.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelfCheck = async () => {
    setSelfCheckResult({ status: 'running' });
    try {
      // Sign a test message with the identity key
      const testData = new TextEncoder().encode('edwinpai-self-check-' + Date.now());
      const signResult = await signMessage({
        data: testData,
        useIdentityKey: true,
      });

      // Verify the signature
      const verifyResult = await verifyMessage(
        testData,
        new Uint8Array(signResult.signature),
        signResult.public_key,
      );

      if (verifyResult.valid && signResult.public_key === localIdentity?.publicKey) {
        setSelfCheckResult({
          status: 'pass',
          message: 'Sign + verify passed. Key is active and operational.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setSelfCheckResult({
          status: 'fail',
          message: verifyResult.valid
            ? 'Signature valid but key mismatch — signing key differs from displayed identity.'
            : 'Signature verification failed.',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err) {
      setSelfCheckResult({
        status: 'fail',
        message: `Self-check failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const isOwner = currentUserLevel === 'owner';

  // Load data on mount
  useEffect(() => {
    if (isOwner) {
      refreshInvitations();
      refreshUsers();
    }
  }, [isOwner]);

  const refreshUsers = async () => {
    try {
      const response = await invoke<{ users: AuthUser[] }>('list_users', {
        request: {},
      });
      setAuthorizedUsers(response.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const refreshInvitations = async () => {
    try {
      const response = await invoke<{ invitations: Invitation[] }>('list_invitations', {
        request: {},
      });
      setActiveInvitations(response.invitations.filter((inv) => inv.status === 'pending'));
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  };

  const handleCreateInvitation = async () => {
    const invitation = await createInvitation({
      level: inviteForm.level,
      expiresInHours: inviteForm.expiresInHours,
    });

    if (invitation) {
      setShowQrDialog(true);
      await refreshInvitations();
    }
  };

  const handleRemoveUser = async (pubkey: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;

    setRemovingUser(pubkey);
    try {
      await invoke('remove_user', { request: { pubkey } });
      await refreshUsers();
    } catch (err) {
      console.error('Failed to remove user:', err);
    } finally {
      setRemovingUser(null);
    }
  };

  const handleRevokeInvitation = async (token: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;

    setRevokingInvite(token);
    try {
      await invoke('revoke_invitation', { request: { token } });
      if (currentInvitation?.invitation?.token === token) {
        setShowQrDialog(false);
        clearInvitation();
      }
      await refreshInvitations();
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
    } finally {
      setRevokingInvite(null);
    }
  };

  const handleViewInvitation = async (token: string) => {
    const success = await viewInvitation(token);
    if (success) {
      setShowQrDialog(true);
    }
  };

  const handleCopyDeepLink = () => {
    if (deepLink) {
      navigator.clipboard.writeText(deepLink);
    }
  };

  const handleRedeem = async () => {
    if (!redeemInput.trim()) return;

    setIsRedeeming(true);
    setRedeemResult(null);

    try {
      // Parse token from deep link or raw token
      let token = redeemInput.trim();
      if (token.startsWith('edwinpai://invite/')) {
        // Extract base64 payload from deep link
        const base64Part = token.replace('edwinpai://invite/', '');
        try {
          const jsonStr = atob(base64Part.replace(/-/g, '+').replace(/_/g, '/'));
          const invitationData = JSON.parse(jsonStr);
          token = invitationData.invitation?.token || token;
        } catch {
          // If parsing fails, use as-is (might be a raw token)
        }
      }

      // Use real local identity key (BSV Type-42 from keychain)
      if (!localIdentity?.publicKey) {
        setRedeemResult({ success: false, message: 'No identity key found. Generate an identity first in Settings.' });
        setIsRedeeming(false);
        return;
      }
      const clientPubkey = localIdentity.publicKey;

      const response = await invoke<{
        success: boolean;
        message: string;
        accessLevel?: AccessLevel;
      }>('redeem_invitation', {
        request: {
          token,
          clientPubkey,
        },
      });

      setRedeemResult({
        success: response.success,
        message: response.message + (response.accessLevel ? ` (Level: ${response.accessLevel})` : ''),
      });

      if (response.success) {
        setRedeemInput('');
        // Identity key stays — no need to clear
        // Refresh both lists
        await refreshInvitations();
        await refreshUsers();
      }
    } catch (err) {
      setRedeemResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  if (!isOwner) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted-foreground/50 mb-4">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h4 className="text-lg font-medium mb-2">Access Restricted</h4>
          <p className="text-sm text-muted-foreground">Only gateway owners can manage user access.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blockchain Identity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Blockchain Identity</h3>
          </div>
          {localIdentity && (
            <Badge variant="default" className="bg-green-600 text-white gap-1">
              <Shield className="h-3 w-3" /> Active
            </Badge>
          )}
          {identityError && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Missing Key
            </Badge>
          )}
        </div>

        {localIdentity ? (
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Identity</span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full overflow-hidden inline-block"
                    dangerouslySetInnerHTML={{ __html: localIdentity.avatarSvg }}
                  />
                  <span className="font-medium">{localIdentity.petname}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Key Type</span>
                <span className="font-mono text-sm">BSV / secp256k1 (BRC-42)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Public Key</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{localIdentity.publicKey.slice(0, 10)}...{localIdentity.publicKey.slice(-10)}</span>
                  <Button variant="ghost" size="sm" onClick={handleCopyPubkey} className="h-6 w-6 p-0">
                    {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Short ID</span>
                <span className="font-mono text-sm">{localIdentity.shortId}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <span className="text-sm text-muted-foreground">Key Source</span>
                <span className="font-mono text-xs">OS Keychain (com.edwinpai.desktop)</span>
              </div>
            </div>

            {/* Self-check */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                {selfCheckResult.status === 'pass' && (
                  <div className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Verified</span>
                    <span className="text-xs text-muted-foreground">({selfCheckResult.timestamp})</span>
                  </div>
                )}
                {selfCheckResult.status === 'fail' && (
                  <div className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{selfCheckResult.message}</span>
                  </div>
                )}
                {selfCheckResult.status === 'idle' && (
                  <span className="text-sm text-muted-foreground">Run self-check to verify key integrity</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelfCheck}
                disabled={selfCheckResult.status === 'running'}
              >
                {selfCheckResult.status === 'running' ? (
                  <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Checking...</>
                ) : (
                  <><Shield className="h-3.5 w-3.5 mr-1.5" /> Self-Check</>
                )}
              </Button>
            </div>
          </div>
        ) : identityError ? (
          <div className="p-4 rounded-md bg-destructive/10 text-center">
            <p className="text-sm text-destructive mb-2">Identity key not found in keychain.</p>
            <p className="text-xs text-muted-foreground">Generate an identity during onboarding or in Settings.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </Card>

      {/* Create Invitation Form — Gateway Mode only */}
      {currentMode === 'gateway' && <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Create Invitation</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Permission Level</Label>
              <Select
                value={inviteForm.level}
                onValueChange={(value) => setInviteForm({ ...inviteForm, level: value as AccessLevel })}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member (Read + Write)</SelectItem>
                  <SelectItem value="guest">Guest (Read Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expires In</Label>
              <Select
                value={String(inviteForm.expiresInHours)}
                onValueChange={(value) => setInviteForm({ ...inviteForm, expiresInHours: parseInt(value) })}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200">
              <p className="text-sm text-red-900">{error}</p>
            </div>
          )}

          <Button onClick={handleCreateInvitation} disabled={isCreating} className="w-full">
            {isCreating ? 'Creating...' : 'Create Invitation'}
          </Button>
        </div>
      </Card>}

      {/* Redeem Invitation — Client Mode only */}
      {currentMode === 'client' && <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Redeem Invitation</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Paste an invitation deep link or token to authorize this device.
        </p>

        {/* Identity status */}
        {localIdentity ? (
          <div className="mb-4 p-3 rounded-md bg-muted text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Identity</span>
              <span className="font-medium">{localIdentity.petname}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Key Type</span>
              <span className="font-mono text-xs">BSV/secp256k1 (Type-42)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Public Key</span>
              <span className="font-mono text-xs">{localIdentity.publicKey.slice(0, 8)}...{localIdentity.publicKey.slice(-8)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs">{localIdentity.shortId}</span>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 text-sm">
            <p className="text-destructive">No identity key found. Generate an identity in Settings first.</p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label>Deep Link or Token</Label>
            <Input
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value)}
              placeholder="edwinpai://invite/... or raw token"
              className="mt-1.5 font-mono text-xs"
            />
          </div>

          {redeemResult && (
            <div className={`p-3 rounded-md border ${redeemResult.success
              ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
              : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}>
              <p className={`text-sm ${redeemResult.success
                ? 'text-green-900 dark:text-green-100'
                : 'text-red-900 dark:text-red-100'
              }`}>
                {redeemResult.success ? <CheckCircle2 className="h-4 w-4 inline text-green-500 mr-1" /> : <XCircle className="h-4 w-4 inline text-red-500 mr-1" />}{redeemResult.message}
              </p>
            </div>
          )}

          <Button onClick={handleRedeem} disabled={isRedeeming || !redeemInput.trim() || !localIdentity} className="w-full" variant="secondary">
            {isRedeeming ? 'Redeeming...' : 'Redeem Invitation'}
          </Button>
        </div>
      </Card>}

      {/* Active Invitations — Gateway Mode only */}
      {currentMode === 'gateway' && <div>
        <h3 className="text-lg font-semibold mb-3">Active Invitations</h3>
        {activeInvitations.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground text-center">
              No active invitations. Create one above to invite users.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeInvitations.map((invitation) => (
              <Card key={invitation.token} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <AccessBadge level={invitation.level} />
                      <span className="text-sm text-muted-foreground">
                        Expires {formatExpiration(invitation.expiresAt)}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground truncate">
                      {invitation.token.slice(0, 32)}...
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewInvitation(invitation.token)}>
                      View QR
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeInvitation(invitation.token)}
                      disabled={revokingInvite === invitation.token}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {revokingInvite === invitation.token ? 'Revoking...' : 'Revoke'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>}

      {/* Authorized Users — Gateway Mode only */}
      {currentMode === 'gateway' && <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Authorized Users</h3>
          <Button variant="ghost" size="sm" onClick={refreshUsers}>
            Refresh
          </Button>
        </div>
        {authorizedUsers.length === 0 ? (
          <Card className="p-8">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted-foreground/50 mb-4">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="text-sm text-muted-foreground">
                No authorized users yet. Create an invitation and redeem it to add users.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {authorizedUsers.map((user) => {
              const isCurrentOwner = user.level === 'owner';
              const isRemoving = removingUser === user.pubkey;

              return (
                <Card key={user.pubkey} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{user.petname}</p>
                        <AccessBadge level={user.level} />
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {user.pubkey}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Added {formatDate(user.authorizedAt)}</span>
                        <span>•</span>
                        <span>Last active {formatDate(user.lastActive)}</span>
                      </div>
                    </div>

                    {!isCurrentOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(user.pubkey)}
                        disabled={isRemoving}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {isRemoving ? 'Removing...' : 'Remove'}
                      </Button>
                    )}

                    {isCurrentOwner && (
                      <div className="shrink-0">
                        <p className="text-xs text-muted-foreground italic">Owner</p>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>}

      {/* QR Code Display Dialog — Gateway Mode only */}
      <Dialog
        open={showQrDialog}
        onOpenChange={(open) => {
          setShowQrDialog(open);
          if (!open) clearInvitation();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitation QR Code</DialogTitle>
            <DialogDescription>
              Share this QR code or link with the user you want to invite
            </DialogDescription>
          </DialogHeader>

          {qrCodeSvg && (
            <div className="space-y-4">
              <div className="flex justify-center p-6 bg-white rounded-lg border">
                <div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />
              </div>

              <div>
                <Label>Deep Link</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input value={deepLink || ''} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={handleCopyDeepLink}>Copy</Button>
                </div>
              </div>

              {currentInvitation && (
                <div className="p-3 rounded-md bg-muted/50 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permission:</span>
                    <span className="font-medium">
                      {currentInvitation.invitation.level.charAt(0).toUpperCase() +
                        currentInvitation.invitation.level.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span className="font-medium">
                      {formatExpiration(currentInvitation.invitation.expiresAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gateway:</span>
                    <span className="font-medium font-mono text-xs">
                      {currentInvitation.petname || currentInvitation.invitation.gatewayAddress}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowQrDialog(false);
                clearInvitation();
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessBadge({ level }: { level: AccessLevel }) {
  const colors = {
    owner: 'bg-purple-100 text-purple-700 border-purple-200',
    member: 'bg-blue-100 text-blue-700 border-blue-200',
    guest: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[level]}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatExpiration(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 0) return 'expired';
  if (diffHours < 1) return 'in less than 1 hour';
  if (diffHours < 24) return `in ${diffHours} hours`;

  const diffDays = Math.floor(diffHours / 24);
  return `in ${diffDays} days`;
}
