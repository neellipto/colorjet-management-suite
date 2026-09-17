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

  if [[ ! "$sql_file" =~ ^database/mssql/.*\.sql$ ]]; then
    echo "ERROR: migration files must be SQL files under database/mssql: $sql_file"
    exit 1
  fi

  case "$sql_file" in
    database/mssql/01_schema.sql|\
    database/mssql/02_views.sql|\
    database/mssql/03_security.sql|\
    database/mssql/04_owner_dashboard_mapping.sql|\
    database/mssql/07_phaseA_customer_portal_reuse.sql|\
    database/mssql/08_phaseA_360_tabs.sql|\
    database/mssql/09_customer360_readonly_login.sql|\
    database/mssql/10_phaseB_engineer360_reuse.sql|\
    database/mssql/11_product_master_contact_import.sql)
      ;;
    database/mssql/05_identity_rbac_portal.sql|database/mssql/06_phaseA_customer_module.sql)
      echo "ERROR: $sql_file is superseded and must not be deployed to canonical ERP."
      exit 1
      ;;
    *)
      echo "ERROR: $sql_file is not in the approved migration allowlist."
      exit 1
      ;;
  esac
done

echo "[migration-gate] PASS for ${target_env}"
