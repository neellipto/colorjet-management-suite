# COLORJET ERP Android installation

This package contains COLORJET ERP Android `1.7.1` (`versionCode 12`). The
release code remains greater than the previously distributed code 11, so the
signed release can update an existing production installation.

## Install on an Android device

1. Extract the release ZIP.
2. Verify the files with `sha256sum -c SHA256SUMS.txt` when that command is
   available.
3. Copy `COLORJET-ERP-v1.7.1-release.apk` to the device.
4. Open the APK and allow installation from the file manager if Android asks.
5. Install without uninstalling the existing production app so its local app
   data is preserved.

Android accepts an in-place update only when the release APK is signed with the
same production certificate as the installed app. The CI release build uses the
protected COLORJET signing secrets. The debug APK uses a separate package ID
(`com.colorjetbd.erp.debug`) and is included for isolated testing only; it does
not update the production app.

## Play Console

Upload `COLORJET-ERP-v1.7.1-play-store.aab`. Keep the generated AAB and release
APK private because they are production distribution artifacts.
