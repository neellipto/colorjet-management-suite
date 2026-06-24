# COLORJET Deployment Requirements Audit

## Audit date
- 2026-06-18 UTC

## Current deployability
Current status: **NOT DEPLOYABLE**

Reason: this repository does not contain application source code, runtime manifests, backend entrypoints, frontend assets, database migrations, or deployment configuration.

## Required production deployment target
For COLORJET ERP / mobile backend / Odoo sync workloads, the production target should be a backend-capable environment such as the existing VPS.

GitHub Pages is suitable only for static frontend pages. It cannot run:

- Backend APIs
- PHP/MySQL applications
- Node.js/Python/Go servers
- WebSocket services
- Queue workers
- Cron sync jobs
- Odoo sync jobs
- Database migrations

## Minimum required deployment files
Add these only after the real application stack is present:

| Requirement | Purpose |
|---|---|
| Runtime manifest such as `package.json`, `composer.json`, `pyproject.toml`, or equivalent | Defines install/build/test/start commands |
| `.env.example` | Documents required variables without secrets |
| Database migration folder | Non-destructive schema changes |
| Health check route | Deployment verification |
| Queue worker definition | Odoo sync retry/failure handling |
| Process manager config | VPS production service management |
| Reverse proxy config | TLS, routing, uploads, request limits |
| CI/CD workflow | Optional auto-deploy trigger to VPS |
| Backup procedure | Required before migration/deployment |

## Safe production backup checklist
Before any future deployment or migration, create backups without printing secrets:

```bash
# PostgreSQL example
pg_dump --format=custom --file=colorjet_backup_YYYYMMDD.dump "$DATABASE_URL"

# MySQL/MariaDB example
mysqldump --single-transaction --routines --triggers --events "$DB_NAME" > colorjet_backup_YYYYMMDD.sql

# Uploaded files example
rsync -a /var/www/colorjet/uploads/ /backup/colorjet/uploads-YYYYMMDD/
```

## Safe migration rule
Only non-destructive migrations are allowed unless COLORJET explicitly approves a reviewed data migration plan.

Do not run commands that wipe production data, including:

- `DROP DATABASE`
- `TRUNCATE`
- `DELETE FROM` without scoped criteria and backup
- `prisma migrate reset`
- `sequelize db:drop`
- `php artisan migrate:fresh`
- `php artisan db:wipe`

## Deployment blocker list
- No backend source code.
- No frontend source code.
- No database config.
- No route definitions.
- No package manager manifest.
- No build command.
- No start command.
- No test command.
- No deployment configuration.
- No `.env.example` existed before this audit.

## Next deployment step
Restore or add the actual existing COLORJET ERP / Odoo sync source into this repository. After that, run stack-specific install/build/test checks and create production deployment files for VPS.
