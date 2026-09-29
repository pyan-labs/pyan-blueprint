# Team Plugins 개발 가이드

이 리포지토리는 **Claude/Codex 플러그인**을 관리하는 pnpm workspaces 기반 monorepo다. 각 플러그인의 MCP 서버는 esbuild로 번들링되어 배포된다.

---

## 환경 요구사항

- Node.js 22+
- pnpm (`npm install -g pnpm` 또는 corepack 사용)

---

## pnpm Workspace 명령어

모든 명령은 **리포지토리 루트**에서 실행한다.

```bash
# 최초 설치 (전체 workspace 의존성)
pnpm install

# 전체 빌드 (모든 MCP 패키지)
pnpm run build

# 전체 타입 체크
pnpm run lint

# 특정 패키지만 개발 모드
pnpm --filter @pyanllc/mcp-db-fetcher dev

# 특정 패키지만 빌드
pnpm --filter @pyanllc/mcp-db-fetcher build
```

### Workspace 구조 규칙

- `pnpm-workspace.yaml`에 `packages/<plugin>/mcp-*`, 빌드가 필요한 스킬은 `packages/<plugin>/skills/*` 글로브 등록
- 공유 devDependencies (typescript, tsx, esbuild, @types/node)는 **루트 package.json**에만 선언
- 패키지 특화 devDependencies (예: `@types/mssql`)는 각 패키지에 선언

### 패키지 네이밍 규칙

모든 MCP 패키지는 **`@pyanllc` 스코프**를 사용한다. 누가 만들든 동일한 스코프로 통일한다.

```
@pyanllc/mcp-db-fetcher      # db-first MCP 서버
@pyanllc/mcp-foxconn         # foxconn-tools MCP 서버
@pyanllc/mcp-common          # common-tools MCP 서버
```

팀 스코프 통일의 이점:

- 담당자가 바뀌어도 패키지 이름 변경 불필요
- 와일드카드로 전체 MCP 패키지 일괄 조작 가능: `pnpm --filter "@pyanllc/*" build`

---

## MCP 서버 개발

> 기준 구현: `packages/db-first/mcp-db-fetcher/` — 새 MCP 서버를 만들 때 이 구조를 복제한다.

### 디렉토리 구조 (`mcp-db-fetcher` 기준)

```
db-first/mcp-db-fetcher/
├── src/
│   ├── index.ts               # 진입점 (stdio transport)
│   ├── tools.ts               # MCP tool 등록 (registerTools)
│   ├── connection-manager.ts  # DB 연결 풀 + ADO.NET 파싱
│   ├── types.ts               # 공유 타입
│   └── queries/               # SQL 쿼리 모듈별 분리
├── dist/                      # 빌드 결과물 (git 커밋 필요)
├── .db-fetcher.example.json   # DB 설정 템플릿 (credential 없음, git 커밋)
├── .db-fetcher.json           # 실제 DB 설정 (credential 포함, .gitignore)
├── package.json
└── tsconfig.json
```

### MCP 서버 흐름

```
index.ts
  └─ registerTools(server)          # tools.ts
       └─ 각 tool 호출 시
            └─ getPool(env?)        # connection-manager.ts
                 └─ queries/*.ts     # SQL 실행 → JSON 반환
```

연결 풀은 `env` 키로 캐시된다 (예: `dev`).

### Tool 목록 (8개)

| Tool | 파일 | 설명 |
|---|---|---|
| `list_connections` | queries/tables.ts | 사용 가능한 환경 목록 |
| `get_all_tables` | queries/tables.ts | 전체 테이블 + row count |
| `get_table_schema` | queries/tables.ts | 컬럼, 타입, PK, nullable, identity |
| `get_relationships` | queries/relationships.ts | FK 정의 |
| `get_indexes` | queries/indexes.ts | 인덱스 및 제약조건 |
| `get_stored_procedures` | queries/stored-procedures.ts | SP 목록 + 파라미터 |
| `get_sample_data` | queries/data.ts | 샘플 데이터 (dev: 50행, prod: 10행) |
| `run_select_query` | queries/data.ts | 임의 SELECT (prod: 1000행 제한) |

### 연결 관리

- `.db-fetcher.json` — 환경(dev/prod) 정의 및 credential 포함
- `.db-fetcher.example.json` — credential 없는 템플릿 (git 커밋용)
- `connection-manager.ts`의 `loadConfig()`가 `.db-fetcher.json`을 로드
- `connection-manager.ts`의 `parseConnectionString()`이 ADO.NET 형식 → mssql config 변환

### 새 환경(DB) 추가

1. **`.db-fetcher.json`** 에 환경 블록 추가

   ```json
   {
     "open": "dev",
     "environments": {
       "dev": {
         "connectionString": "Server=localhost,1433;Database=MyDB_Dev;User Id=sa;Password=yourpass;TrustServerCertificate=true;",
         "readonly": false
       },
       "prod": {
         "connectionString": "Server=mydb.database.windows.net;Database=MyDB_Prod;User Id=reader;Password=yourpass;Encrypt=true;",
         "readonly": true
       }
     }
   }
   ```

2. **`.db-fetcher.example.json`** 에도 동일 구조를 credential 없이 추가 (팀 공유용)

### package.json

빌드 스크립트는 루트의 `build.mjs`를 공유한다.

```json
{
  "name": "@pyanllc/mcp-db-fetcher",
  "version": "2.0.0",
  "description": "MCP server for MS SQL schema and data fetching",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "node ../../../build.mjs",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "mssql": "^11.0.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/mssql": "^9.1.5"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### index.ts 진입점

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig, closeAll } from "./connection-manager.js";
import { registerTools } from "./tools.js";

loadConfig();

const server = new McpServer({ name: "db-fetcher", version: "2.0.0" });
registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp:db-fetcher started (stdio transport)");
}

process.on("SIGINT", async () => { await closeAll(); process.exit(0); });
process.on("SIGTERM", async () => { await closeAll(); process.exit(0); });

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

핵심 패턴:
- `loadConfig()`로 `.db-fetcher.json` 파일 로드
- `registerTools(server)`로 모든 tool을 일괄 등록
- `SIGINT`/`SIGTERM` 시 연결 풀 정리 (`closeAll`)

### 플러그인 `.mcp.json`에 서버 등록

```json
{
  "mcpServers": {
    "db-fetcher": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/mcp-db-fetcher/dist/index.js"]
    }
  }
}
```

`${CLAUDE_PLUGIN_ROOT}`는 Claude Code가 플러그인 루트 경로로 자동 치환한다.

### 빌드 및 커밋

```bash
pnpm run dist
git add packages/db-first/mcp-db-fetcher/dist/index.js dist/db-first/
```

`dist/index.js`는 반드시 git에 커밋 — 플러그인은 `node_modules` 없이 번들된 단일 파일로 실행된다.

---

## esbuild 번들링

### 동작 원리

`build.mjs`는 모든 MCP 패키지가 공유하는 빌드 스크립트다. `src/index.ts`를 진입점으로 모든 의존성을 `dist/index.js` 단일 파일에 번들링한다.

```
src/index.ts + node_modules/* → dist/index.js (단일 파일, ~수 MB)
```

배포된 플러그인 환경에서는 `dist/index.js` 하나만 있으면 `node`로 실행 가능하다.

### require shim 이유

`build.mjs`의 banner 옵션:

```js
"import { createRequire } from 'module'; const require = createRequire(import.meta.url);";
```

ESM 포맷으로 번들링할 때 `mssql` 등 내부적으로 CJS `require()`를 사용하는 패키지가 오류를 일으킨다. banner로 `require` 함수를 ESM 환경에 주입해 이를 해결한다.

### 빌드 옵션 변경이 필요한 경우

`build.mjs`를 직접 수정한다. 모든 MCP 패키지에 공통 적용된다. 패키지별로 다른 설정이 필요하면 해당 패키지 디렉토리에 별도 `build.mjs`를 만들고 `package.json`의 build 스크립트 경로를 변경한다.

---

## Skills 개발

Skills는 Claude Code slash command(`/skill-name`)로 실행되는 Markdown 파일이다. **각 Skill은 독립적인 workspace 패키지**로 관리한다.

### 디렉토리 구조

스크립트가 없는 단순 Skill (프롬프트 템플릿만):

```
packages/{plugin}/skills/{skill-name}/
└── SKILL.md
```

npm 패키지가 필요한 Skill (독립 패키지):

```
packages/{plugin}/skills/{skill-name}/
├── SKILL.md              # slash command 정의 + 실행 흐름
├── src/
│   └── index.ts          # 소스 코드
├── scripts/              # esbuild 빌드 출력 (git 커밋 필요)
│   └── index.js
├── package.json          # @Pyanllc/skill-{skill-name}
└── tsconfig.json
```

### Skill package.json 템플릿

```json
{
  "name": "@pyanllc/skill-db-to-efcore",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "node ../../../../build.mjs scripts/index.js",
    "dev": "tsx watch src/index.ts",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    // skill 특화 의존성
  }
}
```

> MCP 패키지 (`../../../build.mjs`)와 달리 skills는 한 단계 더 깊어 `../../../../build.mjs`를 사용한다.

### SKILL.md에서 스크립트 참조

```markdown
## 실행 흐름

1. `node ${CLAUDE_PLUGIN_ROOT}/skills/db-to-efcore/scripts/index.js` 실행
2. 또는 mcp tool 직접 호출 후 Claude가 코드 생성
```

### MCP tool 호출 순서 (권장)

```
list_connections → get_all_tables → get_table_schema
→ get_relationships → get_indexes → get_stored_procedures → get_sample_data
```

항상 `list_connections`로 시작해 사용 가능한 환경을 확인한다.

### 빌드 및 커밋

```bash
pnpm --filter @pyanllc/skill-db-to-efcore build
git add db-first/skills/db-to-efcore/scripts/index.js
```

---

## 새 플러그인 추가

1. 플러그인 디렉토리 생성: `packages/{plugin-name}/`
2. `.claude-plugin/plugin.json` 작성
3. `.mcp.json` 작성 (MCP 서버가 있는 경우)
4. `skills/` 디렉토리에 slash command 추가
5. **루트 `.claude-plugin/marketplace.json`에 플러그인 등록**

```json
// marketplace.json plugins 배열에 추가
{
  "name": "foxconn-tools",
  "description": "Foxconn 프로젝트 개발 도구",
  "version": "1.0.0",
  "source": "./dist/foxconn-tools"
}
```

6. **Claude/Codex 양쪽의 매니페스트와 마켓플레이스 등록을 준비한다.**
   - `.codex-plugin/plugin.json` — `skills` 경로와 `version`을 명시
   - 루트 `.agents/plugins/marketplace.json`에 `local` source로 등록
   - MCP 서버는 실행 경로와 프로젝트 설정 경로를 구분한다. `db-first`는 Claude의 `.mcp.json`과 Codex의 `.mcp.codex.json`을 사용하며, 공용 스킬이 호출마다 `project_dir`를 전달한다. Codex 설정은 매니페스트의 `mcpServers`로 연결한다.
7. **`scripts/assemble-dist.mjs`의 `files` 배열과 `scripts/version-bump.mjs`의 `PLUGINS`에 새 경로 등록** — 빠뜨리면 `dist/`에 파일이 빠지거나 버전이 한쪽만 올라간다
8. `pnpm run test:release`, `pnpm run lint`, `pnpm run dist`로 검증한다. 배포 조립은 필수 스킬 폴더와 `SKILL.md`를 검사하며, 실패 시 기존 `dist/`를 보존한다. 버전 변경과 배포 파일을 함께 커밋한다.

---

## MCP Tool 테스트

`test-client.ts`를 사용하여 MCP tool을 직접 호출/검증할 수 있다.

### 사전 준비

1. `.db-fetcher.example.json`을 복사하여 `.db-fetcher.json` 파일 생성 후 실제 credential 입력

   ```bash
   cp .db-fetcher.example.json .db-fetcher.json
   # .db-fetcher.json 안의 connectionString에 실제 credential 입력
   ```

2. 해당 DB가 접근 가능한 상태 확인 (dev 환경은 Docker 컨테이너 실행 중이어야 함)

### 실행 방법

```bash
cd db-first/mcp-db-fetcher
npx tsx src/test-client.ts <tool_name> [json_params]
```

### Tool별 예시

```bash
# 연결 목록 확인 (DB 접속 없이 credential 설정 상태 확인)
npx tsx src/test-client.ts list_connections

# 전체 테이블 목록
npx tsx src/test-client.ts get_all_tables '{"env":"dev"}'

# 테이블 스키마 조회
npx tsx src/test-client.ts get_table_schema '{"env":"dev","table_name":"Invoice","schema_name":"dbo"}'

# 관계(FK) 조회
npx tsx src/test-client.ts get_relationships '{"env":"dev"}'

# 인덱스 조회
npx tsx src/test-client.ts get_indexes '{"env":"dev"}'

# 저장 프로시저 조회
npx tsx src/test-client.ts get_stored_procedures '{"env":"dev"}'

# 샘플 데이터 조회
npx tsx src/test-client.ts get_sample_data '{"env":"dev","table_name":"Users","schema_name":"dbo","limit":5}'

# SELECT 쿼리 실행
npx tsx src/test-client.ts run_select_query '{"env":"dev","query":"SELECT TOP 3 * FROM dbo.Users"}'
```

### 동작 원리

`InMemoryTransport`로 MCP 서버와 클라이언트를 같은 프로세스 안에서 연결하므로, stdio 파이프 없이 tool을 직접 호출/검증할 수 있다. `loadConfig()`가 `.db-fetcher.json`을 자동으로 로드한다.

### 트러블슈팅

- `list_connections` 결과에서 `available: false`인 항목은 해당 환경의 credential이 설정되지 않은 것
- `Credential not found` 에러 → `.db-fetcher.json` 파일이 `mcp-db-fetcher/` 디렉토리에 있는지 확인
- 연결 실패 → Docker 컨테이너 실행 상태 및 포트(dev: 1433/1434) 확인
