# Permission Inventory

The contract defines roles, action/field/record/scope dimensions, default deny, and precedence: Security Policy → Explicit User Deny → Explicit User Grant → Role Permission → Scope Restriction → Default Deny. Existing backend enforcement is NOT VERIFIED. UI hiding is not accepted as authorization. Direct unauthorized API tests are BLOCKED pending a runnable backend.

## Classification legend
PASS · PARTIAL · MISSING · BROKEN · BLOCKED · NOT TESTED · NOT VERIFIED

## Evidence boundary
Prepared 2026-07-27 from the requirement contract, repository README, and GitHub commit metadata. Full private source checkout, runtime credentials, binaries, and production infrastructure were not available. Unknowns are never promoted to PASS.
