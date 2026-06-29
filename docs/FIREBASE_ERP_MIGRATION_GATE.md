# COLORJET ERP Mobile — Firebase Migration Gate

## Deployment policy
- Production deployment is blocked until the Firebase Emulator Suite and a connected non-production Firebase project pass the documented acceptance checks.
- Existing Vercel/Supabase production resources remain untouched during this migration.
- Odoo integration remains disabled and is excluded from this release.

## Target architecture
- Firebase Authentication: employee sign-in, password reset, forced password change.
- Firebase SQL Connect (PostgreSQL): normalized ERP data model and controlled operations.
- Cloud Functions: financial posting, stock movement, role validation, audit writes, notifications.
- Cloud Storage: service photos, signatures, task files and PDF documents.
- Firebase Cloud Messaging: task, service, stock and EMI notifications.
- Firebase Hosting: web/PWA release.
- Expo Android build: separate APK/AAB build after the web and emulator acceptance suite passes.

## Mandatory environment values
These values must be set only in Firebase/CI secret configuration and must never be committed:
- Firebase project ID
- SQL Connect service and database identifiers
- Firebase web app configuration
- Android package name and SHA-1/SHA-256 signing fingerprints
- Cloud Functions service-account/runtime secrets
- FCM credentials and notification configuration

## Owner provisioning
No default password may be embedded in source code, database seed files, screenshots, README files or deployments.
The first Owner account must be provisioned through a secured admin-only function, marked `forcePasswordChange=true`, logged in `login_audit`, and then required to create a new password at first sign-in.

## Release gate
The project cannot be published until all of these are PASS:
1. Firebase Auth user login, logout, reset-password and forced-change flows.
2. Role/permission enforcement for Owner, Admin, Manager, Office Staff, Accounts, Sales, Engineer, Service Manager and Store.
3. Owner dashboard KPIs from non-mock relational data.
4. Task workflow CRUD, comments, attachment, filters, export and print.
5. Engineer service lifecycle, time log, parts usage, photo, signature, report and print.
6. Invoice, payment, stock and ledger server-side posting validation.
7. Customer, supplier, LC/TT, foreign purchase, landed cost and agreement workflows.
8. Android offline cache for assigned tickets and safe conflict handling.
9. Emulator tests, TypeScript checks, production build, Firebase security review and no visible dummy actions.
