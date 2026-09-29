# Unified Config Design: .db-fetcher.json

## Problem

플러그인 설치 후 사용자가 관리해야 하는 설정 파일이 3개 (`.mcp.json`, `.env`, `connections.json`)로 분산되어 있고, 플러그인 캐시 디렉토리 깊숙이 위치해 찾기 어렵다.

## Solution

`.env`와 `connections.json`을 **프로젝트 워크스페이스 루트의 `.db-fetcher.json` 하나로 통합**. `.mcp.json`은 connection 무관한 순수 실행 설정으로 유지.

## Config File Structure

### `.db-fetcher.json` (workspace root, `.gitignore` 대상)

```jsonc
{
  "connections": {
    "open": "dev",              // 현재 활성 환경
    "dev": {
      "server": "localhost",
      "port": 1433,
      "database": "BAW_Dev",
      "credential": "User Id=sa;Password=mypass123",
      "readonly": false
    },
    "staging": {
      "server": "staging-sql.database.windows.net",
      "database": "BAW_Staging",
      "credential": "$BAW_STAGING_CONN",   // $로 시작 → 환경변수 참조
      "readonly": true
    },
    "prod": {
      "server": "baw-sql.database.windows.net",
      "database": "BAW_Prod",
      "credential": "User Id=baw_reader;Password=prodpass",
      "readonly": true
    }
  }
}
```

### `.db-fetcher.example.json` (git 커밋, 팀 공유용)

credential 부분만 `<YOUR_PASSWORD>` placeholder. 팀원은 복사 후 credential만 채워 사용.

### `.mcp.json` (변경 없음)

```jsonc
{
  "mcpServers": {
    "db-fetcher": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/mcp-db-fetcher/dist/index.js"],
      "env": {}
    }
  }
}
```

## MCP Server Behavior Changes

### Config Discovery

MCP 서버 시작 시 `process.cwd()`부터 상위 디렉토리로 `.db-fetcher.json`을 탐색. 못 찾으면 에러: `".db-fetcher.json not found. Copy .db-fetcher.example.json and fill in credentials."`

### Credential Resolution

- 값이 `$`로 시작 → `process.env[value.slice(1)]` 참조
- 그 외 → 직접 ADO.NET connection string으로 파싱

### Tool Interface Simplification

| Before | After |
|--------|-------|
| `get_all_tables(project, env)` | `get_all_tables()` |
| `get_table_schema(project, env, table)` | `get_table_schema(table)` |
| `get_relationships(project, env, ...)` | `get_relationships(...)` |
| `get_indexes(project, env, ...)` | `get_indexes(...)` |
| `get_stored_procedures(project, env)` | `get_stored_procedures()` |
| `get_sample_data(project, env, table)` | `get_sample_data(table)` |
| `run_select_query(project, env, query)` | `run_select_query(query)` |
| `list_connections()` | `list_connections()` — 현재 파일의 모든 환경 + open 표시 |

기본은 `open` 환경 사용. 선택적 `env` 파라미터로 다른 환경 명시 가능.

## Type Changes

### New Types

```typescript
interface ConnectionEntry {
  server: string;
  port?: number;
  database: string;
  credential: string;        // 직접 값 또는 "$ENV_VAR"
  readonly?: boolean;        // default false
}

interface DbFetcherConfig {
  connections: {
    open: string;
    [env: string]: string | ConnectionEntry;
  };
}
```

### Removed Types

- `ProjectConfig` — 프로젝트 계층 제거
- `ConnectionsFile` — `DbFetcherConfig`로 대체
- `EnvType` (`"dev" | "prod"`) — `string`으로 변경 (자유 확장)

## Files Removed

- `mcp-db-fetcher/connections.json`
- `mcp-db-fetcher/.env`
- `mcp-db-fetcher/.env.example`
- `dotenv` dependency

## Files Added

- `.db-fetcher.example.json` (플러그인 내 템플릿)

## Files Modified

- `mcp-db-fetcher/src/connection-manager.ts` — config 로드 로직 전면 교체
- `mcp-db-fetcher/src/types.ts` — 타입 교체
- `mcp-db-fetcher/src/tools.ts` — project/env 파라미터 제거, open 기본값 사용
- `mcp-db-fetcher/src/index.ts` — dotenv 제거, config 로드 추가
