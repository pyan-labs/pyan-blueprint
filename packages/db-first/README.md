# DB-First Plugin Setup Guide

Claude/Codex에서 사용자 단위로 설치하고, 각 프로젝트의 `.db-fetcher.json`으로 해당 프로젝트의 DB에 연결합니다. 서버 설치 위치에 DB 설정을 복사하거나 프로젝트마다 MCP 서버를 등록할 필요가 없습니다.

Claude는 기존 `CLAUDE_PROJECT_DIR` 탐색을 지원합니다. Codex는 플러그인 MCP에 프로젝트 경로를 자동 주입하지 않는 버전도 지원하도록, 스킬이 모든 도구 호출에 현재 프로젝트의 절대 경로 `project_dir`를 전달합니다. Codex용 서버는 이 인자를 필수로 요구합니다. 경로는 호출 단위로 적용하며, 같은 프로세스의 도구 호출을 순서대로 처리하여 다른 프로젝트의 연결과 섞이지 않게 합니다.

## Prerequisites

### MS SQL Server 버전

SQL Server 2017 이상을 권장합니다. 일반적으로 기존 DB의 compatibility level 변경은 필요하지 않습니다.

만약 `get_indexes` 호출 시 `STRING_AGG` 관련 오류가 발생하면, 해당 DB의 compatibility level이 낮을 수 있으니 다음으로 확인하세요:

```sql
SELECT name, compatibility_level FROM sys.databases WHERE name = DB_NAME();
```

130 미만인 경우에만 업그레이드를 검토하세요.

## Installation

### 1. 플러그인 설치 (user scope 권장)

Claude Code 대화창에서:

```
/plugin marketplace add pyan-labs/pyan-blueprint
/plugin install db-first
```

설치 위치(scope)를 물어보면 **user (전역)** 을 권장합니다. 한 번 설치해 두면 모든 프로젝트에서 쓸 수 있고, `db-fetcher`는 Claude Code가 주입하는 `CLAUDE_PROJECT_DIR`(세션을 연 디렉토리)에서 시작해 `.db-fetcher.json`을 찾으므로 user scope에서도 정상 동작합니다. 탐색 순서는 아래 "설정 파일 탐색 순서"를 참조하세요.

Codex에서는 `pyan-blueprint` 마켓플레이스의 `db-first`를 사용자 단위로 설치한 뒤 프로젝트에서 `db-to-efcore` 스킬을 사용합니다. 도구를 직접 호출할 때에도 매번 `project_dir`에 현재 프로젝트의 절대 경로를 넣습니다. `list_connections`의 `config_path`가 의도한 프로젝트 설정인지 확인한 뒤 조회합니다. 플러그인 캐시 경로를 프로젝트 경로로 사용하면 안 됩니다.

### 2. DB 연결 설정

프로젝트 루트에 `.db-fetcher.json` 파일을 생성합니다. `.db-fetcher.example.json`을 참조하세요:

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

- `open`: 기본으로 사용할 환경 이름 (위 예시에서는 `dev`)
- `readonly`: 생략하면 `true`입니다. 쓰기를 허용할 환경에만 `"readonly": false`를 명시합니다. 아래 "환경별 권한"을 참조하세요

#### 환경별 권한

| | `"readonly": false` (dev) | `readonly` 생략 또는 `true` (prod) |
|---|---|---|
| 스키마·데이터 조회 tool | 사용 가능 | 사용 가능 (`get_sample_data` 10행, `run_select_query` 1000행 제한) |
| `execute_sql` (DDL·DML·EXEC 등 모든 T-SQL) | 사용 가능 | 거부 |
| 연결 계정 | 제한 없음 (sa 가능) | **쓰기 권한이 없는 계정만** 연결 허용 |

prod는 두 겹으로 막습니다.

1. **DB 계정 권한 (실제 차단).** readonly 환경에 연결하면 서버가 먼저 계정 권한을 확인합니다. DB 수준에서 `CONNECT`, `SELECT`, `SHOWPLAN`, `VIEW …` 외의 권한이 있거나, 테이블·뷰에 `INSERT`/`UPDATE`/`DELETE`/`ALTER` 권한이 있거나, 프로시저에 `EXECUTE`/`ALTER` 권한이 있으면 연결을 거부합니다. prod에 sa나 db_owner 계정을 넣으면 오류가 납니다.
2. **MCP 서버 (실수 방지).** `run_select_query`는 SELECT만 받고 쓰기 키워드를 차단합니다. readonly 환경에서는 쿼리를 트랜잭션 안에서 실행하고 항상 롤백합니다. `execute_sql`은 readonly 환경에서 실행하지 않습니다.

`.db-fetcher.json`은 누구나(에이전트 포함) 고칠 수 있는 파일입니다. 그러니 prod를 실제로 보호하는 것은 1번의 DB 계정 권한입니다. prod에는 아래처럼 조회 전용 계정을 만들어 씁니다.

```sql
-- Azure SQL Database (contained user). 대상 DB에서 실행
CREATE USER mcp_reader WITH PASSWORD = '<STRONG_PASSWORD>';
ALTER ROLE db_datareader ADD MEMBER mcp_reader;   -- 데이터 조회
GRANT VIEW DEFINITION TO mcp_reader;               -- 스키마·SP 정의 조회

-- SQL Server (login + user)
-- CREATE LOGIN mcp_reader WITH PASSWORD = '<STRONG_PASSWORD>';
-- USE <YOUR_DATABASE>;
-- CREATE USER mcp_reader FOR LOGIN mcp_reader;
-- ALTER ROLE db_datareader ADD MEMBER mcp_reader;
-- GRANT VIEW DEFINITION TO mcp_reader;
```

> **주의:** 계정 검사는 연결한 DB 하나만 봅니다. 같은 로그인이 다른 DB나 서버 수준 권한을 갖지 않게 하세요. 기존 설정에서 dev에 `readonly`를 적지 않고 sa를 쓰고 있었다면, 이제 연결이 거부되므로 `"readonly": false`를 추가해야 합니다.

#### 설정 파일 탐색 순서

`project_dir`를 전달한 호출은 해당 디렉토리 → 상위 디렉토리 순서로만 탐색하며, 홈의 전역 설정으로 대체하지 않습니다. 설정이 없으면 오류를 반환합니다. 아래 전역 fallback은 `project_dir` 없이 호출하는 기존 Claude/직접 실행 호환 모드에만 적용됩니다.

`db-fetcher`는 `.db-fetcher.json`을 아래 순서로 찾고, **먼저 발견된 파일 하나만** 사용합니다. 여러 파일의 내용을 합치지 않습니다.

| 순서 | scope | 위치 |
|---|---|---|
| 1 | `local` | 세션을 연 디렉토리 |
| 2 | `parent` | 그 상위 디렉토리들 (위로 올라가며) |
| 3 | `global` | 사용자 홈의 `~/.db-fetcher.json` (Windows: `%USERPROFILE%\.db-fetcher.json`) |

- 여러 프로젝트가 같은 DB를 쓴다면 `~/.db-fetcher.json` 하나만 두어도 됩니다
- 어떤 파일을 읽었는지는 `list_connections` 응답의 `config_path`·`config_scope`로 확인합니다. umbrella repo처럼 상위·하위 폴더에 파일이 함께 있을 때는 **쿼리 전에 이 값을 먼저 확인하세요**
- 파일을 추가·수정·삭제하면 다음 tool 호출부터 반영됩니다. 서버를 재시작할 필요가 없습니다. 설정이 바뀌면 기존 DB 연결은 닫고 새로 맺습니다

### 3. .ignore에 추가 (필수)

`.db-fetcher.json`에는 DB 접속 정보(비밀번호 등)가 포함되므로, **반드시** `.ignore`에 추가해야 합니다:

```
# DB Fetcher config (contains credentials)
.db-fetcher.json
```

> **Warning:** 이 파일을 ignore 처리하지 않으면 DB 자격 증명이 노출될 수 있습니다.
