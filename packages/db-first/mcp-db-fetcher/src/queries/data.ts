import { getPool, isReadonly } from "../connection-manager.js";
import type { SampleDataResult } from "../types.js";

export async function getSampleData(
  tableName: string,
  schemaName: string = "dbo",
  limit: number = 5,
  env?: string
): Promise<SampleDataResult> {
  const pool = await getPool(env);

  const readonly = isReadonly(env);
  const maxRows = readonly ? 10 : 50;
  const safeLimit = Math.min(limit, maxRows);

  const countResult = await pool
    .request()
    .input("table", tableName)
    .input("schema", schemaName).query(`
    SELECT SUM(p.rows) AS row_count
    FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    INNER JOIN sys.partitions p ON t.object_id = p.object_id
      AND p.index_id IN (0, 1)
    WHERE t.name = @table AND s.name = @schema
  `);

  const totalRows = countResult.recordset[0]?.row_count ?? 0;

  const dataResult = await pool.request().query(`
    SELECT TOP ${safeLimit} *
    FROM [${schemaName}].[${tableName}]
  `);

  return {
    table_name: tableName,
    row_count_total: totalRows,
    rows: dataResult.recordset,
    note: readonly
      ? `Readonly environment. Showing ${safeLimit} of ${totalRows} rows.`
      : `Showing ${safeLimit} of ${totalRows} rows.`,
  };
}

export async function runSelectQuery(
  querySql: string,
  env?: string
): Promise<{ rows: Record<string, unknown>[]; row_count: number; warning: string | null }> {
  const normalized = querySql.trim().toUpperCase();
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
    throw new Error(
      "Only SELECT (or WITH...SELECT) queries are allowed. " +
        "No INSERT, UPDATE, DELETE, DROP, EXEC, etc."
    );
  }

  const forbidden = [
    /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i,
    /\bDROP\b/i,   /\bTRUNCATE\b/i, /\bALTER\b/i,
    /\bCREATE\b/i, /\bEXEC\b/i, /\bEXECUTE\b/i,
    /\bXP_\w+/i,   /\bSP_\w+/i,
  ];

  for (const pattern of forbidden) {
    if (pattern.test(querySql)) {
      throw new Error(
        `Forbidden keyword detected in query. ` +
          `Only pure SELECT queries are permitted.`
      );
    }
  }

  const readonly = isReadonly(env);

  let safeQuery = querySql;
  if (readonly && !/\bTOP\b/i.test(querySql) && !/\bFETCH\b/i.test(querySql)) {
    safeQuery = querySql.replace(/^(\s*)(WITH\s+|SELECT\s)/i, (match) => {
      if (match.toUpperCase().includes("WITH")) return match;
      return match.replace(/SELECT\s/i, "SELECT TOP 1000 ");
    });
  }

  const pool = await getPool(env);
  const result = await pool.request().query(safeQuery);

  return {
    rows: result.recordset,
    row_count: result.recordset.length,
    warning: readonly
      ? `Readonly environment. Results capped at 1000 rows.`
      : null,
  };
}
