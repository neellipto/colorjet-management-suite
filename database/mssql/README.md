# COLORJET Reporting Database — Microsoft SQL Server

Read-only Odoo reporting database for the **COLORJET Management Suite** app
(`artifacts/mobile`). It mirrors Odoo data for fast reporting and never writes
back to Odoo accounting, stock, invoices or payments.

## Design rules
- Data flows **Odoo → this database via the sync API only**. The app reads; it
  does not edit Odoo records.
- **UUID** primary keys (`UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()`).
- Every table keeps a **unique `odoo_id`** so the sync can upsert idempotently.
- `date`, `customer`, `supplier`, `product` and `invoice` columns are indexed.

## Tables (`report` schema)
`customers`, `suppliers`, `products`, `sales_invoices`, `payments`,
`supplier_bills`, `stock_movements`, `expenses`, `daily_financial_summary`,
`sync_logs`.

## Reporting views
| View | Report |
|---|---|
| `report.v_daily_sales` | Daily sales |
| `report.v_daily_collection` | Daily collection (cash/bank) |
| `report.v_customer_due` | Customer due / receivable |
| `report.v_supplier_payable` | Supplier payable |
| `report.v_stock` | Current stock + valuation |
| `report.v_low_stock` | Low-stock (≤ reorder level) |
| `report.v_daily_expenses` / `report.v_expenses_by_category` | Expenses |
| `report.v_cash_bank_balance` | Cash / bank balance |
| `report.v_dashboard_summary` | Dashboard snapshot |

## How to build
Run the scripts in order against your target database (e.g. `colorjet_reporting`):

```bash
sqlcmd -S <server> -d colorjet_reporting -i 01_schema.sql
sqlcmd -S <server> -d colorjet_reporting -i 02_views.sql
sqlcmd -S <server> -d colorjet_reporting -i 03_security.sql
```

All three scripts are **idempotent** — safe to re-run.

## Roles / security
- `colorjet_sync_writer` — the Odoo→reporting sync service. SELECT/INSERT/UPDATE
  on `report.*`, **DELETE denied**.
- `colorjet_app_reader` — the app and dashboards. **SELECT only.**

Create logins and map users **per environment** (see the commented example in
`03_security.sql`). No credentials are stored in this repository — use
`DATABASE_URL` / secret store as described in `ENV_REQUIRED.md`.
