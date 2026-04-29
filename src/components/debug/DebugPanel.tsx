import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Terminal, Send, Trash2, Clock } from "lucide-react";

interface HistoryEntry {
  id: number;
  method: string;
  params: Record<string, unknown>;
  result: unknown;
  error: string | null;
  timestamp: number;
}

interface DebugPanelProps {
  request?: (method: string, params: Record<string, unknown>) => Promise<unknown>;
}

let nextId = 1;

export function DebugPanel({ request }: DebugPanelProps) {
  const [method, setMethod] = useState("");
  const [params, setParams] = useState("{}");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const send = useCallback(async () => {
    if (!method.trim()) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(params);
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }

    setSending(true);
    const entry: HistoryEntry = {
      id: nextId++,
      method: method.trim(),
      params: parsed,
      result: null,
      error: null,
      timestamp: Date.now(),
    };

    try {
      if (request) {
        entry.result = await request(entry.method, parsed);
      } else {
        entry.error = "No request handler available. Connect to a gateway first.";
      }
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
    } finally {
      setSending(false);
      setHistory((prev) => [entry, ...prev].slice(0, 10));
    }
  }, [method, params, request]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const formatTime = (ts: number): string => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Terminal className="h-6 w-6" />
            Debug Console
          </h2>
          <p className="text-sm text-muted-foreground">
            Manually call gateway RPC methods.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">RPC Call</CardTitle>
          <CardDescription>
            Enter a method name and JSON parameters to send to the gateway.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rpc-method">Method</Label>
            <Input
              id="rpc-method"
              placeholder="e.g. system.status"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rpc-params">Parameters (JSON)</Label>
            <textarea
              id="rpc-params"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              placeholder="{}"
              value={params}
              onChange={(e) => {
                setParams(e.target.value);
                setParseError(null);
              }}
            />
            {parseError && (
              <p className="text-xs text-destructive">
                JSON parse error: {parseError}
              </p>
            )}
          </div>

          <Button onClick={send} disabled={sending || !method.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending..." : "Send"}
          </Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">History</h3>
            <Button variant="outline" size="sm" onClick={clearHistory}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>

          <div className="grid gap-3">
            {history.map((entry) => (
              <Card key={entry.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      {entry.method}
                      {entry.error ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.timestamp)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.keys(entry.params).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Params</p>
                      <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded-md font-mono">
                        {JSON.stringify(entry.params, null, 2)}
                      </pre>
                    </div>
                  )}

                  {entry.error ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Error</p>
                      <pre className="text-xs whitespace-pre-wrap bg-destructive/10 text-destructive p-3 rounded-md font-mono">
                        {entry.error}
                      </pre>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Response</p>
                      <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded-md font-mono">
                        {JSON.stringify(entry.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No calls yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Send an RPC call to see results here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
