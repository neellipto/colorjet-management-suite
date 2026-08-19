#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${1:-$project_dir/release}"
version_name="$(sed -n "s/^[[:space:]]*versionName[[:space:]]*'\([^']*\)'.*/\1/p" "$project_dir/app/build.gradle" | head -n 1)"
version_code="$(sed -n 's/^[[:space:]]*versionCode[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$project_dir/app/build.gradle" | head -n 1)"
bundle_name="COLORJET-ERP-Android-v${version_name}-code${version_code}"
staging_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$staging_dir"
}
trap cleanup EXIT

release_apk="$project_dir/app/build/outputs/apk/release/app-release.apk"
release_aab="$project_dir/app/build/outputs/bundle/release/app-release.aab"
debug_apk="$project_dir/app/build/outputs/apk/debug/app-debug.apk"

for artifact in "$release_apk" "$release_aab" "$debug_apk"; do
  if [[ ! -f "$artifact" ]]; then
    printf 'Missing build artifact: %s\n' "$artifact" >&2
    printf 'Build all Android variants before packaging the release.\n' >&2
    exit 1
  fi
done

mkdir -p "$output_dir" "$staging_dir/$bundle_name"
output_dir="$(cd "$output_dir" && pwd)"
cp "$release_apk" "$staging_dir/$bundle_name/COLORJET-ERP-v${version_name}-release.apk"
cp "$release_aab" "$staging_dir/$bundle_name/COLORJET-ERP-v${version_name}-play-store.aab"
cp "$debug_apk" "$staging_dir/$bundle_name/COLORJET-ERP-v${version_name}-debug.apk"
cp "$project_dir/INSTALL.md" "$staging_dir/$bundle_name/INSTALL.md"

(
  cd "$staging_dir/$bundle_name"
  sha256sum ./*.apk ./*.aab > SHA256SUMS.txt
)

archive="$output_dir/$bundle_name.zip"
rm -f "$archive"
(
  cd "$staging_dir"
  zip -q -r "$archive" "$bundle_name"
)

printf '%s\n' "$archive"
