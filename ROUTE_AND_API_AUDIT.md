# COLORJET Route and API Audit

## Audit date
- 2026-06-18 UTC

## Scope inspected
The repository was inspected for application source, route definitions, API controllers, pages, and deployment entrypoints.

## Result
No routes or API endpoints can be verified because no application source code is present.

## Route files found
None.

Common route files checked by repository scan were not present, including:

- `routes/*`
- `src/routes/*`
- `src/app/*`
- `app/Http/Controllers/*`
- `pages/*`
- `app/api/*`
- `server.js`
- `app.js`
- `main.py`
- `manage.py`
- `urls.py`

## API endpoint status
| Endpoint area | Status |
|---|---|
| Authentication/login | Not found |
| Dashboard | Not found |
| Health check | Not found |
| Customer ledger | Not found |
| Supplier ledger | Not found |
| Stock/inventory | Not found |
| Invoice/payment | Not found |
| Service tickets | Not found |
| Engineer schedule | Not found |
| Warranty | Not found |
| LC/foreign purchase | Not found |
| Landed cost | Not found |
| Reports/print/export | Not found |
| Odoo sync push/pull | Not found |
| Sync retry/failure logs | Not found |

## Required API baseline for production
When the real backend source is available, verify at minimum:

| Route | Requirement |
|---|---|
| `GET /health` | Returns healthy status and dependency summary |
| `POST /auth/login` | Secure login, no secret leakage |
| `POST /auth/logout` | Session/token invalidation |
| `GET /dashboard` or API equivalent | Loads role-based metrics |
| `GET /api/customers` | Customer list with permissions |
| `GET /api/inventory` | Stock list with permissions |
| `GET /api/service-tickets` | Ticket list with permissions |
| `POST /api/odoo/sync/*` | Backend-only protected sync trigger |
| `GET /api/sync-logs` | Admin-only failed sync audit |
| `GET /reports/*` | Protected reporting routes |
| `GET /exports/*` | Protected export routes |

## Current PASS/FAIL checklist
- FAIL: Login route not found.
- FAIL: Dashboard route not found.
- FAIL: Health check route not found.
- FAIL: Database-backed API routes not found.
- FAIL: Odoo sync routes not found.
- FAIL: Report/print/export routes not found.

## Next route audit step
After the actual source code is restored, run framework-specific route listing commands such as:

```bash
# Laravel
php artisan route:list

# Express/Nest/Node
npm run routes
npm test

# Django
python manage.py show_urls

# Rails
bin/rails routes
```
