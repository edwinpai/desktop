import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { readConfig } from "@/lib/config";
import {
  inferGatewayKind,
  requestVaultSecretApproval,
} from "@/lib/gateway-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StyledSelect } from "@/components/ui/styled-select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  loadPolicy,
  savePolicy,
  getRuleForCredential,
  setRuleForCredential,
  type AskMode,
  type VaultPolicy,
} from "@/lib/vault-policy";

interface VaultEntryMeta {
  id: string;
  name: string;
  type: string;
  provider: string;
  created_at: number;
  last_accessed_at: number;
  access_count: number;
  keychain_ref: string;
  fingerprint: string;
  reveal_requires_approval: boolean;
  use_requires_approval: boolean;
}

function toUserFacingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("Cannot read properties of undefined (reading 'invoke')") ||
    msg.includes("Failed to initialize configuration")
  ) {
    return "Desktop integration is unavailable right now. Please reopen this screen inside the desktop app.";
  }
  return msg;
}

const ASK_MODES: { value: AskMode; label: string; description: string }[] = [
  { value: "always", label: "Always Ask", description: "Prompt every time" },
  {
    value: "first-time",
    label: "First Time",
    description: "Prompt once per session",
  },
  {
    value: "auto-grant",
    label: "Auto-Grant",
    description: "Never prompt, always grant",
  },
  { value: "deny", label: "Deny", description: "Never grant" },
];

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.round(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)} hr ago`;
  return `${Math.round(diff / 86400000)} days ago`;
}

interface RevealedSecret {
  value: string;
  expiresAtMs: number;
}

const REVEAL_TTL_MS = 60_000;

// Keep revealed values only in renderer memory so a reveal that resolves while
// the user is on Action Approvals can still be displayed when they navigate
// back to Vault. Never persist this to disk/sessionStorage/localStorage.
const volatileRevealedSecrets: Record<string, RevealedSecret> = {};
const volatileRevealStatus: Record<string, string> = {};
const volatileRevealErrors: Record<string, string> = {};
const volatileApprovedRevealUntilMs: Record<string, number> = {};

function pruneVolatileReveals(now = Date.now()) {
  for (const [id, secret] of Object.entries(volatileRevealedSecrets)) {
    if (secret.expiresAtMs <= now) {
      delete volatileRevealedSecrets[id];
      delete volatileRevealStatus[id];
      delete volatileRevealErrors[id];
      delete volatileApprovedRevealUntilMs[id];
    }
  }
}

function snapshotVolatileReveals(
  now = Date.now(),
): Record<string, RevealedSecret> {
  pruneVolatileReveals(now);
  return { ...volatileRevealedSecrets };
}

export function VaultPanel({
  profileId = "default",
  profileName,
}: {
  profileId?: string;
  profileName?: string;
}) {
  const [entries, setEntries] = useState<VaultEntryMeta[]>([]);
  const [policy, setPolicy] = useState<VaultPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const [revealed, setRevealed] = useState<Record<string, RevealedSecret>>(() =>
    snapshotVolatileReveals(),
  );
  const [revealStatus, setRevealStatus] = useState<Record<string, string>>(
    () => ({
      ...volatileRevealStatus,
    }),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Add credential form
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("api_key");
  const [newProvider, setNewProvider] = useState("");
  const [newValue, setNewValue] = useState("");
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [repairValue, setRepairValue] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("[Vault] Refreshing list for profile:", profileId);
      const [list, pol] = await Promise.all([
        invoke<VaultEntryMeta[]>("vault_list", { profileId }),
        loadPolicy(profileId),
      ]);
      console.log("[Vault] List returned:", list.length, "entries");
      setEntries(list);
      setPolicy(pol);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Vault] Refresh failed:", msg);
      setError(toUserFacingError(msg));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    mountedRef.current = true;
    setRevealed(snapshotVolatileReveals());
    setRevealStatus({ ...volatileRevealStatus, ...volatileRevealErrors });
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      pruneVolatileReveals(now);
      setRevealed((prev) => {
        let changed = false;
        const next: Record<string, RevealedSecret> = {};
        for (const [id, secret] of Object.entries(prev)) {
          if (secret.expiresAtMs > now) {
            next[id] = secret;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setRevealStatus({ ...volatileRevealStatus, ...volatileRevealErrors });
    }, 1_000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const revealRemainingSeconds = useMemo(() => {
    const remaining: Record<string, number> = {};
    for (const [id, secret] of Object.entries(revealed)) {
      remaining[id] = Math.max(
        0,
        Math.ceil((secret.expiresAtMs - nowMs) / 1000),
      );
    }
    return remaining;
  }, [nowMs, revealed]);

  const handleAdd = async () => {
    console.log(
      "[Vault] handleAdd called, id:",
      newId,
      "name:",
      newName,
      "value length:",
      newValue.length,
    );
    if (!newId.trim() || !newName.trim() || !newValue.trim()) {
      setError("ID, name, and value are required.");
      return;
    }
    setError(null);
    try {
      console.log(
        "[Vault] Storing credential:",
        newId.trim(),
        "profile:",
        profileId,
      );
      await invoke("vault_store", {
        profileId,
        id: newId.trim(),
        name: newName.trim(),
        entryType: newType,
        provider: newProvider.trim(),
        credential: newValue.trim(),
      });
      console.log("[Vault] Credential stored successfully");
      setShowAdd(false);
      setNewId("");
      setNewName("");
      setNewProvider("");
      setNewValue("");
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Vault] Failed to store:", msg);
      setError(toUserFacingError(msg));
    }
  };

  const performLocalReveal = useCallback(
    async (entry: VaultEntryMeta) => {
      const payload = JSON.stringify({
        actionType: "vault.secret.reveal",
        vaultEntryId: entry.id,
        label: entry.name,
        provider: entry.provider,
        requestedAtMs: Date.now(),
      });
      const signed = await invoke<{ envelope: Record<string, unknown> }>(
        "sign_request",
        { payload },
      );
      const value = await invoke<string | null>("vault_reveal", {
        profileId,
        id: entry.id,
        payload,
        envelope: signed.envelope,
      });
      if (!value) {
        throw new Error("Secret is missing from the OS keychain.");
      }
      const now = Date.now();
      const revealedSecret = { value, expiresAtMs: now + REVEAL_TTL_MS };
      volatileRevealedSecrets[entry.id] = revealedSecret;
      volatileRevealStatus[entry.id] = "Revealing locally for 60 seconds.";
      delete volatileRevealErrors[entry.id];
      if (mountedRef.current) {
        setNowMs(now);
        setRevealed((prev) => ({
          ...prev,
          [entry.id]: revealedSecret,
        }));
        setRevealStatus((prev) => ({
          ...prev,
          [entry.id]: "Revealing locally for 60 seconds.",
        }));
        void refresh();
      }
    },
    [profileId, refresh],
  );

  const handleReveal = async (entry: VaultEntryMeta) => {
    const confirmed = window.confirm(
      `Reveal ${entry.name}?\n\nThis will display the full secret on screen. Only do this if you need to copy it manually.`,
    );
    if (!confirmed) return;
    try {
      const config = await readConfig();
      const requestedStatus =
        "Approval requested — open Action Approvals and allow the Vault reveal.";
      volatileRevealStatus[entry.id] = requestedStatus;
      setRevealStatus((prev) => ({
        ...prev,
        [entry.id]: requestedStatus,
      }));
      await requestVaultSecretApproval(
        {
          url: config.gatewayUrl,
          token: config.gatewayToken || undefined,
          kind: inferGatewayKind(config.gatewayUrl),
        },
        {
          actionType: "vault.secret.reveal",
          vaultEntryId: entry.id,
          label: entry.name,
          kind: entry.type,
          provider: entry.provider,
          keychainRef: entry.keychain_ref,
          purpose: "Reveal full secret in Desktop Vault",
          requestedBy: "desktop:vault",
          scope: { operation: "display", surface: "vault" },
        },
      );
      volatileRevealStatus[entry.id] =
        "Approval received — revealing locally for 60 seconds.";
      if (mountedRef.current) {
        setRevealStatus((prev) => ({
          ...prev,
          [entry.id]: "Approval received — revealing locally for 60 seconds.",
        }));
      }
      volatileApprovedRevealUntilMs[entry.id] = Date.now() + REVEAL_TTL_MS;
      await performLocalReveal(entry);
    } catch (err) {
      const msg = toUserFacingError(err);
      volatileRevealErrors[entry.id] = `Reveal failed: ${msg}`;
      delete volatileRevealStatus[entry.id];
      if (mountedRef.current) {
        setRevealStatus((prev) => ({
          ...prev,
          [entry.id]: `Reveal failed: ${msg}`,
        }));
        setError(msg);
      }
    }
  };

  const handleCompleteApprovedReveal = async (entry: VaultEntryMeta) => {
    if ((volatileApprovedRevealUntilMs[entry.id] ?? 0) <= Date.now()) {
      setError("Reveal approval expired. Please request reveal again.");
      return;
    }
    try {
      await performLocalReveal(entry);
    } catch (err) {
      const msg = toUserFacingError(err);
      volatileRevealErrors[entry.id] = `Reveal failed: ${msg}`;
      setRevealStatus((prev) => ({
        ...prev,
        [entry.id]: `Reveal failed: ${msg}`,
      }));
      setError(msg);
    }
  };

  const handleCopySecret = async (id: string) => {
    const value = revealed[id]?.value;
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  const handleHideSecret = (id: string) => {
    delete volatileRevealedSecrets[id];
    delete volatileRevealStatus[id];
    delete volatileRevealErrors[id];
    delete volatileApprovedRevealUntilMs[id];
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRevealStatus((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRepairSecret = async (entry: VaultEntryMeta) => {
    if (!repairValue.trim()) {
      setError("Secret value is required to repair this Vault entry.");
      return;
    }
    try {
      await invoke("vault_store", {
        profileId,
        id: entry.id,
        name: entry.name,
        entryType: entry.type,
        provider: entry.provider,
        credential: repairValue.trim(),
      });
      delete volatileRevealErrors[entry.id];
      delete volatileRevealStatus[entry.id];
      delete volatileApprovedRevealUntilMs[entry.id];
      setRepairingId(null);
      setRepairValue("");
      setError(null);
      await refresh();
    } catch (err) {
      setError(toUserFacingError(err));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("vault_delete", { profileId, id });
      await refresh();
    } catch (err) {
      setError(toUserFacingError(err));
    }
  };

  const handlePolicyChange = async (credentialId: string, ask: AskMode) => {
    if (!policy) return;
    try {
      const updated = setRuleForCredential(policy, credentialId, ask);
      await savePolicy(profileId, updated);
      setPolicy(updated);
    } catch (err) {
      setError(toUserFacingError(err));
    }
  };

  const getAskMode = (credentialId: string): AskMode => {
    if (!policy) return "always";
    return getRuleForCredential(policy, credentialId).ask;
  };

  const askBadgeVariant = (mode: AskMode) => {
    switch (mode) {
      case "auto-grant":
        return "default" as const;
      case "first-time":
        return "secondary" as const;
      case "deny":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Credential Vault</h2>
        <p className="text-sm text-muted-foreground">
          Encrypted credential storage. Master key secured in OS Keychain.
          <span className="ml-2 text-xs opacity-50">
            Vault: {profileName ?? profileId}
            {profileName && profileName !== profileId ? ` (${profileId})` : ""}
          </span>
        </p>
      </div>

      {error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </Button>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add Credential"}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Credential ID</Label>
                <Input
                  placeholder="anthropic-api-key"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input
                  placeholder="Anthropic API Key"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <Input
                  placeholder="anthropic"
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <StyledSelect
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  <option value="api_key">API Key</option>
                  <option value="token">Token</option>
                  <option value="oauth">OAuth</option>
                  <option value="session">Session</option>
                </StyledSelect>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Secret Value</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={handleAdd}>
              Save to Vault
            </Button>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && !loading && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No credentials stored. Add one above or grant a credential request
          with "Remember" checked.
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry) => {
          const mode = getAskMode(entry.id);
          return (
            <Card key={entry.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.name}</span>
                    <Badge variant={askBadgeVariant(mode)} className="text-xs">
                      {ASK_MODES.find((m) => m.value === mode)?.label ?? mode}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.provider && <span>{entry.provider} · </span>}
                    Last used: {formatTimeAgo(entry.last_accessed_at)} ·{" "}
                    {entry.access_count} accesses
                  </div>
                  <div className="text-xs font-mono text-muted-foreground/60">
                    {entry.id} · stored in OS keychain
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    Keychain ref: {entry.keychain_ref}
                  </div>
                  {revealStatus[entry.id] && !revealed[entry.id] && (
                    <div className="mt-2 rounded border border-blue-500/30 bg-blue-500/5 p-2 text-xs text-muted-foreground space-y-2">
                      <div>{revealStatus[entry.id]}</div>
                      {revealStatus[entry.id]?.includes(
                        "No matching entry found",
                      ) ? (
                        <div className="space-y-2">
                          <div>
                            Vault metadata exists, but the raw secret is missing
                            from OS secure storage. Re-enter the secret to
                            repair this entry, or delete it if it was only a
                            smoke-test record.
                          </div>
                          {repairingId === entry.id ? (
                            <div className="flex gap-2">
                              <Input
                                type="password"
                                placeholder="Secret value"
                                value={repairValue}
                                onChange={(e) => setRepairValue(e.target.value)}
                                className="h-7 text-xs"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => handleRepairSecret(entry)}
                              >
                                Save repair
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={() => {
                                  setRepairingId(null);
                                  setRepairValue("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => setRepairingId(entry.id)}
                            >
                              Re-enter secret
                            </Button>
                          )}
                        </div>
                      ) : (
                        (volatileApprovedRevealUntilMs[entry.id] ?? 0) >
                          nowMs && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() => handleCompleteApprovedReveal(entry)}
                          >
                            Show approved secret
                          </Button>
                        )
                      )}
                    </div>
                  )}
                  {revealed[entry.id] && (
                    <div className="mt-2 rounded border border-warning/30 bg-warning/5 p-2 space-y-2">
                      <div className="text-xs font-semibold">
                        Full secret revealed — auto-hides in{" "}
                        {revealRemainingSeconds[entry.id] ?? 0}s
                      </div>
                      <div className="font-mono text-xs break-all select-all">
                        {revealed[entry.id]?.value}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => handleCopySecret(entry.id)}
                        >
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => handleHideSecret(entry.id)}
                        >
                          Hide
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StyledSelect
                    value={mode}
                    onChange={(e) =>
                      handlePolicyChange(entry.id, e.target.value as AskMode)
                    }
                    className="text-xs"
                  >
                    {ASK_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </StyledSelect>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => handleReveal(entry)}
                  >
                    Reveal
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-7"
                    onClick={() => handleDelete(entry.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
