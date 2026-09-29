import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const names = ['db-first'];
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'plugin-release-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  });
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  for (const script of ['version-bump.mjs', 'assemble-dist.mjs']) {
    write(`scripts/${script}`, readFileSync(join(source, 'scripts', script)));
  }
  for (const name of names) {
    for (const host of ['.claude-plugin', '.codex-plugin']) {
      write(`packages/${name}/${host}/plugin.json`, JSON.stringify({ name, version: '1.0.0', skills: './skills/' }));
    }
    write(`packages/${name}/README.md`, name);
    write(`packages/${name}/skills/example/SKILL.md`, '---\nname: example\ndescription: test\n---\n');
    write(`packages/${name}/skills/_shared/helper.md`, 'support');
  }
  write('packages/db-first/.mcp.json', '{}');
  write('packages/db-first/.mcp.codex.json', '{}');
  write('packages/db-first/.db-fetcher.example.json', '{}');
  write('packages/db-first/mcp-db-fetcher/dist/index.js', '// bundle');
  write('packages/db-first/mcp-db-fetcher/src/index.ts', 'const server = { version: "1.0.0" };');
  write('packages/db-first/mcp-db-fetcher/package.json', '{"version":"1.0.0"}');
  write('.claude-plugin/marketplace.json', JSON.stringify({ plugins: names.map(name => ({ name, version: '1.0.0', source: `./dist/${name}` })) }));
  write('package.json', JSON.stringify({ private: true, scripts: { dist: 'node build-fixture.mjs' } }));
  write('build-fixture.mjs', `import { existsSync } from 'node:fs';
if (existsSync('fail-build')) process.exit(1);
await import('./scripts/assemble-dist.mjs');`);
  const run = (script, ...args) => spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
    cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  const json = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
  return { root, write, run, json };
}

test('missing required skills fails assembly and preserves the previous distribution', t => {
  const f = fixture(t);
  f.write('dist/previous.txt', 'published');
  rmSync(join(f.root, 'packages/db-first/skills'), { recursive: true });
  const result = f.run('assemble-dist.mjs');
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(readFileSync(join(f.root, 'dist/previous.txt'), 'utf8'), 'published');
});

test('missing SKILL.md fails assembly instead of shipping an undiscoverable skill', t => {
  const f = fixture(t);
  rmSync(join(f.root, 'packages/db-first/skills/example/SKILL.md'));
  assert.notEqual(f.run('assemble-dist.mjs').status, 0);
});

test('complete assembly includes support files and replaces obsolete distribution files', t => {
  const f = fixture(t);
  f.write('dist/obsolete.txt', 'old');
  f.write('packages/db-first/skills/guide.md', 'root support');
  const result = f.run('assemble-dist.mjs');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(f.root, 'dist/obsolete.txt')), false);
  assert.equal(readFileSync(join(f.root, 'dist/db-first/skills/guide.md'), 'utf8'), 'root support');
  assert.equal(readFileSync(join(f.root, 'dist/db-first/skills/_shared/helper.md'), 'utf8'), 'support');
});

test('retrying an explicit version after a build failure repairs dist', t => {
  const f = fixture(t);
  assert.equal(f.run('assemble-dist.mjs').status, 0);
  f.write('fail-build', '');
  assert.notEqual(f.run('version-bump.mjs', 'db-first', '1.1.0').status, 0);
  assert.equal(f.json('dist/db-first/.claude-plugin/plugin.json').version, '1.0.0');
  rmSync(join(f.root, 'fail-build'));
  const retry = f.run('version-bump.mjs', 'db-first', '1.1.0');
  assert.equal(retry.status, 0, retry.stderr);
  for (const host of ['.claude-plugin', '.codex-plugin']) {
    assert.equal(f.json(`dist/db-first/${host}/plugin.json`).version, '1.1.0');
  }
});

test('same version synchronizes drifted metadata and builds', t => {
  const f = fixture(t);
  f.write('packages/db-first/.codex-plugin/plugin.json', '{"name":"db-first","version":"0.9.0"}');
  const result = f.run('version-bump.mjs', 'db-first', '1.0.0');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.json('dist/db-first/.codex-plugin/plugin.json').version, '1.0.0');
});

test('invalid argument count is rejected before version files change', t => {
  const f = fixture(t);
  assert.notEqual(f.run('version-bump.mjs', 'patch', 'extra', 'extra').status, 0);
  assert.equal(f.json('packages/db-first/.claude-plugin/plugin.json').version, '1.0.0');
});

test('all-plugin bump synchronizes both host manifests, catalog and MCP metadata', t => {
  const f = fixture(t);
  const result = f.run('version-bump.mjs', 'patch');
  assert.equal(result.status, 0, result.stderr);
  for (const name of names) {
    for (const host of ['.claude-plugin', '.codex-plugin']) {
      assert.equal(f.json(`packages/${name}/${host}/plugin.json`).version, '1.0.1');
      assert.equal(f.json(`dist/${name}/${host}/plugin.json`).version, '1.0.1');
    }
  }
  assert.deepEqual(f.json('.claude-plugin/marketplace.json').plugins.map(p => p.version), ['1.0.1']);
  assert.equal(f.json('packages/db-first/mcp-db-fetcher/package.json').version, '1.0.1');
  assert.match(readFileSync(join(f.root, 'packages/db-first/mcp-db-fetcher/src/index.ts'), 'utf8'), /version: "1\.0\.1"/);
});
