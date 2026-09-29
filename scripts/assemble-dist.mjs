#!/usr/bin/env node
// dist/ 디렉토리에 배포용 런타임 파일만 조립하는 스크립트
// 사용: node scripts/assemble-dist.mjs

import { cp, rm, mkdir, readdir, stat, mkdtemp, rename } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');
const DIST = join(ROOT, 'dist');

// 플러그인별 런타임 필수 파일 정의
const PLUGINS = [
  {
    name: 'db-first',
    files: [
      '.claude-plugin/plugin.json',
      '.codex-plugin/plugin.json',
      '.mcp.json',
      '.mcp.codex.json',
      '.db-fetcher.example.json',
      'mcp-db-fetcher/dist/index.js',
      'README.md',
    ],
    // glob 패턴 대신 디렉토리 + 파일명으로 수집
    skillDirs: ['skills'],
  },
  {
    name: 'dev-kit',
    files: [
      '.claude-plugin/plugin.json',
      '.codex-plugin/plugin.json',
      'README.md',
    ],
    skillDirs: ['skills'],
    // 통째로 복사하는 디렉토리 (skill 전용 agent 등)
    dirs: ['agents'],
  },
];

async function copyFile(src, dest) {
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest);
}

async function copySkills(pluginSrc, pluginDist, skillDirs) {
  for (const dir of skillDirs) {
    const srcDir = join(pluginSrc, dir);
    const entries = await readdir(srcDir, { withFileTypes: true });
    let skillCount = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      const skillFile = join(srcDir, entry.name, 'SKILL.md');
      if (!(await stat(skillFile)).isFile()) throw new Error(`Missing skill file: ${skillFile}`);
      skillCount++;
    }
    if (skillCount === 0) throw new Error(`No skills found in required directory: ${srcDir}`);
    // Include shared directories and root-level supporting files as well.
    await cp(srcDir, join(pluginDist, dir), { recursive: true });
  }
}

async function assemble() {
  // Assemble beside dist, then replace it only after every required file exists.
  // All rename/remove targets are fixed children of ROOT or this mkdtemp result.
  const staging = await mkdtemp(join(ROOT, '.dist-stage-'));
  const next = join(staging, 'next');
  const previous = join(staging, 'previous');
  let keepRecovery = false;
  try {
    await mkdir(next);
    for (const plugin of PLUGINS) {
      const pluginSrc = join(PACKAGES, plugin.name);
      const pluginDist = join(next, plugin.name);

      console.log(`📦 Assembling ${plugin.name}...`);

      // 개별 파일 복사
      for (const file of plugin.files) {
        const src = join(pluginSrc, file);
        const dest = join(pluginDist, file);
        try {
          await copyFile(src, dest);
          console.log(`  ✅ ${file}`);
        } catch (err) {
          console.error(`  ❌ ${file}: ${err.message}`);
          throw err;
        }
      }

      // skills 복사
      await copySkills(pluginSrc, pluginDist, plugin.skillDirs);
      console.log(`  ✅ skills/`);

      // 추가 디렉토리 복사
      for (const dir of plugin.dirs ?? []) {
        await cp(join(pluginSrc, dir), join(pluginDist, dir), { recursive: true });
        console.log(`  ✅ ${dir}/`);
      }
    }
    let previousMoved = false;
    try {
      await rename(DIST, previous);
      previousMoved = true;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    try {
      await rename(next, DIST);
    } catch (err) {
      if (previousMoved) {
        try {
          await rename(previous, DIST);
        } catch (restoreError) {
          keepRecovery = true;
          throw new Error(`Could not restore dist; previous release is at ${previous}`, { cause: restoreError });
        }
      }
      throw err;
    }
    console.log('\n✅ dist assembly complete');
  } finally {
    if (!keepRecovery) await rm(staging, { recursive: true, force: true });
  }
}

await assemble().catch(err => {
  console.error(`\n❌ dist assembly failed: ${err.message}`);
  process.exitCode = 1;
});
