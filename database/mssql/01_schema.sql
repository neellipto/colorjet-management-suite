/* =============================================================================
   COLORJET Bangladesh — Read-only Odoo Reporting Database (Microsoft SQL Server)
   -----------------------------------------------------------------------------
   Build script: schema, tables, constraints and indexes.

   Design rules (from repository README spec):
     * This database RECEIVES data from Odoo through the sync API ONLY.
     * The mobile/ERP app MUST NOT edit Odoo accounting, stock, invoices or
       payments. This database is a reporting mirror, not a source of truth.
     * Primary keys are UUIDs  ->  UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID().
     * Every table keeps a UNIQUE Odoo id so the sync can upsert idempotently.
     * Date / customer / supplier / product / invoice columns are indexed.

   Idempotent: safe to run multiple times. Run 01_schema.sql, then
   02_views.sql, then 03_security.sql.
   Target: SQL Server 2019+ (also works on Azure SQL Database).
   ============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   Dedicated schema so the reporting objects never collide with anything else.
   --------------------------------------------------------------------------- */
IF SCHEMA_ID(N'report') IS NULL
    EXEC (N'CREATE SCHEMA [report] AUTHORIZATION [dbo];');
GO

/* ===========================================================================
   1. customers
   =========================================================================== */
IF OBJECT_ID(N'report.customers', N'U') IS NULL
BEGIN
    CREATE TABLE report.customers
    (
        id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_customers_id DEFAULT NEWSEQUENTIALID(),
        odoo_id       BIGINT           NOT NULL,
        code          NVARCHAR(64)     NULL,
        name          NVARCHAR(256)    NOT NULL,
        phone         NVARCHAR(64)     NULL,
        email         NVARCHAR(256)    NULL,
        address       NVARCHAR(1024)   NULL,
        credit_limit  DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_customers_credit_limit DEFAULT (0),
        balance_due   DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_customers_balance_due   DEFAULT (0),
        is_active     BIT              NOT NULL CONSTRAINT DF_customers_is_active      DEFAULT (1),
        odoo_synced_at DATETIME2(3)    NULL,
        created_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_customers_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_customers_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_customers      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_customers_odoo UNIQUE (odoo_id)
    );
    CREATE INDEX IX_customers_name ON report.customers (name);
END
GO

/* ===========================================================================
   2. suppliers
   =========================================================================== */
IF OBJECT_ID(N'report.suppliers', N'U') IS NULL
BEGIN
    CREATE TABLE report.suppliers
    (
        id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_suppliers_id DEFAULT NEWSEQUENTIALID(),
        odoo_id          BIGINT           NOT NULL,
        code             NVARCHAR(64)     NULL,
        name             NVARCHAR(256)    NOT NULL,
        phone            NVARCHAR(64)     NULL,
        email            NVARCHAR(256)    NULL,
        address          NVARCHAR(1024)   NULL,
        balance_payable  DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_suppliers_balance_payable DEFAULT (0),
        is_active        BIT              NOT NULL CONSTRAINT DF_suppliers_is_active DEFAULT (1),
        odoo_synced_at   DATETIME2(3)     NULL,
        created_at       DATETIME2(3)     NOT NULL CONSTRAINT DF_suppliers_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at       DATETIME2(3)     NOT NULL CONSTRAINT DF_suppliers_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_suppliers      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_suppliers_odoo UNIQUE (odoo_id)
    );
    CREATE INDEX IX_suppliers_name ON report.suppliers (name);
END
GO

/* ===========================================================================
   3. products
   =========================================================================== */
IF OBJECT_ID(N'report.products', N'U') IS NULL
BEGIN
    CREATE TABLE report.products
    (
        id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_products_id DEFAULT NEWSEQUENTIALID(),
        odoo_id        BIGINT           NOT NULL,
        default_code   NVARCHAR(64)     NULL,   -- SKU / internal reference
        barcode        NVARCHAR(128)    NULL,
        name           NVARCHAR(256)    NOT NULL,
        category       NVARCHAR(256)    NULL,
        uom            NVARCHAR(64)      NULL,
        sale_price     DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_products_sale_price DEFAULT (0),
        cost_price     DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_products_cost_price DEFAULT (0),
        qty_on_hand    DECIMAL(18, 3)   NOT NULL CONSTRAINT DF_products_qty_on_hand DEFAULT (0),
        reorder_level  DECIMAL(18, 3)   NOT NULL CONSTRAINT DF_products_reorder_level DEFAULT (0),
        is_active      BIT              NOT NULL CONSTRAINT DF_products_is_active DEFAULT (1),
        odoo_synced_at DATETIME2(3)     NULL,
        created_at     DATETIME2(3)     NOT NULL CONSTRAINT DF_products_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at     DATETIME2(3)     NOT NULL CONSTRAINT DF_products_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_products      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_products_odoo UNIQUE (odoo_id)
    );
    CREATE INDEX IX_products_name         ON report.products (name);
    CREATE INDEX IX_products_default_code ON report.products (default_code);
    CREATE INDEX IX_products_category     ON report.products (category);
END
GO

/* ===========================================================================
   4. sales_invoices
   =========================================================================== */
IF OBJECT_ID(N'report.sales_invoices', N'U') IS NULL
BEGIN
    CREATE TABLE report.sales_invoices
    (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sales_invoices_id DEFAULT NEWSEQUENTIALID(),
        odoo_id         BIGINT           NOT NULL,
        invoice_number  NVARCHAR(64)     NOT NULL,
        customer_id     UNIQUEIDENTIFIER NULL,
        customer_odoo_id BIGINT          NULL,
        invoice_date    DATE             NOT NULL,
        due_date        DATE             NULL,
        amount_untaxed  DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_sales_invoices_untaxed DEFAULT (0),
        amount_tax      DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_sales_invoices_tax     DEFAULT (0),
        amount_total    DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_sales_invoices_total   DEFAULT (0),
        amount_paid     DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_sales_invoices_paid    DEFAULT (0),
        amount_due      DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_sales_invoices_due     DEFAULT (0),
        currency        NVARCHAR(8)      NOT NULL CONSTRAINT DF_sales_invoices_ccy     DEFAULT (N'BDT'),
        state           NVARCHAR(32)     NOT NULL CONSTRAINT DF_sales_invoices_state   DEFAULT (N'posted'),
        payment_state   NVARCHAR(32)     NULL,
        odoo_synced_at  DATETIME2(3)     NULL,
        created_at      DATETIME2(3)     NOT NULL CONSTRAINT DF_sales_invoices_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at      DATETIME2(3)     NOT NULL CONSTRAINT DF_sales_invoices_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_sales_invoices      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_sales_invoices_odoo UNIQUE (odoo_id),
        CONSTRAINT FK_sales_invoices_customer
            FOREIGN KEY (customer_id) REFERENCES report.customers (id)
    );
    CREATE INDEX IX_sales_invoices_date     ON report.sales_invoices (invoice_date);
    CREATE INDEX IX_sales_invoices_customer ON report.sales_invoices (customer_id);
    CREATE INDEX IX_sales_invoices_number   ON report.sales_invoices (invoice_number);
    CREATE INDEX IX_sales_invoices_state    ON report.sales_invoices (state) INCLUDE (amount_due, amount_total);
END
GO

/* ===========================================================================
   5. payments   (customer collections & other money-in / money-out entries)
   =========================================================================== */
IF OBJECT_ID(N'report.payments', N'U') IS NULL
BEGIN
    CREATE TABLE report.payments
    (
        id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_payments_id DEFAULT NEWSEQUENTIALID(),
        odoo_id           BIGINT           NOT NULL,
        payment_reference NVARCHAR(64)     NULL,
        customer_id       UNIQUEIDENTIFIER NULL,
        invoice_id        UNIQUEIDENTIFIER NULL,
        invoice_odoo_id   BIGINT           NULL,
        payment_date      DATE             NOT NULL,
        amount            DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_payments_amount DEFAULT (0),
        direction         NVARCHAR(16)     NOT NULL CONSTRAINT DF_payments_direction DEFAULT (N'inbound'), -- inbound = collection
        method            NVARCHAR(32)     NULL,   -- cash / bank / mobile
        journal           NVARCHAR(128)    NULL,   -- Odoo journal name
        is_bank           BIT              NOT NULL CONSTRAINT DF_payments_is_bank DEFAULT (0),
        odoo_synced_at    DATETIME2(3)     NULL,
        created_at        DATETIME2(3)     NOT NULL CONSTRAINT DF_payments_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_payments      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_payments_odoo UNIQUE (odoo_id),
        CONSTRAINT FK_payments_customer FOREIGN KEY (customer_id) REFERENCES report.customers (id),
        CONSTRAINT FK_payments_invoice  FOREIGN KEY (invoice_id)  REFERENCES report.sales_invoices (id)
    );
    CREATE INDEX IX_payments_date     ON report.payments (payment_date);
    CREATE INDEX IX_payments_customer ON report.payments (customer_id);
    CREATE INDEX IX_payments_invoice  ON report.payments (invoice_id);
END
GO

/* ===========================================================================
   6. supplier_bills   (accounts payable)
   =========================================================================== */
IF OBJECT_ID(N'report.supplier_bills', N'U') IS NULL
BEGIN
    CREATE TABLE report.supplier_bills
    (
        id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_supplier_bills_id DEFAULT NEWSEQUENTIALID(),
        odoo_id          BIGINT           NOT NULL,
        bill_number      NVARCHAR(64)     NOT NULL,
        supplier_id      UNIQUEIDENTIFIER NULL,
        supplier_odoo_id BIGINT           NULL,
        bill_date        DATE             NOT NULL,
        due_date         DATE             NULL,
        amount_total     DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_supplier_bills_total DEFAULT (0),
        amount_paid      DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_supplier_bills_paid  DEFAULT (0),
        amount_due       DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_supplier_bills_due   DEFAULT (0),
        currency         NVARCHAR(8)      NOT NULL CONSTRAINT DF_supplier_bills_ccy   DEFAULT (N'BDT'),
        state            NVARCHAR(32)     NOT NULL CONSTRAINT DF_supplier_bills_state DEFAULT (N'posted'),
        payment_state    NVARCHAR(32)     NULL,
        odoo_synced_at   DATETIME2(3)     NULL,
        created_at       DATETIME2(3)     NOT NULL CONSTRAINT DF_supplier_bills_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at       DATETIME2(3)     NOT NULL CONSTRAINT DF_supplier_bills_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_supplier_bills      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_supplier_bills_odoo UNIQUE (odoo_id),
        CONSTRAINT FK_supplier_bills_supplier
            FOREIGN KEY (supplier_id) REFERENCES report.suppliers (id)
    );
    CREATE INDEX IX_supplier_bills_date     ON report.supplier_bills (bill_date);
    CREATE INDEX IX_supplier_bills_supplier ON report.supplier_bills (supplier_id);
    CREATE INDEX IX_supplier_bills_number   ON report.supplier_bills (bill_number);
    CREATE INDEX IX_supplier_bills_state    ON report.supplier_bills (state) INCLUDE (amount_due, amount_total);
END
GO

/* ===========================================================================
   7. stock_movements
   =========================================================================== */
IF OBJECT_ID(N'report.stock_movements', N'U') IS NULL
BEGIN
    CREATE TABLE report.stock_movements
    (
        id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_stock_movements_id DEFAULT NEWSEQUENTIALID(),
        odoo_id         BIGINT           NOT NULL,
        product_id      UNIQUEIDENTIFIER NULL,
        product_odoo_id BIGINT           NULL,
        movement_date   DATE             NOT NULL,
        movement_type   NVARCHAR(16)     NOT NULL CONSTRAINT DF_stock_movements_type DEFAULT (N'in'), -- in / out
        quantity        DECIMAL(18, 3)   NOT NULL CONSTRAINT DF_stock_movements_qty DEFAULT (0),
        uom             NVARCHAR(64)     NULL,
        location_src    NVARCHAR(128)    NULL,
        location_dest   NVARCHAR(128)    NULL,
        reference       NVARCHAR(128)    NULL,
        odoo_synced_at  DATETIME2(3)     NULL,
        created_at      DATETIME2(3)     NOT NULL CONSTRAINT DF_stock_movements_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_stock_movements      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_stock_movements_odoo UNIQUE (odoo_id),
        CONSTRAINT FK_stock_movements_product
            FOREIGN KEY (product_id) REFERENCES report.products (id)
    );
    CREATE INDEX IX_stock_movements_date    ON report.stock_movements (movement_date);
    CREATE INDEX IX_stock_movements_product ON report.stock_movements (product_id);
END
GO

/* ===========================================================================
   8. expenses
   =========================================================================== */
IF OBJECT_ID(N'report.expenses', N'U') IS NULL
BEGIN
    CREATE TABLE report.expenses
    (
        id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_expenses_id DEFAULT NEWSEQUENTIALID(),
        odoo_id        BIGINT           NOT NULL,
        expense_date   DATE             NOT NULL,
        category       NVARCHAR(128)    NULL,
        description    NVARCHAR(512)    NULL,
        amount         DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_expenses_amount DEFAULT (0),
        method         NVARCHAR(32)     NULL,   -- cash / bank
        is_bank        BIT              NOT NULL CONSTRAINT DF_expenses_is_bank DEFAULT (0),
        paid_by        NVARCHAR(256)    NULL,
        reference      NVARCHAR(128)    NULL,
        odoo_synced_at DATETIME2(3)     NULL,
        created_at     DATETIME2(3)     NOT NULL CONSTRAINT DF_expenses_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_expenses      PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_expenses_odoo UNIQUE (odoo_id)
    );
    CREATE INDEX IX_expenses_date     ON report.expenses (expense_date);
    CREATE INDEX IX_expenses_category ON report.expenses (category);
END
GO

/* ===========================================================================
   9. daily_financial_summary   (one pre-aggregated row per calendar day)
   =========================================================================== */
IF OBJECT_ID(N'report.daily_financial_summary', N'U') IS NULL
BEGIN
    CREATE TABLE report.daily_financial_summary
    (
        id                     UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_dfs_id DEFAULT NEWSEQUENTIALID(),
        odoo_id                BIGINT           NULL,
        summary_date           DATE             NOT NULL,
        total_sales            DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_dfs_total_sales   DEFAULT (0),
        total_collection       DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_dfs_total_coll    DEFAULT (0),
        total_expenses         DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_dfs_total_exp     DEFAULT (0),
        total_supplier_payment DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_dfs_total_supp    DEFAULT (0),
        customer_due_total     DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_dfs_cust_due      DEFAULT (0),
        supplier_payable_total DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_dfs_supp_pay      DEFAULT (0),
        cash_balance           DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_dfs_cash          DEFAULT (0),
        bank_balance           DECIMAL(18, 2)   NOT NULL CONSTRAINT DF_dfs_bank          DEFAULT (0),
        odoo_synced_at         DATETIME2(3)     NULL,
        created_at             DATETIME2(3)     NOT NULL CONSTRAINT DF_dfs_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at             DATETIME2(3)     NOT NULL CONSTRAINT DF_dfs_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_daily_financial_summary   PRIMARY KEY NONCLUSTERED (id),
        CONSTRAINT UQ_dfs_summary_date          UNIQUE (summary_date)
    );
    -- Unique Odoo id only when present (allows locally-derived summaries with NULL odoo_id).
    CREATE UNIQUE INDEX UX_dfs_odoo ON report.daily_financial_summary (odoo_id) WHERE odoo_id IS NOT NULL;
    CREATE INDEX IX_dfs_date ON report.daily_financial_summary (summary_date);
END
GO

/* ===========================================================================
   10. sync_logs   (audit trail of each Odoo -> reporting API sync run)
   =========================================================================== */
IF OBJECT_ID(N'report.sync_logs', N'U') IS NULL
BEGIN
    CREATE TABLE report.sync_logs
    (
        id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sync_logs_id DEFAULT NEWSEQUENTIALID(),
        entity            NVARCHAR(64)     NOT NULL,   -- target table, e.g. 'sales_invoices'
        odoo_model        NVARCHAR(128)    NULL,       -- source model, e.g. 'account.move'
        sync_started_at   DATETIME2(3)     NOT NULL CONSTRAINT DF_sync_logs_started DEFAULT (SYSUTCDATETIME()),
        sync_finished_at  DATETIME2(3)     NULL,
        status            NVARCHAR(32)     NOT NULL CONSTRAINT DF_sync_logs_status DEFAULT (N'running'), -- running/success/failed/partial
        records_processed INT              NOT NULL CONSTRAINT DF_sync_logs_processed DEFAULT (0),
        records_failed    INT              NOT NULL CONSTRAINT DF_sync_logs_failed    DEFAULT (0),
        cursor_value      NVARCHAR(128)    NULL,       -- high-water mark for incremental sync
        message           NVARCHAR(MAX)    NULL,
        created_at        DATETIME2(3)     NOT NULL CONSTRAINT DF_sync_logs_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_sync_logs PRIMARY KEY NONCLUSTERED (id)
    );
    CREATE INDEX IX_sync_logs_entity  ON report.sync_logs (entity, sync_started_at DESC);
    CREATE INDEX IX_sync_logs_started ON report.sync_logs (sync_started_at DESC);
END
GO

PRINT N'COLORJET reporting schema (report.*) created / verified.';
GO
