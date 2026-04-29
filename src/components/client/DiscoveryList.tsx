/**
 * Discovery List - Displays discovered peers with petname, pubkey, and signal strength
 */

import { Button } from '@/components/ui/button';
import type { DiscoveredPeer } from '@/types/api';

interface DiscoveryListProps {
  peers: DiscoveredPeer[];
  onSelect: (peer: DiscoveredPeer) => void;
  isScanning?: boolean;
}

export function DiscoveryList({ peers, onSelect, isScanning }: DiscoveryListProps) {
  if (isScanning && peers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-sm text-muted-foreground">Scanning for gateways...</p>
      </div>
    );
  }

  if (!isScanning && peers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground/50 mb-4"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm text-muted-foreground">No gateways found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Make sure a gateway is running on your network
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {peers.map((peer) => (
        <button
          key={peer.pubkey}
          onClick={() => onSelect(peer)}
          className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium truncate">{peer.petname}</p>
                <SignalStrength isOnline={peer.isOnline} lastSeen={peer.lastSeen} />
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {peer.pubkey.slice(0, 16)}...{peer.pubkey.slice(-8)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {peer.address}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0">
              Select
            </Button>
          </div>
        </button>
      ))}
    </div>
  );
}

interface SignalStrengthProps {
  isOnline: boolean;
  lastSeen: string;
}

function SignalStrength({ isOnline, lastSeen }: SignalStrengthProps) {
  const getTimeSince = () => {
    const now = new Date();
    const seen = new Date(lastSeen);
    const diffMs = now.getTime() - seen.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    return `${Math.floor(diffSecs / 3600)}h ago`;
  };

  return (
    <div className="flex items-center gap-1">
      <div
        className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-muted-foreground/30'
        }`}
      />
      <span className="text-xs text-muted-foreground">
        {isOnline ? 'Online' : getTimeSince()}
      </span>
    </div>
  );
}
