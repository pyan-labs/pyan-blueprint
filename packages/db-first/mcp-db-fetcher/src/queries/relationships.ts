import sql from "mssql";
import { getPool } from "../connection-manager.js";
import type { RelationshipInfo } from "../types.js";

export async function getRelationships(
  tableName?: string,
  env?: string
): Promise<RelationshipInfo[]> {
  const pool = await getPool(env);
  const request = pool.request();

  const whereClause = tableName
    ? `AND (
        OBJECT_NAME(fk.parent_object_id) = @table
        OR OBJECT_NAME(fk.referenced_object_id) = @table
      )`
    : "";

  if (tableName) request.input("table", sql.NVarChar, tableName);

  const result = await request.query(`
    SELECT
      fk.name                                         AS fk_name,
      OBJECT_NAME(fk.parent_object_id)                AS from_table,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS from_column,
      OBJECT_NAME(fk.referenced_object_id)            AS to_table,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS to_column,
      fk.delete_referential_action_desc               AS on_delete,
      fk.update_referential_action_desc               AS on_update
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc
      ON fk.object_id = fkc.constraint_object_id
    ${whereClause}
    ORDER BY from_table, fk_name
  `);

  return result.recordset as RelationshipInfo[];
}
