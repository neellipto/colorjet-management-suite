# COLORJET Management Suite — VPS Deployment

Canonical production URL: `https://www.x.colorjet.website`

## Release identity

- App: COLORJET Management Suite
- Android package: `com.colorjetbd.managementsuite`
- Version: `1.7.1`
- Android versionCode: `1702`
- UI reference: uploaded reference APK + `artifacts/mobile/`
- Database/Auth: Supabase production project
- Replit hosting/origin: removed and blocked by validation

## 1. DNS

In the DNS zone for `colorjet.website`, create:

- Type: `A`
- Name/Host: `www.x`
- Value: the VPS public IPv4 address
- TTL: Auto or 300

Do not keep another A/CNAME record with the same `www.x` host.

## 2. VPS prerequisites

Ubuntu 22.04 or 24.04 is recommended. Open ports 22, 80 and 443.

Because the GitHub repository is private, configure one of these before deployment:

1. GitHub SSH deploy key on the VPS, or
2. Upload a verified source ZIP manually to `/opt/colorjet-management-suite`.

Never store a GitHub token, database password, Supabase service-role key, signing key or employee password in the repository.

## 3. Deploy

The prepared deployment script is:

```bash
v17-build/vps/deploy-www.x.colorjet.website.sh
```

Run from the checked-out repository:

```bash
sudo bash v17-build/vps/deploy-www.x.colorjet.website.sh
```

The static web build is published to:

```text
/var/www/colorjet-management-suite
```

The Nginx configuration is installed as:

```text
/etc/nginx/sites-available/www.x.colorjet.website
```

## 4. SSL

After the DNS record resolves to the VPS:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d www.x.colorjet.website
```

Choose HTTPS redirect when prompted.

## 5. Supabase Auth URLs

In Supabase Authentication URL Configuration, add:

- Site URL: `https://www.x.colorjet.website`
- Redirect URL: `https://www.x.colorjet.website/**`

## 6. Verification

Verify:

```bash
curl -I https://www.x.colorjet.website
sudo nginx -t
systemctl status nginx --no-pager
```

Then test login, password reset, Owner dashboard, attendance, service tickets, stock, invoices and logout from both web and the signed APK.
