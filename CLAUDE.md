# CLAUDE.md

## 개요

Claude/Codex 플러그인 마켓플레이스 저장소 (`pyan-labs/pyan-blueprint`). 두 플러그인을 배포한다.

- `db-first` — MS SQL 스키마를 읽는 MCP 서버(`mcp-db-fetcher`)와 스킬(`db-to-efcore`).
- `dev-kit` — pyan 개발 팀 공통 스킬(`commit` 등). 스킬만 있고 빌드 대상 없음.

## 명령어 (루트, pnpm)

```bash
pnpm install
pnpm run build      # esbuild 번들
pnpm run dist       # build + dist/ 조립
pnpm run lint       # 타입 체크
pnpm --filter @pyanllc/mcp-db-fetcher test:unit   # 단위 테스트 (DB 불필요)
```

## 구조

```
.claude-plugin/marketplace.json    # Claude 마켓플레이스
.agents/plugins/marketplace.json   # Codex 마켓플레이스
packages/db-first/                 # 소스
  .claude-plugin/ .mcp.json        # Claude용 매니페스트·MCP 설정
  .codex-plugin/  .mcp.codex.json  # Codex용 매니페스트·MCP 설정
  mcp-db-fetcher/src/              # MCP 서버 (TypeScript)
  skills/                          # 공용 스킬
packages/dev-kit/                 # 팀 공통 스킬 (매니페스트 + skills/)
dist/<plugin>/                     # 배포본 (pnpm run dist로 생성)
scripts/                           # 빌드·배포·버전 스크립트
```

## 규칙

- `dist/`는 git에 커밋한다. 소스를 바꾸면 `pnpm run dist` 후 함께 커밋.
- 플러그인을 추가하면 두 marketplace.json, `scripts/assemble-dist.mjs`, `scripts/version-bump.mjs`의 `PLUGINS`에 함께 등록한다.
- DB 설정은 `.db-fetcher.json` (템플릿: `packages/db-first/.db-fetcher.example.json`). 커밋 금지.
