#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "[guard] checking for committed .env files"
tracked_env_files="$(git ls-files '*.env' ':!:*.env.example' || true)"
if [[ -n "${tracked_env_files}" ]]; then
  echo "ERROR: committed .env files detected:"
  echo "$tracked_env_files"
  exit 1
fi

echo "[guard] scanning for hardcoded sensitive values in source/config"
secret_hits="$(git grep -nI -E '(DB_PASSWORD|DATABASE_URL|API_KEY|OWNER_PASSWORD|ANDROID_KEYSTORE_PASSWORD|ANDROID_KEY_PASSWORD|COLORJET_ANDROID_KEYSTORE_BASE64)\s*[:=]\s*["'"'"'][^<${][^"'"'"']+["'"'"']|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' -- \
  ':!**/*.md' ':!**/*.txt' ':!**/*.example' ':!**/.env.example' ':!services/cjext-customer360/cjext-customer360.env.example' || true)"
if [[ -n "${secret_hits}" ]]; then
  echo "ERROR: potential hardcoded secret material detected:"
  echo "$secret_hits"
  exit 1
fi

echo "[guard] ensuring browser/mobile clients do not contain direct MSSQL access patterns"
mssql_hits="$(git grep -nI -E '(1433|jdbc:sqlserver|Driver=\{ODBC Driver|Server=|Data Source=|mssql://|sqlserver://|Trusted_Connection=)' -- \
  artifacts/mobile android-v11.3-native apk-wrapper field-service-mobile || true)"
if [[ -n "${mssql_hits}" ]]; then
  echo "ERROR: direct MSSQL access signature found in browser/mobile code:"
  echo "$mssql_hits"
  exit 1
fi

echo "[guard] PASS"
