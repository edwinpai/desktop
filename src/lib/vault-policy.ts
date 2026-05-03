/**
 * Vault Access Policy
 *
 * Manages auto-approve rules for credential requests.
 * Stored in ~/.edwinpai/vault/vault.policy.json via Tauri FS.
 */

import {
  BaseDirectory,
  readTextFile,
  writeTextFile,
  exists,
} from "@tauri-apps/plugin-fs";

export type AskMode = "always" | "first-time" | "auto-grant" | "deny";

export interface PolicyRule {
  credentialId: string;
  ask: AskMode;
  maxLeaseMs?: number;
  comment?: string;
}

export interface VaultPolicy {
  version: 1;
  defaults: { ask: AskMode };
  rules: PolicyRule[];
}

const DEFAULT_POLICY: VaultPolicy = {
  version: 1,
  defaults: { ask: "always" },
  rules: [],
};

function policyPath(profileId: string): string {
  const safeId = profileId.replace(/[/\\. ]/g, "_");
  return `.edwinpai/vault/${safeId}/vault.policy.json`;
}

export async function loadPolicy(profileId: string): Promise<VaultPolicy> {
  try {
    const path = policyPath(profileId);
    const fileExists = await exists(path, { baseDir: BaseDirectory.Home });
    if (!fileExists) return { ...DEFAULT_POLICY, rules: [] };
    const text = await readTextFile(path, { baseDir: BaseDirectory.Home });
    return JSON.parse(text) as VaultPolicy;
  } catch {
    return { ...DEFAULT_POLICY, rules: [] };
  }
}

export async function savePolicy(
  profileId: string,
  policy: VaultPolicy,
): Promise<void> {
  await writeTextFile(policyPath(profileId), JSON.stringify(policy, null, 2), {
    baseDir: BaseDirectory.Home,
  });
}

export function getRuleForCredential(
  policy: VaultPolicy,
  credentialId: string,
): { ask: AskMode; maxLeaseMs?: number } {
  const rule = policy.rules.find((r) => r.credentialId === credentialId);
  if (rule) return { ask: rule.ask, maxLeaseMs: rule.maxLeaseMs };
  return { ask: policy.defaults.ask };
}

export function setRuleForCredential(
  policy: VaultPolicy,
  credentialId: string,
  ask: AskMode,
  maxLeaseMs?: number,
  comment?: string,
): VaultPolicy {
  const existing = policy.rules.findIndex(
    (r) => r.credentialId === credentialId,
  );
  const rule: PolicyRule = { credentialId, ask, maxLeaseMs, comment };
  const rules = [...policy.rules];
  if (existing >= 0) {
    rules[existing] = rule;
  } else {
    rules.push(rule);
  }
  return { ...policy, rules };
}
