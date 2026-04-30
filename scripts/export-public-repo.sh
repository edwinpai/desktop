#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/export-public-repo.sh --target-dir <dir> [--dry-run]

Exports the sanitized public desktop tree from the private development repo.
This is intentionally a copy/squash export: it never copies .git history.
USAGE
}

TARGET_DIR=""
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-dir)
      TARGET_DIR="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$TARGET_DIR" ]]; then
  echo "--target-dir is required" >&2
  usage >&2
  exit 2
fi

mkdir -p "$TARGET_DIR"

RSYNC_ARGS=(
  -a
  --delete
  --delete-excluded
  --exclude '/.git/'
  --exclude '/.github/workflows/'
  --exclude '/.agent/'
  --exclude '/.claude/'
  --exclude '/.pi/'
  --exclude '/.pnpm-store/'
  --exclude '/.secrets.baseline'
  --exclude '/node_modules/'
  --exclude '/**/node_modules/'
  --exclude '/dist/'
  --exclude '/**/dist/'
  --exclude '/src-tauri/target/'
  --exclude '/src-tauri/crates/identity-core/'
  --exclude '/src-tauri/crates/identity-core-node/'
  --exclude '/src-tauri/src/crypto_domain/'
  --exclude '/src/test/crypto/'
  --exclude '/src/lib/crypto-domain.ts'
  --exclude '/src/lib/crypto.ts'
  --exclude '/docs/discipline-architecture-design.md'
  --exclude '/docs/knowledge/'
  --exclude '/marketing/SHAD_MEMORY_QUALITY_SPRINT.md'
  --exclude '/src/components/settings/MemorySettings.tsx'
  --exclude '/.tmp/'
  --exclude '/tmp/'
  --exclude '/coverage/'
  --exclude '/.nyc_output/'
  --exclude '/.env'
  --exclude '/.env.*'
  --exclude '/npm-debug.log*'
  --exclude '/pnpm-debug.log*'
  --exclude '/.DS_Store'
)

if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
fi

rsync "${RSYNC_ARGS[@]}" ./ "$TARGET_DIR"/

if [[ "$DRY_RUN" != "1" ]]; then
  mkdir -p "$TARGET_DIR/.github/workflows"
  cat > "$TARGET_DIR/.github/workflows/workflow-sanity.yml" <<'EOF'
name: Workflow Sanity

on:
  pull_request:
  push:

jobs:
  public-desktop-sanity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Guard protected source boundaries
        run: |
          chmod +x scripts/public-export-guard.sh
          scripts/public-export-guard.sh .

      - name: Fail on tabs in workflow files
        run: |
          python - <<'PY'
          from __future__ import annotations
          import pathlib
          import sys
          failures = []
          for path in pathlib.Path('.github/workflows').glob('*.yml'):
              for line_number, line in enumerate(path.read_text().splitlines(), 1):
                  if '\t' in line:
                      failures.append(f'{path}:{line_number}: tab character found')
          if failures:
              print('\n'.join(failures))
              sys.exit(1)
          PY
EOF

  cat > "$TARGET_DIR/PUBLIC_EXPORT.md" <<'EOF'
# Public Desktop Export

This repository is a sanitized copy export from the private `jonesj38/edwin-desktop`
development repository. It is intentionally copied without private git history.

Do not merge private development history into this repository. Future updates
should arrive through the controlled public export workflow.
EOF
fi
