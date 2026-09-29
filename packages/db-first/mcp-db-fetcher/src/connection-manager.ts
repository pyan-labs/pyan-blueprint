import sql from "mssql";
import { readFileSync, existsSync, statSync } from "fs";
import { homedir } from "os";
import { join, dirname, resolve, isAbsolute } from "path";
import { AsyncLocalStorage } from "node:async_hooks";
import type {
  ConnectionEntry,
  DbFetcherConfig,
  ConnectionListItem,
  ConfigLocation,
} from "./types.js";

const CONFIG_FILE_NAME = ".db-fetcher.json";

interface CachedConfig {
  config: DbFetcherConfig;
  location: ConfigLocation;
  mtimeMs: number;
  size: number;
}

const pools = new Map<string, sql.ConnectionPool>();
let cached: CachedConfig | null = null;

const projectContext = new AsyncLocalStorage<string>();
// A process can receive overlapping tool calls. Finish each query before switching
// its config/pools to another project (including calls with the same env name).
let pending: Promise<unknown> = Promise.resolve();

export function withProjectContext<T>(projectDir: string | undefined, action: () => Promise<T>): Promise<T> {
  const run = pending.then(() => {
    if (projectDir === undefined) {
      if (process.env.DB_FETCHER_REQUIRE_PROJECT_DIR === "1") {
        throw new Error("project_dir is required: pass the current session's absolute project directory.");
      }
      return action();
    }
    if (!isAbsolute(projectDir) || !statSync(projectDir).isDirectory()) {
      throw new Error("project_dir must be an existing absolute directory.");
    }
    return projectContext.run(resolve(projectDir), action);
  });
  pending = run.catch(() => undefined);
  return run;
}

// ── Config discovery ────────────────────────────────────────────────────────

function isSamePath(a: string, b: string): boolean {
  const left = resolve(a);
  const right = resolve(b);
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

export function getGlobalConfigPath(homeDir: string = homedir()): string {
  return join(homeDir, CONFIG_FILE_NAME);
}

// 탐색 순서: local(시작 디렉토리) → parent(상위 디렉토리들) → global(홈).
// 먼저 발견된 파일 하나만 쓴다. 여러 파일을 병합하지 않는다.
export function findConfigFile(
  startDir: string,
  homeDir: string = homedir(),
  allowGlobal: boolean = true
): ConfigLocation | null {
  const globalPath = getGlobalConfigPath(homeDir);

  let dir = startDir;
  while (true) {
    const candidate = join(dir, CONFIG_FILE_NAME);
    if (existsSync(candidate)) {
      if (isSamePath(candidate, globalPath)) return allowGlobal ? { path: candidate, scope: "global" } : null;
      return { path: candidate, scope: dir === startDir ? "local" : "parent" };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return allowGlobal && existsSync(globalPath) ? { path: globalPath, scope: "global" } : null;
}

// user-scope 플러그인은 cwd가 플러그인 캐시 디렉토리이므로,
// Claude Code가 주입하는 CLAUDE_PROJECT_DIR를 우선 사용한다.
export function getSearchStartDir(): string {
  return projectContext.getStore() ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

// 설정이 바뀌면 같은 env 이름의 pool이 옛 서버를 계속 가리킬 수 있으므로 모두 버린다.
// loadConfig가 동기 함수라서 close는 기다리지 않는다.
function discardPools(): void {
  for (const pool of pools.values()) {
    pool.close().catch((err: unknown) => {
      console.error(`[db-fetcher] pool close failed: ${String(err)}`);
    });
  }
  pools.clear();
}

// 호출마다 다시 탐색한다. 세션 도중 더 가까운 파일이 생기거나 읽던 파일이 바뀌어도
// 서버 재시작 없이 반영하기 위해서다. 복사한 파일은 옛 mtime을 유지하므로 size도 비교한다.
export function loadConfig(): DbFetcherConfig | null {
  const location = findConfigFile(getSearchStartDir(), homedir(), projectContext.getStore() === undefined);
  if (!location) {
    if (cached) {
      console.error(`[db-fetcher] config no longer found: ${cached.location.path}`);
      cached = null;
      discardPools();
    }
    return null;
  }

  const { mtimeMs, size } = statSync(location.path);
  if (
    cached &&
    cached.location.path === location.path &&
    cached.mtimeMs === mtimeMs &&
    cached.size === size
  ) {
    return cached.config;
  }

  const raw = readFileSync(location.path, "utf-8");
  let config: DbFetcherConfig;
  try {
    config = JSON.parse(raw) as DbFetcherConfig;
  } catch (err) {
    throw new Error(
      `Failed to parse ${location.path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (cached) discardPools();
  cached = { config, location, mtimeMs, size };
  console.error(`[db-fetcher] config loaded (${location.scope}): ${location.path}`);
  return config;
}

export function getConfigLocation(): ConfigLocation | null {
  return loadConfig() ? cached!.location : null;
}

// ── Internal helper ─────────────────────────────────────────────────────────

function requireConfig(): DbFetcherConfig {
  const config = loadConfig();
  if (!config) {
    throw new Error(".db-fetcher.json not found or could not be loaded.");
  }
  return config;
}

// ── Connection entry helpers ────────────────────────────────────────────────

function getConnectionEntry(env?: string): ConnectionEntry {
  const config = requireConfig();
  const resolvedEnv = env ?? config.connections.open;
  const entry = config.connections[resolvedEnv];

  if (!entry || typeof entry === "string") {
    throw new Error(
      `Environment "${resolvedEnv}" not found in .db-fetcher.json connections.\n` +
        `Available: ${Object.keys(config.connections).filter((k) => k !== "open").join(", ")}`
    );
  }

  return entry;
}

export function getOpenEnv(): string {
  return requireConfig().connections.open;
}

// ── Pool management ─────────────────────────────────────────────────────────

function buildSqlConfig(entry: ConnectionEntry): sql.config {
  const config: sql.config = {
    server: entry.server,
    ...(entry.port ? { port: entry.port } : {}),
    database: entry.database,
    options: {
      encrypt: entry.encrypt ?? true,
      trustServerCertificate: entry.trustServerCertificate ?? false,
      connectTimeout: 15000,
      requestTimeout: 30000,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if ((entry.authentication ?? "sql") === "windows") {
    (config.options as Record<string, unknown>).trustedConnection = true;
  } else {
    config.user = entry.user;
    config.password = entry.password;
  }

  return config;
}

export async function getPool(env?: string): Promise<sql.ConnectionPool> {
  const config = requireConfig();
  const resolvedEnv = env ?? config.connections.open;

  const existing = pools.get(resolvedEnv);
  if (existing?.connected) {
    return existing;
  }

  const entry = getConnectionEntry(resolvedEnv);
  const sqlConfig = buildSqlConfig(entry);
  const pool = new sql.ConnectionPool(sqlConfig);

  await pool.connect();
  pools.set(resolvedEnv, pool);

  return pool;
}

// ── Query helpers ───────────────────────────────────────────────────────────

export function listConnections(): ConnectionListItem[] {
  const config = requireConfig();
  const items: ConnectionListItem[] = [];
  const openEnv = config.connections.open;

  for (const [envName, value] of Object.entries(config.connections)) {
    if (envName === "open") continue;
    if (typeof value === "string") continue;

    const entry = value as ConnectionEntry;

    items.push({
      env: envName,
      server: entry.server,
      database: entry.database,
      readonly: entry.readonly ?? false,
      is_open: envName === openEnv,
      available: true,
    });
  }

  return items;
}

export function isReadonly(env?: string): boolean {
  const entry = getConnectionEntry(env);
  return entry.readonly ?? false;
}

export async function closeAll(): Promise<void> {
  for (const pool of pools.values()) {
    await pool.close();
  }
  pools.clear();
}
