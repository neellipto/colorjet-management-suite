# COLORJET Management Suite — Current Application Audit

Audit branch: `agent/final-additive-update-1721`  
Audit date: 2026-07-26  
Repository: `neellipto/colorjet-management-suite`

## 1. Audit conclusion

The repository contains multiple overlapping Android implementations and several open pull requests with conflicting package identities, data architectures and release strategies. No existing branch satisfies the complete additive-update acceptance contract.

The authoritative Android baseline for the next update is the source used for the working `com.colorjetbd.managementsuite` Play lineage, represented in this repository by branch `fix/reference-apk-ui-1702`. This branch is used only as the baseline; it is not accepted as the final feature update.

## 2. Authoritative identity

| Item | Locked value | Status |
|---|---|---|
| App name | COLORJET Management Suite | PASS |
| Android package | `com.colorjetbd.managementsuite` | PASS |
| Working Play baseline | `1.7.0` / versionCode `1701` | OWNER/Play evidence |
| Repository reference candidate | `1.7.1` / versionCode `1702` | PASS identity, not a functional release |
| Production ERP | `https://erp.colorjet.website` | OWNER requirement |
| Original icon/splash | `artifacts/mobile/assets/images/icon.png`, `splash.png` | LOCKED |
| Production signer | Existing Play signing/upload lineage only | BLOCKED pending automated certificate evidence in CI |
| Firebase package mapping | Existing Play/Firebase identity only | NOT VERIFIED from repository |

The requirement text also mentions `bd.com.colorjet.erp`. It is not authoritative because it conflicts with the Owner-supplied Play Console evidence and the working package lineage. It must not be used unless the Play Console record itself changes.

## 3. Repository architecture found

### 3.1 React Native / Expo Management Suite

Primary source:

- `artifacts/mobile/`
- Expo Router navigation
- React Native mobile UI
- Supabase client authentication and direct database access
- AsyncStorage session persistence

Observed screens include:

- Login, forgot/reset password and profile
- Role dashboard/tab navigation
- Sales, inventory and service tabs
- Customers and customer detail
- Invoices and invoice detail
- Payments and expenses
- Service tickets, job workflow and service reports
- Engineer schedule and engineer administration
- Delivery screen
- Notifications
- Reports
- Users, company, branding, catalogue and integration administration

### 3.2 Separate Android WebView/native wrapper

`android-v11.3-native/` uses package family `com.colorjetbd.erp` and loads ERP web routes. This is not the authoritative Management Suite application. It must not replace or be merged as the final Android UI.

### 3.3 Legacy wrapper

`apk-wrapper/` uses another package identity and is not the production Management Suite baseline.

### 3.4 Repository root and historical intent

The root README still describes a read-only Odoo reporting database, while later code became a writable Supabase-backed mobile ERP and separate WebView app. Documentation and implementation are materially inconsistent.

## 4. Current data architecture

The authoritative reference mobile source uses Supabase directly:

- Public Supabase URL/publishable key fallback in `lib/runtimeConfig.ts`
- Supabase Auth session stored through AsyncStorage
- Mobile client directly queries profiles, roles, customers, ledgers, products, stock, invoices, payments, tickets, schedules, tasks, expenses and company settings
- Mobile client directly calls RPCs for payments, expenses, service status and part consumption
- Mobile client directly uploads service photos and signatures

This does not meet the requested final architecture where the PHP 8.2/MySQL ERP is the business source of truth and Android permissions are enforced consistently through one backend authorization system.

A prior branch (`rebuild/managementsuite-production-v4`) introduced a hosting API client, but:

- it targets `https://erp.colorjetbd.com/api/v1`, not the required `https://erp.colorjet.website`;
- it remains hybrid with Supabase authentication/data;
- it is not merged;
- it does not provide evidence that the required PHP endpoints exist or are compatible.

## 5. Current role and permission implementation

The client maps database role codes to simplified UI roles. Examples include:

- `owner` and `super_admin` mapped to `admin`;
- `service_manager` mapped to `service_control`;
- `commercial` mapped to `sales`;
- `viewer` mapped to `customer`.

Current UI visibility is derived from these client roles. No complete source-backed effective-permission payload was found that combines:

- explicit user deny;
- explicit user grant;
- role permission;
- branch/department/warehouse/territory scope;
- record scope;
- field visibility;
- cost/profit/salary/GPS/export visibility.

Backend Supabase RLS may protect some tables, but repository evidence is insufficient to accept the requested unified permission model. Direct unauthorized API/RPC tests have not been executed.

## 6. Functional baseline observed

### Authentication

- Email/password login
- Persistent Supabase session
- Logout
- Password reset request

Status: PARTIAL. Existing login works only against the Supabase identity model; compatibility with the PHP ERP identity is not established.

### Customers, invoices and payments

- Customer list/detail data mapping
- Invoice list/detail data mapping
- Customer payment RPC
- Customer ledger-derived due calculation

Status: PARTIAL. Direct Supabase implementation; source-of-truth and permission integration are unresolved.

### Inventory

- Product and stock-balance loading
- Stock movement loading
- Low-stock calculation
- Service-part consumption RPC

Status: PARTIAL. Direct Supabase implementation; no verified offline idempotency or ERP MySQL posting contract.

### Service and engineer operations

- Ticket list/status mapping
- Travel/work/complete status actions
- Engineer schedule
- Part use
- Photo upload
- Signature upload
- Service report submission

Status: PARTIAL. Major screens and actions exist, but full GPS duty privacy, durable offline queue, conflict handling, SLA and authoritative PHP integration are not verified.

### Delivery/logistics

A delivery screen/type exists, but the current hydration state sets `deliveries: []` instead of loading source-backed delivery records.

Status: BROKEN/PARTIAL.

### Notifications

Notification screens exist, but the current hydration state sets `notifications: []` and only local read-state methods are visible in the inspected client.

Status: BROKEN/PARTIAL.

### Reports and print

A reports screen exists. The required universal source-backed report engine, dynamic letterhead, print preview, PDF, CSV/XLSX, email and WhatsApp PDF workflow is not verified.

Status: PARTIAL/NOT VERIFIED.

### Owner AI, Manual Register and Dashboard Builder

No complete production implementation was found in the authoritative baseline.

Status: MISSING.

## 7. Critical defects and risks

### Critical

1. **Package conflict across implementations** — branches/projects use `com.colorjetbd.managementsuite`, `com.colorjetbd.erp` and `bd.com.colorjet.erp`.
2. **Source-of-truth conflict** — authoritative mobile code writes directly to Supabase while the required production ERP is PHP/MySQL.
3. **Permission architecture incomplete** — current client role aliases are not the required backend effective-permission system.
4. **No verified in-place update evidence for the future additive build**.
5. **Firebase identity/configuration not verified in the authoritative source**.

### High

1. Dashboard month is hard-coded to `2024-06`, so MTD KPIs can be stale/zero.
2. Login hydration fetches large, broad datasets at once, including profiles and financial/stock records; this creates performance and data-exposure risk unless RLS is perfect.
3. Delivery and notification state are returned empty despite related UI.
4. Several mutation failures are caught and logged without returning actionable errors to the user.
5. Existing branch/API documentation is stale and contradicts current source.
6. Multiple open PRs contain overlapping Android rewrites and cannot be merged together safely.

## 8. Candidate branch assessment

| Candidate | Assessment |
|---|---|
| `main` | Not authoritative Android release configuration; contains Replit origin and separate wrong-package WebView code |
| `fix/reference-apk-ui-1702` | Best identity/UI baseline; correct package/version lineage; no meaningful functional update over 1701 |
| `rebuild/managementsuite-production-v4` | Useful hosting API/form ideas; wrong ERP URL, hybrid data model, incomplete |
| `managementsuite-original-apk-v3` | Useful recovered modules; lower/alternate release line; requires selective extraction only |
| `feature/v12-engineer-operations` / V13 branches | Useful GPS/service/logistics concepts; Supabase/PostgreSQL architecture conflicts with PHP/MySQL authority |
| `android-v11.4.2-unified-mobile` | Wrong package family and WebView-led implementation; not final app |
| `managementsuite-v31-*` | Alternate version/signing experiments; not authoritative without signer and update-chain evidence |

## 9. Baseline classification

| Area | Result |
|---|---|
| Package identity | PASS |
| App name/icon/splash paths | PASS |
| Existing UI source availability | PASS |
| Production signing configuration path | PARTIAL |
| Production signer match | NOT VERIFIED in current CI run |
| Firebase identity | NOT VERIFIED |
| PHP ERP integration | MISSING/PARTIAL branch only |
| Unified RBAC | MISSING |
| Role dashboards | PARTIAL |
| Owner Command Center | MISSING |
| Owner AI approval workflow | MISSING |
| Other-user limited AI | MISSING |
| Manual Register | MISSING |
| Logistics | PARTIAL/BROKEN |
| Attendance/GPS | PARTIAL in non-authoritative branches |
| Notifications/acknowledgements | PARTIAL/BROKEN |
| Offline idempotent sync | MISSING/NOT VERIFIED |
| Universal reports | PARTIAL |
| Print/PDF/CSV/XLSX | NOT VERIFIED |
| In-place update test | NOT TESTED |
| Play update upload | NOT TESTED for future build |

## 10. Release recommendation

**RELEASE BLOCKED**

No current repository branch should be presented as the requested final additive update. Development must continue on the isolated audit/build branch with explicit selective merging, backend integration, migrations, regression tests, production signing verification and in-place update evidence.