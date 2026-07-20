#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:neellipto/colorjet-management-suite.git}"
BRANCH="${BRANCH:-build/v17-eas-20260714}"
APP_DIR="${APP_DIR:-/home/neellipto/apps/colorjet-management-suite}"
WEB_ROOT="${WEB_ROOT:-/home/neellipto/public_html/x/x.colorjet.website}"
WEB_USER="${WEB_USER:-neellipto}"
WEB_GROUP="${WEB_GROUP:-neellipto}"

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root: sudo bash $0"
  exit 1
fi

install_system_packages() {
  if command -v dnf >/dev/null 2>&1; then
    dnf -y install git openssh-clients rsync curl ca-certificates tar gzip findutils
    PACKAGE_MANAGER="dnf"
  elif command -v yum >/dev/null 2>&1; then
    yum -y install git openssh-clients rsync curl ca-certificates tar gzip findutils
    PACKAGE_MANAGER="yum"
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y git openssh-client rsync curl ca-certificates tar gzip findutils
    PACKAGE_MANAGER="apt"
  else
    echo "Unsupported Linux distribution: dnf, yum or apt-get was not found."
    exit 1
  fi
}

install_node() {
  local node_major=0
  if command -v node >/dev/null 2>&1; then
    node_major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
  fi

  if [[ "$node_major" -lt 20 ]]; then
    if [[ "$PACKAGE_MANAGER" == "apt" ]]; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
    else
      curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
      if [[ "$PACKAGE_MANAGER" == "dnf" ]]; then
        dnf -y install nodejs
      else
        yum -y install nodejs
      fi
    fi
  fi

  node --version
  npm --version

  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9 --activate
  else
    npm install -g pnpm@9
  fi
  pnpm --version
}

install_system_packages
install_node

mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  if ! git ls-remote "$REPO_URL" HEAD >/dev/null 2>&1; then
    echo "Private GitHub repository access is not configured on this VPS."
    echo "Add a read-only GitHub SSH deploy key, then run this script again."
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
rsync -a --delete --exclude='.htaccess' artifacts/mobile/static-build/ "$WEB_ROOT"/
install -m 0644 v17-build/webuzo/.htaccess "$WEB_ROOT/.htaccess"
chown -R "$WEB_USER:$WEB_GROUP" "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

echo "Webuzo deployment complete: $WEB_ROOT"
echo "Canonical URL: https://www.x.colorjet.website"
echo "Webuzo must map both x.colorjet.website and www.x.colorjet.website to this same document root."
echo "After DNS resolves, issue SSL for both names and enable Force HTTPS in Webuzo."
