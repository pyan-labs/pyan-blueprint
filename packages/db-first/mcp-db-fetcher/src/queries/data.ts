import sql from "mssql";
import { getPool, getOpenEnv, isReadonly } from "../connection-manager.js";
import { assertSelectOnly, quoteIdentifier } from "../security.js";
import type { SampleDataResult } from "../types.js";

const EXECUTE_MAX_ROWS = 1000;

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

  // 실제 테이블 이름을 먼저 확인한 뒤, 그 이름만 식별자로 쿼리에 넣는다.
  const countResult = await pool
    .request()
    .input("table", tableName)
    .input("schema", schemaName).query(`
    SELECT s.name AS schema_name, t.name AS table_name, SUM(p.rows) AS row_count
    FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    INNER JOIN sys.partitions p ON t.object_id = p.object_id
      AND p.index_id IN (0, 1)
    WHERE t.name = @table AND s.name = @schema
    GROUP BY s.name, t.name
  `);

  const table = countResult.recordset[0];
  if (!table) {
    throw new Error(`Table "${schemaName}.${tableName}" not found.`);
  }
  const totalRows = table.row_count ?? 0;

  const dataResult = await pool.request().query(`
    SELECT TOP ${safeLimit} *
    FROM ${quoteIdentifier(table.schema_name)}.${quoteIdentifier(table.table_name)}
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
  assertSelectOnly(querySql);

  const readonly = isReadonly(env);

  let safeQuery = querySql;
  if (readonly && !/\bTOP\b/i.test(querySql) && !/\bFETCH\b/i.test(querySql)) {
    safeQuery = querySql.replace(/^(\s*)(WITH\s+|SELECT\s)/i, (match) => {
      if (match.toUpperCase().includes("WITH")) return match;
      return match.replace(/SELECT\s/i, "SELECT TOP 1000 ");
    });
  }

  const pool = await getPool(env);
  let rows: Record<string, unknown>[];
  if (readonly) {
    // 검사를 빠져나간 변경이 있어도 남지 않도록 항상 롤백한다.
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      rows = (await new sql.Request(tx).query(safeQuery)).recordset;
    } finally {
      // 오류로 이미 중단된 트랜잭션은 rollback이 실패하므로 원래 오류를 가리지 않게 무시한다.
      await tx.rollback().catch(() => undefined);
    }
  } else {
    rows = (await pool.request().query(safeQuery)).recordset;
  }

  return {
    rows,
    row_count: rows.length,
    warning: readonly
      ? `Readonly environment. Results capped at 1000 rows.`
      : null,
  };
}

export async function executeSql(
  querySql: string,
  env?: string
): Promise<{ recordsets: Record<string, unknown>[][]; rows_affected: number[]; truncated: boolean }> {
  if (isReadonly(env)) {
    throw new Error(
      `Environment "${env ?? getOpenEnv()}" is readonly. ` +
        `execute_sql runs only on environments with "readonly": false.`
    );
  }

  const pool = await getPool(env);
  const result = await pool.request().query(querySql);
  const recordsets = (result.recordsets as unknown as Record<string, unknown>[][]) ?? [];

  return {
    recordsets: recordsets.map((rs) => rs.slice(0, EXECUTE_MAX_ROWS)),
    rows_affected: result.rowsAffected,
    truncated: recordsets.some((rs) => rs.length > EXECUTE_MAX_ROWS),
  };
}
