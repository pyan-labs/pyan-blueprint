# Unified Config (.db-fetcher.json) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `.env` + `connections.json`을 프로젝트 워크스페이스 루트의 `.db-fetcher.json` 하나로 통합하고, MCP tool 인터페이스에서 `project`/`env` 파라미터를 제거하여 단순화한다.

**Architecture:** MCP 서버가 시작 시 CWD 상위 탐색으로 `.db-fetcher.json`을 찾아 로드. `open` 필드로 활성 환경을 결정. credential은 직접 값 또는 `$ENV_VAR` 참조 지원.

**Tech Stack:** TypeScript, Node.js, mssql, @modelcontextprotocol/sdk, zod

**Design Doc:** `docs/plans/2026-04-02-unified-config-design.md`

---

### Task 1: types.ts — 타입 정의 교체

**Files:**
- Modify: `db-first/mcp-db-fetcher/src/types.ts`

**Step 1: 새 타입 추가, 기존 타입 제거**

기존 `EnvType`, `ConnectionConfig`, `ProjectConfig`, `ConnectionsFile`을 삭제하고 새 타입으로 교체:

```typescript
// 삭제: EnvType, ConnectionConfig, ProjectConfig, ConnectionsFile

// 추가:
export interface ConnectionEntry {
  server: string;
  port?: number;
  database: string;
  credential: string;
  readonly?: boolean;
}

export interface DbFetcherConnections {
  open: string;
  [env: string]: string | ConnectionEntry;
}

export interface DbFetcherConfig {
  connections: DbFetcherConnections;
}
```

나머지 타입 (`ColumnInfo`, `TableInfo`, `RelationshipInfo` 등)은 그대로 유지. `ConnectionListItem`에서 `project` 필드 제거, `type` 필드 제거:

```typescript
export interface ConnectionListItem {
  env: string;
  database: string;
  server: string;
  readonly: boolean;
  is_open: boolean;        // open 환경 여부
  available: boolean;
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher lint`
Expected: 타입 참조 오류 발생 (아직 다른 파일들이 이전 타입 사용 중). 이 단계에서는 예상된 실패.

**Step 3: Commit**

```bash
git add db-first/mcp-db-fetcher/src/types.ts
git commit -m "refactor(types): replace project-based types with unified DbFetcherConfig"
```

---

### Task 2: connection-manager.ts — config 로드 및 연결 로직 전면 교체

**Files:**
- Modify: `db-first/mcp-db-fetcher/src/connection-manager.ts`

**Step 1: 전체 파일 교체**

```typescript
import sql from "mssql";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { ConnectionEntry, DbFetcherConfig, ConnectionListItem } from "./types.js";

const CONFIG_FILENAME = ".db-fetcher.json";
const pools = new Map<string, sql.ConnectionPool>();

let cachedConfig: DbFetcherConfig | null = null;

// ── Config Discovery ────────────────────────────────────────────────────────

function findConfigFile(startDir: string): string {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `${CONFIG_FILENAME} not found.\n` +
    `Searched from: ${startDir}\n` +
    `Copy .db-fetcher.example.json to your project root and fill in credentials.`
  );
}

export function loadConfig(startDir?: string): DbFetcherConfig {
  if (cachedConfig) return cachedConfig;
  const configPath = findConfigFile(startDir ?? process.cwd());
  const raw = readFileSync(configPath, "utf-8");
  cachedConfig = JSON.parse(raw) as DbFetcherConfig;
  console.error(`📂 Config loaded: ${configPath}`);
  return cachedConfig;
}

// ── Credential Resolution ───────────────────────────────────────────────────

function resolveCredential(credential: string): { user: string; password: string } {
  const raw = credential.startsWith("$")
    ? process.env[credential.slice(1)] ?? ""
    : credential;

  if (!raw) {
    throw new Error(
      `Credential not resolved. Value: "${credential}"\n` +
      (credential.startsWith("$")
        ? `Set env var: ${credential.slice(1)}`
        : `Credential string is empty`)
    );
  }

  return parseCredential(raw);
}

function parseCredential(connStr: string): { user: string; password: string } {
  const parts: Record<string, string> = {};
  connStr.split(";").forEach((part) => {
    const [key, ...rest] = part.split("=");
    if (key && rest.length) {
      parts[key.trim().toLowerCase().replace(/ /g, "")] = rest.join("=").trim();
    }
  });
  return {
    user: parts["userid"] ?? parts["uid"] ?? "",
    password: parts["password"] ?? parts["pwd"] ?? "",
  };
}

// ── Connection Pool ─────────────────────────────────────────────────────────

function getConnectionEntry(env?: string): { envName: string; entry: ConnectionEntry } {
  const config = loadConfig();
  const envName = env ?? config.connections.open;
  const entry = config.connections[envName];
  if (!entry || typeof entry === "string") {
    const available = Object.keys(config.connections).filter((k) => k !== "open");
    throw new Error(
      `Environment "${envName}" not found.\nAvailable: ${available.join(", ")}`
    );
  }
  return { envName, entry };
}

function buildSqlConfig(
  entry: ConnectionEntry,
  credential: { user: string; password: string }
): sql.config {
  const isAzure = entry.server.includes(".database.windows.net");
  return {
    server: entry.server,
    ...(entry.port ? { port: entry.port } : {}),
    database: entry.database,
    user: credential.user,
    password: credential.password,
    options: {
      encrypt: isAzure,
      trustServerCertificate: !isAzure,
      connectTimeout: 15000,
      requestTimeout: 30000,
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  };
}

export async function getPool(env?: string): Promise<sql.ConnectionPool> {
  const { envName, entry } = getConnectionEntry(env);

  const existing = pools.get(envName);
  if (existing?.connected) return existing;

  const credential = resolveCredential(entry.credential);
  const sqlConfig = buildSqlConfig(entry, credential);
  const pool = new sql.ConnectionPool(sqlConfig);

  await pool.connect();
  pools.set(envName, pool);
  return pool;
}

// ── Utility ─────────────────────────────────────────────────────────────────

export function getOpenEnv(): string {
  return loadConfig().connections.open;
}

export function isReadonly(env?: string): boolean {
  const { entry } = getConnectionEntry(env);
  return entry.readonly ?? false;
}

export function listConnections(): ConnectionListItem[] {
  const config = loadConfig();
  const openEnv = config.connections.open;
  const items: ConnectionListItem[] = [];

  for (const [envName, value] of Object.entries(config.connections)) {
    if (envName === "open" || typeof value === "string") continue;
    const entry = value as ConnectionEntry;
    const credentialOk = entry.credential.startsWith("$")
      ? !!process.env[entry.credential.slice(1)]
      : !!entry.credential;

    items.push({
      env: envName,
      database: entry.database,
      server: entry.server,
      readonly: entry.readonly ?? false,
      is_open: envName === openEnv,
      available: credentialOk,
    });
  }
  return items;
}

export async function closeAll(): Promise<void> {
  for (const pool of pools.values()) {
    await pool.close();
  }
  pools.clear();
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher lint`
Expected: 아직 queries/*.ts와 tools.ts에서 오류 (이전 시그니처 사용 중)

**Step 3: Commit**

```bash
git add db-first/mcp-db-fetcher/src/connection-manager.ts
git commit -m "refactor(connection-manager): CWD-based config discovery with unified .db-fetcher.json"
```

---

### Task 3: queries/*.ts — 함수 시그니처 단순화

**Files:**
- Modify: `db-first/mcp-db-fetcher/src/queries/tables.ts`
- Modify: `db-first/mcp-db-fetcher/src/queries/relationships.ts`
- Modify: `db-first/mcp-db-fetcher/src/queries/indexes.ts`
- Modify: `db-first/mcp-db-fetcher/src/queries/stored-procedures.ts`
- Modify: `db-first/mcp-db-fetcher/src/queries/data.ts`

**Step 1: 모든 query 함수에서 `project: string, env: EnvType` → `env?: string`으로 변경**

각 파일에서:
- `import type { ..., EnvType } from "../types.js"` → `EnvType` import 제거
- 함수 시그니처의 `project: string, env: EnvType` → `env?: string`
- `getPool(project, env)` → `getPool(env)`

**tables.ts:**
```typescript
import sql from "mssql";
import { getPool } from "../connection-manager.js";
import type { ColumnInfo, TableInfo } from "../types.js";

export async function getAllTables(
  schemaFilter?: string,
  env?: string
): Promise<{ table_name: string; schema_name: string; row_count: number }[]> {
  const pool = await getPool(env);
  // ... 나머지 SQL 동일
}

export async function getTableSchema(
  tableName: string,
  schemaName: string = "dbo",
  env?: string
): Promise<TableInfo> {
  const pool = await getPool(env);
  // ... 나머지 SQL 동일
}
```

**relationships.ts:**
```typescript
import sql from "mssql";
import { getPool } from "../connection-manager.js";
import type { RelationshipInfo } from "../types.js";

export async function getRelationships(
  tableName?: string,
  env?: string
): Promise<RelationshipInfo[]> {
  const pool = await getPool(env);
  // ... 나머지 SQL 동일
}
```

**indexes.ts:**
```typescript
import sql from "mssql";
import { getPool } from "../connection-manager.js";
import type { IndexInfo } from "../types.js";

export async function getIndexes(
  tableName?: string,
  env?: string
): Promise<IndexInfo[]> {
  const pool = await getPool(env);
  // ... 나머지 SQL 동일
}
```

**stored-procedures.ts:**
```typescript
import sql from "mssql";
import { getPool } from "../connection-manager.js";
import type { StoredProcedureInfo } from "../types.js";

export async function getStoredProcedures(
  schemaFilter?: string,
  env?: string
): Promise<StoredProcedureInfo[]> {
  const pool = await getPool(env);
  // ... 나머지 SQL 동일
}
```

**data.ts:**
```typescript
import { getPool, isReadonly } from "../connection-manager.js";
import type { SampleDataResult } from "../types.js";

export async function getSampleData(
  tableName: string,
  schemaName: string = "dbo",
  limit: number = 5,
  env?: string
): Promise<SampleDataResult> {
  const pool = await getPool(env);
  // readonly 판단: env === "prod" 하드코딩 → isReadonly(env) 사용
  const readonly = isReadonly(env);
  const maxRows = readonly ? 10 : 50;
  const safeLimit = Math.min(limit, maxRows);
  // ... 나머지 동일, note 메시지도 readonly 기반으로 변경
}

export async function runSelectQuery(
  querySql: string,
  env?: string
): Promise<{ rows: Record<string, unknown>[]; row_count: number; warning: string | null }> {
  // ... validation 동일
  const readonly = isReadonly(env);
  // env === "prod" 하드코딩 → readonly 사용
  if (readonly && !/\bTOP\b/i.test(querySql) && !/\bFETCH\b/i.test(querySql)) {
    // TOP 1000 삽입 로직 동일
  }
  const pool = await getPool(env);
  // ...
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher lint`
Expected: tools.ts에서만 오류 (아직 이전 시그니처 호출 중)

**Step 3: Commit**

```bash
git add db-first/mcp-db-fetcher/src/queries/
git commit -m "refactor(queries): simplify function signatures - remove project/env params"
```

---

### Task 4: tools.ts — MCP tool 인터페이스 단순화

**Files:**
- Modify: `db-first/mcp-db-fetcher/src/tools.ts`

**Step 1: 전체 파일 교체**

핵심 변경:
- `ProjectEnvSchema` 제거
- 모든 tool에서 `project`, `env` 필수 파라미터 제거
- 선택적 `env` 파라미터 추가 (명시하면 해당 환경, 생략하면 `open` 사용)
- tool description 업데이트

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listConnections, getOpenEnv } from "./connection-manager.js";
import { getAllTables, getTableSchema } from "./queries/tables.js";
import { getRelationships } from "./queries/relationships.js";
import { getIndexes } from "./queries/indexes.js";
import { getStoredProcedures } from "./queries/stored-procedures.js";
import { getSampleData, runSelectQuery } from "./queries/data.js";

function jsonResponse(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const OptionalEnvSchema = {
  env: z.string().optional().describe(
    'Environment override. Omit to use the "open" environment from .db-fetcher.json.'
  ),
};

export function registerTools(server: McpServer) {
  server.tool(
    "list_connections",
    "List all configured DB environments from .db-fetcher.json with the current open environment marked.",
    {},
    async () => {
      const connections = listConnections();
      return jsonResponse({
        open_env: getOpenEnv(),
        connections,
      });
    }
  );

  server.tool(
    "get_all_tables",
    "Get all user tables in the database with row counts.",
    {
      schema_filter: z.string().optional().describe('Optional schema filter (e.g. "dbo").'),
      ...OptionalEnvSchema,
    },
    async ({ schema_filter, env }: { schema_filter?: string; env?: string }) => {
      const tables = await getAllTables(schema_filter, env);
      return jsonResponse({ env: env ?? getOpenEnv(), table_count: tables.length, tables });
    }
  );

  server.tool(
    "get_table_schema",
    "Get detailed schema for a specific table: columns, types, nullable, PK, identity, defaults. " +
      "ALWAYS call this before generating Entity classes, DTOs, or API code.",
    {
      table_name: z.string().describe("Table name (case-insensitive)"),
      schema_name: z.string().optional().default("dbo").describe('Schema name. Default: "dbo"'),
      ...OptionalEnvSchema,
    },
    async ({ table_name, schema_name, env }: { table_name: string; schema_name: string; env?: string }) => {
      const schema = await getTableSchema(table_name, schema_name, env);
      return jsonResponse({ env: env ?? getOpenEnv(), ...schema });
    }
  );

  server.tool(
    "get_relationships",
    "Get FK relationships for a table (or all tables).",
    {
      table_name: z.string().optional().describe("Optional table name filter."),
      ...OptionalEnvSchema,
    },
    async ({ table_name, env }: { table_name?: string; env?: string }) => {
      const relationships = await getRelationships(table_name, env);
      return jsonResponse({
        env: env ?? getOpenEnv(),
        filter_table: table_name ?? "all",
        relationship_count: relationships.length,
        relationships,
      });
    }
  );

  server.tool(
    "get_indexes",
    "Get indexes for a table (or all tables).",
    {
      table_name: z.string().optional().describe("Optional table name filter."),
      ...OptionalEnvSchema,
    },
    async ({ table_name, env }: { table_name?: string; env?: string }) => {
      const indexes = await getIndexes(table_name, env);
      return jsonResponse({
        env: env ?? getOpenEnv(),
        filter_table: table_name ?? "all",
        index_count: indexes.length,
        indexes,
      });
    }
  );

  server.tool(
    "get_stored_procedures",
    "Get stored procedures with parameters and definition preview.",
    {
      schema_filter: z.string().optional().describe('Optional schema filter (e.g. "dbo")'),
      ...OptionalEnvSchema,
    },
    async ({ schema_filter, env }: { schema_filter?: string; env?: string }) => {
      const sps = await getStoredProcedures(schema_filter, env);
      return jsonResponse({ env: env ?? getOpenEnv(), sp_count: sps.length, stored_procedures: sps });
    }
  );

  server.tool(
    "get_sample_data",
    "Get sample rows from a table. Readonly environments: max 10 rows. Others: max 50 rows.",
    {
      table_name: z.string().describe("Table name"),
      schema_name: z.string().optional().default("dbo"),
      limit: z.number().int().min(1).max(50).optional().default(5).describe("Number of rows (default: 5)"),
      ...OptionalEnvSchema,
    },
    async ({ table_name, schema_name, limit, env }: { table_name: string; schema_name: string; limit: number; env?: string }) => {
      const result = await getSampleData(table_name, schema_name, limit, env);
      return jsonResponse({ env: env ?? getOpenEnv(), ...result });
    }
  );

  server.tool(
    "run_select_query",
    "Run a custom SELECT query. Only SELECT allowed. Readonly environments: auto-capped at 1000 rows.",
    {
      sql: z.string().describe("SELECT query to execute. Must start with SELECT or WITH."),
      ...OptionalEnvSchema,
    },
    async ({ sql: querySql, env }: { sql: string; env?: string }) => {
      const result = await runSelectQuery(querySql, env);
      return jsonResponse({ env: env ?? getOpenEnv(), ...result });
    }
  );
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher lint`
Expected: PASS — 모든 타입/시그니처 정합

**Step 3: Commit**

```bash
git add db-first/mcp-db-fetcher/src/tools.ts
git commit -m "refactor(tools): simplify MCP tool interfaces - remove project/env required params"
```

---

### Task 5: index.ts — dotenv 제거, config 초기 로드

**Files:**
- Modify: `db-first/mcp-db-fetcher/src/index.ts`

**Step 1: dotenv 관련 코드 제거, config 로드 추가**

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { closeAll, loadConfig } from "./connection-manager.js";
import { registerTools } from "./tools.js";

// Load .db-fetcher.json at startup (validates config exists)
loadConfig();

const server = new McpServer({
  name: "db-fetcher",
  version: "2.0.0",
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ mcp:db-fetcher started (stdio transport)");
}

process.on("SIGINT", async () => {
  await closeAll();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeAll();
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add db-first/mcp-db-fetcher/src/index.ts
git commit -m "refactor(index): remove dotenv, add config load at startup"
```

---

### Task 6: package.json — dotenv 의존성 제거

**Files:**
- Modify: `db-first/mcp-db-fetcher/package.json`

**Step 1: dotenv 제거**

`dependencies`에서 `"dotenv": "^16.4.5"` 삭제.

**Step 2: 의존성 재설치**

Run: `pnpm install`

**Step 3: Commit**

```bash
git add db-first/mcp-db-fetcher/package.json pnpm-lock.yaml
git commit -m "chore: remove dotenv dependency"
```

---

### Task 7: 빌드 및 번들 생성

**Files:**
- Output: `db-first/mcp-db-fetcher/dist/index.js`

**Step 1: 타입 체크**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher lint`
Expected: PASS

**Step 2: 빌드**

Run: `pnpm --filter @pyanllc/mcp-db-fetcher build`
Expected: `dist/index.js` 생성

**Step 3: Commit**

```bash
git add db-first/mcp-db-fetcher/dist/
git commit -m "build: rebuild dist/index.js with unified config"
```

---

### Task 8: .db-fetcher.example.json 템플릿 생성

**Files:**
- Create: `db-first/.db-fetcher.example.json`

**Step 1: 템플릿 파일 작성**

```jsonc
{
  "connections": {
    "open": "dev",
    "dev": {
      "server": "localhost",
      "port": 1433,
      "database": "<YOUR_DATABASE>",
      "credential": "User Id=sa;Password=<YOUR_PASSWORD>",
      "readonly": false
    },
    "prod": {
      "server": "<YOUR_SERVER>.database.windows.net",
      "database": "<YOUR_DATABASE>",
      "credential": "User Id=<YOUR_USER>;Password=<YOUR_PASSWORD>",
      "readonly": true
    }
  }
}
```

**Step 2: Commit**

```bash
git add db-first/.db-fetcher.example.json
git commit -m "feat: add .db-fetcher.example.json template"
```

---

### Task 9: 기존 설정 파일 정리

**Files:**
- Delete: `db-first/mcp-db-fetcher/connections.json`
- Delete: `db-first/mcp-db-fetcher/.env.example`
- Keep (gitignored): `db-first/mcp-db-fetcher/.env` — 자동 무시됨

**Step 1: 파일 삭제**

```bash
git rm db-first/mcp-db-fetcher/connections.json
git rm db-first/mcp-db-fetcher/.env.example
```

**Step 2: Commit**

```bash
git commit -m "chore: remove connections.json and .env.example (replaced by .db-fetcher.json)"
```

---

### Task 10: 문서 업데이트 — InjectDB-Fetcher.md, Skills, CLAUDE.md

**Files:**
- Modify: `db-first/InjectDB-Fetcher.md`
- Modify: `db-first/skills/db-to-efcore/SKILL.md`
- Modify: `db-first/skills/db-to-rest-api/SKILL.md`
- Modify: `db-first/skills/db-to-frontend/SKILL.md`
- Modify: `CLAUDE.md`

**Step 1: InjectDB-Fetcher.md 업데이트**

핵심 변경:
- "project/env" 언급 → "env" 또는 제거
- `list_connections → confirm project + env` → `list_connections → confirm open environment`
- 환경 규칙에서 "dev"/"prod" 하드코딩 → `open` 환경 기반으로 설명
- Projects Reference 테이블 → 제거 (프로젝트 개념 없어짐)
- `connections.json` 언급 → `.db-fetcher.json`으로 변경

**Step 2: Skills SKILL.md 업데이트**

각 스킬에서 `list_connections → 사용 가능한 project/env 확인` → `list_connections → open 환경 확인` 으로 변경.

**Step 3: CLAUDE.md 업데이트**

- MCP 서버 데이터 흐름 설명에서 `getPool(project, env)` → `getPool(env?)` 
- `connections.json` 언급 → `.db-fetcher.json`으로 변경
- 프로젝트 목록 테이블 → `.db-fetcher.json`으로 관리된다는 안내로 교체
- 새 프로젝트 추가 안내 → `.db-fetcher.json`에 환경 추가하라는 안내로 교체

**Step 4: Commit**

```bash
git add db-first/InjectDB-Fetcher.md db-first/skills/ CLAUDE.md
git commit -m "docs: update all documentation for unified .db-fetcher.json config"
```

---

### Task 11: plugin.json 버전 업데이트

**Files:**
- Modify: `db-first/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

**Step 1: 버전을 `2.0.0`으로 업데이트**

Breaking change (tool 인터페이스 변경)이므로 major 버전 업.

**Step 2: Commit**

```bash
git add db-first/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore: bump version to 2.0.0 (breaking: unified config)"
```
