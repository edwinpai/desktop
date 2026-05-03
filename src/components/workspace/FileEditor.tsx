import { useCallback, useState } from "react";
import { RefreshCw, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface FileEditorProps {
  request?: (
    method: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
}

function toUserFacingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("Cannot read properties of undefined (reading 'invoke')") ||
    msg.includes("Failed to initialize configuration")
  ) {
    return "Desktop integration is unavailable right now. Please reopen this screen inside the desktop app.";
  }
  if (
    msg.includes("unknown method") ||
    msg.includes("not found") ||
    msg.includes("does not exist")
  ) {
    return "Workspace browsing is not available from this gateway yet.";
  }
  return msg;
}

export function FileEditor({ request }: FileEditorProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!request) {
        setFiles([]);
        return;
      }
      const result = await request("workspace.listFiles", {});
      if (Array.isArray(result)) {
        setFiles(result as FileNode[]);
      } else {
        setFiles([]);
      }
    } catch (err) {
      setFiles([]);
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  }, [request]);

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            Workspace
          </h2>
          <p className="text-sm text-muted-foreground">
            Browse and edit workspace files once the desktop app is connected to
            a gateway that exposes workspace file APIs.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {files.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace Files</CardTitle>
            <CardDescription>
              Workspace file browsing is connected. File editing UI can be
              expanded once the underlying gateway methods are finalized.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {files.length} workspace entries returned.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No workspace files available</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Workspace files will appear here once the desktop app can reach a
              gateway with real workspace file methods.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
