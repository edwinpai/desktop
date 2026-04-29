import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { readConfig } from "@/lib/config";
import { invokeNodesTool, buildGatewayTarget, type NodeListNode } from "@/lib/nodes";
import {
  buildWsUrlCandidates,
  resolveToken,
  fetchExecApprovals,
  setExecApprovals,
  fetchNodeExecApprovals,
  setNodeExecApprovals,
  resolveExecApproval,
  resolveToolInvokeApproval,
  resolveCredential,
  type ExecApprovalsSnapshot,
  type ExecApprovalsFile,
  type ExecApprovalRequest,
  type ToolInvokeApprovalRequest,
  type CredentialRequest,
} from "@/lib/gateway-context";
import { Input } from "@/components/ui/input";
import { loadPolicy as loadVaultPolicy, getRuleForCredential } from "@/lib/vault-policy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { APP_VERSION } from "@/lib/app-version";

const DEFAULT_POLICY: ExecApprovalsFile = {
  version: 1,
};

type TargetKind = "gateway" | "node";

type StreamState = "disconnected" | "connecting" | "connected" | "error";

const withoutKey = <TValue,>(record: Record<string, TValue>, key: string): Record<string, TValue> => {
  const { [key]: _removed, ...next } = record;
  void _removed;
  return next;
};

export function ExecApprovalsPanel({ profileId = "default" }: { profileId?: string }) {
  const [targetKind, setTargetKind] = useState<TargetKind>("gateway");
  const [nodes, setNodes] = useState<NodeListNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");

  const [snapshot, setSnapshot] = useState<ExecApprovalsSnapshot | null>(null);
  const [policyText, setPolicyText] = useState<string>(JSON.stringify(DEFAULT_POLICY, null, 2));
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<ExecApprovalRequest[]>([]);
  const [pendingToolInvokes, setPendingToolInvokes] = useState<ToolInvokeApprovalRequest[]>([]);
  const [pendingCredentials, setPendingCredentials] = useState<CredentialRequest[]>([]);
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});
  const [streamState, setStreamState] = useState<StreamState>("disconnected");
  const [streamError, setStreamError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const targetLabel = useMemo(() => {
    if (targetKind === "gateway") return "Gateway";
    const node = nodes.find((n) => n.nodeId === selectedNodeId);
    return node?.displayName ?? selectedNodeId ?? "Node";
  }, [targetKind, nodes, selectedNodeId]);

  const buildTarget = useCallback(async () => {
    const desktopConfig = await readConfig();
    return buildGatewayTarget({
      gatewayUrl: desktopConfig.gatewayUrl,
      gatewayPort: desktopConfig.gatewayPort,
      gatewayToken: desktopConfig.gatewayToken,
    });
  }, []);

  const loadNodes = useCallback(async () => {
    try {
      const target = await buildTarget();
      const result = (await invokeNodesTool(target, "status")) as Record<string, unknown>;
      const list = (result?.nodes as NodeListNode[]) ?? [];
      setNodes(list);
      if (!selectedNodeId && list.length > 0) {
        setSelectedNodeId(list[0]?.nodeId ?? "");
      }
    } catch (err) {
      console.error("Failed to load nodes:", err);
    }
  }, [buildTarget, selectedNodeId]);

  const loadPolicy = useCallback(async () => {
    setPolicyLoading(true);
    setPolicyError(null);
    setSaveStatus(null);
    try {
      const target = await buildTarget();
      let nextSnapshot: ExecApprovalsSnapshot;
      if (targetKind === "node") {
        if (!selectedNodeId) throw new Error("Select a node to load approvals.");
        nextSnapshot = await fetchNodeExecApprovals(target, selectedNodeId);
      } else {
        nextSnapshot = await fetchExecApprovals(target);
      }
      setSnapshot(nextSnapshot);
      setPolicyText(JSON.stringify(nextSnapshot.file ?? DEFAULT_POLICY, null, 2));
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolicyLoading(false);
    }
  }, [buildTarget, targetKind, selectedNodeId]);

  const savePolicy = useCallback(async () => {
    setPolicyLoading(true);
    setPolicyError(null);
    setSaveStatus(null);
    try {
      const file = JSON.parse(policyText) as ExecApprovalsFile;
      if (!file.version) {
        file.version = 1;
      }
      const target = await buildTarget();
      let nextSnapshot: ExecApprovalsSnapshot;
      if (targetKind === "node") {
        if (!selectedNodeId) throw new Error("Select a node to save approvals.");
        nextSnapshot = await setNodeExecApprovals(target, selectedNodeId, file, snapshot?.hash);
      } else {
        nextSnapshot = await setExecApprovals(target, file, snapshot?.hash);
      }
      setSnapshot(nextSnapshot);
      setPolicyText(JSON.stringify(nextSnapshot.file ?? file, null, 2));
      setSaveStatus("Saved successfully.");
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolicyLoading(false);
    }
  }, [buildTarget, targetKind, selectedNodeId, policyText, snapshot?.hash]);

  const formatPolicy = useCallback(() => {
    try {
      const parsed = JSON.parse(policyText);
      setPolicyText(JSON.stringify(parsed, null, 2));
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }, [policyText]);

  const connectStream = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStreamState("connecting");
    setStreamError(null);

    try {
      const target = await buildTarget();
      const token = await resolveToken(target.token);
      const wsCandidates = buildWsUrlCandidates(target.url);
      let attempt = 0;

      const connect = () => {
        const candidate = wsCandidates[Math.min(attempt, wsCandidates.length - 1)];
        if (!candidate) {
          setStreamState("error");
          setStreamError("No WebSocket URL candidates available");
          return;
        }
        const ws = new WebSocket(candidate);
        wsRef.current = ws;

        let msgId = 0;
        const nextId = () => String(++msgId);
        let handshakeDone = false;
        let handshakeSent = false;

        const sendHandshake = () => {
          if (handshakeSent) return;
          handshakeSent = true;
          ws.send(JSON.stringify({
            type: "req",
            id: nextId(),
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "edwinpai-macos",
                displayName: "EdwinPAI Desktop (Approvals)",
                version: APP_VERSION,
                platform: "desktop",
                mode: "ui",
              },
              role: "operator",
              scopes: ["operator.admin", "operator.approvals"],
              auth: token ? { token } : undefined,
            },
          }));
        };

        ws.addEventListener("open", () => {
          // Wait for connect.challenge; fallback to direct after 2s
          setTimeout(() => {
            if (!handshakeSent) sendHandshake();
          }, 2000);
        });

        ws.addEventListener("message", (event) => {
          try {
            const frame = JSON.parse(event.data as string);

            // Handle connect.challenge
            if (frame.type === "event" && frame.event === "connect.challenge" && !handshakeSent) {
              sendHandshake();
              return;
            }

            if (frame.type === "res" && !handshakeDone) {
              if (frame.ok) {
                handshakeDone = true;
                setStreamState("connected");
              } else if (!frame.ok) {
                setStreamError(frame.error?.message ?? "Handshake failed");
              }
              return;
            }

            if (frame.type === "event") {
              // Existing exec approval events
              if (frame.event === "exec.approval.requested" && frame.payload) {
                const payload = frame.payload as ExecApprovalRequest;
                setPendingRequests((prev) => {
                  if (prev.some((entry) => entry.id === payload.id)) return prev;
                  return [...prev, payload].sort((a, b) => a.createdAtMs - b.createdAtMs);
                });
              }
              if (frame.event === "exec.approval.resolved" && frame.payload) {
                const payload = frame.payload as { id: string };
                setPendingRequests((prev) => prev.filter((entry) => entry.id !== payload.id));
              }

              // New tool invoke approval events
              if (frame.event === "tool_invoke_approval" && frame.payload) {
                const payload = frame.payload as ToolInvokeApprovalRequest;
                setPendingToolInvokes((prev) => {
                  if (prev.some((entry) => entry.id === payload.id)) return prev;
                  return [...prev, payload].sort((a, b) => a.createdAtMs - b.createdAtMs);
                });
              }
              if (frame.event === "tool_invoke_approval.resolved" && frame.payload) {
                const payload = frame.payload as { id: string };
                setPendingToolInvokes((prev) => prev.filter((entry) => entry.id !== payload.id));
              }

              // Credential vault events
              if (frame.event === "credential.requested" && frame.payload) {
                const payload = frame.payload as CredentialRequest;
                setPendingCredentials((prev) => {
                  if (prev.some((entry) => entry.id === payload.id)) return prev;
                  return [...prev, payload].sort((a, b) => a.createdAtMs - b.createdAtMs);
                });
              }
              if (frame.event === "credential.resolved" && frame.payload) {
                const payload = frame.payload as { id: string };
                setPendingCredentials((prev) => prev.filter((entry) => entry.id !== payload.id));
                setCredentialInputs((prev) => withoutKey(prev, payload.id));
              }
            }
          } catch (err) {
            console.error("Failed to parse exec approvals frame:", err);
          }
        });

        const retry = () => {
          if (attempt < wsCandidates.length - 1) {
            attempt += 1;
            try { ws.close(); } catch {
              // Ignore close failures before retrying.
            }
            connect();
            return true;
          }
          return false;
        };

        ws.addEventListener("error", () => {
          if (ws.readyState !== WebSocket.OPEN && retry()) return;
          setStreamState("error");
          setStreamError("WebSocket connection failed");
        });

        ws.addEventListener("close", () => {
          setStreamState("disconnected");
        });
      };

      connect();
    } catch (err) {
      setStreamState("error");
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }, [buildTarget]);

  const handleDecision = useCallback(async (id: string, decision: "allow-once" | "allow-always" | "deny") => {
    try {
      const target = await buildTarget();
      await resolveExecApproval(target, id, decision);
      setPendingRequests((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }, [buildTarget]);

  const handleToolInvokeDecision = useCallback(async (req: ToolInvokeApprovalRequest, decision: "approve" | "deny") => {
    try {
      const target = await buildTarget();
      let signedEnvelope: Record<string, unknown> | undefined;

      if (decision === "approve") {
        // Sign the approval with BSV key from OS Keychain
        try {
          const payload = JSON.stringify({
            id: req.id,
            tool: req.tool,
            action: req.action,
            args: req.args,
            decision: "approve",
            approvedAtMs: Date.now(),
          });
          const result = await invoke<{
            payload: string;
            envelope: {
              kid: string;
              alg: string;
              iat: number;
              exp: number;
              nonce: string;
              payload_hash: string;
              sig: string;
              pub_key: string;
            };
          }>("sign_request", { payload });
          signedEnvelope = result.envelope as unknown as Record<string, unknown>;
        } catch (err) {
          console.warn("BSV signing failed, sending unsigned approval:", err);
          // Fall through — gateway can accept unsigned from local trusted connections
        }
      }

      await resolveToolInvokeApproval(target, req.id, decision, signedEnvelope);
      setPendingToolInvokes((prev) => prev.filter((entry) => entry.id !== req.id));
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }, [buildTarget]);

  const [rememberFlags, setRememberFlags] = useState<Record<string, boolean>>({});

  // Auto-fill or auto-approve credentials from vault when a request arrives
  const autoApprovedRef = useRef(new Set<string>());

  useEffect(() => {
    (async () => {
      const vaultPolicy = await loadVaultPolicy(profileId);
      for (const req of pendingCredentials) {
        if (autoApprovedRef.current.has(req.id)) continue;
        if (credentialInputs[req.id] !== undefined) continue;

        const { ask, maxLeaseMs } = getRuleForCredential(vaultPolicy, req.credentialId);

        // Check if we should auto-grant
        if (ask === "auto-grant" || ask === "first-time") {
          try {
            const vaultValue = await invoke<string | null>("vault_get", { profileId, id: req.credentialId });
            if (vaultValue) {
              autoApprovedRef.current.add(req.id);
              // Auto-resolve without UI
              const target = await buildTarget();
              const leaseMs = maxLeaseMs ? Math.min(req.leaseDurationMs, maxLeaseMs) : req.leaseDurationMs;
              await resolveCredential(target, req.id, "granted", vaultValue, leaseMs);
              setPendingCredentials((prev) => prev.filter((e) => e.id !== req.id));
              console.log(`[Vault] Auto-granted ${req.credentialId} (policy: ${ask})`);
              continue;
            }
          } catch {
            // Fall through to manual
          }
        }

        if (ask === "deny") {
          autoApprovedRef.current.add(req.id);
          try {
            const target = await buildTarget();
            await resolveCredential(target, req.id, "denied");
            setPendingCredentials((prev) => prev.filter((e) => e.id !== req.id));
          } catch {
            // Ignore auto-deny delivery failures; manual handling remains available.
          }
          continue;
        }

        // Manual mode — auto-fill from vault if available
        try {
          const vaultValue = await invoke<string | null>("vault_get", { profileId, id: req.credentialId });
          if (vaultValue) {
            setCredentialInputs((prev) => ({ ...prev, [req.id]: vaultValue }));
            setRememberFlags((prev) => ({ ...prev, [req.id]: true }));
          }
        } catch {
          // Vault lookup is best-effort.
        }
      }
    })();
  }, [pendingCredentials, credentialInputs, buildTarget]);

  const handleCredentialDecision = useCallback(async (req: CredentialRequest, decision: "granted" | "denied") => {
    try {
      const target = await buildTarget();
      const credentialValue = decision === "granted" ? credentialInputs[req.id]?.trim() : undefined;

      if (decision === "granted" && !credentialValue) {
        setStreamError("Enter a credential value before granting.");
        return;
      }

      // Save to vault if "Remember" is checked
      if (decision === "granted" && credentialValue && rememberFlags[req.id]) {
        try {
          await invoke("vault_store", {
            profileId,
            id: req.credentialId,
            name: req.name,
            entryType: "api_key",
            provider: req.requester,
            credential: credentialValue,
          });
        } catch (err) {
          console.warn("Failed to save to vault:", err);
        }
      }

      let signedEnvelope: Record<string, unknown> | undefined;
      try {
        const payload = JSON.stringify({
          requestId: req.id,
          credentialId: req.credentialId,
          decision,
          grantedAtMs: Date.now(),
        });
        const result = await invoke<{
          payload: string;
          envelope: Record<string, unknown>;
        }>("sign_request", { payload });
        signedEnvelope = result.envelope as unknown as Record<string, unknown>;
      } catch {
        // BSV signing best-effort
      }

      await resolveCredential(target, req.id, decision, credentialValue, req.leaseDurationMs, signedEnvelope);
      setPendingCredentials((prev) => prev.filter((entry) => entry.id !== req.id));
      setCredentialInputs((prev) => withoutKey(prev, req.id));
      setRememberFlags((prev) => withoutKey(prev, req.id));
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }, [buildTarget, credentialInputs, rememberFlags]);

  // Auto-expire credential requests
  useEffect(() => {
    if (pendingCredentials.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setPendingCredentials((prev) => prev.filter((req) => req.expiresAtMs > now));
    }, 5000);
    return () => clearInterval(interval);
  }, [pendingCredentials.length]);

  useEffect(() => {
    if (targetKind === "node") {
      loadNodes();
    }
  }, [targetKind, loadNodes]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  useEffect(() => {
    connectStream();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectStream]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Exec approvals</h2>
        <p className="text-sm text-muted-foreground">
          Manage exec approval policy and review pending exec requests.
        </p>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Target</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Select value={targetKind} onValueChange={(value) => setTargetKind(value as TargetKind)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gateway">Gateway</SelectItem>
                    <SelectItem value="node">Node</SelectItem>
                  </SelectContent>
                </Select>

                {targetKind === "node" && (
                  <Select value={selectedNodeId} onValueChange={setSelectedNodeId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select node" />
                    </SelectTrigger>
                    <SelectContent>
                      {nodes.map((node) => (
                        <SelectItem key={node.nodeId} value={node.nodeId}>
                          {node.displayName ?? node.nodeId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button variant="outline" onClick={loadPolicy} disabled={policyLoading}>
                  {policyLoading ? "Loading..." : "Load policy"}
                </Button>
                <Button onClick={savePolicy} disabled={policyLoading}>
                  {policyLoading ? "Saving..." : "Save policy"}
                </Button>
                <Button variant="ghost" onClick={formatPolicy}>
                  Format JSON
                </Button>
              </div>

              {policyError && (
                <Alert className="text-sm text-destructive border-destructive/30">{policyError}</Alert>
              )}
              {saveStatus && (
                <Alert className="text-sm text-muted-foreground">{saveStatus}</Alert>
              )}

              <div className="text-xs text-muted-foreground">
                {snapshot ? (
                  <div>
                    <div>Path: {snapshot.path}</div>
                    <div>Hash: {snapshot.hash}</div>
                    <div>Exists: {snapshot.exists ? "Yes" : "No"}</div>
                    <div>Target: {targetLabel}</div>
                  </div>
                ) : (
                  "Policy snapshot not loaded yet."
                )}
              </div>

              <Textarea
                className="min-h-[320px] font-mono text-xs"
                value={policyText}
                onChange={(event) => setPolicyText(event.target.value)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pending requests</span>
                <Badge variant={streamState === "connected" ? "default" : "secondary"}>
                  {streamState === "connected" ? "Live" : streamState}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {streamError && (
                <Alert className="text-sm text-destructive border-destructive/30">{streamError}</Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={connectStream}>
                  Reconnect
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPendingRequests([]); setPendingToolInvokes([]); setPendingCredentials([]); }}
                >
                  Clear
                </Button>
              </div>

              {/* Credential Requests */}
              {pendingCredentials.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credential Requests</div>
                  {pendingCredentials.map((req) => (
                    <Card key={req.id} className="border-yellow-500/30">
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔑</span>
                          <span className="font-medium">{req.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Purpose: {req.purpose}</div>
                          <div>Requester: {req.requester}</div>
                          <div>Lease: {Math.round(req.leaseDurationMs / 60000)} min</div>
                          <div>Expires: {new Date(req.expiresAtMs).toLocaleTimeString()}</div>
                        </div>
                        <Input
                          type="password"
                          placeholder={`Enter ${req.name}...`}
                          value={credentialInputs[req.id] ?? ""}
                          onChange={(e) =>
                            setCredentialInputs((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          autoFocus
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={rememberFlags[req.id] ?? false}
                            onChange={(e) =>
                              setRememberFlags((prev) => ({ ...prev, [req.id]: e.target.checked }))
                            }
                            className="rounded"
                          />
                          Remember in vault (encrypted, OS Keychain)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => handleCredentialDecision(req, "granted")}>
                            Grant
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleCredentialDecision(req, "denied")}>
                            Deny
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Tool Invoke Approvals */}
              {pendingToolInvokes.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tool Invocations</div>
                  {pendingToolInvokes.map((req) => (
                    <Card key={req.id} className="border-primary/30">
                      <CardContent className="space-y-2 pt-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">{req.tool}</Badge>
                          {req.action && <Badge variant="secondary" className="font-mono">{req.action}</Badge>}
                        </div>
                        <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto max-h-32">
                          {JSON.stringify(req.args, null, 2)}
                        </pre>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {req.sessionKey && <div>Session: {req.sessionKey}</div>}
                          {req.agentId && <div>Agent: {req.agentId}</div>}
                          {req.requestingClient && <div>Client: {req.requestingClient}</div>}
                          <div>Expires: {new Date(req.expiresAtMs).toLocaleTimeString()}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => handleToolInvokeDecision(req, "approve")}>
                            Approve (sign)
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleToolInvokeDecision(req, "deny")}>
                            Deny
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Exec Approvals */}
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  {pendingToolInvokes.length > 0 && (
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exec Approvals</div>
                  )}
                  {pendingRequests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="space-y-2 pt-4">
                        <div className="text-sm font-medium">{request.request.command}</div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {request.request.cwd && <div>CWD: {request.request.cwd}</div>}
                          {request.request.host && <div>Host: {request.request.host}</div>}
                          {request.request.agentId && <div>Agent: {request.request.agentId}</div>}
                          {request.request.resolvedPath && <div>Resolved: {request.request.resolvedPath}</div>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => handleDecision(request.id, "allow-once")}>
                            Allow once
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDecision(request.id, "allow-always")}>
                            Always allow
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDecision(request.id, "deny")}>
                            Deny
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {pendingRequests.length === 0 && pendingToolInvokes.length === 0 && pendingCredentials.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No pending approvals. Requests appear here for credential access, tool invocations, and exec approvals.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
