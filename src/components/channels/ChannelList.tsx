/**
 * ChannelList - Display and manage configured channels (SPEC §9)
 *
 * Features:
 * - List all configured channels
 * - Toggle enabled/disabled state
 * - Edit channel credentials
 * - Delete channels
 * - Add new channels via wizards
 * - Permission checks (Phase 4 integration)
 */

import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { useChannelStore } from '@/stores/channelStore';
import type { ChannelName, ChannelConfig } from '@/types/channels';
import type { AccessLevel } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Hash,
  MessageCircle,
  Slack as SlackIcon,
  Phone,
  Plus,
  Trash2,
  Edit,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { fetchChannelStatus, inferGatewayKind, resolveToken, webLoginStart, webLoginWait, type ChannelAccountStatus, type ChannelStatusResult } from '@/lib/gateway-context';
import { readConfig } from '@/lib/config';
import { MatrixRoomManager } from './MatrixRoomManager';
import { ChannelConfigEditor } from './ChannelConfigEditor';

// Lazy load platform wizards for better performance
const TelegramWizard = lazy(() => import('./TelegramWizard').then(m => ({ default: m.TelegramWizard })));
const MatrixWizard = lazy(() => import('./MatrixWizard').then(m => ({ default: m.MatrixWizard })));
const DiscordWizard = lazy(() => import('./DiscordWizard').then(m => ({ default: m.DiscordWizard })));
const SlackWizard = lazy(() => import('./SlackWizard').then(m => ({ default: m.SlackWizard })));
const WhatsAppWizard = lazy(() => import('./WhatsAppWizard').then(m => ({ default: m.WhatsAppWizard })));
const SignalWizard = lazy(() => import('./SignalWizard').then(m => ({ default: m.SignalWizard })));

const CHANNEL_ICONS: Record<ChannelName, React.ReactNode> = {
  whatsapp: <MessageSquare className="w-5 h-5 text-green-500" />,
  telegram: <Send className="w-5 h-5 text-blue-500" />,
  matrix: <Hash className="w-5 h-5 text-gray-600" />,
  discord: <MessageCircle className="w-5 h-5 text-indigo-500" />,
  slack: <SlackIcon className="w-5 h-5 text-purple-500" />,
  signal: <Phone className="w-5 h-5 text-blue-400" />,
};

const CHANNEL_NAMES: Record<ChannelName, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  matrix: 'Matrix',
  discord: 'Discord',
  slack: 'Slack',
  signal: 'Signal',
};


function getPrimaryAccountStatus(
  liveStatus: ChannelStatusResult | null,
  channelName: string,
): ChannelAccountStatus | undefined {
  const channelStatus = liveStatus?.channels?.[channelName];
  if (!channelStatus) return undefined;

  const accounts = Array.isArray(channelStatus.accounts) ? channelStatus.accounts : [];
  if (accounts.length === 0) return undefined;

  if (channelStatus.defaultAccountId) {
    return accounts.find((account) => account.accountId === channelStatus.defaultAccountId)
      ?? accounts[0];
  }

  return accounts[0];
}

export interface ChannelListProps {
  /** Current user's access level (Phase 4 integration) */
  currentUserLevel?: AccessLevel;
  /** Current app mode — determines data source for channels */
  mode?: 'gateway' | 'client';
}

export function ChannelList({ currentUserLevel = 'owner', mode = 'gateway' }: ChannelListProps) {
  // Use store exclusively for state + CRUD + polling
  const {
    channels,
    isLoading: loading,
    error,
    wizard,
    openWizard,
    closeWizard,
    startPolling,
    stopPolling,
    setCurrentUserLevel,
    setMode,
    toggleChannel,
    deleteChannel,
    loadChannels,
  } = useChannelStore();

  const [deleteConfirm, setDeleteConfirm] = useState<ChannelName | null>(null);
  const [toggleLoading, setToggleLoading] = useState<ChannelName | null>(null);
  const [liveStatus, setLiveStatus] = useState<ChannelStatusResult | null>(null);
  const [liveStatusError, setLiveStatusError] = useState<string | null>(null);
  const [liveStatusUpdatedAt, setLiveStatusUpdatedAt] = useState<Date | null>(null);
  const [gatewayLabel, setGatewayLabel] = useState<string>('localhost:18789');
  const [refreshing, setRefreshing] = useState(false);
  const [qrState, setQrState] = useState<Record<string, { qrDataUrl?: string; message?: string; loading?: boolean; waiting?: boolean; error?: string }>>({});

  const buildGatewayTarget = useCallback(async () => {
    const desktopConfig = await readConfig();
    const gwUrl = desktopConfig?.gatewayUrl || 'http://localhost:18789';
    const token = desktopConfig?.gatewayToken || await resolveToken();

    try {
      const url = new URL(gwUrl);
      setGatewayLabel(`${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`);
    } catch {
      setGatewayLabel(gwUrl.replace(/^https?:\/\//, ''));
    }

    return {
      url: gwUrl,
      token: token || undefined,
      kind: inferGatewayKind(gwUrl),
    };
  }, []);

  // Fetch live channel status from gateway
  const fetchLiveStatus = useCallback(async () => {
    try {
      const target = await buildGatewayTarget();
      const status = await fetchChannelStatus(target);
      setLiveStatus(status);
      setLiveStatusError(null);
      setLiveStatusUpdatedAt(new Date());
      return status;
    } catch (err) {
      setLiveStatus(null);
      setLiveStatusError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [buildGatewayTarget]);

  // Fetch live status on mount and every 30s
  useEffect(() => {
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchLiveStatus]);

  // Set app mode in store (determines channel data source)
  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadChannels(), fetchLiveStatus()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLiveStatus, loadChannels]);

  // Set user level in store (Phase 4 integration)
  useEffect(() => {
    setCurrentUserLevel(currentUserLevel);
  }, [currentUserLevel, setCurrentUserLevel]);

  // Start 30-second polling on mount, stop on unmount
  useEffect(() => {
    startPolling();
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  // Permission check
  const hasManagePermission = currentUserLevel === 'owner' || currentUserLevel === 'member';

  const handleToggle = async (channel: ChannelName, enabled: boolean) => {
    if (!hasManagePermission) return;

    setToggleLoading(channel);
    try {
      await toggleChannel(channel, enabled);
    } catch (err) {
      console.error('Failed to toggle channel:', err);
    } finally {
      setToggleLoading(null);
    }
  };

  const handleDelete = async (channel: ChannelName) => {
    if (!hasManagePermission) return;

    try {
      await deleteChannel(channel);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete channel:', err);
    }
  };

  const [editingChannel, setEditingChannel] = useState<ChannelName | null>(null);

  const handleAddChannel = (channel: ChannelName) => {
    if (!hasManagePermission) return;
    openWizard(channel);
  };

  const handleEditChannel = (channel: ChannelName) => {
    if (!hasManagePermission) return;
    setEditingChannel(channel);
  };

  const [verifying, setVerifying] = useState<{ channel: string; status: 'waiting' | 'connected' | 'failed' } | null>(null);

  const availableChannels = (['telegram', 'matrix', 'discord', 'slack', 'whatsapp', 'signal'] as ChannelName[])
    .filter((name) => !channels.find((c) => c.channel === name));


  const handleWizardComplete = async () => {
    const completedChannel = wizard.channel;
    closeWizard();

    if (!completedChannel) return;

    // Wait for gateway restart and channel connection
    setVerifying({ channel: completedChannel, status: 'waiting' });

    // Poll channels.status for up to 15 seconds
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 3000));
      const status = await fetchLiveStatus();

      const defaultAccount = getPrimaryAccountStatus(status, completedChannel);
      if (defaultAccount?.connected) {
        setVerifying({ channel: completedChannel, status: 'connected' });
        setTimeout(() => setVerifying(null), 5000);
        return;
      }
    }

    // Didn't connect within timeout
    setVerifying({ channel: completedChannel, status: 'failed' });
    setTimeout(() => setVerifying(null), 8000);
  };

  const handleQrStart = async (channel: ChannelName, force = false) => {
    setQrState((prev) => ({ ...prev, [channel]: { loading: true } }));
    try {
      const target = await buildGatewayTarget();
      const result = await webLoginStart(target, { force, timeoutMs: 30000 });
      setQrState((prev) => ({
        ...prev,
        [channel]: {
          qrDataUrl: result.qrDataUrl,
          message: result.message,
          loading: false,
        },
      }));
    } catch (err) {
      setQrState((prev) => ({
        ...prev,
        [channel]: {
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  };

  const handleQrWait = async (channel: ChannelName) => {
    setQrState((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        waiting: true,
      },
    }));
    try {
      const target = await buildGatewayTarget();
      const result = await webLoginWait(target, { timeoutMs: 120000 });
      setQrState((prev) => ({
        ...prev,
        [channel]: {
          ...prev[channel],
          message: result.message,
          waiting: false,
        },
      }));
      if (result.connected) {
        await fetchLiveStatus();
      }
    } catch (err) {
      setQrState((prev) => ({
        ...prev,
        [channel]: {
          ...prev[channel],
          waiting: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  };

  // Render channel config editor
  if (editingChannel) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <ChannelConfigEditor
          channel={editingChannel}
          onClose={() => setEditingChannel(null)}
        />
        {editingChannel === 'matrix' && (
          <>
            <div className="border-t pt-4" />
            <MatrixRoomManager />
          </>
        )}
      </div>
    );
  }

  // Render wizard if open (lazy loaded with Suspense for performance)
  if (wizard.isOpen && wizard.channel) {
    const WizardComponent = {
      telegram: TelegramWizard,
      matrix: MatrixWizard,
      discord: DiscordWizard,
      slack: SlackWizard,
      whatsapp: WhatsAppWizard,
      signal: SignalWizard,
    }[wizard.channel];

    return (
      <div className="p-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          }
        >
          <WizardComponent onComplete={handleWizardComplete} onCancel={closeWizard} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Channel Integrations</h1>
          <p className="text-muted-foreground">
            Connect EdwinPAI to your messaging platforms to enable AI-powered conversations across channels.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-mono">gateway {gatewayLabel}</Badge>
            {liveStatusUpdatedAt && (
              <span>live status refreshed {liveStatusUpdatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            )}
            {liveStatusError && (
              <span className="text-amber-600 dark:text-amber-400">live status unavailable</span>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Permission alert for guests */}
      {!hasManagePermission && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have read-only access to channel integrations. Contact the gateway owner to manage channels.
          </AlertDescription>
        </Alert>
      )}

      {/* Channel verification status */}
      {verifying && (
        <Alert className={`mb-6 ${
          verifying.status === 'connected' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
          verifying.status === 'failed' ? 'border-destructive' : ''
        }`}>
          {verifying.status === 'waiting' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Verifying {CHANNEL_NAMES[verifying.channel as ChannelName] || verifying.channel} connection... Gateway is restarting with new config.
              </AlertDescription>
            </>
          )}
          {verifying.status === 'connected' && (
            <>
              <Wifi className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4 inline text-green-500 mr-1" />{CHANNEL_NAMES[verifying.channel as ChannelName] || verifying.channel} connected successfully!
              </AlertDescription>
            </>
          )}
          {verifying.status === 'failed' && (
            <>
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                <AlertTriangle className="h-4 w-4 inline text-amber-500 mr-1" /> {CHANNEL_NAMES[verifying.channel as ChannelName] || verifying.channel} hasn't connected yet. Check credentials and gateway logs.
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {liveStatusError && (
        <Alert className="mb-6 border-amber-500/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Live channel connection status is temporarily unavailable. You can still edit configuration, but connected/offline badges may be stale.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {loading && channels.length === 0 && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading channels...</p>
        </div>
      )}

      {/* Configured channels */}
      {channels.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Configured Channels</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.channel}
                channel={channel}
                onToggle={(enabled) => handleToggle(channel.channel as ChannelName, enabled)}
                onDelete={() => setDeleteConfirm(channel.channel as ChannelName)}
                onEdit={() => handleEditChannel(channel.channel as ChannelName)}
                deleteConfirm={deleteConfirm === channel.channel}
                onCancelDelete={() => setDeleteConfirm(null)}
                onConfirmDelete={() => handleDelete(channel.channel as ChannelName)}
                isToggling={toggleLoading === channel.channel}
                canManage={hasManagePermission}
                accountStatus={getPrimaryAccountStatus(liveStatus, channel.channel)}
                qrState={qrState[channel.channel]}
                onQrStart={(force) => handleQrStart(channel.channel as ChannelName, force)}
                onQrWait={() => handleQrWait(channel.channel as ChannelName)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available channels to add */}
      <div>
        <h2 className="text-xl font-semibold mb-2">{channels.length > 0 ? 'Add New Channel' : 'Get Started'}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {channels.length > 0
            ? 'Connect another messaging platform.'
            : 'Choose a platform to connect first. You can edit details later without re-running the setup wizard.'}
        </p>
        {availableChannels.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableChannels.map((name) => (
              <Card key={name} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {CHANNEL_ICONS[name]}
                      <CardTitle className="text-lg">{CHANNEL_NAMES[name]}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleAddChannel(name)}
                    disabled={!hasManagePermission}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Configure
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-sm text-muted-foreground">
              All supported channels are already configured.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Channel Card Component
interface ChannelCardProps {
  channel: ChannelConfig;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
  deleteConfirm: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  isToggling: boolean;
  canManage: boolean;
  accountStatus?: ChannelAccountStatus;
  qrState?: { qrDataUrl?: string; message?: string; loading?: boolean; waiting?: boolean; error?: string };
  onQrStart?: (force: boolean) => void;
  onQrWait?: () => void;
}

function ChannelCard({
  channel,
  onToggle,
  onDelete,
  onEdit,
  deleteConfirm,
  onCancelDelete,
  onConfirmDelete,
  isToggling,
  canManage,
  accountStatus,
  qrState,
  onQrStart,
  onQrWait,
}: ChannelCardProps) {
  const channelName = channel.channel as ChannelName;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {CHANNEL_ICONS[channelName]}
            <div>
              <CardTitle className="text-lg">{CHANNEL_NAMES[channelName]}</CardTitle>
              <CardDescription className="text-xs">
                {new Date(channel.configuredAt).toLocaleDateString()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {accountStatus?.connected && (
              <Badge variant="default" className="bg-green-600 text-white gap-1">
                <Wifi className="h-3 w-3" /> Connected
              </Badge>
            )}
            {accountStatus && !accountStatus.connected && accountStatus.running && (
              <Badge variant="default" className="bg-yellow-600 text-white gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Connecting
              </Badge>
            )}
            {accountStatus && !accountStatus.connected && !accountStatus.running && channel.enabled && (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
            {!accountStatus && (
              <Badge variant={channel.enabled ? 'default' : 'secondary'}>
                {channel.enabled ? 'Active' : 'Disabled'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Settings display */}
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Auto-reply:</span>
              <span>{channel.settings.autoReply ? 'On' : 'Off'}</span>
            </div>
            <div className="flex justify-between">
              <span>Allowed chats:</span>
              <span>
                {channel.settings.allowedChatIds.length === 0
                  ? 'All'
                  : `${channel.settings.allowedChatIds.length} chat(s)`}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Enable:</span>
              <Switch
                checked={channel.enabled}
                onCheckedChange={onToggle}
                disabled={!canManage || isToggling}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                disabled={!canManage}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={!canManage}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {channelName === 'whatsapp' && onQrStart && onQrWait && (
            <div className="pt-2 border-t space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQrStart(false)}
                  disabled={!canManage || qrState?.loading}
                >
                  {qrState?.loading ? 'Loading...' : 'Get QR'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQrWait()}
                  disabled={!canManage || qrState?.waiting}
                >
                  {qrState?.waiting ? 'Checking...' : 'Check login'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onQrStart(true)}
                  disabled={!canManage || qrState?.loading}
                >
                  Refresh QR
                </Button>
              </div>
              {qrState?.message && (
                <div className="text-xs text-muted-foreground">{qrState.message}</div>
              )}
              {qrState?.error && (
                <div className="text-xs text-destructive">{qrState.error}</div>
              )}
              {qrState?.qrDataUrl && (
                <div className="flex justify-center">
                  <img
                    src={qrState.qrDataUrl}
                    alt="WhatsApp QR"
                    className="h-40 w-40 border rounded-md"
                  />
                </div>
              )}
            </div>
          )}

          {/* Delete confirmation */}
          {deleteConfirm && (
            <Alert variant="destructive">
              <AlertDescription className="space-y-2">
                <p className="text-sm">Delete this channel? This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onConfirmDelete}
                  >
                    Delete
                  </Button>
                  <Button variant="outline" size="sm" onClick={onCancelDelete}>
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
