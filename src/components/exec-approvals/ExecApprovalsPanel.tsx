import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { readConfig } from "@/lib/config";
import {
  invokeNodesTool,
  buildGatewayTarget,
  type NodeListNode,
} from "@/lib/nodes";
import {
  callGatewayMethod,
  buildWsUrlCandidates,
  resolveToken,
  fetchExecApprovals,
  setExecApprovals,
  fetchNodeExecApprovals,
  setNodeExecApprovals,
  resolveToolInvokeApproval,
  resolveCredential,
  type ExecApprovalsSnapshot,
  type ExecApprovalsFile,
  type ExecApprovalRequest,
  type ToolInvokeApprovalRequest,
  type CredentialRequest,
  type GatewayTarget,
} from "@/lib/gateway-context";
import { Input } from "@/components/ui/input";
import {
  loadPolicy as loadVaultPolicy,
  getRuleForCredential,
} from "@/lib/vault-policy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { APP_VERSION } from "@/lib/app-version";
import {
  fetchPendingActionApprovals,
  resolveActionApproval,
  type ActionApprovalCategory,
} from "@/lib/action-approvals";
import {
  consolidateSubagentProposal,
  executeSubagentProposal,
  fetchExecutableSubagentProposals,
  fetchPendingSubagentProposalApprovals,
  type PendingSubagentProposalApproval,
} from "@/lib/subagent-proposals";
import {
  buildSubagentDelegationPayload,
  stableJson,
} from "@/lib/subagent-delegation";

const DEFAULT_POLICY: ExecApprovalsFile = {
  version: 1,
};

type TargetKind = "gateway" | "node";

type StreamState = "disconnected" | "connecting" | "connected" | "error";

type CredentialApprovalRequest = CredentialRequest & {
  actionApprovalSubject?: Record<string, unknown>;
};

type GenericActionApprovalRequest = {
  id: string;
  category: ActionApprovalCategory;
  title: string;
  description?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
  subject?: unknown;
};

const withoutKey = <TValue,>(
  record: Record<string, TValue>,
  key: string,
): Record<string, TValue> => {
  const { [key]: _removed, ...next } = record;
  void _removed;
  return next;
};

export function getCredentialResolvedId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as { id?: unknown; requestId?: unknown };
  if (typeof candidate.id === "string" && candidate.id.trim().length > 0) {
    return candidate.id;
  }
  if (
    typeof candidate.requestId === "string" &&
    candidate.requestId.trim().length > 0
  ) {
    return candidate.requestId;
  }
  return null;
}

function numberFrom(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeExecRequestFromActionApproval(
  item: Awaited<
    ReturnType<typeof fetchPendingActionApprovals>
  >["approvals"][number],
): ExecApprovalRequest | null {
  if (item.category !== "exec") return null;
  const metadata = item.metadata ?? {};
  const command =
    typeof metadata.command === "string"
      ? metadata.command
      : typeof item.description === "string"
        ? item.description
        : item.title;
  if (!command) return null;
  return {
    id: item.id,
    request: {
      category: item.category,
      title: item.title,
      command,
      cwd: typeof metadata.cwd === "string" ? metadata.cwd : null,
      host: typeof metadata.host === "string" ? metadata.host : null,
      security:
        typeof metadata.security === "string" ? metadata.security : null,
      ask: typeof metadata.ask === "string" ? metadata.ask : null,
      agentId:
        item.agentId ??
        (typeof metadata.agentId === "string" ? metadata.agentId : null),
      resolvedPath:
        typeof metadata.resolvedPath === "string"
          ? metadata.resolvedPath
          : null,
      sessionKey:
        item.sessionKey ??
        (typeof metadata.sessionKey === "string" ? metadata.sessionKey : null),
    },
    createdAtMs: numberFrom(
      metadata.createdAtMs,
      item.createdAt ? Date.parse(item.createdAt) : Date.now(),
    ),
    expiresAtMs:
      typeof metadata.expiresAtMs === "number" ? metadata.expiresAtMs : null,
  };
}

export function execActionApprovalSubject(
  request: ExecApprovalRequest,
): Record<string, unknown> {
  return {
    category: request.request.category ?? "exec",
    title: request.request.title ?? request.request.command,
    command: request.request.command,
    cwd: request.request.cwd ?? null,
    host: request.request.host ?? null,
    security: request.request.security ?? null,
    ask: request.request.ask ?? null,
    agentId: request.request.agentId ?? null,
    resolvedPath: request.request.resolvedPath ?? null,
    sessionKey: request.request.sessionKey ?? null,
  };
}

export function normalizeCredentialFromActionApproval(
  item: Awaited<
    ReturnType<typeof fetchPendingActionApprovals>
  >["approvals"][number],
): CredentialApprovalRequest | null {
  if (item.category !== "credential") return null;
  const metadata = item.metadata ?? {};
  if (
    typeof metadata.actionType === "string" &&
    metadata.actionType.startsWith("vault.secret.")
  ) {
    return null;
  }
  const request =
    metadata.request &&
    typeof metadata.request === "object" &&
    !Array.isArray(metadata.request)
      ? (metadata.request as Record<string, unknown>)
      : metadata;
  const credentialId =
    typeof request.credentialId === "string"
      ? request.credentialId
      : typeof metadata.credentialId === "string"
        ? metadata.credentialId
        : item.id;
  return {
    id: item.id,
    credentialId,
    name:
      typeof request.name === "string"
        ? request.name
        : typeof metadata.name === "string"
          ? metadata.name
          : item.title,
    purpose:
      item.description ??
      (typeof request.purpose === "string"
        ? request.purpose
        : "credential request"),
    requester:
      typeof request.requester === "string"
        ? request.requester
        : typeof metadata.requester === "string"
          ? metadata.requester
          : "gateway",
    leaseDurationMs: numberFrom(
      request.leaseDurationMs,
      numberFrom(metadata.leaseDurationMs, 300000),
    ),
    createdAtMs: numberFrom(
      metadata.createdAtMs,
      item.createdAt ? Date.parse(item.createdAt) : Date.now(),
    ),
    expiresAtMs:
      typeof metadata.expiresAtMs === "number" ? metadata.expiresAtMs : null,
    actionApprovalSubject: request,
  };
}

export function normalizeGenericActionApproval(
  item: Awaited<
    ReturnType<typeof fetchPendingActionApprovals>
  >["approvals"][number],
): GenericActionApprovalRequest | null {
  const isVaultCredential =
    item.category === "credential" &&
    typeof item.metadata?.actionType === "string" &&
    item.metadata.actionType.startsWith("vault.secret.");
  if (
    ["exec", "tool", "credential", "subagent"].includes(item.category) &&
    !isVaultCredential
  )
    return null;
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    description: item.description,
    createdAt: item.createdAt,
    metadata: item.metadata,
    subject: item.metadata?.subject,
  };
}

export function normalizeGenericActionApprovalEvent(
  payload:
    | ExecApprovalRequest
    | (GenericActionApprovalRequest & {
        createdAtMs?: number;
        expiresAtMs?: number;
      }),
): GenericActionApprovalRequest | null {
  const directCategory = (payload as GenericActionApprovalRequest).category;
  if (
    directCategory &&
    !["exec", "tool", "credential", "subagent"].includes(directCategory)
  ) {
    return {
      id: payload.id,
      category: directCategory,
      title: (payload as GenericActionApprovalRequest).title,
      description: (payload as GenericActionApprovalRequest).description,
      createdAt:
        (payload as GenericActionApprovalRequest).createdAt ??
        new Date(
          numberFrom(
            (payload as { createdAtMs?: number }).createdAtMs,
            Date.now(),
          ),
        ).toISOString(),
      metadata: (payload as GenericActionApprovalRequest).metadata,
      subject:
        (payload as GenericActionApprovalRequest).subject ??
        (payload as GenericActionApprovalRequest).metadata?.subject,
    };
  }

  const category = (payload as ExecApprovalRequest).request?.category;
  if (
    !category ||
    ["exec", "tool", "credential", "subagent"].includes(category)
  ) {
    return null;
  }
  const request = (payload as ExecApprovalRequest)
    .request as ExecApprovalRequest["request"] & {
    subject?: unknown;
  };
  const metadata = {
    legacyType: "exec.approval",
    command: request.command,
    cwd: request.cwd ?? null,
    host: request.host ?? null,
    security: request.security ?? null,
    ask: request.ask ?? null,
    agentId: request.agentId ?? null,
    resolvedPath: request.resolvedPath ?? null,
    sessionKey: request.sessionKey ?? null,
    subject: request.subject,
    createdAtMs: (payload as ExecApprovalRequest).createdAtMs,
    expiresAtMs: (payload as ExecApprovalRequest).expiresAtMs,
  };
  return {
    id: payload.id,
    category: category as ActionApprovalCategory,
    title: request.title ?? request.command,
    description: request.command,
    createdAt: new Date(
      (payload as ExecApprovalRequest).createdAtMs,
    ).toISOString(),
    metadata,
    subject: request.subject,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function compactJson(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function actionTypeForRequest(
  request: GenericActionApprovalRequest,
): string | undefined {
  if (typeof request.metadata?.actionType === "string") {
    return request.metadata.actionType;
  }
  const subject =
    asRecord(request.subject) ?? asRecord(request.metadata?.subject);
  return typeof subject?.actionType === "string"
    ? subject.actionType
    : undefined;
}

async function claimVaultImportSecret(
  target: GatewayTarget,
  requestId: string,
): Promise<{
  rawSecret: string;
  credentialId: string;
  label: string;
  provider?: string;
  entryType?: string;
  kind?: string;
}> {
  const result = await callGatewayMethod(
    target,
    "vault.import.claim",
    { requestId },
    15000,
    "Timed out claiming Vault import secret",
  );
  const payload = result as Record<string, unknown>;
  if (typeof payload.rawSecret !== "string") {
    throw new Error("Vault import claim did not include a secret");
  }
  return {
    rawSecret: payload.rawSecret,
    credentialId:
      typeof payload.credentialId === "string"
        ? payload.credentialId
        : requestId,
    label:
      typeof payload.label === "string"
        ? payload.label
        : String(payload.credentialId ?? requestId),
    provider:
      typeof payload.provider === "string" ? payload.provider : undefined,
    entryType:
      typeof payload.entryType === "string" ? payload.entryType : undefined,
    kind: typeof payload.kind === "string" ? payload.kind : undefined,
  };
}

async function resolveVaultImport(
  target: GatewayTarget,
  requestId: string,
  status: "imported" | "denied" | "failed",
  error?: string,
): Promise<void> {
  await callGatewayMethod(
    target,
    "vault.import.resolve",
    { requestId, status, ...(error ? { error } : {}) },
    15000,
    "Timed out resolving Vault import",
  );
}

export function describeGenericActionApproval(
  request: GenericActionApprovalRequest,
): { rows: Array<{ label: string; value: string }>; details?: string } {
  const subject =
    asRecord(request.subject) ?? asRecord(request.metadata?.subject);
  const params = asRecord(subject?.params);
  const metadata = request.metadata ?? {};
  const secret = asRecord(metadata.secret);
  const rows: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    rows.push({ label, value: compactJson(value) });
  };

  add("Action", subject?.method ?? subject?.actionType ?? metadata.actionType);
  if (secret) {
    add("Secret", secret.kind);
    add("Provider", secret.provider);
    add("Secret path", secret.keyPath);
    add("Secret handle", secret.handle);
    add("Value hash", secret.valueHash);
  }

  if (request.category === "browser") {
    add("Browser method", params?.method ?? subject?.method);
    add("Path", params?.path ?? params?.url ?? params?.targetUrl);
    add("Tab", params?.targetId);
    add("Selector/ref", params?.selector ?? params?.ref);
  } else if (request.category === "message") {
    add("Send type", params?.kind ?? subject?.kind ?? metadata.kind);
    add("Channel", params?.channel ?? subject?.channel ?? metadata.channel);
    add(
      "Account",
      params?.accountId ?? subject?.accountId ?? metadata.accountId,
    );
    add(
      "Target",
      params?.target ?? subject?.target ?? params?.to ?? subject?.to,
    );
    add("Targets", params?.targets ?? subject?.targets);
    add("Thread", params?.threadId ?? subject?.threadId);
    add("Subject", params?.subject ?? subject?.subject);
    add(
      "Message",
      params?.message ??
        subject?.message ??
        params?.text ??
        subject?.text ??
        subject?.bodyPreview,
    );
    add("Attachments", params?.attachmentPaths ?? subject?.attachmentPaths);
    add("Public", params?.public ?? subject?.public);
    add("Bulk", params?.bulk ?? subject?.bulk);
    add("As user", params?.impersonatesUser ?? subject?.impersonatesUser);
  } else if (request.category === "config") {
    const approvalPreview = asRecord(metadata.approvalPreview);
    add("Base hash", subject?.baseHash);
    add("Note", subject?.note);
    add("Risk", subject?.risk ?? approvalPreview?.risk);
    add(
      "Changed paths",
      subject?.changedPaths ?? approvalPreview?.changedPaths,
    );
    add(
      "Sensitive paths",
      subject?.sensitivePaths ?? approvalPreview?.sensitivePaths,
    );
    add("Diff", subject?.diff ?? approvalPreview?.diff);
    if (!subject?.diff && !approvalPreview?.diff) {
      add("Patch", subject?.raw ?? params?.raw ?? params?.patch);
    }
  } else if (
    request.category === "credential" ||
    metadata.actionType === "vault.secret.import"
  ) {
    add("Vault action", subject?.actionType ?? metadata.actionType);
    add(
      "Credential",
      params?.credentialId ??
        subject?.vaultEntryId ??
        subject?.credentialId ??
        metadata.credentialId,
    );
    add("Label", subject?.label ?? metadata.label);
    add("Source", subject?.source ?? metadata.source);
    add("Source kind", subject?.sourceKind ?? metadata.sourceKind);
    add("Preview", subject?.valuePreview ?? metadata.valuePreview);
    add("Cleanup", subject?.cleanupAction ?? metadata.cleanupAction);
    add("Provider", params?.provider ?? subject?.provider ?? metadata.provider);
    if (
      typeof (subject?.actionType ?? metadata.actionType) === "string" &&
      !String(subject?.actionType ?? metadata.actionType).startsWith(
        "vault.secret.",
      )
    ) {
      add("Fingerprint", subject?.fingerprint ?? metadata.fingerprint);
    }
    add("Purpose", params?.purpose ?? subject?.purpose ?? metadata.purpose);
    add(
      "Requester",
      params?.requester ?? subject?.requester ?? metadata.requester,
    );
    add(
      "Lease",
      params?.leaseDurationMs ??
        subject?.leaseDurationMs ??
        metadata.leaseDurationMs,
    );
  } else if (request.category === "exec") {
    add("Command", params?.command ?? subject?.command ?? metadata.command);
    add("Working dir", params?.cwd ?? subject?.cwd ?? metadata.cwd);
    add("Host", params?.host ?? subject?.host ?? metadata.host);
    add("Security", params?.security ?? subject?.security ?? metadata.security);
    add("Network access", params?.network ?? subject?.network);
    add("Writes", params?.writes ?? subject?.writes);
    add("Sudo", params?.sudo ?? subject?.sudo);
  } else if (request.category === "subagent") {
    add("Task", params?.task ?? subject?.task ?? metadata.task);
    add(
      "Agent type",
      params?.agentTypeId ?? subject?.agentTypeId ?? metadata.agentTypeId,
    );
    add("Tools", params?.tools ?? subject?.tools ?? metadata.tools);
    add(
      "Workspace",
      params?.workspace ?? subject?.workspace ?? metadata.workspace,
    );
    add("Network", params?.allowNetwork ?? subject?.allowNetwork);
    add("Write access", params?.allowWrite ?? subject?.allowWrite);
    add(
      "Time limit",
      params?.timeLimitMs ?? subject?.timeLimitMs ?? metadata.timeLimitMs,
    );
  } else if (request.category === "file") {
    add("Path", params?.path ?? subject?.path ?? metadata.path);
    add(
      "Operation",
      params?.operation ?? subject?.operation ?? metadata.operation,
    );
    add("Sensitive", params?.sensitive ?? subject?.sensitive);
  } else if (request.category === "skill") {
    add("Skill", params?.name ?? params?.skill ?? subject?.name);
    add("Source", params?.source ?? params?.url ?? subject?.source);
  } else if (request.category === "update") {
    add("Update", subject?.method ?? metadata.actionType ?? request.title);
    add("Reason", params?.reason ?? subject?.reason);
  }

  const detailSource = subject ?? metadata;
  const details =
    Object.keys(detailSource).length > 0
      ? compactJson(detailSource)
      : undefined;
  return { rows, details };
}

export function normalizeToolInvokeEvent(
  payload: ToolInvokeApprovalRequest & Record<string, unknown>,
): ToolInvokeApprovalRequest {
  const requestedAtMs =
    typeof payload.requestedAt === "string"
      ? Date.parse(payload.requestedAt)
      : Date.now();
  const expiresAtMs =
    typeof payload.expiresAt === "string"
      ? Date.parse(payload.expiresAt)
      : requestedAtMs + 120000;
  return {
    ...payload,
    createdAtMs: numberFrom(payload.createdAtMs, requestedAtMs),
    expiresAtMs:
      typeof payload.expiresAtMs === "number"
        ? payload.expiresAtMs
        : expiresAtMs,
  };
}

export function ExecApprovalsPanel({
  profileId = "default",
}: {
  profileId?: string;
}) {
  const [targetKind, setTargetKind] = useState<TargetKind>("gateway");
  const [nodes, setNodes] = useState<NodeListNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");

  const [snapshot, setSnapshot] = useState<ExecApprovalsSnapshot | null>(null);
  const [policyText, setPolicyText] = useState<string>(
    JSON.stringify(DEFAULT_POLICY, null, 2),
  );
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<ExecApprovalRequest[]>(
    [],
  );
  const [pendingToolInvokes, setPendingToolInvokes] = useState<
    ToolInvokeApprovalRequest[]
  >([]);
  const [pendingCredentials, setPendingCredentials] = useState<
    CredentialApprovalRequest[]
  >([]);
  const [pendingSubagentProposals, setPendingSubagentProposals] = useState<
    PendingSubagentProposalApproval[]
  >([]);
  const [pendingGenericActions, setPendingGenericActions] = useState<
    GenericActionApprovalRequest[]
  >([]);
  const [executableSubagentProposals, setExecutableSubagentProposals] =
    useState<PendingSubagentProposalApproval[]>([]);
  const [subagentProposalSessionKey, setSubagentProposalSessionKey] =
    useState("agent:main:main");
  const [credentialInputs, setCredentialInputs] = useState<
    Record<string, string>
  >({});
  const [streamState, setStreamState] = useState<StreamState>("disconnected");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [vaultImportStatus, setVaultImportStatus] = useState<
    Record<string, string>
  >({});
  const wsRef = useRef<WebSocket | null>(null);

  const desktopVaultTargetLabel = useMemo(() => {
    const platform = navigator.platform || "desktop";
    return `this Desktop app (${platform}), Vault namespace ${profileId}`;
  }, [profileId]);

  const targetLabel = useMemo(() => {
    if (targetKind === "gateway") return "Gateway";
    const node = nodes.find((n) => n.nodeId === selectedNodeId);
    return node?.displayName ?? selectedNodeId ?? "Node";
  }, [targetKind, nodes, selectedNodeId]);

  const buildTarget = useCallback(async () => {
    const desktopConfig = await readConfig();
    return buildGatewayTarget({
      gatewayUrl: desktopConfig.gatewayUrl,
      gatewayPort: desktopConfig.gatewayPort,
      gatewayToken: desktopConfig.gatewayToken,
    });
  }, []);

  const loadNodes = useCallback(async () => {
    try {
      const target = await buildTarget();
      const result = (await invokeNodesTool(target, "status")) as Record<
        string,
        unknown
      >;
      const list = (result?.nodes as NodeListNode[]) ?? [];
      setNodes(list);
      if (!selectedNodeId && list.length > 0) {
        setSelectedNodeId(list[0]?.nodeId ?? "");
      }
    } catch (err) {
      console.error("Failed to load nodes:", err);
    }
  }, [buildTarget, selectedNodeId]);

  const loadPolicy = useCallback(async () => {
    setPolicyLoading(true);
    setPolicyError(null);
    setSaveStatus(null);
    try {
      const target = await buildTarget();
      let nextSnapshot: ExecApprovalsSnapshot;
      if (targetKind === "node") {
        if (!selectedNodeId)
          throw new Error("Select a node to load approvals.");
        nextSnapshot = await fetchNodeExecApprovals(target, selectedNodeId);
      } else {
        nextSnapshot = await fetchExecApprovals(target);
      }
      setSnapshot(nextSnapshot);
      setPolicyText(
        JSON.stringify(nextSnapshot.file ?? DEFAULT_POLICY, null, 2),
      );
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolicyLoading(false);
    }
  }, [buildTarget, targetKind, selectedNodeId]);

  const savePolicy = useCallback(async () => {
    setPolicyLoading(true);
    setPolicyError(null);
    setSaveStatus(null);
    try {
      const file = JSON.parse(policyText) as ExecApprovalsFile;
      if (!file.version) {
        file.version = 1;
      }
      const target = await buildTarget();
      let nextSnapshot: ExecApprovalsSnapshot;
      if (targetKind === "node") {
        if (!selectedNodeId)
          throw new Error("Select a node to save approvals.");
        nextSnapshot = await setNodeExecApprovals(
          target,
          selectedNodeId,
          file,
          snapshot?.hash,
        );
      } else {
        nextSnapshot = await setExecApprovals(target, file, snapshot?.hash);
      }
      setSnapshot(nextSnapshot);
      setPolicyText(JSON.stringify(nextSnapshot.file ?? file, null, 2));
      setSaveStatus("Saved successfully.");
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolicyLoading(false);
    }
  }, [buildTarget, targetKind, selectedNodeId, policyText, snapshot?.hash]);

  const formatPolicy = useCallback(() => {
    try {
      const parsed = JSON.parse(policyText);
      setPolicyText(JSON.stringify(parsed, null, 2));
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }, [policyText]);

  const connectStream = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStreamState("connecting");
    setStreamError(null);

    try {
      const target = await buildTarget();
      const token = await resolveToken(target.token);
      const wsCandidates = buildWsUrlCandidates(target.url);
      let attempt = 0;

      const connect = () => {
        const candidate =
          wsCandidates[Math.min(attempt, wsCandidates.length - 1)];
        if (!candidate) {
          setStreamState("error");
          setStreamError("No WebSocket URL candidates available");
          return;
        }
        const ws = new WebSocket(candidate);
        wsRef.current = ws;

        let msgId = 0;
        const nextId = () => String(++msgId);
        let handshakeDone = false;
        let handshakeSent = false;

        const sendHandshake = () => {
          if (handshakeSent) return;
          handshakeSent = true;
          ws.send(
            JSON.stringify({
              type: "req",
              id: nextId(),
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: "edwinpai-macos",
                  displayName: "EdwinPAI Desktop (Approvals)",
                  version: APP_VERSION,
                  platform: "desktop",
                  mode: "ui",
                },
                role: "operator",
                scopes: ["operator.admin", "operator.approvals"],
                auth: token ? { token } : undefined,
              },
            }),
          );
        };

        ws.addEventListener("open", () => {
          // Wait for connect.challenge; fallback to direct after 2s
          setTimeout(() => {
            if (!handshakeSent) sendHandshake();
          }, 2000);
        });

        ws.addEventListener("message", (event) => {
          try {
            const frame = JSON.parse(event.data as string);

            // Handle connect.challenge
            if (
              frame.type === "event" &&
              frame.event === "connect.challenge" &&
              !handshakeSent
            ) {
              sendHandshake();
              return;
            }

            if (frame.type === "res" && !handshakeDone) {
              if (frame.ok) {
                handshakeDone = true;
                setStreamState("connected");
              } else if (!frame.ok) {
                setStreamError(frame.error?.message ?? "Handshake failed");
              }
              return;
            }

            if (frame.type === "event") {
              // Existing exec approval events
              if (frame.event === "exec.approval.requested" && frame.payload) {
                const payload = frame.payload as ExecApprovalRequest;
                setPendingRequests((prev) => {
                  if (prev.some((entry) => entry.id === payload.id))
                    return prev;
                  return [...prev, payload].sort(
                    (a, b) => a.createdAtMs - b.createdAtMs,
                  );
                });
              }
              if (
                frame.event === "action.approval.requested" &&
                frame.payload
              ) {
                const payload = frame.payload as ExecApprovalRequest;
                const generic = normalizeGenericActionApprovalEvent(payload);
                if (generic) {
                  setPendingGenericActions((prev) => {
                    if (prev.some((entry) => entry.id === generic.id))
                      return prev;
                    return [...prev, generic];
                  });
                } else if (payload.request?.category === "exec") {
                  setPendingRequests((prev) => {
                    if (prev.some((entry) => entry.id === payload.id))
                      return prev;
                    return [...prev, payload].sort(
                      (a, b) => a.createdAtMs - b.createdAtMs,
                    );
                  });
                }
              }
              if (frame.event === "exec.approval.resolved" && frame.payload) {
                const payload = frame.payload as { id: string };
                setPendingRequests((prev) =>
                  prev.filter((entry) => entry.id !== payload.id),
                );
                setPendingGenericActions((prev) =>
                  prev.filter((entry) => entry.id !== payload.id),
                );
              }
              if (frame.event === "action.approval.resolved" && frame.payload) {
                const payload = frame.payload as { id: string };
                setPendingRequests((prev) =>
                  prev.filter((entry) => entry.id !== payload.id),
                );
                setPendingGenericActions((prev) =>
                  prev.filter((entry) => entry.id !== payload.id),
                );
              }
              if (frame.event === "vault.import.resolved" && frame.payload) {
                const payload = frame.payload as { id: string };
                setPendingGenericActions((prev) =>
                  prev.filter((entry) => entry.id !== payload.id),
                );
              }

              // New tool invoke approval events
              if (frame.event === "tool_invoke_approval" && frame.payload) {
                const payload = normalizeToolInvokeEvent(
                  frame.payload as ToolInvokeApprovalRequest &
                    Record<string, unknown>,
                );
                setPendingToolInvokes((prev) => {
                  if (prev.some((entry) => entry.id === payload.id))
                    return prev;
                  return [...prev, payload].sort(
                    (a, b) => a.createdAtMs - b.createdAtMs,
                  );
                });
              }
              if (
                frame.event === "tool_invoke_approval.resolved" &&
                frame.payload
              ) {
                const payload = frame.payload as { id: string };
                setPendingToolInvokes((prev) =>
                  prev.filter((entry) => entry.id !== payload.id),
                );
              }

              // Credential vault events
              if (frame.event === "credential.requested" && frame.payload) {
                const payload = frame.payload as CredentialRequest;
                setPendingCredentials((prev) => {
                  if (prev.some((entry) => entry.id === payload.id))
                    return prev;
                  return [...prev, payload].sort(
                    (a, b) => a.createdAtMs - b.createdAtMs,
                  );
                });
              }
              if (frame.event === "credential.resolved" && frame.payload) {
                const resolvedId = getCredentialResolvedId(frame.payload);
                if (resolvedId) {
                  setPendingCredentials((prev) =>
                    prev.filter((entry) => entry.id !== resolvedId),
                  );
                  setCredentialInputs((prev) => withoutKey(prev, resolvedId));
                }
              }
            }
          } catch (err) {
            console.error("Failed to parse action approvals frame:", err);
          }
        });

        const retry = () => {
          if (attempt < wsCandidates.length - 1) {
            attempt += 1;
            try {
              ws.close();
            } catch {
              // Ignore close failures before retrying.
            }
            connect();
            return true;
          }
          return false;
        };

        ws.addEventListener("error", () => {
          if (ws.readyState !== WebSocket.OPEN && retry()) return;
          setStreamState("error");
          setStreamError("WebSocket connection failed");
        });

        ws.addEventListener("close", () => {
          setStreamState("disconnected");
        });
      };

      connect();
    } catch (err) {
      setStreamState("error");
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }, [buildTarget]);

  const loadSubagentProposals = useCallback(async () => {
    try {
      const target = await buildTarget();
      const aggregate = await fetchPendingActionApprovals(target, {
        sessionKey: subagentProposalSessionKey,
      });
      setPendingRequests(
        aggregate.approvals
          .map((item) => normalizeExecRequestFromActionApproval(item))
          .filter((item): item is ExecApprovalRequest => Boolean(item))
          .sort((a, b) => a.createdAtMs - b.createdAtMs),
      );
      setPendingCredentials(
        aggregate.approvals
          .map((item) => normalizeCredentialFromActionApproval(item))
          .filter((item): item is CredentialApprovalRequest => Boolean(item)),
      );
      setPendingGenericActions(
        aggregate.approvals
          .map((item) => normalizeGenericActionApproval(item))
          .filter((item): item is GenericActionApprovalRequest =>
            Boolean(item),
          ),
      );
      const subagentApprovals = aggregate.approvals.filter(
        (item) => item.category === "subagent",
      );
      if (subagentApprovals.length > 0) {
        const result = await fetchPendingSubagentProposalApprovals(
          target,
          subagentProposalSessionKey,
        );
        setPendingSubagentProposals(result.proposals);
      }
      if (subagentApprovals.length === 0) {
        setPendingSubagentProposals([]);
      }
      const executable = await fetchExecutableSubagentProposals(
        target,
        subagentProposalSessionKey,
      );
      setExecutableSubagentProposals(executable.proposals);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }, [buildTarget, subagentProposalSessionKey]);

  const handleSubagentProposalDecision = useCallback(
    async (
      item: PendingSubagentProposalApproval,
      decision: "approve" | "reject",
    ) => {
      try {
        const target = await buildTarget();
        const sessionKey = item.sessionKey ?? subagentProposalSessionKey;

        if (decision === "approve") {
          if (!item.taskId) {
            setStreamError("Cannot approve: proposal is missing taskId.");
            return;
          }

          const approvalRequestId = `desktop-${Date.now()}`;
          const approvedAt = new Date().toISOString();

          // Build the delegation payload that will be signed.
          const delegationPayload = await buildSubagentDelegationPayload({
            sessionKey,
            taskId: item.taskId,
            proposalId: item.proposal.id,
            agentTypeId: item.proposal.agentTypeId,
            approvalRequestId,
            approvedAt,
            disciplineId: item.proposal.disciplineId,
            profileId: item.proposal.profileId,
            scope: item.proposal.scope,
          });

          // Sign the stable-JSON serialization of the delegation payload.
          let delegationEnvelope: Record<string, unknown> | undefined;
          try {
            const payloadStr = stableJson(delegationPayload);
            const result = await invoke<{
              payload: string;
              envelope: Record<string, unknown>;
            }>("sign_request", { payload: payloadStr });
            delegationEnvelope = result.envelope;
          } catch (err) {
            setStreamError(
              `BSV signing failed — cannot approve without signed delegation: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
            return;
          }

          await resolveActionApproval(target, {
            id: item.proposal.id,
            category: "subagent",
            decision: "approved",
            sessionKey,
            taskId: item.taskId,
            proposalId: item.proposal.id,
            approvalRequestId,
            subject: {
              sessionKey,
              taskId: item.taskId,
              proposalId: item.proposal.id,
              agentTypeId: item.proposal.agentTypeId,
              disciplineId: item.proposal.disciplineId,
              profileId: item.proposal.profileId,
              scope: item.proposal.scope,
              approvalRequestId,
            },
            delegationPayload: delegationPayload as unknown as Record<
              string,
              unknown
            >,
            delegationEnvelope,
          });
        } else {
          const approvalRequestId =
            item.proposal.approvalRequestId ?? `desktop-${Date.now()}`;
          await resolveActionApproval(target, {
            id: item.proposal.id,
            category: "subagent",
            decision: "rejected",
            sessionKey,
            taskId: item.taskId,
            proposalId: item.proposal.id,
            approvalRequestId,
            subject: {
              sessionKey,
              taskId: item.taskId,
              proposalId: item.proposal.id,
              agentTypeId: item.proposal.agentTypeId,
              disciplineId: item.proposal.disciplineId,
              profileId: item.proposal.profileId,
              scope: item.proposal.scope,
              approvalRequestId,
            },
          });
        }

        setPendingSubagentProposals((prev) =>
          prev.filter(
            (entry) =>
              entry.proposal.id !== item.proposal.id ||
              entry.taskId !== item.taskId,
          ),
        );
      } catch (err) {
        setStreamError(err instanceof Error ? err.message : String(err));
      }
    },
    [buildTarget, subagentProposalSessionKey],
  );

  const handleGenericActionDecision = useCallback(
    async (
      request: GenericActionApprovalRequest,
      decision: "allow-once" | "deny",
    ) => {
      try {
        const target = await buildTarget();
        const actionType = actionTypeForRequest(request);

        if (actionType === "vault.secret.import") {
          if (decision === "deny") {
            setVaultImportStatus((prev) => ({
              ...prev,
              [request.id]: "Denying Vault import…",
            }));
            await resolveVaultImport(target, request.id, "denied");
            setVaultImportStatus((prev) => ({
              ...prev,
              [request.id]: "Vault import denied.",
            }));
          } else {
            try {
              setVaultImportStatus((prev) => ({
                ...prev,
                [request.id]: `Signing import approval for ${desktopVaultTargetLabel}…`,
              }));
              const payload = JSON.stringify({
                actionType: "vault.secret.import",
                requestId: request.id,
                credentialId: request.metadata?.credentialId,
                sourceKind: request.metadata?.sourceKind,
                source: request.metadata?.source,
                approvedAtMs: Date.now(),
              });
              await invoke("sign_request", { payload });
              setVaultImportStatus((prev) => ({
                ...prev,
                [request.id]: "Claiming raw secret from Gateway…",
              }));
              const claimed = await claimVaultImportSecret(target, request.id);
              setVaultImportStatus((prev) => ({
                ...prev,
                [request.id]: `Writing ${claimed.credentialId} into ${desktopVaultTargetLabel}…`,
              }));
              await invoke("vault_store", {
                profileId,
                id: claimed.credentialId,
                name: claimed.label,
                entryType: claimed.entryType ?? claimed.kind ?? "api_key",
                provider:
                  claimed.provider ??
                  (typeof request.metadata?.provider === "string"
                    ? request.metadata.provider
                    : claimed.credentialId),
                credential: claimed.rawSecret,
                metadata: {
                  source: "vault-import",
                  importRequestId: request.id,
                  sourceKind:
                    typeof request.metadata?.sourceKind === "string"
                      ? request.metadata.sourceKind
                      : "unknown",
                  sourcePath:
                    typeof request.metadata?.source === "string"
                      ? request.metadata.source
                      : "unknown",
                  approvedDesktopTarget: desktopVaultTargetLabel,
                  approvedDesktopPlatform: navigator.platform || "desktop",
                },
              });
              setVaultImportStatus((prev) => ({
                ...prev,
                [request.id]: `Stored ${claimed.credentialId}; resolving import request…`,
              }));
              await resolveVaultImport(target, request.id, "imported");
              setVaultImportStatus((prev) => ({
                ...prev,
                [request.id]: `Imported ${claimed.credentialId} into ${desktopVaultTargetLabel}.`,
              }));
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setVaultImportStatus((prev) => ({
                ...prev,
                [request.id]: `Vault import failed: ${message}`,
              }));
              try {
                await resolveVaultImport(target, request.id, "failed", message);
              } catch {
                // Preserve original error below.
              }
              throw err;
            }
          }
        } else {
          if (!request.subject) {
            setStreamError(
              "Cannot resolve approval: request subject is missing.",
            );
            return;
          }
          await resolveActionApproval(target, {
            id: request.id,
            category: request.category,
            decision,
            subject: request.subject,
          });
        }
        setPendingGenericActions((prev) =>
          prev.filter((entry) => entry.id !== request.id),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          request.metadata?.actionType === "vault.secret.import" &&
          /Unknown, expired, or already claimed import request|Unknown or expired import request/i.test(
            message,
          )
        ) {
          setPendingGenericActions((prev) =>
            prev.filter((entry) => entry.id !== request.id),
          );
          setStreamError(
            "That Vault import request is no longer pending. Rerun the import command to create a fresh approval.",
          );
          return;
        }
        setStreamError(message);
      }
    },
    [buildTarget, desktopVaultTargetLabel, profileId],
  );

  const handleDecision = useCallback(
    async (id: string, decision: "allow-once" | "allow-always" | "deny") => {
      try {
        const target = await buildTarget();
        const request = pendingRequests.find((entry) => entry.id === id);
        if (!request) {
          setStreamError(
            "Cannot resolve approval: request details are missing.",
          );
          return;
        }
        await resolveActionApproval(target, {
          id,
          category: "exec",
          decision,
          subject: execActionApprovalSubject(request),
        });
        setPendingRequests((prev) => prev.filter((entry) => entry.id !== id));
      } catch (err) {
        setStreamError(err instanceof Error ? err.message : String(err));
      }
    },
    [buildTarget, pendingRequests],
  );

  const handleToolInvokeDecision = useCallback(
    async (req: ToolInvokeApprovalRequest, decision: "approve" | "deny") => {
      try {
        const target = await buildTarget();
        let signedEnvelope: Record<string, unknown> | undefined;

        if (decision === "approve") {
          // Sign the approval with BSV key from OS Keychain
          try {
            const payload = JSON.stringify({
              id: req.id,
              tool: req.tool,
              action: req.action,
              args: req.args,
              decision: "approve",
              approvedAtMs: Date.now(),
            });
            const result = await invoke<{
              payload: string;
              envelope: {
                kid: string;
                alg: string;
                iat: number;
                exp: number;
                nonce: string;
                payload_hash: string;
                sig: string;
                pub_key: string;
              };
            }>("sign_request", { payload });
            signedEnvelope = result.envelope as unknown as Record<
              string,
              unknown
            >;
          } catch (err) {
            console.warn("BSV signing failed, sending unsigned approval:", err);
            // Fall through — gateway can accept unsigned from local trusted connections
          }
        }

        await resolveToolInvokeApproval(
          target,
          req.id,
          decision,
          signedEnvelope,
        );
        setPendingToolInvokes((prev) =>
          prev.filter((entry) => entry.id !== req.id),
        );
      } catch (err) {
        setStreamError(err instanceof Error ? err.message : String(err));
      }
    },
    [buildTarget],
  );

  const handleExecuteSubagentProposal = useCallback(
    async (item: PendingSubagentProposalApproval) => {
      try {
        const target = await buildTarget();
        const sessionKey = item.sessionKey ?? subagentProposalSessionKey;
        const result = await executeSubagentProposal(target, {
          sessionKey,
          taskId: item.taskId,
          proposalId: item.proposal.id,
        });
        setExecutableSubagentProposals((prev) =>
          prev.map((entry) =>
            entry.proposal.id === item.proposal.id &&
            entry.taskId === item.taskId
              ? { ...entry, proposal: result.proposal }
              : entry,
          ),
        );
      } catch (err) {
        setStreamError(err instanceof Error ? err.message : String(err));
      }
    },
    [buildTarget, subagentProposalSessionKey],
  );

  const handleConsolidateSubagentProposal = useCallback(
    async (item: PendingSubagentProposalApproval) => {
      try {
        const target = await buildTarget();
        const sessionKey = item.sessionKey ?? subagentProposalSessionKey;
        const result = await consolidateSubagentProposal(target, {
          sessionKey,
          taskId: item.taskId,
          proposalId: item.proposal.id,
        });
        setExecutableSubagentProposals((prev) =>
          prev.map((entry) =>
            entry.proposal.id === item.proposal.id &&
            entry.taskId === item.taskId
              ? { ...entry, proposal: result.proposal }
              : entry,
          ),
        );
      } catch (err) {
        setStreamError(err instanceof Error ? err.message : String(err));
      }
    },
    [buildTarget, subagentProposalSessionKey],
  );

  const [rememberFlags, setRememberFlags] = useState<Record<string, boolean>>(
    {},
  );

  // Auto-approve credentials from Vault only through signed vault.secret.use.
  const autoApprovedRef = useRef(new Set<string>());

  const resolveCredentialFromVault = useCallback(
    async (
      req: CredentialApprovalRequest,
      leaseMs: number,
    ): Promise<boolean> => {
      const target = await buildTarget();
      const payload = JSON.stringify({
        actionType: "vault.secret.use",
        vaultEntryId: req.credentialId,
        label: req.name,
        provider: req.requester,
        purpose: req.purpose,
        requestedBy: req.requester,
        scope: { operation: "credential.resolve", requestId: req.id },
        requestedAtMs: Date.now(),
      });
      const signed = await invoke<{ envelope: Record<string, unknown> }>(
        "sign_request",
        { payload },
      );
      await invoke("vault_use_for_credential_request", {
        profileId,
        id: req.credentialId,
        payload,
        envelope: signed.envelope,
        gatewayUrl: target.url,
        gatewayToken: target.token,
        requestId: req.id,
        leaseMs,
      });
      return true;
    },
    [buildTarget, profileId],
  );

  useEffect(() => {
    (async () => {
      const vaultPolicy = await loadVaultPolicy(profileId);
      for (const req of pendingCredentials) {
        if (autoApprovedRef.current.has(req.id)) continue;
        if (credentialInputs[req.id] !== undefined) continue;

        const { ask, maxLeaseMs } = getRuleForCredential(
          vaultPolicy,
          req.credentialId,
        );

        // Check if we should auto-grant. Mark the request as in-flight before
        // awaiting so React effect re-runs/StrictMode cannot submit the same
        // one-shot credential.resolve twice. The gateway consumes a credential
        // request on first resolve, so duplicate auto-grants surface as a false
        // "Unknown or expired credential request" failure even though the first
        // grant succeeded.
        if (ask === "auto-grant" || ask === "first-time") {
          autoApprovedRef.current.add(req.id);
          try {
            const leaseMs = maxLeaseMs
              ? Math.min(req.leaseDurationMs, maxLeaseMs)
              : req.leaseDurationMs;
            const resolved = await resolveCredentialFromVault(req, leaseMs);
            if (resolved) {
              setPendingCredentials((prev) =>
                prev.filter((e) => e.id !== req.id),
              );
              console.log(
                `[Vault] Auto-granted ${req.credentialId} (policy: ${ask})`,
              );
              continue;
            }
            autoApprovedRef.current.delete(req.id);
          } catch (err) {
            autoApprovedRef.current.delete(req.id);
            const message = err instanceof Error ? err.message : String(err);
            console.warn(
              `[Vault] Auto-grant failed for ${req.credentialId}: ${message}`,
            );
            setStreamError(
              `Vault auto-grant failed for ${req.name}: ${message}. You can still grant manually.`,
            );
            // Fall through to manual
          }
        }

        if (ask === "deny") {
          autoApprovedRef.current.add(req.id);
          try {
            const target = await buildTarget();
            await resolveCredential(target, req.id, "denied");
            setPendingCredentials((prev) =>
              prev.filter((e) => e.id !== req.id),
            );
          } catch {
            // Ignore auto-deny delivery failures; manual handling remains available.
          }
          continue;
        }

        // Manual mode intentionally does not auto-fill raw Vault secrets into React state.
        // A stored secret can be used by changing the credential policy to auto-grant/first-time,
        // which routes through signed vault.secret.use and host-side credential resolution above.
      }
    })();
  }, [
    pendingCredentials,
    credentialInputs,
    buildTarget,
    resolveCredentialFromVault,
  ]);

  const handleCredentialDecision = useCallback(
    async (req: CredentialApprovalRequest, decision: "granted" | "denied") => {
      try {
        const target = await buildTarget();
        const credentialValue =
          decision === "granted" ? credentialInputs[req.id]?.trim() : undefined;

        if (decision === "granted" && !credentialValue) {
          setStreamError("Enter a credential value before granting.");
          return;
        }

        // Save to vault if "Remember" is checked
        if (
          decision === "granted" &&
          credentialValue &&
          rememberFlags[req.id]
        ) {
          try {
            await invoke("vault_store", {
              profileId,
              id: req.credentialId,
              name: req.name,
              entryType: "api_key",
              provider: req.requester,
              credential: credentialValue,
            });
          } catch (err) {
            console.warn("Failed to save to vault:", err);
          }
        }

        let signedEnvelope: Record<string, unknown> | undefined;
        try {
          const payload = JSON.stringify({
            requestId: req.id,
            credentialId: req.credentialId,
            decision,
            grantedAtMs: Date.now(),
          });
          const result = await invoke<{
            payload: string;
            envelope: Record<string, unknown>;
          }>("sign_request", { payload });
          signedEnvelope = result.envelope as unknown as Record<
            string,
            unknown
          >;
        } catch {
          // BSV signing best-effort
        }

        if (signedEnvelope) {
          await resolveCredential(
            target,
            req.id,
            decision,
            credentialValue,
            req.leaseDurationMs,
            signedEnvelope,
          );
        } else {
          await resolveActionApproval(target, {
            id: req.id,
            category: "credential",
            decision,
            subject: req.actionApprovalSubject ?? {
              credentialId: req.credentialId,
              name: req.name,
              purpose: req.purpose,
              requester: req.requester,
              leaseDurationMs: req.leaseDurationMs,
            },
            payload: {
              credential: credentialValue,
              leaseMs: req.leaseDurationMs,
            },
          });
        }
        setPendingCredentials((prev) =>
          prev.filter((entry) => entry.id !== req.id),
        );
        setCredentialInputs((prev) => withoutKey(prev, req.id));
        setRememberFlags((prev) => withoutKey(prev, req.id));
      } catch (err) {
        setStreamError(err instanceof Error ? err.message : String(err));
      }
    },
    [buildTarget, credentialInputs, rememberFlags],
  );

  // Auto-expire credential requests
  useEffect(() => {
    if (pendingCredentials.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setPendingCredentials((prev) =>
        prev.filter((req) => req.expiresAtMs === null || req.expiresAtMs > now),
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [pendingCredentials.length]);

  useEffect(() => {
    if (targetKind === "node") {
      loadNodes();
    }
  }, [targetKind, loadNodes]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  useEffect(() => {
    void loadSubagentProposals();
    connectStream();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectStream, loadSubagentProposals]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Action approvals</h2>
        <p className="text-sm text-muted-foreground">
          Review and control AI-initiated actions: tools, credentials, exec,
          nodes, messages, and subagents.
        </p>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Target</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Select
                  value={targetKind}
                  onValueChange={(value) => setTargetKind(value as TargetKind)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gateway">Gateway</SelectItem>
                    <SelectItem value="node">Node</SelectItem>
                  </SelectContent>
                </Select>

                {targetKind === "node" && (
                  <Select
                    value={selectedNodeId}
                    onValueChange={setSelectedNodeId}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select node" />
                    </SelectTrigger>
                    <SelectContent>
                      {nodes.map((node) => (
                        <SelectItem key={node.nodeId} value={node.nodeId}>
                          {node.displayName ?? node.nodeId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  variant="outline"
                  onClick={loadPolicy}
                  disabled={policyLoading}
                >
                  {policyLoading ? "Loading..." : "Load policy"}
                </Button>
                <Button onClick={savePolicy} disabled={policyLoading}>
                  {policyLoading ? "Saving..." : "Save policy"}
                </Button>
                <Button variant="ghost" onClick={formatPolicy}>
                  Format JSON
                </Button>
              </div>

              {policyError && (
                <Alert className="text-sm text-destructive border-destructive/30">
                  {policyError}
                </Alert>
              )}
              {saveStatus && (
                <Alert className="text-sm text-muted-foreground">
                  {saveStatus}
                </Alert>
              )}

              <div className="text-xs text-muted-foreground">
                {snapshot ? (
                  <div>
                    <div>Path: {snapshot.path}</div>
                    <div>Hash: {snapshot.hash}</div>
                    <div>Exists: {snapshot.exists ? "Yes" : "No"}</div>
                    <div>Target: {targetLabel}</div>
                  </div>
                ) : (
                  "Policy snapshot not loaded yet."
                )}
              </div>

              <Textarea
                className="min-h-[320px] font-mono text-xs"
                value={policyText}
                onChange={(event) => setPolicyText(event.target.value)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pending action requests</span>
                <Badge
                  variant={
                    streamState === "connected" ? "default" : "secondary"
                  }
                >
                  {streamState === "connected" ? "Live" : streamState}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {streamError && (
                <Alert className="text-sm text-destructive border-destructive/30">
                  {streamError}
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={connectStream}>
                  Reconnect
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPendingRequests([]);
                    setPendingToolInvokes([]);
                    setPendingCredentials([]);
                    setPendingSubagentProposals([]);
                    setExecutableSubagentProposals([]);
                    setPendingGenericActions([]);
                    setVaultImportStatus({});
                  }}
                >
                  Clear
                </Button>
              </div>

              {/* Subagent Proposal Approvals */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Proposed Subagents
                    </div>
                    <Input
                      className="w-72"
                      value={subagentProposalSessionKey}
                      onChange={(event) =>
                        setSubagentProposalSessionKey(event.target.value)
                      }
                      placeholder="Session key"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSubagentProposals}
                  >
                    Refresh action requests
                  </Button>
                </div>
                {pendingSubagentProposals.map((item) => (
                  <Card
                    key={`${item.taskId ?? "task"}:${item.proposal.id}`}
                    className="border-purple-500/30"
                  >
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg">🧩</span>
                        <span className="font-medium">
                          {item.proposal.title ?? item.proposal.id}
                        </span>
                        <Badge variant="outline" className="font-mono">
                          {item.proposal.agentTypeId}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                          Session:{" "}
                          {item.sessionKey ?? subagentProposalSessionKey}
                        </div>
                        {item.taskId && <div>Task: {item.taskId}</div>}
                        {item.proposal.disciplineId && (
                          <div>Discipline: {item.proposal.disciplineId}</div>
                        )}
                        {item.proposal.profileId && (
                          <div>Profile: {item.proposal.profileId}</div>
                        )}
                        {item.proposal.scope?.taskScope && (
                          <div>Scope: {item.proposal.scope.taskScope}</div>
                        )}
                      </div>
                      {item.proposal.scope?.prompt && (
                        <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto max-h-24">
                          {item.proposal.scope.prompt}
                        </pre>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleSubagentProposalDecision(item, "approve")
                          }
                        >
                          Approve (sign)
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            handleSubagentProposalDecision(item, "reject")
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {executableSubagentProposals.map((item) => {
                  const result = item.proposal.result;
                  const resultStatus = result?.status;
                  const borderClass =
                    resultStatus === "completed"
                      ? "border-green-500/50"
                      : resultStatus === "failed"
                        ? "border-red-500/40"
                        : "border-green-500/30";
                  return (
                    <Card
                      key={`execute:${item.taskId ?? "task"}:${item.proposal.id}`}
                      className={borderClass}
                    >
                      <CardContent className="space-y-2 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg">
                            {resultStatus === "completed"
                              ? "✅"
                              : resultStatus === "failed"
                                ? "❌"
                                : "🚀"}
                          </span>
                          <span className="font-medium">
                            {item.proposal.title ?? item.proposal.id}
                          </span>
                          <Badge variant="outline" className="font-mono">
                            {item.proposal.status}
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            {item.proposal.agentTypeId}
                          </Badge>
                          {resultStatus && (
                            <Badge
                              variant={
                                resultStatus === "completed"
                                  ? "default"
                                  : resultStatus === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="font-mono"
                            >
                              {resultStatus}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>
                            Session:{" "}
                            {item.sessionKey ?? subagentProposalSessionKey}
                          </div>
                          {item.taskId && <div>Task: {item.taskId}</div>}
                          {result?.childSessionKey && (
                            <div>Child: {result.childSessionKey}</div>
                          )}
                          {result?.runId && <div>Run: {result.runId}</div>}
                          {result?.summary && (
                            <div className="text-foreground">
                              Summary: {result.summary}
                            </div>
                          )}
                          {result?.error && (
                            <div className="text-destructive">
                              Error: {result.error}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.proposal.status === "approved" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleExecuteSubagentProposal(item)
                              }
                            >
                              Execute signed subagent
                            </Button>
                          )}
                          {item.proposal.status === "executed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleConsolidateSubagentProposal(item)
                              }
                            >
                              Check child status
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Credential Requests */}
              {pendingCredentials.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Credential Requests
                  </div>
                  {pendingCredentials.map((req) => (
                    <Card key={req.id} className="border-yellow-500/30">
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔑</span>
                          <span className="font-medium">{req.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Purpose: {req.purpose}</div>
                          <div>Requester: {req.requester}</div>
                          <div>
                            Lease: {Math.round(req.leaseDurationMs / 60000)} min
                          </div>
                          <div>
                            Expires:{" "}
                            {req.expiresAtMs === null
                              ? "No expiry"
                              : new Date(req.expiresAtMs).toLocaleTimeString()}
                          </div>
                        </div>
                        <Input
                          type="password"
                          placeholder={`Enter ${req.name}...`}
                          value={credentialInputs[req.id] ?? ""}
                          onChange={(e) =>
                            setCredentialInputs((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          autoFocus
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={rememberFlags[req.id] ?? false}
                            onChange={(e) =>
                              setRememberFlags((prev) => ({
                                ...prev,
                                [req.id]: e.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                          Remember in vault (encrypted, OS Keychain)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleCredentialDecision(req, "granted")
                            }
                          >
                            Grant
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleCredentialDecision(req, "denied")
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

              {/* Tool Invoke Approvals */}
              {pendingToolInvokes.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tool Invocations
                  </div>
                  {pendingToolInvokes.map((req) => (
                    <Card key={req.id} className="border-primary/30">
                      <CardContent className="space-y-2 pt-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {req.tool}
                          </Badge>
                          {req.action && (
                            <Badge variant="secondary" className="font-mono">
                              {req.action}
                            </Badge>
                          )}
                        </div>
                        <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto max-h-32">
                          {JSON.stringify(req.args, null, 2)}
                        </pre>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {req.sessionKey && (
                            <div>Session: {req.sessionKey}</div>
                          )}
                          {req.agentId && <div>Agent: {req.agentId}</div>}
                          {req.requestingClient && (
                            <div>Requesting app: {req.requestingClient}</div>
                          )}
                          <div>
                            Expires:{" "}
                            {req.expiresAtMs === null
                              ? "No expiry"
                              : new Date(req.expiresAtMs).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleToolInvokeDecision(req, "approve")
                            }
                          >
                            Approve (sign)
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleToolInvokeDecision(req, "deny")
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

              {/* Exec Tool Calls */}
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  {pendingToolInvokes.length > 0 && (
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Exec Tool Calls
                    </div>
                  )}
                  {pendingRequests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="space-y-2 pt-4">
                        <div className="text-sm font-medium">
                          {request.request.command}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {request.request.cwd && (
                            <div>CWD: {request.request.cwd}</div>
                          )}
                          {request.request.host && (
                            <div>Host: {request.request.host}</div>
                          )}
                          {request.request.agentId && (
                            <div>Agent: {request.request.agentId}</div>
                          )}
                          {request.request.resolvedPath && (
                            <div>Resolved: {request.request.resolvedPath}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleDecision(request.id, "allow-once")
                            }
                          >
                            Allow once (sign)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleDecision(request.id, "allow-always")
                            }
                          >
                            Always allow
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDecision(request.id, "deny")}
                          >
                            Deny
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Generic Action Authorizations */}
              {pendingGenericActions.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Other Action Requests
                  </div>
                  {pendingGenericActions.map((request) => (
                    <Card key={request.id} className="border-amber-500/30">
                      <CardContent className="space-y-2 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {request.category}
                          </Badge>
                          <span className="font-medium">{request.title}</span>
                        </div>
                        {request.description && (
                          <div className="text-sm text-muted-foreground">
                            {request.description}
                          </div>
                        )}
                        {(() => {
                          const preview =
                            describeGenericActionApproval(request);
                          return (
                            <div className="space-y-2">
                              {preview.rows.length > 0 && (
                                <div className="grid gap-1 text-xs">
                                  {preview.rows.map((row) => (
                                    <div
                                      key={`${row.label}:${row.value}`}
                                      className="grid grid-cols-[7rem_1fr] gap-2"
                                    >
                                      <span className="text-muted-foreground">
                                        {row.label}
                                      </span>
                                      <span className="font-mono break-all whitespace-pre-wrap">
                                        {row.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {preview.details && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground">
                                    Raw authorization subject
                                  </summary>
                                  <pre className="mt-2 bg-muted/50 rounded p-2 overflow-x-auto max-h-32">
                                    {preview.details}
                                  </pre>
                                </details>
                              )}
                            </div>
                          );
                        })()}
                        {actionTypeForRequest(request) === "vault.secret.import" && (
                          <Alert className="text-xs border-amber-500/40">
                            Import destination: {desktopVaultTargetLabel}. This
                            secret will be written to the local Desktop OS
                            keychain/Vault under this namespace, keeping remote
                            Gateway profiles separated from the default Vault.
                          </Alert>
                        )}
                        {vaultImportStatus[request.id] && (
                          <Alert className="text-xs">
                            {vaultImportStatus[request.id]}
                          </Alert>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={
                              !request.subject &&
                              actionTypeForRequest(request) !==
                                "vault.secret.import"
                            }
                            onClick={() =>
                              handleGenericActionDecision(request, "allow-once")
                            }
                          >
                            {actionTypeForRequest(request) === "vault.secret.import"
                              ? `Import into Vault namespace ${profileId}`
                              : "Allow once (sign)"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={
                              !request.subject &&
                              actionTypeForRequest(request) !==
                                "vault.secret.import"
                            }
                            onClick={() =>
                              handleGenericActionDecision(request, "deny")
                            }
                          >
                            Deny
                          </Button>
                        </div>
                        {!request.subject &&
                          actionTypeForRequest(request) !==
                            "vault.secret.import" && (
                            <div className="text-xs text-muted-foreground">
                              This request is missing a canonical subject, so it
                              cannot be signed from Desktop yet.
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {pendingRequests.length === 0 &&
                pendingToolInvokes.length === 0 &&
                pendingCredentials.length === 0 &&
                pendingSubagentProposals.length === 0 &&
                pendingGenericActions.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No pending action approvals. Requests appear here for
                    credential access, tool invocations, exec actions, proposed
                    subagents, and other sensitive action categories.
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
