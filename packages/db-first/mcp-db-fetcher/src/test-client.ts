/**
 * MCP tool 직접 호출 테스트 클라이언트
 *
 * 사용법:
 *   tsx src/test-client.ts <tool_name> [json_params]
 *
 * 예시:
 *   tsx src/test-client.ts list_connections
 *   tsx src/test-client.ts get_all_tables '{"env":"dev"}'
 *   tsx src/test-client.ts get_table_schema '{"env":"dev","table_name":"Users","schema_name":"dbo"}'
 *   tsx src/test-client.ts get_sample_data '{"env":"dev","table_name":"Users","schema_name":"dbo","limit":5}'
 *   tsx src/test-client.ts run_select_query '{"env":"dev","query":"SELECT TOP 3 * FROM dbo.Users"}'
 *   tsx src/test-client.ts execute_sql '{"env":"dev","sql":"UPDATE dbo.Users SET Name = Name WHERE 1 = 0"}'
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from "./tools.js";
import { loadConfig, closeAll } from "./connection-manager.js";

loadConfig();

const toolName = process.argv[2];
const rawParams = process.argv[3] ?? "{}";

if (!toolName) {
  console.error("사용법: tsx src/test-client.ts <tool_name> [json_params]");
  console.error("");
  console.error("사용 가능한 tool:");
  console.error("  list_connections");
  console.error("  get_all_tables");
  console.error("  get_table_schema");
  console.error("  get_relationships");
  console.error("  get_indexes");
  console.error("  get_stored_procedures");
  console.error("  get_sample_data");
  console.error("  run_select_query");
  console.error("  execute_sql");
  process.exit(1);
}

let params: Record<string, unknown>;
try {
  params = JSON.parse(rawParams);
} catch {
  console.error(`파라미터 파싱 실패: ${rawParams}`);
  console.error("유효한 JSON을 입력하세요. 예: '{\"env\":\"dev\"}'");
  process.exit(1);
}

// 서버 생성 + tool 등록
const server = new McpServer({ name: "test-server", version: "0.0.1" });
registerTools(server);

// InMemoryTransport로 서버-클라이언트 인프로세스 연결
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);

const client = new Client({ name: "test-client", version: "0.0.1" });
await client.connect(clientTransport);

// tool 호출
console.error(`\n→ tool: ${toolName}`);
console.error(`→ params: ${JSON.stringify(params)}\n`);

const result = await client.callTool({ name: toolName, arguments: params });

// 결과 출력 (pretty print)
const content = result.content as Array<{ type: string; text: string }>;
const text = content[0]?.text ?? "{}";

try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}

await closeAll();
process.exit(0);
