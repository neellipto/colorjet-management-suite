# COLORJET ERP V13 — Build Status

## Implemented

- Service Case and Warranty Registration
- Spare Parts Approval, Reservation, Dispatch, Receipt and Stock Posting
- Engineer SLA Dashboard and Scheduled Breach Evaluation
- Office Task Management
- LC/TT Import, Shipment and Trucking
- Leave, Holiday, Salary Profile and Payroll Approval
- Vendor-Neutral Biometric Connector, Device Mapping and Secure Ingestion Gateway
- Android APK/AAB EAS Release Workflow
- Android Field Device Acceptance Checklist

## Verified

- Ordered V12 → V13 PostgreSQL migrations
- Required database objects and default policy records
- Mobile TypeScript compilation
- Production web bundle
- Android package name: `com.colorjetbd.managementsuite`
- Application version: `1.3.0`
- Android version code: `1300`

## Protected Runtime Requirements

The following values must exist only as protected platform secrets:

- `EXPO_TOKEN`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BIOMETRIC_GATEWAY_KEY`

## Release Gate

Signed APK/AAB generation remains blocked until the authenticated Expo account and protected GitHub Secrets are available to the Android EAS workflow. No credential value is stored in this repository.
