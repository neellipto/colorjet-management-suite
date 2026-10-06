/* =============================================================================
   COLORJET ERP — PHASE B : Engineer 360 (Header / Tickets / Parts)
   Microsoft SQL Server. REUSE ONLY — no new table, no new index.
   -----------------------------------------------------------------------------
   Bound to audited canonical tables (columns + FKs confirmed against the
   live COLORJET_ERP schema before writing this file):
     * cj.Engineers          : Id, EngineerCode, FullName, Phone, Email,
                                Specialization, IsActive, BranchId, EmployeeId
     * cj.ServiceTickets      : AssignedEngineerId -> cj.Engineers.Id,
                                Status -> cj.ServiceTicketStatus.Code,
                                CustomerId -> dbo.Accounts.Id
     * cj.ServiceTicketStatus : Code, DisplayName, SortOrder, IsTerminal
     * cj.ServiceTicketParts  : TicketId -> cj.ServiceTickets.Id,
                                ProductId -> dbo.Products.Id
     * dbo.Accounts           : Id, Name  (customer name on a ticket)
     * dbo.Products           : Id, Code, Name (part name on a ticket)

   All read-only. @EngineerId is the canonical cj.Engineers.Id. Apply into
   COLORJET_ERP after Phase A (07/08/09). Idempotent (CREATE OR ALTER).
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ===========================================================================
   HEADER — engineer profile + workload/revenue stats (from cj.ServiceTickets,
   status terminality from the canonical cj.ServiceTicketStatus lookup)
   =========================================================================== */
CREATE OR ALTER PROCEDURE cj.usp_Engineer360_Header @EngineerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        e.Id, e.EngineerCode, e.FullName, e.Phone, e.Email, e.Specialization,
        e.IsActive, e.BranchId,
        TotalTickets  = (SELECT COUNT(*) FROM cj.ServiceTickets t
                         WHERE t.AssignedEngineerId = e.Id AND t.IsDeleted = 0),
        OpenTickets   = (SELECT COUNT(*) FROM cj.ServiceTickets t
                         JOIN cj.ServiceTicketStatus st ON st.Code = t.Status
                         WHERE t.AssignedEngineerId = e.Id AND t.IsDeleted = 0
                           AND st.IsTerminal = 0),
        ClosedTickets = (SELECT COUNT(*) FROM cj.ServiceTickets t
                         JOIN cj.ServiceTicketStatus st ON st.Code = t.Status
                         WHERE t.AssignedEngineerId = e.Id AND t.IsDeleted = 0
                           AND st.IsTerminal = 1),
        TotalRevenueCollected = ISNULL((SELECT SUM(CAST(t.PaidAmount AS DECIMAL(18,2)))
                         FROM cj.ServiceTickets t
                         WHERE t.AssignedEngineerId = e.Id AND t.IsDeleted = 0), 0),
        TotalGrandTotal = ISNULL((SELECT SUM(CAST(t.GrandTotal AS DECIMAL(18,2)))
                         FROM cj.ServiceTickets t
                         WHERE t.AssignedEngineerId = e.Id AND t.IsDeleted = 0), 0)
    FROM cj.Engineers e
    WHERE e.Id = @EngineerId AND e.IsDeleted = 0;
END
GO

/* ===========================================================================
   TICKETS — every service ticket assigned to this engineer, with the
   canonical customer name (dbo.Accounts) joined in, newest first
   =========================================================================== */
CREATE OR ALTER PROCEDURE cj.usp_Engineer360_Tickets @EngineerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        t.Id, t.TicketNumber,
        CustomerId   = t.CustomerId,
        CustomerName = a.Name,
        t.MachineModel, t.SerialNumber, t.Priority, t.Status,
        t.ScheduledDate, t.VisitDate,
        GrandTotal  = CAST(t.GrandTotal AS DECIMAL(18,2)),
        PaidAmount  = CAST(t.PaidAmount AS DECIMAL(18,2)),
        t.PaymentStatus, t.CreatedAtUtc
    FROM cj.ServiceTickets t
    LEFT JOIN dbo.Accounts a ON a.Id = t.CustomerId
    WHERE t.AssignedEngineerId = @EngineerId AND t.IsDeleted = 0
    ORDER BY t.CreatedAtUtc DESC;
END
GO

/* ===========================================================================
   PARTS — parts consumed across every ticket assigned to this engineer,
   with the canonical product name (dbo.Products) joined in
   =========================================================================== */
CREATE OR ALTER PROCEDURE cj.usp_Engineer360_Parts @EngineerId UNIQUEIDENTIFIER AS
BEGIN SET NOCOUNT ON;
    SELECT
        p.Id, p.TicketId, TicketNumber = t.TicketNumber,
        ProductId = p.ProductId, ProductCode = pr.Code, ProductName = pr.Name,
        p.Quantity,
        UnitPrice  = CAST(p.UnitPrice AS DECIMAL(18,2)),
        LineTotal  = CAST(p.LineTotal AS DECIMAL(18,2)),
        p.IsReturned, p.ReturnedQty, p.IsApproved, p.StockDeducted,
        p.CreatedAtUtc
    FROM cj.ServiceTicketParts p
    JOIN cj.ServiceTickets t ON t.Id = p.TicketId
    LEFT JOIN dbo.Products pr ON pr.Id = p.ProductId
    WHERE t.AssignedEngineerId = @EngineerId AND t.IsDeleted = 0
    ORDER BY p.CreatedAtUtc DESC;
END
GO

PRINT N'PHASE B (reuse) created: cj.usp_Engineer360_Header / _Tickets / _Parts.';
PRINT N'No new table, no new index — pure read-only procs over canonical tables.';
GO
