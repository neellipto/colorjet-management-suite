/* =============================================================================
   COLORJET ERP — Read-only SQL login for the standalone cjext-customer360
   service. EXECUTE-only on the 7 Customer 360 procs. No table access, no
   other database, no write permission of any kind.

   This login is NOT the same as colorjeterp_app (the .NET app's login) —
   it exists so the standalone service never needs the app's credentials
   and can be revoked independently without touching the live .NET app.

   Run with a strong generated password, e.g.:
     PW=$(openssl rand -base64 32)
     /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U colorjeterp_app -P "$ADMIN_PW" -C \
       -v NewPassword="$PW" -i 09_customer360_readonly_login.sql
   Then store $PW in /etc/colorjet-cjext-customer360.env (server-side only,
   never in git, never pasted into chat).
   ============================================================================= */
USE master;
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'colorjet_c360_ro')
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'CREATE LOGIN colorjet_c360_ro WITH PASSWORD = ''' +
        REPLACE('$(NewPassword)', '''', '''''') + N''', CHECK_POLICY = ON;';
    EXEC sp_executesql @sql;
END
GO

USE COLORJET_ERP;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'colorjet_c360_ro')
BEGIN
    CREATE USER colorjet_c360_ro FOR LOGIN colorjet_c360_ro;
END
GO

/* EXECUTE-only — no SELECT/INSERT/UPDATE/DELETE on any table, no other proc */
GRANT EXECUTE ON cj.usp_Customer360_Header    TO colorjet_c360_ro;
GRANT EXECUTE ON cj.usp_Customer360_Portal    TO colorjet_c360_ro;
GRANT EXECUTE ON cj.usp_Customer360_Service   TO colorjet_c360_ro;
GRANT EXECUTE ON cj.usp_Customer360_Financial TO colorjet_c360_ro;
GRANT EXECUTE ON cj.usp_Customer360_Sales     TO colorjet_c360_ro;
GRANT EXECUTE ON cj.usp_Customer360_Machines  TO colorjet_c360_ro;
GRANT EXECUTE ON cj.usp_Customer360_Warranty  TO colorjet_c360_ro;
GO

PRINT N'colorjet_c360_ro created: EXECUTE-only on the 7 Customer 360 procs.';
PRINT N'No SELECT/INSERT/UPDATE/DELETE grants, no access to any other object.';
GO
