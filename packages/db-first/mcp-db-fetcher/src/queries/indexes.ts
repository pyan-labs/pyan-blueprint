import sql from "mssql";
import { getPool } from "../connection-manager.js";
import type { IndexInfo } from "../types.js";

export async function getIndexes(
  tableName?: string,
  env?: string
): Promise<IndexInfo[]> {
  const pool = await getPool(env);
  const request = pool.request();

  const whereClause = tableName ? `WHERE t.name = @table` : `WHERE t.is_ms_shipped = 0`;
  if (tableName) request.input("table", sql.NVarChar, tableName);

  const result = await request.query(`
    SELECT
      i.name                                    AS index_name,
      t.name                                    AS table_name,
      i.is_unique                               AS is_unique,
      i.is_primary_key                          AS is_primary_key,
      STRING_AGG(
        CASE WHEN ic.is_included_column = 0
          THEN c.name END, ', '
      ) WITHIN GROUP (ORDER BY ic.key_ordinal)  AS columns,
      STRING_AGG(
        CASE WHEN ic.is_included_column = 1
          THEN c.name END, ', '
      )                                          AS included_columns
    FROM sys.indexes i
    INNER JOIN sys.tables t ON i.object_id = t.object_id
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id
      AND i.index_id = ic.index_id
    INNER JOIN sys.columns c ON ic.object_id = c.object_id
      AND ic.column_id = c.column_id
    ${whereClause}
      AND i.type > 0
    GROUP BY i.name, t.name, i.is_unique, i.is_primary_key
    ORDER BY t.name, i.name
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.recordset.map((r: any) => ({
    index_name: r.index_name,
    table_name: r.table_name,
    is_unique: r.is_unique,
    is_primary_key: r.is_primary_key,
    columns: r.columns ? r.columns.split(", ") : [],
    included_columns: r.included_columns ? r.included_columns.split(", ") : [],
  }));
}
