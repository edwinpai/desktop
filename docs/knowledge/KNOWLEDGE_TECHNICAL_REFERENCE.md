# Knowledge Technical Reference

This document explains how the current Edwin Desktop Knowledge implementation works.

## Purpose

Desktop's Knowledge feature is a **read/inspect surface** over three data domains:

- Shad sources
- Edwin discipline metadata
- Shad run artifacts

It does not yet own the full authoring and orchestration lifecycle.

## UI model

The desktop UI exposes three tabs:

- **Sources**
- **Disciplines**
- **Runs**

Frontend entry point:

- `src/components/knowledge/KnowledgePanel.tsx`

Frontend transport/types:

- `src/lib/knowledge.ts`

Tauri command implementation:

- `src-tauri/src/commands/knowledge.rs`

## Command surface

The current Tauri commands are:

- `knowledge_list_sources`
- `knowledge_list_disciplines`
- `knowledge_get_discipline_details`
- `knowledge_list_runs`
- `knowledge_get_run_details`

These commands are registered in:

- `src-tauri/src/lib.rs`

## Data locations

### Sources

Desktop reads Shad source metadata from:

- `~/.shad/sources.yaml`

It then optionally enriches that with QMD collection metadata by shelling out to one of:

- `qmd collection list`
- `qmd collections list`

QMD binary detection currently checks:

- `PATH`
- `~/.bun/bin/qmd`
- `~/.npm-global/bin/qmd`
- `~/.local/bin/qmd`
- `/usr/local/bin/qmd`
- `/usr/bin/qmd`

### Disciplines

Desktop reads discipline metadata from:

- `~/.edwinpai/knowledge/disciplines.json`

This file is currently the desktop discipline registry.

Schema wrapper:

```json
{ "disciplines": [ ... ] }
```

Per-record fields currently supported by the backend:

- `id`
- `name`
- `description`
- `selectedCollections[]`
- `status`
- `createdAt`
- `updatedAt`
- `latestRunId`
- `artifactKinds[]`
- `evidencePolicy`
- `freshnessLabel`
- `sourceSnapshot`
- `runtimeAttachmentPolicy`
- `notesMarkdown`
- `artifactPaths[]`

### Runs

Desktop reads run directories from:

- `~/.shad/history/Runs/`

Each run is expected to be a directory containing at minimum:

- `run.manifest.json`

Optional files used for richer detail:

- `final.summary.json`
- `final.report.md`

## Run parsing behavior

Desktop derives summary data from `run.manifest.json` plus optional summary/report files.

Important fields surfaced:

- run ID
- status
- goal
- collection path
- strategy override
- created/completed timestamps
- token totals
- result preview
- manifest path
- report path

If `final.summary.json` exists, its metrics and result can override or enrich manifest-level data.

## Security behavior

`knowledge_get_run_details` validates the requested manifest path.

Current protections:

- canonicalizes the path
- requires the file to live under `~/.shad/history/Runs/`
- requires the filename to be exactly `run.manifest.json`

This prevents arbitrary file reads via the run-detail command.

## Current architecture boundaries

It is important not to overstate what Desktop owns today.

Desktop currently:

- displays Shad source metadata
- displays QMD collection metadata when available
- displays Edwin discipline registry metadata
- displays Shad run history and reports

Desktop does **not yet** fully:

- author disciplines through a full CRUD UI
- own source ingestion/sync
- own QMD collection lifecycle
- guarantee bidirectional consistency between disciplines and collections
- automatically create disciplines from sources or runs

## Mental model for contributors

Use this model when extending the feature:

- **Sources** are intake metadata
- **Collections** are search/index substrate
- **Disciplines** are curated runtime metadata
- **Runs** are evidence/synthesis history

Avoid collapsing these into one concept. The separation is intentional.

## Recommended next improvements

1. Add discipline create/edit UX in Desktop
2. Validate `disciplines.json` against a shared schema
3. Add source-health diagnostics in the UI
4. Show direct links from disciplines to latest runs and artifacts
5. Make collection provenance clearer when QMD is unavailable
6. Document authoring flows in-app, not just in repo docs

## Related files

- `src/components/knowledge/KnowledgePanel.tsx`
- `src/lib/knowledge.ts`
- `src-tauri/src/commands/knowledge.rs`
- `docs/discipline-architecture-design.md`
- `docs/knowledge/KNOWLEDGE_USER_GUIDE.md`
