# APK Build Readiness

## Ready

- Expo/React Native application source exists.
- Android application ID: `bd.com.colorjet.erp`.
- Debug APK workflow is configured.
- Release AAB job is restricted to version tags.
- Build artifacts and SHA-256 checksums are uploaded by GitHub Actions.

## Required before signed release

Configure repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_STORE_PASSWORD`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_AUTH_REDIRECT_URL`
- `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT`

## Validation gate

A build is not considered successful until GitHub Actions completes:

1. Dependency installation
2. TypeScript check
3. Web export
4. Expo Android prebuild
5. Gradle debug APK build
6. Artifact upload

Signed AAB additionally requires the production upload key and a `v*` tag.
