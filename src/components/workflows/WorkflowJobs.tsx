import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveWorkflow,
  createWorkflowFile,
  denyWorkflow,
  getWorkflowHistory,
  getWorkflowStatus,
  listPendingWorkflowApprovals,
  listWorkflowFiles,
  listWorkflows,
  loadWorkflowFile,
  readWorkflowLogs,
  runWorkflow,
  saveWorkflowFile,
  type WorkflowHistoryRun,
  type WorkflowPendingApproval,
  type WorkflowStatusResult,
  type WorkflowSummary,
} from "@/lib/workflows";
import { parse as parseYaml } from "yaml";

function toUserFacingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("Cannot read properties of undefined (reading 'invoke')") ||
    msg.includes("Desktop integration is unavailable")
  ) {
    return "Desktop integration is unavailable right now. Please reopen this screen inside the desktop app.";
  }
  return msg;
}

export function WorkflowJobs() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<
    Record<string, WorkflowStatusResult>
  >({});
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);

  const [historyWorkflow, setHistoryWorkflow] = useState<string | null>(null);
  const [historyRuns, setHistoryRuns] = useState<WorkflowHistoryRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [pendingApprovals, setPendingApprovals] = useState<
    WorkflowPendingApproval[]
  >([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  const [logWorkflow, setLogWorkflow] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  const [workflowFiles, setWorkflowFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [newFileName, setNewFileName] = useState<string>("");

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listWorkflows();
      setWorkflows(result.workflows ?? []);
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflowFiles = async () => {
    setFileError(null);
    try {
      const result = await listWorkflowFiles();
      setWorkflowFiles(result.files ?? []);
    } catch (err) {
      setFileError(toUserFacingError(err));
      setWorkflowFiles([]);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadWorkflows(), loadWorkflowFiles()]);
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatus = async (name: string) => {
    setError(null);
    try {
      const status = await getWorkflowStatus(name);
      setStatusMap((prev) => ({ ...prev, [name]: status }));
    } catch (err) {
      setError(toUserFacingError(err));
    }
  };

  const handleRun = async (name: string) => {
    setError(null);
    setNotice(null);
    setRunningWorkflow(name);
    try {
      const result = await runWorkflow(name);
      setNotice(result.message);
      await loadWorkflows();
      await handleStatus(name);
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setRunningWorkflow(null);
    }
  };

  const handleHistory = async () => {
    if (!historyWorkflow) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const result = await getWorkflowHistory(historyWorkflow);
      setHistoryRuns(result.runs ?? []);
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleApprovals = async () => {
    setApprovalsLoading(true);
    setError(null);
    try {
      const pending = await listPendingWorkflowApprovals();
      setPendingApprovals(pending ?? []);
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setApprovalsLoading(false);
    }
  };

  const handleApprovalAction = async (
    approvalId: string,
    action: "approve" | "deny",
  ) => {
    setError(null);
    setNotice(null);
    try {
      if (action === "approve") {
        await approveWorkflow(approvalId);
        setNotice(`Approved ${approvalId}`);
      } else {
        await denyWorkflow(approvalId);
        setNotice(`Denied ${approvalId}`);
      }
      await handleApprovals();
    } catch (err) {
      setError(toUserFacingError(err));
    }
  };

  const handleLogs = async (name: string) => {
    setLogWorkflow(name);
    setLogError(null);
    setLogContent(null);
    setLogLoading(true);
    try {
      const result = await readWorkflowLogs(name);
      setLogContent(result.content ?? "");
    } catch (err) {
      setLogError(toUserFacingError(err));
    } finally {
      setLogLoading(false);
    }
  };

  const handleLoadWorkflowFile = async (filename: string) => {
    setFileLoading(true);
    setFileError(null);
    try {
      const result = await loadWorkflowFile(filename);
      setSelectedFile(result.filename);
      setFileContent(result.content);
    } catch (err) {
      setFileError(toUserFacingError(err));
    } finally {
      setFileLoading(false);
    }
  };

  const handleSaveWorkflowFile = async () => {
    if (!selectedFile) return;
    setFileSaving(true);
    setFileError(null);
    setNotice(null);
    try {
      try {
        parseYaml(fileContent);
      } catch (err) {
        throw new Error(
          `YAML parse error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await saveWorkflowFile(selectedFile, fileContent);
      setNotice(`Saved ${selectedFile}`);
      await refreshAll();
    } catch (err) {
      setFileError(toUserFacingError(err));
    } finally {
      setFileSaving(false);
    }
  };

  const handleCreateWorkflowFile = async () => {
    const filename = newFileName.trim();
    if (!filename) return;
    setFileSaving(true);
    setFileError(null);
    setNotice(null);
    try {
      const result = await createWorkflowFile(filename);
      setNewFileName("");
      setSelectedFile(result.filename);
      setFileContent(result.content);
      setNotice(`Created ${result.filename}`);
      await refreshAll();
    } catch (err) {
      setFileError(toUserFacingError(err));
    } finally {
      setFileSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Workflows</h2>
          <p className="text-sm text-muted-foreground">
            Local host automations backed by{" "}
            <code>~/.edwinpai/workspace/workflows</code> and system crontab.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Heartbeat-style checks, reminders, and reliable scheduled jobs
            should live here as workflows.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void refreshAll()}
          disabled={loading || fileLoading || fileSaving}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {notice && <div className="text-sm text-muted-foreground">{notice}</div>}

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="editor">YAML Editor</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          {workflows.length === 0 && !loading ? (
            <Card>
              <CardHeader>
                <CardTitle>No workflows found</CardTitle>
                <CardDescription>
                  Add YAML files to ~/.edwinpai/workspace/workflows to get
                  started.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {workflows.map((wf) => {
                const status = statusMap[wf.id];
                return (
                  <Card key={wf.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-2">
                          <CardTitle className="flex flex-wrap items-center gap-2">
                            {wf.name}
                            <Badge variant="outline">
                              {wf.stepCount} steps
                            </Badge>
                            {wf.schedule ? (
                              <Badge variant="secondary">{wf.schedule}</Badge>
                            ) : (
                              <Badge variant="outline">manual only</Badge>
                            )}
                          </CardTitle>
                          {wf.description && (
                            <CardDescription>{wf.description}</CardDescription>
                          )}
                          {wf.parseError && (
                            <div className="text-xs text-destructive">
                              Failed to parse YAML: {wf.parseError}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleStatus(wf.id)}
                          >
                            Status
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void handleRun(wf.id)}
                            disabled={runningWorkflow === wf.id}
                          >
                            {runningWorkflow === wf.id ? "Starting..." : "Run"}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {wf.lastRun
                          ? `Last run: ${new Date(wf.lastRun).toLocaleString()}`
                          : "Never run"}
                      </div>
                      {status?.lastRun && (
                        <div className="text-sm">
                          Status:{" "}
                          {status.lastRun.success ? "✅ Success" : "❌ Failed"}
                          {status.lastRun.error && (
                            <div className="text-xs text-destructive mt-1">
                              {status.lastRun.error}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Run history</CardTitle>
              <CardDescription>
                Select a workflow to view recent runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <Select
                  value={historyWorkflow ?? undefined}
                  onValueChange={setHistoryWorkflow}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((wf) => (
                      <SelectItem key={wf.id} value={wf.id}>
                        {wf.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => void handleHistory()}
                  disabled={!historyWorkflow || historyLoading}
                >
                  {historyLoading ? "Loading..." : "Load"}
                </Button>
              </div>

              {historyRuns.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No history loaded.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyRuns.map((run, idx) => (
                    <Card key={`${run.timestamp ?? "unknown"}-${idx}`}>
                      <CardContent className="pt-4 space-y-1">
                        <div className="text-sm">
                          {run.timestamp
                            ? new Date(run.timestamp).toLocaleString()
                            : "Unknown time"}
                        </div>
                        <div className="text-sm">
                          {run.success ? "✅ Success" : "❌ Failed"}
                          {typeof run.duration === "number"
                            ? ` — ${Math.round(run.duration / 1000)}s`
                            : ""}
                        </div>
                        {run.error && (
                          <div className="text-xs text-destructive">
                            {run.error}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Pending approvals</CardTitle>
              <CardDescription>Approve or deny workflow gates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={() => void handleApprovals()}
                disabled={approvalsLoading}
              >
                {approvalsLoading ? "Refreshing..." : "Refresh"}
              </Button>

              {pendingApprovals.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No pending approvals.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((approval) => (
                    <Card key={approval.id}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="text-sm font-medium">
                          {approval.workflow} → {approval.step}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {approval.message}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(approval.timestamp).toLocaleString()}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              void handleApprovalAction(approval.id, "approve")
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleApprovalAction(approval.id, "deny")
                            }
                          >
                            Deny
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Workflow logs</CardTitle>
              <CardDescription>
                Tail the last 200 lines from workflow logs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <Select
                  value={logWorkflow ?? undefined}
                  onValueChange={setLogWorkflow}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((wf) => (
                      <SelectItem key={wf.id} value={wf.id}>
                        {wf.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => logWorkflow && void handleLogs(logWorkflow)}
                  disabled={!logWorkflow || logLoading}
                >
                  {logLoading ? "Loading..." : "Load logs"}
                </Button>
              </div>

              {logError && (
                <div className="text-sm text-destructive">{logError}</div>
              )}

              {logContent ? (
                <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap max-h-96 overflow-auto">
                  {logContent}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {logLoading
                    ? "Loading log content..."
                    : "No log content loaded."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor">
          <Card>
            <CardHeader>
              <CardTitle>Workflow YAML editor</CardTitle>
              <CardDescription>
                Edit files in ~/.edwinpai/workspace/workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  onClick={() => void loadWorkflowFiles()}
                >
                  Refresh files
                </Button>
                <Select
                  value={selectedFile ?? undefined}
                  onValueChange={(val) => void handleLoadWorkflowFile(val)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select file" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowFiles.map((file) => (
                      <SelectItem key={file} value={file}>
                        {file}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-56"
                  placeholder="new-workflow.yaml"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => void handleCreateWorkflowFile()}
                  disabled={fileSaving || !newFileName.trim()}
                >
                  Create
                </Button>
              </div>

              {fileError && (
                <div className="text-sm text-destructive">{fileError}</div>
              )}

              <textarea
                className="w-full min-h-[400px] rounded-md border border-border bg-background p-3 text-sm font-mono"
                placeholder="Select a workflow file to edit"
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                disabled={fileLoading || !selectedFile}
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    selectedFile && void handleLoadWorkflowFile(selectedFile)
                  }
                  disabled={!selectedFile || fileLoading}
                >
                  {fileLoading ? "Loading..." : "Reload"}
                </Button>
                <Button
                  onClick={() => void handleSaveWorkflowFile()}
                  disabled={!selectedFile || fileSaving}
                >
                  {fileSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
