import {
  callGatewayMethod,
  signGatewayParams,
  type GatewayTarget,
} from "@/lib/gateway-context";

export interface SubagentProposalScope {
  prompt?: string;
  taskScope?: string;
  toolScopes?: string[];
  collectionIds?: string[];
}

export type SubagentProposalStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "executed"
  | "canceled";

export interface SubagentProposal {
  id: string;
  title?: string;
  agentTypeId: string;
  disciplineId?: string;
  profileId?: string;
  scope?: SubagentProposalScope;
  status: SubagentProposalStatus;
  approvalRequestId?: string;
  approvedBy?: string;
  approvedAt?: string;
  result?: {
    status?: string;
    childSessionKey?: string;
    runId?: string;
    summary?: string;
    error?: string;
    completedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PendingSubagentProposalApproval {
  sessionKey?: string;
  taskId?: string;
  proposal: SubagentProposal;
}

export interface PendingSubagentProposalsResult {
  proposals: PendingSubagentProposalApproval[];
}

export interface ResolveSubagentProposalResult {
  proposal: SubagentProposal;
  task?: unknown;
}

function normalizeProposal(value: unknown): SubagentProposal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.agentTypeId !== "string") {
    return null;
  }
  const status =
    typeof record.status === "string"
      ? (record.status as SubagentProposalStatus)
      : "proposed";
  return {
    id: record.id,
    title: typeof record.title === "string" ? record.title : undefined,
    agentTypeId: record.agentTypeId,
    disciplineId:
      typeof record.disciplineId === "string" ? record.disciplineId : undefined,
    profileId:
      typeof record.profileId === "string" ? record.profileId : undefined,
    scope:
      record.scope &&
      typeof record.scope === "object" &&
      !Array.isArray(record.scope)
        ? (record.scope as SubagentProposalScope)
        : undefined,
    status,
    approvalRequestId:
      typeof record.approvalRequestId === "string"
        ? record.approvalRequestId
        : undefined,
    approvedBy:
      typeof record.approvedBy === "string" ? record.approvedBy : undefined,
    approvedAt:
      typeof record.approvedAt === "string" ? record.approvedAt : undefined,
    result:
      record.result &&
      typeof record.result === "object" &&
      !Array.isArray(record.result)
        ? (record.result as SubagentProposal["result"])
        : undefined,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

function normalizePendingItem(
  value: unknown,
): PendingSubagentProposalApproval | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const proposal = normalizeProposal(record.proposal);
  if (!proposal) return null;
  return {
    sessionKey:
      typeof record.sessionKey === "string" ? record.sessionKey : undefined,
    taskId: typeof record.taskId === "string" ? record.taskId : undefined,
    proposal,
  };
}

export async function fetchPendingSubagentProposalApprovals(
  target: GatewayTarget,
  sessionKey: string,
  timeoutMs = 10000,
): Promise<PendingSubagentProposalsResult> {
  const result = (await callGatewayMethod(
    target,
    "subagents.proposals.pending",
    { sessionKey },
    timeoutMs,
    "Timed out fetching pending subagent proposals",
  )) as Record<string, unknown> | undefined;
  const proposals = Array.isArray(result?.proposals)
    ? result.proposals
        .map((entry) => normalizePendingItem(entry))
        .filter((entry): entry is PendingSubagentProposalApproval =>
          Boolean(entry),
        )
    : [];
  return { proposals };
}

export async function approveSubagentProposal(
  target: GatewayTarget,
  params: {
    sessionKey: string;
    proposalId: string;
    approvalRequestId: string;
    taskId?: string;
    approvedBy?: string;
    /** Structured delegation payload — must match what was signed. */
    delegationPayload?: Record<string, unknown>;
    /** BSV-signed envelope over stableJson(delegationPayload). */
    delegationEnvelope?: Record<string, unknown>;
  },
  timeoutMs = 10000,
): Promise<ResolveSubagentProposalResult> {
  return (await callGatewayMethod(
    target,
    "subagents.proposals.approve",
    params,
    timeoutMs,
    "Timed out approving subagent proposal",
  )) as ResolveSubagentProposalResult;
}

export async function rejectSubagentProposal(
  target: GatewayTarget,
  params: {
    sessionKey: string;
    proposalId: string;
    taskId?: string;
  },
  timeoutMs = 10000,
): Promise<ResolveSubagentProposalResult> {
  return (await callGatewayMethod(
    target,
    "subagents.proposals.reject",
    params,
    timeoutMs,
    "Timed out rejecting subagent proposal",
  )) as ResolveSubagentProposalResult;
}

export async function fetchExecutableSubagentProposals(
  target: GatewayTarget,
  sessionKey: string,
  timeoutMs = 10000,
): Promise<PendingSubagentProposalsResult> {
  const result = (await callGatewayMethod(
    target,
    "subagents.proposals.executable",
    { sessionKey },
    timeoutMs,
    "Timed out fetching executable subagent proposals",
  )) as Record<string, unknown> | undefined;
  const proposals = Array.isArray(result?.proposals)
    ? result.proposals
        .map((entry) => normalizePendingItem(entry))
        .filter((entry): entry is PendingSubagentProposalApproval =>
          Boolean(entry),
        )
    : [];
  return { proposals };
}

export async function executeSubagentProposal(
  target: GatewayTarget,
  params: {
    sessionKey: string;
    proposalId: string;
    taskId?: string;
  },
  timeoutMs = 10000,
): Promise<ResolveSubagentProposalResult> {
  return (await callGatewayMethod(
    target,
    "subagents.proposals.execute",
    await signGatewayParams(params),
    timeoutMs,
    "Timed out executing subagent proposal",
  )) as ResolveSubagentProposalResult;
}

export interface ConsolidationResult {
  status: "completed" | "failed" | "running";
  summary?: string;
  error?: string;
  childSessionFound: boolean;
  consolidatedAt: string;
}

export interface ConsolidateSubagentProposalResult {
  proposal: SubagentProposal;
  consolidation: ConsolidationResult;
  task?: unknown;
}

export async function consolidateSubagentProposal(
  target: GatewayTarget,
  params: {
    sessionKey: string;
    proposalId: string;
    taskId?: string;
  },
  timeoutMs = 10000,
): Promise<ConsolidateSubagentProposalResult> {
  return (await callGatewayMethod(
    target,
    "subagents.proposals.consolidate",
    params,
    timeoutMs,
    "Timed out consolidating subagent proposal",
  )) as ConsolidateSubagentProposalResult;
}
