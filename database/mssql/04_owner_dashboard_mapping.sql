/* =============================================================================
   COLORJET ERP — Owner Dashboard & Command-Center Mapping (Microsoft SQL Server)
   -----------------------------------------------------------------------------
   Built from the ACTUAL frontend module code (colorjet/owner-command-center.js
   and colorjet/runtime-features.bundle.js). Every dashboard KPI tile and panel
   in the "Owner Intelligence / Additional dashboard controls" screen calls one
   HTTP endpoint; this file maps each of those endpoints to a single MSSQL object
   (stored procedure or view) that returns exactly the shape the frontend reads.

   So the fragile browser overlays can be replaced by a clean data layer: the API
   simply executes the matching procedure and returns its row(s) as JSON.

   Adds the operational tables the earlier 01_schema.sql did not cover
   (invoice lines, sales orders, service/RMA jobs, cash/bank accounts, and the
   commercial-import trackers) and then the mapping procedures/views.

   Run after 01_schema.sql, 02_views.sql, 03_security.sql. Idempotent.
   Read-only reporting mirror: Odoo/ERP writes via sync; the app only reads.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF SCHEMA_ID(N'report') IS NULL EXEC (N'CREATE SCHEMA [report] AUTHORIZATION [dbo];');
GO

/* ===========================================================================
   ADDITIONAL OPERATIONAL TABLES (needed by the dashboard requirements)
   =========================================================================== */

/* --- sales_invoice_lines : product-level rows -> fast-moving + product profit */
IF OBJECT_ID(N'report.sales_invoice_lines', N'U') IS NULL
BEGIN
    CREATE TABLE report.sales_invoice_lines
    (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sil_id DEFAULT NEWSEQUENTIALID(),
        odoo_id         BIGINT           NOT NULL,
        invoice_id      UNIQUEIDENTIFIER NULL,
        invoice_odoo_id BIGINT           NULL,
        product_id      UNIQUEIDENTIFIER NULL,
        product_odoo_id BIGINT           NULL,
        invoice_date    DATE             NOT NULL,
        quantity        DECIMAL(18, 3)   NOT NULL CONSTRAINT DF_sil_qty  DEFAULT (0),
        unit_price      DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_sil_up   DEFAULT (0),
        cost_price      DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_sil_cp   DEFAULT (0),
        line_total      DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_sil_lt   DEFAULT (0),
        line_profit     AS (CAST((unit_price - cost_price) * quantity AS DECIMAL(18,2))) PERSISTED,
        created_at      DATETIME2(3)     NOT NULL CONSTRAINT DF_sil_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_sales_invoice_lines      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_sales_invoice_lines_odoo UNIQUE (odoo_id),
        CONSTRAINT FK_sil_invoice FOREIGN KEY (invoice_id) REFERENCES report.sales_invoices (id),
        CONSTRAINT FK_sil_product FOREIGN KEY (product_id) REFERENCES report.products (id)
    );
    CREATE INDEX IX_sil_date    ON report.sales_invoice_lines (invoice_date);
    CREATE INDEX IX_sil_product ON report.sales_invoice_lines (product_id);
    CREATE INDEX IX_sil_invoice ON report.sales_invoice_lines (invoice_id);
END
GO

/* --- sales_orders : pending-orders KPI ------------------------------------- */
IF OBJECT_ID(N'report.sales_orders', N'U') IS NULL
BEGIN
    CREATE TABLE report.sales_orders
    (
        id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_so_id DEFAULT NEWSEQUENTIALID(),
        odoo_id       BIGINT           NOT NULL,
        order_number  NVARCHAR(64)     NOT NULL,
        customer_id   UNIQUEIDENTIFIER NULL,
        order_date    DATE             NOT NULL,
        amount_total  DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_so_total DEFAULT (0),
        status        NVARCHAR(32)     NOT NULL CONSTRAINT DF_so_status DEFAULT (N'pending'), -- pending/confirmed/delivered/cancelled
        created_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_so_ca DEFAULT (SYSUTCDATETIME()),
        updated_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_so_ua DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_sales_orders      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_sales_orders_odoo UNIQUE (odoo_id),
        CONSTRAINT FK_so_customer FOREIGN KEY (customer_id) REFERENCES report.customers (id)
    );
    CREATE INDEX IX_so_status ON report.sales_orders (status) INCLUDE (order_date);
    CREATE INDEX IX_so_date   ON report.sales_orders (order_date);
END
GO

/* --- service_jobs : Open RMA / Repair KPI + service history ----------------- */
IF OBJECT_ID(N'report.service_jobs', N'U') IS NULL
BEGIN
    CREATE TABLE report.service_jobs
    (
        id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sj_id DEFAULT NEWSEQUENTIALID(),
        odoo_id       BIGINT           NOT NULL,
        job_number    NVARCHAR(64)     NOT NULL,
        job_type      NVARCHAR(32)     NOT NULL CONSTRAINT DF_sj_type DEFAULT (N'RMA'), -- RMA/REPAIR/WARRANTY
        customer_id   UNIQUEIDENTIFIER NULL,
        product_id    UNIQUEIDENTIFIER NULL,
        opened_date   DATE             NOT NULL,
        closed_date   DATE             NULL,
        status        NVARCHAR(32)     NOT NULL CONSTRAINT DF_sj_status DEFAULT (N'OPEN'), -- OPEN/CLOSED/SETTLED/CANCELLED/CUSTOMER_DELIVERED
        current_location NVARCHAR(128) NULL,
        created_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_sj_ca DEFAULT (SYSUTCDATETIME()),
        updated_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_sj_ua DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_service_jobs      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_service_jobs_odoo UNIQUE (odoo_id),
        CONSTRAINT FK_sj_customer FOREIGN KEY (customer_id) REFERENCES report.customers (id),
        CONSTRAINT FK_sj_product  FOREIGN KEY (product_id)  REFERENCES report.products (id)
    );
    CREATE INDEX IX_sj_status   ON report.service_jobs (status);
    CREATE INDEX IX_sj_customer ON report.service_jobs (customer_id);
END
GO

/* --- cash_bank_accounts : Cash-In-Hand & Bank Accounts balances ------------- */
IF OBJECT_ID(N'report.cash_bank_accounts', N'U') IS NULL
BEGIN
    CREATE TABLE report.cash_bank_accounts
    (
        id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_cba_id DEFAULT NEWSEQUENTIALID(),
        odoo_id       BIGINT           NOT NULL,
        account_name  NVARCHAR(128)    NOT NULL,
        account_type  NVARCHAR(32)     NOT NULL, -- 'Cash-In-Hand' or 'Bank Accounts'  (matches the frontend AccountGroupType)
        balance       DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_cba_bal DEFAULT (0),
        updated_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_cba_ua DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_cash_bank_accounts      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_cash_bank_accounts_odoo UNIQUE (odoo_id)
    );
    CREATE INDEX IX_cba_type ON report.cash_bank_accounts (account_type);
END
GO

/* --- commercial-import trackers : foreign purchases / C&F / landed cost ----- */
IF OBJECT_ID(N'report.foreign_purchases', N'U') IS NULL
BEGIN
    CREATE TABLE report.foreign_purchases
    (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_fp_id DEFAULT NEWSEQUENTIALID(),
        odoo_id BIGINT NOT NULL, reference NVARCHAR(64) NULL, purchase_date DATE NULL,
        amount_total DECIMAL(18,2) NOT NULL CONSTRAINT DF_fp_total DEFAULT (0),
        status NVARCHAR(32) NOT NULL CONSTRAINT DF_fp_status DEFAULT (N'OPEN'),
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_fp_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_foreign_purchases PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_foreign_purchases_odoo UNIQUE (odoo_id)
    );
END
GO
IF OBJECT_ID(N'report.cnf_jobs', N'U') IS NULL
BEGIN
    CREATE TABLE report.cnf_jobs
    (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_cnf_id DEFAULT NEWSEQUENTIALID(),
        odoo_id BIGINT NOT NULL, job_number NVARCHAR(64) NULL, opened_date DATE NULL,
        status NVARCHAR(32) NOT NULL CONSTRAINT DF_cnf_status DEFAULT (N'OPEN'), -- OPEN/CLOSED/SETTLED/CANCELLED
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_cnf_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_cnf_jobs PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_cnf_jobs_odoo UNIQUE (odoo_id)
    );
END
GO
IF OBJECT_ID(N'report.landed_cost_batches', N'U') IS NULL
BEGIN
    CREATE TABLE report.landed_cost_batches
    (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_lcb_id DEFAULT NEWSEQUENTIALID(),
        odoo_id BIGINT NOT NULL, batch_number NVARCHAR(64) NULL, batch_date DATE NULL,
        amount_total DECIMAL(18,2) NOT NULL CONSTRAINT DF_lcb_total DEFAULT (0),
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_lcb_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_landed_cost_batches PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_landed_cost_batches_odoo UNIQUE (odoo_id)
    );
END
GO
IF OBJECT_ID(N'report.sms_messages', N'U') IS NULL
BEGIN
    CREATE TABLE report.sms_messages
    (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sms_id DEFAULT NEWSEQUENTIALID(),
        odoo_id BIGINT NULL, sent_date DATE NULL,
        status NVARCHAR(32) NOT NULL CONSTRAINT DF_sms_status DEFAULT (N'PENDING'), -- SENT/DELIVERED/PENDING/FAILED/RETRY
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_sms_ca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_sms_messages PRIMARY KEY NONCLUSTERED (id)
    );
    CREATE INDEX IX_sms_status ON report.sms_messages (status, sent_date);
END
GO

/* ===========================================================================
   KPI TILE MAPPING  (one procedure per dashboard tile)
   Each returns a single row whose column name matches the JSON key the
   frontend reads in owner-command-center.js `pick()`.
   =========================================================================== */

/* Tile: Today sales  ->  GET /api/v1/Dashboard/today-sales-amount            */
CREATE OR ALTER PROCEDURE report.usp_dashboard_today_sales @AsOf DATE = NULL AS
BEGIN SET NOCOUNT ON;
    SET @AsOf = ISNULL(@AsOf, CAST(SYSDATETIME() AS DATE));
    SELECT amount = ISNULL(SUM(amount_total),0)
    FROM report.sales_invoices WHERE state=N'posted' AND invoice_date=@AsOf;
END
GO

/* Tile: Collection today -> GET /api/v1/Dashboard/today-due-collection-amount */
CREATE OR ALTER PROCEDURE report.usp_dashboard_today_collection @AsOf DATE = NULL AS
BEGIN SET NOCOUNT ON;
    SET @AsOf = ISNULL(@AsOf, CAST(SYSDATETIME() AS DATE));
    SELECT amount = ISNULL(SUM(amount),0)
    FROM report.payments WHERE direction=N'inbound' AND payment_date=@AsOf;
END
GO

/* Tile: Expense today -> GET /api/v1/Dashboard/today-expense-amount          */
CREATE OR ALTER PROCEDURE report.usp_dashboard_today_expense @AsOf DATE = NULL AS
BEGIN SET NOCOUNT ON;
    SET @AsOf = ISNULL(@AsOf, CAST(SYSDATETIME() AS DATE));
    SELECT amount = ISNULL(SUM(amount),0)
    FROM report.expenses WHERE expense_date=@AsOf;
END
GO

/* Tile: Product profit today -> GET /api/v1/Dashboard/today-product-profit-amount */
CREATE OR ALTER PROCEDURE report.usp_dashboard_today_product_profit @AsOf DATE = NULL AS
BEGIN SET NOCOUNT ON;
    SET @AsOf = ISNULL(@AsOf, CAST(SYSDATETIME() AS DATE));
    SELECT amount = ISNULL(SUM(line_profit),0)
    FROM report.sales_invoice_lines WHERE invoice_date=@AsOf;
END
GO

/* Tile: Customer due -> GET /api/v1/Report/get-customer-balance-total  (totalBalance) */
CREATE OR ALTER PROCEDURE report.usp_report_customer_balance_total AS
BEGIN SET NOCOUNT ON;
    SELECT totalBalance = ISNULL(SUM(amount_due),0)
    FROM report.sales_invoices WHERE state=N'posted' AND amount_due>0;
END
GO

/* Tile: Supplier due -> GET /api/v1/Report/get-supplier-balance-report?ReportType=headTotal */
CREATE OR ALTER PROCEDURE report.usp_report_supplier_balance_total AS
BEGIN SET NOCOUNT ON;
    SELECT totalBalance = ISNULL(SUM(amount_due),0)
    FROM report.supplier_bills WHERE state=N'posted' AND amount_due>0;
END
GO

/* Tiles: Cash balance / Bank balance
   -> GET /api/v1/Report/get-cash-bank-balance-report?AccountGroupType=<type>&ReportType=HeadTotal
   Pass @AccountGroupType = 'Cash-In-Hand' or 'Bank Accounts' (exact frontend values). */
CREATE OR ALTER PROCEDURE report.usp_report_cash_bank_balance @AccountGroupType NVARCHAR(32) AS
BEGIN SET NOCOUNT ON;
    SELECT totalBalance = ISNULL(SUM(balance),0)
    FROM report.cash_bank_accounts WHERE account_type=@AccountGroupType;
END
GO

/* Tile: Inventory value -> GET /api/v1/Report/get-total-product-stock-value (totalStockValue) */
CREATE OR ALTER PROCEDURE report.usp_report_total_stock_value AS
BEGIN SET NOCOUNT ON;
    SELECT totalStockValue = ISNULL(SUM(qty_on_hand * cost_price),0)
    FROM report.products WHERE is_active=1;
END
GO

/* Tile: Pending orders -> GET /api/v1/Dashboard/pending-orders-count (count)  */
CREATE OR ALTER PROCEDURE report.usp_dashboard_pending_orders_count AS
BEGIN SET NOCOUNT ON;
    SELECT [count] = COUNT(*)
    FROM report.sales_orders WHERE status=N'pending';
END
GO

/* Tiles: commercial-import counts (frontend counts array rows, filtering open)
   -> GET /cjext/api/foreign-trade/purchases | /cjext/api/cnf/jobs
      /cjext/api/landed-cost/batches | /cjext/api/rma                          */
CREATE OR ALTER VIEW report.v_foreign_purchases AS
    SELECT id, reference, purchase_date, amount_total, status FROM report.foreign_purchases;
GO
CREATE OR ALTER VIEW report.v_cnf_jobs AS
    SELECT id, job_number, opened_date, status FROM report.cnf_jobs
    WHERE status NOT IN (N'CLOSED', N'SETTLED', N'CANCELLED', N'CUSTOMER_DELIVERED');
GO
CREATE OR ALTER VIEW report.v_landed_cost_batches AS
    SELECT id, batch_number, batch_date, amount_total FROM report.landed_cost_batches;
GO
CREATE OR ALTER VIEW report.v_open_rma AS
    SELECT id, job_number, job_type, customer_id, product_id, opened_date, status, current_location
    FROM report.service_jobs
    WHERE status NOT IN (N'CLOSED', N'SETTLED', N'CANCELLED', N'CUSTOMER_DELIVERED');
GO

/* ===========================================================================
   PANEL MAPPING  (the lower "Owner Intelligence" panels)
   =========================================================================== */

/* Panel: Monthly revenue trend  (cj-bars data-sales-bars)                     */
CREATE OR ALTER VIEW report.v_panel_monthly_revenue AS
    SELECT
        period      = FORMAT(invoice_date, 'yyyy-MM'),
        label       = FORMAT(invoice_date, 'MMM yyyy'),
        total_sales = SUM(amount_total)
    FROM report.sales_invoices
    WHERE state=N'posted'
    GROUP BY FORMAT(invoice_date, 'yyyy-MM'), FORMAT(invoice_date, 'MMM yyyy');
GO

/* Panel: Fast moving products  (top products by quantity sold)                */
CREATE OR ALTER PROCEDURE report.usp_panel_fast_moving_products @Top INT = 8, @Days INT = 90 AS
BEGIN SET NOCOUNT ON;
    SELECT TOP (@Top)
        product_id   = l.product_id,
        product_name = p.name,
        qty_sold     = SUM(l.quantity),
        value_sold   = SUM(l.line_total)
    FROM report.sales_invoice_lines AS l
    JOIN report.products AS p ON p.id = l.product_id
    WHERE l.invoice_date >= DATEADD(DAY, -@Days, CAST(SYSDATETIME() AS DATE))
    GROUP BY l.product_id, p.name
    ORDER BY SUM(l.quantity) DESC;
END
GO

/* Panel: Customer payment watch  (customers with due, most overdue first)     */
CREATE OR ALTER PROCEDURE report.usp_panel_customer_payment_watch @Top INT = 20 AS
BEGIN SET NOCOUNT ON;
    SELECT TOP (@Top)
        customer_id, customer_name, phone, total_due, earliest_due_date, open_invoices
    FROM report.v_customer_due
    WHERE total_due > 0
    ORDER BY earliest_due_date ASC, total_due DESC;
END
GO

/* Panel: Expense breakdown  (by category, current month)                      */
CREATE OR ALTER VIEW report.v_panel_expense_breakdown AS
    SELECT
        period   = FORMAT(expense_date, 'yyyy-MM'),
        category = ISNULL(category, N'Uncategorized'),
        total    = SUM(amount)
    FROM report.expenses
    GROUP BY FORMAT(expense_date, 'yyyy-MM'), ISNULL(category, N'Uncategorized');
GO

/* Panel: SMS Automation summary  (counts by status)  -> /cjext/api/sms/summary */
CREATE OR ALTER PROCEDURE report.usp_panel_sms_summary @AsOf DATE = NULL AS
BEGIN SET NOCOUNT ON;
    SET @AsOf = ISNULL(@AsOf, CAST(SYSDATETIME() AS DATE));
    SELECT
        today     = SUM(CASE WHEN sent_date=@AsOf THEN 1 ELSE 0 END),
        delivered = SUM(CASE WHEN status=N'DELIVERED' THEN 1 ELSE 0 END),
        pending   = SUM(CASE WHEN status=N'PENDING'   THEN 1 ELSE 0 END),
        failed    = SUM(CASE WHEN status=N'FAILED'    THEN 1 ELSE 0 END),
        retry     = SUM(CASE WHEN status=N'RETRY'     THEN 1 ELSE 0 END)
    FROM report.sms_messages;
END
GO

/* ===========================================================================
   CUSTOMER 360  -> /cjext/api/workspace/360?entity_type=CUSTOMER&canonical_id=<id>
   The runtime-features "customer()" view reads: profile, invoices, orders,
   payments, service, lifetime sales/collection/due. These procedures return
   each block for a given customer id.
   =========================================================================== */
CREATE OR ALTER PROCEDURE report.usp_customer360_summary @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        c.id, c.odoo_id, c.code, c.name, c.phone, c.email, c.address, c.credit_limit,
        lifetime_sales      = (SELECT ISNULL(SUM(amount_total),0) FROM report.sales_invoices WHERE customer_id=c.id AND state=N'posted'),
        lifetime_collection = (SELECT ISNULL(SUM(amount),0)       FROM report.payments       WHERE customer_id=c.id AND direction=N'inbound'),
        current_due         = (SELECT ISNULL(SUM(amount_due),0)   FROM report.sales_invoices WHERE customer_id=c.id AND state=N'posted' AND amount_due>0),
        invoice_count       = (SELECT COUNT(*) FROM report.sales_invoices WHERE customer_id=c.id AND state=N'posted'),
        order_count         = (SELECT COUNT(*) FROM report.sales_orders   WHERE customer_id=c.id),
        open_service        = (SELECT COUNT(*) FROM report.v_open_rma     WHERE customer_id=c.id)
    FROM report.customers AS c
    WHERE c.id = @CustomerId;
END
GO
CREATE OR ALTER PROCEDURE report.usp_customer360_invoices @CustomerId UNIQUEIDENTIFIER, @Top INT = 50 AS
BEGIN SET NOCOUNT ON;
    SELECT TOP (@Top) id, invoice_number, invoice_date, due_date, amount_total, amount_paid, amount_due, payment_state
    FROM report.sales_invoices WHERE customer_id=@CustomerId AND state=N'posted'
    ORDER BY invoice_date DESC;
END
GO
CREATE OR ALTER PROCEDURE report.usp_customer360_payments @CustomerId UNIQUEIDENTIFIER, @Top INT = 50 AS
BEGIN SET NOCOUNT ON;
    SELECT TOP (@Top) id, payment_reference, payment_date, amount, method, is_bank
    FROM report.payments WHERE customer_id=@CustomerId AND direction=N'inbound'
    ORDER BY payment_date DESC;
END
GO

PRINT N'COLORJET owner-dashboard mapping created: KPI procs, panel views/procs, Customer 360 procs.';
PRINT N'API layer: each dashboard endpoint = EXEC of the matching report.usp_* / SELECT from report.v_*.';
GO
