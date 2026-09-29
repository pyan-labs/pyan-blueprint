# Context

MCP tool 개발 시 Claude Code를 통하지 않고 src 코드를 직접 호출해서 테스트하고 싶다.
`@modelcontextprotocol/sdk`의 `Client` + `InMemoryTransport`를 사용하면 빌드 없이 tsx로 MCP tool을 직접 호출할 수 있다.

---

# 목표

`tsx src/test-client.ts <tool_name> <json_params>` 실행 → MCP tool 직접 호출 → 결과 출력

---

# 구현: `src/test-client.ts`

MCP SDK의 InMemoryTransport로 서버-클라이언트를 인프로세스 연결 후 tool 호출.

```typescript
// 실행 예시:
// tsx src/test-client.ts list_connections '{}'
// tsx src/test-client.ts get_all_tables '{"project":"baw","env":"dev"}'
// tsx src/test-client.ts get_table_schema '{"project":"baw","env":"dev","table_name":"Users","schema_name":"dbo"}'
// tsx src/test-client.ts run_select_query '{"project":"baw","env":"dev","query":"SELECT TOP 5 * FROM dbo.Users"}'

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from './tools.js';
import { closeAll } from './connection-manager.js';

const toolName = process.argv[2];
const params = JSON.parse(process.argv[3] ?? '{}');

// 서버 생성 + tool 등록
const server = new McpServer({ name: 'test', version: '0.0.1' });
registerTools(server);

// InMemoryTransport로 서버-클라이언트 연결
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);

const client = new Client({ name: 'test-client', version: '0.0.1' });
await client.connect(clientTransport);

// tool 호출
const result = await client.callTool({ name: toolName, arguments: params });

// 결과 출력 (pretty print)
const text = (result.content as Array<{type: string; text: string}>)[0]?.text;
console.log(JSON.stringify(JSON.parse(text ?? '{}'), null, 2));

await closeAll();
process.exit(0);
```

---

# 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `db-first/mcp-db-fetcher/src/test-client.ts` | 신규 생성 — MCP 인프로세스 test caller |
| `db-first/mcp-db-fetcher/package.json` | `test` 스크립트 추가 |

### package.json 추가 스크립트

```json
"test": "tsx src/test-client.ts"
```

---

# 사용법 (구현 후)

```powershell
# 연결 목록 확인
pnpm test list_connections '{}'

# baw dev DB 테이블 목록
pnpm test get_all_tables '{"project":"baw","env":"dev"}'

# 특정 테이블 스키마
pnpm test get_table_schema '{"project":"baw","env":"dev","table_name":"Users","schema_name":"dbo"}'

# SELECT 쿼리 직접 실행
pnpm test run_select_query '{"project":"baw","env":"dev","query":"SELECT TOP 3 * FROM dbo.Users"}'
```

src 파일을 수정하면 `tsx`가 최신 TypeScript를 바로 실행하므로 빌드 불필요.

---

# 검증

1. `pnpm test list_connections '{}'` → connections.json 기반 연결 목록 JSON 출력
2. `pnpm test get_all_tables '{"project":"baw","env":"dev"}'` → DB 테이블 목록 JSON 출력
3. `src/queries/tables.ts` 수정 후 다시 실행 → 빌드 없이 변경 반영 확인
