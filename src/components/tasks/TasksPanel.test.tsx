import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TasksPanel } from "./TasksPanel";

type TasksPanelRequest = NonNullable<
  ComponentProps<typeof TasksPanel>["request"]
>;

type TestTask = {
  id: string;
  goal: string;
  definitionOfDone?: string;
  status?: "active" | "done" | "blocked" | "needs_user" | "review";
  criteria?: string[];
  completedCriteria?: string[];
  autoContinueEnabled?: boolean;
  active?: boolean;
  blockedReason?: string;
  needsUserReason?: string;
  lastEvaluationReason?: string;
  maxIterations?: number;
  delayMs?: number;
  title?: string;
  parentTaskId?: string;
  childTaskIds?: string[];
  assignedAgentType?: string;
  assignedAgentId?: string;
  assignedProfileId?: string;
  assignedDisciplineId?: string;
  assignedSessionKey?: string;
  boardColumn?: "inbox" | "ready" | "queue" | "waiting" | "review" | "done";
  taskSource?: { kind?: string; path?: string; fileStatus?: string };
};

function createTaskRequest(
  initialTasks: TestTask[],
  initialActiveTaskId = initialTasks[0]?.id,
) {
  let tasks = initialTasks.map((task) => ({ ...task }));
  let activeTaskId = initialActiveTaskId;
  const taskEvents = [
    {
      id: "event-1",
      ts: 1_700_000_000_000,
      taskId: initialActiveTaskId,
      type: "execute_requested",
      message: "Task execution requested: Sweep the desktop UI",
    },
  ];

  const syncActiveFlags = () => {
    tasks = tasks.map((task) => ({
      ...task,
      active: task.id === activeTaskId,
    }));
  };
  syncActiveFlags();

  const requestMock = vi.fn(
    async (method: string, params?: Record<string, unknown>) => {
      switch (method) {
        case "sessions.tasks.list":
          syncActiveFlags();
          return { activeTaskId, tasks, taskEvents };
        case "sessions.tasks.create": {
          const nextTask: TestTask = {
            id: `task-${tasks.length + 1}`,
            goal: String(params?.taskGoal ?? ""),
            parentTaskId:
              typeof params?.parentTaskId === "string"
                ? params.parentTaskId
                : undefined,
            definitionOfDone: String(params?.taskDefinitionOfDone ?? ""),
            criteria: Array.isArray(params?.taskCriteria)
              ? params?.taskCriteria.map(String)
              : [],
            completedCriteria: [],
            status: "active",
            autoContinueEnabled: params?.taskAutoContinueEnabled !== false,
            maxIterations: Number(params?.taskMaxIterations ?? 25),
            delayMs: Number(params?.taskDelayMs ?? 1500),
            active: false,
          };
          tasks.push(nextTask);
          return { ok: true };
        }
        case "sessions.tasks.delete":
          tasks = tasks.filter((task) => task.id !== params?.taskId);
          if (activeTaskId === params?.taskId) {
            activeTaskId = tasks[0]?.id;
          }
          return { ok: true };
        case "sessions.tasks.select":
          activeTaskId = String(params?.taskId ?? activeTaskId);
          syncActiveFlags();
          return { ok: true, activeTaskId, tasks };
        case "sessions.tasks.update":
          tasks = tasks.map((task) =>
            task.id === params?.taskId
              ? {
                  ...task,
                  goal: String(params?.taskGoal ?? task.goal),
                  definitionOfDone: String(
                    params?.taskDefinitionOfDone ?? task.definitionOfDone ?? "",
                  ),
                  criteria: Array.isArray(params?.taskCriteria)
                    ? params?.taskCriteria.map(String)
                    : task.criteria,
                  autoContinueEnabled:
                    typeof params?.taskAutoContinueEnabled === "boolean"
                      ? params.taskAutoContinueEnabled
                      : task.autoContinueEnabled,
                  maxIterations:
                    typeof params?.taskMaxIterations === "number"
                      ? params.taskMaxIterations
                      : task.maxIterations,
                  delayMs:
                    typeof params?.taskDelayMs === "number"
                      ? params.taskDelayMs
                      : task.delayMs,
                }
              : task,
          );
          return { ok: true, activeTaskId, tasks };
        case "sessions.tasks.move":
          tasks = tasks.map((task) =>
            task.id === params?.taskId
              ? {
                  ...task,
                  boardColumn: params?.boardColumn as TestTask["boardColumn"],
                  status:
                    params?.boardColumn === "done"
                      ? "done"
                      : params?.boardColumn === "review"
                        ? "review"
                        : params?.boardColumn === "waiting"
                          ? "blocked"
                          : "active",
                }
              : task,
          );
          if (params?.boardColumn === "queue") {
            activeTaskId = String(params?.taskId ?? activeTaskId);
          }
          syncActiveFlags();
          return { ok: true, activeTaskId, tasks };
        case "sessions.tasks.reorder": {
          const ids = Array.isArray(params?.taskIds)
            ? params.taskIds.map(String)
            : [];
          tasks = ids
            .map((id) => tasks.find((task) => task.id === id))
            .filter((task): task is TestTask => Boolean(task));
          syncActiveFlags();
          return { ok: true, activeTaskId, tasks };
        }
        case "sessions.tasks.execute":
          return { ok: true, activeTaskId, tasks };
        case "sessions.task.action": {
          const action = String(params?.action ?? "");
          tasks = tasks.map((task) => {
            if (task.id !== activeTaskId) return task;
            if (action === "complete_criteria") {
              const criteria = Array.isArray(params?.criteria)
                ? params.criteria.map(String)
                : [];
              return {
                ...task,
                completedCriteria: Array.from(
                  new Set([...(task.completedCriteria ?? []), ...criteria]),
                ),
              };
            }
            if (action === "block") {
              return {
                ...task,
                status: "blocked",
                blockedReason: String(params?.reason ?? ""),
              };
            }
            if (action === "clear_block") {
              return {
                ...task,
                status: "active",
                blockedReason: undefined,
              };
            }
            if (action === "needs_user") {
              return {
                ...task,
                status: "needs_user",
                needsUserReason: String(params?.reason ?? ""),
              };
            }
            if (action === "clear_needs_user") {
              return {
                ...task,
                status: "active",
                needsUserReason: undefined,
              };
            }
            return task;
          });
          syncActiveFlags();
          return { ok: true, activeTaskId, tasks };
        }
        default:
          return {};
      }
    },
  );

  return Object.assign(
    ((method: string, params?: Record<string, unknown>) =>
      requestMock(method, params)) as TasksPanelRequest,
    requestMock,
  );
}

describe("TasksPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads a queued task list, executes queued tasks, and creates a new task", async () => {
    const request = createTaskRequest([
      {
        id: "task-a",
        goal: "Sweep the desktop UI",
        definitionOfDone:
          "Entire Desktop UI has been clicked-through, tested, debugged, and verified.",
        status: "active",
        criteria: ["all reachable views tested", "all fixes verified"],
        completedCriteria: ["all reachable views tested"],
        autoContinueEnabled: true,
        active: true,
        lastEvaluationReason: "Remaining criteria: all fixes verified",
      },
      {
        id: "task-b",
        goal: "Ship queue UI",
        status: "active",
        criteria: ["queue list visible"],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: false,
      },
    ]);

    const onOpenChat = vi.fn();

    render(
      <TasksPanel
        sessionKey="agent:main:main"
        request={request}
        onOpenChat={onOpenChat}
      />,
    );

    expect(await screen.findByText("Task Board")).toBeInTheDocument();
    expect(screen.getByText("Queue / Executing")).toBeInTheDocument();
    expect(await screen.findByText("Sweep the desktop UI")).toBeInTheDocument();
    expect(screen.getByText("Ship queue UI")).toBeInTheDocument();
    expect(screen.getAllByText("running").length).toBeGreaterThan(0);
    expect(screen.getAllByText("queued").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByText("Sweep the desktop UI"));
    await userEvent.click(screen.getByRole("button", { name: "Run detail" }));
    expect(screen.getByText("Task Run Detail")).toBeInTheDocument();
    expect(screen.getByText("Currently doing")).toBeInTheDocument();
    expect(
      screen.getByText("Working toward: all fixes verified"),
    ).toBeInTheDocument();
    expect(screen.getByText("Criteria progress")).toBeInTheDocument();
    expect(screen.getByText("1/2 · 50%")).toBeInTheDocument();
    expect(
      screen.getByText(/Task execution requested: Sweep the desktop UI/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tasks" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Execute Tasks (2)" }),
    );
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.tasks.execute", {
        key: "agent:main:main",
      });
    });
    expect(onOpenChat).toHaveBeenCalledWith("agent:main:main");

    await userEvent.click(screen.getAllByRole("button", { name: "Add" })[0]!);
    await userEvent.type(
      screen.getByLabelText("Goal"),
      "Build task queue desktop UI",
    );
    await userEvent.type(
      screen.getByLabelText("Definition of done"),
      "Desktop can create and manage multiple queued tasks.",
    );
    await userEvent.type(
      screen.getByLabelText("Criteria (one per line)"),
      "queue list visible\ncreate task works",
    );
    await userEvent.click(screen.getByRole("button", { name: "Queue task" }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        "sessions.tasks.create",
        expect.objectContaining({
          key: "agent:main:main",
          taskId: expect.any(String),
          taskGoal: "Build task queue desktop UI",
          taskDefinitionOfDone:
            "Desktop can create and manage multiple queued tasks.",
          taskCriteria: ["queue list visible", "create task works"],
          taskAutoContinueEnabled: true,
          taskMaxIterations: 25,
          taskDelayMs: 1500,
        }),
      );
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Ship queue UI" }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.tasks.delete", {
        key: "agent:main:main",
        taskId: "task-b",
      });
    });
  });

  it("renders kanban columns with child rollups and assignees", async () => {
    const request = createTaskRequest([
      {
        id: "parent",
        goal: "Parent task",
        status: "active",
        criteria: ["parent criterion"],
        completedCriteria: [],
        autoContinueEnabled: false,
        assignedAgentType: "edwin",
      },
      {
        id: "child-done",
        goal: "Child done",
        parentTaskId: "parent",
        status: "done",
        criteria: ["child criterion"],
        completedCriteria: ["child criterion"],
      },
      {
        id: "child-blocked",
        goal: "Child blocked",
        parentTaskId: "parent",
        status: "blocked",
        blockedReason: "Waiting on dependency",
      },
      {
        id: "inbox",
        title: "Inbox task",
        goal: "Inbox task",
        status: "needs_user",
        taskSource: { kind: "memory-file", fileStatus: "inbox" },
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText("Task Board")).toBeInTheDocument();
    expect(screen.getAllByText("Inbox").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(screen.getByText("Queue / Executing")).toBeInTheDocument();
    expect(screen.getByText("Waiting / Blocked")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
    expect(screen.getByText("Parent task")).toBeInTheDocument();
    expect(screen.getByText(/Children: 1\/2 done/)).toBeInTheDocument();
    expect(screen.getByText(/blocked\/waiting/)).toBeInTheDocument();
    expect(screen.getByText(/↳ Child done · done/)).toBeInTheDocument();
    expect(screen.getByText(/↳ Child blocked · blocked/)).toBeInTheDocument();
    expect(screen.getByText("Assignee: edwin")).toBeInTheDocument();
    expect(screen.getByText("Inbox task")).toBeInTheDocument();
  });

  it("moves a task between kanban columns through the gateway move RPC", async () => {
    const request = createTaskRequest([
      {
        id: "task-a",
        goal: "Moveable task",
        status: "active",
        boardColumn: "ready",
        criteria: ["criterion"],
        completedCriteria: [],
        autoContinueEnabled: false,
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText("Moveable task")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("combobox", { name: "Move Moveable task to column" }),
    );
    await userEvent.click(screen.getByRole("option", { name: "Review" }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.tasks.move", {
        key: "agent:main:main",
        taskId: "task-a",
        boardColumn: "review",
      });
    });
  });

  it("supports select, update, reorder, completion, blocked, and needs-user flows", async () => {
    const request = createTaskRequest([
      {
        id: "task-a",
        goal: "First task",
        definitionOfDone: "Done first",
        status: "active",
        criteria: ["first criterion"],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: true,
      },
      {
        id: "task-b",
        goal: "Second task",
        definitionOfDone: "Done second",
        status: "active",
        criteria: ["second criterion"],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: false,
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText("First task")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Second task"));
    await userEvent.click(screen.getByRole("button", { name: "Make current" }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.tasks.select", {
        key: "agent:main:main",
        taskId: "task-b",
      });
    });

    const editGoalInput = screen.getByDisplayValue("Second task");
    await userEvent.clear(editGoalInput);
    await userEvent.type(editGoalInput, "Second task updated");
    await userEvent.type(screen.getByLabelText("Assignee ID"), "edwin-main");
    await userEvent.type(screen.getByLabelText("Executor ID"), "desktop-agent");
    await userEvent.type(
      screen.getByPlaceholderText(
        "Prompt or handoff for the assigned executor.",
      ),
      "Handle this task carefully.",
    );
    await userEvent.type(
      screen.getByLabelText("Artifacts (one per line)"),
      "runs/task-b/result.json",
    );
    await userEvent.type(
      screen.getByLabelText("Task steps"),
      "Design schema | edwin | active\nImplement slice | codex | active",
    );
    await userEvent.click(screen.getByRole("button", { name: "Update task" }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        "sessions.tasks.update",
        expect.objectContaining({
          key: "agent:main:main",
          taskId: "task-b",
          taskGoal: "Second task updated",
          taskDefinitionOfDone: "Done second",
          taskCriteria: ["second criterion"],
          taskSteps: [
            {
              id: "step-1",
              title: "Design schema",
              status: "active",
              assignment: {
                executorKind: "edwin",
                approvalState: "pending",
                runState: "not_started",
              },
            },
            {
              id: "step-2",
              title: "Implement slice",
              status: "active",
              assignment: {
                executorKind: "codex",
                approvalState: "pending",
                runState: "not_started",
              },
            },
          ],
          taskAssignment: {
            assigneeType: "agent",
            assigneeId: "edwin-main",
            executorKind: "edwin",
            executorId: "desktop-agent",
            approvalState: "not_required",
            runState: "not_started",
            runId: undefined,
            sessionKey: "agent:main:main",
            prompt: "Handle this task carefully.",
            artifacts: ["runs/task-b/result.json"],
            logPath: undefined,
            resultSummary: undefined,
          },
          taskAutoContinueEnabled: true,
          taskMaxIterations: 25,
          taskDelayMs: 1500,
        }),
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Move up" }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.tasks.reorder", {
        key: "agent:main:main",
        taskIds: ["task-b", "task-a"],
      });
    });

    await userEvent.click(screen.getByRole("button", { name: "Complete" }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.task.action", {
        key: "agent:main:main",
        action: "complete_criteria",
        criteria: ["second criterion"],
      });
    });

    const blockInput = screen.getByPlaceholderText("Explain what is blocked");
    await userEvent.type(blockInput, "Waiting on gateway patch");
    await userEvent.click(screen.getByRole("button", { name: "Mark blocked" }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.task.action", {
        key: "agent:main:main",
        action: "block",
        reason: "Waiting on gateway patch",
      });
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Clear blocked" }),
    );
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.task.action", {
        key: "agent:main:main",
        action: "clear_block",
      });
    });

    const needsUserInput = screen.getByPlaceholderText(
      "Explain what user input is needed",
    );
    await userEvent.type(needsUserInput, "Choose the final label copy");
    await userEvent.click(
      screen.getByRole("button", { name: "Mark needs user" }),
    );
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.task.action", {
        key: "agent:main:main",
        action: "needs_user",
        reason: "Choose the final label copy",
      });
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Clear needs user" }),
    );
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("sessions.task.action", {
        key: "agent:main:main",
        action: "clear_needs_user",
      });
    });
  });

  it("renders blocked and needs-user tasks in the waiting board column", async () => {
    const request = createTaskRequest([
      {
        id: "task-a",
        goal: "Working task",
        status: "active",
        criteria: ["criterion"],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: true,
      },
      {
        id: "task-b",
        goal: "Blocked task",
        status: "blocked",
        criteria: ["criterion"],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: false,
        blockedReason: "Waiting on gateway patch",
      },
      {
        id: "task-c",
        goal: "Needs user task",
        status: "needs_user",
        criteria: ["criterion"],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: false,
        needsUserReason: "Need final copy choice",
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText("Working task")).toBeInTheDocument();
    expect(screen.getByText("Waiting / Blocked")).toBeInTheDocument();
    expect(screen.getByText("Blocked task")).toBeInTheDocument();
    expect(screen.getByText("Needs user task")).toBeInTheDocument();
    expect(
      screen.getByText("Blocked: Waiting on gateway patch"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Needs user: Need final copy choice"),
    ).toBeInTheDocument();
  });

  it("renders done tasks in the Done board column", async () => {
    const request = createTaskRequest([
      {
        id: "task-a",
        goal: "Working task",
        status: "active",
        criteria: ["criterion"],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: true,
      },
      {
        id: "task-b",
        goal: "Finished task",
        status: "done",
        criteria: ["criterion"],
        completedCriteria: ["criterion"],
        autoContinueEnabled: true,
        active: false,
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText("Working task")).toBeInTheDocument();
    expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
    expect(screen.getByText("Finished task")).toBeInTheDocument();
  });

  it("creates child tasks under the selected parent", async () => {
    const request = createTaskRequest([
      {
        id: "parent",
        goal: "Parent task",
        status: "active",
        criteria: ["criterion"],
        completedCriteria: [],
        autoContinueEnabled: false,
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText("Parent task")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Parent task"));
    await userEvent.click(
      screen.getByRole("button", { name: "Add child task" }),
    );
    await userEvent.type(screen.getByLabelText("Goal"), "Helper task");
    await userEvent.click(
      screen.getByRole("button", { name: "Queue as child" }),
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        "sessions.tasks.create",
        expect.objectContaining({
          key: "agent:main:main",
          taskId: expect.any(String),
          taskGoal: "Helper task",
          parentTaskId: "parent",
          taskDefinitionOfDone: "",
          taskCriteria: [],
          taskAutoContinueEnabled: true,
          taskMaxIterations: 25,
          taskDelayMs: 1500,
        }),
      );
    });
  });

  it("recovers from a corrupted saved draft", async () => {
    window.localStorage.setItem(
      "edwinpai:tasks:draft:agent:main:main",
      "{broken-json",
    );
    const request = createTaskRequest([
      {
        id: "task-a",
        goal: "Existing task",
        status: "active",
        criteria: ["criterion"],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: true,
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText("Existing task")).toBeInTheDocument();
    expect(
      window.localStorage.getItem("edwinpai:tasks:draft:agent:main:main"),
    ).toBeNull();
  });
});
