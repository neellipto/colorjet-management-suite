#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "[health] static readiness checks"
if ! grep -qiE "req\\.url\\s*===\\s*['\"]/status['\"]" artifacts/mobile/server/serve.js; then
  echo "ERROR: /status handler not found in artifacts/mobile/server/serve.js"
  exit 1
fi
if ! grep -qiE "@app\\.(get|route)\\(['\"]/health['\"]" services/cjext-customer360/app.py; then
  echo "ERROR: /health route not found in services/cjext-customer360/app.py"
  exit 1
fi

if [[ -n "${STATIC_SERVER_URL:-}" ]]; then
  echo "[health] probing static server: ${STATIC_SERVER_URL}/status"
  curl --fail --silent --show-error "${STATIC_SERVER_URL%/}/status" >/dev/null
fi

if [[ -n "${C360_URL:-}" ]]; then
  echo "[health] probing customer360: ${C360_URL}/health"
  curl --fail --silent --show-error "${C360_URL%/}/health" >/dev/null
fi

echo "[health] PASS"
