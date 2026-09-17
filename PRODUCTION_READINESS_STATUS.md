# COLORJET Management Suite — Production Readiness Status

Audit date: 2026-09-17 UTC  
Repository: `neellipto/colorjet-management-suite`  
Status: **NOT READY**

## 1) Full repository audit (current components)

| Area | Status | Notes |
|---|---|---|
| `artifacts/mobile` Expo mobile/PWA client | VERIFIED | Source exists, typecheck/build commands exist. |
| `android-v11.3-native` Android wrapper | PARTIAL/BROKEN | Build config exists; release signing depends on external secrets/keystore. |
| `apk-wrapper` Android WebView wrapper | PARTIAL/BROKEN | Debug APK pipeline only. |
| `field-service-mobile` Android module | NOT BUILT YET | Minimal Gradle shell, no validated CI evidence in this run. |
| `services/cjext-customer360` Flask service | VERIFIED (internal tool) | Read-only stored-proc wrapper with API key gate; not customer-public auth backend. |
| `database/mssql` SQL assets | VERIFIED with constraints | Reporting DB scripts + security roles present. `05`/`06` are superseded and blocked from canonical ERP deploy. |
| GitHub workflows | PARTIAL/BROKEN | Existing workflows present; production gating and safety checks were incomplete before this change. |
| Core ERP backend/API source for full business modules | BLOCKED | Full authenticated server-side ERP runtime is not present in this repository. |

## 2) Production-deployable components actually detected

- Deployable with current source:
  - Expo web export (`artifacts/mobile/static-build`) served by `artifacts/mobile/server/serve.js` (`/status`).
  - Internal customer360 Flask service (`services/cjext-customer360/app.py`) with `/health`.
- Hard blocker:
  - No complete canonical ERP API/backend source in this repository for the required online-only critical operations.

## 3) Safety and release controls added in this PR

- CI safety guard script: `scripts/readiness/secret_and_mssql_guard.sh`
  - Rejects committed `.env` files.
  - Flags likely hardcoded DB/API/signing secrets.
  - Rejects direct MSSQL connection signatures in browser/mobile code.
- MSSQL static preflight: `scripts/readiness/mssql_preflight.sh`
  - Verifies required reporting scripts.
  - Verifies superseded script warnings (`05_identity_rbac_portal.sql`, `06_phaseA_customer_module.sql`).
  - Verifies `colorjet_sync_writer` (no delete) and `colorjet_app_reader` (read-only) policy.
- Migration gate script: `scripts/readiness/mssql_migration_gate.sh`
  - Staging/production target enforcement.
  - Explicit production approval + change ticket requirement.
  - Hard-blocks superseded scripts for canonical ERP.
- Health/readiness script: `scripts/readiness/health_readiness.sh`
  - Validates `/status` and `/health` routes are defined; optional URL probes.
- Workflow hardening:
  - `production-check.yml` now runs safety/preflight checks before mobile build.
  - Added manual `mssql-migration-gate.yml` with explicit production gate.
  - Retired placeholder push/PR workflow behavior in `blank.yml` (manual-only archive note).

## 4) Local validation evidence (commands actually run)

| Command | Result |
|---|---|
| `bash -n scripts/readiness/*.sh` | PASSED |
| `./scripts/readiness/secret_and_mssql_guard.sh` | PASSED |
| `./scripts/readiness/mssql_preflight.sh` | PASSED |
| `./scripts/readiness/health_readiness.sh` | PASSED |
| `python3 -m py_compile services/cjext-customer360/app.py` | PASSED |
| `corepack enable && pnpm --version` | PASSED |
| `pnpm install --frozen-lockfile` | PASSED |
| `pnpm install --no-frozen-lockfile` | PASSED |
| `pnpm --filter @workspace/mobile run typecheck` | PASSED |
| `pnpm --filter @workspace/mobile run build` | PASSED |

CI investigation evidence:
- Workflow runs reviewed via GitHub Actions API: `35184721554` (Production Check), `35184721506` (CI).
- `get_job_logs` returned no failed jobs for both runs (action_required state without failed job logs).

## 5) Backup/restore and rollback (documentation scope only)

- No live infrastructure action was performed.
- Existing SQL and service docs include rollback/backup procedures; production execution remains blocked pending staging rehearsal evidence.
- Required before production claim:
  - Staging DB backup + restore drill evidence.
  - Reconciliation evidence for accounting/stock/payment critical paths.
  - Verified rollback timing and operator runbook sign-off.

## 6) Honest release label

Final release status: **NOT READY**

Blocking gaps:
1. Canonical full ERP backend/API runtime for all critical modules is not present/verified in this repo.
2. No staging MSSQL migration rehearsal evidence attached in this run.
3. No authenticated end-to-end browser/mobile integration test evidence against staging ERP APIs.
4. No backup/restore drill evidence captured from staging.
5. No signed release APK/AAB evidence produced in this run (signing credentials are external and not committed).
