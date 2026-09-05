# PHASE A — Safe Apply to live COLORJET_ERP

Apply ONLY these two files to the production `COLORJET_ERP` database — they are
additive `cj.*` objects (new tables + `CREATE OR ALTER` procs/views), no DROP,
no TRUNCATE, no change to existing tables:

- `07_phaseA_customer_portal_reuse.sql`
- `08_phaseA_360_tabs.sql`

> Files `01`–`06` are a **separate reporting-DB / reference model** — do **NOT**
> run them against `COLORJET_ERP` (`05`/`06` are superseded, per AUDIT_FINDINGS.md).

## Precheck → Backup → Apply → Verify

```sql
-- 0) PRECHECK: confirm target DB and that the canonical masters exist
SELECT DB_NAME() AS CurrentDb;                       -- must be COLORJET_ERP
SELECT COUNT(*) AS AspNetUsers FROM dbo.AspNetUsers; -- >0
SELECT COUNT(*) AS Accounts    FROM dbo.Accounts;    -- >0
SELECT COUNT(*) AS Objects     FROM sys.objects WHERE type IN ('U','P','V');
```

```bash
# 1) BACKUP FIRST (never apply without a fresh backup)
/opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -d COLORJET_ERP -U colorjeterp_app -P "$PW" -C -Q \
 "BACKUP DATABASE COLORJET_ERP TO DISK='/var/opt/mssql/backup/COLORJET_ERP_prePhaseA.bak' WITH INIT, COMPRESSION;"
# (adjust the backup path to a writable dir the SQL Server service owns)

# 2) APPLY (order matters: 07 then 08). Files must be on the server first —
#    clone the repo read-only, or copy the two files over.
/opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -d COLORJET_ERP -U colorjeterp_app -P "$PW" -C \
  -i 07_phaseA_customer_portal_reuse.sql
/opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -d COLORJET_ERP -U colorjeterp_app -P "$PW" -C \
  -i 08_phaseA_360_tabs.sql
```

```sql
-- 3) VERIFY: the new objects exist and existing data is untouched
SELECT name FROM sys.tables  WHERE name LIKE 'CustomerPortal%';        -- 3 tables
SELECT name FROM sys.objects WHERE type='P' AND name LIKE 'usp_Customer360%';  -- 6 procs
SELECT COUNT(*) FROM dbo.Accounts;   -- unchanged from precheck
-- smoke test one customer (use a real Accounts.Id):
DECLARE @c UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM dbo.Accounts WHERE IsDeleted=0);
EXEC cj.usp_Customer360_Header   @CustomerAccountId=@c;
EXEC cj.usp_Customer360_Financial @CustomerAccountId=@c;
EXEC cj.usp_Customer360_Sales    @CustomerAccountId=@c;
```

## Rollback (only if needed — additive, fully reversible)
```sql
DROP PROCEDURE IF EXISTS cj.usp_Customer360_Warranty, cj.usp_Customer360_Machines,
     cj.usp_Customer360_Sales, cj.usp_Customer360_Financial,
     cj.usp_Customer360_Service, cj.usp_Customer360_Portal, cj.usp_Customer360_Header;
DROP VIEW IF EXISTS cj.vw_CustomerMaster;
DROP TABLE IF EXISTS cj.CustomerPortalInvitations, cj.CustomerPortalAudit, cj.CustomerPortalAccounts;
-- (only removes the NEW objects; no existing ERP table is affected)
```

## After a green apply
1. **API binding** — add read routes in the existing authenticated API/Extension API
   that `EXEC` these procs (RBAC + branch scope + customer isolation; browser never
   touches SQL). Customer-portal user only ever passes its own linked `CustomerAccountId`.
2. **UI binding** — wire the existing Customer 360 tabs to the new routes (no redesign).
3. **Regression** — desktop + mobile: all tabs load, no overflow, no console error,
   theme + logo intact.
4. Publish.
