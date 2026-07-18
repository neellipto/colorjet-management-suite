# COLORJET Source Audit — 2026-07-18

## Repository reviewed
`neellipto/colorjet-management-suite`

## Verified baseline
- React Native / Expo mobile workspace exists under `artifacts/mobile`.
- The verified reference-APK restoration is preserved through branch baseline `fix/reference-apk-ui-1702`.
- Production Android package remains `com.colorjetbd.managementsuite`.
- Existing native Android wrapper/code also exists under `android-v11.3-native`.
- Root workspace currently builds the mobile application.

## Critical gap
The live Webuzo PHP ERP source used by `colorjet.website` is not present as normal PHP source files in this repository. Repository code search returned no PHP application files such as `index.php`, `install.php`, `src/bootstrap.php`, or `deployment_readiness.php`.

Therefore the full web ERP cannot be safely rebuilt, tested, versioned or automatically deployed from GitHub until the current live server source is synchronized into this private repository.

## Required one-time onboarding
The current server application root must be copied into a dedicated path such as:

`apps/web-erp/`

Exclude:
- `config.php`
- database passwords and API keys
- `install.lock`
- uploads containing confidential customer files
- logs, backups and caches
- SSH/private keys

Include:
- PHP source
- assets and templates
- database migration files
- route definitions
- print templates
- tests and deployment scripts

## Target monorepo structure

```text
apps/
  web-erp/          # PHP/MySQL ERP
  mobile/           # React Native/Expo app
packages/
  contracts/        # API and validation contracts
  report-models/    # shared report definitions
  permissions/      # shared permission keys
infra/
  github-actions/
  webuzo/
docs/
```

## Release discipline
- `main`: production-approved source only
- `staging`: staging deployment
- `rebuild/erp-v20-foundation`: active consolidated rebuild
- no direct production overwrite from chat-generated ZIP files
- database migrations reviewed and versioned
- deployment includes backup, tests, health check and rollback

## Immediate next engineering work
1. Sync live PHP source into `apps/web-erp`.
2. Remove hard-coded secrets and mixed-version markers.
3. Build server-side permission middleware and audit/reversal foundation.
4. Normalize accounting posting sources.
5. Consolidate reports and A4 print templates.
6. Implement offline-first attendance and communication gateways.
