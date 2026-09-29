# Version Bump + Dist 통합 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** version-bump.mjs의 경로를 새 구조(packages/)에 맞게 수정하고, bump 후 dist 조립까지 자동 실행되도록 개선

**Architecture:** version-bump.mjs의 파일 경로 4개를 packages/db-first/로 변경하고, 마지막 빌드 단계를 `pnpm run dist`로 변경하여 build + assemble-dist를 한 번에 수행

**Tech Stack:** Node.js ESM script, pnpm

---

### Task 1: version-bump.mjs 경로 및 빌드 명령 수정

**Files:**
- Modify: `scripts/version-bump.mjs:21-25` (파일 경로)
- Modify: `scripts/version-bump.mjs:88` (콘솔 출력 경로)
- Modify: `scripts/version-bump.mjs:93` (콘솔 출력 경로)
- Modify: `scripts/version-bump.mjs:98` (콘솔 출력 경로)
- Modify: `scripts/version-bump.mjs:103` (콘솔 출력 경로)
- Modify: `scripts/version-bump.mjs:108` (빌드 명령)

**Step 1: 파일 경로 수정**

```javascript
const files = {
  marketplace: resolve(root, ".claude-plugin/marketplace.json"),
  plugin: resolve(root, "packages/db-first/.claude-plugin/plugin.json"),
  packageJson: resolve(root, "packages/db-first/mcp-db-fetcher/package.json"),
  indexTs: resolve(root, "packages/db-first/mcp-db-fetcher/src/index.ts"),
};
```

**Step 2: 콘솔 출력 경로 수정**

```
✔ packages/db-first/.claude-plugin/plugin.json
✔ packages/db-first/mcp-db-fetcher/package.json
✔ packages/db-first/mcp-db-fetcher/src/index.ts
```

**Step 3: 빌드 명령 변경**

```javascript
execSync("pnpm run dist", { cwd: root, stdio: "inherit" });
```

**Step 4: 검증**

Run: `pnpm run version:bump patch`
Expected: 버전이 3.3.0 → 3.3.1로 bump, 4개 파일 업데이트, build + dist 조립 완료

**Step 5: dist 결과 확인**

Run: `find dist/ -type f`
Expected: dist/db-first/ 안에 plugin.json(version: 3.3.1), .mcp.json, index.js, SKILL.md 파일들

---

### Task 2: VERSION-BUMP.md 문서 업데이트

**Files:**
- Modify: `scripts/VERSION-BUMP.md`

**Step 1: 경로 및 동작 순서 업데이트**

업데이트 대상 테이블:
| 파일 | 필드 |
|------|------|
| `.claude-plugin/marketplace.json` | `plugins[0].version` |
| `packages/db-first/.claude-plugin/plugin.json` | `version` |
| `packages/db-first/mcp-db-fetcher/package.json` | `version` |
| `packages/db-first/mcp-db-fetcher/src/index.ts` | `McpServer.version` |

동작 순서 4번: `pnpm run dist` 자동 실행 (빌드 + dist 조립)

**Step 2: Commit**

```bash
git add scripts/version-bump.mjs scripts/VERSION-BUMP.md
git commit -m "fix: update version-bump paths for packages/ structure"
```
