import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
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

export function VaultPanel({ profileId = "default" }: { profileId?: string }) {
  const [entries, setEntries] = useState<VaultEntryMeta[]>([]);
  const [policy, setPolicy] = useState<VaultPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add credential form
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("api_key");
  const [newProvider, setNewProvider] = useState("");
  const [newValue, setNewValue] = useState("");

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
    refresh();
  }, [refresh]);

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
          <span className="ml-2 text-xs opacity-50">Profile: {profileId}</span>
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
                    {entry.id}
                  </div>
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
