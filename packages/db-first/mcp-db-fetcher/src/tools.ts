import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  listConnections,
  getOpenEnv,
  loadConfig,
  getSearchStartDir,
  getConfigLocation,
  getGlobalConfigPath,
  withProjectContext,
} from "./connection-manager.js";
import { getAllTables, getTableSchema } from "./queries/tables.js";
import { getRelationships } from "./queries/relationships.js";
import { getIndexes } from "./queries/indexes.js";
import { getStoredProcedures } from "./queries/stored-procedures.js";
import { executeSql, getSampleData, runSelectQuery } from "./queries/data.js";

// ── Shared helpers ───────────────────────────────────────────────────────────

function configGuard() {
  if (!loadConfig()) {
    return {
      content: [{
        type: "text" as const,
        text: "⚠️ .db-fetcher.json not found.\n" +
              "Search order (first file found wins):\n" +
              `  1. local:  ${getSearchStartDir()}\n` +
              "  2. parent: each directory above it\n" +
              `  3. global (legacy calls without project_dir only): ${getGlobalConfigPath()}\n\n` +
              "Create .db-fetcher.json in your project root. Explicit project_dir calls never fall back to the home config.\n" +
              "Template: .db-fetcher.example.json",
      }],
      isError: true as const,
    };
  }
  return null;
}

function jsonResponse(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const OptionalEnvSchema = {
  env: z.string().optional().describe('Environment override. Omit to use the "open" environment.'),
};

// ── Register all tools ───────────────────────────────────────────────────────

export function registerTools(server: McpServer) {
  const projectDir = z.string().min(1).describe(
    "Absolute directory of the CURRENT user's project/workspace, not the plugin installation. " +
    "Pass it on every call; .db-fetcher.json is resolved here or in parent directories."
  );
  function tool<S extends z.ZodRawShape>(
    name: string, description: string, schema: S,
    handler: (args: z.output<z.ZodObject<S>>) => Promise<CallToolResult>
  ) {
    const inputSchema: z.ZodRawShape = {
      ...schema,
      project_dir: process.env.DB_FETCHER_REQUIRE_PROJECT_DIR === "1" ? projectDir : projectDir.optional(),
    };
    server.tool(name, description, inputSchema, async (args) => {
      try {
        return await withProjectContext(args.project_dir as string | undefined, () => handler(z.object(schema).parse(args)));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    });
  }

  tool(
    "list_connections",
    "List all configured DB connections with availability status. " +
      "Call this FIRST before any other tool to confirm environment options.",
    {},
    async () => {
      const guard = configGuard();
      if (guard) return guard;
      const connections = listConnections();
      const location = getConfigLocation();
      const available = connections.filter((c) => c.available);
      const unavailable = connections.filter((c) => !c.available);
      return jsonResponse({
        config_path: location?.path,
        config_scope: location?.scope,
        available_connections: available,
        unavailable_connections: unavailable.map((c) => ({
          ...c,
          hint: `Check connection settings in .db-fetcher.json`,
        })),
        open_env: getOpenEnv(),
        usage_note: 'The "open" environment is used by default. Pass env to override.',
      });
    }
  );

  tool(
    "get_all_tables",
    "Get all user tables in the database with row counts. " +
      "Use this to understand the full DB structure before diving into specific tables.",
    {
      schema_filter: z.string().optional().describe('Optional schema filter (e.g. "dbo"). Default: all schemas.'),
      ...OptionalEnvSchema,
    },
    async ({ schema_filter, env }: { schema_filter?: string; env?: string }) => {
      const guard = configGuard();
      if (guard) return guard;
      const tables = await getAllTables(schema_filter, env);
      return jsonResponse({ env: env ?? getOpenEnv(), table_count: tables.length, tables });
    }
  );

  tool(
    "get_table_schema",
    "Get detailed schema for a specific table: columns, types, nullable, PK, identity, defaults, descriptions. " +
      "ALWAYS call this before generating Entity classes, DTOs, or API code.",
    {
      table_name: z.string().describe("Table name (case-insensitive)"),
      schema_name: z.string().optional().default("dbo").describe('Schema name. Default: "dbo"'),
      ...OptionalEnvSchema,
    },
    async ({ table_name, schema_name, env }: { table_name: string; schema_name: string; env?: string }) => {
      const guard = configGuard();
      if (guard) return guard;
      const schema = await getTableSchema(table_name, schema_name, env);
      return jsonResponse({ env: env ?? getOpenEnv(), ...schema });
    }
  );

  tool(
    "get_relationships",
    "Get FK relationships for a table (or all tables). " +
      "Use before setting up EF Core navigation properties or JOIN queries.",
    {
      table_name: z.string().optional().describe("Optional table name filter. Omit to get all FK relationships."),
      ...OptionalEnvSchema,
    },
    async ({ table_name, env }: { table_name?: string; env?: string }) => {
      const guard = configGuard();
      if (guard) return guard;
      const relationships = await getRelationships(table_name, env);
      return jsonResponse({
        env: env ?? getOpenEnv(),
        filter_table: table_name ?? "all",
        relationship_count: relationships.length,
        relationships,
      });
    }
  );

  tool(
    "get_indexes",
    "Get indexes for a table (or all tables). " +
      "Use to understand query optimization hints and unique constraints.",
    {
      table_name: z.string().optional().describe("Optional table name filter. Omit to get all indexes."),
      ...OptionalEnvSchema,
    },
    async ({ table_name, env }: { table_name?: string; env?: string }) => {
      const guard = configGuard();
      if (guard) return guard;
      const indexes = await getIndexes(table_name, env);
      return jsonResponse({
        env: env ?? getOpenEnv(),
        filter_table: table_name ?? "all",
        index_count: indexes.length,
        indexes,
      });
    }
  );

  tool(
    "get_stored_procedures",
    "Get stored procedures with parameters and definition preview. " +
      "Check this before replacing SP logic with EF Core to understand what exists.",
    {
      schema_filter: z.string().optional().describe('Optional schema filter (e.g. "dbo")'),
      ...OptionalEnvSchema,
    },
    async ({ schema_filter, env }: { schema_filter?: string; env?: string }) => {
      const guard = configGuard();
      if (guard) return guard;
      const sps = await getStoredProcedures(schema_filter, env);
      return jsonResponse({ env: env ?? getOpenEnv(), sp_count: sps.length, stored_procedures: sps });
    }
  );

  tool(
    "get_sample_data",
    "Get sample rows from a table. " +
      "Use to understand actual data patterns: code columns, date formats, string lengths, nullability in practice. " +
      "Readonly env limit: 10 rows. Other env limit: 50 rows.",
    {
      table_name: z.string().describe("Table name"),
      schema_name: z.string().optional().default("dbo"),
      limit: z.number().int().min(1).max(50).optional().default(5).describe("Number of rows to fetch (default: 5)"),
      ...OptionalEnvSchema,
    },
    async ({ table_name, schema_name, limit, env }: { table_name: string; schema_name: string; limit: number; env?: string }) => {
      const guard = configGuard();
      if (guard) return guard;
      const result = await getSampleData(table_name, schema_name, limit, env);
      return jsonResponse({ env: env ?? getOpenEnv(), ...result });
    }
  );

  tool(
    "run_select_query",
    "Run a custom SELECT query. " +
      "Only SELECT statements allowed. Readonly env: auto-capped at 1000 rows. " +
      "Use for ad-hoc analysis, JOIN previews, or verifying data before code generation.",
    {
      sql: z.string().describe("SELECT query to execute. Must start with SELECT or WITH."),
      ...OptionalEnvSchema,
    },
    async ({ sql: querySql, env }: { sql: string; env?: string }) => {
      const guard = configGuard();
      if (guard) return guard;
      const result = await runSelectQuery(querySql, env);
      return jsonResponse({ env: env ?? getOpenEnv(), ...result });
    }
  );

  tool(
    "execute_sql",
    "Execute any T-SQL (DDL, DML, EXEC) on a writable environment (\"readonly\": false, e.g. dev). " +
      "Rejected on readonly environments. GO separators are not supported. Each result set is capped at 1000 rows. " +
      "Confirm destructive statements (DROP, DELETE, TRUNCATE, ...) with the user before running.",
    {
      sql: z.string().describe("T-SQL batch to execute."),
      ...OptionalEnvSchema,
    },
    async ({ sql: querySql, env }: { sql: string; env?: string }) => {
      const guard = configGuard();
      if (guard) return guard;
      const result = await executeSql(querySql, env);
      return jsonResponse({ env: env ?? getOpenEnv(), ...result });
    }
  );
}
