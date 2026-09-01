# COLORJET ERP Production Deployment

This mobile/web application authenticates and exchanges business data only through the COLORJET ERP API.

## Required deployment variable

- `EXPO_PUBLIC_ERP_API_BASE_URL`

Never commit database credentials, employee passwords, access tokens, or refresh tokens.

## Vercel

- Install command: `pnpm install --no-frozen-lockfile`
- Build command: `pnpm --filter @workspace/mobile run build`
- Output directory: `artifacts/mobile/static-build`
- Root configuration: `vercel.json`

## Release rule

Merge into `main` only after the Production Check workflow passes and an Owner account can sign in successfully.
