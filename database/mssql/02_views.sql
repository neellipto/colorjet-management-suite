/* =============================================================================
   COLORJET Bangladesh — Reporting Views (Microsoft SQL Server)
   -----------------------------------------------------------------------------
   Read-only views that back the app reports:
     daily sales, collection, customer due, supplier payable,
     stock + low stock, expenses, cash/bank balance, dashboard summary.

   Run after 01_schema.sql. Idempotent (CREATE OR ALTER).
   Target: SQL Server 2016 SP1+ (CREATE OR ALTER).
   ============================================================================= */
SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   Daily sales — invoiced amount per day.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_daily_sales
AS
    SELECT
        si.invoice_date                         AS sales_date,
        COUNT(*)                                AS invoice_count,
        SUM(si.amount_untaxed)                  AS total_untaxed,
        SUM(si.amount_tax)                      AS total_tax,
        SUM(si.amount_total)                    AS total_sales
    FROM report.sales_invoices AS si
    WHERE si.state = N'posted'
    GROUP BY si.invoice_date;
GO

/* ---------------------------------------------------------------------------
   Daily collection — customer money-in per day.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_daily_collection
AS
    SELECT
        p.payment_date                          AS collection_date,
        COUNT(*)                                AS payment_count,
        SUM(CASE WHEN p.is_bank = 0 THEN p.amount ELSE 0 END) AS cash_collection,
        SUM(CASE WHEN p.is_bank = 1 THEN p.amount ELSE 0 END) AS bank_collection,
        SUM(p.amount)                           AS total_collection
    FROM report.payments AS p
    WHERE p.direction = N'inbound'
    GROUP BY p.payment_date;
GO

/* ---------------------------------------------------------------------------
   Customer due — outstanding receivable per customer.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_customer_due
AS
    SELECT
        c.id                                    AS customer_id,
        c.odoo_id                               AS customer_odoo_id,
        c.code,
        c.name                                  AS customer_name,
        c.phone,
        c.credit_limit,
        COUNT(si.id)                            AS open_invoices,
        ISNULL(SUM(si.amount_due), 0)           AS total_due,
        MIN(si.due_date)                        AS earliest_due_date
    FROM report.customers AS c
    LEFT JOIN report.sales_invoices AS si
        ON si.customer_id = c.id
       AND si.state = N'posted'
       AND si.amount_due > 0
    GROUP BY c.id, c.odoo_id, c.code, c.name, c.phone, c.credit_limit;
GO

/* ---------------------------------------------------------------------------
   Supplier payable — outstanding payable per supplier.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_supplier_payable
AS
    SELECT
        s.id                                    AS supplier_id,
        s.odoo_id                               AS supplier_odoo_id,
        s.code,
        s.name                                  AS supplier_name,
        s.phone,
        COUNT(sb.id)                            AS open_bills,
        ISNULL(SUM(sb.amount_due), 0)           AS total_payable,
        MIN(sb.due_date)                        AS earliest_due_date
    FROM report.suppliers AS s
    LEFT JOIN report.supplier_bills AS sb
        ON sb.supplier_id = s.id
       AND sb.state = N'posted'
       AND sb.amount_due > 0
    GROUP BY s.id, s.odoo_id, s.code, s.name, s.phone;
GO

/* ---------------------------------------------------------------------------
   Stock — current on-hand valuation per product.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_stock
AS
    SELECT
        p.id                                    AS product_id,
        p.odoo_id                               AS product_odoo_id,
        p.default_code,
        p.name                                  AS product_name,
        p.category,
        p.uom,
        p.qty_on_hand,
        p.reorder_level,
        p.cost_price,
        p.sale_price,
        CAST(p.qty_on_hand * p.cost_price AS DECIMAL(18, 2)) AS stock_value_cost,
        CAST(p.qty_on_hand * p.sale_price AS DECIMAL(18, 2)) AS stock_value_sale
    FROM report.products AS p
    WHERE p.is_active = 1;
GO

/* ---------------------------------------------------------------------------
   Low stock — products at or below reorder level.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_low_stock
AS
    SELECT
        p.id                                    AS product_id,
        p.odoo_id                               AS product_odoo_id,
        p.default_code,
        p.name                                  AS product_name,
        p.category,
        p.uom,
        p.qty_on_hand,
        p.reorder_level,
        CAST(p.reorder_level - p.qty_on_hand AS DECIMAL(18, 3)) AS shortage_qty
    FROM report.products AS p
    WHERE p.is_active = 1
      AND p.reorder_level > 0
      AND p.qty_on_hand <= p.reorder_level;
GO

/* ---------------------------------------------------------------------------
   Daily expenses — expense totals per day and split by cash/bank.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_daily_expenses
AS
    SELECT
        e.expense_date,
        COUNT(*)                                AS expense_count,
        SUM(CASE WHEN e.is_bank = 0 THEN e.amount ELSE 0 END) AS cash_expenses,
        SUM(CASE WHEN e.is_bank = 1 THEN e.amount ELSE 0 END) AS bank_expenses,
        SUM(e.amount)                           AS total_expenses
    FROM report.expenses AS e
    GROUP BY e.expense_date;
GO

/* ---------------------------------------------------------------------------
   Expenses by category — for the expense breakdown report.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_expenses_by_category
AS
    SELECT
        e.expense_date,
        ISNULL(e.category, N'Uncategorized')    AS category,
        COUNT(*)                                AS expense_count,
        SUM(e.amount)                           AS total_amount
    FROM report.expenses AS e
    GROUP BY e.expense_date, ISNULL(e.category, N'Uncategorized');
GO

/* ---------------------------------------------------------------------------
   Cash / bank balance — running money-in minus money-out.
   Collections (inbound) add; supplier/other payments (outbound) and expenses
   subtract. Split by cash vs. bank.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_cash_bank_balance
AS
    WITH movements AS
    (
        -- Payments in
        SELECT
            CASE WHEN p.is_bank = 1 THEN N'bank' ELSE N'cash' END AS account,
            CASE WHEN p.direction = N'inbound' THEN p.amount ELSE -p.amount END AS signed_amount
        FROM report.payments AS p
        UNION ALL
        -- Expenses out
        SELECT
            CASE WHEN e.is_bank = 1 THEN N'bank' ELSE N'cash' END AS account,
            -e.amount AS signed_amount
        FROM report.expenses AS e
    )
    SELECT
        account,
        SUM(signed_amount)                      AS balance
    FROM movements
    GROUP BY account;
GO

/* ---------------------------------------------------------------------------
   Dashboard summary — single-row snapshot for the app home screen.
   Today's sales/collection/expenses plus overall receivable / payable / stock.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW report.v_dashboard_summary
AS
    SELECT
        CAST(SYSDATETIME() AS DATE)                                       AS as_of_date,
        (SELECT ISNULL(SUM(amount_total), 0)
             FROM report.sales_invoices
             WHERE state = N'posted' AND invoice_date = CAST(SYSDATETIME() AS DATE))   AS today_sales,
        (SELECT ISNULL(SUM(amount), 0)
             FROM report.payments
             WHERE direction = N'inbound' AND payment_date = CAST(SYSDATETIME() AS DATE)) AS today_collection,
        (SELECT ISNULL(SUM(amount), 0)
             FROM report.expenses
             WHERE expense_date = CAST(SYSDATETIME() AS DATE))                          AS today_expenses,
        (SELECT ISNULL(SUM(amount_due), 0)
             FROM report.sales_invoices
             WHERE state = N'posted' AND amount_due > 0)                                AS total_customer_due,
        (SELECT ISNULL(SUM(amount_due), 0)
             FROM report.supplier_bills
             WHERE state = N'posted' AND amount_due > 0)                                AS total_supplier_payable,
        (SELECT ISNULL(SUM(qty_on_hand * cost_price), 0)
             FROM report.products WHERE is_active = 1)                                  AS total_stock_value,
        (SELECT COUNT(*)
             FROM report.products
             WHERE is_active = 1 AND reorder_level > 0 AND qty_on_hand <= reorder_level) AS low_stock_count,
        (SELECT ISNULL(SUM(CASE WHEN is_bank = 0 THEN amount ELSE 0 END), 0)
             FROM report.payments WHERE direction = N'inbound')
          - (SELECT ISNULL(SUM(CASE WHEN is_bank = 0 THEN amount ELSE 0 END), 0)
             FROM report.expenses)                                                      AS cash_balance,
        (SELECT ISNULL(SUM(CASE WHEN is_bank = 1 THEN amount ELSE 0 END), 0)
             FROM report.payments WHERE direction = N'inbound')
          - (SELECT ISNULL(SUM(CASE WHEN is_bank = 1 THEN amount ELSE 0 END), 0)
             FROM report.expenses)                                                      AS bank_balance;
GO

PRINT N'COLORJET reporting views (report.v_*) created / verified.';
GO
