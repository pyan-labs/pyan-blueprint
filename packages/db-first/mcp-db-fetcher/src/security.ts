import type sql from "mssql";
import type { ConnectionEntry } from "./types.js";

// readonly는 명시적으로 false일 때만 해제한다. 빠뜨린 환경은 조회 전용으로 취급한다.
export function isReadonlyEntry(entry: ConnectionEntry): boolean {
  return entry.readonly !== false;
}

// ── 조회 전용 계정 검증 ─────────────────────────────────────────────────────

// readonly 환경 계정에 허용하는 DB 수준 권한. VIEW 계열(VIEW DEFINITION 등)은 모두 허용한다.
const ALLOWED_DATABASE_PERMISSIONS = new Set(["CONNECT", "SELECT", "SHOWPLAN"]);

export function findWritePermissions(permissions: string[]): string[] {
  return permissions.filter((p) => !ALLOWED_DATABASE_PERMISSIONS.has(p) && !p.startsWith("VIEW "));
}

// 스키마·개체 단위로 부여된 쓰기 권한. DB 수준 권한에는 나타나지 않는다.
const OBJECT_WRITE_PERMISSIONS_SQL = `
  SELECT TOP 20 QUOTENAME(s.name) + '.' + QUOTENAME(o.name) + ' ' + p.permission_name AS grant_desc
  FROM sys.objects o
  INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
  CROSS APPLY (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('ALTER'), ('EXECUTE')) p(permission_name)
  WHERE o.is_ms_shipped = 0
    AND (
      (o.type IN ('U', 'V') AND p.permission_name IN ('INSERT', 'UPDATE', 'DELETE', 'ALTER'))
      OR (o.type = 'P' AND p.permission_name IN ('EXECUTE', 'ALTER'))
    )
    AND HAS_PERMS_BY_NAME(QUOTENAME(s.name) + '.' + QUOTENAME(o.name), 'OBJECT', p.permission_name) = 1
`;

// 코드의 SQL 검사는 우회될 수 있으므로, readonly 환경은 계정 자체가 쓰기 권한이 없어야 연결한다.
export async function assertReadonlyAccount(pool: sql.ConnectionPool, env: string): Promise<void> {
  const dbPerms = await pool
    .request()
    .query<{ permission_name: string }>("SELECT permission_name FROM fn_my_permissions(NULL, 'DATABASE')");
  let found = findWritePermissions(dbPerms.recordset.map((r) => r.permission_name));

  if (found.length === 0) {
    const objectPerms = await pool.request().query<{ grant_desc: string }>(OBJECT_WRITE_PERMISSIONS_SQL);
    found = objectPerms.recordset.map((r) => r.grant_desc);
  }

  if (found.length > 0) {
    throw new Error(
      `Environment "${env}" is readonly, but its account has write permissions: ${found.slice(0, 10).join(", ")}.\n` +
        `Use an account with only db_datareader + VIEW DEFINITION, ` +
        `or set "readonly": false in .db-fetcher.json if this environment is meant to be writable.`
    );
  }
}

// ── SQL 검사 ────────────────────────────────────────────────────────────────

const FORBIDDEN_IN_SELECT = [
  /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bMERGE\b/i,
  /\bDROP\b/i, /\bTRUNCATE\b/i, /\bALTER\b/i, /\bCREATE\b/i,
  /\bEXEC\b/i, /\bEXECUTE\b/i, /\bINTO\b/i,
  /\bGRANT\b/i, /\bREVOKE\b/i, /\bDENY\b/i,
  /\bDBCC\b/i, /\bBACKUP\b/i, /\bRESTORE\b/i, /\bKILL\b/i, /\bSHUTDOWN\b/i, /\bRECONFIGURE\b/i,
  /\bCOMMIT\b/i, /\bROLLBACK\b/i, /\bWAITFOR\b/i, /\bBULK\b/i,
  /\bOPENROWSET\b/i, /\bOPENQUERY\b/i, /\bOPENDATASOURCE\b/i,
  /\bXP_\w+/i, /\bSP_\w+/i,
];

export function assertSelectOnly(querySql: string): void {
  const normalized = querySql.trim().toUpperCase();
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
    throw new Error(
      "Only SELECT (or WITH...SELECT) queries are allowed. " +
        "Use execute_sql on a writable environment for other statements."
    );
  }

  for (const pattern of FORBIDDEN_IN_SELECT) {
    if (pattern.test(querySql)) {
      throw new Error(
        `Forbidden keyword detected in query: ${pattern.source.replace(/\\b/g, "")}. ` +
          `Only pure SELECT queries are permitted.`
      );
    }
  }
}

export function quoteIdentifier(name: string): string {
  return `[${name.replace(/]/g, "]]")}]`;
}
