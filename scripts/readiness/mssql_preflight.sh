#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

required_files=(
  "database/mssql/01_schema.sql"
  "database/mssql/02_views.sql"
  "database/mssql/03_security.sql"
  "database/mssql/AUDIT_FINDINGS.md"
)

echo "[mssql-preflight] verifying required reporting DB files"
for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || { echo "ERROR: missing $file"; exit 1; }
done

echo "[mssql-preflight] ensuring superseded scripts remain non-deployable for canonical ERP"
grep -q 'SUPERSEDED' database/mssql/AUDIT_FINDINGS.md
grep -q '05_identity_rbac_portal.sql' database/mssql/AUDIT_FINDINGS.md
grep -q '06_phaseA_customer_module.sql' database/mssql/AUDIT_FINDINGS.md

echo "[mssql-preflight] verifying report DB role policy (writer no DELETE, reader SELECT-only)"
grep -qiE 'CREATE[[:space:]]+ROLE[[:space:]]+colorjet_sync_writer' database/mssql/03_security.sql
grep -qiE 'CREATE[[:space:]]+ROLE[[:space:]]+colorjet_app_reader' database/mssql/03_security.sql
grep -qiP '^\s*GRANT\s+(?=[^;]*\bSELECT\b)(?=[^;]*\bINSERT\b)(?=[^;]*\bUPDATE\b)[^;]*\bON\s+SCHEMA::report\b[^;]*\bTO\s+colorjet_sync_writer\b' database/mssql/03_security.sql
grep -qiP '^\s*DENY\s+DELETE\b[^;]*\bON\s+SCHEMA::report\b[^;]*\bTO\s+colorjet_sync_writer\b' database/mssql/03_security.sql

grep -qiP '^\s*GRANT\s+SELECT\b[^;]*\bON\s+SCHEMA::report\b[^;]*\bTO\s+colorjet_app_reader\b' database/mssql/03_security.sql
grep -qiP '^\s*DENY\s+(?=[^;]*\bINSERT\b)(?=[^;]*\bUPDATE\b)(?=[^;]*\bDELETE\b)[^;]*\bON\s+SCHEMA::report\b[^;]*\bTO\s+colorjet_app_reader\b' database/mssql/03_security.sql

echo "[mssql-preflight] PASS"
