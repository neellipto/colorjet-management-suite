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
grep -q 'CREATE ROLE colorjet_sync_writer' database/mssql/03_security.sql
grep -q 'CREATE ROLE colorjet_app_reader' database/mssql/03_security.sql
grep -q 'DENY  DELETE' database/mssql/03_security.sql
grep -q 'GRANT SELECT' database/mssql/03_security.sql

echo "[mssql-preflight] PASS"
