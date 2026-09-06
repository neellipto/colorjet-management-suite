/* =============================================================================
   COLORJET ERP — PHASE A (CORRECTED, REUSE-BASED)  Microsoft SQL Server
   Customer Portal linkage + Customer 360 read layer over the EXISTING masters.
   -----------------------------------------------------------------------------
   Result of the schema audit against the live COLORJET_ERP DB. Confirmed
   canonical masters (REUSED, never duplicated):

     * Users / auth / RBAC : dbo.AspNetUsers (+ AspNetRoles/UserRoles, and the
       inline AspNetUsers.Permissions column). User->Employee = AspNetUsers.EmployeeId.
     * Customer master      : dbo.Accounts  (party master; GroupId -> dbo.AccountGroups
                              classifies Customer vs Supplier). Financial columns
                              InvoiceAmount / InvoicePaid / OpeningBalance live here.
     * Employee             : dbo.Employees ;  Engineer : cj.Engineers (UserId + EmployeeId)
     * Service              : cj.ServiceTickets (+ ServiceTicketParts/History)
     * RMA / Warranty       : cj.RmaCases*, cj.Warranties*

   Therefore files 05_identity_rbac_portal.sql and 06_phaseA_customer_module.sql
   are SUPERSEDED and must NOT be deployed to COLORJET_ERP — they would create a
   parallel identity/customer/service master (exactly what the spec forbids).
   This file is the correct Phase A: it adds ONLY the genuine gap (a customer
   portal-login link to the canonical Account) and read-only 360 objects.

   Follows the existing cj.* conventions (uniqueidentifier Id, BranchId,
   CreatedAtUtc/CreatedBy, UpdatedAtUtc/UpdatedBy, IsDeleted, RowVersion).

   ⚠️ Column names for the transaction tabs (invoices/payments/quotations) must
   be confirmed from their own tables before the read procs are finalized; this
   file delivers the parts fully verified by the audit (portal link, customer
   master view, portal-account 360 proc). Idempotent.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===========================================================================
   1. GENUINE GAP — Customer Portal account link (AspNetUsers <-> Accounts)
   One canonical customer (dbo.Accounts) may have ONE portal login
   (dbo.AspNetUsers). No second customer, no second user store.
   =========================================================================== */
IF OBJECT_ID(N'cj.CustomerPortalAccounts', N'U') IS NULL
BEGIN
    CREATE TABLE cj.CustomerPortalAccounts
    (
        Id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_cpa_id DEFAULT NEWSEQUENTIALID(),
        UserId            NVARCHAR(450)    NOT NULL,   -- FK dbo.AspNetUsers.Id (nvarchar(450) — must match exactly)
        CustomerAccountId UNIQUEIDENTIFIER NOT NULL,   -- FK dbo.Accounts.Id (canonical customer)
        Status            VARCHAR(24)      NOT NULL CONSTRAINT DF_cpa_status DEFAULT ('ACTIVE'),
        AllowedPermissions NVARCHAR(MAX)   NULL,       -- optional portal-scoped permission set (JSON)
        LastLoginAtUtc    DATETIME2        NULL,
        BranchId          UNIQUEIDENTIFIER NULL,
        IsActive          BIT              NOT NULL CONSTRAINT DF_cpa_active DEFAULT (1),
        IsDeleted         BIT              NOT NULL CONSTRAINT DF_cpa_del DEFAULT (0),
        CreatedAtUtc      DATETIME2        NOT NULL CONSTRAINT DF_cpa_ca DEFAULT (SYSUTCDATETIME()),
        CreatedBy         NVARCHAR(900)    NULL,
        UpdatedAtUtc      DATETIME2        NULL,
        UpdatedBy         NVARCHAR(900)    NULL,
        RowVersion        ROWVERSION,
        CONSTRAINT PK_CustomerPortalAccounts PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT CK_cpa_status CHECK (Status IN
            ('ACTIVE','INACTIVE','LOCKED','INVITED','INVITE_EXPIRED','PASSWORD_CHANGE_REQUIRED','REVOKED')),
        CONSTRAINT FK_cpa_user     FOREIGN KEY (UserId)            REFERENCES dbo.AspNetUsers (Id),
        CONSTRAINT FK_cpa_customer FOREIGN KEY (CustomerAccountId) REFERENCES dbo.Accounts (Id)
    );
    -- one portal login per canonical customer; one customer per login
    CREATE UNIQUE INDEX UX_cpa_customer ON cj.CustomerPortalAccounts (CustomerAccountId) WHERE IsDeleted = 0;
    CREATE UNIQUE INDEX UX_cpa_user     ON cj.CustomerPortalAccounts (UserId)            WHERE IsDeleted = 0;
END
GO

/* Secure invitation / password-setup (hashed one-time token; plaintext never stored) */
IF OBJECT_ID(N'cj.CustomerPortalInvitations', N'U') IS NULL
BEGIN
    CREATE TABLE cj.CustomerPortalInvitations
    (
        Id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_cpi_id DEFAULT NEWSEQUENTIALID(),
        PortalAccountId   UNIQUEIDENTIFIER NOT NULL,
        Purpose           VARCHAR(24)      NOT NULL CONSTRAINT DF_cpi_purpose DEFAULT ('PORTAL_SETUP'),
        TokenHash         NVARCHAR(256)    NOT NULL,
        Channel           VARCHAR(12)      NULL,       -- EMAIL/SMS/MANUAL
        Status            VARCHAR(12)      NOT NULL CONSTRAINT DF_cpi_status DEFAULT ('PENDING'),
        ExpiresAtUtc      DATETIME2        NOT NULL,
        ConsumedAtUtc     DATETIME2        NULL,
        CreatedAtUtc      DATETIME2        NOT NULL CONSTRAINT DF_cpi_ca DEFAULT (SYSUTCDATETIME()),
        CreatedBy         NVARCHAR(900)    NULL,
        RowVersion        ROWVERSION,
        CONSTRAINT PK_CustomerPortalInvitations PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT CK_cpi_purpose CHECK (Purpose IN ('PORTAL_SETUP','PASSWORD_RESET')),
        CONSTRAINT CK_cpi_status  CHECK (Status  IN ('PENDING','CONSUMED','EXPIRED','REVOKED')),
        CONSTRAINT FK_cpi_account FOREIGN KEY (PortalAccountId) REFERENCES cj.CustomerPortalAccounts (Id)
    );
    CREATE INDEX IX_cpi_account ON cj.CustomerPortalInvitations (PortalAccountId, Status);
END
GO

/* Portal-account audit (create/activate/deactivate/reset/permission changes) */
IF OBJECT_ID(N'cj.CustomerPortalAudit', N'U') IS NULL
BEGIN
    CREATE TABLE cj.CustomerPortalAudit
    (
        Id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_cpaud_id DEFAULT NEWSEQUENTIALID(),
        PortalAccountId   UNIQUEIDENTIFIER NULL,
        CustomerAccountId UNIQUEIDENTIFIER NULL,
        Action            VARCHAR(48)      NOT NULL,   -- CREATE/ACTIVATE/DEACTIVATE/RESET_PASSWORD/REVOKE_SESSIONS/EDIT_LOGIN/PERMISSION_CHANGE
        BeforeJson        NVARCHAR(MAX)    NULL,
        AfterJson         NVARCHAR(MAX)    NULL,
        PerformedBy       NVARCHAR(900)    NULL,
        PerformedAtUtc    DATETIME2        NOT NULL CONSTRAINT DF_cpaud_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_CustomerPortalAudit PRIMARY KEY NONCLUSTERED (Id)
    );
    CREATE INDEX IX_cpaud_customer ON cj.CustomerPortalAudit (CustomerAccountId, PerformedAtUtc DESC);
END
GO

/* ===========================================================================
   2. CANONICAL CUSTOMER MASTER VIEW  (reuse dbo.Accounts, no new master)
   Customers are Accounts whose group is a customer group. Adjust the group
   filter to your real customer AccountGroup name(s) if different.
   =========================================================================== */
CREATE OR ALTER VIEW cj.vw_CustomerMaster AS
    SELECT
        CustomerId   = a.Id,
        Code         = a.Code,
        Name         = a.Name,
        ContactPerson= a.ContactPerson,
        Mobile       = a.ContactNo,
        Email        = a.Email,
        Address      = a.Address,
        AreaId       = a.AreaId,
        DistrictId   = a.DistrictId,
        ThanaId      = a.ThanaId,
        CustomerType = a.CustomerType,
        SalesEmployeeId = a.EmployeeId,
        OpeningBalance  = ISNULL(a.OpeningBalance,0),
        InvoiceAmount   = ISNULL(a.InvoiceAmount,0),
        InvoicePaid     = ISNULL(a.InvoicePaid,0),
        CurrentDue      = (ISNULL(a.InvoiceAmount,0) - ISNULL(a.InvoicePaid,0)),
        BranchId     = a.BranchId,
        GroupId      = a.GroupId,
        GroupName    = g.Name,
        IsDeleted    = a.IsDeleted
    FROM dbo.Accounts a
    LEFT JOIN dbo.AccountGroups g ON g.Id = a.GroupId
    WHERE a.IsDeleted = 0
      AND (g.Name LIKE '%Customer%' OR a.GroupName LIKE '%Customer%');
GO

/* ===========================================================================
   3. CUSTOMER 360 — Portal Account tab (fully audited canonical join)
   =========================================================================== */
CREATE OR ALTER PROCEDURE cj.usp_Customer360_Portal @CustomerAccountId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        PortalAccountId = p.Id,
        p.Status,
        UserId       = u.Id,
        Login        = u.UserName,
        Email        = u.Email,
        Mobile       = u.PhoneNumber,
        EmailConfirmed = u.EmailConfirmed,
        LockoutEnabled = u.LockoutEnabled,
        LockoutEnd     = u.LockoutEnd,
        AccessFailedCount = u.AccessFailedCount,
        p.LastLoginAtUtc,
        p.AllowedPermissions
    FROM cj.CustomerPortalAccounts p
    JOIN dbo.AspNetUsers u ON u.Id = p.UserId
    WHERE p.CustomerAccountId = @CustomerAccountId AND p.IsDeleted = 0;
END
GO

/* Customer 360 header/summary from the canonical Account (financial from Accounts) */
CREATE OR ALTER PROCEDURE cj.usp_Customer360_Header @CustomerAccountId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        m.CustomerId, m.Code, m.Name, m.Mobile, m.Email, m.Address, m.CustomerType, m.BranchId,
        /* derived from real invoices/receipts — Accounts.InvoiceAmount can be NULL */
        TotalInvoiced = ISNULL((SELECT SUM(CAST(TotalAmount AS DECIMAL(18,2))) FROM dbo.SalesInvoiceGenerations WHERE IsDeleted=0 AND PartyId=m.CustomerId),0),
        TotalPaid     = ISNULL((SELECT SUM(CAST(ReceiptAmount AS DECIMAL(18,2))) FROM dbo.TradingReceipts WHERE IsDeleted=0 AND PartyId=m.CustomerId),0),
        CurrentDue    = ISNULL((SELECT SUM(CAST(DueAmount AS DECIMAL(18,2))) FROM dbo.SalesInvoiceGenerations WHERE IsDeleted=0 AND PartyId=m.CustomerId),0),
        OpenTickets = (SELECT COUNT(*) FROM cj.ServiceTickets t
                       WHERE t.CustomerId = m.CustomerId AND t.IsDeleted = 0
                         AND t.Status NOT IN ('CLOSED','CANCELLED')),
        PortalStatus = (SELECT TOP 1 Status FROM cj.CustomerPortalAccounts
                        WHERE CustomerAccountId = m.CustomerId AND IsDeleted = 0)
    FROM cj.vw_CustomerMaster m
    WHERE m.CustomerId = @CustomerAccountId;
END
GO

/* Customer 360 Service tab — REUSE cj.ServiceTickets (no new service table) */
CREATE OR ALTER PROCEDURE cj.usp_Customer360_Service @CustomerAccountId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT t.Id, t.TicketNumber, t.MachineName, t.MachineModel, t.SerialNumber,
           t.ProblemDescription, t.Priority, t.Status, t.AssignedEngineerId,
           t.ScheduledDate, t.VisitDate, t.GrandTotal, t.PaidAmount, t.PaymentStatus,
           t.CreatedAtUtc
    FROM cj.ServiceTickets t
    WHERE t.CustomerId = @CustomerAccountId AND t.IsDeleted = 0
    ORDER BY t.CreatedAtUtc DESC;
END
GO

PRINT N'PHASE A (reuse) created: cj.CustomerPortalAccounts / Invitations / Audit,';
PRINT N'cj.vw_CustomerMaster (over dbo.Accounts), and Customer360 Header/Portal/Service procs.';
PRINT N'Files 05 and 06 are SUPERSEDED — do NOT deploy them (they duplicate canonical masters).';
GO
