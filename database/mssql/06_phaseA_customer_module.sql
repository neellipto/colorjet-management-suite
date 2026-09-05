/* =============================================================================
   COLORJET ERP — PHASE A : CUSTOMER ACCOUNT / CUSTOMER 360  (Microsoft SQL Server)
   -----------------------------------------------------------------------------
   Master Build, Phase A. Continues the EXISTING COLORJET_ERP database — it does
   NOT create a second customer master. The canonical customer is the existing
   ERP record (mirrored read-only in report.customers, which carries the unique
   odoo_id / canonical key). Everything here is ADDITIVE customer-module data
   (documents, communications, notes, portal audit, credit-limit history) plus
   the Customer 360 read procedures for each 360 tab.

   Follows the module DATABASE RULES: every operational table carries
   BranchId, CompanyId, CreatedBy/CreatedDate, UpdatedBy/UpdatedDate, Status,
   IsActive, IsDeleted, and RowVersion (optimistic concurrency); PK/FK/UNIQUE/
   CHECK/indexes; immutable history; soft-delete only (no hard delete of
   business/financial/service history).

   REUSE (not duplicated): report.customers, report.sales_invoices,
   report.payments, report.sales_orders, report.sales_invoice_lines,
   assets.machines, service.* , identity.* (portal accounts & audit).

   ⚠️ Reuse/extend of the LIVE ERP tables must be reconciled against the real
   COLORJET_ERP schema first (see PHASE_A_ACCEPTANCE.md "schema audit"). Object
   names below are the reporting-mirror model; map them to the production tables
   during the audit before deploying to the live database.

   Run after 01..05. Idempotent. SQL Server 2019+ / Azure SQL.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF SCHEMA_ID(N'customer') IS NULL EXEC (N'CREATE SCHEMA [customer] AUTHORIZATION [dbo];');
GO

/* ===========================================================================
   ADDITIVE CUSTOMER-MODULE TABLES  (full production conventions)
   =========================================================================== */

/* --- Customer notes (Overview tab: important notes) ------------------------ */
IF OBJECT_ID(N'customer.notes', N'U') IS NULL
BEGIN
    CREATE TABLE customer.notes
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_cnotes_id DEFAULT NEWSEQUENTIALID(),
        CustomerId   UNIQUEIDENTIFIER NOT NULL,
        BranchId     BIGINT           NULL,
        CompanyId    BIGINT           NULL,
        Body         NVARCHAR(2000)   NOT NULL,
        IsPinned     BIT              NOT NULL CONSTRAINT DF_cnotes_pin DEFAULT (0),
        Status       NVARCHAR(32)     NOT NULL CONSTRAINT DF_cnotes_status DEFAULT (N'ACTIVE'),
        IsActive     BIT              NOT NULL CONSTRAINT DF_cnotes_active DEFAULT (1),
        IsDeleted    BIT              NOT NULL CONSTRAINT DF_cnotes_del DEFAULT (0),
        CreatedBy    UNIQUEIDENTIFIER NULL,
        CreatedDate  DATETIME2(3)     NOT NULL CONSTRAINT DF_cnotes_cd DEFAULT (SYSUTCDATETIME()),
        UpdatedBy    UNIQUEIDENTIFIER NULL,
        UpdatedDate  DATETIME2(3)     NULL,
        RowVersion   ROWVERSION,
        CONSTRAINT PK_customer_notes PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT FK_cnotes_customer FOREIGN KEY (CustomerId) REFERENCES report.customers (id)
    );
    CREATE INDEX IX_cnotes_customer ON customer.notes (CustomerId) WHERE IsDeleted = 0;
END
GO

/* --- Customer documents (tab 9: Documents / Document Vault link) ------------ */
IF OBJECT_ID(N'customer.documents', N'U') IS NULL
BEGIN
    CREATE TABLE customer.documents
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_cdoc_id DEFAULT NEWSEQUENTIALID(),
        CustomerId   UNIQUEIDENTIFIER NOT NULL,
        BranchId     BIGINT           NULL,
        CompanyId    BIGINT           NULL,
        DocType      NVARCHAR(64)     NOT NULL,   -- QUOTATION/INVOICE/RECEIPT/STATEMENT/DELIVERY/INSTALLATION/SERVICE/WARRANTY/AGREEMENT/ID/OTHER
        Title        NVARCHAR(256)    NOT NULL,
        FileRef      NVARCHAR(512)    NULL,       -- storage reference / path
        MimeType     NVARCHAR(128)    NULL,
        SizeBytes    BIGINT           NULL,
        RelatedType  NVARCHAR(64)     NULL,       -- INVOICE/RECEIPT/TICKET/... for clickable related-record
        RelatedId    UNIQUEIDENTIFIER NULL,
        Status       NVARCHAR(32)     NOT NULL CONSTRAINT DF_cdoc_status DEFAULT (N'ACTIVE'),
        IsActive     BIT              NOT NULL CONSTRAINT DF_cdoc_active DEFAULT (1),
        IsDeleted    BIT              NOT NULL CONSTRAINT DF_cdoc_del DEFAULT (0),
        CreatedBy    UNIQUEIDENTIFIER NULL,
        CreatedDate  DATETIME2(3)     NOT NULL CONSTRAINT DF_cdoc_cd DEFAULT (SYSUTCDATETIME()),
        UpdatedBy    UNIQUEIDENTIFIER NULL,
        UpdatedDate  DATETIME2(3)     NULL,
        RowVersion   ROWVERSION,
        CONSTRAINT PK_customer_documents PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT FK_cdoc_customer FOREIGN KEY (CustomerId) REFERENCES report.customers (id)
    );
    CREATE INDEX IX_cdoc_customer ON customer.documents (CustomerId, DocType) WHERE IsDeleted = 0;
END
GO

/* --- Customer communication log (tab 10: SMS/Email/WhatsApp/Portal) -------- */
IF OBJECT_ID(N'customer.communications', N'U') IS NULL
BEGIN
    CREATE TABLE customer.communications
    (
        Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ccom_id DEFAULT NEWSEQUENTIALID(),
        CustomerId     UNIQUEIDENTIFIER NOT NULL,
        BranchId       BIGINT           NULL,
        CompanyId      BIGINT           NULL,
        Channel        NVARCHAR(16)     NOT NULL,  -- SMS/EMAIL/WHATSAPP/PORTAL
        EventType      NVARCHAR(64)     NULL,
        Recipient      NVARCHAR(256)    NULL,
        Provider       NVARCHAR(64)     NULL,
        ProviderMsgId  NVARCHAR(128)    NULL,
        SubmittedAt    DATETIME2(3)     NULL,
        DeliveryStatus NVARCHAR(32)     NOT NULL CONSTRAINT DF_ccom_dstatus DEFAULT (N'SUBMITTED'), -- SUBMITTED/DELIVERED/FAILED
        ErrorText      NVARCHAR(512)    NULL,
        RelatedType    NVARCHAR(64)     NULL,
        RelatedId      UNIQUEIDENTIFIER NULL,
        IsActive       BIT              NOT NULL CONSTRAINT DF_ccom_active DEFAULT (1),
        IsDeleted      BIT              NOT NULL CONSTRAINT DF_ccom_del DEFAULT (0),
        CreatedBy      UNIQUEIDENTIFIER NULL,
        CreatedDate    DATETIME2(3)     NOT NULL CONSTRAINT DF_ccom_cd DEFAULT (SYSUTCDATETIME()),
        RowVersion     ROWVERSION,
        CONSTRAINT PK_customer_communications PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT CK_ccom_channel CHECK (Channel IN (N'SMS',N'EMAIL',N'WHATSAPP',N'PORTAL')),
        CONSTRAINT CK_ccom_dstatus CHECK (DeliveryStatus IN (N'SUBMITTED',N'DELIVERED',N'FAILED')),
        CONSTRAINT FK_ccom_customer FOREIGN KEY (CustomerId) REFERENCES report.customers (id)
    );
    CREATE INDEX IX_ccom_customer ON customer.communications (CustomerId, CreatedDate DESC) WHERE IsDeleted = 0;
END
GO

/* --- Credit-limit change history (immutable; Audit tab) -------------------- */
IF OBJECT_ID(N'customer.credit_limit_history', N'U') IS NULL
BEGIN
    CREATE TABLE customer.credit_limit_history
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_clh_id DEFAULT NEWSEQUENTIALID(),
        CustomerId   UNIQUEIDENTIFIER NOT NULL,
        OldLimit     DECIMAL(18,2)    NULL,
        NewLimit     DECIMAL(18,2)    NOT NULL,
        Reason       NVARCHAR(512)    NULL,
        ChangedBy    UNIQUEIDENTIFIER NULL,
        ChangedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_clh_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_customer_credit_limit_history PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT FK_clh_customer FOREIGN KEY (CustomerId) REFERENCES report.customers (id)
    );
    CREATE INDEX IX_clh_customer ON customer.credit_limit_history (CustomerId, ChangedAt DESC);
END
GO

/* --- Customer 360 audit log (tab 12: who/when/action/before/after) --------- */
IF OBJECT_ID(N'customer.audit_log', N'U') IS NULL
BEGIN
    CREATE TABLE customer.audit_log
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_caud_id DEFAULT NEWSEQUENTIALID(),
        CustomerId   UNIQUEIDENTIFIER NOT NULL,
        Action       NVARCHAR(128)    NOT NULL,   -- CREATED/UPDATED/CREDIT_LIMIT_CHANGE/PORTAL_CREATE/PORTAL_RESET/DOC_UPLOAD/...
        Area         NVARCHAR(64)     NULL,       -- PROFILE/FINANCIAL/PORTAL/DOCUMENT
        BeforeJson   NVARCHAR(MAX)    NULL,
        AfterJson    NVARCHAR(MAX)    NULL,
        RelatedRef   NVARCHAR(128)    NULL,
        PerformedBy  UNIQUEIDENTIFIER NULL,
        PerformedAt  DATETIME2(3)     NOT NULL CONSTRAINT DF_caud_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_customer_audit_log PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT FK_caud_customer FOREIGN KEY (CustomerId) REFERENCES report.customers (id)
    );
    CREATE INDEX IX_caud_customer ON customer.audit_log (CustomerId, PerformedAt DESC);
END
GO

/* ===========================================================================
   CUSTOMER LEDGER  (tab 2: Financial — running balance from canonical txns)
   =========================================================================== */
CREATE OR ALTER VIEW customer.v_ledger AS
    WITH txns AS (
        SELECT customer_id, txn_date = invoice_date, reference = invoice_number,
               txn_type = N'Invoice', debit = amount_total, credit = CAST(0 AS DECIMAL(18,2)),
               sort_key = 1
        FROM report.sales_invoices WHERE state = N'posted'
        UNION ALL
        SELECT customer_id, txn_date = payment_date, reference = payment_reference,
               txn_type = N'Payment', debit = CAST(0 AS DECIMAL(18,2)), credit = amount,
               sort_key = 2
        FROM report.payments WHERE direction = N'inbound'
    )
    SELECT
        customer_id, txn_date, reference, txn_type, debit, credit,
        running_balance = SUM(debit - credit) OVER (
            PARTITION BY customer_id ORDER BY txn_date, sort_key
            ROWS UNBOUNDED PRECEDING)
    FROM txns;
GO

/* ===========================================================================
   CUSTOMER LIST  (filters + search per spec)
   =========================================================================== */
CREATE OR ALTER PROCEDURE customer.usp_customer_list
    @Filter NVARCHAR(32) = N'ALL',   -- ALL/ACTIVE/INACTIVE/DUE/OVERDUE/NO_DUE/PORTAL_ENABLED
    @Search NVARCHAR(128) = NULL,
    @PageNumber INT = 0, @PageSize INT = 50
AS
BEGIN SET NOCOUNT ON;
    ;WITH base AS (
        SELECT
            c.id, c.code, c.name, c.phone, c.email, c.address, c.credit_limit, c.is_active,
            current_due   = (SELECT ISNULL(SUM(amount_due),0) FROM report.sales_invoices i WHERE i.customer_id=c.id AND i.state=N'posted' AND i.amount_due>0),
            last_sale     = (SELECT MAX(invoice_date) FROM report.sales_invoices i WHERE i.customer_id=c.id AND i.state=N'posted'),
            last_payment  = (SELECT MAX(payment_date) FROM report.payments p WHERE p.customer_id=c.id AND p.direction=N'inbound'),
            portal_status = (SELECT TOP 1 portal_status FROM identity.user_customer_links l WHERE l.customer_id=c.id)
        FROM report.customers c
    )
    SELECT *
    FROM base
    WHERE (@Search IS NULL OR name LIKE '%'+@Search+'%' OR code LIKE '%'+@Search+'%'
           OR phone LIKE '%'+@Search+'%' OR email LIKE '%'+@Search+'%')
      AND (@Filter <> N'ACTIVE'         OR is_active = 1)
      AND (@Filter <> N'INACTIVE'       OR is_active = 0)
      AND (@Filter <> N'DUE'            OR current_due > 0)
      AND (@Filter <> N'NO_DUE'         OR current_due = 0)
      AND (@Filter <> N'PORTAL_ENABLED' OR portal_status IS NOT NULL)
    ORDER BY name
    OFFSET (@PageNumber * @PageSize) ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* ===========================================================================
   CUSTOMER 360  — one procedure per tab (read-only aggregation)
   =========================================================================== */

/* Tab 1: Overview + top summary */
CREATE OR ALTER PROCEDURE customer.usp_360_overview @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        c.id, c.code, c.name, c.phone, c.email, c.address, c.credit_limit, c.is_active,
        total_sales      = (SELECT ISNULL(SUM(amount_total),0) FROM report.sales_invoices WHERE customer_id=c.id AND state=N'posted'),
        total_paid       = (SELECT ISNULL(SUM(amount),0)       FROM report.payments       WHERE customer_id=c.id AND direction=N'inbound'),
        current_due      = (SELECT ISNULL(SUM(amount_due),0)   FROM report.sales_invoices WHERE customer_id=c.id AND state=N'posted' AND amount_due>0),
        open_tickets     = (SELECT COUNT(*) FROM service.service_requests WHERE customer_id=c.id AND status NOT IN (N'CLOSED',N'CANCELLED')),
        machines         = (SELECT COUNT(*) FROM assets.machines WHERE customer_id=c.id),
        portal_status    = (SELECT TOP 1 portal_status FROM identity.user_customer_links WHERE customer_id=c.id),
        pinned_note      = (SELECT TOP 1 Body FROM customer.notes WHERE CustomerId=c.id AND IsDeleted=0 AND IsPinned=1 ORDER BY CreatedDate DESC)
    FROM report.customers c WHERE c.id=@CustomerId;
END
GO

/* Tab 2: Financial ledger (running balance) */
CREATE OR ALTER PROCEDURE customer.usp_360_financial @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT txn_date, reference, txn_type, debit, credit, running_balance
    FROM customer.v_ledger WHERE customer_id=@CustomerId
    ORDER BY txn_date, txn_type;
END
GO

/* Tab 3: Sales (orders + invoices) */
CREATE OR ALTER PROCEDURE customer.usp_360_sales @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT kind=N'ORDER',   ref=order_number,   dt=order_date,   total=amount_total, paid=CAST(0 AS DECIMAL(18,2)), due=CAST(0 AS DECIMAL(18,2)), status
      FROM report.sales_orders   WHERE customer_id=@CustomerId
    UNION ALL
    SELECT kind=N'INVOICE', ref=invoice_number, dt=invoice_date, total=amount_total, paid=amount_paid, due=amount_due, state
      FROM report.sales_invoices WHERE customer_id=@CustomerId AND state=N'posted'
    ORDER BY dt DESC;
END
GO

/* Tab 4: Machines / installations */
CREATE OR ALTER PROCEDURE customer.usp_360_machines @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT id, model, serial_no, sale_invoice_id, delivered_date, installed_date, warranty_end, status
    FROM assets.machines WHERE customer_id=@CustomerId ORDER BY delivered_date DESC;
END
GO

/* Tab 6: Service (tickets + engineer jobs) */
CREATE OR ALTER PROCEDURE customer.usp_360_service @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT source=N'REQUEST', ref=request_no, dt=created_at, status, problem
      FROM service.service_requests WHERE customer_id=@CustomerId
    UNION ALL
    SELECT source=N'JOB', ref=job_no, dt=created_at, status, diagnosis
      FROM service.engineer_jobs WHERE customer_id=@CustomerId
    ORDER BY dt DESC;
END
GO

/* Tab 9: Documents */
CREATE OR ALTER PROCEDURE customer.usp_360_documents @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT Id, DocType, Title, FileRef, RelatedType, RelatedId, CreatedDate
    FROM customer.documents WHERE CustomerId=@CustomerId AND IsDeleted=0
    ORDER BY CreatedDate DESC;
END
GO

/* Tab 10: Communication */
CREATE OR ALTER PROCEDURE customer.usp_360_communications @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT Id, Channel, EventType, Recipient, Provider, ProviderMsgId, SubmittedAt, DeliveryStatus, ErrorText, CreatedDate
    FROM customer.communications WHERE CustomerId=@CustomerId AND IsDeleted=0
    ORDER BY CreatedDate DESC;
END
GO

/* Tab 11: Portal account status */
CREATE OR ALTER PROCEDURE customer.usp_360_portal @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT u.id AS user_id, u.username, u.email, u.mobile, u.status AS user_status,
           l.portal_status, u.last_login_at, u.force_password_change
    FROM identity.user_customer_links l
    JOIN identity.users u ON u.id = l.user_id
    WHERE l.customer_id = @CustomerId;
END
GO

/* Tab 12: Audit (profile/credit/portal/document changes) */
CREATE OR ALTER PROCEDURE customer.usp_360_audit @CustomerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT PerformedAt, Action, Area, RelatedRef, PerformedBy, BeforeJson, AfterJson
    FROM customer.audit_log WHERE CustomerId=@CustomerId
    UNION ALL
    SELECT ChangedAt, N'CREDIT_LIMIT_CHANGE', N'FINANCIAL',
           CONCAT(FORMAT(OldLimit,'0.00'),' -> ',FORMAT(NewLimit,'0.00')), ChangedBy, NULL, Reason
    FROM customer.credit_limit_history WHERE CustomerId=@CustomerId
    ORDER BY 1 DESC;
END
GO

PRINT N'PHASE A Customer module created: customer.* tables (conventions + history + audit),';
PRINT N'v_ledger, usp_customer_list, and usp_360_* per-tab procedures.';
PRINT N'NOTE: reconcile REUSED report.*/identity.*/service.*/assets.* names with the live';
PRINT N'COLORJET_ERP schema (schema audit) before deploying to production.';
GO
