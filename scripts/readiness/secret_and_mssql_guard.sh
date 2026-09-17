#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "[guard] checking for committed .env files"
tracked_env_files="$(
  git ls-files | grep -E '(^|/)\.env(\..+)?$' | grep -vE '\.env(\..+)?\.example$' || true
)"
if [[ -n "${tracked_env_files}" ]]; then
  echo "ERROR: committed .env files detected:"
  echo "$tracked_env_files"
  exit 1
fi

echo "[guard] scanning for hardcoded sensitive values in source/config"
raw_secret_hits="$(git grep -nI -E '(DB_PASSWORD|DATABASE_URL|API_KEY|OWNER_PASSWORD|ANDROID_KEYSTORE_PASSWORD|ANDROID_KEY_PASSWORD|COLORJET_ANDROID_KEYSTORE_BASE64)\s*[:=]\s*(["'"'"'][^"'"'"']+["'"'"']|[^[:space:]#]+)|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' -- \
  artifacts/mobile android-v11.3-native apk-wrapper field-service-mobile services \
  ':!**/*.md' ':!**/*.txt' ':!**/*.example' ':!**/.env.example' ':!services/cjext-customer360/cjext-customer360.env.example' || true)"
secret_hits="$(printf '%s\n' "$raw_secret_hits" | grep -vE '(os\.environ\.get|System\.getenv|process\.env|<[^>]+>|REPLACE_WITH_|generate-strong|\$\{[^}]+\})' || true)"
if [[ -n "${secret_hits}" ]]; then
  echo "ERROR: potential hardcoded secret material detected:"
  echo "$secret_hits"
  exit 1
fi

echo "[guard] ensuring browser/mobile clients do not contain direct MSSQL access patterns"
mssql_hits="$(git grep -nI -E '((([0-9]{1,3}\.){3}[0-9]{1,3}|[A-Za-z0-9._-]+),1433|[A-Za-z0-9._-]+:1433|jdbc:sqlserver|Driver=\{ODBC Driver[^;]*;[^;]*Server=|Data Source=[^;]*1433|mssql://|sqlserver://|Trusted_Connection=)' -- \
  artifacts/mobile android-v11.3-native apk-wrapper field-service-mobile || true)"
if [[ -n "${mssql_hits}" ]]; then
  echo "ERROR: direct MSSQL access signature found in browser/mobile code:"
  echo "$mssql_hits"
  exit 1
fi

echo "[guard] PASS"
