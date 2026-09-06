/* =============================================================================
   COLORJET Bangladesh — Roles & Read-only Enforcement (Microsoft SQL Server)
   -----------------------------------------------------------------------------
   Enforces the core rule: the app only READS. Odoo is the single writer via the
   sync service. Two database roles:

     colorjet_sync_writer  -> used ONLY by the Odoo->reporting sync service.
                              SELECT + INSERT + UPDATE on report.* (no DELETE,
                              so history cannot be silently rewritten).
     colorjet_app_reader   -> used by the mobile/ERP app and dashboards.
                              SELECT only. Cannot INSERT/UPDATE/DELETE anything.

   Run after 01_schema.sql and 02_views.sql. Idempotent.
   Create the LOGIN and map USERs to these roles per environment separately
   (kept out of source control so no credentials live in the repo).
   ============================================================================= */
SET NOCOUNT ON;
GO

/* --- Roles -------------------------------------------------------------- */
IF DATABASE_PRINCIPAL_ID(N'colorjet_sync_writer') IS NULL
    CREATE ROLE colorjet_sync_writer;
GO
IF DATABASE_PRINCIPAL_ID(N'colorjet_app_reader') IS NULL
    CREATE ROLE colorjet_app_reader;
GO

/* --- Writer: read + append/update, but never delete --------------------- */
GRANT SELECT, INSERT, UPDATE ON SCHEMA::report TO colorjet_sync_writer;
DENY  DELETE                  ON SCHEMA::report TO colorjet_sync_writer;
GO

/* --- Reader: strictly read-only ---------------------------------------- */
GRANT SELECT                         ON SCHEMA::report TO colorjet_app_reader;
DENY  INSERT, UPDATE, DELETE         ON SCHEMA::report TO colorjet_app_reader;
GO

PRINT N'COLORJET roles created: colorjet_sync_writer (RW, no delete), colorjet_app_reader (read-only).';
PRINT N'Next: create a LOGIN + USER per environment and ALTER ROLE ... ADD MEMBER. Do NOT commit credentials.';
GO

/* -----------------------------------------------------------------------------
   Example (run manually, per environment — do not store real passwords here):

     CREATE LOGIN colorjet_app  WITH PASSWORD = N'<from-secret-store>';
     CREATE USER  colorjet_app  FOR LOGIN colorjet_app;
     ALTER ROLE   colorjet_app_reader  ADD MEMBER colorjet_app;

     CREATE LOGIN colorjet_sync WITH PASSWORD = N'<from-secret-store>';
     CREATE USER  colorjet_sync FOR LOGIN colorjet_sync;
     ALTER ROLE   colorjet_sync_writer ADD MEMBER colorjet_sync;
   ----------------------------------------------------------------------------- */
