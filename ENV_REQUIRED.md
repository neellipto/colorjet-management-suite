# COLORJET Required Environment Variables

## Audit date
- 2026-06-18 UTC

## Current status
No application code was found, so exact required environment variables cannot be confirmed from source.

This file documents the expected secure environment baseline for a COLORJET ERP / backend / Odoo sync deployment. Use placeholders only. Do not commit real secrets.

## Application runtime
| Variable | Required | Example placeholder | Notes |
|---|---:|---|---|
| `APP_ENV` | Yes | `production` | Runtime environment |
| `APP_URL` | Yes | `https://erp.colorjet.example` | Public application URL |
| `APP_PORT` | Yes | `3000` | Backend listen port |
| `APP_SECRET` | Yes | `<generate-strong-secret>` | Session/app signing secret |
| `JWT_SECRET` | If JWT used | `<generate-strong-jwt-secret>` | Backend only |

## Database
| Variable | Required | Example placeholder | Notes |
|---|---:|---|---|
| `DATABASE_URL` | Yes | `<database-connection-url>` | Preferred single connection string |
| `DB_HOST` | If not using `DATABASE_URL` | `<db-host>` | Do not commit real host if private |
| `DB_PORT` | If not using `DATABASE_URL` | `5432` | Or MySQL `3306` |
| `DB_NAME` | If not using `DATABASE_URL` | `colorjet_erp` | Database name |
| `DB_USER` | If not using `DATABASE_URL` | `<db-user>` | Secret-capable |
| `DB_PASSWORD` | If not using `DATABASE_URL` | `<db-password>` | Secret |
| `DB_SSL_MODE` | Production | `require` | Depends on DB server |

## Odoo sync
| Variable | Required | Example placeholder | Notes |
|---|---:|---|---|
| `ODOO_URL` | Yes | `https://odoo.colorjet.example` | Odoo base URL |
| `ODOO_DB` | Yes | `<odoo-db-name>` | Odoo database name |
| `ODOO_USERNAME` | Yes | `<odoo-api-user>` | Backend service user |
| `ODOO_API_KEY` | Yes | `<odoo-api-key>` | Secret; backend only |
| `ODOO_SYNC_ENABLED` | Yes | `true` | Feature flag |
| `ODOO_SYNC_INTERVAL_SECONDS` | Recommended | `300` | Scheduler interval |
| `ODOO_SYNC_QUEUE_NAME` | Recommended | `odoo-sync` | Queue name |
| `ODOO_SYNC_MAX_RETRIES` | Recommended | `5` | Retry safety |

## Queue/cache
| Variable | Required | Example placeholder | Notes |
|---|---:|---|---|
| `REDIS_URL` | If queue/cache used | `<redis-url>` | Secret-capable |
| `QUEUE_CONNECTION` | If queue used | `redis` | Stack dependent |

## File uploads/storage
| Variable | Required | Example placeholder | Notes |
|---|---:|---|---|
| `UPLOAD_DIR` | If local uploads used | `/var/www/colorjet/uploads` | Back up before deploy |
| `MAX_UPLOAD_MB` | Recommended | `25` | Reverse proxy must match |

## Notifications/chat/location
| Variable | Required | Example placeholder | Notes |
|---|---:|---|---|
| `FIREBASE_PROJECT_ID` | If push used | `<firebase-project-id>` | No new subscription required by this audit |
| `FIREBASE_CLIENT_EMAIL` | If push used | `<firebase-client-email>` | Secret-capable |
| `FIREBASE_PRIVATE_KEY` | If push used | `<firebase-private-key>` | Secret; keep escaped correctly |
| `WEBSOCKET_URL` | If realtime used | `wss://api.colorjet.example/ws` | VPS backend |

## Email/SMS
| Variable | Required | Example placeholder | Notes |
|---|---:|---|---|
| `SMTP_HOST` | If email used | `<smtp-host>` | Secret-capable config |
| `SMTP_PORT` | If email used | `587` | TLS recommended |
| `SMTP_USER` | If email used | `<smtp-user>` | Secret-capable |
| `SMTP_PASSWORD` | If email used | `<smtp-password>` | Secret |
| `SMS_API_URL` | If SMS used | `<sms-api-url>` | Provider-specific |
| `SMS_API_KEY` | If SMS used | `<sms-api-key>` | Secret |

## Security
| Variable | Required | Example placeholder | Notes |
|---|---:|---|---|
| `CORS_ORIGINS` | Yes | `https://erp.colorjet.example` | Restrict in production |
| `SESSION_COOKIE_SECURE` | Production | `true` | HTTPS only |
| `RATE_LIMIT_ENABLED` | Recommended | `true` | Protect login/API |

## Missing environment status
Because there is no application source, all environment requirements are currently inferred from expected COLORJET ERP/Odoo sync architecture, not confirmed from code.
