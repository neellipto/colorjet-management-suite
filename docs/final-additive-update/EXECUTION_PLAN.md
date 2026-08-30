# COLORJET Management Suite — Execution Plan

Branch: `agent/final-additive-update-1721`

## Milestone 0 — Baseline evidence

Deliverables:

- `CURRENT_APP_AUDIT.md`
- `BASELINE_LOCK.md`
- `SOURCE_MERGE_REPORT.md`
- automated screen/route/module inventory
- package/version/signer/Firebase evidence capture
- current AAB/APK static comparison report

Exit gate:

- exact baseline source and binary lineage established;
- every existing PASS function listed;
- no package/signing ambiguity.

## Milestone 1 — Secure ERP API foundation

Mobile:

- typed HTTPS client;
- access/refresh token storage and rotation support;
- device registration and remote logout handling;
- capability discovery;
- feature flags;
- consistent loading/error/offline states.

PHP/MySQL:

- versioned `/api/v1` gateway;
- login/token exchange compatible with existing user identity;
- `/me` and effective permissions;
- audit/device/session tables;
- rate limits and revocation;
- idempotency registry.

Exit gate:

- real OWNER and restricted-role login against staging;
- direct unauthorised requests denied;
- no secret in mobile source/APK;
- current session migration strategy proven.

## Milestone 2 — Permission system and role dashboards

- role permission rules;
- explicit user grant/deny;
- branch/department/warehouse/territory/team/own/assigned scopes;
- field visibility for cost/profit/salary/GPS/export;
- effective-permission preview and audit;
- role/user dashboard resolution;
- Owner Command Center read-only KPI first;
- live data freshness/source/drill-down.

Exit gate:

- OWNER, ADMIN, ACCOUNTS, SALES, ENGINEER, STORE and LOGISTICS matrices pass UI and API tests;
- hard-coded KPI periods removed;
- no unauthorised financial or personal data exposure.

## Milestone 3 — Manual Register and date/accounting control

Manual Register:

- configurable definitions and fields;
- amount, asset, item, document and custom registers;
- attachment/signature support;
- approval workflows;
- report/print templates;
- optional authorised posting rules.

Date/accounting control:

- current-date-only default;
- future/back-date lock;
- open/soft-closed/hard-closed periods;
- correction request;
- reversal and corrected entry;
- reconciliation preview and audit.

Exit gate:

- unapproved manual entries do not alter cash/bank/ledger/stock/profit;
- posted record direct edits are denied;
- Owner override is fully audited.

## Milestone 4 — Operations

- logistics schedule/dispatch/delivery/installation handoff;
- vehicle, driver, route, photos and signatures;
- attendance/check-in/out/field duty/geofence;
- duty-time-only tracking policy;
- in-app notifications, FCM, acknowledgement and durable outbox;
- service/engineer/SLA integrations;
- internal alerts and assignment.

Exit gate:

- end-to-end service and logistics scenarios pass;
- GPS is not recorded outside authorised duty sessions;
- alerts have delivery/read/acknowledgement history.

## Milestone 5 — Reporting and documents

- universal report definitions, filters and saved filters;
- daily/weekly/monthly/yearly/as-of/custom ranges;
- entity/product/category/group/parts filters;
- opening/running/closing balances and subtotals;
- dynamic COLORJET letterhead;
- print preview, PDF, CSV, XLSX, email/share and verification QR;
- permissions on report columns and exports.

Exit gate:

- invoice/service/ledger/stock/logistics/manual-register reports reconcile to source data;
- PDF totals match screen and CSV/XLSX totals;
- original logo remains byte-identical.

## Milestone 6 — Owner AI and limited user AI

- server-side provider gateway;
- source retrieval with permission filtering;
- Owner executive analysis;
- draft action model;
- preview/edit/explicit confirmation;
- backend validation and audit;
- role-limited search/summaries/drafting;
- usage limits and provider failure handling.

Exit gate:

- non-Owner cannot access Owner sources or execute protected actions;
- payment, stock, permission, import, delete, period reopen and bulk communication require explicit Owner confirmation;
- AI cannot bypass normal API permission/date/accounting rules.

## Milestone 7 — Offline-first safe sync

- encrypted local cache;
- operation queue with UUID/idempotency/dependencies;
- retry/backoff/dead-letter handling;
- optimistic concurrency and conflict screen;
- photo/signature/location queues;
- duplicate prevention;
- server acknowledgement and reconciliation.

Exit gate:

- offline entry/reconnect scenarios pass;
- duplicates are blocked;
- newer server data is never silently overwritten;
- app-kill/device-restart queues recover.

## Milestone 8 — Release engineering

- choose next versionCode after checking Play highest accepted code;
- current target SDK compliance;
- production signing with existing key;
- mapping/native symbols where enabled;
- SHA-256 checksums;
- current APK installation and local state setup;
- in-place update installation;
- session/local DB/notification/deep-link verification;
- Internal/Closed Testing upload acceptance.

Exit gate:

- signed APK and AAB produced;
- signer matches Play lineage;
- no uninstall required;
- existing and new regression suites pass;
- actual artifact links and checksums available.

## Current status

- Milestone 0: IN PROGRESS
- Milestones 1–8: NOT STARTED
- Final release: BLOCKED
