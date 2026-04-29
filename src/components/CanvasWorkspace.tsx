import { useCallback, useEffect, useMemo, useState } from "react";
import { A2UIRenderer } from "@/components/A2UIRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getSessionCanvasDir } from "@/lib/canvas-paths";
import { buildGatewayTarget, invokeCanvasTool } from "@/lib/canvas";
import { invokeNodesTool, type NodeListNode, type NodeStatusReport } from "@/lib/nodes";
import { useConfig } from "@/hooks/useConfig";

interface CanvasWorkspaceProps {
  sessionKey: string;
  toolEvents?: Array<Record<string, unknown>>;
}

function findImageCandidate(value: unknown): string | null {
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) return value;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    if (value.startsWith("MEDIA:")) return value.replace(/^MEDIA:\s*/, "").trim();
    if (value.endsWith(".png") || value.endsWith(".jpg") || value.endsWith(".jpeg") || value.endsWith(".webp")) return value;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageCandidate(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["image", "imageUrl", "url", "path", "media", "screenshot", "snapshot", "outPath"]) {
      const found = findImageCandidate(obj[key]);
      if (found) return found;
    }
    for (const nested of Object.values(obj)) {
      const found = findImageCandidate(nested);
      if (found) return found;
    }
  }
  return null;
}

function supportsCanvas(node: NodeListNode): boolean {
  const commands = node.commands ?? [];
  return (node.caps ?? []).includes("canvas") || commands.some((command) => command.startsWith("canvas."));
}

function supportsCanvasCommand(node: NodeListNode | null, command: string): boolean {
  if (!node) return false;
  const commands = node.commands ?? [];
  if (commands.length === 0) {
    return supportsCanvas(node);
  }
  return commands.includes(command);
}

function toUserFacingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("Cannot read properties of undefined (reading 'invoke')") ||
    msg.includes("Failed to initialize configuration")
  ) {
    return "Desktop integration is unavailable right now. Please reopen this screen inside the desktop app.";
  }
  if (msg.includes("requires a signed request") || msg.includes("Missing authentication headers")) {
    return "Canvas controls could not be authorized. Reconnect the desktop to the gateway and try again.";
  }
  if (msg.includes("node not connected")) {
    return "The selected node is offline right now. Pick an online node or reconnect it.";
  }
  if (msg.includes("node command not allowed")) {
    return "This node does not currently allow that canvas command.";
  }
  if (msg.includes("unknown method") || msg.includes("not found") || msg.includes("does not exist")) {
    return "Canvas controls are not available from this gateway yet.";
  }
  return msg;
}

export function CanvasWorkspace({ sessionKey, toolEvents = [] }: CanvasWorkspaceProps) {
  const { config, loading: configLoading } = useConfig();
  const target = useMemo(() => buildGatewayTarget(config), [config]);
  const sessionCanvasDir = useMemo(() => getSessionCanvasDir(sessionKey), [sessionKey]);

  const [nodes, setNodes] = useState<NodeListNode[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [surfaceUrl, setSurfaceUrl] = useState("");
  const [navigateUrl, setNavigateUrl] = useState("https://example.com");
  const [javaScript, setJavaScript] = useState("document.title");
  const [jsonl, setJsonl] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [a2uiJsonl, setA2uiJsonl] = useState<string | null>(null);
  const [a2uiResetKey, setA2uiResetKey] = useState(0);
  const [showA2UIPreview, setShowA2UIPreview] = useState(false);

  const canvasNodes = useMemo(
    () => nodes.filter((node) => supportsCanvas(node)),
    [nodes],
  );

  const selectedNode = useMemo(
    () => canvasNodes.find((node) => node.nodeId === selectedNodeId) ?? null,
    [canvasNodes, selectedNodeId],
  );

  const loadNodes = useCallback(async () => {
    setNodesLoading(true);
    setError(null);
    try {
      const status = (await invokeNodesTool(target, "status")) as NodeStatusReport;
      const list = status?.nodes ?? [];
      setNodes(list);
      const nextCanvasNodes = list.filter((node) => supportsCanvas(node));
      if (nextCanvasNodes.length === 0) {
        setSelectedNodeId("");
      } else {
        const stillValid = nextCanvasNodes.some((node) => node.nodeId === selectedNodeId);
        if (!stillValid) {
          const preferred = nextCanvasNodes.find((node) => node.connected) ?? nextCanvasNodes[0];
          setSelectedNodeId(preferred?.nodeId ?? "");
        }
      }
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setNodesLoading(false);
    }
  }, [selectedNodeId, target]);

  useEffect(() => {
    if (configLoading) return;
    void loadNodes();
  }, [configLoading, loadNodes]);

  useEffect(() => {
    if (!toolEvents.length) return;
    const event = toolEvents[0] as Record<string, unknown>;
    const toolName = event.toolName as string | undefined;
    const phase = event.phase as string | undefined;
    const data = event.data as Record<string, unknown> | undefined;

    if (toolName !== "canvas" || phase !== "end" || !data) return;

    const actionName = data.action as string | undefined;
    if (actionName === "snapshot") {
      const candidate = findImageCandidate(data.output ?? data.result ?? data);
      if (candidate) {
        setLastSnapshot(candidate);
      }
    } else if (actionName === "a2ui_push") {
      const eventJsonl = data.jsonl as string | undefined;
      if (eventJsonl) {
        setJsonl(eventJsonl);
        setA2uiJsonl(eventJsonl);
        setShowA2UIPreview(true);
      }
    } else if (actionName === "a2ui_reset") {
      setA2uiResetKey((key) => key + 1);
    }
  }, [toolEvents]);

  const handleA2UIUserAction = useCallback((userAction: Record<string, unknown>) => {
    setResult((prev: unknown) => ({
      ...(typeof prev === "object" && prev ? (prev as Record<string, unknown>) : {}),
      lastUserAction: userAction,
    }));
  }, []);

  const runCanvasAction = useCallback(async (
    action: "present" | "hide" | "navigate" | "snapshot" | "eval" | "a2ui_push" | "a2ui_reset",
    params: Record<string, unknown> = {},
  ) => {
    if (!selectedNodeId) {
      setError("Select a canvas-capable node first.");
      return;
    }

    setBusyAction(action);
    setError(null);
    try {
      const res = await invokeCanvasTool(target, action, { node: selectedNodeId, ...params }, 60_000);
      setResult(res);
      const candidate = findImageCandidate(res);
      if (candidate) {
        setLastSnapshot(candidate);
      }
      if (action === "a2ui_push" && typeof params.jsonl === "string") {
        setA2uiJsonl(params.jsonl);
        setShowA2UIPreview(true);
      }
      if (action === "a2ui_reset") {
        setA2uiResetKey((key) => key + 1);
      }
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setBusyAction(null);
    }
  }, [selectedNodeId, target]);

  const previewA2UI = useCallback(() => {
    setA2uiJsonl(jsonl);
    setShowA2UIPreview(true);
    setResult({ action: "a2ui_preview", local: true, jsonlLength: jsonl.length });
  }, [jsonl]);

  const resetLocalPreview = useCallback(() => {
    setA2uiResetKey((key) => key + 1);
    setResult({ action: "a2ui_reset", local: true });
  }, []);

  const canControlSelectedNode = Boolean(selectedNodeId && selectedNode?.connected);
  const canPresent = supportsCanvasCommand(selectedNode, "canvas.present");
  const canNavigate = supportsCanvasCommand(selectedNode, "canvas.navigate");
  const canSnapshot = supportsCanvasCommand(selectedNode, "canvas.snapshot");
  const canEval = supportsCanvasCommand(selectedNode, "canvas.eval");
  const canPushA2UI = supportsCanvasCommand(selectedNode, "canvas.a2ui.pushJSONL");
  const canResetA2UI = supportsCanvasCommand(selectedNode, "canvas.a2ui.reset");

  if (configLoading) {
    return <div className="p-6 text-muted-foreground">Loading gateway config...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Canvas</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Render and inspect visual surfaces on paired nodes. Use Canvas to preview A2UI,
            open a node surface, navigate it, run small checks, and capture snapshots.
          </p>
        </div>
        <Button variant="outline" onClick={loadNodes} disabled={nodesLoading}>
          {nodesLoading ? "Refreshing…" : "Refresh nodes"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>What Canvas is good for</CardTitle>
            <CardDescription>
              This is a visual surface controller, not a drawing pad.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Preview A2UI interfaces locally before pushing them to a device.</p>
            <p>• Open or navigate a live surface on a paired node.</p>
            <p>• Capture snapshots to verify what the node is actually showing.</p>
            <p>• Run lightweight JavaScript checks against the current surface when debugging.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Canvas target</CardTitle>
            <CardDescription>
              Pick the node whose visual surface you want to control.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canvasNodes.length > 0 ? (
              <>
                <div className="space-y-1">
                  <Label>Node</Label>
                  <Select value={selectedNodeId} onValueChange={setSelectedNodeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select node" />
                    </SelectTrigger>
                    <SelectContent>
                      {canvasNodes.map((node) => (
                        <SelectItem key={node.nodeId} value={node.nodeId}>
                          {node.displayName ?? node.nodeId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedNode && (
                  <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{selectedNode.displayName ?? selectedNode.nodeId}</span>
                      {selectedNode.connected ? (
                        <Badge variant="secondary">Online</Badge>
                      ) : (
                        <Badge variant="outline">Offline</Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {selectedNode.platform ?? "Unknown platform"}
                      {selectedNode.remoteIp ? ` · ${selectedNode.remoteIp}` : ""}
                    </div>
                    {!selectedNode.connected && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        This node is known but not currently connected, so live Canvas actions will fail until it reconnects.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No canvas-capable node is connected right now. Pair a device with canvas support first, then come back here.
              </div>
            )}

            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              <div><strong>Session canvas directory:</strong> {sessionCanvasDir}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="control" className="space-y-4">
        <TabsList>
          <TabsTrigger value="control">Control surface</TabsTrigger>
          <TabsTrigger value="a2ui">A2UI preview</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Open or control the selected surface</CardTitle>
              <CardDescription>
                These actions talk to the selected node over the signed gateway control path.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Open surface with optional starting URL</Label>
                  <Input
                    placeholder="Leave blank to just show the surface"
                    value={surfaceUrl}
                    onChange={(event) => setSurfaceUrl(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void runCanvasAction("present", surfaceUrl.trim() ? { target: surfaceUrl.trim() } : {})}
                      disabled={!canControlSelectedNode || !canPresent || busyAction !== null}
                    >
                      {busyAction === "present" ? "Opening…" : "Open surface"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void runCanvasAction("hide")}
                      disabled={!canControlSelectedNode || !canPresent || busyAction !== null}
                    >
                      {busyAction === "hide" ? "Hiding…" : "Hide surface"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Navigate current surface</Label>
                  <Input value={navigateUrl} onChange={(event) => setNavigateUrl(event.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void runCanvasAction("navigate", { url: navigateUrl })}
                      disabled={!canControlSelectedNode || !canNavigate || busyAction !== null}
                    >
                      {busyAction === "navigate" ? "Navigating…" : "Navigate"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void runCanvasAction("snapshot", { outputFormat: "png" })}
                      disabled={!canControlSelectedNode || !canSnapshot || busyAction !== null}
                    >
                      {busyAction === "snapshot" ? "Capturing…" : "Take snapshot"}
                    </Button>
                  </div>
                </div>
              </div>

              {!canControlSelectedNode && canvasNodes.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Pick an online canvas-capable node to enable live control.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="a2ui" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>A2UI preview</CardTitle>
              <CardDescription>
                Preview JSONL locally, then push it to the selected node when you are happy with it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>A2UI JSONL</Label>
                <Textarea
                  rows={8}
                  placeholder="Paste A2UI JSONL here"
                  value={jsonl}
                  onChange={(event) => setJsonl(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={previewA2UI} disabled={!jsonl.trim()}>
                  Preview locally
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void runCanvasAction("a2ui_push", { jsonl })}
                  disabled={!jsonl.trim() || !canControlSelectedNode || !canPushA2UI || busyAction !== null}
                >
                  {busyAction === "a2ui_push" ? "Sending…" : "Send to selected node"}
                </Button>
                <Button variant="outline" onClick={resetLocalPreview}>
                  Reset local preview
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void runCanvasAction("a2ui_reset")}
                  disabled={!canControlSelectedNode || !canResetA2UI || busyAction !== null}
                >
                  {busyAction === "a2ui_reset" ? "Resetting…" : "Reset selected node"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {showA2UIPreview && (
            <Card>
              <CardHeader>
                <CardTitle>Local preview</CardTitle>
                <CardDescription>
                  This preview is local to the desktop tab. Use “Send to selected node” to mirror it onto a device surface.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded border bg-white" style={{ height: 420 }}>
                  <A2UIRenderer
                    jsonl={a2uiJsonl}
                    resetKey={a2uiResetKey}
                    onUserAction={handleA2UIUserAction}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced checks</CardTitle>
              <CardDescription>
                Useful when you need to inspect the current node surface or quickly debug what is loaded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>JavaScript</Label>
                <Textarea value={javaScript} onChange={(event) => setJavaScript(event.target.value)} rows={5} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void runCanvasAction("eval", { javaScript })}
                  disabled={!canControlSelectedNode || !canEval || busyAction !== null}
                >
                  {busyAction === "eval" ? "Running…" : "Run on selected node"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void runCanvasAction("snapshot", { outputFormat: "png" })}
                  disabled={!canControlSelectedNode || !canSnapshot || busyAction !== null}
                >
                  Capture fresh snapshot
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {lastSnapshot && (
        <Card>
          <CardHeader>
            <CardTitle>Latest snapshot</CardTitle>
            <CardDescription>
              The most recent image returned from a canvas snapshot action.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <img src={lastSnapshot} alt="Latest canvas snapshot" className="max-h-[32rem] rounded border" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Last result</CardTitle>
          <CardDescription>
            Raw result from the most recent action. Helpful when you are debugging node behavior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-72 overflow-auto rounded border bg-muted/40 p-3 text-xs">
            {result ? JSON.stringify(result, null, 2) : "No result yet."}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
