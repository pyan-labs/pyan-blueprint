# Version Bump

Claude/Codex 플러그인 버전을 함께 갱신하는 스크립트. 현재 `db-first`를 지원한다.

## 사용법

플러그인 이름을 생략하면 `scripts/version-bump.mjs`의 `PLUGINS`에 등록된 **모든 플러그인**에 일괄 적용된다.

```bash
# 모든 플러그인 (플러그인 이름 생략)
pnpm run version:bump patch              # 각 플러그인 1.0.1 → 1.0.2
pnpm run version:bump minor              # 각 플러그인 1.0.1 → 1.1.0
pnpm run version:bump major              # 각 플러그인 1.0.1 → 2.0.0
pnpm run version:bump 1.2.3              # 명시적 버전 지정 (모든 플러그인)

# 플러그인 지정 (첫 번째 인자가 플러그인 이름)
pnpm run version:bump db-first patch     # db-first 버전 bump
pnpm run version:bump db-first 1.1.0     # db-first 명시적 버전
```

> 플러그인마다 현재 버전이 다를 수 있으므로, 생략 실행 시 각 플러그인은 자신의 현재 버전 기준으로 bump된다. 명시적 버전(`1.2.3`)을 주면 모든 대상 플러그인이 동일 버전으로 맞춰진다.

## 업데이트 대상

플러그인마다 파일 구성이 달라 업데이트 대상이 다르다. `plugin.json`이 버전의 단일 출처(SSoT)이고, 나머지 파일은 있는 경우에만 갱신한다.

### 공통

| 파일 | 필드 |
|------|------|
| `.claude-plugin/marketplace.json` | 해당 플러그인 entry의 `version` |
| `packages/<plugin>/.claude-plugin/plugin.json` | `version` |
| `packages/<plugin>/.codex-plugin/plugin.json` | `version` (Codex 매니페스트가 있는 경우) |

### db-first 추가 대상 (MCP 서버 포함)

| 파일 | 필드 |
|------|------|
| `packages/db-first/mcp-db-fetcher/package.json` | `version` |
| `packages/db-first/mcp-db-fetcher/src/index.ts` | `McpServer.version` |

skill 전용 플러그인은 `packageJson`·`indexTs`를 생략하면 해당 대상이 없다.

## 동작 순서

1. 대상 플러그인 결정 (이름 지정 시 해당 1개, 생략 시 전체)
2. 각 플러그인마다:
   - `plugin.json`에서 현재 버전 읽기
   - semver bump 계산 (또는 명시적 버전 사용) — 같은 버전이어도 대상 파일을 동기화
   - 해당 플러그인의 대상 파일 동시 업데이트 (있는 파일만)
3. `pnpm run dist` 자동 실행 (빌드 + dist/ 배포 디렉토리 조립) — 마지막에 한 번만

## 실패와 재시도

- 버전 파일 갱신 후 빌드가 실패하면 종료 코드 1을 반환한다. 버전 파일의 변경은 남는다.
- 배포 조립은 임시 디렉토리에서 진행한다. 필수 파일·스킬 폴더·`SKILL.md`가 없으면 실패하고 기존 `dist/`를 보존한다. 모두 조립한 뒤 기존 배포본과 교체한다.
- 실패 원인을 해결한 뒤 `pnpm run dist`를 실행하거나 **동일한 명시적 버전**으로 재시도한다. `patch`/`minor`를 다시 실행하면 버전이 한 번 더 올라간다.
- 배포할 때는 버전 변경과 `dist/`를 함께 커밋한다. 같은 버전의 내용만 바꾸면 Claude의 기존 설치에는 업데이트가 적용되지 않을 수 있다.
- 스크립트 회귀 검증: `pnpm run test:release`.
