#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:neellipto/colorjet-management-suite.git}"
BRANCH="${BRANCH:-build/v17-eas-20260714}"
APP_DIR="${APP_DIR:-/opt/colorjet-management-suite}"
WEB_ROOT="${WEB_ROOT:-/var/www/colorjet-management-suite}"
NGINX_SITE="/etc/nginx/sites-available/www.x.colorjet.website"

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root: sudo bash $0"
  exit 1
fi

apt-get update
apt-get install -y git openssh-client nginx rsync curl ca-certificates certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

corepack enable
corepack prepare pnpm@9 --activate

if [[ ! -d "$APP_DIR/.git" ]]; then
  if ! git ls-remote "$REPO_URL" HEAD >/dev/null 2>&1; then
    echo "Private GitHub repository access is not configured on this VPS."
    echo "Add a GitHub SSH deploy key, then run this script again."
    exit 1
  fi
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
echo "After the DNS A record resolves, enable HTTPS with:"
echo "certbot --nginx -d www.x.colorjet.website --redirect"
