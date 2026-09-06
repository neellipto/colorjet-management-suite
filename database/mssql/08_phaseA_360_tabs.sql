/* =============================================================================
   COLORJET ERP — PHASE A : Customer 360 remaining tabs (Financial / Sales /
   Machines / Warranty).  Microsoft SQL Server.  REUSE ONLY — no new master.
   -----------------------------------------------------------------------------
   Bound to the audited canonical tables:
     * Customer key in sales/finance tables = PartyId  (= dbo.Accounts.Id)
     * dbo.SalesInvoiceGenerations : SalesInvoiceNo, TotalAmount, PaidAmount,
       DueAmount, DeliveryStatus, Status, SalesOrderId, CreatedDate, PartyId
     * dbo.QuotationGenerations    : QuotationNo, TotalAmount, Status, PartyId
     * dbo.SalesOrderProcessings   : SalesOrderNo, TotalAmount, Status, PartyId
     * dbo.TradingReceipts         : ReceiptCode, ReceiptAmount, PartyId  (customer collection/credit)
     * cj.Warranties               : SerialNumber, MachineModel, ProductId,
       SalesInvoiceId, StartDate, EndDate, Status, CustomerId  (machine + warranty registry)
     * cj.ServiceTickets           : SerialNumber, CustomerId  (service history by serial)

   All read-only. Financial/Sales/Machines/Warranty derive from real records —
   nothing fabricated. @CustomerAccountId is the canonical dbo.Accounts.Id.
   Apply into COLORJET_ERP AFTER 07_phaseA_customer_portal_reuse.sql. Idempotent.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===========================================================================
   FINANCIAL TAB  (summary from Accounts + canonical ledger with running balance)
   Debit  = Sales invoices (TotalAmount)
   Credit = Trading receipts (ReceiptAmount, customer collection)
   =========================================================================== */
CREATE OR ALTER PROCEDURE cj.usp_Customer360_Financial @CustomerAccountId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    /* Verified canonical sources (schema audit):
         collection  = dbo.TradingReceipts (customer money-in). dbo.Payments is NOT
                       customer collection (0 rows link to customer/supplier groups).
         invoice due = dbo.SalesInvoiceGenerations.DueAmount (authoritative per-invoice).
       Accounts.InvoiceAmount/Paid can be NULL, so summary is derived from the
       invoice + receipt records (ISNULL) — never fabricated. */

    DECLARE @InvTotal DECIMAL(18,2) = ISNULL((SELECT SUM(CAST(TotalAmount AS DECIMAL(18,2))) FROM dbo.SalesInvoiceGenerations WHERE IsDeleted=0 AND PartyId=@CustomerAccountId),0);
    DECLARE @InvPaid  DECIMAL(18,2) = ISNULL((SELECT SUM(CAST(PaidAmount  AS DECIMAL(18,2))) FROM dbo.SalesInvoiceGenerations WHERE IsDeleted=0 AND PartyId=@CustomerAccountId),0);
    DECLARE @InvDue   DECIMAL(18,2) = ISNULL((SELECT SUM(CAST(DueAmount   AS DECIMAL(18,2))) FROM dbo.SalesInvoiceGenerations WHERE IsDeleted=0 AND PartyId=@CustomerAccountId),0);
    DECLARE @Receipts DECIMAL(18,2) = ISNULL((SELECT SUM(CAST(ReceiptAmount AS DECIMAL(18,2))) FROM dbo.TradingReceipts WHERE IsDeleted=0 AND PartyId=@CustomerAccountId),0);
    DECLARE @Opening  DECIMAL(18,2) = ISNULL((SELECT CAST(OpeningBalance AS DECIMAL(18,2)) FROM dbo.Accounts WHERE Id=@CustomerAccountId),0);

    /* 1) summary — CurrentDue = canonical per-invoice due (reconciles) */
    SELECT
        TotalInvoiced = @InvTotal,
        TotalCollected= @Receipts,
        InvoicePaid   = @InvPaid,
        CurrentDue    = @InvDue,
        OpeningBalance= @Opening;

    /* 2) ledger with running balance (Invoice debit / Receipt credit) */
    ;WITH ledger AS (
        SELECT TxnDate = CreatedDate, Reference = SalesInvoiceNo,
               TxnType = 'Invoice', Debit = CAST(TotalAmount AS DECIMAL(18,2)),
               Credit = CAST(0 AS DECIMAL(18,2)), SortK = 1
        FROM dbo.SalesInvoiceGenerations WHERE IsDeleted = 0 AND PartyId = @CustomerAccountId
        UNION ALL
        SELECT CreatedDate, ReceiptCode, 'Receipt',
               CAST(0 AS DECIMAL(18,2)), CAST(ReceiptAmount AS DECIMAL(18,2)), 2
        FROM dbo.TradingReceipts WHERE IsDeleted = 0 AND PartyId = @CustomerAccountId
    )
    SELECT TxnDate, Reference, TxnType, Debit, Credit,
           RunningBalance = SUM(Debit - Credit) OVER (
               ORDER BY TxnDate, SortK ROWS UNBOUNDED PRECEDING)
    FROM ledger
    ORDER BY TxnDate, SortK;

    /* 3) reconciliation — ledger closing vs canonical due; difference disclosed */
    SELECT
        LedgerClosing   = (@InvTotal - @Receipts),
        CanonicalDue    = @InvDue,
        Difference      = (@InvTotal - @Receipts) - @InvDue,
        Note = CASE WHEN (@InvTotal - @Receipts) - @InvDue = 0
                    THEN 'RECONCILED'
                    ELSE 'DIFF: invoice inline-paid amounts not matched by receipt rows (disclosed, not hidden)'
               END;
END
GO

/* ===========================================================================
   SALES TAB  (quotations + sales orders + invoices — canonical, clickable refs)
   =========================================================================== */
CREATE OR ALTER PROCEDURE cj.usp_Customer360_Sales @CustomerAccountId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT Kind='QUOTATION', RecordId=Id, Ref=QuotationNo, Dt=CreatedDate,
           Total=CAST(TotalAmount AS DECIMAL(18,2)),
           Paid=CAST(NULL AS DECIMAL(18,2)), Due=CAST(NULL AS DECIMAL(18,2)),
           Status, DeliveryStatus=CAST(NULL AS NVARCHAR(50))
    FROM dbo.QuotationGenerations   WHERE IsDeleted=0 AND PartyId=@CustomerAccountId
    UNION ALL
    SELECT 'ORDER', Id, SalesOrderNo, CreatedDate,
           CAST(TotalAmount AS DECIMAL(18,2)), NULL, NULL, Status, NULL
    FROM dbo.SalesOrderProcessings  WHERE IsDeleted=0 AND PartyId=@CustomerAccountId
    UNION ALL
    SELECT 'INVOICE', Id, SalesInvoiceNo, CreatedDate,
           CAST(TotalAmount AS DECIMAL(18,2)), CAST(PaidAmount AS DECIMAL(18,2)),
           CAST(DueAmount AS DECIMAL(18,2)), Status, DeliveryStatus
    FROM dbo.SalesInvoiceGenerations WHERE IsDeleted=0 AND PartyId=@CustomerAccountId
    ORDER BY Dt DESC;
END
GO

/* ===========================================================================
   MACHINES TAB  (MINIMAL ADDITIVE VIEW over canonical warranty/serial/service —
   NO new machine master). cj.Warranties is the customer+serial+model registry;
   service count comes from cj.ServiceTickets by matching serial.
   =========================================================================== */
CREATE OR ALTER PROCEDURE cj.usp_Customer360_Machines @CustomerAccountId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        MachineModel  = w.MachineModel,
        SerialNumber  = w.SerialNumber,
        ProductId     = w.ProductId,
        SalesInvoiceId= w.SalesInvoiceId,
        WarrantyStart = w.StartDate,
        WarrantyEnd   = w.EndDate,
        WarrantyStatus= w.Status,
        ServiceCount  = (SELECT COUNT(*) FROM cj.ServiceTickets t
                         WHERE t.IsDeleted = 0 AND t.CustomerId = w.CustomerId
                           AND t.SerialNumber = w.SerialNumber)
    FROM cj.Warranties w
    WHERE w.CustomerId = @CustomerAccountId AND w.IsDeleted = 0
    UNION
    /* serials seen in service but without a warranty record */
    SELECT DISTINCT t.MachineModel, t.SerialNumber, t.ProductId, NULL, NULL, NULL, N'NO WARRANTY',
           (SELECT COUNT(*) FROM cj.ServiceTickets t2
            WHERE t2.IsDeleted=0 AND t2.CustomerId=t.CustomerId AND t2.SerialNumber=t.SerialNumber)
    FROM cj.ServiceTickets t
    WHERE t.IsDeleted = 0 AND t.CustomerId = @CustomerAccountId
      AND t.SerialNumber IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM cj.Warranties w2
                      WHERE w2.IsDeleted=0 AND w2.CustomerId=t.CustomerId AND w2.SerialNumber=t.SerialNumber)
    ORDER BY SerialNumber;
END
GO

/* ===========================================================================
   WARRANTY TAB  (reuse cj.Warranties + open service tickets on the same serial)
   =========================================================================== */
CREATE OR ALTER PROCEDURE cj.usp_Customer360_Warranty @CustomerAccountId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        w.WarrantyNumber, w.SerialNumber, w.MachineModel, w.ProductId, w.SalesInvoiceId,
        w.StartDate, w.EndDate, w.Status, w.Notes,
        IsCurrentlyValid = CASE WHEN w.Status = 'ACTIVE' AND (w.EndDate IS NULL OR w.EndDate >= CAST(SYSDATETIME() AS DATE))
                                THEN 1 ELSE 0 END,
        OpenTickets = (SELECT COUNT(*) FROM cj.ServiceTickets t
                       WHERE t.IsDeleted=0 AND t.CustomerId = w.CustomerId
                         AND t.SerialNumber = w.SerialNumber
                         AND t.Status NOT IN ('CLOSED','CANCELLED'))
    FROM cj.Warranties w
    WHERE w.CustomerId = @CustomerAccountId AND w.IsDeleted = 0
    ORDER BY w.EndDate DESC;
END
GO

PRINT N'PHASE A Customer 360 tabs created: Financial (ledger+running balance),';
PRINT N'Sales (quotation/order/invoice), Machines (warranty/serial registry), Warranty.';
PRINT N'All read-only over canonical COLORJET_ERP tables — no new master table.';
GO
