# COLORJET ERP Production Deployment

This mobile/web application uses Supabase Auth and the COLORJET production database.

## Required deployment variables

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT`

Use Vercel project settings to store these values for Preview and Production. Never commit a database password, Supabase service-role key, employee password, or temporary password.

## Vercel

- Install command: `pnpm install --no-frozen-lockfile`
- Build command: `pnpm --filter @workspace/mobile run build`
- Output directory: `artifacts/mobile/static-build`
- Root configuration: `vercel.json`

## Release rule

Merge into `main` only after the Production Check workflow passes and an Owner account can sign in successfully.
