export type VaultCredentialDescriptor = {
  id: string;
  name: string;
  entryType: "api_key" | "oauth" | "token" | "password";
  provider: string;
  /** Metadata-only gateway auth mode. Never a raw secret. */
  authMode?: "api-key" | "oauth" | "token";
  /** Optional model default to patch when this provider is selected. */
  defaultModel?: string;
};

const PROVIDER_TO_VAULT_DESCRIPTOR: Record<string, VaultCredentialDescriptor> = {
  anthropic: {
    id: "anthropic-api-key",
    name: "Anthropic API key",
    entryType: "api_key",
    provider: "anthropic",
    authMode: "api-key",
  },
  openai: {
    id: "openai-api-key",
    name: "OpenAI API key",
    entryType: "api_key",
    provider: "openai",
    authMode: "api-key",
  },
  "openai-codex": {
    id: "openai-codex-oauth",
    name: "OpenAI Codex OAuth",
    entryType: "oauth",
    provider: "openai-codex",
    authMode: "oauth",
    defaultModel: "openai-codex/gpt-5.5",
  },
  google: {
    id: "gemini-api-key",
    name: "Gemini API key",
    entryType: "api_key",
    provider: "google",
    authMode: "api-key",
  },
  gemini: {
    id: "gemini-api-key",
    name: "Gemini API key",
    entryType: "api_key",
    provider: "google",
    authMode: "api-key",
  },
  openrouter: {
    id: "openrouter-api-key",
    name: "OpenRouter API key",
    entryType: "api_key",
    provider: "openrouter",
    authMode: "api-key",
  },
  minimax: {
    id: "minimax-api-key",
    name: "MiniMax API key",
    entryType: "api_key",
    provider: "minimax",
    authMode: "api-key",
  },
  synthetic: {
    id: "synthetic-api-key",
    name: "Synthetic API key",
    entryType: "api_key",
    provider: "synthetic",
    authMode: "api-key",
  },
  moonshot: {
    id: "moonshot-api-key",
    name: "Moonshot API key",
    entryType: "api_key",
    provider: "moonshot",
    authMode: "api-key",
  },
  venice: {
    id: "venice-api-key",
    name: "Venice API key",
    entryType: "api_key",
    provider: "venice",
    authMode: "api-key",
  },
  zai: {
    id: "zai-api-key",
    name: "Z.ai API key",
    entryType: "api_key",
    provider: "zai",
    authMode: "api-key",
  },
  xiaomi: {
    id: "xiaomi-api-key",
    name: "Xiaomi API key",
    entryType: "api_key",
    provider: "xiaomi",
    authMode: "api-key",
  },
  groq: {
    id: "groq-api-key",
    name: "Groq API key",
    entryType: "api_key",
    provider: "groq",
    authMode: "api-key",
  },
  xai: {
    id: "xai-api-key",
    name: "xAI API key",
    entryType: "api_key",
    provider: "xai",
    authMode: "api-key",
  },
  mistral: {
    id: "mistral-api-key",
    name: "Mistral API key",
    entryType: "api_key",
    provider: "mistral",
    authMode: "api-key",
  },
  cerebras: {
    id: "cerebras-api-key",
    name: "Cerebras API key",
    entryType: "api_key",
    provider: "cerebras",
    authMode: "api-key",
  },
  deepgram: {
    id: "deepgram-api-key",
    name: "Deepgram API key",
    entryType: "api_key",
    provider: "deepgram",
    authMode: "api-key",
  },
};

export function vaultCredentialForProvider(
  provider: string,
): VaultCredentialDescriptor {
  const normalized = provider.trim().toLowerCase();
  const descriptor = PROVIDER_TO_VAULT_DESCRIPTOR[normalized];
  if (descriptor) return descriptor;

  const id = `${normalized.replace(/[^a-z0-9-]+/g, "-")}-api-key`;
  const label = normalized
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  return {
    id,
    name: `${label || provider} API key`,
    entryType: "api_key",
    provider: normalized || provider,
    authMode: "api-key",
  };
}

const CHANNEL_TO_VAULT_ID: Record<string, string> = {
  telegram: "telegram-bot-token",
  discord: "discord-bot-token",
  slack: "slack-bot-token",
  matrix: "matrix-access-token",
};

export function vaultCredentialForChannelSecret(
  channel: string,
  kind: "bot-token" | "access-token" | "password" = "bot-token",
): VaultCredentialDescriptor {
  const normalized = channel.trim().toLowerCase();
  const fallbackSuffix =
    kind === "password"
      ? "password"
      : kind === "access-token"
        ? "access-token"
        : "bot-token";
  const id =
    CHANNEL_TO_VAULT_ID[normalized] ??
    `${normalized.replace(/[^a-z0-9-]+/g, "-")}-${fallbackSuffix}`;
  const label = normalized
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  return {
    id,
    name: `${label || channel} ${kind === "password" ? "password" : kind === "access-token" ? "access token" : "bot token"}`,
    entryType: kind === "password" ? "password" : "api_key",
    provider: normalized || channel,
  };
}
