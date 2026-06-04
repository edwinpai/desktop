import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  ListChecks,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskEvent {
  id: string;
  ts: number;
  taskId?: string;
  type?: string;
  message: string;
  details?: Record<string, unknown>;
}

type TaskExecutorKind =
  | "edwin"
  | "human"
  | "workflow"
  | "subagent"
  | "codex"
  | "claude-code"
  | "opencode"
  | "custom";

type TaskApprovalState =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

type TaskRunState =
  | "not_started"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

interface TaskAssignment {
  assigneeType?: string;
  assigneeId?: string;
  executorKind?: TaskExecutorKind;
  executorId?: string;
  approvalState?: TaskApprovalState;
  runState?: TaskRunState;
  runId?: string;
  sessionKey?: string;
  prompt?: string;
  artifacts?: string[];
  logPath?: string;
  resultSummary?: string;
}

interface TaskStep {
  id: string;
  title: string;
  status?: "active" | "done" | "blocked" | "needs_user" | "review";
  assignment?: TaskAssignment;
}

interface TaskRecord {
  id?: string;
  title?: string;
  goal?: string;
  definitionOfDone?: string;
  status?: "active" | "done" | "blocked" | "needs_user" | "review";
  criteria?: string[];
  completedCriteria?: string[];
  blockedReason?: string;
  needsUserReason?: string;
  lastEvaluationReason?: string;
  autoContinueEnabled?: boolean;
  maxIterations?: number;
  delayMs?: number;
  active?: boolean;
  parentTaskId?: string;
  childTaskIds?: string[];
  assignedAgentType?: string;
  assignedAgentId?: string;
  assignedProfileId?: string;
  assignedDisciplineId?: string;
  assignedSessionKey?: string;
  assignment?: TaskAssignment;
  steps?: TaskStep[];
  boardColumn?: BoardColumnId;
  taskSource?: {
    kind?: string;
    path?: string;
    fileStatus?: "active" | "waiting" | "inbox" | "done" | string;
  };
}

type BoardColumnId =
  | "inbox"
  | "ready"
  | "queue"
  | "waiting"
  | "review"
  | "done";

type BoardColumn = {
  id: BoardColumnId;
  title: string;
  description: string;
  tasks: TaskRecord[];
};

interface TaskQueueResult {
  activeTaskId?: string;
  activeTask?: TaskRecord;
  tasks?: TaskRecord[];
  taskEvents?: TaskEvent[];
}

interface TaskSession {
  key: string;
  label?: string;
  userLabel?: string;
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
  request?: <T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<T>;
}

function parseCriteria(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  );
}

function getDraftStorageKey(sessionKey: string): string {
  return `edwinpai:tasks:draft:${sessionKey}`;
}

function getSessionTitle(session: TaskSession): string {
  return (
    session.userLabel ||
    session.displayName ||
    session.label ||
    session.derivedTitle ||
    session.key
  );
}

function getTaskTitle(task: TaskRecord): string {
  return task.title ?? task.goal ?? task.id ?? "Untitled task";
}

function getTaskAssigneeLabel(task: TaskRecord): string | null {
  const type = task.assignedAgentType?.trim();
  const id = task.assignedAgentId?.trim();
  const profile = task.assignedProfileId?.trim();
  const discipline = task.assignedDisciplineId?.trim();
  if (type && id) return `${type}: ${id}`;
  if (type) return type;
  if (profile) return `profile: ${profile}`;
  if (discipline) return `discipline: ${discipline}`;
  return null;
}

function getTaskBoardColumn(
  task: TaskRecord,
  activeTaskId?: string,
): BoardColumnId {
  if (task.boardColumn) return task.boardColumn;
  const fileStatus = task.taskSource?.fileStatus;
  if (fileStatus === "inbox") return "inbox";
  if (fileStatus === "waiting") return "waiting";
  if (fileStatus === "done") return "done";
  if (task.status === "done" || isTaskCompleted(task)) return "done";
  if (task.status === "review") return "review";
  if (isTaskBlocked(task) || isTaskNeedsUser(task)) return "waiting";
  if (task.id === activeTaskId || task.active || task.autoContinueEnabled)
    return "queue";
  return "ready";
}

function getBoardColumnTitle(columnId: BoardColumnId): string {
  switch (columnId) {
    case "inbox":
      return "Inbox";
    case "ready":
      return "Ready";
    case "queue":
      return "Queue / Executing";
    case "waiting":
      return "Waiting / Blocked";
    case "review":
      return "Review";
    case "done":
      return "Done";
  }
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
  return (
    task.status === "done" ||
    (criteriaCount > 0 && completedCount >= criteriaCount)
  );
}

function isTaskBlocked(task: TaskRecord): boolean {
  if (isTaskCompleted(task)) {
    return false;
  }
  return (
    task.status === "blocked" || Boolean((task.blockedReason ?? "").trim())
  );
}

function isTaskNeedsUser(task: TaskRecord): boolean {
  if (isTaskCompleted(task) || isTaskBlocked(task)) {
    return false;
  }
  return (
    task.status === "needs_user" || Boolean((task.needsUserReason ?? "").trim())
  );
}

function getTaskProgress(task: TaskRecord | null): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = task?.criteria?.length ?? 0;
  const completed = task?.completedCriteria?.length ?? 0;
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

function getTaskCurrentStep(task: TaskRecord | null): string {
  if (!task) return "No task selected.";
  if (isTaskCompleted(task)) return "All criteria complete — ready to finish.";
  if (isTaskBlocked(task)) {
    return `Blocked: ${task.blockedReason ?? "waiting on an external dependency"}`;
  }
  if (isTaskNeedsUser(task)) {
    return `Needs user input: ${task.needsUserReason ?? "waiting for direction"}`;
  }
  const completed = new Set(task.completedCriteria ?? []);
  const nextCriterion = (task.criteria ?? []).find(
    (criterion) => !completed.has(criterion),
  );
  if (nextCriterion) return `Working toward: ${nextCriterion}`;
  return task.active
    ? "Executing task and watching for progress updates."
    : "Queued and ready to execute.";
}

function buildTaskActivity(task: TaskRecord | null): string[] {
  if (!task) return ["Select a task to see execution activity."];
  const entries: string[] = [];
  const statusLabel = getTaskStatusLabel(
    task,
    task.active ? task.id : undefined,
  );
  entries.push(`Task is ${statusLabel}.`);
  if (task.active)
    entries.push("Agent execution is currently attached to this task.");
  if (task.definitionOfDone?.trim()) {
    entries.push(`Definition of done: ${task.definitionOfDone.trim()}`);
  }
  for (const criterion of task.completedCriteria ?? []) {
    entries.push(`Completed criterion: ${criterion}`);
  }
  const remaining = (task.criteria ?? []).filter(
    (criterion) => !(task.completedCriteria ?? []).includes(criterion),
  );
  if (remaining.length > 0) {
    entries.push(`Next remaining criterion: ${remaining[0]}`);
  }
  if (task.lastEvaluationReason?.trim()) {
    entries.push(`Latest evaluation: ${task.lastEvaluationReason.trim()}`);
  }
  if (task.blockedReason?.trim())
    entries.push(`Blocked: ${task.blockedReason.trim()}`);
  if (task.needsUserReason?.trim())
    entries.push(`Needs user: ${task.needsUserReason.trim()}`);
  if (entries.length === 1 && !task.active) {
    entries.push("No execution updates yet — run the queue to start work.");
  }
  return entries;
}

function formatTaskSteps(steps: TaskStep[] | undefined): string {
  return (steps ?? [])
    .map((step) => {
      const executor = step.assignment?.executorKind ?? "edwin";
      const status = step.status ?? "active";
      return `${step.title} | ${executor} | ${status}`;
    })
    .join("\n");
}

function parseTaskSteps(text: string): TaskStep[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawTitle, rawExecutor, rawStatus] = line
        .split("|")
        .map((part) => part.trim());
      const executorKind = (rawExecutor || "edwin") as TaskExecutorKind;
      const status = (rawStatus || "active") as TaskStep["status"];
      return {
        id: `step-${index + 1}`,
        title: rawTitle || `Step ${index + 1}`,
        status,
        assignment: {
          executorKind,
          approvalState: executorKind === "human" ? "not_required" : "pending",
          runState: "not_started",
        },
      };
    });
}

function loadTaskIntoEditor(
  task: TaskRecord | null,
  setters: {
    setGoal: (value: string) => void;
    setDefinitionOfDone: (value: string) => void;
    setCriteriaText: (value: string) => void;
    setAutoContinueEnabled: (value: boolean) => void;
    setMaxIterations: (value: string) => void;
    setDelayMs: (value: string) => void;
    setEditorDirty: (value: boolean) => void;
  },
) {
  setters.setGoal(task?.goal ?? "");
  setters.setDefinitionOfDone(task?.definitionOfDone ?? "");
  setters.setCriteriaText((task?.criteria ?? []).join("\n"));
  setters.setAutoContinueEnabled(task?.autoContinueEnabled ?? true);
  setters.setMaxIterations(String(task?.maxIterations ?? 25));
  setters.setDelayMs(String(task?.delayMs ?? 1500));
  setters.setEditorDirty(false);
}

export function TasksPanel({
  sessionKey,
  sessions = [],
  onSelectSession,
  onOpenChat,
  onTasksChanged,
  request,
}: TasksPanelProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskEvents, setTaskEvents] = useState<TaskEvent[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | undefined>(
    undefined,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [createGoal, setCreateGoal] = useState("");
  const [createDefinitionOfDone, setCreateDefinitionOfDone] = useState("");
  const [createCriteriaText, setCreateCriteriaText] = useState("");
  const [createAutoContinueEnabled, setCreateAutoContinueEnabled] =
    useState(true);
  const [createMaxIterations, setCreateMaxIterations] = useState("25");
  const [createDelayMs, setCreateDelayMs] = useState("1500");

  const [editGoal, setEditGoal] = useState("");
  const [editDefinitionOfDone, setEditDefinitionOfDone] = useState("");
  const [editCriteriaText, setEditCriteriaText] = useState("");
  const [editAutoContinueEnabled, setEditAutoContinueEnabled] = useState(true);
  const [editMaxIterations, setEditMaxIterations] = useState("25");
  const [editDelayMs, setEditDelayMs] = useState("1500");
  const [editAssigneeType, setEditAssigneeType] = useState("agent");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editExecutorKind, setEditExecutorKind] =
    useState<TaskExecutorKind>("edwin");
  const [editExecutorId, setEditExecutorId] = useState("");
  const [editApprovalState, setEditApprovalState] =
    useState<TaskApprovalState>("not_required");
  const [editRunState, setEditRunState] = useState<TaskRunState>("not_started");
  const [editRunId, setEditRunId] = useState("");
  const [editAssignmentPrompt, setEditAssignmentPrompt] = useState("");
  const [editAssignmentArtifacts, setEditAssignmentArtifacts] = useState("");
  const [editAssignmentLogPath, setEditAssignmentLogPath] = useState("");
  const [editAssignmentResultSummary, setEditAssignmentResultSummary] =
    useState("");
  const [editStepsText, setEditStepsText] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);
  const [blockReasonInput, setBlockReasonInput] = useState("");
  const [needsUserReasonInput, setNeedsUserReasonInput] = useState("");
  const [tasksView, setTasksView] = useState<"board" | "add" | "task" | "run">(
    "board",
  );
  const [createColumnId, setCreateColumnId] = useState<BoardColumnId>("ready");

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
  const draftStorageKey = useMemo(
    () => getDraftStorageKey(sessionKey),
    [sessionKey],
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );
  const remainingCriteria = useMemo(() => {
    const all = selectedTask?.criteria ?? [];
    const completed = new Set(selectedTask?.completedCriteria ?? []);
    return all.filter((item) => !completed.has(item));
  }, [selectedTask]);
  const selectedTaskProgress = useMemo(
    () => getTaskProgress(selectedTask),
    [selectedTask],
  );
  const selectedTaskCurrentStep = useMemo(
    () => getTaskCurrentStep(selectedTask),
    [selectedTask],
  );
  const selectedTaskActivity = useMemo(() => {
    const selectedEvents = selectedTask?.id
      ? taskEvents.filter(
          (event) => !event.taskId || event.taskId === selectedTask.id,
        )
      : [];
    if (selectedEvents.length > 0) {
      return selectedEvents
        .slice(-12)
        .reverse()
        .map((event) => {
          const when = Number.isFinite(event.ts)
            ? new Date(event.ts).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "";
          return when ? `${when} · ${event.message}` : event.message;
        });
    }
    return buildTaskActivity(selectedTask);
  }, [selectedTask, taskEvents]);
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
  const childTasksByParent = useMemo(() => {
    const map = new Map<string, TaskRecord[]>();
    for (const task of tasks) {
      if (!task.parentTaskId) continue;
      const children = map.get(task.parentTaskId) ?? [];
      children.push(task);
      map.set(task.parentTaskId, children);
    }
    return map;
  }, [tasks]);
  const boardColumns = useMemo<BoardColumn[]>(() => {
    const topLevelTasks = tasks.filter((task) => !task.parentTaskId);
    const makeColumn = (
      id: BoardColumnId,
      title: string,
      description: string,
    ): BoardColumn => ({
      id,
      title,
      description,
      tasks: topLevelTasks.filter(
        (task) => getTaskBoardColumn(task, activeTaskId) === id,
      ),
    });
    return [
      makeColumn("inbox", "Inbox", "Captured tasks that still need triage."),
      makeColumn(
        "ready",
        "Ready",
        "Clear tasks that can be queued or assigned.",
      ),
      makeColumn(
        "queue",
        "Queue / Executing",
        "Runnable or currently executing work.",
      ),
      makeColumn(
        "waiting",
        "Waiting / Blocked",
        "Tasks waiting on people, approvals, or dependencies.",
      ),
      makeColumn(
        "review",
        "Review",
        "Work Edwin believes is ready for inspection.",
      ),
      makeColumn("done", "Done", "Completed and archived work."),
    ];
  }, [activeTaskId, tasks]);
  const activeQueueTaskCompletedCount =
    activeQueueTask?.completedCriteria?.length ?? 0;
  const activeQueueTaskCriteriaCount = activeQueueTask?.criteria?.length ?? 0;
  const hasLiveTaskActivity = Boolean(
    activeQueueTask &&
    activeQueueTask.active &&
    activeQueueTask.status === "active",
  );
  const pollIntervalMs = hasLiveTaskActivity ? 1500 : 5000;

  // Keep the API intentionally split:
  // - sessions.tasks.* => queue-wide CRUD, ordering, and explicit execution
  // - sessions.task.* => lifecycle actions on the currently selected active task
  const requestTaskQueue = useCallback(
    async <T,>(method: string, params: Record<string, unknown> = {}) => {
      if (!request) throw new Error("Task queue RPC unavailable");
      return await request<T>(`sessions.tasks.${method}`, {
        key: sessionKey,
        ...params,
      });
    },
    [request, sessionKey],
  );
  const requestActiveTask = useCallback(
    async <T,>(method: string, params: Record<string, unknown> = {}) => {
      if (!request) throw new Error("Active task RPC unavailable");
      return await request<T>(`sessions.task.${method}`, {
        key: sessionKey,
        ...params,
      });
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
      setTaskEvents(Array.isArray(result?.taskEvents) ? result.taskEvents : []);
      setActiveTaskId(nextActiveTaskId);
      setSelectedTaskId((current) => {
        if (current && nextTasks.some((task) => task.id === current)) {
          return current;
        }
        return nextActiveTaskId ?? nextTasks[0]?.id;
      });

      const draftRaw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(draftStorageKey)
          : null;
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
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
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
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
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
    const hasDraft =
      createGoal.trim() ||
      createDefinitionOfDone.trim() ||
      createCriteriaText.trim();
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
      const assignment = selectedTask.assignment;
      setEditAssigneeType(assignment?.assigneeType ?? "agent");
      setEditAssigneeId(assignment?.assigneeId ?? "");
      setEditExecutorKind(assignment?.executorKind ?? "edwin");
      setEditExecutorId(assignment?.executorId ?? "");
      setEditApprovalState(assignment?.approvalState ?? "not_required");
      setEditRunState(assignment?.runState ?? "not_started");
      setEditRunId(assignment?.runId ?? "");
      setEditAssignmentPrompt(assignment?.prompt ?? "");
      setEditAssignmentArtifacts((assignment?.artifacts ?? []).join("\n"));
      setEditAssignmentLogPath(assignment?.logPath ?? "");
      setEditAssignmentResultSummary(assignment?.resultSummary ?? "");
      setEditStepsText(formatTaskSteps(selectedTask.steps));
    }
  }, [editorDirty, selectedTask]);

  useEffect(() => {
    setBlockReasonInput(selectedTask?.blockedReason ?? "");
    setNeedsUserReasonInput(selectedTask?.needsUserReason ?? "");
  }, [
    selectedTask?.blockedReason,
    selectedTask?.needsUserReason,
    selectedTask?.id,
    sessionKey,
  ]);

  const createTask = useCallback(
    async (parentTaskId?: string) => {
      if (!request || !createGoal.trim()) return;
      setSaving(true);
      setError(null);
      setStatus(null);
      try {
        const parsedMaxIterations = Number.parseInt(createMaxIterations, 10);
        const parsedDelayMs = Number.parseInt(createDelayMs, 10);
        const taskId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `task-${Date.now()}`;
        await requestTaskQueue<TaskQueueResult>("create", {
          taskId,
          taskGoal: createGoal,
          parentTaskId,
          taskDefinitionOfDone: createDefinitionOfDone,
          taskCriteria: parseCriteria(createCriteriaText),
          taskAutoContinueEnabled: createAutoContinueEnabled,
          taskMaxIterations: Number.isFinite(parsedMaxIterations)
            ? parsedMaxIterations
            : undefined,
          taskDelayMs: Number.isFinite(parsedDelayMs)
            ? parsedDelayMs
            : undefined,
        });
        if (createColumnId !== "queue") {
          await requestTaskQueue<TaskQueueResult>("move", {
            taskId,
            boardColumn: createColumnId,
          });
        }
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(draftStorageKey);
        }
        setCreateGoal("");
        setCreateDefinitionOfDone("");
        setCreateCriteriaText("");
        setCreateAutoContinueEnabled(true);
        setCreateMaxIterations("25");
        setCreateDelayMs("1500");
        setStatus(
          parentTaskId
            ? `Child task queued in ${getBoardColumnTitle(createColumnId)}.`
            : `Task queued in ${getBoardColumnTitle(createColumnId)}.`,
        );
        setTasksView("board");
        await refresh();
        await notifyTasksChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [
      createAutoContinueEnabled,
      createCriteriaText,
      createDefinitionOfDone,
      createDelayMs,
      createGoal,
      createColumnId,
      createMaxIterations,
      draftStorageKey,
      notifyTasksChanged,
      refresh,
      request,
      requestTaskQueue,
    ],
  );

  const selectQueueTask = useCallback(
    async (taskId: string) => {
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
    },
    [notifyTasksChanged, refresh, request, requestTaskQueue],
  );

  const updateSelectedTask = useCallback(async () => {
    if (!request || !selectedTask?.id || !editGoal.trim()) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const parsedMaxIterations = Number.parseInt(editMaxIterations, 10);
      const parsedDelayMs = Number.parseInt(editDelayMs, 10);
      const taskAssignment: TaskAssignment = {
        assigneeType: editAssigneeType.trim() || undefined,
        assigneeId: editAssigneeId.trim() || undefined,
        executorKind: editExecutorKind,
        executorId: editExecutorId.trim() || undefined,
        approvalState: editApprovalState,
        runState: editRunState,
        runId: editRunId.trim() || undefined,
        sessionKey,
        prompt: editAssignmentPrompt.trim() || undefined,
        artifacts: parseCriteria(editAssignmentArtifacts),
        logPath: editAssignmentLogPath.trim() || undefined,
        resultSummary: editAssignmentResultSummary.trim() || undefined,
      };
      await requestTaskQueue<TaskQueueResult>("update", {
        taskId: selectedTask.id,
        taskGoal: editGoal,
        taskDefinitionOfDone: editDefinitionOfDone,
        taskCriteria: parseCriteria(editCriteriaText),
        taskAssignment,
        taskSteps: parseTaskSteps(editStepsText),
        taskAutoContinueEnabled: editAutoContinueEnabled,
        taskMaxIterations: Number.isFinite(parsedMaxIterations)
          ? parsedMaxIterations
          : undefined,
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
    editAssignmentArtifacts,
    editAssignmentLogPath,
    editAssignmentPrompt,
    editAssignmentResultSummary,
    editApprovalState,
    editAssigneeId,
    editAssigneeType,
    editAutoContinueEnabled,
    editCriteriaText,
    editDefinitionOfDone,
    editDelayMs,
    editExecutorId,
    editExecutorKind,
    editStepsText,
    editGoal,
    editMaxIterations,
    editRunId,
    editRunState,
    notifyTasksChanged,
    refresh,
    request,
    requestTaskQueue,
    selectedTask?.id,
  ]);

  const deleteTask = useCallback(
    async (taskId: string) => {
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
    },
    [notifyTasksChanged, refresh, request, requestTaskQueue, selectedTaskId],
  );

  const deleteSelectedTask = useCallback(async () => {
    if (!selectedTask?.id) return;
    await deleteTask(selectedTask.id);
  }, [deleteTask, selectedTask?.id]);

  const moveTaskToColumn = useCallback(
    async (taskId: string, boardColumn: BoardColumnId) => {
      if (!request) return;
      setSaving(true);
      setError(null);
      setStatus(null);
      try {
        await requestTaskQueue<TaskQueueResult>("move", {
          taskId,
          boardColumn,
        });
        setSelectedTaskId(taskId);
        setStatus(`Task moved to ${boardColumn}.`);
        await refresh();
        await notifyTasksChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [notifyTasksChanged, refresh, request, requestTaskQueue],
  );

  const moveSelectedTask = useCallback(
    async (direction: -1 | 1) => {
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
    },
    [
      notifyTasksChanged,
      refresh,
      request,
      requestTaskQueue,
      selectedTask?.id,
      tasks,
    ],
  );

  const runSelectedTaskAction = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (!request || !selectedTask?.id) return;
      setSaving(true);
      setError(null);
      setStatus(null);
      try {
        if (activeTaskId !== selectedTask.id) {
          await requestTaskQueue<TaskQueueResult>("select", {
            taskId: selectedTask.id,
          });
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
    },
    [
      activeTaskId,
      notifyTasksChanged,
      refresh,
      request,
      requestActiveTask,
      requestTaskQueue,
      selectedTask?.id,
    ],
  );

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
  }, [
    notifyTasksChanged,
    onOpenChat,
    refresh,
    request,
    requestTaskQueue,
    sessionKey,
  ]);

  const selectTaskInQueue = useCallback((task: TaskRecord) => {
    setSelectedTaskId(task.id);
    setTasksView("task");
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

  const openAddTaskPage = useCallback((columnId: BoardColumnId) => {
    setCreateColumnId(columnId);
    setTasksView("add");
  }, []);

  const goBackToBoard = useCallback(() => {
    setTasksView("board");
  }, []);

  const renderTaskRows = useCallback(
    (sectionTasks: TaskRecord[], currentColumnId?: BoardColumnId) => {
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
                  <div className="font-medium truncate">
                    {getTaskTitle(task)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(task.completedCriteria ?? []).length}/
                    {(task.criteria ?? []).length} complete
                  </div>
                  {childTasksByParent.get(task.id ?? "")?.length ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Children:{" "}
                      {childTasksByParent
                        .get(task.id ?? "")
                        ?.filter(isTaskCompleted).length ?? 0}
                      /{childTasksByParent.get(task.id ?? "")?.length ?? 0} done
                      {childTasksByParent
                        .get(task.id ?? "")
                        ?.some(
                          (child) =>
                            isTaskBlocked(child) || isTaskNeedsUser(child),
                        )
                        ? " · blocked/waiting"
                        : ""}
                    </div>
                  ) : null}
                  {childTasksByParent.get(task.id ?? "")?.length ? (
                    <div className="mt-2 space-y-1 border-l pl-2 text-xs text-muted-foreground">
                      {childTasksByParent.get(task.id ?? "")?.map((child) => (
                        <div key={child.id ?? getTaskTitle(child)}>
                          ↳ {getTaskTitle(child)} ·{" "}
                          {getTaskStatusLabel(child, activeTaskId)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {getTaskAssigneeLabel(task) && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Assignee: {getTaskAssigneeLabel(task)}
                    </div>
                  )}
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
                  <Badge
                    variant={task.id === activeTaskId ? "default" : "secondary"}
                  >
                    {getTaskStatusLabel(task, activeTaskId)}
                  </Badge>
                  {task.autoContinueEnabled && (
                    <Badge variant="outline">auto</Badge>
                  )}
                </div>
              </div>
            </button>
            <div className="mt-1 flex shrink-0 flex-col gap-2">
              <Select
                value={
                  currentColumnId ?? getTaskBoardColumn(task, activeTaskId)
                }
                onValueChange={(value) =>
                  task.id && moveTaskToColumn(task.id, value as BoardColumnId)
                }
                disabled={saving || !task.id}
              >
                <SelectTrigger
                  className="h-7 w-[116px] text-xs"
                  aria-label={`Move ${getTaskTitle(task)} to column`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbox">Inbox</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="queue">Queue</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="self-end"
                aria-label={`Delete ${getTaskTitle(task)}`}
                title={`Delete ${getTaskTitle(task)}`}
                onClick={() => task.id && deleteTask(task.id)}
                disabled={saving || !task.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      });
    },
    [
      activeTaskId,
      childTasksByParent,
      deleteTask,
      moveTaskToColumn,
      saving,
      selectTaskInQueue,
      selectedTaskId,
    ],
  );

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6" />
            Tasks
          </h2>
          <p className="text-sm text-muted-foreground">
            Queue deterministic session tasks, choose the current task
            explicitly, and watch progress live.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={executeQueuedTasks}
            disabled={loading || saving || runnableTaskCount === 0}
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            Execute Tasks
            {runnableTaskCount > 0 ? ` (${runnableTaskCount})` : ""}
          </Button>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading || saving}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {!request && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          Task controls are unavailable until the gateway connection is ready.
        </div>
      )}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {status && <div className="text-sm text-muted-foreground">{status}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Session Scope</CardTitle>
          <CardDescription>
            Choose which session this task queue belongs to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Session</label>
            <Select
              value={sessionKey}
              onValueChange={(value) => onSelectSession?.(value)}
            >
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
            <div>
              <strong>Current session:</strong>{" "}
              {getSessionTitle(
                currentSession ?? { key: sessionKey, displayName: sessionKey },
              )}
            </div>
            {activeQueueTask ? (
              <>
                <div>
                  <strong>Current active task:</strong> selected below
                </div>
                <div className="text-muted-foreground">
                  {getTaskStatusLabel(activeQueueTask, activeTaskId)} ·{" "}
                  {activeQueueTaskCompletedCount}/{activeQueueTaskCriteriaCount}{" "}
                  complete
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                No active task selected yet.
              </div>
            )}
            <div className="text-muted-foreground">
              Queue: {tasks.length} total · {runnableTaskCount} executable
            </div>
          </div>
        </CardContent>
      </Card>

      {tasksView === "board" && (
        <div className="space-y-6">
          <Card className="min-h-[520px]">
            <CardHeader>
              <CardTitle>Task Board</CardTitle>
              <CardDescription>
                GTD-style board over the canonical Edwin task queue. The current
                execution queue is the Queue / Executing column.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks in this session yet.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {boardColumns.map((column) => (
                    <div
                      key={column.id}
                      className="rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {column.title}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {column.description}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline">{column.tasks.length}</Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openAddTaskPage(column.id)}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {column.tasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No tasks.
                          </p>
                        ) : (
                          renderTaskRows(column.tasks, column.id)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tasksView === "add" && (
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardHeader>
              <Button
                type="button"
                variant="ghost"
                className="mb-2 w-fit px-0"
                onClick={goBackToBoard}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tasks
              </Button>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Task
              </CardTitle>
              <CardDescription>
                Create a new task in the current session scope.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                Queue:{" "}
                <strong className="text-foreground">{createColumnId}</strong> ·
                Scope:{" "}
                <strong className="text-foreground">
                  {getSessionTitle(
                    currentSession ?? {
                      key: sessionKey,
                      displayName: sessionKey,
                    },
                  )}
                </strong>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="create-task-goal"
                  className="text-sm font-medium"
                >
                  Goal
                </label>
                <Input
                  id="create-task-goal"
                  value={createGoal}
                  onChange={(e) => setCreateGoal(e.target.value)}
                  placeholder="Build multi-task queue support for Edwin"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="create-task-definition"
                  className="text-sm font-medium"
                >
                  Definition of done
                </label>
                <Textarea
                  id="create-task-definition"
                  value={createDefinitionOfDone}
                  onChange={(e) => setCreateDefinitionOfDone(e.target.value)}
                  rows={3}
                  placeholder="Describe exactly what must be true before this task is done."
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="create-task-criteria"
                  className="text-sm font-medium"
                >
                  Criteria (one per line)
                </label>
                <Textarea
                  id="create-task-criteria"
                  value={createCriteriaText}
                  onChange={(e) => setCreateCriteriaText(e.target.value)}
                  rows={5}
                  placeholder={
                    "backend queue model implemented\ngateway queue APIs implemented\ndesktop Tasks tab supports multiple tasks"
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Auto-continue</label>
                  <div className="flex h-10 items-center rounded-md border px-3">
                    <Switch
                      checked={createAutoContinueEnabled}
                      onCheckedChange={setCreateAutoContinueEnabled}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="create-task-max-iterations"
                    className="text-sm font-medium"
                  >
                    Max iterations
                  </label>
                  <Input
                    id="create-task-max-iterations"
                    value={createMaxIterations}
                    onChange={(e) => setCreateMaxIterations(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="create-task-delay"
                    className="text-sm font-medium"
                  >
                    Delay (ms)
                  </label>
                  <Input
                    id="create-task-delay"
                    value={createDelayMs}
                    onChange={(e) => setCreateDelayMs(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    selectedTask?.id && createTask(selectedTask.id)
                  }
                  disabled={saving || !createGoal.trim() || !selectedTask?.id}
                >
                  {saving ? "Saving..." : "Queue as child"}
                </Button>
                <Button
                  onClick={() => createTask()}
                  disabled={saving || !createGoal.trim()}
                >
                  {saving ? "Saving..." : "Queue task"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tasksView === "task" && (
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-0"
                  onClick={goBackToBoard}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Tasks
                </Button>
                {selectedTask && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openAddTaskPage("ready")}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add child task
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTasksView("run")}
                    >
                      <CircleDot className="mr-2 h-4 w-4" />
                      Run detail
                    </Button>
                  </div>
                )}
              </div>
              <CardTitle>Selected Task</CardTitle>
              <CardDescription>
                Edit the selected task, control its place in the queue, and
                manage progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedTask ? (
                <p className="text-sm text-muted-foreground">
                  Select a task from the queue to inspect and edit it.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        selectedTask.id === activeTaskId
                          ? "default"
                          : "secondary"
                      }
                    >
                      {getTaskStatusLabel(selectedTask, activeTaskId)}
                    </Badge>
                    <Badge variant="outline">
                      {(selectedTask.completedCriteria ?? []).length}/
                      {(selectedTask.criteria ?? []).length} complete
                    </Badge>
                    {selectedTask.autoContinueEnabled && (
                      <Badge>Auto-continue on</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        selectedTask.id && selectQueueTask(selectedTask.id)
                      }
                      disabled={saving || selectedTask.id === activeTaskId}
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Make current
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveSelectedTask(-1)}
                      disabled={
                        saving ||
                        tasks.findIndex(
                          (task) => task.id === selectedTask.id,
                        ) <= 0
                      }
                    >
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Move up
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveSelectedTask(1)}
                      disabled={
                        saving ||
                        tasks.findIndex(
                          (task) => task.id === selectedTask.id,
                        ) ===
                          tasks.length - 1
                      }
                    >
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Move down
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={deleteSelectedTask}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Goal</label>
                    <Input
                      value={editGoal}
                      onChange={(e) => {
                        setEditGoal(e.target.value);
                        setEditorDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Definition of done
                    </label>
                    <Textarea
                      value={editDefinitionOfDone}
                      onChange={(e) => {
                        setEditDefinitionOfDone(e.target.value);
                        setEditorDirty(true);
                      }}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Criteria (one per line)
                    </label>
                    <Textarea
                      value={editCriteriaText}
                      onChange={(e) => {
                        setEditCriteriaText(e.target.value);
                        setEditorDirty(true);
                      }}
                      rows={5}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Auto-continue
                      </label>
                      <div className="flex h-10 items-center rounded-md border px-3">
                        <Switch
                          checked={editAutoContinueEnabled}
                          onCheckedChange={(value) => {
                            setEditAutoContinueEnabled(value);
                            setEditorDirty(true);
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Max iterations
                      </label>
                      <Input
                        value={editMaxIterations}
                        onChange={(e) => {
                          setEditMaxIterations(e.target.value);
                          setEditorDirty(true);
                        }}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Delay (ms)</label>
                      <Input
                        value={editDelayMs}
                        onChange={(e) => {
                          setEditDelayMs(e.target.value);
                          setEditorDirty(true);
                        }}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold">Assignment</div>
                      <div className="text-xs text-muted-foreground">
                        Choose who owns this task and which executor should run
                        it.
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Assignee type
                        </label>
                        <Input
                          value={editAssigneeType}
                          onChange={(e) => {
                            setEditAssigneeType(e.target.value);
                            setEditorDirty(true);
                          }}
                          placeholder="agent, human, team"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Assignee ID
                        </label>
                        <Input
                          aria-label="Assignee ID"
                          value={editAssigneeId}
                          onChange={(e) => {
                            setEditAssigneeId(e.target.value);
                            setEditorDirty(true);
                          }}
                          placeholder="edwin-main, jake"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Executor</label>
                        <Select
                          value={editExecutorKind}
                          onValueChange={(value) => {
                            setEditExecutorKind(value as TaskExecutorKind);
                            setEditorDirty(true);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="edwin">Edwin</SelectItem>
                            <SelectItem value="human">Human</SelectItem>
                            <SelectItem value="workflow">Workflow</SelectItem>
                            <SelectItem value="subagent">Subagent</SelectItem>
                            <SelectItem value="codex">Codex</SelectItem>
                            <SelectItem value="claude-code">
                              Claude Code
                            </SelectItem>
                            <SelectItem value="opencode">OpenCode</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Executor ID
                        </label>
                        <Input
                          aria-label="Executor ID"
                          value={editExecutorId}
                          onChange={(e) => {
                            setEditExecutorId(e.target.value);
                            setEditorDirty(true);
                          }}
                          placeholder="codex-cli, workflow name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Approval</label>
                        <Select
                          value={editApprovalState}
                          onValueChange={(value) => {
                            setEditApprovalState(value as TaskApprovalState);
                            setEditorDirty(true);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_required">
                              Not required
                            </SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Run state</label>
                        <Select
                          value={editRunState}
                          onValueChange={(value) => {
                            setEditRunState(value as TaskRunState);
                            setEditorDirty(true);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">
                              Not started
                            </SelectItem>
                            <SelectItem value="queued">Queued</SelectItem>
                            <SelectItem value="running">Running</SelectItem>
                            <SelectItem value="succeeded">Succeeded</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Run ID</label>
                        <Input
                          value={editRunId}
                          onChange={(e) => {
                            setEditRunId(e.target.value);
                            setEditorDirty(true);
                          }}
                          placeholder="run/session id"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Log path</label>
                        <Input
                          value={editAssignmentLogPath}
                          onChange={(e) => {
                            setEditAssignmentLogPath(e.target.value);
                            setEditorDirty(true);
                          }}
                          placeholder="runs/<id>/log.txt"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Executor prompt
                      </label>
                      <Textarea
                        aria-label="Executor prompt"
                        value={editAssignmentPrompt}
                        onChange={(e) => {
                          setEditAssignmentPrompt(e.target.value);
                          setEditorDirty(true);
                        }}
                        rows={3}
                        placeholder="Prompt or handoff for the assigned executor."
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Artifacts (one per line)
                        </label>
                        <Textarea
                          aria-label="Artifacts (one per line)"
                          value={editAssignmentArtifacts}
                          onChange={(e) => {
                            setEditAssignmentArtifacts(e.target.value);
                            setEditorDirty(true);
                          }}
                          rows={3}
                          placeholder="docs/file.md
runs/run-id/result.json"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Result summary
                        </label>
                        <Textarea
                          value={editAssignmentResultSummary}
                          onChange={(e) => {
                            setEditAssignmentResultSummary(e.target.value);
                            setEditorDirty(true);
                          }}
                          rows={3}
                          placeholder="Latest execution result or handoff summary."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold">Steps</div>
                      <div className="text-xs text-muted-foreground">
                        One step per line: title | executor | status. Executors
                        can be edwin, human, workflow, subagent, codex,
                        claude-code, opencode, or custom.
                      </div>
                    </div>
                    <Textarea
                      aria-label="Task steps"
                      value={editStepsText}
                      onChange={(e) => {
                        setEditStepsText(e.target.value);
                        setEditorDirty(true);
                      }}
                      rows={5}
                      placeholder={
                        "Design schema | edwin | active\nImplement slice | codex | active\nReview result | human | review"
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={updateSelectedTask}
                      disabled={saving || !selectedTask.id || !editGoal.trim()}
                    >
                      {saving ? "Saving..." : "Update task"}
                    </Button>
                  </div>

                  {selectedTask.lastEvaluationReason && (
                    <div className="text-sm text-muted-foreground">
                      {selectedTask.lastEvaluationReason}
                    </div>
                  )}
                  <div className="space-y-2">
                    {(selectedTask.criteria ?? []).map((criterion) => {
                      const done = (
                        selectedTask.completedCriteria ?? []
                      ).includes(criterion);
                      return (
                        <div
                          key={criterion}
                          className="flex items-center justify-between gap-3 rounded border p-3"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>{criterion}</span>
                          </div>
                          {!done && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                runSelectedTaskAction("complete_criteria", {
                                  criteria: [criterion],
                                })
                              }
                              disabled={saving}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Button
                      className="justify-start"
                      variant="outline"
                      onClick={() => runSelectedTaskAction("clear_block")}
                      disabled={saving || !selectedTask.blockedReason}
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Clear blocked
                    </Button>
                    <Button
                      className="justify-start"
                      variant="outline"
                      onClick={() => runSelectedTaskAction("clear_needs_user")}
                      disabled={saving || !selectedTask.needsUserReason}
                    >
                      <UserCircle2 className="h-4 w-4 mr-2" />
                      Clear needs user
                    </Button>
                    <div className="flex gap-2 xl:col-span-2">
                      <Input
                        value={blockReasonInput}
                        onChange={(e) => setBlockReasonInput(e.target.value)}
                        placeholder="Explain what is blocked"
                      />
                      <Button
                        className="justify-start"
                        variant="outline"
                        onClick={() =>
                          runSelectedTaskAction("block", {
                            reason: blockReasonInput.trim(),
                          })
                        }
                        disabled={saving || !blockReasonInput.trim()}
                      >
                        <PauseCircle className="h-4 w-4 mr-2" />
                        Mark blocked
                      </Button>
                    </div>
                    <div className="flex gap-2 xl:col-span-2">
                      <Input
                        value={needsUserReasonInput}
                        onChange={(e) =>
                          setNeedsUserReasonInput(e.target.value)
                        }
                        placeholder="Explain what user input is needed"
                      />
                      <Button
                        className="justify-start"
                        variant="outline"
                        onClick={() =>
                          runSelectedTaskAction("needs_user", {
                            reason: needsUserReasonInput.trim(),
                          })
                        }
                        disabled={saving || !needsUserReasonInput.trim()}
                      >
                        <UserCircle2 className="h-4 w-4 mr-2" />
                        Mark needs user
                      </Button>
                    </div>
                    <Button
                      className="justify-start"
                      onClick={() => runSelectedTaskAction("finish")}
                      disabled={saving}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Finish task
                    </Button>
                  </div>

                  {(selectedTask.blockedReason ||
                    selectedTask.needsUserReason ||
                    remainingCriteria.length > 0) && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                      {selectedTask.blockedReason && (
                        <div>
                          <strong>Blocked:</strong> {selectedTask.blockedReason}
                        </div>
                      )}
                      {selectedTask.needsUserReason && (
                        <div>
                          <strong>Needs user:</strong>{" "}
                          {selectedTask.needsUserReason}
                        </div>
                      )}
                      {remainingCriteria.length > 0 && (
                        <div>
                          <strong>Remaining:</strong>{" "}
                          {remainingCriteria.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tasksView === "run" && (
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardHeader>
              <Button
                type="button"
                variant="ghost"
                className="mb-2 w-fit px-0"
                onClick={goBackToBoard}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tasks
              </Button>
              <CardTitle className="flex items-center gap-2">
                <CircleDot className="h-5 w-5" />
                Task Run Detail
              </CardTitle>
              <CardDescription>
                Live execution summary for the selected task: current step,
                criteria progress, and recent activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedTask ? (
                <p className="text-sm text-muted-foreground">
                  Select a task from the queue to see what is happening.
                </p>
              ) : (
                <>
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Currently doing
                        </div>
                        <div className="mt-1 text-sm font-medium">
                          {selectedTaskCurrentStep}
                        </div>
                      </div>
                      <Badge
                        variant={
                          selectedTask.id === activeTaskId
                            ? "default"
                            : "secondary"
                        }
                      >
                        {getTaskStatusLabel(selectedTask, activeTaskId)}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Criteria progress</span>
                        <span>
                          {selectedTaskProgress.completed}/
                          {selectedTaskProgress.total} ·{" "}
                          {selectedTaskProgress.percent}%
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        aria-label={`Task progress ${selectedTaskProgress.percent}%`}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${selectedTaskProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Recent activity
                    </div>
                    <div className="space-y-2">
                      {selectedTaskActivity.map((entry, index) => (
                        <div
                          key={`${entry}-${index}`}
                          className="flex gap-2 rounded-md border p-2 text-sm"
                        >
                          <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span>{entry}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
