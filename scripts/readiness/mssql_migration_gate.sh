#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <staging|production> <sql-file> [<sql-file> ...]"
  exit 1
fi

target_env="$1"
shift

if [[ "$target_env" != "staging" && "$target_env" != "production" ]]; then
  echo "ERROR: target environment must be staging or production."
  exit 1
fi

if [[ "$target_env" == "production" ]]; then
  if [[ "${PRODUCTION_APPROVED:-}" != "YES" ]]; then
    echo "ERROR: production migrations are blocked without explicit PRODUCTION_APPROVED=YES."
    exit 1
  fi
  if [[ -z "${PRODUCTION_CHANGE_TICKET:-}" ]]; then
    echo "ERROR: production migrations require PRODUCTION_CHANGE_TICKET."
    exit 1
  fi
fi

for sql_file in "$@"; do
  if [[ ! -f "$sql_file" ]]; then
    echo "ERROR: migration file not found: $sql_file"
    exit 1
  fi

  base="$(basename "$sql_file")"
  if [[ "$base" == "05_identity_rbac_portal.sql" || "$base" == "06_phaseA_customer_module.sql" ]]; then
    echo "ERROR: $base is superseded and must not be deployed to canonical ERP."
    exit 1
  fi
done

echo "[migration-gate] PASS for ${target_env}"
