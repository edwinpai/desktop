#!/usr/bin/env bash
set -euo pipefail

# EdwinPAI Desktop bundled runtime installer.
# This is intentionally non-silent: the desktop app shows this output in its setup log.

EDWINPAI_VERSION="${EDWINPAI_VERSION:-beta}"
INSTALL_URL="${EDWINPAI_INSTALL_URL:-https://edwinpai.com/install.sh}"

echo "=== EdwinPAI Runtime Installer ==="
echo "Target version/channel: ${EDWINPAI_VERSION}"
echo "Installer URL: ${INSTALL_URL}"

echo "Checking prerequisites..."
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required before installing EdwinPAI runtime. Install Node.js 22+ and try again." >&2
  exit 10
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is required before installing EdwinPAI runtime." >&2
  exit 11
fi
node --version
npm --version

if command -v curl >/dev/null 2>&1; then
  echo "Trying canonical installer script..."
  if curl -fsSL "${INSTALL_URL}" -o /tmp/edwinpai-install.sh; then
    chmod +x /tmp/edwinpai-install.sh
    bash /tmp/edwinpai-install.sh
  else
    echo "Installer URL unavailable; falling back to npm beta package install."
    npm install -g "@edwinpai/edwinpai@${EDWINPAI_VERSION}"
    edwinpai setup || true
  fi
else
  echo "curl not found; using npm package install."
  npm install -g "@edwinpai/edwinpai@${EDWINPAI_VERSION}"
  edwinpai setup || true
fi

echo "Verifying EdwinPAI runtime..."
edwinpai --version
edwinpai gateway status || true

echo "EdwinPAI runtime installer finished."
