import sql from "mssql";
import { getPool } from "../connection-manager.js";
import type { ColumnInfo, TableInfo } from "../types.js";

export async function getAllTables(
  schemaFilter?: string,
  env?: string
): Promise<{ table_name: string; schema_name: string; row_count: number }[]> {
  const pool = await getPool(env);

  const schemaWhere = schemaFilter
    ? `AND s.name = @schema`
    : `AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA')`;

  const request = pool.request();
  if (schemaFilter) request.input("schema", sql.NVarChar, schemaFilter);

  const result = await request.query(`
    SELECT
      s.name          AS schema_name,
      t.name          AS table_name,
      p.rows          AS row_count
    FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    INNER JOIN sys.partitions p ON t.object_id = p.object_id
      AND p.index_id IN (0, 1)
    WHERE t.is_ms_shipped = 0
      ${schemaWhere}
    ORDER BY s.name, t.name
  `);

  return result.recordset;
}

export async function getTableSchema(
  tableName: string,
  schemaName: string = "dbo",
  env?: string
): Promise<TableInfo> {
  const pool = await getPool(env);

  const colResult = await pool
    .request()
    .input("table", sql.NVarChar, tableName)
    .input("schema", sql.NVarChar, schemaName).query(`
    SELECT
      c.COLUMN_NAME                             AS column_name,
      c.DATA_TYPE                               AS data_type,
      c.CHARACTER_MAXIMUM_LENGTH                AS max_length,
      c.NUMERIC_PRECISION                       AS precision,
      c.NUMERIC_SCALE                           AS scale,
      CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS is_nullable,
      CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key,
      COLUMNPROPERTY(
        OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME),
        c.COLUMN_NAME, 'IsIdentity'
      )                                         AS is_identity,
      c.COLUMN_DEFAULT                          AS default_value,
      ep.value                                  AS description
    FROM INFORMATION_SCHEMA.COLUMNS c
    LEFT JOIN (
      SELECT ku.TABLE_NAME, ku.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    ) pk ON c.TABLE_NAME = pk.TABLE_NAME
         AND c.COLUMN_NAME = pk.COLUMN_NAME
    LEFT JOIN sys.extended_properties ep
      ON ep.major_id = OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME)
      AND ep.minor_id = COLUMNPROPERTY(
        OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME),
        c.COLUMN_NAME, 'ColumnId'
      )
      AND ep.name = 'MS_Description'
    WHERE c.TABLE_NAME = @table
      AND c.TABLE_SCHEMA = @schema
    ORDER BY c.ORDINAL_POSITION
  `);

  const countResult = await pool
    .request()
    .input("table", sql.NVarChar, tableName)
    .input("schema", sql.NVarChar, schemaName).query(`
    SELECT SUM(p.rows) AS row_count
    FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    INNER JOIN sys.partitions p ON t.object_id = p.object_id
      AND p.index_id IN (0, 1)
    WHERE t.name = @table AND s.name = @schema
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnInfo[] = colResult.recordset.map((r: any) => ({
    column_name: r.column_name,
    data_type: r.data_type,
    max_length: r.max_length,
    precision: r.precision,
    scale: r.scale,
    is_nullable: r.is_nullable === 1,
    is_primary_key: r.is_primary_key === 1,
    is_identity: r.is_identity === 1,
    default_value: r.default_value,
    description: r.description ?? null,
  }));

  return {
    table_name: tableName,
    schema_name: schemaName,
    row_count: countResult.recordset[0]?.row_count ?? 0,
    columns,
  };
}
