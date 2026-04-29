/**
 * GatewayConnect - Client mode gateway discovery and connection
 *
 * Scans the local network for EdwinPAI gateways, allows manual URL entry,
 * handles auth token, and saves the selected gateway to desktop config.
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Search,
  Wifi,
  WifiOff,
  RefreshCw,
  Server,
  CheckCircle,
  AlertCircle,
  Globe,
  Lock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { readConfig, updateConfig } from '@/lib/config';

interface DiscoveredGateway {
  url: string;
  port: number;
  version?: string;
  requires_auth: boolean;
}

interface ConnectionTest {
  status: 'idle' | 'testing' | 'connected' | 'failed';
  message?: string;
  version?: string;
}

interface GatewayConnectProps {
  /** Called after gateway saved — triggers WS reconnect + navigate to Chat */
  onConnected?: () => void;
}

export function GatewayConnect({ onConnected }: GatewayConnectProps = {}) {
  const [scanning, setScanning] = useState(false);
  const [gateways, setGateways] = useState<DiscoveredGateway[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  // Manual entry always visible (no toggle needed)
  const [connectionTest, setConnectionTest] = useState<ConnectionTest>({ status: 'idle' });
  const [saved, setSaved] = useState(false);

  const scanNetwork = useCallback(async () => {
    setScanning(true);
    try {
      const results = await invoke<DiscoveredGateway[]>('scan_gateways');
      setGateways(results);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  }, []);

  // Load saved config and scan on mount
  useEffect(() => {
    (async () => {
      const config = await readConfig().catch(() => null);
      if (config?.gatewayUrl) {
        setSelectedUrl(config.gatewayUrl);
      }
      if (config?.gatewayToken) {
        setAuthToken(config.gatewayToken);
      }
    })();
    scanNetwork();
  }, [scanNetwork]);

  const handleSelectGateway = (gw: DiscoveredGateway) => {
    setSelectedUrl(gw.url);
    setConnectionTest({ status: 'idle' });
    setSaved(false);
  };

  const handleManualSubmit = () => {
    const url = manualUrl.trim();
    if (!url) return;
    // Normalize URL
    const normalized = url.startsWith('http') ? url : `http://${url}`;
    setSelectedUrl(normalized);
    setConnectionTest({ status: 'idle' });
    setSaved(false);
  };

  const handleTestConnection = async () => {
    if (!selectedUrl) return;
    setConnectionTest({ status: 'testing' });

    try {
      const result = await invoke<{ found: boolean; url?: string; error?: string }>(
        'probe_gateway',
        { url: selectedUrl }
      );

      if (result.found) {
        setConnectionTest({
          status: 'connected',
          message: `Gateway reachable at ${result.url || selectedUrl}`,
        });
      } else {
        setConnectionTest({
          status: 'failed',
          message: 'Gateway not reachable. Check URL and ensure the gateway is running.',
        });
      }
    } catch (err) {
      setConnectionTest({
        status: 'failed',
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleSave = async () => {
    try {
      await updateConfig({
        gatewayUrl: selectedUrl,
        ...(authToken ? { gatewayToken: authToken } : {}),
      });
      setSaved(true);
      // Trigger WS reconnect with new config + navigate to Chat
      if (onConnected) {
        setTimeout(() => onConnected(), 500);
      }
    } catch (err) {
      console.error('Failed to save gateway config:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Network Scan */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Discover Gateways</h3>
          </div>
          <Button variant="outline" size="sm" onClick={scanNetwork} disabled={scanning}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Rescan'}
          </Button>
        </div>

        {scanning && gateways.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Scanning local network for EdwinPAI gateways...
          </div>
        )}

        {!scanning && gateways.length === 0 && (
          <div className="text-center py-6">
            <WifiOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">No gateways found on the local network.</p>
            <p className="text-xs text-muted-foreground">Enter a gateway URL manually below.</p>
          </div>
        )}

        {gateways.length > 0 && (
          <div className="space-y-2">
            {gateways.map((gw) => (
              <button
                key={gw.url}
                onClick={() => handleSelectGateway(gw)}
                className={`w-full flex items-center justify-between p-3 rounded-md border text-left transition-colors ${
                  selectedUrl === gw.url
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="text-sm font-medium font-mono">{gw.url}</span>
                    {gw.version && (
                      <span className="text-xs text-muted-foreground ml-2">v{gw.version}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {gw.requires_auth && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Lock className="h-3 w-3" /> Auth
                    </Badge>
                  )}
                  <Wifi className="h-4 w-4 text-green-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Manual Entry */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Manual Connection</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Gateway URL</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                value={manualUrl || selectedUrl}
                onChange={(e) => {
                  setManualUrl(e.target.value);
                  setSaved(false);
                }}
                placeholder="http://192.168.1.100:18789"
                className="flex-1 font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              />
              {manualUrl && (
                <Button variant="outline" onClick={handleManualSubmit}>
                  Set
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label>Auth Token <span className="text-muted-foreground font-normal">(if required)</span></Label>
            <Input
              type="password"
              value={authToken}
              onChange={(e) => {
                setAuthToken(e.target.value);
                setSaved(false);
              }}
              placeholder="Gateway auth token"
              className="mt-1.5 font-mono text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Connection Test & Save */}
      {selectedUrl && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wifi className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Connection</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted">
              <span className="text-sm text-muted-foreground">Target</span>
              <span className="font-mono text-sm">{selectedUrl}</span>
            </div>

            {connectionTest.status === 'connected' && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                {connectionTest.message}
              </div>
            )}

            {connectionTest.status === 'failed' && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {connectionTest.message}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={connectionTest.status === 'testing'}
                className="flex-1"
              >
                {connectionTest.status === 'testing' ? (
                  <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> Testing...</>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saved}
                className="flex-1"
              >
                {saved ? (
                  <><CheckCircle className="h-4 w-4 mr-1.5" /> Saved</>
                ) : (
                  'Save & Connect'
                )}
              </Button>
            </div>

            {saved && (
              <p className="text-xs text-muted-foreground text-center">
                Gateway saved. Navigate to Chat to start using EdwinPAI.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
