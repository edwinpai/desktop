/**
 * ChannelConfigEditor - Generic in-place config editor for any channel
 *
 * Reads the channel's config from the gateway and lets you edit
 * common settings without rerunning the setup wizard.
 * Fields are organized into logical sections:
 *   Credentials → Access Control → Messaging → Actions → Advanced
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings2, RefreshCw, Save, CheckCircle, AlertCircle,
  ChevronDown, ChevronRight, Shield, MessageSquare, Zap, Wrench, Key,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  fetchGatewayConfig,
  patchGatewayConfig,
  resolveToken,
  inferGatewayKind,
  type GatewayTarget,
} from '@/lib/gateway-context';
import { readConfig, updateConfig } from '@/lib/config';
import type { ChannelName } from '@/types/channels';

interface ChannelConfigEditorProps {
  channel: ChannelName;
  onClose?: () => void;
}

// Common config type
interface CommonConfig {
  [key: string]: unknown;
}

// ── Field definition ─────────────────────────────────────────────────
type FieldType = 'text' | 'switch' | 'select' | 'number';
type SectionId = 'credentials' | 'access' | 'messaging' | 'actions' | 'advanced';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  section: SectionId;
  help?: string;  // optional tooltip / description
}

// ── Section metadata ─────────────────────────────────────────────────
const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode; defaultOpen: boolean }[] = [
  { id: 'credentials', label: 'Credentials', icon: <Key className="h-4 w-4" />, defaultOpen: true },
  { id: 'access',      label: 'Access Control', icon: <Shield className="h-4 w-4" />, defaultOpen: true },
  { id: 'messaging',   label: 'Messaging', icon: <MessageSquare className="h-4 w-4" />, defaultOpen: true },
  { id: 'actions',     label: 'Actions', icon: <Zap className="h-4 w-4" />, defaultOpen: false },
  { id: 'advanced',    label: 'Advanced', icon: <Wrench className="h-4 w-4" />, defaultOpen: false },
];

// ── Per-channel field definitions ────────────────────────────────────
const CHANNEL_FIELDS: Record<string, FieldDef[]> = {
  telegram: [
    // Credentials
    { key: 'botToken', label: 'Bot Token', type: 'text', section: 'credentials' },
    { key: 'name', label: 'Channel Name', type: 'text', section: 'credentials' },
    { key: 'enabled', label: 'Enabled', type: 'switch', section: 'credentials' },
    // Access Control
    { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: ['pairing', 'allowlist', 'open', 'disabled'], section: 'access' },
    { key: 'groupPolicy', label: 'Group Policy', type: 'select', options: ['open', 'disabled', 'allowlist'], section: 'access' },
    { key: 'allowFrom', label: 'Allow From (comma-separated)', type: 'text', section: 'access' },
    { key: 'groupAllowFrom', label: 'Group Allow From (comma-separated)', type: 'text', section: 'access' },
    // Messaging
    { key: 'historyLimit', label: 'Group History Limit', type: 'number', section: 'messaging' },
    { key: 'dmHistoryLimit', label: 'DM History Limit', type: 'number', section: 'messaging' },
    { key: 'streamMode', label: 'Stream Mode', type: 'select', options: ['chunked', 'live'], section: 'messaging' },
    { key: 'replyToMode', label: 'Reply To Mode', type: 'select', options: ['always', 'never', 'smart'], section: 'messaging' },
    { key: 'textChunkLimit', label: 'Text Chunk Limit', type: 'number', section: 'messaging' },
    { key: 'mediaMaxMb', label: 'Media Max MB', type: 'number', section: 'messaging' },
    { key: 'reactionNotifications', label: 'Reaction Notifications', type: 'select', options: ['off', 'own', 'all'], section: 'messaging' },
    { key: 'reactionLevel', label: 'Reaction Level', type: 'select', options: ['off', 'ack', 'minimal', 'extensive'], section: 'messaging' },
    // Actions
    { key: 'actions.reactions', label: 'Reactions', type: 'switch', section: 'actions' },
    { key: 'actions.sendMessage', label: 'Send Message', type: 'switch', section: 'actions' },
    { key: 'actions.deleteMessage', label: 'Delete Message', type: 'switch', section: 'actions' },
    { key: 'actions.editMessage', label: 'Edit Message', type: 'switch', section: 'actions' },
    { key: 'actions.sticker', label: 'Stickers', type: 'switch', section: 'actions' },
    // Advanced
    { key: 'linkPreview', label: 'Link Preview', type: 'switch', section: 'advanced' },
    { key: 'chunkMode', label: 'Chunk Mode', type: 'select', options: ['sequential', 'parallel'], section: 'advanced' },
    { key: 'blockStreaming', label: 'Block Streaming', type: 'switch', section: 'advanced' },
  ],
  matrix: [
    // Credentials
    { key: 'homeserver', label: 'Homeserver URL', type: 'text', section: 'credentials' },
    { key: 'userId', label: 'User ID', type: 'text', section: 'credentials' },
    { key: 'name', label: 'Channel Name', type: 'text', section: 'credentials' },
    { key: 'enabled', label: 'Enabled', type: 'switch', section: 'credentials' },
    // Access Control
    { key: 'groupPolicy', label: 'Group Policy', type: 'select', options: ['open', 'disabled', 'allowlist'], section: 'access' },
    { key: 'autoJoin', label: 'Auto-Join Invites', type: 'select', options: ['always', 'allowlist', 'off'], section: 'access' },
    // Messaging
    { key: 'historyLimit', label: 'Group History Limit', type: 'number', section: 'messaging' },
    { key: 'dmHistoryLimit', label: 'DM History Limit', type: 'number', section: 'messaging' },
    { key: 'textChunkLimit', label: 'Text Chunk Limit', type: 'number', section: 'messaging' },
    { key: 'mediaMaxMb', label: 'Media Max MB', type: 'number', section: 'messaging' },
    // Advanced
    { key: 'chunkMode', label: 'Chunk Mode', type: 'select', options: ['sequential', 'parallel'], section: 'advanced' },
    { key: 'blockStreaming', label: 'Block Streaming', type: 'switch', section: 'advanced' },
  ],
  discord: [
    // Credentials
    { key: 'botToken', label: 'Bot Token', type: 'text', section: 'credentials' },
    { key: 'name', label: 'Channel Name', type: 'text', section: 'credentials' },
    { key: 'enabled', label: 'Enabled', type: 'switch', section: 'credentials' },
    // Access Control
    { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: ['pairing', 'allowlist', 'open', 'disabled'], section: 'access' },
    { key: 'groupPolicy', label: 'Group Policy', type: 'select', options: ['open', 'disabled', 'allowlist'], section: 'access' },
    { key: 'allowFrom', label: 'Allow From (comma-separated)', type: 'text', section: 'access' },
    { key: 'allowBots', label: 'Allow Bots', type: 'switch', section: 'access' },
    // Messaging
    { key: 'historyLimit', label: 'Group History Limit', type: 'number', section: 'messaging' },
    { key: 'dmHistoryLimit', label: 'DM History Limit', type: 'number', section: 'messaging' },
    { key: 'streamMode', label: 'Stream Mode', type: 'select', options: ['chunked', 'live'], section: 'messaging' },
    { key: 'replyToMode', label: 'Reply To Mode', type: 'select', options: ['always', 'never', 'smart'], section: 'messaging' },
    { key: 'textChunkLimit', label: 'Text Chunk Limit', type: 'number', section: 'messaging' },
    { key: 'mediaMaxMb', label: 'Media Max MB', type: 'number', section: 'messaging' },
    // Actions
    { key: 'actions.reactions', label: 'Reactions', type: 'switch', section: 'actions' },
    { key: 'actions.messages', label: 'Messages', type: 'switch', section: 'actions' },
    { key: 'actions.threads', label: 'Threads', type: 'switch', section: 'actions' },
    { key: 'actions.pins', label: 'Pins', type: 'switch', section: 'actions' },
    { key: 'actions.stickers', label: 'Stickers', type: 'switch', section: 'actions' },
    { key: 'actions.polls', label: 'Polls', type: 'switch', section: 'actions' },
    { key: 'actions.search', label: 'Search', type: 'switch', section: 'actions' },
    { key: 'actions.memberInfo', label: 'Member Info', type: 'switch', section: 'actions' },
    { key: 'actions.channelInfo', label: 'Channel Info', type: 'switch', section: 'actions' },
    { key: 'actions.moderation', label: 'Moderation', type: 'switch', section: 'actions' },
    { key: 'actions.events', label: 'Events', type: 'switch', section: 'actions' },
    { key: 'actions.presence', label: 'Presence', type: 'switch', section: 'actions' },
    // Advanced
    { key: 'chunkMode', label: 'Chunk Mode', type: 'select', options: ['sequential', 'parallel'], section: 'advanced' },
    { key: 'blockStreaming', label: 'Block Streaming', type: 'switch', section: 'advanced' },
    { key: 'maxLinesPerMessage', label: 'Max Lines Per Message', type: 'number', section: 'advanced' },
  ],
  slack: [
    // Credentials
    { key: 'botToken', label: 'Bot Token', type: 'text', section: 'credentials' },
    { key: 'appToken', label: 'App Token', type: 'text', section: 'credentials' },
    { key: 'name', label: 'Channel Name', type: 'text', section: 'credentials' },
    { key: 'enabled', label: 'Enabled', type: 'switch', section: 'credentials' },
    // Access Control
    { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: ['pairing', 'allowlist', 'open', 'disabled'], section: 'access' },
    { key: 'groupPolicy', label: 'Group Policy', type: 'select', options: ['open', 'disabled', 'allowlist'], section: 'access' },
    { key: 'allowFrom', label: 'Allow From (comma-separated)', type: 'text', section: 'access' },
    { key: 'requireMention', label: 'Require Mention', type: 'switch', section: 'access' },
    { key: 'allowBots', label: 'Allow Bots', type: 'switch', section: 'access' },
    // Messaging
    { key: 'historyLimit', label: 'Group History Limit', type: 'number', section: 'messaging' },
    { key: 'dmHistoryLimit', label: 'DM History Limit', type: 'number', section: 'messaging' },
    { key: 'replyToMode', label: 'Reply To Mode', type: 'select', options: ['always', 'never', 'smart'], section: 'messaging' },
    { key: 'textChunkLimit', label: 'Text Chunk Limit', type: 'number', section: 'messaging' },
    { key: 'mediaMaxMb', label: 'Media Max MB', type: 'number', section: 'messaging' },
    // Actions
    { key: 'actions.reactions', label: 'Reactions', type: 'switch', section: 'actions' },
    { key: 'actions.messages', label: 'Messages', type: 'switch', section: 'actions' },
    { key: 'actions.threads', label: 'Threads', type: 'switch', section: 'actions' },
    { key: 'actions.pins', label: 'Pins', type: 'switch', section: 'actions' },
    // Advanced
    { key: 'userToken', label: 'User Token', type: 'text', section: 'advanced' },
    { key: 'chunkMode', label: 'Chunk Mode', type: 'select', options: ['sequential', 'parallel'], section: 'advanced' },
    { key: 'blockStreaming', label: 'Block Streaming', type: 'switch', section: 'advanced' },
  ],
  whatsapp: [
    // Credentials
    { key: 'name', label: 'Channel Name', type: 'text', section: 'credentials' },
    { key: 'enabled', label: 'Enabled', type: 'switch', section: 'credentials' },
    // Access Control
    { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: ['pairing', 'allowlist', 'open', 'disabled'], section: 'access' },
    { key: 'groupPolicy', label: 'Group Policy', type: 'select', options: ['open', 'disabled', 'allowlist'], section: 'access' },
    { key: 'allowFrom', label: 'Allow From (comma-separated)', type: 'text', section: 'access' },
    { key: 'sendReadReceipts', label: 'Send Read Receipts', type: 'switch', section: 'access' },
    { key: 'selfChatMode', label: 'Self-Chat Mode', type: 'select', options: ['off', 'mirror', 'command'], section: 'access' },
    // Messaging
    { key: 'historyLimit', label: 'Group History Limit', type: 'number', section: 'messaging' },
    { key: 'dmHistoryLimit', label: 'DM History Limit', type: 'number', section: 'messaging' },
    { key: 'textChunkLimit', label: 'Text Chunk Limit', type: 'number', section: 'messaging' },
    { key: 'mediaMaxMb', label: 'Media Max MB', type: 'number', section: 'messaging' },
    { key: 'messagePrefix', label: 'Message Prefix', type: 'text', section: 'messaging' },
    // Actions
    { key: 'actions.reactions', label: 'Reactions', type: 'switch', section: 'actions' },
    { key: 'actions.sendMessage', label: 'Send Message', type: 'switch', section: 'actions' },
    { key: 'actions.polls', label: 'Polls', type: 'switch', section: 'actions' },
    // Advanced
    { key: 'ackReaction', label: 'Ack Reaction', type: 'text', section: 'advanced' },
    { key: 'chunkMode', label: 'Chunk Mode', type: 'select', options: ['sequential', 'parallel'], section: 'advanced' },
    { key: 'blockStreaming', label: 'Block Streaming', type: 'switch', section: 'advanced' },
    { key: 'debounceMs', label: 'Debounce (ms)', type: 'number', section: 'advanced' },
  ],
  signal: [
    // Credentials
    { key: 'name', label: 'Channel Name', type: 'text', section: 'credentials' },
    { key: 'enabled', label: 'Enabled', type: 'switch', section: 'credentials' },
    // Access Control
    { key: 'dmPolicy', label: 'DM Policy', type: 'select', options: ['pairing', 'allowlist', 'open', 'disabled'], section: 'access' },
    { key: 'groupPolicy', label: 'Group Policy', type: 'select', options: ['open', 'disabled', 'allowlist'], section: 'access' },
    { key: 'allowFrom', label: 'Allow From (comma-separated)', type: 'text', section: 'access' },
    { key: 'groupAllowFrom', label: 'Group Allow From (comma-separated)', type: 'text', section: 'access' },
    { key: 'sendReadReceipts', label: 'Send Read Receipts', type: 'switch', section: 'access' },
    // Messaging
    { key: 'historyLimit', label: 'Group History Limit', type: 'number', section: 'messaging' },
    { key: 'dmHistoryLimit', label: 'DM History Limit', type: 'number', section: 'messaging' },
    { key: 'textChunkLimit', label: 'Text Chunk Limit', type: 'number', section: 'messaging' },
    { key: 'mediaMaxMb', label: 'Media Max MB', type: 'number', section: 'messaging' },
    { key: 'reactionNotifications', label: 'Reaction Notifications', type: 'select', options: ['off', 'own', 'all'], section: 'messaging' },
    { key: 'reactionLevel', label: 'Reaction Level', type: 'select', options: ['off', 'ack', 'minimal', 'extensive'], section: 'messaging' },
    // Actions
    { key: 'actions.reactions', label: 'Reactions', type: 'switch', section: 'actions' },
    // Advanced
    { key: 'chunkMode', label: 'Chunk Mode', type: 'select', options: ['sequential', 'parallel'], section: 'advanced' },
    { key: 'blockStreaming', label: 'Block Streaming', type: 'switch', section: 'advanced' },
    { key: 'autoStart', label: 'Auto Start', type: 'switch', section: 'advanced' },
  ],
};

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  matrix: 'Matrix',
  discord: 'Discord',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  signal: 'Signal',
};

// ── Helpers for nested keys (e.g. "actions.reactions") ───────────────
function getNestedValue(obj: CommonConfig, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: CommonConfig, path: string, value: unknown): CommonConfig {
  const parts = path.split('.');
  const firstPart = parts[0];
  if (!firstPart) return obj;
  if (parts.length === 1) {
    return { ...obj, [firstPart]: value };
  }
  const head = firstPart;
  const rest = parts.slice(1).join('.');
  const child = (obj[head] ?? {}) as CommonConfig;
  return {
    ...obj,
    [head]: setNestedValue({ ...child }, rest, value),
  };
}

// ── Component ────────────────────────────────────────────────────────
export function ChannelConfigEditor({ channel, onClose }: ChannelConfigEditorProps) {
  const [config, setConfig] = useState<CommonConfig>({});
  const [originalConfig, setOriginalConfig] = useState<CommonConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [gatewayLabel, setGatewayLabel] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map(s => [s.id, s.defaultOpen]))
  );

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const buildTarget = useCallback(async (): Promise<GatewayTarget> => {
    const desktopConfig = await readConfig().catch(() => null);
    let url = desktopConfig?.gatewayUrl || 'http://localhost:18789';
    const token = desktopConfig?.gatewayToken || (await resolveToken());

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
      setGatewayLabel(`${urlObj.hostname}:${urlObj.port || '18789'}`);
    } catch {
      // ignore
    }

    return { url, token: token || undefined, kind: inferGatewayKind(url) };
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const target = await buildTarget();
      const gwConfig = await fetchGatewayConfig(target);
      const channels = (gwConfig as Record<string, unknown>).channels as Record<string, unknown> | undefined;
      const channelConfig = (channels?.[channel] || {}) as CommonConfig;

      // Convert arrays to comma-separated strings for UI
      const uiConfig = { ...channelConfig };
      if (Array.isArray(uiConfig.allowFrom)) {
        uiConfig.allowFrom = (uiConfig.allowFrom as unknown[]).join(', ');
      }
      if (Array.isArray(uiConfig.groupAllowFrom)) {
        uiConfig.groupAllowFrom = (uiConfig.groupAllowFrom as unknown[]).join(', ');
      }

      setConfig(uiConfig);
      setOriginalConfig(uiConfig);
      setStatus(null);
    } catch (err) {
      setStatus({ type: 'error', message: `Failed to load: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  }, [buildTarget, channel]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);

    const fields = CHANNEL_FIELDS[channel] || [];
    const patch: Record<string, unknown> = {};

    for (const field of fields) {
      const newVal = getNestedValue(config, field.key);
      const oldVal = getNestedValue(originalConfig, field.key);
      if (newVal !== oldVal) {
        if (field.type === 'number') {
          setNestedPatch(patch, field.key, typeof newVal === 'number' ? newVal : parseInt(String(newVal), 10) || 0);
        } else if (field.key === 'allowFrom' || field.key === 'groupAllowFrom') {
          const strVal = String(newVal || '').trim();
          setNestedPatch(patch, field.key, strVal ? strVal.split(',').map(s => s.trim()).filter(Boolean) : []);
        } else {
          setNestedPatch(patch, field.key, newVal);
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      setStatus({ type: 'success', message: 'No changes to save.' });
      setSaving(false);
      return;
    }

    try {
      const target = await buildTarget();
      await patchGatewayConfig(target, {
        channels: {
          [channel]: patch,
        },
      });
      setStatus({ type: 'success', message: `Saved to ${gatewayLabel}. Gateway reloading.` });
      setOriginalConfig({ ...config });
    } catch (err) {
      setStatus({ type: 'error', message: `Failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  const fields = CHANNEL_FIELDS[channel] || [];

  // Group fields by section
  const fieldsBySection = new Map<SectionId, FieldDef[]>();
  for (const field of fields) {
    const list = fieldsBySection.get(field.section) || [];
    list.push(field);
    fieldsBySection.set(field.section, list);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          <h3 className="text-lg font-semibold">{CHANNEL_LABELS[channel] || channel} Settings</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadConfig} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Editing on: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{gatewayLabel}</code>
      </p>

      {/* Status message */}
      {status && (
        <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
          status.type === 'success' ? 'text-green-600 bg-green-500/10' : 'text-destructive bg-destructive/10'
        }`}>
          {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {SECTIONS.map(section => {
            const sectionFields = fieldsBySection.get(section.id);
            if (!sectionFields || sectionFields.length === 0) return null;

            const isOpen = openSections[section.id];

            return (
              <div key={section.id} className="border rounded-lg overflow-hidden">
                {/* Section header (clickable) */}
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium bg-muted/50 hover:bg-muted/80 transition-colors text-left"
                  onClick={() => toggleSection(section.id)}
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                  {section.icon}
                  <span>{section.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{sectionFields.length} field{sectionFields.length !== 1 ? 's' : ''}</span>
                </button>

                {/* Section body */}
                {isOpen && (
                  <div className="px-4 py-3 space-y-4 border-t">
                    {sectionFields.map(field => (
                      <FieldEditor
                        key={field.key}
                        field={field}
                        value={getNestedValue(config, field.key)}
                        onChange={(val) => setConfig(prev => setNestedValue(prev, field.key, val))}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Individual field renderer ────────────────────────────────────────
function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const id = `field-${field.key.replace(/\./g, '-')}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === 'text' && (
        <Input
          id={id}
          type={field.key.toLowerCase().includes('token') || field.key.toLowerCase().includes('key') || field.key.toLowerCase().includes('secret') ? 'password' : 'text'}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === 'number' && (
        <Input
          id={id}
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        />
      )}
      {field.type === 'switch' && (
        <Switch
          id={id}
          checked={(value as boolean) ?? false}
          onCheckedChange={(checked) => onChange(checked)}
        />
      )}
      {field.type === 'select' && field.options && (
        <Select
          value={(value as string) ?? field.options[0]}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ── Helper: build nested patch object from dotted key ────────────────
function setNestedPatch(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.');
  const firstPart = parts[0];
  if (!firstPart) return;
  if (parts.length === 1) {
    obj[firstPart] = value;
    return;
  }
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!key) return;
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const leafKey = parts[parts.length - 1];
  if (leafKey) {
    current[leafKey] = value;
  }
}
