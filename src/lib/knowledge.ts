import { invoke } from "@tauri-apps/api/core";

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

export type DisciplinesListResult = {
  storagePath: string;
  disciplines: DisciplineSummary[];
};

export type DisciplineDetails = {
  discipline: DisciplineSummary;
  sourceSnapshot?: string | null;
  runtimeAttachmentPolicy?: string | null;
  notesMarkdown?: string | null;
  artifactPaths: string[];
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

export async function listKnowledgeDisciplines(): Promise<DisciplinesListResult> {
  return invoke<DisciplinesListResult>("knowledge_list_disciplines");
}

export async function getKnowledgeDisciplineDetails(id: string): Promise<DisciplineDetails> {
  return invoke<DisciplineDetails>("knowledge_get_discipline_details", { id });
}

export async function listKnowledgeRuns(limit = 25): Promise<KnowledgeRunsResult> {
  return invoke<KnowledgeRunsResult>("knowledge_list_runs", { limit });
}

export async function getKnowledgeRunDetails(manifestPath: string): Promise<KnowledgeRunDetails> {
  return invoke<KnowledgeRunDetails>("knowledge_get_run_details", { manifestPath });
}
