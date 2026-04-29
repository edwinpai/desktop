use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSource {
    pub id: String,
    pub source_type: String,
    pub label: String,
    pub origin: String,
    pub schedule: Option<String>,
    pub preset: Option<String>,
    pub enabled: bool,
    pub last_sync: Option<String>,
    pub collection_name: Option<String>,
    pub collection_path: Option<String>,
    pub collection_files: Option<u64>,
    pub collection_updated: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QmdCollectionSummary {
    pub name: String,
    pub uri: Option<String>,
    pub pattern: Option<String>,
    pub files: Option<u64>,
    pub updated: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSourcesResult {
    pub sources_path: Option<String>,
    pub sources: Vec<KnowledgeSource>,
    pub collections: Vec<QmdCollectionSummary>,
    pub qmd_available: bool,
    pub qmd_error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeRunSummary {
    pub run_id: String,
    pub status: String,
    pub goal: Option<String>,
    pub collection_path: Option<String>,
    pub strategy: Option<String>,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
    pub total_tokens: Option<u64>,
    pub result_preview: Option<String>,
    pub manifest_path: String,
    pub report_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeRunsResult {
    pub history_path: String,
    pub runs: Vec<KnowledgeRunSummary>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeRunDetails {
    pub summary: KnowledgeRunSummary,
    pub directory_path: String,
    pub report_markdown: Option<String>,
    pub summary_result: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DisciplineSummary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub selected_collections: Vec<String>,
    pub status: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub latest_run_id: Option<String>,
    #[serde(default)]
    pub artifact_kinds: Vec<String>,
    pub evidence_policy: Option<String>,
    pub freshness_label: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisciplinesListResult {
    pub storage_path: String,
    pub disciplines: Vec<DisciplineSummary>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisciplineDetails {
    pub discipline: DisciplineSummary,
    pub source_snapshot: Option<String>,
    pub runtime_attachment_policy: Option<String>,
    pub notes_markdown: Option<String>,
    pub artifact_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DisciplinesFile {
    disciplines: Option<Vec<DisciplineRecord>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DisciplineRecord {
    id: String,
    name: String,
    description: Option<String>,
    #[serde(default)]
    selected_collections: Vec<String>,
    status: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    latest_run_id: Option<String>,
    #[serde(default)]
    artifact_kinds: Vec<String>,
    evidence_policy: Option<String>,
    freshness_label: Option<String>,
    source_snapshot: Option<String>,
    runtime_attachment_policy: Option<String>,
    notes_markdown: Option<String>,
    #[serde(default)]
    artifact_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ShadSourcesFile {
    sources: Option<Vec<ShadSourceEntry>>,
}

#[derive(Debug, Deserialize)]
struct ShadSourceEntry {
    id: Option<String>,
    #[serde(rename = "type")]
    source_type: Option<String>,
    path: Option<String>,
    url: Option<String>,
    schedule: Option<String>,
    preset: Option<String>,
    collection_path: Option<String>,
    enabled: Option<bool>,
    last_sync: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RunManifest {
    run_id: Option<String>,
    status: Option<String>,
    created_at: Option<String>,
    completed_at: Option<String>,
    total_tokens: Option<u64>,
    final_result: Option<String>,
    config: Option<RunConfig>,
}

#[derive(Debug, Deserialize)]
struct RunConfig {
    goal: Option<String>,
    collection_path: Option<String>,
    strategy_override: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RunSummaryFile {
    result: Option<String>,
    metrics: Option<RunMetrics>,
}

#[derive(Debug, Deserialize)]
struct RunMetrics {
    total_tokens: Option<u64>,
}

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Unable to resolve home directory".to_string())
}

fn edwinpai_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".edwinpai"))
}

fn shad_sources_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".shad/sources.yaml"))
}

fn shad_runs_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".shad/history/Runs"))
}

fn disciplines_storage_path() -> Result<PathBuf, String> {
    Ok(edwinpai_dir()?.join("knowledge/disciplines.json"))
}

fn qmd_binary_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(path_var) = env::var_os("PATH") {
        for dir in env::split_paths(&path_var) {
            candidates.push(dir.join("qmd"));
        }
    }

    if let Ok(home) = home_dir() {
        candidates.push(home.join(".bun/bin/qmd"));
        candidates.push(home.join(".npm-global/bin/qmd"));
        candidates.push(home.join(".local/bin/qmd"));
    }

    candidates.push(PathBuf::from("/usr/local/bin/qmd"));
    candidates.push(PathBuf::from("/usr/bin/qmd"));

    candidates
}

fn detect_qmd_binary() -> Option<PathBuf> {
    qmd_binary_candidates()
        .into_iter()
        .find(|candidate| candidate.exists())
}

fn parse_qmd_collection_list(stdout: &str) -> Vec<QmdCollectionSummary> {
    let mut collections = Vec::new();
    let mut current: Option<QmdCollectionSummary> = None;

    for raw_line in stdout.lines() {
        let line = raw_line.trim_end();
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("Collections (") {
            continue;
        }

        if !line.starts_with(' ') && trimmed.contains(" (") && trimmed.ends_with(')') {
            if let Some(existing) = current.take() {
                collections.push(existing);
            }

            let mut parts = trimmed.splitn(2, " (");
            let name = parts.next().unwrap_or_default().trim().to_string();
            let uri = parts
                .next()
                .map(|value| value.trim_end_matches(')').trim().to_string())
                .filter(|value| !value.is_empty());

            current = Some(QmdCollectionSummary {
                name,
                uri,
                pattern: None,
                files: None,
                updated: None,
            });
            continue;
        }

        let Some(collection) = current.as_mut() else {
            continue;
        };

        let trimmed = trimmed.trim();
        if let Some(value) = trimmed.strip_prefix("Pattern:") {
            collection.pattern = Some(value.trim().to_string());
        } else if let Some(value) = trimmed.strip_prefix("Files:") {
            collection.files = value.trim().parse::<u64>().ok();
        } else if let Some(value) = trimmed.strip_prefix("Updated:") {
            collection.updated = Some(value.trim().to_string());
        }
    }

    if let Some(existing) = current.take() {
        collections.push(existing);
    }

    collections
}

fn load_qmd_collections() -> (Vec<QmdCollectionSummary>, bool, Option<String>) {
    let Some(qmd_binary) = detect_qmd_binary() else {
        return (
            Vec::new(),
            false,
            Some("qmd binary not found on this machine".to_string()),
        );
    };

    let output = Command::new(&qmd_binary).args(["collection", "list"]).output();
    let output = match output {
        Ok(output) if output.status.success() => output,
        Ok(_) => match Command::new(&qmd_binary).args(["collections", "list"]).output() {
            Ok(output) if output.status.success() => output,
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let message = if stderr.is_empty() {
                    "qmd collection listing failed".to_string()
                } else {
                    stderr
                };
                return (Vec::new(), false, Some(message));
            }
            Err(err) => {
                return (Vec::new(), false, Some(err.to_string()));
            }
        },
        Err(err) => {
            return (Vec::new(), false, Some(err.to_string()));
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    (parse_qmd_collection_list(&stdout), true, None)
}

fn preview_text(raw: Option<String>) -> Option<String> {
    let text = raw?.trim().to_string();
    if text.is_empty() {
        return None;
    }
    let mut lines = text.lines();
    let preview = lines.by_ref().take(6).collect::<Vec<_>>().join(" ");
    if preview.is_empty() {
        None
    } else {
        Some(preview.chars().take(420).collect())
    }
}

fn load_disciplines_file() -> Result<(PathBuf, Vec<DisciplineRecord>), String> {
    let path = disciplines_storage_path()?;
    if !path.exists() {
        return Ok((path, Vec::new()));
    }

    let raw = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    let parsed: DisciplinesFile = serde_json::from_str(&raw).map_err(|err| err.to_string())?;
    Ok((path, parsed.disciplines.unwrap_or_default()))
}

fn summarize_discipline(record: &DisciplineRecord) -> DisciplineSummary {
    DisciplineSummary {
        id: record.id.clone(),
        name: record.name.clone(),
        description: record.description.clone(),
        selected_collections: record.selected_collections.clone(),
        status: record.status.clone().unwrap_or_else(|| "draft".to_string()),
        created_at: record.created_at.clone(),
        updated_at: record.updated_at.clone(),
        latest_run_id: record.latest_run_id.clone(),
        artifact_kinds: record.artifact_kinds.clone(),
        evidence_policy: record.evidence_policy.clone(),
        freshness_label: record.freshness_label.clone(),
    }
}

fn resolve_run_manifest_path(manifest_path: &str) -> Result<PathBuf, String> {
    let runs_dir = shad_runs_dir()?;
    let canonical_runs_dir = fs::canonicalize(&runs_dir).map_err(|err| err.to_string())?;
    let canonical_manifest = fs::canonicalize(manifest_path).map_err(|err| err.to_string())?;

    if !canonical_manifest.starts_with(&canonical_runs_dir) {
        return Err("Requested run manifest is outside the Shad runs directory".to_string());
    }
    if canonical_manifest
        .file_name()
        .and_then(|value| value.to_str())
        != Some("run.manifest.json")
    {
        return Err("Requested file is not a run.manifest.json file".to_string());
    }

    Ok(canonical_manifest)
}

fn load_run_details_from_manifest_path(manifest_path: &Path) -> Result<KnowledgeRunDetails, String> {
    let manifest_raw = fs::read_to_string(manifest_path).map_err(|err| err.to_string())?;
    let manifest: RunManifest = serde_json::from_str(&manifest_raw).map_err(|err| err.to_string())?;

    let run_dir = manifest_path
        .parent()
        .ok_or_else(|| "Run manifest has no parent directory".to_string())?;
    let summary_path = run_dir.join("final.summary.json");
    let summary: Option<RunSummaryFile> = fs::read_to_string(&summary_path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok());
    let report_path = run_dir.join("final.report.md");
    let report_markdown = fs::read_to_string(&report_path).ok();

    let summary_result = summary.as_ref().and_then(|value| value.result.clone());
    let result_preview = preview_text(summary_result.clone().or(manifest.final_result.clone()));
    let total_tokens = summary
        .as_ref()
        .and_then(|value| value.metrics.as_ref())
        .and_then(|metrics| metrics.total_tokens)
        .or(manifest.total_tokens);

    let run_id = manifest
        .run_id
        .clone()
        .or_else(|| {
            run_dir
                .file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| "unknown".to_string());

    Ok(KnowledgeRunDetails {
        summary: KnowledgeRunSummary {
            run_id,
            status: manifest.status.unwrap_or_else(|| "unknown".to_string()),
            goal: manifest.config.as_ref().and_then(|config| config.goal.clone()),
            collection_path: manifest
                .config
                .as_ref()
                .and_then(|config| config.collection_path.clone()),
            strategy: manifest
                .config
                .as_ref()
                .and_then(|config| config.strategy_override.clone()),
            created_at: manifest.created_at,
            completed_at: manifest.completed_at,
            total_tokens,
            result_preview,
            manifest_path: manifest_path.display().to_string(),
            report_path: if report_path.exists() {
                Some(report_path.display().to_string())
            } else {
                None
            },
        },
        directory_path: run_dir.display().to_string(),
        report_markdown,
        summary_result,
    })
}

#[tauri::command]
pub async fn knowledge_list_sources() -> Result<KnowledgeSourcesResult, String> {
    let sources_path = shad_sources_path()?;
    let (collections, qmd_available, qmd_error) = load_qmd_collections();
    let mut sources = Vec::new();

    if sources_path.exists() {
        let raw = fs::read_to_string(&sources_path).map_err(|err| err.to_string())?;
        let parsed: ShadSourcesFile = serde_yaml::from_str(&raw).map_err(|err| err.to_string())?;

        if let Some(entries) = parsed.sources {
            for entry in entries {
                let collection_name = entry.collection_path.as_ref().and_then(|path| {
                    Path::new(path)
                        .file_name()
                        .and_then(|value| value.to_str())
                        .map(|value| value.to_string())
                });

                let collection_meta = collection_name
                    .as_ref()
                    .and_then(|name| collections.iter().find(|collection| &collection.name == name));

                let source_type = entry.source_type.unwrap_or_else(|| "unknown".to_string());
                let origin = entry
                    .path
                    .clone()
                    .or(entry.url.clone())
                    .unwrap_or_else(|| "Unknown origin".to_string());
                let label = entry
                    .path
                    .as_ref()
                    .and_then(|path| Path::new(path).file_name().and_then(|value| value.to_str()))
                    .map(|value| value.to_string())
                    .or_else(|| entry.url.as_ref().map(|url| url.to_string()))
                    .unwrap_or_else(|| {
                        entry
                            .id
                            .clone()
                            .unwrap_or_else(|| "Unnamed source".to_string())
                    });

                sources.push(KnowledgeSource {
                    id: entry.id.unwrap_or_else(|| label.clone()),
                    source_type,
                    label,
                    origin,
                    schedule: entry.schedule,
                    preset: entry.preset,
                    enabled: entry.enabled.unwrap_or(true),
                    last_sync: entry.last_sync,
                    collection_name,
                    collection_path: entry.collection_path,
                    collection_files: collection_meta.and_then(|collection| collection.files),
                    collection_updated: collection_meta.and_then(|collection| collection.updated.clone()),
                });
            }
        }
    }

    sources.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));

    Ok(KnowledgeSourcesResult {
        sources_path: if sources_path.exists() {
            Some(sources_path.display().to_string())
        } else {
            None
        },
        sources,
        collections,
        qmd_available,
        qmd_error,
    })
}

#[tauri::command]
pub async fn knowledge_list_disciplines() -> Result<DisciplinesListResult, String> {
    let (storage_path, mut disciplines) = load_disciplines_file()?;
    disciplines.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(DisciplinesListResult {
        storage_path: storage_path.display().to_string(),
        disciplines: disciplines.iter().map(summarize_discipline).collect(),
    })
}

#[tauri::command]
pub async fn knowledge_get_discipline_details(id: String) -> Result<DisciplineDetails, String> {
    let (_, disciplines) = load_disciplines_file()?;
    let record = disciplines
        .into_iter()
        .find(|discipline| discipline.id == id)
        .ok_or_else(|| format!("Discipline not found: {}", id))?;

    Ok(DisciplineDetails {
        discipline: summarize_discipline(&record),
        source_snapshot: record.source_snapshot,
        runtime_attachment_policy: record.runtime_attachment_policy,
        notes_markdown: record.notes_markdown,
        artifact_paths: record.artifact_paths,
    })
}

#[tauri::command]
pub async fn knowledge_list_runs(limit: Option<usize>) -> Result<KnowledgeRunsResult, String> {
    let runs_dir = shad_runs_dir()?;
    let limit = limit.unwrap_or(25);
    let mut runs = Vec::new();

    if runs_dir.exists() {
        let mut entries: Vec<PathBuf> = fs::read_dir(&runs_dir)
            .map_err(|err| err.to_string())?
            .filter_map(|entry| entry.ok().map(|value| value.path()))
            .filter(|path| path.is_dir())
            .collect();

        entries.sort();
        entries.reverse();

        for run_dir in entries {
            let manifest_path = run_dir.join("run.manifest.json");
            if !manifest_path.exists() {
                continue;
            }

            let details = match load_run_details_from_manifest_path(&manifest_path) {
                Ok(value) => value,
                Err(_) => continue,
            };
            runs.push(details.summary);
        }
    }

    runs.sort_by(|a, b| {
        b.completed_at
            .as_deref()
            .unwrap_or("")
            .cmp(a.completed_at.as_deref().unwrap_or(""))
            .then_with(|| {
                b.created_at
                    .as_deref()
                    .unwrap_or("")
                    .cmp(a.created_at.as_deref().unwrap_or(""))
            })
    });
    runs.truncate(limit);

    Ok(KnowledgeRunsResult {
        history_path: runs_dir.display().to_string(),
        runs,
    })
}

#[tauri::command]
pub async fn knowledge_get_run_details(manifest_path: String) -> Result<KnowledgeRunDetails, String> {
    let canonical_manifest = resolve_run_manifest_path(&manifest_path)?;
    load_run_details_from_manifest_path(&canonical_manifest)
}
