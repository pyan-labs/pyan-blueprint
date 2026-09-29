# Connection Config Simplification Design

**Date:** 2026-04-03
**Status:** Approved
**Scope:** `db-first/mcp-db-fetcher`

## Problem

현재 `.db-fetcher.json`의 `credential` 필드가 ADO.NET connection string 조각(`"User Id=sa;Password=xxx"`)으로 되어 있어 직관적이지 않고, `$ENV_VAR` 참조 로직이 불필요한 복잡성을 추가한다.

## Decision

**Clean Break** — `credential` 필드를 제거하고 개별 필드로 분리. `$ENV_VAR` 로직 삭제.

## New `.db-fetcher.json` Format

```json
{
  "connections": {
    "open": "dev",
    "dev": {
      "server": "localhost",
      "port": 1433,
      "database": "MyDatabase",
      "authentication": "sql",
      "user": "sa",
      "password": "MyPassword",
      "encrypt": true,
      "trustServerCertificate": true,
      "readonly": false
    },
    "prod": {
      "server": "myserver.database.windows.net",
      "database": "MyDatabase",
      "authentication": "sql",
      "user": "admin",
      "password": "ProdPassword",
      "encrypt": true,
      "trustServerCertificate": false,
      "readonly": true
    }
  }
}
```

### Field Definitions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `server` | string | Yes | - | DB server hostname |
| `port` | number | No | 1433 | DB server port |
| `database` | string | Yes | - | Database name |
| `authentication` | `"sql"` \| `"windows"` | No | `"sql"` | Authentication type |
| `user` | string | sql only | - | SQL Server login username |
| `password` | string | sql only | - | SQL Server login password |
| `encrypt` | boolean | No | `true` | Encrypt connection |
| `trustServerCertificate` | boolean | No | `false` | Trust server certificate (dev: true) |
| `readonly` | boolean | No | `false` | Read-only enforcement |

- `authentication: "windows"` 시 `user`/`password` 무시

## Changes

### 1. `types.ts` — `ConnectionEntry` 수정

- Remove: `credential: string`
- Add: `authentication?: "sql" | "windows"`, `user?: string`, `password?: string`, `encrypt?: boolean`, `trustServerCertificate?: boolean`

### 2. `connection-manager.ts`

- Delete: `parseCredential()`, `resolveCredential()`
- Modify: `buildSqlConfig()` — entry 필드 직접 사용, `isAzure` 자동감지 제거
- Modify: `listConnections()` — `$ENV_VAR` available 체크 로직 제거

### 3. `.db-fetcher.example.json`

- 새 형식으로 교체
