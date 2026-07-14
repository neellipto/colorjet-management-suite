#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="${1:-work}"
cd "$WORK_DIR"

test -n "${ANDROID_KEYSTORE_BASE64:-}"
test -n "${ANDROID_KEYSTORE_PASSWORD:-}"
test -n "${ANDROID_KEY_ALIAS:-}"
test -n "${ANDROID_KEY_PASSWORD:-}"

node <<'NODE'
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
app.expo.owner = 'neellipto';
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');

const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
eas.build.preview.credentialsSource = 'local';
eas.build.production.credentialsSource = 'local';
fs.writeFileSync('eas.json', JSON.stringify(eas, null, 2) + '\n');
NODE

mkdir -p credentials/android
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > credentials/android/colorjet-release.jks
keytool -list \
  -keystore credentials/android/colorjet-release.jks \
  -storepass "$ANDROID_KEYSTORE_PASSWORD" \
  -alias "$ANDROID_KEY_ALIAS" >/dev/null

node <<'NODE'
const fs = require('fs');
const credentials = {
  android: {
    keystore: {
      keystorePath: 'credentials/android/colorjet-release.jks',
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
      keyAlias: process.env.ANDROID_KEY_ALIAS,
      keyPassword: process.env.ANDROID_KEY_PASSWORD
    }
  }
};
fs.writeFileSync('credentials.json', JSON.stringify(credentials, null, 2) + '\n');
NODE

cat > .easignore <<'EOF'
node_modules/
.expo/
dist/
web-build/
.env
android/
ios/
.DS_Store
npm-debug.log*
.git/
.github/
EOF

echo "Expo config and original Android signing credential validated."
