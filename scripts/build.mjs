#!/usr/bin/env node
// 공유 esbuild 빌드 스크립트
//   MCP 패키지:  node ../../../scripts/build.mjs            → dist/index.js (기본값)
//   Skill 패키지: node ../../../../scripts/build.mjs scripts/index.js
import { build } from 'esbuild';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

const outfile = process.argv[2] ?? 'dist/index.js';
const outdir = dirname(outfile);

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile,
  // CJS 모듈(dotenv, mssql 등)이 require()를 사용할 수 있도록 shim 주입
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log(`✅ build complete → ${outfile}`);
