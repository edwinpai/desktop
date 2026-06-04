import { useCallback, useState } from "react";
import { RefreshCw, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkspaceProfile } from "@/types/config";
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
    opts?: { reportErrors?: boolean },
  ) => Promise<unknown>;
  workspaces?: WorkspaceProfile[];
  activeWorkspaceId?: string;
  onSelectWorkspace?: (workspaceId: string) => void;
  onAddWorkspace?: (workspace: WorkspaceProfile) => void;
}

function slugifyWorkspaceId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
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

export function FileEditor({
  request,
  workspaces = [],
  activeWorkspaceId = "main",
  onSelectWorkspace,
  onAddWorkspace,
}: FileEditorProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!request) {
        setFiles([]);
        return;
      }
      const result = await request("workspace.listFiles", {}, { reportErrors: false });
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
            Workspaces
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


      <Card>
        <CardHeader>
          <CardTitle>Workspace Contexts</CardTitle>
          <CardDescription>
            Choose which workspace is injected into chat and where workspace
            memory/files are added. Sessions created while a workspace is
            selected are scoped to that workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => onSelectWorkspace?.(workspace.id)}
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  workspace.id === activeWorkspaceId
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{workspace.name}</span>
                  {workspace.id === activeWorkspaceId && (
                    <span className="text-xs text-primary">Active</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {workspace.path}
                </div>
                {workspace.description && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {workspace.description}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] items-end border-t pt-4">
            <div className="space-y-1">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Division Reports"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="workspace-path">Path</Label>
              <Input
                id="workspace-path"
                value={newPath}
                onChange={(event) => setNewPath(event.target.value)}
                placeholder="~/.edwinpai/workspaces/division-reports"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                const name = newName.trim();
                const path = newPath.trim();
                if (!name || !path) return;
                onAddWorkspace?.({
                  id: slugifyWorkspaceId(name),
                  name,
                  path,
                });
                setNewName("");
                setNewPath("");
              }}
              disabled={!newName.trim() || !newPath.trim()}
            >
              Add Workspace
            </Button>
          </div>
        </CardContent>
      </Card>

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
