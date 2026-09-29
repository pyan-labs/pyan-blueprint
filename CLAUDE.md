# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 리포지토리 개요

**pyan-blueprint**는 Claude/Codex 플러그인 마켓플레이스 저장소다(GitHub `pyan-labs/pyan-blueprint`, 마켓플레이스 이름 `pyan-blueprint`). 현재 `db-first`를 배포한다. `team-plugins`에서 분리됐다.

## 빌드 및 개발 명령어

**루트에서 실행 (pnpm workspace)**:

```bash
pnpm install                                               # 최초 의존성 설치
pnpm run build                                             # 전체 빌드 (esbuild 번들링)
pnpm run dist                                              # 빌드 + dist/ 배포 디렉토리 조립
pnpm run lint                                              # 전체 타입 체크
pnpm --filter @pyanllc/mcp-db-fetcher dev            # 특정 패키지 개발 모드
pnpm --filter @pyanllc/mcp-db-fetcher build          # 특정 패키지만 빌드
```

- 빌드 결과: `packages/*/mcp-*/dist/index.js` 단일 번들 파일 (node_modules 없이 독립 실행 가능)
- **`dist/` 디렉토리는 반드시 git에 커밋** — 플러그인 설치 시 이 디렉토리가 사용자에게 배포됨
- `pnpm run dist`는 빌드 후 런타임 필수 파일만 `dist/`에 조립한다
- 개발 환경 설정 및 새 MCP/Skill 추가 절차 → [DEV-GUIDE.md](DEV-GUIDE.md)

## 전체 구조

```
pyan-blueprint/
├── .claude-plugin/marketplace.json    # Claude Code용 플러그인 레지스트리 카탈로그
├── .agents/plugins/marketplace.json   # Codex CLI용 레지스트리 (db-first)
├── packages/                          # 소스 코드 (개발용)
│   └── db-first/                      # 핵심 플러그인 소스 (Claude/Codex)
│       ├── .claude-plugin/plugin.json # 플러그인 메타데이터
│       ├── .mcp.json                  # MCP 서버 설정 + env var 매핑
│       ├── mcp-db-fetcher/            # Node.js/TypeScript MCP 서버
│       │   ├── src/
│       │   │   ├── index.ts           # 진입점 (stdio transport)
│       │   │   ├── tools.ts           # 8개 MCP tool 등록
│       │   │   ├── connection-manager.ts  # DB 연결 풀 + ADO.NET 파싱
│       │   │   ├── types.ts           # 공유 타입
│       │   │   └── queries/           # SQL 쿼리 모듈별 분리
│       │   └── dist/                  # 빌드 결과물
│       ├── skills/                    # Claude Code slash command 정의
│       │   ├── db-to-efcore/SKILL.md
│       │   ├── db-to-rest-api/SKILL.md
│       │   └── db-to-frontend/SKILL.md
│       └── MCP-DEV-GUIDE.md           # MCP 서버 개발 절차 가이드
├── dist/                              # 배포용 (런타임 파일만, 빌드 시 자동 생성)
│   ├── db-first/                      # 플러그인 설치 시 이 디렉토리가 배포됨
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .mcp.json
│   │   ├── mcp-db-fetcher/dist/index.js
│   │   └── skills/*/SKILL.md
└── scripts/                           # 빌드/배포 스크립트
```

## 아키텍처

### 플러그인 시스템

`.claude-plugin/plugin.json`이 플러그인 메타데이터를 정의하고, `.mcp.json`이 MCP 서버 실행 명령과 환경변수 매핑을 담당한다. Claude Code는 `CLAUDE_PLUGIN_ROOT` 환경변수로 플러그인 루트 경로를 주입한다.

**Codex CLI에도 db-first가 등록되어 있다.** 같은 `dist/` 번들을 쓰고 매니페스트는 별도다 — `.codex-plugin/plugin.json` + `.agents/plugins/marketplace.json`(`local` source). skill은 공용이다.

db-first의 프로젝트별 설정 전달 (codex-cli 0.145.0 설치·MCP 설정 해석 검증):

- Claude는 기존 `.mcp.json`과 `CLAUDE_PROJECT_DIR` 자동 탐색을 유지한다.
- Codex는 별도 `.mcp.codex.json`에서 `"cwd": "."` + 상대경로로 설치된 번들을 실행한다.
- 공용 스킬은 모든 도구 호출에 현재 프로젝트 절대 경로 `project_dir`를 전달한다. Codex에서는 필수 인자이며, 환경변수/roots의 자동 전달에 의존하지 않는다.
- 명시된 프로젝트 → 상위 디렉토리에서 설정을 찾고 홈 설정으로 대체하지 않는다. 같은 서버 프로세스의 호출은 순차 처리하여 설정·연결 풀 전환이 진행 중 조회와 겹치지 않게 한다.

### MCP 서버 데이터 흐름

`index.ts` → `registerTools()` → tool 호출 시 `connection-manager.getPool(env?)`로 연결 풀 획득 → `queries/*.ts`에서 SQL 실행 → JSON 반환

8개 tool: `list_connections`, `get_all_tables`, `get_table_schema`, `get_relationships`, `get_indexes`, `get_stored_procedures`, `get_sample_data`, `run_select_query` — 각 tool은 `.db-fetcher.json`의 `open` 환경을 기본으로 사용


## spec-cycle 워크플로우

이 repo의 코드 변경은 `spec-cycle` 플러그인(`team-plugins` 마켓플레이스에서 설치)의 네 스킬로 진행한다: `/spec-design <todo>` → `/spec-implement <폴더>` → `/spec-review <폴더>` → `/spec-digest <폴더>`. 산출물은 `docs/spec-cycle/<yyyy-mm-dd-##-subject>/`에 쌓이고, todo는 `docs/spec-cycle/todo/`에 둔다.

- 산출물: spec.md, amendment-<N>.md, progress.md, findings.md, digest.md
- 승인된 spec의 개정은 `/spec-design --amend <폴더>`로 같은 폴더에 `amendment-<N>.md`를 쓴다. spec.md는 고치지 않는다.
- 구현, 리뷰, 기록은 feature 브랜치를 checkout한 `.worktrees/<stem>`에서 하고, 메인 체크아웃은 `dev`에 남는다. 병합 뒤 `git worktree remove .worktrees/<stem>`과 `git branch -d <브랜치>`, `.spec-cycle/<stem>/` 삭제로 정리한다.

규약은 설치된 spec-cycle 플러그인의 `skills/_shared/conventions.md`. 네 스킬은 병합·push·PR을 하지 않으므로 그 뒤는 아래 Git 워크플로우대로 한다.

## DB 연결 설정

각 워크스페이스에서 `.db-fetcher.json`을 설정하여 DB 연결을 구성한다. 템플릿은 `packages/db-first/.db-fetcher.example.json` 참조.

탐색 순서는 **local**(`CLAUDE_PROJECT_DIR ?? cwd`) → **parent**(상위 디렉토리들) → **global**(`~/.db-fetcher.json`)이고, 먼저 발견된 파일 하나만 쓴다 (병합하지 않음). `loadConfig()`는 호출마다 다시 탐색하며 경로·`mtimeMs`·`size`가 같을 때만 캐시를 쓴다. 설정이 바뀌면 connection pool을 모두 버린다. 읽은 파일은 `list_connections`의 `config_path`·`config_scope`로 확인한다.

단위 테스트(DB 불필요): `pnpm --filter @pyanllc/mcp-db-fetcher test:unit`. `test`는 실제 DB가 필요한 `test-client.ts`를 실행한다.
