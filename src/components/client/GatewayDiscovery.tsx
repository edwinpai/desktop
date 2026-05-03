/**
 * GatewayDiscovery - LAN scan table for discovering EdwinPAI gateways
 *
 * Features:
 * - Auto-refreshing mDNS scan (5s polling)
 * - Table view with online/offline status
 * - Manual URL/QR entry fallback
 * - Connect button with BRC-103 auth
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useDiscovery } from "@/hooks/useDiscovery";
import { useClientConnection } from "@/hooks/useClientConnection";
import type { DiscoveredPeer } from "@/types/api";

interface GatewayDiscoveryProps {
  /** Callback when gateway connection succeeds */
  onConnectionSuccess?: (peer: DiscoveredPeer) => void;
  /** Auto-start scan on mount */
  autoStartScan?: boolean;
}

export function GatewayDiscovery({
  onConnectionSuccess,
  autoStartScan = true,
}: GatewayDiscoveryProps) {
  const { peers, isScanning, error, startScan, stopScan } = useDiscovery();
  const {
    connect,
    connectionStatus,
    error: connectionError,
  } = useClientConnection();
  const isConnecting = connectionStatus === "connecting";
  const [selectedPeer, setSelectedPeer] = useState<DiscoveredPeer | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);

  // Auto-start scan on mount
  useEffect(() => {
    if (autoStartScan) {
      startScan();
    }
    return () => {
      stopScan();
    };
  }, [autoStartScan, startScan, stopScan]);

  const handleConnect = async (peer: DiscoveredPeer) => {
    setSelectedPeer(peer);
    const success = await connect({
      gatewayAddress: peer.address,
      gatewayPubkey: peer.pubkey,
    });

    if (success && onConnectionSuccess) {
      onConnectionSuccess(peer);
    }
  };

  const handleManualConnect = async () => {
    if (!manualUrl.trim()) return;

    try {
      // Parse manual URL (e.g., "http://192.168.1.100:18789" or "gateway.local:18789")
      const url = new URL(
        manualUrl.startsWith("http") ? manualUrl : `http://${manualUrl}`,
      );
      const address = `${url.hostname}:${url.port || 18789}`;

      // Fetch identity to get pubkey and petname
      const response = await fetch(`${url.origin}/v1/identity`);
      if (!response.ok) throw new Error("Failed to fetch gateway identity");

      const identity = await response.json();

      const success = await connect({
        gatewayAddress: address,
        gatewayPubkey: identity.publicKey,
      });

      if (success) {
        setShowManualDialog(false);
        setManualUrl("");
        if (onConnectionSuccess) {
          onConnectionSuccess({
            pubkey: identity.publicKey,
            petname: identity.petname,
            address,
            isOnline: true,
            lastSeen: new Date().toISOString(),
            authorizationLevel: "guest", // Will be updated after auth
          });
        }
      }
    } catch (err) {
      console.error("Manual connect failed:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with scan controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Discover Gateway</h3>
          <p className="text-sm text-muted-foreground">
            Scanning local network for EdwinPAI gateways
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManualDialog(true)}
          >
            Manual Entry
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQrDialog(true)}
          >
            Scan QR Code
          </Button>
          {isScanning ? (
            <Button variant="outline" size="sm" onClick={stopScan}>
              Stop Scan
            </Button>
          ) : (
            <Button size="sm" onClick={startScan}>
              Start Scan
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {(error || connectionError) && (
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
                {error || connectionError}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Discovered peers table */}
      {peers.length === 0 && !isScanning ? (
        <Card className="p-12">
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto text-muted-foreground/50 mb-4"
            >
              <circle cx="12" cy="12" r="2" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
            </svg>
            <h4 className="text-lg font-medium mb-2">No Gateways Found</h4>
            <p className="text-sm text-muted-foreground mb-4">
              No EdwinPAI gateways discovered on your local network.
            </p>
            <div className="flex justify-center gap-2">
              <Button size="sm" onClick={startScan}>
                Scan Again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualDialog(true)}
              >
                Enter Manually
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Petname
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Public Key
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {peers.map((peer) => {
                  const isSelected = selectedPeer?.pubkey === peer.pubkey;
                  const isStale =
                    Date.now() - new Date(peer.lastSeen).getTime() > 30000;

                  return (
                    <tr
                      key={peer.pubkey}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {peer.isOnline && !isStale ? (
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-700 border-green-200"
                          >
                            Online
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            Offline
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{peer.petname}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm">{peer.address}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-muted-foreground">
                          {peer.pubkey.slice(0, 12)}...{peer.pubkey.slice(-8)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-muted-foreground">
                          {formatLastSeen(peer.lastSeen)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleConnect(peer)}
                          disabled={isConnecting && isSelected}
                        >
                          {isConnecting && isSelected ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                              Connecting...
                            </>
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Auto-refresh indicator */}
          {isScanning && (
            <div className="px-4 py-3 border-t bg-muted/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                <span>Auto-refreshing every 5 seconds...</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Manual URL entry dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Connect to Gateway Manually
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gateway-url">Gateway URL or IP Address</Label>
              <Input
                id="gateway-url"
                type="text"
                placeholder="http://192.168.1.100:18789 or gateway.local:18789"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter the full URL or IP address with port number
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowManualDialog(false);
                  setManualUrl("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualConnect}
                disabled={!manualUrl.trim() || isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* QR code scanner dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Scan Gateway QR Code</h3>
          <div className="bg-muted/50 border-2 border-dashed rounded-lg p-12">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto text-muted-foreground/50 mb-4"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <p className="text-sm text-muted-foreground">
                QR code scanner will be implemented in future release
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setShowQrDialog(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function formatLastSeen(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 10) return "just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleTimeString();
}
