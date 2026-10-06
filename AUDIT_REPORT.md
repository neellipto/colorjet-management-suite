# COLORJET ERP Repository Audit

Audit date: 2026-07-11 UTC  
Target: `neellipto/colorjet-management-suite`

## Executive finding

The repository is not empty. Its primary runnable application is an Expo 51 / React Native 0.74 / Expo Router monorepo application under `artifacts/mobile`, with web export support and Supabase authentication. A separate native Android WebView wrapper also exists under `apk-wrapper`.

## Detected stack

| Area | Finding | Status |
|---|---|---|
| Workspace | pnpm monorepo | Working |
| Mobile UI | Expo 51, React Native 0.74, Expo Router | Working/needs CI proof |
| Web/PWA | Expo web with custom build script | Present |
| Authentication | Supabase Auth | Present |
| Android identity | `bd.com.colorjet.erp` | Added |
| Android CI | GitHub Actions debug APK | Added |
| Signed AAB | Tag-only workflow using GitHub Secrets | Configured, secrets required |
| Firebase/FCM | Not verified in inspected configuration | Missing/unverified |
| Tests | No dedicated test script detected | Missing |
| Lint | No lint script detected | Missing |
| Legacy wrapper | `apk-wrapper` WebView app | Duplicate delivery path; preserve pending decision |

## Critical findings

1. `PROJECT_STACK.md` incorrectly reported an empty repository; the document is stale.
2. Expo Android package, versionCode and permissions were absent.
3. No `.github/workflows/android-build.yml` existed.
4. Production release signing secrets are not present by design and must be configured in GitHub.
5. Firebase Cloud Messaging cannot be claimed complete from current evidence.
6. Existing Supabase variables must remain in GitHub/Vercel secrets and must never be committed.

## Safe implementation decision

The Expo app is the primary Android build target. The existing WebView wrapper remains untouched to avoid destructive migration. No database records, credentials, logo assets or production configuration values were changed.
