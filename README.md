# pyan-blueprint

우리 팀의 **Claude/Codex 플러그인 마켓플레이스**입니다. 두 플러그인을 배포합니다.

| 플러그인 | 내용 |
| --- | --- |
| `db-first` | MS SQL 스키마를 읽는 MCP 서버(`db-fetcher`) + EF Core 생성 스킬 |
| `dev-kit` | pyan 개발 팀 공통 스킬 (`commit` 등) → [packages/dev-kit/README.md](packages/dev-kit/README.md) |

## db-first = db-fetcher

`db-first`의 핵심은 **`db-fetcher` MCP 서버**입니다. Claude나 Codex가 실제 MS SQL DB에 접속해 스키마·관계·인덱스·SP·데이터를 직접 읽게 해 줍니다. 에이전트가 테이블 구조를 추측하지 않고 DB에서 확인한 뒤 코드를 씁니다.

- 프로젝트마다 `.db-fetcher.json` 하나로 연결을 정합니다.
- dev는 sa로 모든 작업을, prod는 조회만 하도록 환경별로 권한을 강제합니다.
- 스킬(`db-to-efcore`)은 db-fetcher 위에 얹은 사용 예입니다. 스킬 없이 "Orders 테이블 구조 보여줘"처럼 요청해도 db-fetcher를 씁니다.

```
사용자: Orders 테이블로 EF Core entity 만들어줘

Claude: db-fetcher로 Orders의 컬럼·PK·FK·인덱스를 읽고
  → 실제 스키마 그대로 Entity + Fluent API + DbContext 생성
```

---

## 🚀 설치

Claude Code 대화창에서:

```
/plugin marketplace add pyan-labs/pyan-blueprint
/plugin install db-first@pyan-blueprint   # scope를 물어보면 user 선택 권장
/plugin install dev-kit@pyan-blueprint
```

Codex CLI는 터미널에서:

```powershell
codex plugin marketplace add pyan-labs/pyan-blueprint
codex plugin add db-first@pyan-blueprint
codex plugin add dev-kit@pyan-blueprint
```

설치하면 db-fetcher가 MCP 서버로 자동 등록됩니다. 업데이트, 제거, 문제 해결 → [docs/plugin-marketplace.md](docs/plugin-marketplace.md)

---

## 🔌 연결 설정 — `.db-fetcher.json`

프로젝트 루트에 `.db-fetcher.json`을 둡니다. 템플릿: [packages/db-first/.db-fetcher.example.json](packages/db-first/.db-fetcher.example.json)

```json
{
  "connections": {
    "open": "dev",
    "dev":  { "server": "localhost", "database": "MyDb", "user": "sa", "password": "...", "readonly": false },
    "prod": { "server": "myserver.database.windows.net", "database": "MyDb", "user": "mcp_reader", "password": "..." }
  }
}
```

- `open`: tool 호출에서 `env`를 생략했을 때 쓰는 환경
- `readonly`: 생략하면 `true`(조회 전용). 쓰기를 허용할 환경에만 `false`를 적습니다
- 파일은 현재 프로젝트 → 상위 디렉토리 → `~/.db-fetcher.json` 순으로 찾고, 처음 찾은 하나만 씁니다. 어떤 파일을 읽었는지는 `list_connections`의 `config_path`로 확인합니다
- 수정하면 다음 호출부터 반영됩니다 (재시작 불필요)
- **비밀번호가 들어가므로 반드시 `.gitignore`에 추가하세요**

---

## 🧰 db-fetcher tools

| Tool                    | 기능                                         |
| ----------------------- | -------------------------------------------- |
| `list_connections`      | 환경 목록, 읽은 설정 파일 경로 — **가장 먼저 호출** |
| `get_all_tables`        | 전체 테이블 + row count                      |
| `get_table_schema`      | 컬럼, 타입, PK, nullable, identity, 기본값, 설명 |
| `get_relationships`     | FK 관계                                      |
| `get_indexes`           | 인덱스 정보                                  |
| `get_stored_procedures` | SP 목록 + 파라미터 + 정의 미리보기           |
| `get_sample_data`       | 샘플 데이터 (readonly: 10행, 그 외: 50행)    |
| `run_select_query`      | Ad-hoc SELECT (readonly: 1000행 제한)        |
| `execute_sql`           | 모든 T-SQL 실행 (`"readonly": false` 환경만)  |

모든 tool은 `env`로 환경을 고를 수 있고, 생략하면 `open` 환경을 씁니다.

---

## 🔐 환경별 권한 (dev / prod)

| | `"readonly": false` (dev) | `readonly` 생략 또는 `true` (prod) |
|---|---|---|
| 조회 tool | 사용 가능 | 사용 가능 (행 수 제한) |
| `execute_sql` (DDL·DML·EXEC 등) | 사용 가능 | 거부 |
| 연결 계정 | 제한 없음 (sa 가능) | **쓰기 권한이 없는 계정만** 연결 허용 |

prod는 두 겹으로 막습니다.

1. **DB 계정 권한 (실제 차단).** readonly 환경에 연결하면 db-fetcher가 먼저 계정 권한을 확인하고, 쓰기 권한이 있으면(sa, db_owner 등) 연결을 거부합니다.
2. **MCP 서버 (실수 방지).** `run_select_query`는 SELECT만 받고, readonly 환경에서는 항상 롤백되는 트랜잭션 안에서 실행합니다. `execute_sql`은 readonly 환경에서 실행하지 않습니다.

`.db-fetcher.json`은 에이전트도 고칠 수 있는 파일이므로, prod를 실제로 보호하는 것은 1번입니다. prod에는 조회 전용 계정을 만들어 씁니다.

```sql
-- Azure SQL Database (contained user). 대상 DB에서 실행
CREATE USER mcp_reader WITH PASSWORD = '<STRONG_PASSWORD>';
ALTER ROLE db_datareader ADD MEMBER mcp_reader;   -- 데이터 조회
GRANT VIEW DEFINITION TO mcp_reader;               -- 스키마·SP 정의 조회
```

> **기존 사용자 주의:** dev에 `readonly`를 적지 않고 sa를 쓰고 있었다면 이제 연결이 거부됩니다. dev 환경에 `"readonly": false`를 추가하세요.

허용되는 권한 목록, SQL Server용 계정 생성 SQL, Codex의 `project_dir` 처리 등 자세한 내용 → [packages/db-first/README.md](packages/db-first/README.md)

---

## 🧩 Skills

db-fetcher로 읽은 스키마를 특정 형태의 코드로 만드는 절차입니다.

| Skill           | 설명                                                |
| --------------- | --------------------------------------------------- |
| `db-to-efcore`  | DB schema → EF Core Entity + DbContext + Fluent API |

Claude Code에서는 `/db-to-efcore`, Codex에서는 `$db-to-efcore`로 호출합니다.

---

## 🛠 개발자용 (플러그인을 수정·배포하는 사람)

- 버전 올리기 → [scripts/VERSION-BUMP.md](scripts/VERSION-BUMP.md)

```bash
pnpm install            # 최초 의존성 설치
pnpm run build          # 전체 빌드 (esbuild 번들링)
pnpm run dist           # 빌드 + dist/ 배포 디렉토리 조립
pnpm run lint           # 전체 타입 체크
pnpm --filter @pyanllc/mcp-db-fetcher test:unit   # 단위 테스트 (DB 불필요)

# 버전 bump
pnpm run version:bump patch
pnpm run version:bump db-first minor
```

> `dist/`는 반드시 git에 커밋합니다 — 플러그인 설치 시 이 디렉토리가 사용자에게 배포됩니다.
