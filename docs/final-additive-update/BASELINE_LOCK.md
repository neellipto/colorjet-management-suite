# COLORJET Management Suite — Baseline Lock

Branch: `agent/final-additive-update-1721`  
Status: ACTIVE BUILD BASELINE

## 1. Locked application identity

The following values cannot be changed by implementation work:

- App name: **COLORJET Management Suite**
- Android application/package ID: **`com.colorjetbd.managementsuite`**
- Existing Google Play application and update lineage
- Existing production signing lineage
- Existing Firebase application mapping for the package
- Existing deep-link compatibility, unless an additive compatible link is added
- Original COLORJET logo, icon and splash assets
- Company tagline: **Quality • Commitment • Service**

`bd.com.colorjet.erp` and `com.colorjetbd.erp` are not permitted for this update unless the Owner supplies new authoritative Play Console evidence that replaces the current package record.

## 2. Locked functional baseline

The installed/accepted `1.7.0` / versionCode `1701` application is the behavioural baseline.

The repository branch `fix/reference-apk-ui-1702` is the closest recoverable source baseline because it preserves the current Management Suite package and reference UI. Its `1702` output is not accepted as a functional upgrade because application functionality is materially unchanged from `1701`.

No current PASS function may be removed. Before replacing a component, the implementation must record:

1. existing function;
2. reason for replacement;
3. replacement mapping;
4. data/session migration;
5. permission effect;
6. offline effect;
7. regression result;
8. Owner approval where behaviour changes.

## 3. Locked production architecture

### Business source of truth

- PHP 8.2 + MySQL/MariaDB ERP at `https://erp.colorjet.website`
- The Android app must not create a second independent accounting, inventory or customer database.
- Supabase/PostgreSQL may remain only for explicitly approved identity, realtime, projection, notification or transition functions where data ownership and reconciliation are defined.
- No duplicate manual entry between Android and ERP.

### Mobile architecture

- Native React Native/Expo source is retained as the existing application foundation.
- A WebView cannot become the primary application interface.
- Mobile screens must use mobile components, role-aware navigation, local cache and secure API integration.

### Authorization

One ERP permission model is authoritative across Android, web and backend.

Effective permission precedence:

1. security policy;
2. explicit user deny;
3. explicit user grant;
4. role permission;
5. position/department/branch/warehouse/territory/team/record scope;
6. default deny.

Backend enforcement is mandatory. UI hiding is not authorization.

## 4. Locked data-safety rules

- No database reset, drop, truncate or destructive migration.
- No silent edit of posted accounting/stock records.
- Corrections use approval, reversal and corrected entry.
- Normal users cannot create backdated/future-dated transactions.
- Owner override requires reason, warning, explicit confirmation and audit.
- Manual Register entries have no financial/stock effect unless a configured posting rule is approved and executed.
- Offline writes require client UUID, idempotency key, retry state and conflict detection.
- No duplicate payment, receipt, stock use, attendance, job completion or manual-register posting.

## 5. Locked AI rules

### Owner AI

Full authorised analysis and action drafting are available only to OWNER.

Sensitive actions follow:

`Request → Permission Check → Source Retrieval → Draft → Owner Preview/Edit → Explicit Confirmation → Backend Validation → Execute → Audit`

### Other users

Other roles receive only permission-aware assistance for their authorised modules and records. They cannot access company-wide financial data, Owner insights, secrets, protected bulk actions or AI approval/execution.

AI provider credentials remain server-side and must not be bundled in the APK.

## 6. Locked document/report rules

Every eligible official record must support, subject to permission:

- Print Preview
- PDF
- CSV
- XLSX where applicable
- Email/share
- WhatsApp PDF where configured
- Source/drill-down

Official output uses dynamic COLORJET letterhead with the original logo and document-specific title.

Required filter families:

- date/week/month/quarter/year/financial-year/as-of/custom range;
- customer/supplier/employee/engineer/salesperson/user/branch/warehouse/department;
- product/category/group/brand/SKU/serial/parts/machine/ink-consumable;
- paid/due/partial, warranty/non-warranty, status, payment mode and operational state.

## 7. Locked release gates

The final release cannot be marked ready until all are evidenced:

- package identity match;
- signing certificate match;
- Firebase identity compatibility;
- higher versionCode than Play accepted build;
- data-preserving migration;
- existing login/session compatibility;
- existing PASS functions preserved;
- role-by-role UI and direct API tests;
- Owner AI isolation and confirmation tests;
- manual register non-posting/posting tests;
- date/period/reversal tests;
- reporting and document accuracy;
- offline idempotency/conflict tests;
- APK and AAB build;
- in-place APK update over the current application;
- Play testing-track update acceptance.

## 8. Explicitly prohibited shortcuts

- New package/application ID
- New random production keystore
- Uninstall-and-reinstall requirement
- WebView-only replacement
- Fake/mock KPI data
- Frontend-only permissions
- Hard-coded financial zeros
- Silent AI execution
- Silent backdated or posted-entry modification
- Committing passwords, private keys, service-account keys or provider secrets
- Renaming an old APK/AAB and presenting it as a new feature build

## 9. Current baseline status

Baseline identity and architecture constraints are locked. Source integration, migrations, connected tests, production build and Play update remain incomplete.

**Release state: RELEASE BLOCKED**