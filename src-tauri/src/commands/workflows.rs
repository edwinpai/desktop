use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use serde_yaml::Value as YamlValue;
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowSummary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub step_count: usize,
    pub last_run: Option<String>,
    pub schedule: Option<String>,
    pub parse_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowListResult {
    pub workflows: Vec<WorkflowSummary>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStatusResult {
    pub workflow_name: String,
    pub last_run: Option<JsonValue>,
    pub state: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowHistoryResult {
    pub workflow_name: String,
    pub runs: Vec<JsonValue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowPendingApproval {
    pub id: String,
    pub workflow: String,
    pub step: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunResult {
    pub success: bool,
    pub message: String,
    pub pid: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowFileListResult {
    pub files: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowFileContentResult {
    pub filename: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogsResult {
    pub workflow_name: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApprovalFile {
    id: String,
    workflow: String,
    step: String,
    message: String,
    timestamp: String,
    status: String,
    approver: Option<String>,
    #[serde(default)]
    approval_surface: Option<String>,
    approved_at: Option<String>,
}

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Unable to resolve home directory".to_string())
}

fn workflows_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".edwinpai/workspace/workflows"))
}

fn workflow_state_dir() -> Result<PathBuf, String> {
    Ok(workflows_dir()?.join(".state"))
}

fn workflow_history_dir() -> Result<PathBuf, String> {
    Ok(workflows_dir()?.join(".history"))
}

fn workflow_logs_dir() -> Result<PathBuf, String> {
    Ok(workflows_dir()?.join(".logs"))
}

fn workflow_approvals_dir() -> Result<PathBuf, String> {
    Ok(workflows_dir()?.join(".approvals"))
}

fn ensure_safe_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Workflow name is required".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("Invalid workflow name".to_string());
    }
    Ok(trimmed.to_string())
}

fn ensure_safe_filename(filename: &str) -> Result<String, String> {
    let trimmed = filename.trim();
    if trimmed.is_empty() {
        return Err("Filename is required".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("Invalid workflow filename".to_string());
    }
    if !(trimmed.ends_with(".yaml") || trimmed.ends_with(".yml")) {
        return Err("Workflow filename must end with .yaml or .yml".to_string());
    }
    Ok(trimmed.to_string())
}

fn workflow_file_path(filename: &str) -> Result<PathBuf, String> {
    Ok(workflows_dir()?.join(ensure_safe_filename(filename)?))
}

fn workflow_state_path(name: &str) -> Result<PathBuf, String> {
    Ok(workflow_state_dir()?.join(format!("{}.json", ensure_safe_name(name)?)))
}

fn workflow_history_path(name: &str) -> Result<PathBuf, String> {
    Ok(workflow_history_dir()?.join(format!("{}.json", ensure_safe_name(name)?)))
}

fn workflow_log_path(name: &str) -> Result<PathBuf, String> {
    Ok(workflow_logs_dir()?.join(format!("{}.log", ensure_safe_name(name)?)))
}

fn workflow_name_from_path(path: &Path) -> Option<String> {
    let filename = path.file_name()?.to_str()?;
    if filename.ends_with(".yaml") {
        return Some(filename.trim_end_matches(".yaml").to_string());
    }
    if filename.ends_with(".yml") {
        return Some(filename.trim_end_matches(".yml").to_string());
    }
    None
}

fn yaml_field<'a>(value: &'a YamlValue, key: &str) -> Option<&'a YamlValue> {
    match value {
        YamlValue::Mapping(map) => map.get(&YamlValue::String(key.to_string())),
        _ => None,
    }
}

fn extract_yaml_string(value: Option<&YamlValue>) -> Option<String> {
    match value {
        Some(YamlValue::String(s)) if !s.trim().is_empty() => Some(s.clone()),
        _ => None,
    }
}

fn extract_yaml_steps_len(value: Option<&YamlValue>) -> usize {
    match value {
        Some(YamlValue::Sequence(steps)) => steps.len(),
        _ => 0,
    }
}

fn read_json_file(path: &Path) -> Result<JsonValue, String> {
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

fn read_last_run_timestamp(workflow_name: &str) -> Option<String> {
    let path = workflow_state_path(workflow_name).ok()?;
    let state = read_json_file(&path).ok()?;
    state
        .get("lastRun")
        .and_then(|value| value.get("timestamp"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
}

fn read_crontab_lines() -> Vec<String> {
    let output = match Command::new("crontab").arg("-l").output() {
        Ok(output) if output.status.success() => output,
        _ => return Vec::new(),
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().map(|line| line.to_string()).collect()
}

fn workflow_schedule_map() -> HashMap<String, String> {
    let mut schedules = HashMap::new();
    for line in read_crontab_lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 7 {
            continue;
        }
        let runner = parts[5];
        if !runner.ends_with("run.sh") {
            continue;
        }
        let workflow_name = parts[6];
        schedules.insert(workflow_name.to_string(), parts[0..5].join(" "));
    }
    schedules
}

fn detect_runner_from_workflow_files() -> Option<PathBuf> {
    let dir = workflows_dir().ok()?;
    let entries = fs::read_dir(dir).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();
        if workflow_name_from_path(&path).is_none() {
            continue;
        }
        let Ok(canonical) = fs::canonicalize(&path) else {
            continue;
        };
        let components: Vec<String> = canonical
            .components()
            .map(|component| component.as_os_str().to_string_lossy().to_string())
            .collect();
        for window in components.windows(3) {
            if window == ["extensions", "workflows", "workflows"] {
                let Some(workflows_dir) = canonical.parent() else {
                    continue;
                };
                let Some(extension_dir) = workflows_dir.parent() else {
                    continue;
                };
                let runner = extension_dir.join("run.sh");
                if runner.exists() {
                    return Some(runner);
                }
            }
        }
    }

    None
}

fn detect_runner_path() -> Option<PathBuf> {
    for line in read_crontab_lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 7 && parts[5].ends_with("run.sh") {
            let candidate = PathBuf::from(parts[5]);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    if let Some(path) = detect_runner_from_workflow_files() {
        return Some(path);
    }

    let home = home_dir().ok()?;
    let common_candidates = [
        home.join(".edwinpai/workspace/workflows/run.sh"),
        home.join("Desktop/edwin/extensions/workflows/run.sh"),
        home.join("edwin/extensions/workflows/run.sh"),
        home.join(".edwinpai/workspace/plugins/workflows/run.sh"),
    ];

    common_candidates
        .into_iter()
        .find(|candidate| candidate.exists())
}

fn tail_lines(content: &str, limit: usize) -> String {
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() <= limit {
        return content.to_string();
    }
    lines[lines.len() - limit..].join("\n")
}

#[tauri::command]
pub async fn workflow_list() -> Result<WorkflowListResult, String> {
    let dir = workflows_dir()?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;

    let schedules = workflow_schedule_map();
    let mut workflows: Vec<WorkflowSummary> = Vec::new();

    let mut entries: Vec<PathBuf> = fs::read_dir(&dir)
        .map_err(|err| err.to_string())?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| workflow_name_from_path(path).is_some())
        .collect();

    entries.sort();

    for path in entries {
        let filename = path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Invalid workflow filename".to_string())?;
        let workflow_name = workflow_name_from_path(&path)
            .ok_or_else(|| format!("Invalid workflow filename: {filename}"))?;

        match fs::read_to_string(&path) {
            Ok(raw) => match serde_yaml::from_str::<YamlValue>(&raw) {
                Ok(parsed) => {
                    let yaml_name = extract_yaml_string(yaml_field(&parsed, "name"))
                        .unwrap_or_else(|| workflow_name.clone());
                    workflows.push(WorkflowSummary {
                        id: workflow_name.clone(),
                        name: yaml_name.clone(),
                        description: extract_yaml_string(yaml_field(&parsed, "description")),
                        step_count: extract_yaml_steps_len(yaml_field(&parsed, "steps")),
                        last_run: read_last_run_timestamp(&workflow_name),
                        schedule: schedules.get(&workflow_name).cloned(),
                        parse_error: None,
                    });
                }
                Err(err) => {
                    workflows.push(WorkflowSummary {
                        id: workflow_name.clone(),
                        name: workflow_name.clone(),
                        description: None,
                        step_count: 0,
                        last_run: read_last_run_timestamp(&workflow_name),
                        schedule: schedules.get(&workflow_name).cloned(),
                        parse_error: Some(err.to_string()),
                    });
                }
            },
            Err(err) => {
                workflows.push(WorkflowSummary {
                    id: workflow_name.clone(),
                    name: workflow_name.clone(),
                    description: None,
                    step_count: 0,
                    last_run: read_last_run_timestamp(&workflow_name),
                    schedule: schedules.get(&workflow_name).cloned(),
                    parse_error: Some(err.to_string()),
                });
            }
        }
    }

    workflows.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(WorkflowListResult { workflows })
}

#[tauri::command]
pub async fn workflow_status(workflow: String) -> Result<WorkflowStatusResult, String> {
    let name = ensure_safe_name(&workflow)?;
    let path = workflow_state_path(&name)?;
    let state = if path.exists() {
        Some(read_json_file(&path)?)
    } else {
        None
    };
    let last_run = state
        .as_ref()
        .and_then(|value| value.get("lastRun"))
        .cloned();

    Ok(WorkflowStatusResult {
        workflow_name: name,
        last_run,
        state,
    })
}

#[tauri::command]
pub async fn workflow_history(workflow: String) -> Result<WorkflowHistoryResult, String> {
    let name = ensure_safe_name(&workflow)?;
    let path = workflow_history_path(&name)?;
    if !path.exists() {
        return Ok(WorkflowHistoryResult {
            workflow_name: name,
            runs: Vec::new(),
        });
    }

    let history = read_json_file(&path)?;
    let runs = history
        .get("runs")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(WorkflowHistoryResult {
        workflow_name: name,
        runs,
    })
}

#[tauri::command]
pub async fn workflow_run(workflow: String) -> Result<WorkflowRunResult, String> {
    let name = ensure_safe_name(&workflow)?;
    let runner = detect_runner_path().ok_or_else(|| {
        "Workflow runner not found. Install the workflows extension or configure a workflow crontab entry first."
            .to_string()
    })?;

    let log_path = workflow_log_path(&name)?;
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(
            file,
            "=== {} === Manual run requested from Edwin Desktop ===",
            chrono::Local::now().to_rfc3339()
        );
    }

    let child = Command::new("bash")
        .arg(runner)
        .arg(&name)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| format!("Failed to start workflow '{name}': {err}"))?;

    Ok(WorkflowRunResult {
        success: true,
        message: format!("Started workflow '{name}'"),
        pid: Some(child.id()),
    })
}

#[tauri::command]
pub async fn workflow_pending() -> Result<Vec<WorkflowPendingApproval>, String> {
    let dir = workflow_approvals_dir()?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;

    let mut approvals = Vec::new();
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let path = entry.map_err(|err| err.to_string())?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let raw = match fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(_) => continue,
        };
        let approval = match serde_json::from_str::<ApprovalFile>(&raw) {
            Ok(approval) => approval,
            Err(_) => continue,
        };
        if approval.status == "pending" {
            approvals.push(WorkflowPendingApproval {
                id: approval.id,
                workflow: approval.workflow,
                step: approval.step,
                message: approval.message,
                timestamp: approval.timestamp,
            });
        }
    }

    approvals.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(approvals)
}

fn update_approval_status(
    approval_id: &str,
    status: &str,
    actor: &str,
    approval_surface: &str,
) -> Result<bool, String> {
    let approval_id = ensure_safe_name(approval_id)?;
    let path = workflow_approvals_dir()?.join(format!("{}.json", approval_id));
    if !path.exists() {
        return Ok(false);
    }

    let raw = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    let mut approval = serde_json::from_str::<ApprovalFile>(&raw).map_err(|err| err.to_string())?;
    approval.status = status.to_string();
    approval.approver = Some(actor.to_string());
    approval.approval_surface = Some(approval_surface.to_string());
    approval.approved_at = Some(chrono::Utc::now().to_rfc3339());
    let updated = serde_json::to_string_pretty(&approval).map_err(|err| err.to_string())?;
    fs::write(path, updated).map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn workflow_approve(approval_id: String) -> Result<bool, String> {
    update_approval_status(&approval_id, "approved", "owner-admin", "desktop")
}

#[tauri::command]
pub async fn workflow_deny(approval_id: String) -> Result<bool, String> {
    update_approval_status(&approval_id, "denied", "owner-admin", "desktop")
}

#[tauri::command]
pub async fn workflow_logs(workflow: String) -> Result<WorkflowLogsResult, String> {
    let name = ensure_safe_name(&workflow)?;
    let path = workflow_log_path(&name)?;
    let content = match fs::read_to_string(&path) {
        Ok(content) => tail_lines(&content, 200),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(err) => return Err(err.to_string()),
    };

    Ok(WorkflowLogsResult {
        workflow_name: name,
        content,
    })
}

#[tauri::command]
pub async fn workflow_list_files() -> Result<WorkflowFileListResult, String> {
    let dir = workflows_dir()?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;

    let mut files: Vec<String> = fs::read_dir(&dir)
        .map_err(|err| err.to_string())?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| name.ends_with(".yaml") || name.ends_with(".yml"))
        .collect();
    files.sort();

    Ok(WorkflowFileListResult { files })
}

#[tauri::command]
pub async fn workflow_load_file(filename: String) -> Result<WorkflowFileContentResult, String> {
    let safe_filename = ensure_safe_filename(&filename)?;
    let path = workflow_file_path(&safe_filename)?;
    let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    Ok(WorkflowFileContentResult {
        filename: safe_filename,
        content,
    })
}

#[tauri::command]
pub async fn workflow_save_file(filename: String, content: String) -> Result<bool, String> {
    let safe_filename = ensure_safe_filename(&filename)?;
    serde_yaml::from_str::<YamlValue>(&content)
        .map_err(|err| format!("YAML parse error: {err}"))?;
    let path = workflow_file_path(&safe_filename)?;
    fs::write(path, content).map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn workflow_create_file(filename: String) -> Result<WorkflowFileContentResult, String> {
    let safe_filename = ensure_safe_filename(&filename)?;
    let path = workflow_file_path(&safe_filename)?;
    if path.exists() {
        return Err("Workflow file already exists".to_string());
    }
    let content =
        "name: \n\ndescription: \n\nsteps:\n  - id: example\n    exec: \"echo 'hello'\"\n"
            .to_string();
    fs::write(&path, &content).map_err(|err| err.to_string())?;
    Ok(WorkflowFileContentResult {
        filename: safe_filename,
        content,
    })
}
