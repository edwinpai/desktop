/**
 * Invitation Manager - Create and share QR codes for gateway invitations
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccessLevel, InvitationData } from "@/types/api";
import { useInvitations } from "@/hooks/useInvitations";

interface InvitationManagerProps {
  onInvitationCreated?: (invitation: InvitationData) => void;
  defaultLevel?: AccessLevel;
}

export function InvitationManager({
  onInvitationCreated,
  defaultLevel = "guest",
}: InvitationManagerProps) {
  const [level, setLevel] = useState<AccessLevel>(defaultLevel);
  const [expiresInHours, setExpiresInHours] = useState<number>(24);

  const { createInvitation, currentInvitation, qrCodeSvg, isCreating, error } =
    useInvitations();

  const handleCreate = async () => {
    const invitation = await createInvitation({ level, expiresInHours });
    if (invitation) {
      onInvitationCreated?.(invitation);
    }
  };

  const handleCopyLink = () => {
    if (!currentInvitation) return;

    const link = `edwinpai://invite/${btoa(JSON.stringify(currentInvitation))}`;
    navigator.clipboard.writeText(link);
  };

  const handleCopyQR = () => {
    if (!qrCodeSvg) return;

    const blob = new Blob([qrCodeSvg], { type: "image/svg+xml" });
    const item = new ClipboardItem({ "image/svg+xml": blob });
    navigator.clipboard.write([item]);
  };

  return (
    <div className="space-y-6">
      {!currentInvitation ? (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Create Invitation</h3>

          <div className="space-y-4">
            <div>
              <Label>Access Level</Label>
              <Select
                value={level}
                onValueChange={(value) => setLevel(value as AccessLevel)}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member (Read + Write)</SelectItem>
                  <SelectItem value="guest">Guest (Read Only)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {level === "member"
                  ? "Members can read and write messages"
                  : "Guests can only read messages"}
              </p>
            </div>

            <div>
              <Label htmlFor="expires">Expires In</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  id="expires"
                  type="number"
                  min="1"
                  max="168"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Invitation will expire after {expiresInHours}h (
                {Math.floor(expiresInHours / 24)}d {expiresInHours % 24}h)
              </p>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Creating...
                </>
              ) : (
                "Create Invitation"
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Invitation Created</h3>
                <p className="text-sm text-muted-foreground">
                  Share this QR code or link with the recipient
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Create Another
              </Button>
            </div>

            {/* QR Code Display */}
            {qrCodeSvg && (
              <div className="flex justify-center my-6">
                <div
                  className="p-4 bg-white rounded-lg border"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                />
              </div>
            )}

            {/* Invitation Details */}
            <div className="space-y-3 mb-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Access Level
                </p>
                <p className="text-sm font-medium capitalize">
                  {currentInvitation.invitation.level}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Expires
                </p>
                <p className="text-sm font-medium">
                  {new Date(
                    currentInvitation.invitation.expiresAt,
                  ).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Gateway
                </p>
                <p className="text-sm font-medium font-mono break-all">
                  {currentInvitation.invitation.gatewayAddress}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopyQR}
                className="flex-1"
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
                  className="mr-2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy QR
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="flex-1"
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
                  className="mr-2"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Copy Link
              </Button>
            </div>
          </Card>

          {/* Security Notice */}
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-xs text-amber-800">
              <strong>Security Notice:</strong> This invitation can only be used
              once. Anyone with this QR code or link can join your gateway with{" "}
              {currentInvitation.invitation.level} access.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
