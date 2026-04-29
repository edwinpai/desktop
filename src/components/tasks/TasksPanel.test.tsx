import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TasksPanel } from './TasksPanel';

type TasksPanelRequest = NonNullable<ComponentProps<typeof TasksPanel>['request']>;

type TestTask = {
  id: string;
  goal: string;
  definitionOfDone?: string;
  status?: 'active' | 'done' | 'blocked' | 'needs_user';
  criteria?: string[];
  completedCriteria?: string[];
  autoContinueEnabled?: boolean;
  active?: boolean;
  blockedReason?: string;
  needsUserReason?: string;
  lastEvaluationReason?: string;
  maxIterations?: number;
  delayMs?: number;
};

function createTaskRequest(initialTasks: TestTask[], initialActiveTaskId = initialTasks[0]?.id) {
  let tasks = initialTasks.map((task) => ({ ...task }));
  let activeTaskId = initialActiveTaskId;

  const syncActiveFlags = () => {
    tasks = tasks.map((task) => ({ ...task, active: task.id === activeTaskId }));
  };
  syncActiveFlags();

  const requestMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
    switch (method) {
      case 'sessions.tasks.list':
        syncActiveFlags();
        return { activeTaskId, tasks };
      case 'sessions.tasks.create': {
        const nextTask: TestTask = {
          id: `task-${tasks.length + 1}`,
          goal: String(params?.taskGoal ?? ''),
          definitionOfDone: String(params?.taskDefinitionOfDone ?? ''),
          criteria: Array.isArray(params?.taskCriteria) ? params?.taskCriteria.map(String) : [],
          completedCriteria: [],
          status: 'active',
          autoContinueEnabled: params?.taskAutoContinueEnabled !== false,
          maxIterations: Number(params?.taskMaxIterations ?? 25),
          delayMs: Number(params?.taskDelayMs ?? 1500),
          active: false,
        };
        tasks.push(nextTask);
        return { ok: true };
      }
      case 'sessions.tasks.delete':
        tasks = tasks.filter((task) => task.id !== params?.taskId);
        if (activeTaskId === params?.taskId) {
          activeTaskId = tasks[0]?.id;
        }
        return { ok: true };
      case 'sessions.tasks.select':
        activeTaskId = String(params?.taskId ?? activeTaskId);
        syncActiveFlags();
        return { ok: true, activeTaskId, tasks };
      case 'sessions.tasks.update':
        tasks = tasks.map((task) =>
          task.id === params?.taskId
            ? {
                ...task,
                goal: String(params?.taskGoal ?? task.goal),
                definitionOfDone: String(params?.taskDefinitionOfDone ?? task.definitionOfDone ?? ''),
                criteria: Array.isArray(params?.taskCriteria) ? params?.taskCriteria.map(String) : task.criteria,
                autoContinueEnabled:
                  typeof params?.taskAutoContinueEnabled === 'boolean'
                    ? params.taskAutoContinueEnabled
                    : task.autoContinueEnabled,
                maxIterations:
                  typeof params?.taskMaxIterations === 'number' ? params.taskMaxIterations : task.maxIterations,
                delayMs: typeof params?.taskDelayMs === 'number' ? params.taskDelayMs : task.delayMs,
              }
            : task,
        );
        return { ok: true, activeTaskId, tasks };
      case 'sessions.tasks.reorder': {
        const ids = Array.isArray(params?.taskIds) ? params.taskIds.map(String) : [];
        tasks = ids
          .map((id) => tasks.find((task) => task.id === id))
          .filter((task): task is TestTask => Boolean(task));
        syncActiveFlags();
        return { ok: true, activeTaskId, tasks };
      }
      case 'sessions.tasks.execute':
        return { ok: true, activeTaskId, tasks };
      case 'sessions.task.action': {
        const action = String(params?.action ?? '');
        tasks = tasks.map((task) => {
          if (task.id !== activeTaskId) return task;
          if (action === 'complete_criteria') {
            const criteria = Array.isArray(params?.criteria) ? params.criteria.map(String) : [];
            return {
              ...task,
              completedCriteria: Array.from(new Set([...(task.completedCriteria ?? []), ...criteria])),
            };
          }
          if (action === 'block') {
            return {
              ...task,
              status: 'blocked',
              blockedReason: String(params?.reason ?? ''),
            };
          }
          if (action === 'clear_block') {
            return {
              ...task,
              status: 'active',
              blockedReason: undefined,
            };
          }
          if (action === 'needs_user') {
            return {
              ...task,
              status: 'needs_user',
              needsUserReason: String(params?.reason ?? ''),
            };
          }
          if (action === 'clear_needs_user') {
            return {
              ...task,
              status: 'active',
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
  });

  return Object.assign(
    ((method: string, params?: Record<string, unknown>) => requestMock(method, params)) as TasksPanelRequest,
    requestMock,
  );
}

describe('TasksPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads a queued task list, executes queued tasks, and creates a new task', async () => {
    const request = createTaskRequest([
      {
        id: 'task-a',
        goal: 'Sweep the desktop UI',
        definitionOfDone: 'Entire Desktop UI has been clicked-through, tested, debugged, and verified.',
        status: 'active',
        criteria: ['all reachable views tested', 'all fixes verified'],
        completedCriteria: ['all reachable views tested'],
        autoContinueEnabled: true,
        active: true,
        lastEvaluationReason: 'Remaining criteria: all fixes verified',
      },
      {
        id: 'task-b',
        goal: 'Ship queue UI',
        status: 'active',
        criteria: ['queue list visible'],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: false,
      },
    ]);

    const onOpenChat = vi.fn();

    render(<TasksPanel sessionKey="agent:main:main" request={request} onOpenChat={onOpenChat} />);

    expect(await screen.findByText('Task Queue')).toBeInTheDocument();
    expect(await screen.findByText('Sweep the desktop UI')).toBeInTheDocument();
    expect(screen.getByText('Ship queue UI')).toBeInTheDocument();
    expect(screen.getAllByText('running').length).toBeGreaterThan(0);
    expect(screen.getAllByText('queued').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Execute Tasks (2)' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.tasks.execute', {
        key: 'agent:main:main',
      });
    });
    expect(onOpenChat).toHaveBeenCalledWith('agent:main:main');

    await userEvent.type(screen.getByLabelText('Goal'), 'Build task queue desktop UI');
    await userEvent.type(screen.getByLabelText('Definition of done'), 'Desktop can create and manage multiple queued tasks.');
    await userEvent.type(screen.getByLabelText('Criteria (one per line)'), 'queue list visible\ncreate task works');
    await userEvent.click(screen.getByRole('button', { name: 'Queue task' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.tasks.create', {
        key: 'agent:main:main',
        taskGoal: 'Build task queue desktop UI',
        taskDefinitionOfDone: 'Desktop can create and manage multiple queued tasks.',
        taskCriteria: ['queue list visible', 'create task works'],
        taskAutoContinueEnabled: true,
        taskMaxIterations: 25,
        taskDelayMs: 1500,
      });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Delete Ship queue UI' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.tasks.delete', {
        key: 'agent:main:main',
        taskId: 'task-b',
      });
    });
  });

  it('supports select, update, reorder, completion, blocked, and needs-user flows', async () => {
    const request = createTaskRequest([
      {
        id: 'task-a',
        goal: 'First task',
        definitionOfDone: 'Done first',
        status: 'active',
        criteria: ['first criterion'],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: true,
      },
      {
        id: 'task-b',
        goal: 'Second task',
        definitionOfDone: 'Done second',
        status: 'active',
        criteria: ['second criterion'],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: false,
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText('First task')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Second task'));
    await userEvent.click(screen.getByRole('button', { name: 'Make current' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.tasks.select', {
        key: 'agent:main:main',
        taskId: 'task-b',
      });
    });

    const editGoalInput = screen.getByDisplayValue('Second task');
    await userEvent.clear(editGoalInput);
    await userEvent.type(editGoalInput, 'Second task updated');
    await userEvent.click(screen.getByRole('button', { name: 'Update task' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.tasks.update', {
        key: 'agent:main:main',
        taskId: 'task-b',
        taskGoal: 'Second task updated',
        taskDefinitionOfDone: 'Done second',
        taskCriteria: ['second criterion'],
        taskAutoContinueEnabled: true,
        taskMaxIterations: 25,
        taskDelayMs: 1500,
      });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Move up' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.tasks.reorder', {
        key: 'agent:main:main',
        taskIds: ['task-b', 'task-a'],
      });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Complete' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.task.action', {
        key: 'agent:main:main',
        action: 'complete_criteria',
        criteria: ['second criterion'],
      });
    });

    const blockInput = screen.getByPlaceholderText('Explain what is blocked');
    await userEvent.type(blockInput, 'Waiting on gateway patch');
    await userEvent.click(screen.getByRole('button', { name: 'Mark blocked' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.task.action', {
        key: 'agent:main:main',
        action: 'block',
        reason: 'Waiting on gateway patch',
      });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear blocked' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.task.action', {
        key: 'agent:main:main',
        action: 'clear_block',
      });
    });

    const needsUserInput = screen.getByPlaceholderText('Explain what user input is needed');
    await userEvent.type(needsUserInput, 'Choose the final label copy');
    await userEvent.click(screen.getByRole('button', { name: 'Mark needs user' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.task.action', {
        key: 'agent:main:main',
        action: 'needs_user',
        reason: 'Choose the final label copy',
      });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear needs user' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('sessions.task.action', {
        key: 'agent:main:main',
        action: 'clear_needs_user',
      });
    });
  });



  it('keeps blocked and needs-user tasks tucked away until expanded', async () => {
    const request = createTaskRequest([
      {
        id: 'task-a',
        goal: 'Working task',
        status: 'active',
        criteria: ['criterion'],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: true,
      },
      {
        id: 'task-b',
        goal: 'Blocked task',
        status: 'blocked',
        criteria: ['criterion'],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: false,
        blockedReason: 'Waiting on gateway patch',
      },
      {
        id: 'task-c',
        goal: 'Needs user task',
        status: 'needs_user',
        criteria: ['criterion'],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: false,
        needsUserReason: 'Need final copy choice',
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText('Working task')).toBeInTheDocument();
    expect(screen.queryByText('Blocked task')).not.toBeInTheDocument();
    expect(screen.queryByText('Needs user task')).not.toBeInTheDocument();
    expect(screen.getByText('1 waiting on something else')).toBeInTheDocument();
    expect(screen.getByText('1 waiting on Jake or another user')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /blocked tasks/i }));
    expect(await screen.findByText('Blocked task')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /waiting on Jake or another user/i }));
    expect(await screen.findByText('Needs user task')).toBeInTheDocument();
  });

  it('keeps done tasks in a collapsed completed section until expanded', async () => {
    const request = createTaskRequest([
      {
        id: 'task-a',
        goal: 'Working task',
        status: 'active',
        criteria: ['criterion'],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: true,
      },
      {
        id: 'task-b',
        goal: 'Finished task',
        status: 'done',
        criteria: ['criterion'],
        completedCriteria: ['criterion'],
        autoContinueEnabled: true,
        active: false,
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText('Working task')).toBeInTheDocument();
    expect(screen.queryByText('Finished task')).not.toBeInTheDocument();
    expect(screen.getByText('1 finished task')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /completed tasks/i }));

    expect(await screen.findByText('Finished task')).toBeInTheDocument();
  });

  it('recovers from a corrupted saved draft', async () => {
    window.localStorage.setItem('edwinpai:tasks:draft:agent:main:main', '{broken-json');
    const request = createTaskRequest([
      {
        id: 'task-a',
        goal: 'Existing task',
        status: 'active',
        criteria: ['criterion'],
        completedCriteria: [],
        autoContinueEnabled: true,
        active: true,
      },
    ]);

    render(<TasksPanel sessionKey="agent:main:main" request={request} />);

    expect(await screen.findByText('Existing task')).toBeInTheDocument();
    expect(window.localStorage.getItem('edwinpai:tasks:draft:agent:main:main')).toBeNull();
  });
});
