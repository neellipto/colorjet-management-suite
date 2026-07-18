#!/usr/bin/env bash
set -euo pipefail

LIVE_ROOT="${LIVE_ROOT:-/home/neellipto/public_html/colorjet.website}"
WORK_ROOT="${WORK_ROOT:-/home/neellipto/source-sync/colorjet-management-suite-onboarding}"
REPO_SSH="${REPO_SSH:-git@github.com:neellipto/colorjet-management-suite.git}"
BRANCH="${BRANCH:-rebuild/erp-v20-foundation}"
TARGET_SUBDIR="apps/web-erp"

if [[ ! -d "$LIVE_ROOT" ]]; then
  echo "ERROR: Live root not found: $LIVE_ROOT" >&2
  exit 1
fi

command -v git >/dev/null || { echo "ERROR: git is required" >&2; exit 1; }
command -v rsync >/dev/null || { echo "ERROR: rsync is required" >&2; exit 1; }

SCRIPT_PATH="$(readlink -f "$0")"
if [[ "$SCRIPT_PATH" == "$WORK_ROOT"/* ]]; then
  echo "ERROR: Run this script from a different folder than WORK_ROOT." >&2
  exit 1
fi

rm -rf "$WORK_ROOT"
mkdir -p "$(dirname "$WORK_ROOT")"
GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -i /home/neellipto/.ssh/neellipto_gpts -o IdentitiesOnly=yes}" \
  git clone --branch "$BRANCH" --single-branch "$REPO_SSH" "$WORK_ROOT"
mkdir -p "$WORK_ROOT/$TARGET_SUBDIR"

rsync -a --delete \
  --exclude='.git/' \
  --exclude='config.php' \
  --exclude='install.lock' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='uploads/' \
  --exclude='logs/' \
  --exclude='backups/' \
  --exclude='storage/cache/' \
  --exclude='storage/logs/' \
  --exclude='vendor/' \
  --exclude='node_modules/' \
  --exclude='*.sql.gz' \
  --exclude='*.zip' \
  --exclude='*.tar' \
  --exclude='*.tar.gz' \
  "$LIVE_ROOT/" "$WORK_ROOT/$TARGET_SUBDIR/"

cd "$WORK_ROOT"

# Abort before commit if common secret patterns are found.
if grep -RInE --exclude-dir=.git --exclude='*.md' --exclude='*.lock' \
  '(DATABASE_PASSWORD|DB_PASSWORD|API_KEY|API_HASH|PRIVATE_KEY|BEGIN (RSA|OPENSSH) PRIVATE KEY|CPANEL_PASSWORD|SMTP_PASSWORD)[[:space:]]*[:=][[:space:]]*[^[:space:]\[<]+' \
  "$TARGET_SUBDIR"; then
  echo "ERROR: Possible secret found. Remove it before committing." >&2
  exit 1
fi

git add "$TARGET_SUBDIR"
if git diff --cached --quiet; then
  echo "No source changes detected."
  exit 0
fi

git commit -m "chore: onboard current Webuzo PHP ERP source"
GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -i /home/neellipto/.ssh/neellipto_gpts -o IdentitiesOnly=yes}" \
  git push origin "$BRANCH"

echo "Source onboarding completed on branch: $BRANCH"
echo "Live files were copied only; the live document root was not modified."
