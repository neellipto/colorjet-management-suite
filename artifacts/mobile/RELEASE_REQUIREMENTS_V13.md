# COLORJET ERP V13 — Protected Release Requirements

## Signed Android Build

The GitHub workflow `.github/workflows/android-eas-release.yml` creates:

- `preview` profile → signed Android APK
- `production` profile → signed Android App Bundle (AAB)

Required GitHub Actions Secrets:

```text
EXPO_TOKEN
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

The workflow will initialize or link the Expo EAS project when the authenticated account has no existing project linkage.

## Operational Monitor

The workflow `.github/workflows/v13-operations-monitor.yml` requires:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

It evaluates service SLA and overdue office tasks every 15 minutes.

## Biometric Gateway

The Supabase Edge Function `biometric-ingest` requires:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
BIOMETRIC_GATEWAY_KEY
```

The service-role key and gateway key must never be placed in the Android application or repository source.

## Build Invocation

In GitHub:

1. Open **Actions**.
2. Select **Android EAS Release**.
3. Select **Run workflow**.
4. Choose `preview` for APK or `production` for AAB.
5. Download the artifact and `.sha256` checksum after the job succeeds.

## Release Gate

Do not release to production unless:

- V13 stacked PostgreSQL migration check passes.
- Mobile TypeScript and web production checks pass.
- Preview APK passes `DEVICE_TEST_CHECKLIST_V13.md`.
- Production AAB passes Google Play Internal Testing.
- No secret or signing credential appears in source, log or downloadable report.
