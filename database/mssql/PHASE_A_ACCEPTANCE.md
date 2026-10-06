# PHASE A — Customer Account / Customer 360 — MSSQL Acceptance Report

Per the Master Build "MSSQL ACCEPTANCE RULE". Status is **honest**: the SQL data
layer is built and published; it is **NOT** marked COMPLETE, because the spec
requires (a) a schema audit against the live `COLORJET_ERP` DB and (b) testing
against that production DB — neither is possible without access to it.

## TABLES REUSED (canonical — NOT duplicated)
- `report.customers` — canonical customer mirror (carries `odoo_id`)
- `report.sales_invoices`, `report.sales_invoice_lines`, `report.payments`, `report.sales_orders`
- `assets.machines` (Machine 360), `service.service_requests`, `service.engineer_jobs`
- `identity.users`, `identity.user_customer_links` (portal account = canonical CustomerId link)

## TABLES EXTENDED
- None yet — extension of the live ERP tables is **pending the schema audit**
  (mapping report.* names → the real production tables).

## NEW TABLES (additive customer-module data, full conventions)
- `customer.notes`, `customer.documents`, `customer.communications`
- `customer.credit_limit_history` (immutable), `customer.audit_log`

## PK / FK
- Every table: `Id UNIQUEIDENTIFIER` PK. FKs from all `CustomerId` → `report.customers(id)`;
  document/comm related links carried as `RelatedType`/`RelatedId`.

## UNIQUE KEYS
- `identity.user_customer_links.customer_id` UNIQUE → one portal user per canonical customer.

## INDEXES
- Filtered indexes on `CustomerId` (WHERE `IsDeleted = 0`) for notes/documents/communications;
  `ChangedAt DESC` / `PerformedAt DESC` on history & audit.

## CHECK CONSTRAINTS
- `communications.Channel` ∈ {SMS,EMAIL,WHATSAPP,PORTAL}; `DeliveryStatus` ∈ {SUBMITTED,DELIVERED,FAILED}.
- (Identity/service status enums enforced in files 05.)

## HISTORY TABLE
- `customer.credit_limit_history` (immutable); `customer.audit_log` (before/after JSON).

## AUDIT
- `customer.usp_360_audit` merges audit_log + credit-limit history.

## STORED PROCEDURES / COMMANDS
- `customer.usp_customer_list` (filters + search + paging)
- `customer.usp_360_overview / _financial / _sales / _machines / _service / _documents / _communications / _portal / _audit`
- `customer.v_ledger` (running-balance ledger)

## API ROUTES (to be added in the existing authenticated API layer)
- `GET  /api/customers` → `usp_customer_list`
- `GET  /api/customers/{id}` → `usp_360_overview`
- `GET  /api/customers/{id}/financial` → `usp_360_financial`
- `GET  /api/customers/{id}/sales|machines|service|documents|communications` → matching proc
- `GET  /api/customers/{id}/portal` + `POST` portal create/reset (identity.* + invitations)
- **Browser never touches MSSQL directly** — routes run inside the existing auth layer.

## PERMISSIONS (prefix `customer.*`)
- `customer.view`, `customer.create`, `customer.edit`, `customer.financial.view`,
  `customer.portal.manage`, `customer.document.view/upload`, `customer.audit.view`.
- Enforced server-side via `identity.fn_user_has_permission`; customer-portal isolation via
  `identity.fn_user_customer_id` (IDOR protection — a portal user only ever sees its own CustomerId).

## TRANSACTION BOUNDARIES
- Portal-account create (user + link + invitation) and credit-limit change (+ history + audit)
  each run in a single transaction.

## IDEMPOTENCY
- Invitations carry a hashed one-time token; portal create is guarded by the UNIQUE
  `user_customer_links.customer_id`.

## REVERSAL
- Soft delete / status only (`IsDeleted`, `Status`, portal `REVOKED`/`INACTIVE`).
  No hard delete of financial/service/document/audit history.

## REPORTS
- Customer due / ledger / sales feed the Owner dashboard tiles (file 04) and Customer 360.

---

## ⛔ Why this is NOT reported COMPLETE
Per spec: *"Do not report COMPLETE because tables or screens exist."* Outstanding, and
each **requires access I do not have**:
1. **Schema audit** — map every REUSED `report.*` object to the real `COLORJET_ERP` tables
   so we extend, not duplicate. (Run the query in `SCHEMA_AUDIT_QUERY.sql`.)
2. **API layer** — add the routes above inside the existing authenticated .NET/API layer
   (whose source is not on the server — only the compiled `Api.dll`).
3. **UI** — Customer 360 tabs + Customer Portal in the existing v3.3 design system.
4. **Live UAT** against production `COLORJET_ERP`.

COMPLETE = Entry → Workflow → Detail → Audit → Report all working against the live DB.
