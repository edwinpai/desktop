import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListChecks,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TaskRecord {
  id?: string;
  goal?: string;
  definitionOfDone?: string;
  status?: "active" | "done" | "blocked" | "needs_user";
  criteria?: string[];
  completedCriteria?: string[];
  blockedReason?: string;
  needsUserReason?: string;
  lastEvaluationReason?: string;
  autoContinueEnabled?: boolean;
  maxIterations?: number;
  delayMs?: number;
  active?: boolean;
}

interface TaskQueueResult {
  activeTaskId?: string;
  activeTask?: TaskRecord;
  tasks?: TaskRecord[];
}

interface TaskSession {
  key: string;
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  activeTask?: {
    goal?: string;
    status?: string;
    criteriaTotal?: number;
    criteriaCompleted?: number;
  };
  taskQueue?: {
    total?: number;
    runnable?: number;
  };
}

interface TasksPanelProps {
  sessionKey: string;
  sessions?: TaskSession[];
  onSelectSession?: (key: string) => void;
  onOpenChat?: (key: string) => void;
  onTasksChanged?: () => void | Promise<void>;
  request?: <T = Record<string, unknown>>(method: string, params?: Record<string, unknown>) => Promise<T>;
}

function parseCriteria(text: string): string[] {
  return Array.from(new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)));
}

function getDraftStorageKey(sessionKey: string): string {
  return `edwinpai:tasks:draft:${sessionKey}`;
}

function getSessionTitle(session: TaskSession): string {
  return session.displayName || session.label || session.derivedTitle || session.key;
}

function getTaskStatusLabel(task: TaskRecord, activeTaskId?: string): string {
  if (task.id && task.id === activeTaskId) {
    if (task.active) {
      return "running";
    }
    if ((task.status ?? "active") === "active") {
      return "selected";
    }
    return task.status ?? "selected";
  }
  if (task.status === "active" && task.autoContinueEnabled) {
    return "queued";
  }
  return task.status ?? "active";
}

function isTaskCompleted(task: TaskRecord): boolean {
  const criteriaCount = task.criteria?.length ?? 0;
  const completedCount = task.completedCriteria?.length ?? 0;
  return task.status === "done" || (criteriaCount > 0 && completedCount >= criteriaCount);
}

function isTaskBlocked(task: TaskRecord): boolean {
  if (isTaskCompleted(task)) {
    return false;
  }
  return task.status === "blocked" || Boolean((task.blockedReason ?? "").trim());
}

function isTaskNeedsUser(task: TaskRecord): boolean {
  if (isTaskCompleted(task) || isTaskBlocked(task)) {
    return false;
  }
  return task.status === "needs_user" || Boolean((task.needsUserReason ?? "").trim());
}

function loadTaskIntoEditor(task: TaskRecord | null, setters: {
  setGoal: (value: string) => void;
  setDefinitionOfDone: (value: string) => void;
  setCriteriaText: (value: string) => void;
  setAutoContinueEnabled: (value: boolean) => void;
  setMaxIterations: (value: string) => void;
  setDelayMs: (value: string) => void;
  setEditorDirty: (value: boolean) => void;
}) {
  setters.setGoal(task?.goal ?? "");
  setters.setDefinitionOfDone(task?.definitionOfDone ?? "");
  setters.setCriteriaText((task?.criteria ?? []).join("\n"));
  setters.setAutoContinueEnabled(task?.autoContinueEnabled ?? true);
  setters.setMaxIterations(String(task?.maxIterations ?? 25));
  setters.setDelayMs(String(task?.delayMs ?? 1500));
  setters.setEditorDirty(false);
}

export function TasksPanel({ sessionKey, sessions = [], onSelectSession, onOpenChat, onTasksChanged, request }: TasksPanelProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [createGoal, setCreateGoal] = useState("");
  const [createDefinitionOfDone, setCreateDefinitionOfDone] = useState("");
  const [createCriteriaText, setCreateCriteriaText] = useState("");
  const [createAutoContinueEnabled, setCreateAutoContinueEnabled] = useState(true);
  const [createMaxIterations, setCreateMaxIterations] = useState("25");
  const [createDelayMs, setCreateDelayMs] = useState("1500");

  const [editGoal, setEditGoal] = useState("");
  const [editDefinitionOfDone, setEditDefinitionOfDone] = useState("");
  const [editCriteriaText, setEditCriteriaText] = useState("");
  const [editAutoContinueEnabled, setEditAutoContinueEnabled] = useState(true);
  const [editMaxIterations, setEditMaxIterations] = useState("25");
  const [editDelayMs, setEditDelayMs] = useState("1500");
  const [editorDirty, setEditorDirty] = useState(false);
  const [blockReasonInput, setBlockReasonInput] = useState("");
  const [needsUserReasonInput, setNeedsUserReasonInput] = useState("");
  const [showBlockedTasks, setShowBlockedTasks] = useState(false);
  const [showNeedsUserTasks, setShowNeedsUserTasks] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const currentSession = sessions.find((session) => session.key === sessionKey);
  const sessionOptions = useMemo(() => {
    const seen = new Set<string>();
    const ordered: TaskSession[] = [];
    const add = (session: TaskSession | null | undefined) => {
      if (!session?.key || seen.has(session.key)) return;
      seen.add(session.key);
      ordered.push(session);
    };
    add(currentSession ?? { key: sessionKey, displayName: sessionKey });
    sessions.forEach(add);
    return ordered;
  }, [currentSession, sessionKey, sessions]);
  const draftStorageKey = useMemo(() => getDraftStorageKey(sessionKey), [sessionKey]);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );
  const remainingCriteria = useMemo(() => {
    const all = selectedTask?.criteria ?? [];
    const completed = new Set(selectedTask?.completedCriteria ?? []);
    return all.filter((item) => !completed.has(item));
  }, [selectedTask]);
  const runnableTaskCount = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "active" &&
          task.autoContinueEnabled &&
          !(task.blockedReason ?? "").trim() &&
          !(task.needsUserReason ?? "").trim() &&
          (task.completedCriteria ?? []).length < (task.criteria ?? []).length,
      ).length,
    [tasks],
  );
  const activeQueueTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [activeTaskId, tasks],
  );
  const completedTasks = useMemo(() => tasks.filter((task) => isTaskCompleted(task)), [tasks]);
  const blockedTasks = useMemo(() => tasks.filter((task) => isTaskBlocked(task)), [tasks]);
  const needsUserTasks = useMemo(() => tasks.filter((task) => isTaskNeedsUser(task)), [tasks]);
  const workingTasks = useMemo(
    () => tasks.filter((task) => !isTaskCompleted(task) && !isTaskBlocked(task) && !isTaskNeedsUser(task)),
    [tasks],
  );
  const activeQueueTaskCompletedCount = activeQueueTask?.completedCriteria?.length ?? 0;
  const activeQueueTaskCriteriaCount = activeQueueTask?.criteria?.length ?? 0;
  const hasLiveTaskActivity = Boolean(
    activeQueueTask && activeQueueTask.active && activeQueueTask.status === "active",
  );
  const pollIntervalMs = hasLiveTaskActivity ? 1500 : 5000;

  // Keep the API intentionally split:
  // - sessions.tasks.* => queue-wide CRUD, ordering, and explicit execution
  // - sessions.task.* => lifecycle actions on the currently selected active task
  const requestTaskQueue = useCallback(
    async <T,>(method: string, params: Record<string, unknown> = {}) => {
      if (!request) throw new Error("Task queue RPC unavailable");
      return await request<T>(`sessions.tasks.${method}`, { key: sessionKey, ...params });
    },
    [request, sessionKey],
  );
  const requestActiveTask = useCallback(
    async <T,>(method: string, params: Record<string, unknown> = {}) => {
      if (!request) throw new Error("Active task RPC unavailable");
      return await request<T>(`sessions.task.${method}`, { key: sessionKey, ...params });
    },
    [request, sessionKey],
  );

  const refresh = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    setError(null);
    try {
      const result = await requestTaskQueue<TaskQueueResult>("list");
      const nextTasks = result?.tasks ?? [];
      const nextActiveTaskId = result?.activeTaskId;
      setTasks(nextTasks);
      setActiveTaskId(nextActiveTaskId);
      setSelectedTaskId((current) => {
        if (current && nextTasks.some((task) => task.id === current)) {
          return current;
        }
        return nextActiveTaskId ?? nextTasks[0]?.id;
      });

      const draftRaw = typeof window !== "undefined" ? window.localStorage.getItem(draftStorageKey) : null;
      let draft: {
        goal?: string;
        definitionOfDone?: string;
        criteriaText?: string;
        autoContinueEnabled?: boolean;
        maxIterations?: string;
        delayMs?: string;
      } | null = null;
      if (draftRaw) {
        try {
          draft = JSON.parse(draftRaw) as {
            goal?: string;
            definitionOfDone?: string;
            criteriaText?: string;
            autoContinueEnabled?: boolean;
            maxIterations?: string;
            delayMs?: string;
          };
        } catch {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(draftStorageKey);
          }
        }
      }
      setCreateGoal(draft?.goal ?? "");
      setCreateDefinitionOfDone(draft?.definitionOfDone ?? "");
      setCreateCriteriaText(draft?.criteriaText ?? "");
      setCreateAutoContinueEnabled(draft?.autoContinueEnabled ?? true);
      setCreateMaxIterations(draft?.maxIterations ?? "25");
      setCreateDelayMs(draft?.delayMs ?? "1500");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [draftStorageKey, requestTaskQueue, sessionKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const notifyTasksChanged = useCallback(async () => {
    await onTasksChanged?.();
  }, [onTasksChanged]);

  useEffect(() => {
    if (!request || !sessionKey) return;
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (saving) {
        return;
      }
      void refresh();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [pollIntervalMs, refresh, request, saving, sessionKey]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const handleFocus = () => {
      void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!sessionKey || typeof window === "undefined") return;
    const hasDraft = createGoal.trim() || createDefinitionOfDone.trim() || createCriteriaText.trim();
    if (!hasDraft) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }
    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        goal: createGoal,
        definitionOfDone: createDefinitionOfDone,
        criteriaText: createCriteriaText,
        autoContinueEnabled: createAutoContinueEnabled,
        maxIterations: createMaxIterations,
        delayMs: createDelayMs,
      }),
    );
  }, [
    createAutoContinueEnabled,
    createCriteriaText,
    createDefinitionOfDone,
    createDelayMs,
    createGoal,
    createMaxIterations,
    draftStorageKey,
    sessionKey,
  ]);

  useEffect(() => {
    if (!selectedTask) {
      loadTaskIntoEditor(null, {
        setGoal: setEditGoal,
        setDefinitionOfDone: setEditDefinitionOfDone,
        setCriteriaText: setEditCriteriaText,
        setAutoContinueEnabled: setEditAutoContinueEnabled,
        setMaxIterations: setEditMaxIterations,
        setDelayMs: setEditDelayMs,
        setEditorDirty,
      });
      return;
    }
    if (!editorDirty) {
      loadTaskIntoEditor(selectedTask, {
        setGoal: setEditGoal,
        setDefinitionOfDone: setEditDefinitionOfDone,
        setCriteriaText: setEditCriteriaText,
        setAutoContinueEnabled: setEditAutoContinueEnabled,
        setMaxIterations: setEditMaxIterations,
        setDelayMs: setEditDelayMs,
        setEditorDirty,
      });
    }
  }, [editorDirty, selectedTask]);

  useEffect(() => {
    setBlockReasonInput(selectedTask?.blockedReason ?? "");
    setNeedsUserReasonInput(selectedTask?.needsUserReason ?? "");
  }, [selectedTask?.blockedReason, selectedTask?.needsUserReason, selectedTask?.id]);


  useEffect(() => {
    if (!selectedTask) {
      return;
    }
    if (isTaskCompleted(selectedTask)) {
      setShowCompletedTasks(true);
    } else if (isTaskBlocked(selectedTask)) {
      setShowBlockedTasks(true);
    } else if (isTaskNeedsUser(selectedTask)) {
      setShowNeedsUserTasks(true);
    }
  }, [selectedTask]);

  const createTask = useCallback(async () => {
    if (!request || !createGoal.trim()) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const parsedMaxIterations = Number.parseInt(createMaxIterations, 10);
      const parsedDelayMs = Number.parseInt(createDelayMs, 10);
      await requestTaskQueue<TaskQueueResult>("create", {
        taskGoal: createGoal,
        taskDefinitionOfDone: createDefinitionOfDone,
        taskCriteria: parseCriteria(createCriteriaText),
        taskAutoContinueEnabled: createAutoContinueEnabled,
        taskMaxIterations: Number.isFinite(parsedMaxIterations) ? parsedMaxIterations : undefined,
        taskDelayMs: Number.isFinite(parsedDelayMs) ? parsedDelayMs : undefined,
      });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftStorageKey);
      }
      setCreateGoal("");
      setCreateDefinitionOfDone("");
      setCreateCriteriaText("");
      setCreateAutoContinueEnabled(true);
      setCreateMaxIterations("25");
      setCreateDelayMs("1500");
      setStatus("Task queued.");
      await refresh();
      await notifyTasksChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    createAutoContinueEnabled,
    createCriteriaText,
    createDefinitionOfDone,
    createDelayMs,
    createGoal,
    createMaxIterations,
    draftStorageKey,
    notifyTasksChanged,
    refresh,
    request,
    requestTaskQueue,
  ]);

  const selectQueueTask = useCallback(async (taskId: string) => {
    if (!request) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestTaskQueue<TaskQueueResult>("select", { taskId });
      setSelectedTaskId(taskId);
      setStatus("Task selected.");
      await refresh();
      await notifyTasksChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [notifyTasksChanged, refresh, request, requestTaskQueue]);

  const updateSelectedTask = useCallback(async () => {
    if (!request || !selectedTask?.id || !editGoal.trim()) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const parsedMaxIterations = Number.parseInt(editMaxIterations, 10);
      const parsedDelayMs = Number.parseInt(editDelayMs, 10);
      await requestTaskQueue<TaskQueueResult>("update", {
        taskId: selectedTask.id,
        taskGoal: editGoal,
        taskDefinitionOfDone: editDefinitionOfDone,
        taskCriteria: parseCriteria(editCriteriaText),
        taskAutoContinueEnabled: editAutoContinueEnabled,
        taskMaxIterations: Number.isFinite(parsedMaxIterations) ? parsedMaxIterations : undefined,
        taskDelayMs: Number.isFinite(parsedDelayMs) ? parsedDelayMs : undefined,
      });
      setEditorDirty(false);
      setStatus("Task updated.");
      await refresh();
      await notifyTasksChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    editAutoContinueEnabled,
    editCriteriaText,
    editDefinitionOfDone,
    editDelayMs,
    editGoal,
    editMaxIterations,
    notifyTasksChanged,
    refresh,
    request,
    requestTaskQueue,
    selectedTask?.id,
  ]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!request) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestTaskQueue<TaskQueueResult>("delete", { taskId });
      if (selectedTaskId === taskId) {
        setEditorDirty(false);
      }
      setStatus("Task deleted.");
      await refresh();
      await notifyTasksChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [notifyTasksChanged, refresh, request, requestTaskQueue, selectedTaskId]);

  const deleteSelectedTask = useCallback(async () => {
    if (!selectedTask?.id) return;
    await deleteTask(selectedTask.id);
  }, [deleteTask, selectedTask?.id]);

  const moveSelectedTask = useCallback(async (direction: -1 | 1) => {
    if (!request || !selectedTask?.id) return;
    const index = tasks.findIndex((task) => task.id === selectedTask.id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= tasks.length) return;
    const ordered = [...tasks];
    const [moved] = ordered.splice(index, 1);
    if (!moved) return;
    ordered.splice(nextIndex, 0, moved);
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestTaskQueue<TaskQueueResult>("reorder", {
        taskIds: ordered.map((task) => task.id).filter(Boolean),
      });
      setStatus(direction < 0 ? "Task moved up." : "Task moved down.");
      await refresh();
      await notifyTasksChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [notifyTasksChanged, refresh, request, requestTaskQueue, selectedTask?.id, tasks]);

  const runSelectedTaskAction = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (!request || !selectedTask?.id) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      if (activeTaskId !== selectedTask.id) {
        await requestTaskQueue<TaskQueueResult>("select", { taskId: selectedTask.id });
      }
      await requestActiveTask<{ activeTask?: TaskRecord }>("action", {
        action,
        ...extra,
      });
      await refresh();
      await notifyTasksChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [activeTaskId, notifyTasksChanged, refresh, request, requestActiveTask, requestTaskQueue, selectedTask?.id]);

  const executeQueuedTasks = useCallback(async () => {
    if (!request) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestTaskQueue<TaskQueueResult>("execute");
      setStatus("Task execution started. Opening chat…");
      await refresh();
      await notifyTasksChanged();
      onOpenChat?.(sessionKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [notifyTasksChanged, onOpenChat, refresh, request, requestTaskQueue, sessionKey]);

  const selectTaskInQueue = useCallback((task: TaskRecord) => {
    setSelectedTaskId(task.id);
    loadTaskIntoEditor(task, {
      setGoal: setEditGoal,
      setDefinitionOfDone: setEditDefinitionOfDone,
      setCriteriaText: setEditCriteriaText,
      setAutoContinueEnabled: setEditAutoContinueEnabled,
      setMaxIterations: setEditMaxIterations,
      setDelayMs: setEditDelayMs,
      setEditorDirty,
    });
  }, []);

  const renderTaskRows = useCallback((sectionTasks: TaskRecord[]) => {
    return sectionTasks.map((task) => {
      const isSelected = task.id === selectedTaskId;
      return (
        <div
          key={task.id}
          className={`flex items-start gap-2 rounded-md border p-2 transition ${isSelected ? "border-primary bg-muted/40" : "hover:bg-muted/20"}`}
        >
          <button
            type="button"
            className="min-w-0 flex-1 rounded-sm p-1 text-left"
            onClick={() => selectTaskInQueue(task)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{task.goal ?? task.id ?? "Untitled task"}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(task.completedCriteria ?? []).length}/{(task.criteria ?? []).length} complete
                </div>
                {task.blockedReason && (
                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 truncate">
                    Blocked: {task.blockedReason}
                  </div>
                )}
                {task.needsUserReason && (
                  <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 truncate">
                    Needs user: {task.needsUserReason}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={task.id === activeTaskId ? "default" : "secondary"}>
                  {getTaskStatusLabel(task, activeTaskId)}
                </Badge>
                {task.autoContinueEnabled && <Badge variant="outline">auto</Badge>}
              </div>
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="mt-1 shrink-0"
            aria-label={`Delete ${task.goal ?? task.id ?? "task"}`}
            title={`Delete ${task.goal ?? task.id ?? "task"}`}
            onClick={() => task.id && deleteTask(task.id)}
            disabled={saving || !task.id}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    });
  }, [activeTaskId, deleteTask, saving, selectTaskInQueue, selectedTaskId]);



  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6" />
            Tasks
          </h2>
          <p className="text-sm text-muted-foreground">
            Queue deterministic session tasks, choose the current task explicitly, and watch progress live.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={executeQueuedTasks} disabled={loading || saving || runnableTaskCount === 0}>
            <PlayCircle className="h-4 w-4 mr-2" />
            Execute Tasks{runnableTaskCount > 0 ? ` (${runnableTaskCount})` : ""}
          </Button>
          <Button variant="outline" onClick={refresh} disabled={loading || saving}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!request && <div className="text-sm text-amber-600 dark:text-amber-400">Task controls are unavailable until the gateway connection is ready.</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {status && <div className="text-sm text-muted-foreground">{status}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Session Scope</CardTitle>
          <CardDescription>Choose which session this task queue belongs to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Session</label>
            <Select value={sessionKey} onValueChange={(value) => onSelectSession?.(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent>
                {sessionOptions.map((session) => (
                  <SelectItem key={session.key} value={session.key}>
                    {getSessionTitle(session)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div><strong>Current session:</strong> {getSessionTitle(currentSession ?? { key: sessionKey, displayName: sessionKey })}</div>
            {activeQueueTask ? (
              <>
                <div><strong>Current active task:</strong> selected below</div>
                <div className="text-muted-foreground">
                  {getTaskStatusLabel(activeQueueTask, activeTaskId)} · {activeQueueTaskCompletedCount}/{activeQueueTaskCriteriaCount} complete
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">No active task selected yet.</div>
            )}
            <div className="text-muted-foreground">
              Queue: {tasks.length} total · {runnableTaskCount} executable
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Task Queue</CardTitle>
            <CardDescription>Keep the workable queue focused while tucking finished or waiting tasks out of the way.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks in this session yet.</p>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Working queue</div>
                  {workingTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active or incomplete tasks right now.</p>
                  ) : (
                    renderTaskRows(workingTasks)
                  )}
                </div>

                {blockedTasks.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md text-left"
                      onClick={() => setShowBlockedTasks((current) => !current)}
                      aria-expanded={showBlockedTasks}
                    >
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Blocked tasks</div>
                        <div className="text-sm text-muted-foreground">{blockedTasks.length} waiting on something else</div>
                      </div>
                      {showBlockedTasks ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>

                    {showBlockedTasks && <div className="space-y-3">{renderTaskRows(blockedTasks)}</div>}
                  </div>
                )}

                {needsUserTasks.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md text-left"
                      onClick={() => setShowNeedsUserTasks((current) => !current)}
                      aria-expanded={showNeedsUserTasks}
                    >
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs user</div>
                        <div className="text-sm text-muted-foreground">{needsUserTasks.length} waiting on Jake or another user</div>
                      </div>
                      {showNeedsUserTasks ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>

                    {showNeedsUserTasks && <div className="space-y-3">{renderTaskRows(needsUserTasks)}</div>}
                  </div>
                )}

                {completedTasks.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md text-left"
                      onClick={() => setShowCompletedTasks((current) => !current)}
                      aria-expanded={showCompletedTasks}
                    >
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed tasks</div>
                        <div className="text-sm text-muted-foreground">{completedTasks.length} finished {completedTasks.length === 1 ? "task" : "tasks"}</div>
                      </div>
                      {showCompletedTasks ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>

                    {showCompletedTasks && <div className="space-y-3">{renderTaskRows(completedTasks)}</div>}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Task
              </CardTitle>
              <CardDescription>Create a new queued task for this session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="create-task-goal" className="text-sm font-medium">Goal</label>
                <Input id="create-task-goal" value={createGoal} onChange={(e) => setCreateGoal(e.target.value)} placeholder="Build multi-task queue support for Edwin" />
              </div>
              <div className="space-y-2">
                <label htmlFor="create-task-definition" className="text-sm font-medium">Definition of done</label>
                <Textarea id="create-task-definition" value={createDefinitionOfDone} onChange={(e) => setCreateDefinitionOfDone(e.target.value)} rows={3} placeholder="Describe exactly what must be true before this task is done." />
              </div>
              <div className="space-y-2">
                <label htmlFor="create-task-criteria" className="text-sm font-medium">Criteria (one per line)</label>
                <Textarea id="create-task-criteria" value={createCriteriaText} onChange={(e) => setCreateCriteriaText(e.target.value)} rows={5} placeholder={"backend queue model implemented\ngateway queue APIs implemented\ndesktop Tasks tab supports multiple tasks"} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Auto-continue</label>
                  <div className="flex h-10 items-center rounded-md border px-3">
                    <Switch checked={createAutoContinueEnabled} onCheckedChange={setCreateAutoContinueEnabled} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="create-task-max-iterations" className="text-sm font-medium">Max iterations</label>
                  <Input id="create-task-max-iterations" value={createMaxIterations} onChange={(e) => setCreateMaxIterations(e.target.value)} inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="create-task-delay" className="text-sm font-medium">Delay (ms)</label>
                  <Input id="create-task-delay" value={createDelayMs} onChange={(e) => setCreateDelayMs(e.target.value)} inputMode="numeric" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={createTask} disabled={saving || !createGoal.trim()}>
                  {saving ? "Saving..." : "Queue task"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selected Task</CardTitle>
              <CardDescription>Edit the selected task, control its place in the queue, and manage progress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedTask ? (
                <p className="text-sm text-muted-foreground">Select a task from the queue to inspect and edit it.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selectedTask.id === activeTaskId ? "default" : "secondary"}>
                      {getTaskStatusLabel(selectedTask, activeTaskId)}
                    </Badge>
                    <Badge variant="outline">{(selectedTask.completedCriteria ?? []).length}/{(selectedTask.criteria ?? []).length} complete</Badge>
                    {selectedTask.autoContinueEnabled && <Badge>Auto-continue on</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => selectedTask.id && selectQueueTask(selectedTask.id)} disabled={saving || selectedTask.id === activeTaskId}>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Make current
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => moveSelectedTask(-1)} disabled={saving || tasks.findIndex((task) => task.id === selectedTask.id) <= 0}>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Move up
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => moveSelectedTask(1)} disabled={saving || tasks.findIndex((task) => task.id === selectedTask.id) === tasks.length - 1}>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Move down
                    </Button>
                    <Button size="sm" variant="outline" onClick={deleteSelectedTask} disabled={saving}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Goal</label>
                    <Input value={editGoal} onChange={(e) => { setEditGoal(e.target.value); setEditorDirty(true); }} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Definition of done</label>
                    <Textarea value={editDefinitionOfDone} onChange={(e) => { setEditDefinitionOfDone(e.target.value); setEditorDirty(true); }} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Criteria (one per line)</label>
                    <Textarea value={editCriteriaText} onChange={(e) => { setEditCriteriaText(e.target.value); setEditorDirty(true); }} rows={5} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Auto-continue</label>
                      <div className="flex h-10 items-center rounded-md border px-3">
                        <Switch checked={editAutoContinueEnabled} onCheckedChange={(value) => { setEditAutoContinueEnabled(value); setEditorDirty(true); }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max iterations</label>
                      <Input value={editMaxIterations} onChange={(e) => { setEditMaxIterations(e.target.value); setEditorDirty(true); }} inputMode="numeric" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Delay (ms)</label>
                      <Input value={editDelayMs} onChange={(e) => { setEditDelayMs(e.target.value); setEditorDirty(true); }} inputMode="numeric" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={updateSelectedTask} disabled={saving || !selectedTask.id || !editGoal.trim()}>
                      {saving ? "Saving..." : "Update task"}
                    </Button>
                  </div>

                  {selectedTask.lastEvaluationReason && (
                    <div className="text-sm text-muted-foreground">{selectedTask.lastEvaluationReason}</div>
                  )}
                  <div className="space-y-2">
                    {(selectedTask.criteria ?? []).map((criterion) => {
                      const done = (selectedTask.completedCriteria ?? []).includes(criterion);
                      return (
                        <div key={criterion} className="flex items-center justify-between gap-3 rounded border p-3">
                          <div className="flex items-center gap-2 text-sm">
                            {done ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                            <span>{criterion}</span>
                          </div>
                          {!done && (
                            <Button size="sm" variant="outline" onClick={() => runSelectedTaskAction("complete_criteria", { criteria: [criterion] })} disabled={saving}>
                              Complete
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Button className="justify-start" variant="outline" onClick={() => runSelectedTaskAction("clear_block")} disabled={saving || !selectedTask.blockedReason}>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Clear blocked
                    </Button>
                    <Button className="justify-start" variant="outline" onClick={() => runSelectedTaskAction("clear_needs_user")} disabled={saving || !selectedTask.needsUserReason}>
                      <UserCircle2 className="h-4 w-4 mr-2" />
                      Clear needs user
                    </Button>
                    <div className="flex gap-2 xl:col-span-2">
                      <Input
                        value={blockReasonInput}
                        onChange={(e) => setBlockReasonInput(e.target.value)}
                        placeholder="Explain what is blocked"
                      />
                      <Button className="justify-start" variant="outline" onClick={() => runSelectedTaskAction("block", { reason: blockReasonInput.trim() })} disabled={saving || !blockReasonInput.trim()}>
                        <PauseCircle className="h-4 w-4 mr-2" />
                        Mark blocked
                      </Button>
                    </div>
                    <div className="flex gap-2 xl:col-span-2">
                      <Input
                        value={needsUserReasonInput}
                        onChange={(e) => setNeedsUserReasonInput(e.target.value)}
                        placeholder="Explain what user input is needed"
                      />
                      <Button className="justify-start" variant="outline" onClick={() => runSelectedTaskAction("needs_user", { reason: needsUserReasonInput.trim() })} disabled={saving || !needsUserReasonInput.trim()}>
                        <UserCircle2 className="h-4 w-4 mr-2" />
                        Mark needs user
                      </Button>
                    </div>
                    <Button className="justify-start" onClick={() => runSelectedTaskAction("finish")} disabled={saving}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Finish task
                    </Button>
                  </div>

                  {(selectedTask.blockedReason || selectedTask.needsUserReason || remainingCriteria.length > 0) && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                      {selectedTask.blockedReason && <div><strong>Blocked:</strong> {selectedTask.blockedReason}</div>}
                      {selectedTask.needsUserReason && <div><strong>Needs user:</strong> {selectedTask.needsUserReason}</div>}
                      {remainingCriteria.length > 0 && <div><strong>Remaining:</strong> {remainingCriteria.join(", ")}</div>}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
