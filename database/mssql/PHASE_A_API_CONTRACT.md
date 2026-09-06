# Phase A — Customer 360 API Contract

For the .NET developer to add these as read-only routes in the existing
authenticated API (the one behind `/api/`, same origin per
`colorjet-config.js` → `API_URL: "/api/"`). All seven procs are already
live in `COLORJET_ERP` (applied and verified). Nothing here changes any
existing table or route — these are new, additive, read-only endpoints.

## Security (must enforce in the controller, not just in SQL)
- **Staff users** (existing RBAC/permissions): may pass any `customerAccountId`
  they have permission to view.
- **Customer-portal users** (once `cj.CustomerPortalAccounts` has real rows):
  must NEVER accept `customerAccountId` from the request for this role — look
  it up server-side from `cj.CustomerPortalAccounts.CustomerAccountId` for the
  authenticated `AspNetUsers.Id`, and use that value only. This is the
  customer-isolation guarantee; the SQL procs do not enforce it themselves
  (they trust the caller), so the API layer must.
- All seven procs are `SELECT`-only. No route here should accept writes.

## Suggested routes
Base path suggestion: `/api/customer-360/{customerAccountId}/...`
(adjust the prefix to match the existing controller naming convention —
the shape below is what matters, not the exact path string.)

| Route | Proc | Purpose |
|---|---|---|
| `GET /api/customer-360/{id}/header` | `cj.usp_Customer360_Header` | Summary header for the 360 page |
| `GET /api/customer-360/{id}/portal` | `cj.usp_Customer360_Portal` | Portal login status/link |
| `GET /api/customer-360/{id}/service` | `cj.usp_Customer360_Service` | Service ticket history |
| `GET /api/customer-360/{id}/financial` | `cj.usp_Customer360_Financial` | Financial tab (3 result sets) |
| `GET /api/customer-360/{id}/sales` | `cj.usp_Customer360_Sales` | Sales tab (quotes/orders/invoices) |
| `GET /api/customer-360/{id}/machines` | `cj.usp_Customer360_Machines` | Machines/warranty registry |
| `GET /api/customer-360/{id}/warranty` | `cj.usp_Customer360_Warranty` | Warranty tab |

`{id}` = `dbo.Accounts.Id` (GUID) — the canonical customer key used
everywhere in this schema.

## Response shapes (exact columns returned by each proc)

### `header` → `EXEC cj.usp_Customer360_Header @CustomerAccountId`
Single row:
```json
{
  "customerId": "guid", "code": "string", "name": "string", "mobile": "string",
  "email": "string", "address": "string", "customerType": "string", "branchId": "guid|null",
  "totalInvoiced": 0.0, "totalPaid": 0.0, "currentDue": 0.0,
  "openTickets": 0, "portalStatus": "string|null"
}
```

### `portal` → `EXEC cj.usp_Customer360_Portal @CustomerAccountId`
Zero or one row (customer may not have a portal login yet):
```json
{
  "portalAccountId": "guid", "status": "string", "userId": "string",
  "login": "string", "email": "string", "mobile": "string",
  "emailConfirmed": true, "lockoutEnabled": true, "lockoutEnd": "datetime|null",
  "accessFailedCount": 0, "lastLoginAtUtc": "datetime|null", "allowedPermissions": "json|null"
}
```

### `service` → `EXEC cj.usp_Customer360_Service @CustomerAccountId`
Array, one row per ticket:
```json
{
  "id": "guid", "ticketNumber": "string", "machineName": "string", "machineModel": "string",
  "serialNumber": "string", "problemDescription": "string", "priority": "string",
  "status": "string", "assignedEngineerId": "guid|null", "scheduledDate": "date|null",
  "visitDate": "date|null", "grandTotal": 0.0, "paidAmount": 0.0,
  "paymentStatus": "string", "createdAtUtc": "datetime"
}
```

### `financial` → `EXEC cj.usp_Customer360_Financial @CustomerAccountId`  (3 result sets)
```json
{
  "summary": {
    "totalInvoiced": 0.0, "totalCollected": 0.0, "invoicePaid": 0.0,
    "currentDue": 0.0, "openingBalance": 0.0
  },
  "ledger": [
    { "txnDate": "date", "reference": "string", "txnType": "Invoice|Receipt",
      "debit": 0.0, "credit": 0.0, "runningBalance": 0.0 }
  ],
  "reconciliation": {
    "ledgerClosing": 0.0, "canonicalDue": 0.0, "difference": 0.0,
    "note": "RECONCILED | DIFF: invoice inline-paid amounts not matched by receipt rows (disclosed, not hidden)"
  }
}
```
`summary.currentDue` is the number to show as "amount due" anywhere in the
UI — it is the authoritative per-invoice sum. `reconciliation` is a
diagnostic panel, not the number the customer sees; surface it as a
secondary/collapsed detail (e.g. "ledger vs. due — see note") since a
nonzero `difference` reflects a legacy data-entry pattern (inline
`PaidAmount` on an invoice with no matching `TradingReceipts` row), not a
bug in this API.

### `sales` → `EXEC cj.usp_Customer360_Sales @CustomerAccountId`
Array, one row per quotation/order/invoice, newest first:
```json
{
  "kind": "QUOTATION|ORDER|INVOICE", "recordId": "guid", "ref": "string",
  "dt": "date", "total": 0.0, "paid": 0.0, "due": 0.0,
  "status": "string", "deliveryStatus": "string|null"
}
```
`paid`/`due`/`deliveryStatus` are `null` for QUOTATION and ORDER rows (only
INVOICE rows carry them). `recordId` lets the UI deep-link to the source
record.

### `machines` → `EXEC cj.usp_Customer360_Machines @CustomerAccountId`
Array:
```json
{
  "machineModel": "string", "serialNumber": "string", "productId": "guid|null",
  "salesInvoiceId": "guid|null", "warrantyStart": "date|null", "warrantyEnd": "date|null",
  "warrantyStatus": "string", "serviceCount": 0
}
```
A row with `warrantyStatus: "NO WARRANTY"` and null invoice/date fields
means the serial was seen in service tickets but has no warranty record —
show it, don't hide it (the machine still needs to appear in the tab).

### `warranty` → `EXEC cj.usp_Customer360_Warranty @CustomerAccountId`
Array:
```json
{
  "warrantyNumber": "string", "serialNumber": "string", "machineModel": "string",
  "productId": "guid|null", "salesInvoiceId": "guid|null", "startDate": "date",
  "endDate": "date|null", "status": "string", "notes": "string|null",
  "isCurrentlyValid": true, "openTickets": 0
}
```

## Implementation note for the .NET side
Each proc takes exactly one parameter, `@CustomerAccountId UNIQUEIDENTIFIER`.
A thin generic wrapper works for all seven:
```csharp
var results = await _db.QueryMultipleAsync(
    "cj.usp_Customer360_Financial",
    new { CustomerAccountId = id },
    commandType: CommandType.StoredProcedure);
```
(or the EF Core / Dapper equivalent already used elsewhere in the codebase —
match whatever pattern the existing controllers use for other stored-proc
reads, if any exist, for consistency.)
