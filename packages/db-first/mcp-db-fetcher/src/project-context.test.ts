import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sql from "mssql";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from "./tools.js";
import { closeAll, withProjectContext, listConnections } from "./connection-manager.js";

// mssql exposes these runtime fields, but @types/mssql omits them.
type PoolWithConfig = sql.ConnectionPool & { config: sql.config };
type RequestWithParent = sql.Request & { parent: PoolWithConfig };

test("Codex calls select per-project configs and reject missing or invalid project paths", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "db-projects-"));
  const old = process.env.DB_FETCHER_REQUIRE_PROJECT_DIR;
  process.env.DB_FETCHER_REQUIRE_PROJECT_DIR = "1";
  const server = new McpServer({ name: "test", version: "1" });
  registerTools(server);
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    const projects = ["A", "B", "empty"].map((name) => {
      const dir = join(root, name);
      mkdirSync(dir);
      if (name !== "empty") writeFileSync(join(dir, ".db-fetcher.json"), JSON.stringify({
        connections: { open: "dev", dev: { server: "localhost", database: name } },
      }));
      return dir;
    });
    await server.connect(a);
    await client.connect(b);
    const tools = await client.listTools();
    for (const tool of tools.tools) {
      assert.ok(tool.inputSchema.required?.includes("project_dir"), tool.name);
    }
    for (const index of [0, 1, 0]) {
      const result = await client.callTool({ name: "list_connections", arguments: { project_dir: projects[index] } });
      assert.ok(!result.isError, JSON.stringify(result));
      const data = JSON.parse((result.content as { text: string }[])[0].text);
      assert.equal(data.config_path, join(projects[index], ".db-fetcher.json"));
      assert.equal(data.available_connections[0].database, index === 0 ? "A" : "B");
    }
    const events: string[] = [];
    await Promise.all(projects.slice(0, 2).map((dir, i) => withProjectContext(dir, async () => {
      events.push(`start-${i}`);
      assert.equal(listConnections()[0].database, i === 0 ? "A" : "B");
      await new Promise((done) => setImmediate(done));
      assert.equal(listConnections()[0].database, i === 0 ? "A" : "B");
      events.push(`end-${i}`);
    })));
    assert.deepEqual(events, ["start-0", "end-0", "start-1", "end-1"]);

    // Keep the real MCP handlers, SQL request construction and pool selection;
    // replace only network I/O. The same env name must resolve to different DBs.
    const poolEvents: string[] = [];
    t.mock.method(sql.ConnectionPool.prototype, "connect", (async function (this: sql.ConnectionPool) {
      Object.defineProperty(this, "connected", { value: true, configurable: true });
      return this;
    }) as typeof sql.ConnectionPool.prototype.connect);
    t.mock.method(sql.ConnectionPool.prototype, "close", (async function (this: sql.ConnectionPool) {
      poolEvents.push(`close-${(this as PoolWithConfig).config.database}`);
      Object.defineProperty(this, "connected", { value: false, configurable: true });
    }) as typeof sql.ConnectionPool.prototype.close);
    t.mock.method(sql.Request.prototype, "query", (async function (this: sql.Request) {
      const pool = (this as RequestWithParent).parent;
      const database = pool.config.database;
      poolEvents.push(`start-${database}`);
      await new Promise((done) => setImmediate(done));
      assert.ok(pool.connected, "another project closed this pool during its query");
      poolEvents.push(`end-${database}`);
      return { recordset: [{ table_name: database, schema_name: "dbo", row_count: 1 }] };
    }) as unknown as typeof sql.Request.prototype.query);
    const results = await Promise.all([0, 1, 0].map((i) => client.callTool({
      name: "get_all_tables", arguments: { project_dir: projects[i], env: "dev" },
    })));
    assert.deepEqual(results.map((result) => {
      assert.ok(!result.isError, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text).tables[0].table_name;
    }), ["A", "B", "A"]);
    assert.deepEqual(poolEvents, ["start-A", "end-A", "close-A", "start-B", "end-B", "close-B", "start-A", "end-A"]);
    for (const args of [{}, { project_dir: "relative" }, { project_dir: projects[2] }, { project_dir: join(root, "missing") }]) {
      const result = await client.callTool({ name: "list_connections", arguments: args });
      assert.equal(result.isError, true, JSON.stringify(args));
    }
    // A failed call must not poison the queue or reuse the previous project.
    const recovered = await client.callTool({ name: "list_connections", arguments: { project_dir: projects[1] } });
    assert.ok(!recovered.isError);
    assert.equal(JSON.parse((recovered.content as { text: string }[])[0].text).available_connections[0].database, "B");
  } finally {
    await client.close();
    await server.close();
    await closeAll();
    if (old === undefined) delete process.env.DB_FETCHER_REQUIRE_PROJECT_DIR;
    else process.env.DB_FETCHER_REQUIRE_PROJECT_DIR = old;
    rmSync(root, { recursive: true, force: true });
  }
});
