import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildGatewayTarget, invokeCanvasTool, type CanvasAction } from "@/lib/canvas";
import { StyledSelect } from "@/components/ui/styled-select";

interface CanvasToolsCardProps {
  gatewayUrl?: string;
  gatewayToken?: string;
}

const ACTIONS: CanvasAction[] = ["present", "hide", "navigate", "eval", "snapshot", "a2ui_push", "a2ui_reset"];

function toUserFacingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("Cannot read properties of undefined (reading 'invoke')") ||
    msg.includes("Failed to initialize configuration")
  ) {
    return "Desktop integration is unavailable right now. Please reopen this screen inside the desktop app.";
  }
  if (msg.includes("unknown method") || msg.includes("not found") || msg.includes("does not exist")) {
    return "Canvas controls are not available from this gateway yet.";
  }
  return msg;
}

function findImageCandidate(value: unknown): string | null {
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) return value;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    if (value.startsWith("MEDIA:")) return value.replace(/^MEDIA:\s*/, "").trim();
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
    for (const key of ["image", "imageUrl", "url", "path", "media", "screenshot", "snapshot"]) {
      const found = findImageCandidate(obj[key]);
      if (found) return found;
    }
    for (const v of Object.values(obj)) {
      const found = findImageCandidate(v);
      if (found) return found;
    }
  }

  return null;
}

export function CanvasToolsCard({ gatewayUrl, gatewayToken }: CanvasToolsCardProps) {
  const [action, setAction] = useState<CanvasAction>("present");
  const [target, setTarget] = useState<"host" | "sandbox" | "node">("host");
  const [url, setUrl] = useState("https://example.com");
  const [javaScript, setJavaScript] = useState("document.title");
  const [jsonl, setJsonl] = useState('{"type":"click","x":100,"y":100}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const imageUrl = useMemo(() => findImageCandidate(result), [result]);

  const onRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const gw = buildGatewayTarget({ gatewayUrl, gatewayToken });
      const args: Record<string, unknown> = { target };

      if (action === "navigate") args.url = url;
      if (action === "eval") args.javaScript = javaScript;
      if (action === "snapshot") args.outputFormat = "png";
      if (action === "a2ui_push") args.jsonl = jsonl;

      const res = await invokeCanvasTool(gw, action, args, 60000);
      setResult(res);
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Canvas Tools</CardTitle>
        <CardDescription>
          Cross-platform canvas controls (show/hide, navigate, eval JS, snapshot, A2UI).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Action</Label>
            <StyledSelect
              className="h-9 pr-8"
              value={action}
              onChange={(e) => setAction(e.target.value as CanvasAction)}
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </StyledSelect>
          </div>

          <div className="space-y-1">
            <Label>Target</Label>
            <StyledSelect
              className="h-9 pr-8"
              value={target}
              onChange={(e) => setTarget(e.target.value as "host" | "sandbox" | "node")}
            >
              <option value="host">host</option>
              <option value="sandbox">sandbox</option>
              <option value="node">node</option>
            </StyledSelect>
          </div>
        </div>

        {action === "navigate" && (
          <div className="space-y-1">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
        )}

        {action === "eval" && (
          <div className="space-y-1">
            <Label>JavaScript</Label>
            <Textarea value={javaScript} onChange={(e) => setJavaScript(e.target.value)} rows={4} />
          </div>
        )}

        {action === "a2ui_push" && (
          <div className="space-y-1">
            <Label>A2UI JSONL</Label>
            <Textarea value={jsonl} onChange={(e) => setJsonl(e.target.value)} rows={4} />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={onRun} disabled={loading}>
            {loading ? "Running…" : "Run"}
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>

        {imageUrl && (
          <div className="space-y-2">
            <Label>Snapshot preview</Label>
            <img src={imageUrl} alt="Canvas snapshot" className="max-h-72 rounded border" />
          </div>
        )}

        <div className="space-y-1">
          <Label>Result</Label>
          <pre className="max-h-64 overflow-auto rounded border bg-muted/40 p-2 text-xs">
            {result ? JSON.stringify(result, null, 2) : "No result yet."}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
