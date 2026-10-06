# COLORJET ERP Native Android V11.4.1

Package ID: `com.colorjetbd.erp`  
Version: `1.7.1` / versionCode `12`

This release keeps the existing ERP and native background-location service, but replaces the confusing top action strip with a unified bottom navigation.

## Bottom navigation

- Home → `/dashboard`
- Attendance → `/hr/attendance`
- Alerts → `/notifications`
- Messages → `/messages`
- More → Employee ID cards, employee verification, QR generator, warranty registration, notification/SMS/email settings, office tasks, engineer schedule, service tickets, spare-parts logistics, LC/TT trucking, leave/payroll, biometric connectors, Start Duty and Stop Duty.

No database credential, Owner password, API secret, keystore file, or signing password is committed.

## Production package

The Android CI workflow builds the debug APK, production-signed release APK,
and Play Store AAB. It then packages them with checksums and the installation
guide into `COLORJET-ERP-Android-v1.7.1-code12.zip`. Use the signed release APK
for an in-place device update and the AAB for Play Console distribution. See
[`INSTALL.md`](INSTALL.md) for installation and signing requirements.

To package already-built artifacts locally, run:

```bash
./scripts/package-release.sh
```
