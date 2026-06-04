import { invoke } from "@tauri-apps/api/core";
import {
  callGatewayMethod,
  signGatewayParams,
  type GatewayTarget,
} from "@/lib/gateway-context";
import { sha256hex, stableJson } from "@/lib/subagent-delegation";

export type ActionApprovalCategory =
  | "exec"
  | "tool"
  | "credential"
  | "message"
  | "node"
  | "subagent"
  | "file"
  | "network"
  | "workflow"
  | "config"
  | "skill"
  | "update"
  | "browser"
  | "vault"
  | "unknown";

export interface ActionApprovalRequest {
  id: string;
  category: ActionApprovalCategory;
  title: string;
  description?: string;
  agentId?: string;
  sessionKey?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionApprovalPayload {
  kind: "action-approval";
  version: 1;
  approvalId: string;
  category: ActionApprovalCategory;
  decision: string;
  approvedAt: string;
  expiresAt?: string;
  subjectHash: string;
  payloadHash?: string;
}

function normalizeEnvelope(
  envelope: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...envelope,
    payloadHash:
      typeof envelope.payloadHash === "string"
        ? envelope.payloadHash
        : envelope.payload_hash,
    pubKey:
      typeof envelope.pubKey === "string" ? envelope.pubKey : envelope.pub_key,
  };
}

export async function buildActionApprovalPayload(input: {
  approvalId: string;
  category: ActionApprovalCategory;
  decision: string;
  subject: unknown;
  payload?: unknown;
  approvedAt?: string;
  expiresAt?: string;
}): Promise<ActionApprovalPayload> {
  return {
    kind: "action-approval",
    version: 1,
    approvalId: input.approvalId,
    category: input.category,
    decision: input.decision,
    approvedAt: input.approvedAt ?? new Date().toISOString(),
    expiresAt: input.expiresAt,
    subjectHash: await sha256hex(stableJson(input.subject)),
    payloadHash:
      input.payload === undefined
        ? undefined
        : await sha256hex(stableJson(input.payload)),
  };
}

export async function signActionApproval(input: {
  approvalId: string;
  category: ActionApprovalCategory;
  decision: string;
  subject: unknown;
  payload?: Record<string, unknown>;
  expiresAt?: string;
}): Promise<{
  approvalPayload: ActionApprovalPayload;
  approvalEnvelope: Record<string, unknown>;
}> {
  const approvalPayload = await buildActionApprovalPayload(input);
  const signed = await invoke<{
    payload: string;
    envelope: Record<string, unknown>;
  }>("sign_request", {
    payload: stableJson(approvalPayload),
  });
  const approvalEnvelope = normalizeEnvelope(signed.envelope);
  return {
    approvalPayload,
    approvalEnvelope,
  };
}

export interface PendingActionApprovalsResult {
  approvals: ActionApprovalRequest[];
}

function normalizeActionApproval(value: unknown): ActionApprovalRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return null;
  return {
    id: record.id,
    category:
      typeof record.category === "string"
        ? (record.category as ActionApprovalCategory)
        : "unknown",
    title: typeof record.title === "string" ? record.title : record.id,
    description:
      typeof record.description === "string" ? record.description : undefined,
    agentId: typeof record.agentId === "string" ? record.agentId : undefined,
    sessionKey:
      typeof record.sessionKey === "string" ? record.sessionKey : undefined,
    createdAt:
      typeof record.createdAt === "string" ? record.createdAt : undefined,
    metadata:
      record.metadata &&
      typeof record.metadata === "object" &&
      !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : undefined,
  };
}

export async function fetchPendingActionApprovals(
  target: GatewayTarget,
  params: { sessionKey?: string } = {},
  timeoutMs = 10000,
): Promise<PendingActionApprovalsResult> {
  const result = (await callGatewayMethod(
    target,
    "action.approvals.pending",
    params,
    timeoutMs,
    "Timed out fetching pending action approvals",
  )) as Record<string, unknown> | undefined;
  const approvals = Array.isArray(result?.approvals)
    ? result.approvals
        .map((entry) => normalizeActionApproval(entry))
        .filter((entry): entry is ActionApprovalRequest => Boolean(entry))
    : [];
  return { approvals };
}

export async function resolveActionApproval(
  target: GatewayTarget,
  params: {
    id: string;
    category: ActionApprovalCategory;
    decision: string;
    payload?: Record<string, unknown>;
    subject?: unknown;
    approvalPayload?: ActionApprovalPayload;
    approvalEnvelope?: Record<string, unknown>;
    signedEnvelope?: Record<string, unknown>;
    [key: string]: unknown;
  },
  timeoutMs = 10000,
): Promise<{ ok: boolean; category?: string; decision?: string }> {
  let approvalParams: typeof params = params;
  if (!params.approvalPayload || !params.approvalEnvelope) {
    if (!params.subject) {
      throw new Error(
        "Cannot resolve action approval without subject or signed approval",
      );
    }
    const signed = await signActionApproval({
      approvalId: params.id,
      category: params.category,
      decision: params.decision,
      subject: params.subject,
      payload: params.payload,
    });
    approvalParams = {
      ...params,
      ...signed,
    };
  }
  const signedParams = await signGatewayParams(approvalParams);
  return (await callGatewayMethod(
    target,
    "action.approvals.resolve",
    signedParams,
    timeoutMs,
    "Timed out resolving action approval",
  )) as { ok: boolean; category?: string; decision?: string };
}
