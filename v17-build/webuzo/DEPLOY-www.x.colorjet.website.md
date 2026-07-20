# COLORJET Webuzo deployment

Canonical app URL: `https://www.x.colorjet.website`

## DNS records at Namecheap

- `A` host `x` -> `162.254.32.204`
- `A` host `www.x` -> `162.254.32.204`

## Webuzo domain mapping

Map both hostnames to the same document root:

- `x.colorjet.website`
- `www.x.colorjet.website`
- Document root: `/home/neellipto/public_html/x/x.colorjet.website`

Do not replace Webuzo's global Nginx/Apache configuration.

## Deploy

```bash
sudo bash v17-build/vps/deploy-www.x.colorjet.website.sh
```

The script builds `artifacts/mobile/` and copies the static web output to the existing Webuzo document root. It also installs the SPA `.htaccess` fallback.

## SSL

After both DNS records resolve, issue a Let's Encrypt certificate in Webuzo for both names and enable Force HTTPS.

## Verification

- Open `https://www.x.colorjet.website`
- Refresh a nested route to confirm it does not return 404
- Test login, password reset redirect, dashboard, attendance, service, inventory and logout
