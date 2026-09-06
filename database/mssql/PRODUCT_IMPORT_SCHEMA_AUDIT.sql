/* =============================================================================
   COLORJET_ERP -- PRODUCT/CONTACT IMPORT SCHEMA AUDIT (read-only)
   -----------------------------------------------------------------------------
   Run this AFTER 11_product_master_contact_import.sql (Part 1: staging).
   It returns ONLY table/column metadata (names, types, keys) plus the
   reconciliation counts from Part 1 -- no business data rows, no passwords.

   This is the missing piece before Part 2 (the actual MERGE into
   dbo.Products / dbo.Accounts) can be written safely. Paste the full output
   back and Part 2 will be generated from it -- keyed on
   LegacyInternalReference / Code so nothing already in the live database is
   duplicated or overwritten.

     sqlcmd -S <RealServer> -d COLORJET_ERP -E -i PRODUCT_IMPORT_SCHEMA_AUDIT.sql -o audit.txt
   ============================================================================= */
SET NOCOUNT ON;

-- 1) Full column list for every table this import could touch
SELECT SchemaName = s.name, TableName = t.name, ColumnName = c.name,
       DataType = ty.name, MaxLen = c.max_length, Precision = c.precision,
       Scale = c.scale, IsNullable = c.is_nullable, IsIdentity = c.is_identity,
       DefaultValue = OBJECT_DEFINITION(c.default_object_id)
FROM sys.columns c
JOIN sys.tables t   ON t.object_id = c.object_id
JOIN sys.schemas s  ON s.schema_id = t.schema_id
JOIN sys.types ty   ON ty.user_type_id = c.user_type_id
WHERE t.name IN ('Products','ProductCurrentStocks','ProductWarehouses',
                 'ProductSerials','Accounts','AccountGroups','AccountCategories')
   OR t.name LIKE '%Categor%'
   OR t.name LIKE '%SubCategor%'
   OR t.name LIKE '%Unit%'
   OR t.name LIKE '%Brand%'
   OR t.name LIKE '%Warehouse%'
ORDER BY s.name, t.name, c.column_id;

-- 2) Primary keys / unique constraints on those tables (what must not collide)
SELECT SchemaName = s.name, TableName = t.name, KeyName = kc.name, KeyType = kc.type_desc,
       Columns = STUFF((SELECT ', ' + ic.name
                         FROM sys.index_columns icx
                         JOIN sys.columns ic ON ic.object_id = icx.object_id AND ic.column_id = icx.column_id
                         WHERE icx.object_id = kc.parent_object_id AND icx.index_id = kc.unique_index_id
                         FOR XML PATH('')), 1, 2, '')
FROM sys.key_constraints kc
JOIN sys.tables t  ON t.object_id = kc.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.name IN ('Products','ProductCurrentStocks','ProductWarehouses',
                 'ProductSerials','Accounts')
ORDER BY s.name, t.name;

-- 3) Foreign keys FROM Products/Accounts (what they must point to)
SELECT FK = fk.name,
       ParentTable = OBJECT_SCHEMA_NAME(fk.parent_object_id)+'.'+OBJECT_NAME(fk.parent_object_id),
       ParentColumn = COL_NAME(fkc.parent_object_id, fkc.parent_column_id),
       RefTable = OBJECT_SCHEMA_NAME(fk.referenced_object_id)+'.'+OBJECT_NAME(fk.referenced_object_id),
       RefColumn = COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id)
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
WHERE OBJECT_NAME(fk.parent_object_id) IN ('Products','ProductCurrentStocks',
      'ProductWarehouses','ProductSerials','Accounts')
ORDER BY ParentTable;

-- 4) Any table that looks like a standalone Category/Subcategory master
--    (tells us whether CanonicalCategory/Subcategory need to map to an Id,
--    or are stored as free text directly on dbo.Products)
SELECT SchemaName = s.name, TableName = t.name,
       ApproxRows = SUM(CASE WHEN p.index_id IN (0,1) THEN p.rows ELSE 0 END)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id
WHERE t.name LIKE '%Categor%' OR t.name LIKE '%Group%' OR t.name LIKE '%Unit%' OR t.name LIKE '%Brand%'
GROUP BY s.name, t.name
ORDER BY s.name, t.name;

-- 5) A few live sample rows from dbo.Products (top 3, no filtering) so we can
--    see real values in each column -- not just metadata
SELECT TOP 3 * FROM dbo.Products;

-- 6) A few live sample rows from dbo.Accounts (top 3) -- confirms the
--    reuse pattern (Code/Name/ContactNo/Address/OpeningBalance) actually
--    matches what Customer 360 (Phase A) already assumed
SELECT TOP 3 * FROM dbo.Accounts;

-- 7) Re-run of Part 1's reconciliation counts (in case they weren't
--    captured from that script's own output)
SELECT MatchType = 'Product legacy-code exists in dbo.Products', MatchCount = COUNT(*)
FROM stg.ProductMasterImport s JOIN dbo.Products p ON p.Code = s.LegacyInternalReference;

SELECT MatchType = 'Contact name exists in dbo.Accounts', MatchCount = COUNT(*)
FROM stg.ContactSummaryImport s JOIN dbo.Accounts a ON a.Name = s.Name;
