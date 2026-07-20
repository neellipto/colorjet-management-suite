#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/neellipto/colorjet-management-suite.git"
BRANCH="build/v17-eas-20260714"
APP_DIR="/opt/colorjet-management-suite"
WEB_ROOT="/var/www/colorjet-management-suite"
NGINX_SITE="/etc/nginx/sites-available/www.x.colorjet.website"

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root: sudo bash $0"
  exit 1
fi

apt-get update
apt-get install -y git nginx rsync curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

corepack enable
corepack prepare pnpm@latest --activate

if [[ ! -d "$APP_DIR/.git" ]]; then
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"
pnpm install --no-frozen-lockfile
pnpm --filter @workspace/mobile run build

test -f artifacts/mobile/static-build/index.html
mkdir -p "$WEB_ROOT"
rsync -a --delete artifacts/mobile/static-build/ "$WEB_ROOT"/
chown -R www-data:www-data "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

cp v17-build/vps/nginx-www.x.colorjet.website.conf "$NGINX_SITE"
ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/www.x.colorjet.website
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "Deployment complete: http://www.x.colorjet.website"
echo "After DNS resolves, run: certbot --nginx -d www.x.colorjet.website"
