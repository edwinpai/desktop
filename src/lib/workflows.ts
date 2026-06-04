import { readConfig } from "@/lib/config";
import { buildGatewayTarget, callGatewayMethod } from "@/lib/gateway-context";

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

async function gatewayTarget() {
  const cfg = await readConfig();
  return buildGatewayTarget({
    gatewayUrl: cfg.gatewayUrl,
    gatewayPort: cfg.gatewayPort,
    gatewayToken: cfg.gatewayToken,
  });
}

async function callWorkflowGateway<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return (await callGatewayMethod(
    await gatewayTarget(),
    method,
    params,
    15000,
    `Timed out calling ${method}`,
  )) as T;
}

export async function listWorkflows(): Promise<WorkflowListResult> {
  return await callWorkflowGateway<WorkflowListResult>("workflows.list");
}

export async function getWorkflowStatus(
  workflow: string,
): Promise<WorkflowStatusResult> {
  return await callWorkflowGateway<WorkflowStatusResult>(
    "workflows.status",
    { workflow },
  );
}

export async function getWorkflowHistory(
  workflow: string,
): Promise<WorkflowHistoryResult> {
  return await callWorkflowGateway<WorkflowHistoryResult>(
    "workflows.history",
    { workflow },
  );
}

export async function runWorkflow(
  workflow: string,
): Promise<WorkflowRunResult> {
  return await callWorkflowGateway<WorkflowRunResult>("workflows.run", { workflow });
}

export async function listPendingWorkflowApprovals(): Promise<
  WorkflowPendingApproval[]
> {
  return await callWorkflowGateway<WorkflowPendingApproval[]>("workflows.pending");
}

export async function approveWorkflow(approvalId: string): Promise<boolean> {
  return await callWorkflowGateway<boolean>("workflows.approve", { approvalId });
}

export async function denyWorkflow(approvalId: string): Promise<boolean> {
  return await callWorkflowGateway<boolean>("workflows.deny", { approvalId });
}

export async function readWorkflowLogs(
  workflow: string,
): Promise<WorkflowLogsResult> {
  return await callWorkflowGateway<WorkflowLogsResult>("workflows.logs", { workflow });
}

export async function listWorkflowFiles(): Promise<WorkflowFileListResult> {
  return await callWorkflowGateway<WorkflowFileListResult>("workflows.files.list");
}

export async function loadWorkflowFile(
  filename: string,
): Promise<WorkflowFileContentResult> {
  return await callWorkflowGateway<WorkflowFileContentResult>(
    "workflows.files.load",
    { filename },
  );
}

export async function saveWorkflowFile(
  filename: string,
  content: string,
): Promise<boolean> {
  return await callWorkflowGateway<boolean>(
    "workflows.files.save",
    { filename, content },
  );
}

export async function createWorkflowFile(
  filename: string,
): Promise<WorkflowFileContentResult> {
  return await callWorkflowGateway<WorkflowFileContentResult>(
    "workflows.files.create",
    { filename },
  );
}
