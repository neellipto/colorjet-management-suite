# COLORJET ERP Native Android V11.3

Package ID: `com.colorjetbd.erp`

This is an isolated native Android build. It does not replace or delete the existing ERP, Web/PWA, `apk-wrapper`, database, theme, logo, or employee assets.

## Included

- Android 7.0+ support
- WebView access to the COLORJET field-service portal
- Foreground and background location permission flow
- Visible foreground-service notification
- Duty/customer-visit route session start and stop
- GPS and network location capture
- Local offline JSONL queue
- Optional Bearer-token API upload
- JavaScript bridge: `window.ColorjetNative`
- Boot recovery only when an active tracking session was already running
- File upload picker and secure HTTPS-only WebView

## JavaScript bridge

```javascript
ColorjetNative.setApiToken(token)
ColorjetNative.requestPermissions()
ColorjetNative.startDuty(sessionUuid)
ColorjetNative.stopDuty()
ColorjetNative.getPermissionStatus()
ColorjetNative.getQueuedLocationCount()
ColorjetNative.openSettings()
```

The app dispatches these browser events:

- `colorjet-native-ready`
- `colorjet-location-started`
- `colorjet-location-stopped`

## Security

No database password, cPanel password, Owner password, keystore password, or private API secret is committed. The release workflow expects GitHub Actions secrets.

## Build

Debug APK:

```bash
gradle :app:assembleDebug
```

Signed release, when the four signing environment variables are available:

```bash
ANDROID_KEYSTORE_PATH=/secure/path/COLORJET_ANDROID_RELEASE_KEYSTORE_2026.jks \
ANDROID_KEYSTORE_PASSWORD=*** \
ANDROID_KEY_ALIAS=colorjet-release \
ANDROID_KEY_PASSWORD=*** \
gradle :app:assembleRelease :app:bundleRelease
```
