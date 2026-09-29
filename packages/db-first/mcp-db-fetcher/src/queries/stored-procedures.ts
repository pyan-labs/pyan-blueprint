import sql from "mssql";
import { getPool } from "../connection-manager.js";
import type { StoredProcedureInfo } from "../types.js";

export async function getStoredProcedures(
  schemaFilter?: string,
  env?: string
): Promise<StoredProcedureInfo[]> {
  const pool = await getPool(env);
  const request = pool.request();

  const schemaWhere = schemaFilter
    ? `AND s.name = @schema`
    : `AND s.name NOT IN ('sys')`;

  if (schemaFilter) request.input("schema", sql.NVarChar, schemaFilter);

  const spResult = await request.query(`
    SELECT
      p.name        AS name,
      s.name        AS schema_name,
      SUBSTRING(m.definition, 1, 500) AS definition_preview
    FROM sys.procedures p
    INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
    INNER JOIN sys.sql_modules m ON p.object_id = m.object_id
    WHERE p.is_ms_shipped = 0
      ${schemaWhere}
    ORDER BY s.name, p.name
  `);

  const results: StoredProcedureInfo[] = [];

  for (const sp of spResult.recordset) {
    const paramResult = await pool
      .request()
      .input("sp_name", sql.NVarChar, sp.name).query(`
      SELECT
        p.name            AS name,
        t.name            AS data_type,
        p.max_length      AS max_length,
        p.is_output       AS is_output,
        p.has_default_value AS has_default
      FROM sys.parameters p
      INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
      WHERE p.object_id = OBJECT_ID(@sp_name)
      ORDER BY p.parameter_id
    `);

    results.push({
      name: sp.name,
      schema_name: sp.schema_name,
      definition_preview: sp.definition_preview,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parameters: paramResult.recordset.map((p: any) => ({
        name: p.name,
        data_type: p.data_type,
        max_length: p.max_length,
        is_output: p.is_output,
        has_default: p.has_default,
      })),
    });
  }

  return results;
}
