# COLORJET ERP Android WebView Wrapper

This isolated Android module packages the responsive COLORJET ERP web system as an Android app.

## Target URL

`https://erp.colorjetbd.com/login.php`

No ERP login credential, database credential, API key, or owner password is stored in the application source.

## Included behavior

- HTTPS-only ERP loading
- Cookie/session support for login persistence
- File upload picker for ERP attachments
- External handling for phone, email, WhatsApp, maps, and download links
- Android back navigation through ERP history
- Android 7.0+ support (`minSdk 24`)

## Build output

GitHub Actions produces a signed debug APK for device testing:

`app/build/outputs/apk/debug/app-debug.apk`

The debug APK is installable, but it is not suitable for a Play Console update. A Play Store release must be signed with the existing production upload key or Google Play App Signing workflow.
