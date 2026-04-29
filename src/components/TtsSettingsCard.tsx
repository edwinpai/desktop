/**
 * TtsSettingsCard — Configure Text-to-Speech settings
 *
 * Reads/writes via gateway config.get / config.patch WebSocket methods.
 * Covers: auto mode, provider, voice selection, and per-provider settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Volume2, Save, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import {
  fetchGatewayConfig,
  patchGatewayConfig,
  resolveToken,
  inferGatewayKind,
  type GatewayTarget,
} from '@/lib/gateway-context';

interface TtsSettingsCardProps {
  gatewayUrl?: string;
  gatewayToken?: string;
}

interface TtsState {
  auto: string;
  provider: string;
  // Edge settings
  edgeEnabled: boolean;
  edgeVoice: string;
  // OpenAI settings
  openaiVoice: string;
  openaiModel: string;
  // ElevenLabs settings
  elevenlabsVoiceId: string;
  elevenlabsModelId: string;
  // General
  maxTextLength: number | '';
}

const DEFAULT_STATE: TtsState = {
  auto: 'off',
  provider: 'edge',
  edgeEnabled: true,
  edgeVoice: '',
  openaiVoice: 'alloy',
  openaiModel: 'tts-1',
  elevenlabsVoiceId: '',
  elevenlabsModelId: '',
  maxTextLength: '',
};

const EDGE_VOICES = [
  'en-US-AndrewNeural', 'en-US-AriaNeural', 'en-US-ChristopherNeural',
  'en-US-EricNeural', 'en-US-GuyNeural', 'en-US-JennyNeural',
  'en-US-MichelleNeural', 'en-US-RogerNeural', 'en-US-SteffanNeural',
  'en-GB-RyanNeural', 'en-GB-SoniaNeural', 'en-GB-ThomasNeural',
  'en-AU-NatashaNeural', 'en-AU-WilliamNeural',
  'en-CA-ClaraNeural', 'en-CA-LiamNeural',
];

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

export function TtsSettingsCard({ gatewayUrl, gatewayToken }: TtsSettingsCardProps) {
  const [state, setState] = useState<TtsState>(DEFAULT_STATE);
  const [original, setOriginal] = useState<TtsState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const buildTarget = useCallback(async (): Promise<GatewayTarget> => {
    const url = gatewayUrl || 'http://localhost:18789';
    const token = gatewayToken || (await resolveToken());
    return { url, token: token || undefined, kind: inferGatewayKind(url) };
  }, [gatewayUrl, gatewayToken]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const target = await buildTarget();
      const config = await fetchGatewayConfig(target);
      const msgs = (config as Record<string, unknown>).messages as Record<string, unknown> | undefined;
      const tts = (msgs?.tts ?? {}) as Record<string, unknown>;
      const edge = (tts.edge ?? {}) as Record<string, unknown>;
      const openai = (tts.openai ?? {}) as Record<string, unknown>;
      const elevenlabs = (tts.elevenlabs ?? {}) as Record<string, unknown>;

      const loaded: TtsState = {
        auto: (tts.auto as string) ?? 'off',
        provider: (tts.provider as string) ?? 'edge',
        edgeEnabled: (edge.enabled as boolean) ?? true,
        edgeVoice: (edge.voice as string) ?? '',
        openaiVoice: (openai.voice as string) ?? 'alloy',
        openaiModel: (openai.model as string) ?? 'tts-1',
        elevenlabsVoiceId: (elevenlabs.voiceId as string) ?? '',
        elevenlabsModelId: (elevenlabs.modelId as string) ?? '',
        maxTextLength: (tts.maxTextLength as number) ?? '',
      };

      setState(loaded);
      setOriginal(loaded);
    } catch (err) {
      setStatus({ type: 'error', message: `Failed to load TTS config: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  }, [buildTarget]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);

    // Build patch with only changed values
    const patch: Record<string, unknown> = {};
    if (state.auto !== original.auto) patch.auto = state.auto;
    if (state.provider !== original.provider) patch.provider = state.provider;
    if (state.maxTextLength !== original.maxTextLength) {
      patch.maxTextLength = state.maxTextLength === '' ? undefined : Number(state.maxTextLength);
    }

    // Edge settings
    const edgePatch: Record<string, unknown> = {};
    if (state.edgeEnabled !== original.edgeEnabled) edgePatch.enabled = state.edgeEnabled;
    if (state.edgeVoice !== original.edgeVoice) edgePatch.voice = state.edgeVoice || undefined;
    if (Object.keys(edgePatch).length > 0) patch.edge = edgePatch;

    // OpenAI settings
    const openaiPatch: Record<string, unknown> = {};
    if (state.openaiVoice !== original.openaiVoice) openaiPatch.voice = state.openaiVoice;
    if (state.openaiModel !== original.openaiModel) openaiPatch.model = state.openaiModel;
    if (Object.keys(openaiPatch).length > 0) patch.openai = openaiPatch;

    // ElevenLabs settings
    const elPatch: Record<string, unknown> = {};
    if (state.elevenlabsVoiceId !== original.elevenlabsVoiceId) elPatch.voiceId = state.elevenlabsVoiceId || undefined;
    if (state.elevenlabsModelId !== original.elevenlabsModelId) elPatch.modelId = state.elevenlabsModelId || undefined;
    if (Object.keys(elPatch).length > 0) patch.elevenlabs = elPatch;

    if (Object.keys(patch).length === 0) {
      setStatus({ type: 'success', message: 'No changes to save.' });
      setSaving(false);
      return;
    }

    try {
      const target = await buildTarget();
      await patchGatewayConfig(target, { messages: { tts: patch } });
      setStatus({ type: 'success', message: 'TTS settings saved. Gateway reloading.' });
      setOriginal({ ...state });
    } catch (err) {
      setStatus({ type: 'error', message: `Failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="size-5" />
            Text-to-Speech
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading TTS config...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="size-5" />
          Text-to-Speech
        </CardTitle>
        <CardDescription>
          Configure voice responses. EdwinPAI can read replies aloud using various TTS engines.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        {status && (
          <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
            status.type === 'success' ? 'text-green-600 bg-green-500/10' : 'text-destructive bg-destructive/10'
          }`}>
            {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {status.message}
          </div>
        )}

        {/* Auto-TTS mode */}
        <div className="space-y-2">
          <Label htmlFor="tts-auto">Auto TTS Mode</Label>
          <Select value={state.auto} onValueChange={(v) => setState(prev => ({ ...prev, auto: v }))}>
            <SelectTrigger id="tts-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off — No auto voice</SelectItem>
              <SelectItem value="always">Always — All replies spoken</SelectItem>
              <SelectItem value="inbound">Inbound — Only when user sends voice</SelectItem>
              <SelectItem value="tagged">Tagged — Only [[tts:...]] tagged replies</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls when EdwinPAI automatically converts replies to voice.
          </p>
        </div>

        {/* Provider */}
        <div className="space-y-2">
          <Label htmlFor="tts-provider">TTS Provider</Label>
          <Select value={state.provider} onValueChange={(v) => setState(prev => ({ ...prev, provider: v }))}>
            <SelectTrigger id="tts-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="edge">Microsoft Edge — Free, no API key</SelectItem>
              <SelectItem value="openai">OpenAI — Requires API key</SelectItem>
              <SelectItem value="elevenlabs">ElevenLabs — Premium voices</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Provider-specific settings */}
        {state.provider === 'edge' && (
          <div className="space-y-4 pl-2 border-l-2 border-muted">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edge-enabled">Enable Edge TTS</Label>
                <p className="text-xs text-muted-foreground">No API key required</p>
              </div>
              <Switch
                id="edge-enabled"
                checked={state.edgeEnabled}
                onCheckedChange={(checked) => setState(prev => ({ ...prev, edgeEnabled: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edge-voice">Voice</Label>
              <Select
                value={state.edgeVoice || 'en-US-AriaNeural'}
                onValueChange={(v) => setState(prev => ({ ...prev, edgeVoice: v }))}
              >
                <SelectTrigger id="edge-voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDGE_VOICES.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {state.provider === 'openai' && (
          <div className="space-y-4 pl-2 border-l-2 border-muted">
            <div className="space-y-2">
              <Label htmlFor="openai-voice">Voice</Label>
              <Select
                value={state.openaiVoice}
                onValueChange={(v) => setState(prev => ({ ...prev, openaiVoice: v }))}
              >
                <SelectTrigger id="openai-voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_VOICES.map(v => (
                    <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-model">Model</Label>
              <Select
                value={state.openaiModel}
                onValueChange={(v) => setState(prev => ({ ...prev, openaiModel: v }))}
              >
                <SelectTrigger id="openai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tts-1">tts-1 (Fast)</SelectItem>
                  <SelectItem value="tts-1-hd">tts-1-hd (High Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Requires an OpenAI API key configured in AI Providers above.
            </p>
          </div>
        )}

        {state.provider === 'elevenlabs' && (
          <div className="space-y-4 pl-2 border-l-2 border-muted">
            <div className="space-y-2">
              <Label htmlFor="el-voice-id">Voice ID</Label>
              <Input
                id="el-voice-id"
                value={state.elevenlabsVoiceId}
                onChange={(e) => setState(prev => ({ ...prev, elevenlabsVoiceId: e.target.value }))}
                placeholder="e.g. pNInz6obpgDQGcFmaJgB"
              />
              <p className="text-xs text-muted-foreground">
                Find voice IDs at <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noreferrer" className="underline">ElevenLabs Voice Library</a>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="el-model-id">Model ID</Label>
              <Input
                id="el-model-id"
                value={state.elevenlabsModelId}
                onChange={(e) => setState(prev => ({ ...prev, elevenlabsModelId: e.target.value }))}
                placeholder="eleven_monolingual_v1"
              />
            </div>
          </div>
        )}

        {/* Max text length */}
        <div className="space-y-2">
          <Label htmlFor="tts-max-length">Max Text Length (chars)</Label>
          <Input
            id="tts-max-length"
            type="number"
            value={state.maxTextLength}
            onChange={(e) => setState(prev => ({ ...prev, maxTextLength: e.target.value ? parseInt(e.target.value, 10) : '' }))}
            placeholder="1500"
          />
          <p className="text-xs text-muted-foreground">
            Longer text is auto-summarized before TTS. Leave empty for default (1500).
          </p>
        </div>

        {/* Save */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save TTS Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
