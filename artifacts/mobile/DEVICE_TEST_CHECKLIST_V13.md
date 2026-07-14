# COLORJET ERP V13 — Android Device Test & Release Acceptance

Application ID: `com.colorjetbd.managementsuite`

Release version: `1.3.0`

Android version code: `1300`

## 1. Test Devices

Record at least three Android devices:

| Device | Android Version | RAM | Network | Result |
|---|---:|---:|---|---|
| Primary engineer phone |  |  | 4G/Wi-Fi |  |
| Low/mid-range phone |  |  | 4G |  |
| Owner/Admin phone |  |  | Wi-Fi |  |

Minimum field coverage:

- Android 10 or later
- Android 13+ notification permission
- Android 14+ foreground location service
- One low-memory device
- One device with battery optimization enabled

## 2. Installation and Upgrade

- [ ] Preview APK installs without package conflict.
- [ ] Existing V12 installation upgrades to V13 without clearing application data.
- [ ] Login session remains valid after upgrade.
- [ ] Application name and original COLORJET assets display correctly.
- [ ] Version shows `1.3.0` and version code `1300`.
- [ ] Production AAB installs through Google Play Internal Testing.
- [ ] APK/AAB SHA-256 matches the GitHub Actions artifact checksum.

## 3. Authentication and Role Access

Test each production role:

- [ ] Owner/Admin
- [ ] Manager
- [ ] Service Control
- [ ] Engineer
- [ ] Store
- [ ] Accounts
- [ ] Sales/Marketing

Verify:

- [ ] Inactive user cannot log in.
- [ ] Role menu contains only authorized modules.
- [ ] Direct URL navigation cannot bypass Supabase RLS.
- [ ] No default/test credentials appear in UI, logs or package.
- [ ] Logout clears the active session.

## 4. Service and Warranty

- [ ] Register a machine warranty using a unique serial number.
- [ ] Duplicate serial registration is rejected.
- [ ] Valid serial returns coverage and remaining days.
- [ ] Expired/void serial returns the correct status.
- [ ] Create service case for in-warranty machine.
- [ ] Create out-of-warranty chargeable case.
- [ ] Assign engineer and schedule service.
- [ ] Complete every allowed case transition.
- [ ] Invalid status transition is blocked.
- [ ] Customer confirmation and case closure are recorded.
- [ ] Reopen flow creates an audit event.

## 5. Engineer Field and Location

- [ ] Start Travel requests foreground and background location permission.
- [ ] Denied permission prevents the `Travelling` transition.
- [ ] Visible foreground-service notification remains active during tracking.
- [ ] GPS points continue while screen is locked.
- [ ] Geofence check-in blocks an engineer outside the configured radius.
- [ ] Low-accuracy GPS check-in is rejected.
- [ ] Route history shows start/end points and server timestamps.
- [ ] Mock-location flags appear in route audit.
- [ ] Complete/close/cancel stops background tracking.
- [ ] Battery optimization instructions are tested on Samsung, Xiaomi/Redmi and Oppo/Realme when applicable.

## 6. Spare Parts Workflow

- [ ] Engineer submits a parts request.
- [ ] Store/Manager approves full quantity.
- [ ] Partial approval is reflected correctly.
- [ ] Warehouse reservation cannot exceed available stock.
- [ ] Multiple reservations are consumed FIFO without over-posting.
- [ ] Dispatch cannot exceed approved quantity.
- [ ] Dispatch creates stock-out posting.
- [ ] Engineer receives full shipment.
- [ ] Damaged/short receipt records discrepancy.
- [ ] Installed quantity creates service-consumption posting.
- [ ] Returned quantity creates the correct stock effect.
- [ ] Request closes only after the workflow is complete.

## 7. SLA and Alerts

- [ ] Response warning is created before deadline.
- [ ] Arrival warning/breach is created correctly.
- [ ] Resolution breach marks the service case `sla_breached`.
- [ ] Duplicate scheduler runs do not duplicate alerts.
- [ ] Engineer notification outbox record is created.
- [ ] Service Manager notification outbox record is created.
- [ ] Alert acknowledgment is recorded.
- [ ] Completed/closed case resolves open SLA alerts.
- [ ] GitHub scheduled monitor runs with protected Supabase secrets.

## 8. Office Tasks

- [ ] Create and assign office task.
- [ ] Employee accepts and starts task.
- [ ] Waiting/resume flow works.
- [ ] Progress percentage is retained.
- [ ] Due task becomes overdue through scheduled monitor.
- [ ] Completion records date and note.
- [ ] Unauthorized employee cannot edit another task.

## 9. LC/TT, Shipment and Trucking

- [ ] Create LC import with LC number.
- [ ] Create TT import without LC number.
- [ ] Add multiple products with quantity and foreign unit price.
- [ ] BDT value uses the stored exchange rate.
- [ ] Record advance, production and before-shipment payments.
- [ ] Payment cannot be zero or negative.
- [ ] Create sea and air shipments.
- [ ] Update departure, in-transit, port, customs and warehouse status.
- [ ] Create China pickup and port-to-warehouse trucking jobs.
- [ ] Driver, vehicle, ETA and transport cost are retained.
- [ ] Delivery/proof update changes linked shipment status.
- [ ] Delayed shipment/truck retains delay note.

## 10. Leave, Holiday and Payroll

- [ ] Employee submits leave request.
- [ ] Overlapping leave is blocked.
- [ ] Manager approval stage works.
- [ ] HR/Accounts final approval works.
- [ ] Rejection records approver and note.
- [ ] Company/government holiday is visible.
- [ ] Salary profile is protected from ordinary employees.
- [ ] Payroll period validates start/end dates.
- [ ] Payroll calculation includes allowance, overtime and deductions.
- [ ] Owner/Admin approves payroll.
- [ ] Accounts posts payment reference.
- [ ] Employee sees only their payroll record.
- [ ] Paid period closes after all entries are paid.

## 11. Biometric Connector

- [ ] Connector stores only a secret reference, never the secret value.
- [ ] Device registration records vendor/model/location/IP/port.
- [ ] Device user code maps to the correct ERP employee.
- [ ] Gateway request without `x-colorjet-gateway-key` returns HTTP 401.
- [ ] Valid gateway batch inserts punch events.
- [ ] Retrying the same event does not create duplicates.
- [ ] Unmapped user event remains visible for correction.
- [ ] Public internet cannot reach device TCP port directly.
- [ ] Vendor gateway persists the last successful event cursor.

## 12. Offline and Recovery

- [ ] Route points queue offline and sync after reconnection.
- [ ] Status action shows a clear error when server is unavailable.
- [ ] Retried idempotent actions do not duplicate records.
- [ ] App recovers after force-close during active travel.
- [ ] Pending data survives application restart.
- [ ] Database backup exists before production migration.

## 13. Performance and Security

- [ ] Main dashboard opens within an acceptable time on 4G.
- [ ] Long lists remain usable with 500+ records.
- [ ] No service-role key exists in JavaScript bundle or APK.
- [ ] No database password, Expo token or signing key exists in repository.
- [ ] Supabase RLS blocks unauthorized reads/writes.
- [ ] Android exported components and permissions are reviewed.
- [ ] Production build has debug logging disabled.

## 14. Release Sign-Off

| Area | Tested By | Date | Result | Notes |
|---|---|---|---|---|
| Database migrations |  |  |  |  |
| Admin/Manager flow |  |  |  |  |
| Engineer field flow |  |  |  |  |
| Store/parts flow |  |  |  |  |
| Accounts/payroll flow |  |  |  |  |
| Import/logistics flow |  |  |  |  |
| Biometric gateway |  |  |  |  |
| APK upgrade |  |  |  |  |
| AAB internal testing |  |  |  |  |

Production release is approved only after all critical tests pass and no unresolved security, data-loss or stock/accounting issue remains.
