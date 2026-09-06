/* =============================================================================
   COLORJET_ERP — SCHEMA AUDIT (read-only)
   -----------------------------------------------------------------------------
   Run this against the LIVE COLORJET_ERP database. It returns ONLY table and
   column NAMES + types (metadata) — NO business data, NO passwords, NO values.
   The output lets us map every "reused" object to the real production tables so
   the new modules EXTEND the existing masters instead of duplicating them
   (as the Master Build spec requires).

   Connection: the live DB / server name is in the .NET service env file
   /etc/colorjet-erp/runtime.env (ConnectionStrings). Do NOT paste that
   connection string or any password into chat — only paste this query's output.

   Example run (fill in real server/db; use Windows or SQL auth as configured):
     sqlcmd -S <RealServer> -d COLORJET_ERP -E -i SCHEMA_AUDIT_QUERY.sql -o audit.txt
     -- or with SQL login:  sqlcmd -S <RealServer> -d COLORJET_ERP -U <user> -P <pass> -i SCHEMA_AUDIT_QUERY.sql -o audit.txt
   Then share audit.txt (it is metadata only).
   ============================================================================= */
SET NOCOUNT ON;

/* 1) All base tables (schema.table + row-count estimate, no data) */
SELECT SchemaName = s.name, TableName = t.name,
       ApproxRows = SUM(CASE WHEN p.index_id IN (0,1) THEN p.rows ELSE 0 END)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id
GROUP BY s.name, t.name
ORDER BY s.name, t.name;

/* 2) Columns for the identity / customer / employee / product / accounting areas.
   Adjust the LIKE list if your table names differ. Names + types only. */
SELECT SchemaName = s.name, TableName = t.name, ColumnName = c.name,
       DataType = ty.name,
       MaxLen = c.max_length, IsNullable = c.is_nullable, IsIdentity = c.is_identity
FROM sys.columns c
JOIN sys.tables t   ON t.object_id = c.object_id
JOIN sys.schemas s  ON s.schema_id = t.schema_id
JOIN sys.types ty   ON ty.user_type_id = c.user_type_id
WHERE t.name LIKE '%User%'     OR t.name LIKE '%Customer%' OR t.name LIKE '%Contact%'
   OR t.name LIKE '%Employee%' OR t.name LIKE '%Engineer%' OR t.name LIKE '%Role%'
   OR t.name LIKE '%Permission%' OR t.name LIKE '%Product%' OR t.name LIKE '%Account%'
   OR t.name LIKE '%Invoice%'  OR t.name LIKE '%Payment%'  OR t.name LIKE '%Machine%'
   OR t.name LIKE '%Service%'  OR t.name LIKE '%Ticket%'   OR t.name LIKE '%Branch%'
   OR t.name LIKE '%Company%'
ORDER BY s.name, t.name, c.column_id;

/* 3) Primary keys & unique constraints (names only) */
SELECT SchemaName = s.name, TableName = t.name, KeyName = kc.name, KeyType = kc.type_desc
FROM sys.key_constraints kc
JOIN sys.tables t  ON t.object_id = kc.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
ORDER BY s.name, t.name;

/* 4) Foreign keys (relationships only) */
SELECT FK = fk.name,
       ParentTable  = OBJECT_SCHEMA_NAME(fk.parent_object_id)+'.'+OBJECT_NAME(fk.parent_object_id),
       RefTable     = OBJECT_SCHEMA_NAME(fk.referenced_object_id)+'.'+OBJECT_NAME(fk.referenced_object_id)
FROM sys.foreign_keys fk
ORDER BY ParentTable;
