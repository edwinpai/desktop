# Knowledge User Guide

This guide explains the **Knowledge** section in Edwin Desktop.

## What the Knowledge screen is for

The Knowledge screen gives you one place to inspect the material Edwin can work from and the synthesis work it has already done.

It is split into three tabs:

- **Sources** — where knowledge comes from
- **Disciplines** — curated knowledge bundles
- **Runs** — Shad knowledge runs and reports

In plain English:

- Sources are the input
- Disciplines are the organization layer
- Runs are the evidence/output layer

## Sources

The **Sources** tab shows the material feeding the knowledge system.

Typical fields include:

- source label
- source type
- origin path or URL
- schedule/preset
- whether it is enabled
- linked collection info
- last sync/update information

Desktop reads source information from the Shad environment, especially:

- `~/.shad/sources.yaml`
- QMD collection metadata if `qmd` is installed

If QMD is unavailable, sources can still appear, but collection-level enrichment may be limited.

## Disciplines

The **Disciplines** tab shows named knowledge bundles.

A discipline is meant to answer:

> "When Edwin works on this topic, what curated body of knowledge should it use?"

A discipline can include:

- a stable ID and display name
- description
- selected collections
- status
- artifact kinds
- evidence policy
- freshness label
- latest associated run
- notes and artifact paths

### Current source of truth

Right now, the desktop app reads disciplines from:

- `~/.edwinpai/knowledge/disciplines.json`

If that file does not exist, the Disciplines tab will be empty.

## Runs

The **Runs** tab shows real Shad knowledge runs.

Desktop currently looks in:

- `~/.shad/history/Runs/`

For each run, the app can surface:

- run ID
- status
- goal
- collection path
- strategy
- created/completed timestamps
- total tokens
- result preview
- report path

Opening a run gives you access to the generated summary/report material when available.

## Typical workflow

A practical workflow looks like this:

1. Configure or sync Shad sources
2. Make sure QMD can see the relevant collections
3. Create or update `~/.edwinpai/knowledge/disciplines.json`
4. Run Shad synthesis/analysis work
5. Use the Desktop Knowledge view to inspect the results

## Example discipline file

Create this file if you want the Disciplines tab to populate:

`~/.edwinpai/knowledge/disciplines.json`

```json
{
  "disciplines": [
    {
      "id": "product-strategy",
      "name": "Product Strategy",
      "description": "Roadmap, positioning, and product decision context.",
      "selectedCollections": ["product-docs", "meeting-notes"],
      "status": "active",
      "createdAt": "2026-04-26T00:00:00Z",
      "updatedAt": "2026-04-26T00:00:00Z",
      "latestRunId": "run_123",
      "artifactKinds": ["report", "summary"],
      "evidencePolicy": "cite-sources",
      "freshnessLabel": "fresh",
      "sourceSnapshot": "Collections captured after April planning ingest.",
      "runtimeAttachmentPolicy": "attach-on-demand",
      "notesMarkdown": "Use this discipline for roadmap and positioning work.",
      "artifactPaths": [
        "/home/jake/.shad/history/Runs/run_123/final.report.md"
      ]
    }
  ]
}
```

## Troubleshooting

### The Knowledge page is empty

Check these first:

- `~/.shad/sources.yaml` exists
- `~/.shad/history/Runs/` contains runs
- `~/.edwinpai/knowledge/disciplines.json` exists
- `qmd` is installed and on `PATH`

### Sources appear but collection info is missing

Usually this means Desktop could not query QMD collection metadata.

Check:

- `qmd` is installed
- `qmd collection list` or `qmd collections list` works in your shell

### Disciplines are missing

The desktop app does not invent disciplines automatically. It only reads the registry file.

Create:

- `~/.edwinpai/knowledge/disciplines.json`

### Runs are missing

Desktop only shows runs that exist under:

- `~/.shad/history/Runs/`

If no Shad runs have been created yet, the Runs tab will be empty.

## Current limitations

The current Knowledge implementation is intentionally inspectable, but still early.

Known limitations:

- discipline authoring is file-driven rather than fully managed in the UI
- desktop currently reads state from existing Shad/QMD outputs rather than owning the full pipeline
- some workflows are better documented than automated
- architecture is ahead of product polish in a few areas

## Related docs

For the public product-level explanation, see <https://docs.edwinpai.com/concepts/knowledge>.

## Related docs

- `docs/knowledge/KNOWLEDGE_TECHNICAL_REFERENCE.md`
- `docs/discipline-architecture-design.md`
