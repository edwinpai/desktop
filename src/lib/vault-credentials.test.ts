import { describe, expect, it } from "vitest";
import { vaultCredentialForProvider } from "./vault-credentials";

describe("vaultCredentialForProvider", () => {
  it("uses the canonical Desktop Vault credential for OpenAI Codex OAuth", () => {
    expect(vaultCredentialForProvider("openai-codex")).toEqual({
      id: "openai-codex-oauth",
      name: "OpenAI Codex OAuth",
      entryType: "oauth",
      provider: "openai-codex",
      authMode: "oauth",
      defaultModel: "openai-codex/gpt-5.5",
    });
  });

  it("uses the canonical Desktop Vault credential for OpenAI API keys", () => {
    expect(vaultCredentialForProvider("openai")).toMatchObject({
      id: "openai-api-key",
      entryType: "api_key",
      provider: "openai",
      authMode: "api-key",
    });
  });
});
