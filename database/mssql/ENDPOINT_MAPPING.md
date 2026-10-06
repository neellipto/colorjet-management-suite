# COLORJET Dashboard → MSSQL Mapping

Derived directly from the frontend module code (`colorjet/owner-command-center.js`,
`colorjet/runtime-features.bundle.js`). Each dashboard tile / panel calls one HTTP
endpoint; the API resolves it to the MSSQL object below and returns its row(s) as JSON.

## KPI tiles (Owner Intelligence)

| # | Tile | Frontend endpoint | MSSQL object | Returns |
|---|------|-------------------|--------------|---------|
| 1 | Today sales | `GET /api/v1/Dashboard/today-sales-amount` | `report.usp_dashboard_today_sales` | `amount` |
| 2 | Collection today | `GET /api/v1/Dashboard/today-due-collection-amount` | `report.usp_dashboard_today_collection` | `amount` |
| 3 | Expense today | `GET /api/v1/Dashboard/today-expense-amount` | `report.usp_dashboard_today_expense` | `amount` |
| 4 | Product profit today | `GET /api/v1/Dashboard/today-product-profit-amount` | `report.usp_dashboard_today_product_profit` | `amount` |
| 5 | Customer due | `GET /api/v1/Report/get-customer-balance-total` | `report.usp_report_customer_balance_total` | `totalBalance` |
| 6 | Supplier due | `GET /api/v1/Report/get-supplier-balance-report?ReportType=headTotal` | `report.usp_report_supplier_balance_total` | `totalBalance` |
| 7 | Cash balance | `GET /api/v1/Report/get-cash-bank-balance-report?AccountGroupType=Cash-In-Hand&ReportType=HeadTotal` | `report.usp_report_cash_bank_balance 'Cash-In-Hand'` | `totalBalance` |
| 8 | Bank balance | `GET /api/v1/Report/get-cash-bank-balance-report?AccountGroupType=Bank Accounts&ReportType=HeadTotal` | `report.usp_report_cash_bank_balance 'Bank Accounts'` | `totalBalance` |
| 9 | Inventory value | `GET /api/v1/Report/get-total-product-stock-value` | `report.usp_report_total_stock_value` | `totalStockValue` |
| 10 | Pending orders | `GET /api/v1/Dashboard/pending-orders-count` | `report.usp_dashboard_pending_orders_count` | `count` |
| 11 | Foreign purchases | `GET /cjext/api/foreign-trade/purchases` | `report.v_foreign_purchases` | rows (count) |
| 12 | Open C&F jobs | `GET /cjext/api/cnf/jobs` | `report.v_cnf_jobs` | open rows (count) |
| 13 | Landed cost batches | `GET /cjext/api/landed-cost/batches` | `report.v_landed_cost_batches` | rows (count) |
| 14 | Open RMA / Repair | `GET /cjext/api/rma` | `report.v_open_rma` | open rows (count) |

## Panels

| Panel | MSSQL object |
|-------|--------------|
| Monthly revenue trend | `report.v_panel_monthly_revenue` |
| Fast moving products | `report.usp_panel_fast_moving_products @Top, @Days` |
| Customer payment watch | `report.usp_panel_customer_payment_watch @Top` |
| Expense breakdown | `report.v_panel_expense_breakdown` |
| SMS Automation | `report.usp_panel_sms_summary` (`/cjext/api/sms/summary`) |

## Customer 360 (`/cjext/api/workspace/360?entity_type=CUSTOMER&canonical_id=<id>`)

| Block | MSSQL object |
|-------|--------------|
| Summary (sales/collection/due/counts) | `report.usp_customer360_summary @CustomerId` |
| Invoices | `report.usp_customer360_invoices @CustomerId, @Top` |
| Payments | `report.usp_customer360_payments @CustomerId, @Top` |

## How the API uses it

```
-- example: Today sales tile
EXEC report.usp_dashboard_today_sales;              -- -> { "amount": 12345.00 }

-- example: Cash balance tile
EXEC report.usp_report_cash_bank_balance @AccountGroupType = N'Cash-In-Hand';

-- example: Customer 360
EXEC report.usp_customer360_summary @CustomerId = '....';
```

Every object is **read-only** over the reporting mirror (`report` schema). Odoo/ERP
remains the single writer via the sync service; the app never writes here.

Build order: `01_schema.sql` → `02_views.sql` → `03_security.sql` → `04_owner_dashboard_mapping.sql`.
