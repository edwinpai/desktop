/**
 * Channel API Client (SPEC §9)
 *
 * Wrapper around Tauri commands for channel management.
 * In Gateway Mode, reads from the gateway's config file (edwinpai.json).
 * In Client Mode, the app is a restricted Gateway connection; channel records
 * remain communication media and are still stored through local Tauri IPC.
 */

import { invoke } from "@tauri-apps/api/core";

import type {
  ChannelConfig,
  ChannelName,
  ChannelSettings,
} from "@/types/channels";

/** Known channel names that map between gateway config and the UI */
const KNOWN_CHANNELS: ChannelName[] = [
  "telegram",
  "matrix",
  "discord",
  "slack",
  "whatsapp",
  "signal",
];

/**
 * Reads channels from the gateway's own config via WebSocket config.get.
 * Falls back to local get_edwinpai_config if no gateway target is available.
 *
 * Transforms the gateway config format (messages.channels.<name> objects)
 * into the ChannelConfig[] format the UI expects.
 */
export async function listChannelsFromGatewayConfig(): Promise<
  ChannelConfig[]
> {
  let config: Record<string, unknown>;

  try {
    // Try to fetch from the selected gateway via WebSocket
    const { readConfig } = await import("@/lib/config");
    const { fetchGatewayConfig, inferGatewayKind } =
      await import("@/lib/gateway-context");
    const desktopConfig = await readConfig();

    if (desktopConfig.gatewayUrl) {
      const gwConfig = await fetchGatewayConfig({
        url: desktopConfig.gatewayUrl,
        token: desktopConfig.gatewayToken || undefined,
        kind: inferGatewayKind(desktopConfig.gatewayUrl),
      });
      config = gwConfig as Record<string, unknown>;
    } else {
      // Fallback to local config
      const response = await invoke<{ config: Record<string, unknown> }>(
        "get_edwinpai_config",
      );
      config = response.config;
    }
  } catch {
    // Fallback to local config on any error
    const response = await invoke<{ config: Record<string, unknown> }>(
      "get_edwinpai_config",
    );
    config = response.config;
  }

  // Gateway config stores channels under messages.channels
  const messages = (config.messages ?? {}) as Record<string, unknown>;
  const channelsObj = (messages.channels ?? config.channels ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  const result: ChannelConfig[] = [];

  for (const name of KNOWN_CHANNELS) {
    const channelCfg = channelsObj[name];
    if (!channelCfg) continue;

    // Extract credentials (all non-standard keys)
    const metaKeys = new Set([
      "enabled",
      "allowFrom",
      "groupPolicy",
      "groups",
      "autoReply",
    ]);
    const credentials: Record<string, string> = {};
    for (const [key, value] of Object.entries(channelCfg)) {
      if (!metaKeys.has(key) && typeof value === "string") {
        credentials[key] = value;
      }
    }

    // Extract settings
    const groups = (channelCfg.groups ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const allowedChatIds = Object.keys(groups).filter((id) => {
      const g = groups[id];
      return g && g.allow === true;
    });

    const settings: ChannelSettings = {
      autoReply:
        channelCfg.autoReply === true ||
        Object.values(groups).some(
          (g: Record<string, unknown>) => g.autoReply === true,
        ),
      allowedChatIds,
    };

    result.push({
      channel: name,
      enabled: channelCfg.enabled !== false, // default true if not specified
      configuredAt: new Date().toISOString(), // gateway config doesn't track this
      configuredBy: "gateway",
      credentials,
      settings,
    });
  }

  return result;
}

export interface ValidationResult {
  valid: boolean;
  errorMessage?: string;
  metadata?: Record<string, string>;
}

export interface DecryptedChannelConfig {
  channel: string;
  enabled: boolean;
  configuredAt: string;
  configuredBy: string;
  credentials: Record<string, string>;
  settings: ChannelSettings;
}

/**
 * Creates a new channel configuration
 */
export async function createChannel(
  channel: ChannelName,
  configuredBy: string,
  credentials: Record<string, string>,
  settings: ChannelSettings,
): Promise<ChannelConfig> {
  return invoke("create_channel_cmd", {
    channel,
    configuredBy,
    credentials,
    settings,
  });
}

/**
 * Reads a channel configuration (with encrypted credentials)
 */
export async function readChannel(
  channel: ChannelName,
): Promise<ChannelConfig> {
  return invoke("read_channel_cmd", { channel });
}

/**
 * Reads a channel configuration with decrypted credentials
 */
export async function readChannelDecrypted(
  channel: ChannelName,
): Promise<DecryptedChannelConfig> {
  return invoke("read_channel_decrypted_cmd", { channel });
}

/**
 * Updates an existing channel configuration
 */
export async function updateChannel(
  channel: ChannelName,
  enabled?: boolean,
  credentials?: Record<string, string>,
  settings?: ChannelSettings,
): Promise<ChannelConfig> {
  return invoke("update_channel_cmd", {
    channel,
    enabled,
    credentials,
    settings,
  });
}

/**
 * Deletes a channel configuration
 */
export async function deleteChannel(channel: ChannelName): Promise<void> {
  return invoke("delete_channel_cmd", { channel });
}

/**
 * Lists all configured channels
 */
export async function listChannels(): Promise<ChannelConfig[]> {
  return invoke("list_channels_cmd");
}

/**
 * Validates channel credentials without persisting them
 */
export async function validateChannelCredentials(
  channel: ChannelName,
  credentials: Record<string, string>,
): Promise<ValidationResult> {
  return invoke("validate_channel_credentials_cmd", {
    channel,
    credentials,
  });
}

/**
 * Toggles a channel's enabled state
 */
export async function toggleChannel(
  channel: ChannelName,
  enabled: boolean,
): Promise<ChannelConfig> {
  return invoke("toggle_channel_cmd", { channel, enabled });
}
