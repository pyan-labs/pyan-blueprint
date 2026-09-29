# Connection Config Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `credential` ADO.NET 문자열 + `$ENV_VAR` 로직을 제거하고, `user`/`password`/`authentication`/`encrypt`/`trustServerCertificate` 개별 필드로 교체한다.

**Architecture:** `.db-fetcher.json` 형식 변경 → `ConnectionEntry` 타입 수정 → `connection-manager.ts`에서 파싱/환경변수 함수 삭제 및 직접 필드 사용 → `tools.ts` hint 메시지 정리

**Tech Stack:** TypeScript, mssql (node-mssql), esbuild

---

### Task 1: `ConnectionEntry` 타입 수정

**Files:**
- Modify: `db-first/mcp-db-fetcher/src/types.ts:1-7`

**Step 1: `ConnectionEntry` 인터페이스 변경**

`credential: string`을 제거하고 새 필드를 추가한다:

```typescript
export interface ConnectionEntry {
  server: string;
  port?: number;
  database: string;
  authentication?: "sql" | "windows";
  user?: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  readonly?: boolean;
}
```

**Step 2: 타입 체크 실행**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher exec tsc --noEmit`
Expected: `credential` 참조 에러 발생 (connection-manager.ts에서). 이것은 정상 — Task 2에서 수정.

---

### Task 2: `connection-manager.ts` 리팩터링

**Files:**
- Modify: `db-first/mcp-db-fetcher/src/connection-manager.ts`

**Step 1: `parseCredential()` 함수 삭제 (L40-53)**

```typescript
// DELETE 전체 함수
function parseCredential(connStr: string): { user: string; password: string } {
  ...
}
```

**Step 2: `resolveCredential()` 함수 삭제 (L55-73)**

```typescript
// DELETE 전체 함수
function resolveCredential(credential: string): { user: string; password: string } {
  ...
}
```

**Step 3: `buildSqlConfig()` 수정 (L108-132)**

credential 인자를 제거하고 entry에서 직접 읽도록 변경:

```typescript
function buildSqlConfig(entry: ConnectionEntry): sql.config {
  const config: sql.config = {
    server: entry.server,
    ...(entry.port ? { port: entry.port } : {}),
    database: entry.database,
    options: {
      encrypt: entry.encrypt ?? true,
      trustServerCertificate: entry.trustServerCertificate ?? false,
      connectTimeout: 15000,
      requestTimeout: 30000,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if ((entry.authentication ?? "sql") === "windows") {
    (config.options as Record<string, unknown>).trustedConnection = true;
  } else {
    config.user = entry.user;
    config.password = entry.password;
  }

  return config;
}
```

**Step 4: `getPool()` 수정 (L134-153)**

`resolveCredential` 호출을 제거하고 `buildSqlConfig(entry)` 직접 호출:

```typescript
export async function getPool(env?: string): Promise<sql.ConnectionPool> {
  const config = requireConfig();
  const resolvedEnv = env ?? config.connections.open;
  const key = resolvedEnv;

  const existing = pools.get(key);
  if (existing?.connected) {
    return existing;
  }

  const entry = getConnectionEntry(resolvedEnv);
  const sqlConfig = buildSqlConfig(entry);
  const pool = new sql.ConnectionPool(sqlConfig);

  await pool.connect();
  pools.set(key, pool);

  return pool;
}
```

**Step 5: `listConnections()` 수정 (L157-183)**

`$ENV_VAR` available 체크 로직을 제거. 모든 connection은 항상 available:

```typescript
export function listConnections(): ConnectionListItem[] {
  const config = requireConfig();
  const items: ConnectionListItem[] = [];
  const openEnv = config.connections.open;

  for (const [envName, value] of Object.entries(config.connections)) {
    if (envName === "open") continue;
    if (typeof value === "string") continue;

    const entry = value as ConnectionEntry;

    items.push({
      env: envName,
      server: entry.server,
      database: entry.database,
      readonly: entry.readonly ?? false,
      is_open: envName === openEnv,
      available: true,
    });
  }

  return items;
}
```

**Step 6: 타입 체크 실행**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher exec tsc --noEmit`
Expected: PASS (에러 없음)

---

### Task 3: `tools.ts` hint 메시지 정리

**Files:**
- Modify: `db-first/mcp-db-fetcher/src/tools.ts:54-55`

**Step 1: unavailable hint 메시지 수정**

L54-55에서 credential 관련 hint를 제거. `listConnections()`가 항상 available을 반환하므로 unavailable 분기 자체가 비어있겠지만, 안전하게 메시지만 수정:

```typescript
        unavailable_connections: unavailable.map((c) => ({
          ...c,
          hint: `Check connection settings in .db-fetcher.json`,
        })),
```

**Step 2: 타입 체크 실행**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher exec tsc --noEmit`
Expected: PASS

---

### Task 4: `.db-fetcher.example.json` 업데이트

**Files:**
- Modify: `db-first/.db-fetcher.example.json`

**Step 1: 새 형식으로 교체**

```json
{
  "connections": {
    "open": "dev",
    "dev": {
      "server": "localhost",
      "port": 1433,
      "database": "<YOUR_DATABASE>",
      "authentication": "sql",
      "user": "sa",
      "password": "<YOUR_PASSWORD>",
      "encrypt": true,
      "trustServerCertificate": true,
      "readonly": false
    },
    "prod": {
      "server": "<YOUR_SERVER>.database.windows.net",
      "database": "<YOUR_DATABASE>",
      "authentication": "sql",
      "user": "<YOUR_USER>",
      "password": "<YOUR_PASSWORD>",
      "encrypt": true,
      "trustServerCertificate": false,
      "readonly": true
    }
  }
}
```

---

### Task 5: CLAUDE.md credential 참조 정리

**Files:**
- Modify: `CLAUDE.md`

**Step 1: credential 관련 문구 업데이트**

CLAUDE.md에서 `credential` 관련 설명을 새 형식에 맞게 수정. 구체적으로:
- `.db-fetcher.json` 설명에서 credential 형식 언급이 있다면 새 필드 목록으로 교체

---

### Task 6: 빌드 및 검증

**Step 1: 빌드 실행**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher build`
Expected: `dist/index.js` 생성, 에러 없음

**Step 2: 빌드 결과에 credential 잔재 없는지 확인**

Run: `grep -c "parseCredential\|resolveCredential" db-first/mcp-db-fetcher/dist/index.js`
Expected: 0 (해당 함수 없음)

**Step 3: 커밋**

```bash
git add db-first/mcp-db-fetcher/src/types.ts
git add db-first/mcp-db-fetcher/src/connection-manager.ts
git add db-first/mcp-db-fetcher/src/tools.ts
git add db-first/.db-fetcher.example.json
git add db-first/mcp-db-fetcher/dist/index.js
git add CLAUDE.md
git commit -m "refactor: replace credential string with individual connection fields

- Remove credential ADO.NET string field from ConnectionEntry
- Add authentication, user, password, encrypt, trustServerCertificate fields
- Delete parseCredential() and resolveCredential() functions
- Remove $ENV_VAR reference logic
- Update .db-fetcher.example.json to new format"
```
