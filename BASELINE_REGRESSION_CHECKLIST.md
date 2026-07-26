# Baseline Regression Checklist

- [ ] Capture source commit and full file manifest.
- [ ] Build current baseline reproducibly.
- [ ] Verify package/version/signing/Firebase/deep links.
- [ ] Inventory screens, routes, modules, APIs, schema, permissions, reports, and offline operations.
- [ ] Record golden role-by-role behavior and data totals.
- [ ] Test direct unauthorized calls and active-session permission changes.
- [ ] Test migrations with backup/rollback/reconciliation.
- [ ] Test previous APK → candidate update with app/session/local-data preservation.
- [ ] Verify no secrets and no debug/random signing.

Current result: BLOCKED.

## Classification legend
PASS · PARTIAL · MISSING · BROKEN · BLOCKED · NOT TESTED · NOT VERIFIED

## Evidence boundary
Prepared 2026-07-27 from the requirement contract, repository README, and GitHub commit metadata. Full private source checkout, runtime credentials, binaries, and production infrastructure were not available. Unknowns are never promoted to PASS.
