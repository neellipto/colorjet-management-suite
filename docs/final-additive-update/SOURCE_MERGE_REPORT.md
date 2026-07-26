# COLORJET Management Suite — Source Merge Report

Branch: `agent/final-additive-update-1721`  
Mode: selective additive merge only

## 1. Source priority applied

1. Owner-supplied Google Play package/signing evidence
2. Working `1701` application behaviour
3. `fix/reference-apk-ui-1702` recoverable Management Suite source
4. Live PHP/MySQL ERP contracts and schema
5. Current ERP permission matrix
6. Valid modules from unmerged branches/packages
7. Older implementations only to recover a missing valid function

## 2. Repository candidate review

### `fix/reference-apk-ui-1702` — selected baseline

Use:

- package and app identity;
- original mobile UI structure;
- icon/splash paths;
- working navigation and screen set;
- existing Supabase session compatibility during controlled migration;
- local EAS signing path using protected secrets.

Do not accept as final:

- direct Supabase business writes as the long-term ERP contract;
- hard-coded dashboard periods;
- simplified client role aliases as the permission engine;
- empty notification/delivery hydration;
- unverified reports/exports.

### `rebuild/managementsuite-production-v4` — selective extraction

Potentially reusable:

- generic hosting API request wrapper;
- explicit form route/schema concepts;
- mobile form registry/test concepts.

Must be corrected before reuse:

- API base URL must be `https://erp.colorjet.website/api/v1` or a verified compatible path;
- Supabase JWT cannot simply be assumed valid for PHP ERP without an explicit token-exchange/validation contract;
- generic operation routes cannot replace real module screens;
- target SDK and versioning must follow current release requirements;
- server API existence must be verified.

### `managementsuite-original-apk-v3` — selective module recovery

Potentially reusable:

- additional module screens and navigation concepts;
- attendance, warranty, parts, supplier, import, landed-cost, agreements, supplier-ledger and HR screen work;
- non-WebView standalone build approach.

Restrictions:

- preserve only modules that pass source and regression review;
- do not import stale schemas, permissions or signing assumptions;
- do not replace newer baseline UI/components blindly.

### V12/V13 feature branches — design and algorithm extraction

Potentially reusable:

- explicit field-duty tracking lifecycle;
- geofence and location accuracy concepts;
- service status transitions;
- SLA/parts/logistics workflow concepts;
- durable notification outbox concepts;
- device-test checklists.

Restrictions:

- PostgreSQL/Supabase schema is not authoritative for business ledgers;
- RLS policy cannot replace PHP/MySQL ERP authorization;
- migrations require translation to additive MySQL migrations and compatibility APIs;
- tracking must comply with duty-time privacy rules.

### Merged V11 WebView project — excluded from final UI

Potentially reusable:

- Android permission wording;
- background-location service concepts;
- boot recovery and queued-location ideas;
- GitHub Actions signing pattern.

Excluded:

- package `com.colorjetbd.erp`;
- WebView as primary app;
- web-route navigation as final mobile UX;
- direct merge into the Management Suite package.

### V3.1 renewed/compiler branches — evidence only

Potentially reusable:

- deterministic build checks;
- compiler diagnostics;
- package verification gates.

Restrictions:

- alternate version lines and signatures are not authoritative;
- debug/test AABs cannot be promoted;
- signer must match the existing Play lineage.

## 3. Merge architecture

### Stage A — preserve current app

- freeze baseline routes/screens/assets;
- create automated route and module inventory;
- add regression identifiers for all existing screens;
- preserve session storage during API transition.

### Stage B — introduce ERP gateway

- add typed mobile API client targeting the verified PHP endpoint;
- implement token exchange/session binding;
- add `/me`, `/me/permissions`, `/me/dashboard` and capability discovery;
- introduce feature flags per module;
- keep current data path temporarily only where the PHP endpoint is not ready;
- never dual-write financial/stock records.

### Stage C — migrate modules one by one

Order:

1. identity/profile/permissions;
2. dashboards/read-only KPI;
3. customers/products/search;
4. service/engineer/schedule;
5. notifications;
6. logistics;
7. reports/documents;
8. controlled financial and stock mutations;
9. Manual Register;
10. Owner AI actions;
11. offline write queue.

Each module requires source comparison, API contract, permission tests, offline behaviour, report/document output and regression evidence.

### Stage D — retire duplicate data paths

A legacy Supabase business path may be removed only after:

- PHP ERP endpoint passes connected tests;
- record counts and balances reconcile;
- user/role scope tests pass;
- offline replay is idempotent;
- rollback is documented;
- Owner acceptance is recorded.

## 4. Conflict register

| Conflict | Resolution |
|---|---|
| `bd.com.colorjet.erp` vs `com.colorjetbd.managementsuite` | Keep Play-authoritative `com.colorjetbd.managementsuite` |
| Supabase business DB vs PHP/MySQL ERP | PHP/MySQL becomes business authority; transition is module-by-module, no dual-write ledgers |
| WebView native wrapper vs React Native app | Keep React Native Management Suite; extract only safe native service concepts |
| Multiple version lines (`170x`, `300x`, `310x`) | Next code chosen only after Play highest code is re-verified before release |
| Multiple signing experiments | Existing production signer only; all others blocked |
| `erp.colorjetbd.com` vs `erp.colorjet.website` | Use Owner-authoritative `erp.colorjet.website` after endpoint verification |
| Client role aliases vs hard RBAC | Add backend effective-permission contract and scoped enforcement |
| Supabase RLS vs ERP permission matrix | ERP permission matrix is the cross-platform source of truth |

## 5. Required source outputs before first feature release

- current screen/module/route/function inventories;
- typed ERP API contract;
- token/session strategy;
- effective-permission payload definition;
- additive MySQL migration plan;
- feature flag and rollback plan;
- signer verification workflow;
- baseline regression tests.

## 6. Merge status

| Source | Status |
|---|---|
| Reference 1702 baseline | SELECTED |
| PHP ERP API | BLOCKED pending source/contract verification |
| Role permission source | BLOCKED pending authoritative export/API |
| V12/V13 concepts | REVIEWED FOR SELECTIVE EXTRACTION |
| WebView wrapper | EXCLUDED AS FINAL UI |
| V3.1 alternates | NOT AUTHORITATIVE |
| Actual module merge | NOT EXECUTED |
| Database migration | NOT EXECUTED |
| APK/AAB build | NOT EXECUTED |

**Release recommendation: RELEASE BLOCKED**