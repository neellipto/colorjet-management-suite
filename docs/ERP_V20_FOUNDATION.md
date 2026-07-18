# COLORJET ERP V20 — Functional Foundation

## Objective
Build one production-grade COLORJET business platform with a compact module set, complete accounting traceability, professional Bangladesh-ready documents, strict permissions, reliable mobile attendance and integrated communication.

## Product Principles
1. Every amount, quantity and balance must have a traceable source document.
2. Posted financial or stock records use reversal/revision, never hidden overwrite.
3. Owner can review, approve, delegate, reopen and audit; sensitive actions remain permission-controlled.
4. Keep only operationally useful modules.
5. Use clear Bangla with familiar English accounting and technical terms.
6. Deploy to staging first; production requires approval.

## Core Modules
- Dashboard
- Sales & Customer
- Purchase, Supplier & Import
- Inventory & Product
- Accounts & Finance
- Service, Warranty & Engineer
- Tasks & Follow-up
- HR & Attendance
- Reports & Corporate Documents
- Users, Roles & Permissions
- Communication & Automation

## Accounting and Stock Integrity
Every posted transaction must store source module, source record, document number, counterparty, account or warehouse, amount or quantity, creator, approver, poster, timestamps and reversal link when corrected. No balance may change without a posted source transaction.

## Attendance
Attendance capture must not depend on Google Maps loading. Store GPS coordinates, accuracy, timestamp, device evidence and local offline queue. Sync automatically when internet returns. Optional map display may use downloadable OpenStreetMap-based offline tiles.

## Communication
Support SMTP email, SMS.NET.BD, WhatsApp Business API and push notification gateways. Secrets remain encrypted and must never be committed to GitHub.

## Reports
One report center must support detail/summary, item/non-item, date range, search and grouping by product, category, customer, supplier, user, date, month and status. Documents must use the original COLORJET logo and professional A4 layouts.

## Permissions
Server-side role and user permissions must cover view, create, edit, delete, reopen, approve, execute, export and print, with separate visibility for cost, sale price, profit, accounts and technical pages.

## Delivery
- Repository: `neellipto/colorjet-management-suite`
- Branch: `rebuild/erp-v20-foundation`
- Baseline: verified reference-APK UI branch `fix/reference-apk-ui-1702`
- Staging before production
- Versioned database migrations
- Automated lint, typecheck, tests, build and deployment checks
- Production secrets only in protected environment/server configuration

## Completion Gate
A feature is complete only when permissions, source links, audit, reversal, reports, print output, mobile behavior, validation and failure handling pass tests.
