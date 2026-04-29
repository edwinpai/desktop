import { invoke } from "@tauri-apps/api/core";

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  stepCount: number;
  lastRun?: string;
  schedule?: string;
  parseError?: string;
}

export interface WorkflowListResult {
  workflows: WorkflowSummary[];
}

export interface WorkflowStatusResult {
  workflowName: string;
  lastRun?: {
    timestamp?: string;
    success?: boolean;
    error?: string;
  };
  state?: Record<string, unknown>;
}

export interface WorkflowHistoryRun {
  timestamp?: string;
  success?: boolean;
  error?: string;
  duration?: number;
}

export interface WorkflowHistoryResult {
  workflowName: string;
  runs: WorkflowHistoryRun[];
}

export interface WorkflowPendingApproval {
  id: string;
  workflow: string;
  step: string;
  message: string;
  timestamp: string;
}

export interface WorkflowRunResult {
  success: boolean;
  message: string;
  pid?: number | null;
}

export interface WorkflowFileListResult {
  files: string[];
}

export interface WorkflowFileContentResult {
  filename: string;
  content: string;
}

export interface WorkflowLogsResult {
  workflowName: string;
  content: string;
}

export async function listWorkflows(): Promise<WorkflowListResult> {
  return await invoke<WorkflowListResult>("workflow_list");
}

export async function getWorkflowStatus(workflow: string): Promise<WorkflowStatusResult> {
  return await invoke<WorkflowStatusResult>("workflow_status", { workflow });
}

export async function getWorkflowHistory(workflow: string): Promise<WorkflowHistoryResult> {
  return await invoke<WorkflowHistoryResult>("workflow_history", { workflow });
}

export async function runWorkflow(workflow: string): Promise<WorkflowRunResult> {
  return await invoke<WorkflowRunResult>("workflow_run", { workflow });
}

export async function listPendingWorkflowApprovals(): Promise<WorkflowPendingApproval[]> {
  return await invoke<WorkflowPendingApproval[]>("workflow_pending");
}

export async function approveWorkflow(approvalId: string): Promise<boolean> {
  return await invoke<boolean>("workflow_approve", { approvalId });
}

export async function denyWorkflow(approvalId: string): Promise<boolean> {
  return await invoke<boolean>("workflow_deny", { approvalId });
}

export async function readWorkflowLogs(workflow: string): Promise<WorkflowLogsResult> {
  return await invoke<WorkflowLogsResult>("workflow_logs", { workflow });
}

export async function listWorkflowFiles(): Promise<WorkflowFileListResult> {
  return await invoke<WorkflowFileListResult>("workflow_list_files");
}

export async function loadWorkflowFile(filename: string): Promise<WorkflowFileContentResult> {
  return await invoke<WorkflowFileContentResult>("workflow_load_file", { filename });
}

export async function saveWorkflowFile(filename: string, content: string): Promise<boolean> {
  return await invoke<boolean>("workflow_save_file", { filename, content });
}

export async function createWorkflowFile(filename: string): Promise<WorkflowFileContentResult> {
  return await invoke<WorkflowFileContentResult>("workflow_create_file", { filename });
}
