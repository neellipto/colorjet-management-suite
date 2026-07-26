# Baseline Lock

- Application: COLORJET Management Suite
- Android applicationId: `com.colorjetbd.managementsuite`
- Required baseline: versionName `1.7.0`, versionCode `1701`
- Production ERP: `https://erp.colorjet.website`
- Required signing SHA-1: `13:CD:DA:72:36:4E:D8:B5:8D:C1:28:BB:10:EE:8C:45:EB:46:65:BF`
- Existing ERP/Odoo/MySQL data remains authoritative.
- No new keystore, debug signing, package rename, Firebase replacement, forced uninstall, logo recreation, primary WebView wrapper, or destructive migration.
- Existing PASS behavior may not be removed.

Any mismatch is release-blocking. Actual package, version, certificate, Firebase app, deep links, and update lineage remain NOT VERIFIED pending artifacts/source.

## Classification legend
PASS · PARTIAL · MISSING · BROKEN · BLOCKED · NOT TESTED · NOT VERIFIED

## Evidence boundary
Prepared 2026-07-27 from the requirement contract, repository README, and GitHub commit metadata. Full private source checkout, runtime credentials, binaries, and production infrastructure were not available. Unknowns are never promoted to PASS.
