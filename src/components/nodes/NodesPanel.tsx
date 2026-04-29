import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfig } from "@/hooks/useConfig";
import { buildGatewayTarget, invokeNodesTool, type NodeListNode, type NodeStatusReport, type PairingReport } from "@/lib/nodes";

const formatAge = (msAgo: number) => {
  const s = Math.max(0, Math.floor(msAgo / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};

export function NodesPanel() {
  const { config, loading: configLoading } = useConfig();
  const target = useMemo(() => buildGatewayTarget(config), [config]);

  const [nodes, setNodes] = useState<NodeListNode[]>([]);
  const [pending, setPending] = useState<PairingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notifyDrafts, setNotifyDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const [actionResult, setActionResult] = useState<Record<string, string>>({});

  const loadNodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const status = (await invokeNodesTool(target, "status")) as NodeStatusReport;
      const pairing = (await invokeNodesTool(target, "pending")) as PairingReport;
      setNodes(status?.nodes ?? []);
      setPending(pairing ?? { pending: [], paired: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (configLoading) return;
    void loadNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoading, target.url, target.token]);

  const handlePairDecision = async (requestId: string, approve: boolean) => {
    setBusyKey(requestId);
    setError(null);
    try {
      await invokeNodesTool(target, approve ? "approve" : "reject", { requestId });
      await loadNodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  };

  const handleAction = async (node: NodeListNode, action: "notify" | "location_get" | "camera_snap" | "screen_record") => {
    setBusyKey(node.nodeId);
    setError(null);
    try {
      let result: unknown = null;
      if (action === "notify") {
        const draft = notifyDrafts[node.nodeId] ?? { title: "Ping", body: "" };
        result = await invokeNodesTool(target, "notify", {
          node: node.nodeId,
          title: draft.title,
          body: draft.body,
        });
      } else if (action === "location_get") {
        result = await invokeNodesTool(target, "location_get", { node: node.nodeId });
      } else if (action === "camera_snap") {
        result = await invokeNodesTool(target, "camera_snap", { node: node.nodeId, facing: "front" }, 45000);
      } else if (action === "screen_record") {
        result = await invokeNodesTool(target, "screen_record", { node: node.nodeId, durationMs: 5000 }, 60000);
      }
      setActionResult((prev) => ({ ...prev, [node.nodeId]: JSON.stringify(result, null, 2) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  };

  if (configLoading) {
    return <div className="p-6 text-muted-foreground">Loading gateway config...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Nodes</h2>
          <p className="text-sm text-muted-foreground">Paired devices and node capabilities.</p>
        </div>
        <Button variant="outline" onClick={loadNodes} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {pending?.pending?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Pairing requests</CardTitle>
            <CardDescription>Approve or reject pending node pairings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.pending.map((req) => (
              <div key={req.requestId} className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{req.displayName ?? req.nodeId}</div>
                  <div className="text-xs text-muted-foreground">
                    {req.platform ?? "Unknown"} • {req.remoteIp ?? ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handlePairDecision(req.requestId, false)}
                    disabled={busyKey === req.requestId}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handlePairDecision(req.requestId, true)}
                    disabled={busyKey === req.requestId}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {nodes.length ? (
          nodes.map((node) => {
            const lastSeenMs = node.connectedAtMs ? Date.now() - node.connectedAtMs : null;
            const commands = node.commands ?? [];
            const canCamera = commands.includes("camera.snap");
            const canScreen = commands.includes("screen.record");
            const canLocation = commands.includes("location.get");

            return (
              <Card key={node.nodeId}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {node.displayName ?? node.nodeId}
                        {node.connected ? (
                          <Badge variant="secondary">Online</Badge>
                        ) : (
                          <Badge variant="outline">Offline</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {node.platform ?? "Unknown"}
                        {node.deviceFamily ? ` • ${node.deviceFamily}` : ""}
                        {node.remoteIp ? ` • ${node.remoteIp}` : ""}
                      </CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lastSeenMs !== null ? `Last seen ${formatAge(lastSeenMs)} ago` : ""}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {node.version && <Badge variant="outline">Node {node.version}</Badge>}
                    {node.coreVersion && <Badge variant="outline">Core {node.coreVersion}</Badge>}
                    {node.uiVersion && <Badge variant="outline">UI {node.uiVersion}</Badge>}
                    {node.modelIdentifier && <Badge variant="outline">{node.modelIdentifier}</Badge>}
                  </div>

                  {commands.length > 0 && (
                    <div className="text-sm">
                      <div className="text-xs uppercase text-muted-foreground">Commands</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {commands.map((cmd) => (
                          <Badge key={cmd} variant="secondary">
                            {cmd}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-border" />

                  <div className="space-y-2">
                    <Label>Notify</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        placeholder="Title"
                        value={notifyDrafts[node.nodeId]?.title ?? "Ping"}
                        onChange={(e) =>
                          setNotifyDrafts((prev) => ({
                            ...prev,
                            [node.nodeId]: {
                              title: e.target.value,
                              body: prev[node.nodeId]?.body ?? "",
                            },
                          }))
                        }
                      />
                      <Input
                        placeholder="Body"
                        value={notifyDrafts[node.nodeId]?.body ?? ""}
                        onChange={(e) =>
                          setNotifyDrafts((prev) => ({
                            ...prev,
                            [node.nodeId]: {
                              title: prev[node.nodeId]?.title ?? "Ping",
                              body: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleAction(node, "notify")}
                        disabled={busyKey === node.nodeId}
                      >
                        Send notification
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleAction(node, "location_get")}
                        disabled={!canLocation || busyKey === node.nodeId}
                      >
                        Get location
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleAction(node, "camera_snap")}
                        disabled={!canCamera || busyKey === node.nodeId}
                      >
                        Camera snap
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleAction(node, "screen_record")}
                        disabled={!canScreen || busyKey === node.nodeId}
                      >
                        Screen record
                      </Button>
                    </div>
                  </div>

                  {actionResult[node.nodeId] && (
                    <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded-md">
                      {actionResult[node.nodeId]}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No nodes found</CardTitle>
              <CardDescription>Pair a node to see it here.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
