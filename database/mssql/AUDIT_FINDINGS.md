# COLORJET_ERP — Schema Audit Findings (Phase A)

Audit run against the live `COLORJET_ERP` SQL Server (127.0.0.1,1433). ~250 tables.
This is the mandatory "schema audit" — it fixes what to REUSE vs build, so the new
modules never duplicate an existing master.

## Confirmed canonical masters (REUSE — do not duplicate)

| Concern | Canonical table(s) | Key columns |
|---|---|---|
| User / auth / RBAC | `dbo.AspNetUsers` (+ `AspNetRoles`, `AspNetUserRoles`, `AspNetRoleClaims`) | `Id nvarchar(900)` PK, `UserName`, `Email`, `PasswordHash`, `Permissions` (inline), `UserType`, `EmployeeId`, `BranchId`, lockout fields |
| User → Employee | `dbo.AspNetUsers.EmployeeId` → `dbo.Employees.Id` | already linked |
| Engineer (User→Employee→Engineer) | `cj.Engineers` | `Id`, `UserId`→AspNetUsers, `EmployeeId`→Employees, `EngineerCode`, `Specialization`, RowVersion |
| Customer master | `dbo.Accounts` (party; `GroupId`→`dbo.AccountGroups`) | `Id`, `Name`, `ContactNo`, `Email`, `Address`, `Code`, `CustomerType`, `InvoiceAmount`, `InvoicePaid`, `OpeningBalance`, `EmployeeId`, `BranchId` |
| Employee | `dbo.Employees` | `Id`, `Name`, `Phone`, `DepartmentId`, `DesignationId`, `ShiftId`, `AttendancePIN`, `BranchId` |
| Service ticket + engineer job | `cj.ServiceTickets` (+ `ServiceTicketParts/History/Attachments/Status`) | full: `CustomerId`, `SerialNumber`, `AssignedEngineerId`, `Status`, charges, signatures, `PostedJournalId`, RowVersion |
| RMA | `cj.RmaCases` (+ Movements/StatusHistory/Custody/QC/SerialReplacements) | present |
| Warranty | `cj.Warranties` (+ Claims/Policies) | present |
| Products / stock | `dbo.Products`, `dbo.ProductCurrentStocks`, `dbo.ProductSerials`, `dbo.ProductWarehouses` | present |
| Sales | `dbo.SalesInvoiceGenerations` (+ `SalesInvoiceProducts/Transactions`), `dbo.QuotationGenerations`, `dbo.SalesOrderProcessings` | columns TBC |
| Collections / payments | `dbo.Payments` (+ `PaymentDetails`), `dbo.TradingReceipts` | columns TBC |
| Accounting | `dbo.Accounts`, `dbo.Journals`/`JournalDetails`, `dbo.AccountGroups`, `dbo.AccountCategories` | present |
| Commercial | `cj.ForeignPurchases`, `cj.CnfJobs/CnfAgents`, `cj.LandedCostHeads`, `cj.LcTtRecords` | present |
| Audit | `cj.AuditLog`, plus module history tables | present |

## Key conclusions

1. **~80% of the v3.3 / Master-Build spec is ALREADY in the database** (identity, RBAC,
   engineer chain, service tickets, RMA, warranty, commercial). The real gaps are the
   **Customer Portal login link** and the **frontend**, not the data model.

2. **Two earlier files are SUPERSEDED — do NOT deploy to COLORJET_ERP:**
   - `05_identity_rbac_portal.sql` — would create a 2nd identity/user store (dbo.AspNetUsers already is it).
   - `06_phaseA_customer_module.sql` — would create a 2nd customer/service model (dbo.Accounts + cj.ServiceTickets already are it).
   They remain in the repo only as a reference model for a greenfield reporting DB.

3. **`dbo.CJSRC_*` is a pre-existing parallel layer** (its own users/customers/invoices).
   It is NOT the canonical main-ERP master — do not build new work against it, and treat
   the identity confusion it causes as a separate clean-up item.

4. **The correct Phase A** is `07_phaseA_customer_portal_reuse.sql`: it adds only the
   genuine gap (`cj.CustomerPortalAccounts` linking `dbo.AspNetUsers` ↔ `dbo.Accounts`),
   plus invitations/audit and read-only Customer 360 objects over the canonical tables.

## Still needed to finish Phase A read layer (columns to confirm)
`dbo.SalesInvoiceGenerations`, `dbo.Payments`, `dbo.TradingReceipts`,
`dbo.QuotationGenerations`, `dbo.SalesOrderProcessings`, `cj.Warranties`, `cj.RmaCases`,
`dbo.ProductSerials` — so the Financial / Sales / Machines / Warranty tab procs bind to
the real column names. Then: API routes in the existing auth layer, UI, live UAT.
