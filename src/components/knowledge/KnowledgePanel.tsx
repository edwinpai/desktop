import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Database, FileSearch, FolderTree, History, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getKnowledgeDisciplineDetails,
  getKnowledgeRunDetails,
  listKnowledgeDisciplines,
  listKnowledgeRuns,
  listKnowledgeSources,
  type DisciplineDetails,
  type DisciplineSummary,
  type DisciplinesListResult,
  type KnowledgeRunDetails,
  type KnowledgeRunSummary,
  type KnowledgeSourcesResult,
  type KnowledgeRunsResult,
  type QmdCollectionSummary,
} from "@/lib/knowledge";

function formatTimestamp(value?: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function trimPath(value?: string | null): string {
  if (!value) return "—";
  if (value.startsWith("/home/jake/")) {
    return value.replace("/home/jake", "~");
  }
  return value;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const normalized = status.toLowerCase();
  if (["complete", "completed", "ok", "success"].includes(normalized)) return "default";
  if (["failed", "error"].includes(normalized)) return "destructive";
  if (["running", "in_progress", "pending"].includes(normalized)) return "secondary";
  return "outline";
}

function matchesQuery(query: string, values: Array<string | null | undefined>): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-lg">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

function SourceCollections({ collections }: { collections: QmdCollectionSummary[] }) {
  if (collections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indexed collections</CardTitle>
          <CardDescription>No QMD collections were found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {collections.map((collection) => (
        <Card key={collection.name}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {collection.name}
                </CardTitle>
                <CardDescription>{collection.pattern ?? "Pattern unavailable"}</CardDescription>
              </div>
              {typeof collection.files === "number" && (
                <Badge variant="secondary">{collection.files} files</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>Updated: {collection.updated ?? "Unknown"}</div>
            {collection.uri && <div className="font-mono text-xs break-all">{collection.uri}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SourceList({ data }: { data: KnowledgeSourcesResult }) {
  const [query, setQuery] = useState("");

  const filteredSources = useMemo(
    () =>
      data.sources.filter((source) =>
        matchesQuery(query, [
          source.label,
          source.origin,
          source.sourceType,
          source.collectionName,
          source.collectionPath,
          source.preset,
        ]),
      ),
    [data.sources, query],
  );

  const filteredCollections = useMemo(
    () =>
      data.collections.filter((collection) =>
        matchesQuery(query, [collection.name, collection.pattern, collection.uri, collection.updated]),
      ),
    [data.collections, query],
  );

  const linkedCollections = useMemo(
    () => new Set(data.sources.map((source) => source.collectionName).filter(Boolean)),
    [data.sources],
  );

  const unlinkedCollections = useMemo(
    () => data.collections.filter((collection) => !linkedCollections.has(collection.name)),
    [data.collections, linkedCollections],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Shad sources</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.sources.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">QMD collections</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.collections.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Collections without source links</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{unlinkedCollections.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sources file</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground break-all">
            {data.sourcesPath ? trimPath(data.sourcesPath) : "~/.shad/sources.yaml not found"}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Sources</h3>
          <p className="text-sm text-muted-foreground">
            Real source definitions from Shad&apos;s local registry, plus the collections they feed.
          </p>
        </div>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Filter sources and collections by name, path, type, or collection..."
        />
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-base font-semibold">Shad Sources</h4>
          <p className="text-sm text-muted-foreground">
            Showing {filteredSources.length} of {data.sources.length} sources.
          </p>
        </div>
        {filteredSources.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No matching sources</CardTitle>
              <CardDescription>
                Try a broader query or refresh if you recently changed the local Shad registry.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSources.map((source) => (
              <Card key={source.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FolderTree className="h-4 w-4" />
                        {source.label}
                      </CardTitle>
                      <CardDescription className="break-all">{trimPath(source.origin)}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Badge variant="outline">{source.sourceType}</Badge>
                      {source.enabled ? <Badge variant="secondary">Enabled</Badge> : <Badge variant="destructive">Disabled</Badge>}
                      {source.preset && <Badge variant="outline">{source.preset}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>Last sync: {formatTimestamp(source.lastSync)}</div>
                  <div>Schedule: {source.schedule ?? "Not scheduled"}</div>
                  <div>Collection: {source.collectionName ?? "Unlinked"}</div>
                  {typeof source.collectionFiles === "number" && <div>Indexed files: {source.collectionFiles}</div>}
                  {source.collectionUpdated && <div>Collection updated: {source.collectionUpdated}</div>}
                  {source.collectionPath && (
                    <div className="font-mono text-xs break-all">{trimPath(source.collectionPath)}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-base font-semibold">Indexed Collections</h4>
          <p className="text-sm text-muted-foreground">
            Current QMD collections visible from this desktop runtime.
          </p>
          {!data.qmdAvailable && data.qmdError && (
            <p className="mt-2 text-sm text-muted-foreground">QMD unavailable: {data.qmdError}</p>
          )}
        </div>
        <SourceCollections collections={filteredCollections} />
      </div>

      {unlinkedCollections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collections without linked Shad sources</CardTitle>
            <CardDescription>
              These collections exist locally, but no source entry in `sources.yaml` points at them right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {unlinkedCollections.map((collection) => (
              <Badge key={collection.name} variant="outline">
                {collection.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DisciplinesList({ data }: { data: DisciplinesListResult }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(data.disciplines[0]?.id ?? null);
  const [details, setDetails] = useState<DisciplineDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const filteredDisciplines = useMemo(
    () =>
      data.disciplines.filter((discipline) =>
        matchesQuery(query, [
          discipline.id,
          discipline.name,
          discipline.description,
          discipline.status,
          discipline.freshnessLabel,
          discipline.evidencePolicy,
          ...discipline.selectedCollections,
          ...discipline.artifactKinds,
        ]),
      ),
    [data.disciplines, query],
  );

  useEffect(() => {
    if (filteredDisciplines.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredDisciplines.some((discipline) => discipline.id === selectedId)) {
      setSelectedId(filteredDisciplines[0]?.id ?? null);
    }
  }, [filteredDisciplines, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      setDetailsError(null);
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const next = await getKnowledgeDisciplineDetails(selectedId);
        if (!cancelled) {
          setDetails(next);
        }
      } catch (err) {
        if (!cancelled) {
          setDetails(null);
          setDetailsError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    };

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const buildableCount = useMemo(
    () => data.disciplines.filter((discipline) => discipline.selectedCollections.length > 0).length,
    [data.disciplines],
  );

  if (data.disciplines.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Disciplines storage is now wired, but no disciplines are defined yet
            </CardTitle>
            <CardDescription>
              This is now a real backed surface. The desktop is reading discipline objects from local persisted storage instead of faking cards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>Storage path: {trimPath(data.storagePath)}</div>
            <div>Create a `disciplines.json` file there with discipline definitions to make this view populate.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current MVP scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>• Persisted first-class discipline object registry</div>
            <div>• Basic list and inspect API surface</div>
            <div>• Truthful desktop view for current discipline state</div>
            <div>• Runtime attachment/build flows still intentionally not implemented here</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Disciplines</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.disciplines.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Buildable now</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{buildableCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Visible after filter</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{filteredDisciplines.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Storage path</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground break-all">{trimPath(data.storagePath)}</CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Disciplines</h3>
          <p className="text-sm text-muted-foreground">
            First-class persisted discipline objects. This MVP shows what exists honestly, without pretending runtime composition is finished.
          </p>
        </div>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Filter disciplines by name, status, collection, artifact kind, or evidence policy..."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          {filteredDisciplines.map((discipline: DisciplineSummary) => {
            const selected = discipline.id === selectedId;
            return (
              <button
                key={discipline.id}
                type="button"
                onClick={() => setSelectedId(discipline.id)}
                className="w-full text-left"
              >
                <Card className={selected ? "border-primary ring-1 ring-primary/30" : undefined}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          {discipline.name}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs break-all">{discipline.id}</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Badge variant={statusVariant(discipline.status)}>{discipline.status}</Badge>
                        {discipline.freshnessLabel && <Badge variant="outline">{discipline.freshnessLabel}</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {discipline.description && <div>{discipline.description}</div>}
                    <div>Collections: {discipline.selectedCollections.length > 0 ? discipline.selectedCollections.join(", ") : "None selected"}</div>
                    <div>Artifacts: {discipline.artifactKinds.length > 0 ? discipline.artifactKinds.join(", ") : "No artifact inventory yet"}</div>
                    {discipline.latestRunId && <div>Latest run: {discipline.latestRunId}</div>}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        <Card className="h-fit sticky top-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Discipline details
            </CardTitle>
            <CardDescription>
              Inspect persisted discipline metadata, selected collections, artifact pointers, and notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailsLoading ? (
              <div className="text-sm text-muted-foreground">Loading discipline details...</div>
            ) : detailsError ? (
              <div className="text-sm text-destructive">{detailsError}</div>
            ) : details ? (
              <>
                <div className="space-y-2">
                  <div className="text-base font-semibold">{details.discipline.name}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(details.discipline.status)}>{details.discipline.status}</Badge>
                    {details.discipline.evidencePolicy && <Badge variant="outline">{details.discipline.evidencePolicy}</Badge>}
                    {details.discipline.freshnessLabel && <Badge variant="secondary">{details.discipline.freshnessLabel}</Badge>}
                  </div>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>ID: {details.discipline.id}</div>
                  <div>Created: {formatTimestamp(details.discipline.createdAt)}</div>
                  <div>Updated: {formatTimestamp(details.discipline.updatedAt)}</div>
                  <div>Collections: {details.discipline.selectedCollections.length > 0 ? details.discipline.selectedCollections.join(", ") : "None"}</div>
                  <div>Artifacts: {details.discipline.artifactKinds.length > 0 ? details.discipline.artifactKinds.join(", ") : "None recorded"}</div>
                  {details.discipline.latestRunId && <div>Latest run: {details.discipline.latestRunId}</div>}
                  {details.sourceSnapshot && <div>Source snapshot: {details.sourceSnapshot}</div>}
                  {details.runtimeAttachmentPolicy && <div>Runtime attachment: {details.runtimeAttachmentPolicy}</div>}
                </div>

                {details.artifactPaths.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Artifact paths</div>
                    <div className="flex flex-col gap-2">
                      {details.artifactPaths.map((artifactPath) => (
                        <div key={artifactPath} className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground break-all">
                          {trimPath(artifactPath)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {details.notesMarkdown ? (
                  <div className="rounded-md border bg-muted/20 p-4 prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{details.notesMarkdown}</ReactMarkdown>
                  </div>
                ) : details.discipline.description ? (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground/90">{details.discipline.description}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">This discipline has no saved notes yet.</div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Select a discipline to inspect it.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RunsList({ data }: { data: KnowledgeRunsResult }) {
  const [query, setQuery] = useState("");
  const [selectedManifestPath, setSelectedManifestPath] = useState<string | null>(null);
  const [details, setDetails] = useState<KnowledgeRunDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const filteredRuns = useMemo(
    () =>
      data.runs.filter((run) =>
        matchesQuery(query, [run.runId, run.goal, run.status, run.collectionPath, run.strategy]),
      ),
    [data.runs, query],
  );

  const completedCount = useMemo(
    () => data.runs.filter((run) => ["complete", "completed", "success", "ok"].includes(run.status.toLowerCase())).length,
    [data.runs],
  );

  useEffect(() => {
    if (filteredRuns.length === 0) {
      setSelectedManifestPath(null);
      return;
    }
    if (!selectedManifestPath || !filteredRuns.some((run) => run.manifestPath === selectedManifestPath)) {
      setSelectedManifestPath(filteredRuns[0]?.manifestPath ?? null);
    }
  }, [filteredRuns, selectedManifestPath]);

  useEffect(() => {
    if (!selectedManifestPath) {
      setDetails(null);
      setDetailsError(null);
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const next = await getKnowledgeRunDetails(selectedManifestPath);
        if (!next?.summary) {
          throw new Error("Knowledge run details response was missing summary data");
        }
        if (!cancelled) {
          setDetails(next);
        }
      } catch (err) {
        if (!cancelled) {
          setDetails(null);
          setDetailsError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    };

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedManifestPath]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Shad runs</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.runs.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{completedCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Visible after filter</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{filteredRuns.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">History path</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground break-all">
            {trimPath(data.historyPath)}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Runs</h3>
          <p className="text-sm text-muted-foreground">
            Real Shad ingestion/synthesis/maintenance runs. These are knowledge runs, not generic app sessions.
          </p>
        </div>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Filter runs by goal, run id, status, strategy, or collection..."
        />
      </div>

      {filteredRuns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matching Shad runs</CardTitle>
            <CardDescription>
              Try a broader query or refresh if a new run just completed.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            {filteredRuns.map((run: KnowledgeRunSummary) => {
              const selected = selectedManifestPath === run.manifestPath;
              return (
                <button
                  key={run.manifestPath}
                  type="button"
                  onClick={() => setSelectedManifestPath(run.manifestPath)}
                  className="w-full text-left"
                >
                  <Card className={selected ? "border-primary ring-1 ring-primary/30" : undefined}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <History className="h-4 w-4" />
                            {run.goal ?? run.runId}
                          </CardTitle>
                          <CardDescription className="font-mono text-xs break-all">{run.runId}</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                          {run.strategy && <Badge variant="outline">{run.strategy}</Badge>}
                          {typeof run.totalTokens === "number" && (
                            <Badge variant="secondary">{run.totalTokens.toLocaleString()} tokens</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div>Created: {formatTimestamp(run.createdAt)}</div>
                      <div>Completed: {formatTimestamp(run.completedAt)}</div>
                      {run.collectionPath && <div>Collection: {trimPath(run.collectionPath)}</div>}
                      {run.resultPreview && <div>{run.resultPreview}</div>}
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          <Card className="h-fit sticky top-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5" />
                Run details
              </CardTitle>
              <CardDescription>
                Inspect the selected run&apos;s output and provenance without leaving the desktop app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailsLoading ? (
                <div className="text-sm text-muted-foreground">Loading run details...</div>
              ) : detailsError ? (
                <div className="text-sm text-destructive">{detailsError}</div>
              ) : details?.summary ? (
                <>
                  <div className="space-y-2">
                    <div className="text-base font-semibold">{details.summary.goal ?? details.summary.runId}</div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusVariant(details.summary.status)}>{details.summary.status}</Badge>
                      {details.summary.strategy && <Badge variant="outline">{details.summary.strategy}</Badge>}
                      {typeof details.summary.totalTokens === "number" && (
                        <Badge variant="secondary">{details.summary.totalTokens.toLocaleString()} tokens</Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>Created: {formatTimestamp(details.summary.createdAt)}</div>
                    <div>Completed: {formatTimestamp(details.summary.completedAt)}</div>
                    <div>Run directory: {trimPath(details.directoryPath)}</div>
                    <div>Manifest: {trimPath(details.summary.manifestPath)}</div>
                    {details.summary.reportPath && <div>Report: {trimPath(details.summary.reportPath)}</div>}
                    {details.summary.collectionPath && <div>Collection: {trimPath(details.summary.collectionPath)}</div>}
                  </div>

                  {details.reportMarkdown ? (
                    <div className="rounded-md border bg-muted/20 p-4 prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{details.reportMarkdown}</ReactMarkdown>
                    </div>
                  ) : details.summaryResult ? (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground/90 whitespace-pre-wrap">
                      {details.summaryResult}
                    </div>
                  ) : details.summary.resultPreview ? (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground/90">
                      {details.summary.resultPreview}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">This run has no saved report or summary text.</div>
                  )}
                </>
              ) : details ? (
                <div className="text-sm text-muted-foreground">This run returned malformed detail data.</div>
              ) : (
                <div className="text-sm text-muted-foreground">Select a run to inspect it.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function KnowledgePanel() {
  const [sources, setSources] = useState<KnowledgeSourcesResult | null>(null);
  const [disciplines, setDisciplines] = useState<DisciplinesListResult | null>(null);
  const [runs, setRuns] = useState<KnowledgeRunsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [sourcesResult, disciplinesResult, runsResult] = await Promise.all([
        listKnowledgeSources(),
        listKnowledgeDisciplines(),
        listKnowledgeRuns(20),
      ]);
      setSources(sourcesResult);
      setDisciplines(disciplinesResult);
      setRuns(runsResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Knowledge</h2>
          <p className="text-sm text-muted-foreground">
            Sources, disciplines, and Shad knowledge runs for this machine.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load(true)} disabled={loading || refreshing}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading knowledge state...</CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="sources" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="disciplines">Disciplines</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
          </TabsList>

          <TabsContent value="sources">
            {sources ? (
              <SourceList data={sources} />
            ) : (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">Sources are unavailable.</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="disciplines">
            {disciplines ? (
              <DisciplinesList data={disciplines} />
            ) : (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">Disciplines are unavailable.</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="runs">
            {runs ? (
              <RunsList data={runs} />
            ) : (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">Runs are unavailable.</CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
