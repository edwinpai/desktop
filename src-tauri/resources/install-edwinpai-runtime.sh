#!/usr/bin/env bash
set -euo pipefail

# EdwinPAI Desktop bundled runtime installer.
# This is intentionally non-silent: the desktop app shows this output in its setup log.

EDWINPAI_VERSION="${EDWINPAI_VERSION:-beta}"
INSTALL_URL="${EDWINPAI_INSTALL_URL:-}"

echo "=== EdwinPAI Runtime Installer ==="
echo "Target version/channel: ${EDWINPAI_VERSION}"
if [[ -n "${INSTALL_URL}" ]]; then
  echo "Installer URL override: ${INSTALL_URL}"
else
  echo "Install method: npm package @edwinpai/edwinpai@${EDWINPAI_VERSION}"
fi

echo "Checking prerequisites..."
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required before installing EdwinPAI runtime. Install Node.js 22+ and try again." >&2
  exit 10
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is required before installing EdwinPAI runtime." >&2
  exit 11
fi

NODE_VERSION_RAW="$(node --version)"
NODE_MAJOR="${NODE_VERSION_RAW#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
echo "Node: ${NODE_VERSION_RAW}"
echo "npm: $(npm --version)"
if [[ ! "${NODE_MAJOR}" =~ ^[0-9]+$ ]] || (( NODE_MAJOR < 22 )); then
  echo "ERROR: EdwinPAI requires Node.js 22 or newer. Found ${NODE_VERSION_RAW}." >&2
  exit 12
fi

install_with_npm() {
  echo "Installing EdwinPAI runtime from npm..."
  npm install -g "@edwinpai/edwinpai@${EDWINPAI_VERSION}"
  echo "Preparing first-run config..."
  edwinpai setup || true
}

if [[ -n "${INSTALL_URL}" ]]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: EDWINPAI_INSTALL_URL was set, but curl is not available." >&2
    exit 13
  fi
  echo "Running installer URL override..."
  curl -fsSL "${INSTALL_URL}" -o /tmp/edwinpai-install.sh
  chmod +x /tmp/edwinpai-install.sh
  bash /tmp/edwinpai-install.sh
else
  install_with_npm
fi

echo "Verifying EdwinPAI runtime..."
edwinpai --version
edwinpai gateway status || true

echo "EdwinPAI runtime installer finished."
