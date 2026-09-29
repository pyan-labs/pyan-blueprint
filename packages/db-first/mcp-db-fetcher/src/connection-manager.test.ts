import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, realpathSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { findConfigFile, loadConfig, getConfigLocation } from "./connection-manager.js";

let root: string;
let home: string;
let parent: string;
let local: string;

function writeConfig(dir: string, database: string): string {
  const path = join(dir, ".db-fetcher.json");
  writeFileSync(
    path,
    JSON.stringify({ connections: { open: "dev", dev: { server: "localhost", database } } })
  );
  return path;
}

function openDatabase(): string | undefined {
  const entry = loadConfig()?.connections.dev;
  return typeof entry === "object" ? entry.database : undefined;
}

// process.env를 통째로 바꾸면 일반 객체가 되어 os.homedir()에 반영되지 않는다. 키 단위로 복원한다.
const ENV_KEYS = ["CLAUDE_PROJECT_DIR", "USERPROFILE", "HOME"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "db-fetcher-")));
  home = join(root, "home");
  parent = join(root, "work", "umbrella");
  local = join(parent, "database");
  mkdirSync(home, { recursive: true });
  mkdirSync(local, { recursive: true });

  process.env.CLAUDE_PROJECT_DIR = local;
  process.env.USERPROFILE = home; // os.homedir() on Windows
  process.env.HOME = home; // os.homedir() on POSIX
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  rmSync(root, { recursive: true, force: true });
});

test("local wins over parent and global", () => {
  writeConfig(home, "global-db");
  writeConfig(parent, "parent-db");
  const expected = writeConfig(local, "local-db");

  assert.deepEqual(findConfigFile(local, home), { path: expected, scope: "local" });
});

test("parent is used when there is no local config", () => {
  writeConfig(home, "global-db");
  const expected = writeConfig(parent, "parent-db");

  assert.deepEqual(findConfigFile(local, home), { path: expected, scope: "parent" });
});

test("global is used when neither local nor parent exists", () => {
  const expected = writeConfig(home, "global-db");

  assert.deepEqual(findConfigFile(local, home), { path: expected, scope: "global" });
});

test("home config reached by walking up is reported as global", () => {
  const underHome = join(home, "projects", "app");
  mkdirSync(underHome, { recursive: true });
  const expected = writeConfig(home, "global-db");

  assert.deepEqual(findConfigFile(underHome, home), { path: expected, scope: "global" });
});

test("explicit project mode never falls back to an existing home config", () => {
  writeConfig(home, "wrong-global-db");
  assert.equal(findConfigFile(local, home, false), null);
  const underHome = join(home, "project");
  mkdirSync(underHome);
  assert.equal(findConfigFile(underHome, home, false), null);
});

test("returns null when no config exists anywhere", () => {
  assert.equal(findConfigFile(local, home), null);
});

test("loadConfig switches to a local config created after the first load", () => {
  writeConfig(parent, "parent-db");
  assert.equal(openDatabase(), "parent-db");
  assert.equal(getConfigLocation()?.scope, "parent");

  writeConfig(local, "local-db");
  assert.equal(openDatabase(), "local-db");
  assert.equal(getConfigLocation()?.scope, "local");
});

test("loadConfig reloads when the same file is edited", () => {
  const path = writeConfig(local, "before");
  assert.equal(openDatabase(), "before");

  writeConfig(local, "after-edit");
  utimesSync(path, new Date(), new Date(Date.now() + 5000)); // mtime 해상도와 무관하게 변경을 보장
  assert.equal(openDatabase(), "after-edit");
});

test("loadConfig falls back when the loaded config is deleted", () => {
  writeConfig(home, "global-db");
  const path = writeConfig(local, "local-db");
  assert.equal(openDatabase(), "local-db");

  rmSync(path);
  assert.equal(openDatabase(), "global-db");
  assert.equal(getConfigLocation()?.scope, "global");
});
