/**
 * IdentityCard component (Phase 1)
 *
 * Displays user's BSV identity with petname and crypto-domain-generated identicon.
 * Uses the useIdentity hook to fetch identity from the Crypto Domain.
 */

import { useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIdentity } from "@/hooks/useIdentity";
import { useIdentityStore } from "@/stores/identityStore";

interface IdentityCardProps {
  className?: string;
  showTitle?: boolean;
}

export function IdentityCard({ className, showTitle = true }: IdentityCardProps) {
  const { identity: cryptoIdentity, loading, error } = useIdentity();
  const { identity: storedIdentity, setIdentity } = useIdentityStore();

  // Sync crypto domain identity to store
  useEffect(() => {
    if (cryptoIdentity) {
      setIdentity(cryptoIdentity);
    }
  }, [cryptoIdentity, setIdentity]);

  const identity = cryptoIdentity || storedIdentity;

  if (loading) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle>Your Identity</CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading identity...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle>Your Identity</CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-sm text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!identity) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle>Your Identity</CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">No identity found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle>Your Identity</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex items-center gap-4 py-6">
        {/* Identicon from Crypto Domain */}
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden"
          dangerouslySetInnerHTML={{ __html: identity.avatarSvg }}
        />

        {/* Identity Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{identity.petname}</h3>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {identity.shortId}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
