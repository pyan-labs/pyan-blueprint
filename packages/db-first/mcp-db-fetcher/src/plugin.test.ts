import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

const pluginRoot = fileURLToPath(new URL("../../../../dist/db-first/", import.meta.url));

for (const host of ["claude", "codex"]) {
  test(`deployed ${host} plugin runs from its installation directory with project-specific settings`, async () => {
    const root = mkdtempSync(join(tmpdir(), "db-plugin-"));
    const projects = ["A", "B"].map((name) => {
      const dir = join(root, name);
      mkdirSync(dir);
      writeFileSync(join(dir, ".db-fetcher.json"), JSON.stringify({
        connections: { open: "dev", dev: { server: "localhost", database: name } },
      }));
      return dir;
    });
    const manifest = JSON.parse(readFileSync(join(pluginRoot, host === "codex" ? ".codex-plugin/plugin.json" : ".claude-plugin/plugin.json"), "utf8"));
    const config = JSON.parse(readFileSync(join(pluginRoot, manifest.mcpServers ?? ".mcp.json"), "utf8")).mcpServers["db-fetcher"];
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: config.args.map((arg: string) => arg.replace("${CLAUDE_PLUGIN_ROOT}", pluginRoot)),
      cwd: resolve(pluginRoot, config.cwd ?? "."),
      env: { ...getDefaultEnvironment(), ...config.env, ...(host === "claude" ? { CLAUDE_PROJECT_DIR: projects[0] } : {}) },
      stderr: "pipe",
    });
    const client = new Client({ name: "plugin-test", version: "1" });
    try {
      await client.connect(transport);
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      assert.equal(names.length, 9);
      for (const index of [0, 1, 0]) {
        const args = host === "claude" && index === 0 ? {} : { project_dir: projects[index] };
        const result = await client.callTool({ name: "list_connections", arguments: args });
        assert.ok(!result.isError, JSON.stringify(result));
        const data = JSON.parse((result.content as { text: string }[])[0].text);
        assert.equal(data.config_path, join(projects[index], ".db-fetcher.json"));
        assert.equal(data.available_connections[0].database, index === 0 ? "A" : "B");
      }
      if (host === "codex") {
        assert.equal((await client.callTool({ name: "list_connections", arguments: {} })).isError, true);
      }
    } finally {
      await client.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
}
