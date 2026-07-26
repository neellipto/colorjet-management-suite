# Source Conflict Report

| Conflict | Evidence | Severity/status |
|---|---|---|
| Version code | Contract: 1.7.0/1701; latest commit: 1.7.2/11 | RELEASE BLOCKED pending Play evidence |
| Primary UX | Contract forbids primary WebView; history explicitly introduced a WebView wrapper and later native shell around unified mobile workspace | HIGH / NOT VERIFIED |
| Data platform | README specifies read-only Odoo reporting DB; history mentions Supabase production migration; contract names PHP/MySQL/NestJS | HIGH / NOT VERIFIED |
| Baseline currency | Contract baseline predates latest visible app commit | HIGH / PARTIAL |
| Required inputs | Named packages and production artifacts absent | RELEASE BLOCKED |

No merge or runtime edit is safe until the authoritative production baseline and source packages are reconciled.

## Classification legend
PASS · PARTIAL · MISSING · BROKEN · BLOCKED · NOT TESTED · NOT VERIFIED

## Evidence boundary
Prepared 2026-07-27 from the requirement contract, repository README, and GitHub commit metadata. Full private source checkout, runtime credentials, binaries, and production infrastructure were not available. Unknowns are never promoted to PASS.
