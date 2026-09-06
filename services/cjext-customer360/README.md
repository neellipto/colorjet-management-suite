# cjext-customer360 — standalone read-only Customer 360 service

A small Flask service that wraps the 7 `cj.usp_Customer360_*` stored
procedures (already applied to production `COLORJET_ERP`) as plain HTTP
endpoints, using a dedicated EXECUTE-only SQL login. It runs alongside —
never inside — the existing .NET application, so deploying it cannot
break anything already live.

## Read this first: what this is, and what it is not

- **What it is:** a staff/internal reporting tool. Someone who holds the
  API key can query any customer's 360 data by GUID. Good for: internal
  dashboards, scripts, verifying data after the Phase A DB work, ad-hoc
  lookups.
- **What it is NOT (yet):** a customer-portal backend. It cannot check
  who is logged in on erp.colorjetbd.com — that requires validating the
  .NET app's own session/token, which needs that app's source or active
  cooperation from whoever maintains it. Do not call this service from
  browser-side JavaScript on a page customers can reach; the API key
  would be visible in the page and any customer could swap the
  `customerAccountId` in the URL to read another customer's invoices,
  balances, and service history.
- When real customer-portal auth becomes possible (.NET developer
  available, or the app's session-validation mechanism is documented),
  this same code becomes the read layer behind a proper authenticated
  route — the SQL contract (`PHASE_A_API_CONTRACT.md`) doesn't change,
  only who is allowed to call it and how the caller's identity is
  checked.

## Deploy (on the VPS, as root)

1. **Create the read-only DB login** (run once; needs the existing
   `colorjeterp_app` password to connect as an admin-capable account, or
   any login that can run `CREATE LOGIN`):
   ```bash
   NEWPW=$(openssl rand -base64 32)
   echo "Generated password (copy this now, shown once): $NEWPW"
   /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U colorjeterp_app -P "$PW" -C \
     -v NewPassword="$NEWPW" -i /root/phaseA/09_customer360_readonly_login.sql
   ```
   (`$PW` is the existing `colorjeterp_app` password variable from the
   Phase A apply session — reuse it, it only needs enough rights to
   create a new login, which the audited grants already cover.)

2. **Install Python deps in a venv:**
   ```bash
   mkdir -p /opt/cjext-customer360
   cp app.py requirements.txt /opt/cjext-customer360/
   cd /opt/cjext-customer360
   python3 -m venv venv
   ./venv/bin/pip install -r requirements.txt
   ```
   (Needs `ODBC Driver 18 for SQL Server` already installed — it is,
   since `/opt/mssql-tools18` depends on it.)

3. **Write the secrets file** (root-only, never in git):
   ```bash
   API_KEY=$(openssl rand -hex 32)
   echo "Generated API key (copy this now, shown once): $API_KEY"
   cat > /etc/colorjet-cjext-customer360.env <<ENVEOF
   CJEXT_C360_API_KEY=$API_KEY
   CJEXT_C360_DB_SERVER=127.0.0.1,1433
   CJEXT_C360_DB_NAME=COLORJET_ERP
   CJEXT_C360_DB_USER=colorjet_c360_ro
   CJEXT_C360_DB_PASSWORD=$NEWPW
   ENVEOF
   chmod 600 /etc/colorjet-cjext-customer360.env
   ```

4. **Create a dedicated system user and install the systemd unit:**
   ```bash
   useradd --system --no-create-home --shell /usr/sbin/nologin cjext-c360
   chown -R cjext-c360:cjext-c360 /opt/cjext-customer360
   cp cjext-customer360.service /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now cjext-customer360
   systemctl status cjext-customer360
   ```

5. **Verify locally before exposing via Apache:**
   ```bash
   curl -s http://127.0.0.1:8091/health
   curl -s -H "X-Internal-Api-Key: $API_KEY" \
     http://127.0.0.1:8091/customer/<a-real-Accounts.Id-guid>/header
   ```

6. **Apache reverse proxy** (add inside the existing HTTPS vhost config
   for erp.colorjetbd.com — do not create a new vhost/port publicly):
   ```apacheconf
   <Location /cjext-customer360/>
       ProxyPass        http://127.0.0.1:8091/
       ProxyPassReverse http://127.0.0.1:8091/
   </Location>
   ```
   Then `apachectl configtest && systemctl reload httpd` (or `apache2`,
   whichever this box uses). Since the API key check happens in the
   Flask app itself, exposing the path publicly is safe *for the
   staff-only usage described above* — but keep the API key as secret as
   a database password, because anyone who has it can read any
   customer's financial data.

## Rollback

```bash
systemctl disable --now cjext-customer360
rm /etc/systemd/system/cjext-customer360.service
systemctl daemon-reload
rm -rf /opt/cjext-customer360
# remove the <Location /cjext-customer360/> block from the Apache vhost, reload
/opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U colorjeterp_app -P "$PW" -C -Q \
  "DROP USER colorjet_c360_ro; USE master; DROP LOGIN colorjet_c360_ro;"
```
Nothing here touches `dbo.*`, the .NET app, or any existing table — the
rollback is fully self-contained.
