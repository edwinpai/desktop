import { invoke } from "@tauri-apps/api/core";
import {
  buildGatewayTarget,
  callGatewayMethod,
  type GatewayTarget,
} from "@/lib/gateway-context";

export { buildGatewayTarget };

export type KnowledgeSource = {
  id: string;
  sourceType: string;
  label: string;
  origin: string;
  schedule?: string | null;
  preset?: string | null;
  enabled: boolean;
  lastSync?: string | null;
  collectionName?: string | null;
  collectionPath?: string | null;
  collectionFiles?: number | null;
  collectionUpdated?: string | null;
};

export type QmdCollectionSummary = {
  name: string;
  uri?: string | null;
  pattern?: string | null;
  files?: number | null;
  updated?: string | null;
};

export type KnowledgeSourcesResult = {
  sourcesPath?: string | null;
  sources: KnowledgeSource[];
  collections: QmdCollectionSummary[];
  qmdAvailable: boolean;
  qmdError?: string | null;
};

export type DisciplineSummary = {
  id: string;
  name: string;
  description?: string | null;
  selectedCollections: string[];
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  latestRunId?: string | null;
  artifactKinds: string[];
  evidencePolicy?: string | null;
  freshnessLabel?: string | null;
};

export type DisciplineValidationIssue = {
  level: "error" | "warning";
  disciplineId?: string;
  path?: string;
  message: string;
};

export type DisciplinesListResult = {
  storagePath: string;
  disciplines: DisciplineSummary[];
  issues?: DisciplineValidationIssue[];
};

export type DisciplineDetails = {
  discipline: DisciplineSummary;
  sourceSnapshot?: string | null;
  runtimeAttachmentPolicy?: string | null;
  notesMarkdown?: string | null;
  artifactPaths: string[];
};

export type DisciplineBuildCommandResult = {
  stdout: string;
  stderr: string;
  issues?: DisciplineValidationIssue[];
};

export type DisciplineCreateInput = {
  id?: string;
  name: string;
  description?: string;
  selectedCollections?: string[];
};

export type DisciplineCreateResult = {
  id: string;
  directoryPath: string;
  disciplinePath: string;
  readmePath: string;
  build: DisciplineBuildCommandResult;
};

export type DisciplineUpdateInput = {
  id: string;
  name?: string;
  description?: string;
  selectedCollections?: string[];
};

export type DisciplineUpdateResult = {
  id: string;
  disciplinePath: string;
  build: DisciplineBuildCommandResult;
};

export type DisciplineDeleteResult = {
  id: string;
  trashedPath: string;
  build: DisciplineBuildCommandResult;
};

export type KnowledgeRunSummary = {
  runId: string;
  status: string;
  goal?: string | null;
  collectionPath?: string | null;
  strategy?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  totalTokens?: number | null;
  resultPreview?: string | null;
  manifestPath: string;
  reportPath?: string | null;
};

export type KnowledgeRunsResult = {
  historyPath: string;
  runs: KnowledgeRunSummary[];
};

export type KnowledgeRunDetails = {
  summary: KnowledgeRunSummary;
  directoryPath: string;
  reportMarkdown?: string | null;
  summaryResult?: string | null;
};

export async function listKnowledgeSources(): Promise<KnowledgeSourcesResult> {
  return invoke<KnowledgeSourcesResult>("knowledge_list_sources");
}

function summarizeDiscipline(
  record: Partial<DisciplineSummary>,
): DisciplineSummary {
  return {
    id: record.id ?? "",
    name: record.name ?? record.id ?? "Untitled discipline",
    description: record.description ?? null,
    selectedCollections: record.selectedCollections ?? [],
    status: record.status ?? "draft",
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    latestRunId: record.latestRunId ?? null,
    artifactKinds: record.artifactKinds ?? [],
    evidencePolicy: record.evidencePolicy ?? null,
    freshnessLabel: record.freshnessLabel ?? null,
  };
}

function normalizeDisciplineIssue(
  value: unknown,
): DisciplineValidationIssue | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const level = record.level === "error" ? "error" : "warning";
  const message =
    typeof record.message === "string" && record.message.trim()
      ? record.message
      : null;
  if (!message) return null;
  return {
    level,
    disciplineId:
      typeof record.disciplineId === "string" ? record.disciplineId : undefined,
    path: typeof record.path === "string" ? record.path : undefined,
    message,
  };
}

function normalizeDisciplineIssues(
  value: unknown,
): DisciplineValidationIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeDisciplineIssue)
    .filter((issue): issue is DisciplineValidationIssue => !!issue);
}

function disciplineDetailsFromRecord(
  record: Partial<DisciplineSummary> & Record<string, unknown>,
): DisciplineDetails {
  const artifactPaths = Array.isArray(record.artifactPaths)
    ? record.artifactPaths.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return {
    discipline: summarizeDiscipline(record),
    sourceSnapshot:
      typeof record.sourceSnapshot === "string" ? record.sourceSnapshot : null,
    runtimeAttachmentPolicy:
      typeof record.runtimeAttachmentPolicy === "string"
        ? record.runtimeAttachmentPolicy
        : null,
    notesMarkdown:
      typeof record.notesMarkdown === "string" ? record.notesMarkdown : null,
    artifactPaths,
  };
}

export async function listKnowledgeDisciplines(
  target?: GatewayTarget,
): Promise<DisciplinesListResult> {
  if (!target)
    return invoke<DisciplinesListResult>("knowledge_list_disciplines");
  const result = (await callGatewayMethod(
    target,
    "knowledge.disciplines.list",
    {},
    15000,
    "Timed out listing disciplines",
  )) as {
    disciplines?: Array<Partial<DisciplineSummary>>;
    registryPath?: string;
    issues?: unknown[];
  };
  return {
    storagePath:
      result.registryPath ?? "~/.edwinpai/knowledge/disciplines.json",
    disciplines: (result.disciplines ?? []).map(summarizeDiscipline),
    issues: normalizeDisciplineIssues(result.issues),
  };
}

export async function getKnowledgeDisciplineDetails(
  id: string,
  target?: GatewayTarget,
): Promise<DisciplineDetails> {
  if (!target)
    return invoke<DisciplineDetails>("knowledge_get_discipline_details", {
      id,
    });
  const result = (await callGatewayMethod(
    target,
    "knowledge.disciplines.get",
    { id },
    15000,
    "Timed out loading discipline details",
  )) as { discipline?: Record<string, unknown> };
  if (!result.discipline) throw new Error(`Discipline not found: ${id}`);
  return disciplineDetailsFromRecord(result.discipline);
}

export async function createKnowledgeDiscipline(
  input: DisciplineCreateInput,
  target?: GatewayTarget,
): Promise<DisciplineCreateResult> {
  if (!target) {
    return invoke<DisciplineCreateResult>("knowledge_create_discipline", {
      input,
    });
  }
  const id =
    input.id ??
    input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const result = (await callGatewayMethod(
    target,
    "knowledge.disciplines.create",
    {
      id,
      name: input.name,
      description: input.description,
      selectedCollections: input.selectedCollections ?? ["workspace"],
      runtimeAttachmentPolicy: "attach-on-demand",
    },
    30000,
    "Timed out creating discipline",
  )) as { discipline?: { id?: string }; path?: string };
  return {
    id: result.discipline?.id ?? id,
    directoryPath: result.path ?? "",
    disciplinePath: result.path ? `${result.path}/discipline.yaml` : "",
    readmePath: result.path ? `${result.path}/README.md` : "",
    build: { stdout: "Discipline created via gateway RPC.", stderr: "" },
  };
}

export async function updateKnowledgeDiscipline(
  input: DisciplineUpdateInput,
  target?: GatewayTarget,
): Promise<DisciplineUpdateResult> {
  if (!target) {
    return invoke<DisciplineUpdateResult>("knowledge_update_discipline", {
      input,
    });
  }
  const result = (await callGatewayMethod(
    target,
    "knowledge.disciplines.update",
    input as unknown as Record<string, unknown>,
    30000,
    "Timed out updating discipline",
  )) as { discipline?: { id?: string } };
  return {
    id: result.discipline?.id ?? input.id,
    disciplinePath: "",
    build: { stdout: "Discipline updated via gateway RPC.", stderr: "" },
  };
}

export async function deleteKnowledgeDiscipline(
  id: string,
  target?: GatewayTarget,
): Promise<DisciplineDeleteResult> {
  if (!target)
    return invoke<DisciplineDeleteResult>("knowledge_delete_discipline", {
      id,
    });
  const result = (await callGatewayMethod(
    target,
    "knowledge.disciplines.delete",
    { id },
    30000,
    "Timed out deleting discipline",
  )) as { deleted?: string; trashedPath?: string };
  return {
    id: result.deleted ?? id,
    trashedPath: result.trashedPath ?? "",
    build: { stdout: "Discipline moved to trash via gateway RPC.", stderr: "" },
  };
}

export async function buildKnowledgeDiscipline(
  id?: string,
  target?: GatewayTarget,
): Promise<DisciplineBuildCommandResult> {
  if (!target)
    return invoke<DisciplineBuildCommandResult>("knowledge_build_discipline", {
      id,
    });
  const result = (await callGatewayMethod(
    target,
    "knowledge.disciplines.build",
    id ? { id } : {},
    60000,
    "Timed out building discipline",
  )) as { issues?: unknown[] };
  const issues = normalizeDisciplineIssues(result.issues);
  return {
    stdout: `Discipline build completed via gateway RPC. Issues: ${issues.length}.`,
    stderr: "",
    issues,
  };
}

export async function listKnowledgeRuns(
  limit = 25,
): Promise<KnowledgeRunsResult> {
  return invoke<KnowledgeRunsResult>("knowledge_list_runs", { limit });
}

export async function getKnowledgeRunDetails(
  manifestPath: string,
): Promise<KnowledgeRunDetails> {
  return invoke<KnowledgeRunDetails>("knowledge_get_run_details", {
    manifestPath,
  });
}
