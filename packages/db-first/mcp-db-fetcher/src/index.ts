#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { closeAll } from "./connection-manager.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "db-fetcher",
  version: "5.7.0",
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
