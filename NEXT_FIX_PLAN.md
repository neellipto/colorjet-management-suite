# COLORJET Next Fix Plan

## Audit date
- 2026-06-18 UTC

## Current reality
This repository currently contains no runnable ERP/backend/frontend/Odoo sync source code. It appears to be a placeholder repository.

## Immediate priority
Do not create a new project over this repository. First restore or add the actual existing COLORJET ERP / Odoo sync source code into this Git branch.

## Step-by-step plan

### 1. Source restoration
- Confirm whether the real source exists in another branch, remote, ZIP backup, VPS directory, Replit project, or local machine.
- Add the real source without deleting production data.
- Keep real `.env` files out of Git.
- Keep only `.env.example` in Git.

### 2. Stack confirmation
After source is available, identify:
- Runtime and framework.
- Package manager.
- Install command.
- Build command.
- Test command.
- Start command.
- Database engine and migration command.
- Queue/worker command.
- Odoo sync implementation.

### 3. Safety checks before running commands
Allowed safe checks:
- Dependency install from lockfile/manifest.
- Lint/build/test commands.
- Non-destructive migration status command.
- Route list command.
- Static analysis.

Do not run destructive database commands.

### 4. Required production fixes after source restoration
- Add `GET /health` endpoint if missing.
- Verify login and role-based permissions.
- Verify dashboard loads without fatal errors.
- Verify customer/supplier ledger workflows.
- Verify stock/inventory workflows.
- Verify invoice/payment workflows.
- Verify service ticket and engineer schedule workflows.
- Verify report/print/export pages.
- Implement or verify backend-only Odoo sync.
- Add sync queue/retry/failure logging.
- Add deployment status documentation.

### 5. Deployment preparation
- Create backup instructions for database and uploads.
- Add production `.env.example` placeholders.
- Add VPS process manager config after stack confirmation.
- Add reverse proxy requirements after backend port is known.
- Add GitHub Actions auto-deploy only if the VPS deploy path and secrets are configured.

## PASS/FAIL checklist from this audit
- PASS: Repository inspected without deleting/resetting data.
- PASS: No secrets printed.
- PASS: No new project scaffold created.
- PASS: Documentation audit files created.
- FAIL: Application stack not detected.
- FAIL: Package manager not detected.
- FAIL: Build command not available.
- FAIL: Test command not available.
- FAIL: Database config not found.
- FAIL: Routes/API not found.
- FAIL: Deployment files not found.

## Exact next step for COLORJET
Provide or restore the actual existing source code for this repository, then request a second audit/build/test pass. If the source is on VPS or Replit, copy it into this Git repository without copying real `.env` secrets.
