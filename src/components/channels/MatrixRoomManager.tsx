/**
 * MatrixRoomManager - Add/remove/configure Matrix rooms without rerunning the wizard
 *
 * Reads rooms from gateway config and patches via config.patch.
 */

import { useState, useEffect, useCallback } from 'react';
import { Hash, Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  fetchGatewayConfig,
  patchGatewayConfig,
  resolveToken,
  inferGatewayKind,
  type GatewayTarget,
} from '@/lib/gateway-context';
import { readConfig, updateConfig } from '@/lib/config';

interface RoomConfig {
  allow?: boolean;
  enabled?: boolean;
  autoReply?: boolean;
  requireMention?: boolean;
}

interface RoomEntry {
  roomId: string;
  config: RoomConfig;
}

interface MatrixRoomManagerProps {
  onClose?: () => void;
}

export function MatrixRoomManager({ onClose }: MatrixRoomManagerProps) {
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [newRoomId, setNewRoomId] = useState('');
  const [newAutoReply, setNewAutoReply] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const buildTarget = useCallback(async (): Promise<GatewayTarget> => {
    const config = await readConfig().catch(() => null);
    let url = config?.gatewayUrl || 'http://localhost:18789';
    const token = config?.gatewayToken || (await resolveToken());

    // Auto-migrate 127.0.0.1 → localhost (gateway treats localhost as trusted control-plane host)
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === '::1' || urlObj.hostname === '0.0.0.0' || urlObj.hostname.startsWith('127.')) {
        urlObj.hostname = 'localhost';
        const migrated = urlObj.toString();
        url = migrated;
        updateConfig({ gatewayUrl: migrated }).catch(() => {
          // best-effort
        });
      }
    } catch {
      // ignore
    }

    return { url, token: token || undefined, kind: inferGatewayKind(url) };
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const target = await buildTarget();
      const gwConfig = await fetchGatewayConfig(target);
      const channels = (gwConfig as Record<string, unknown>).channels as Record<string, unknown> | undefined;
      const matrix = channels?.matrix as Record<string, unknown> | undefined;
      const groups = (matrix?.groups || {}) as Record<string, RoomConfig>;

      const entries: RoomEntry[] = Object.entries(groups).map(([roomId, config]) => ({
        roomId,
        config,
      }));

      setRooms(entries);
      setStatus(null);
    } catch (err) {
      setStatus({ type: 'error', message: `Failed to load rooms: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  }, [buildTarget]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleAddRoom = async () => {
    const roomId = newRoomId.trim();
    if (!roomId) return;

    // Basic validation — room IDs start with !
    if (!roomId.startsWith('!') && !roomId.startsWith('#')) {
      setStatus({ type: 'error', message: 'Room ID must start with ! (e.g., !abc:server.org) or # for aliases' });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const target = await buildTarget();
      const patch = {
        channels: {
          matrix: {
            groups: {
              [roomId]: {
                allow: true,
                autoReply: newAutoReply,
              },
            },
          },
        },
      };

      await patchGatewayConfig(target, patch);
      setNewRoomId('');
      setStatus({ type: 'success', message: `Room ${roomId} added. Gateway reloading.` });
      // Reload after brief delay for gateway restart
      setTimeout(() => loadRooms(), 2000);
    } catch (err) {
      setStatus({ type: 'error', message: `Failed to add room: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoReply = async (roomId: string, autoReply: boolean) => {
    setSaving(true);
    setStatus(null);

    try {
      const target = await buildTarget();
      const patch = {
        channels: {
          matrix: {
            groups: {
              [roomId]: { autoReply },
            },
          },
        },
      };

      await patchGatewayConfig(target, patch);
      setStatus({ type: 'success', message: `Updated ${roomId}` });
      setTimeout(() => loadRooms(), 2000);
    } catch (err) {
      setStatus({ type: 'error', message: `Failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRoom = async (roomId: string) => {
    setSaving(true);
    setStatus(null);

    try {
      const target = await buildTarget();
      // Set allow: false to disable (config.patch can't delete keys, but we can disable)
      const patch = {
        channels: {
          matrix: {
            groups: {
              [roomId]: { allow: false, enabled: false },
            },
          },
        },
      };

      await patchGatewayConfig(target, patch);
      setStatus({ type: 'success', message: `Room ${roomId} disabled.` });
      setTimeout(() => loadRooms(), 2000);
    } catch (err) {
      setStatus({ type: 'error', message: `Failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Matrix Rooms</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadRooms} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
          status.type === 'success' ? 'text-green-600 bg-green-500/10' : 'text-destructive bg-destructive/10'
        }`}>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.message}
        </div>
      )}

      {/* Configured rooms */}
      {rooms.length > 0 && (
        <div className="space-y-2">
          <Label>Configured Rooms</Label>
          {rooms.map((room) => (
            <div key={room.roomId} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-mono truncate">{room.roomId}</span>
                {room.config.allow === false ? (
                  <Badge variant="secondary">Disabled</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Auto-reply</span>
                  <Switch
                    checked={room.config.autoReply ?? false}
                    onCheckedChange={(checked) => handleToggleAutoReply(room.roomId, checked)}
                    disabled={saving}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleRemoveRoom(room.roomId)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rooms.length === 0 && !loading && (
        <div className="p-4 rounded-md border border-dashed text-center text-sm text-muted-foreground">
          No rooms configured. Add a room ID to get started.
        </div>
      )}

      {/* Add room */}
      <div className="space-y-3 pt-2 border-t">
        <Label>Add Room</Label>
        <div className="flex gap-2">
          <Input
            placeholder="!roomid:server.org"
            value={newRoomId}
            onChange={(e) => setNewRoomId(e.target.value)}
            className="flex-1 font-mono text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
          />
          <Button onClick={handleAddRoom} disabled={saving || !newRoomId.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            {saving ? 'Adding...' : 'Add'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={newAutoReply} onCheckedChange={setNewAutoReply} />
          <span className="text-xs text-muted-foreground">Auto-reply in this room (respond without @mention)</span>
        </div>
      </div>
    </div>
  );
}
