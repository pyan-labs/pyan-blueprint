# Handoff — db-fetcher `.db-fetcher.json` 탐색 순서 (local → parent → global)

- 작성일: 2026-09-18
- 대상 repo: `team-plugins` (이 문서가 있는 repo)
- 작업 브랜치: `ft-db-fetcher-global-config` (`dev`에서 분기)
- 상태: **구현 완료 (5.2.0).** 3절의 설계는 제안대로 승인됐고(global은 `~/.db-fetcher.json`, 첫 파일만 사용, override 환경 변수 없음), 5절의 1~7번을 마쳤다. 남은 것은 PR 머지와 9번(설치 버전 갱신)이다. 아래 본문은 인계 시점의 기록이다
  - 인계 시점의 테스트 파일은 `afterEach`가 `process.env`를 통째로 바꿔 `os.homedir()`에 반영되지 않는 버그가 있었다. 키 단위 복원으로 고쳤다
  - 버전은 `db-first minor`가 아니라 전체 bump로 올렸다 (5.0.0부터 두 플러그인 공통 버전)
  - CHANGELOG의 5.1.1·5.1.2 항목은 근거가 없어 채우지 않았다

## 1. 요청

`db-fetcher` MCP 서버가 `.db-fetcher.json`을 **local → parent → global** 순으로 찾아 쓰게 한다.

- local: 세션을 연 디렉토리
- parent: 그 상위 디렉토리들 (위로 올라가며)
- global: 사용자 홈의 설정 파일

## 2. 발단과 조사 결과

다른 repo(BAW umbrella repo)의 `database/` 폴더에서 세션을 열고 `list_connections`를 호출했더니, `database/.db-fetcher.json`이 아니라 umbrella 루트의 `.db-fetcher.json`이 읽혔다. 두 파일은 `prod` 환경이 서로 다른 DB를 가리키고 있어서, 운영 DB 검사를 엉뚱한 DB에 할 뻔했다.

처음에는 탐색 순서 버그로 의심했지만 **순서 버그가 아니었다.** 확인한 사실:

| 확인 항목 | 결과 |
|---|---|
| 현재 탐색 로직 (`connection-manager.ts`의 `findConfigFile`) | `CLAUDE_PROJECT_DIR ?? process.cwd()`에서 시작해 위로 올라가며 첫 파일을 사용. 즉 local → parent는 이미 동작한다 |
| 실행 중인 서버 프로세스의 실제 환경 (PEB를 직접 읽어 확인) | `cwd`와 `CLAUDE_PROJECT_DIR` 모두 세션을 연 `database/` 폴더. Claude Code(VSCode 확장 2.1.273)는 git root가 아니라 세션 디렉토리를 넘긴다 |
| `database/.db-fetcher.json`의 생성 시각 | 세션 도중에 복사해 넣은 파일이었다 (수정 시각은 복사 원본의 옛 날짜가 유지됨) |
| 서버 재시작 후 `list_connections` | `database/.db-fetcher.json`을 정상적으로 읽음 |
| 4.1.3 빌드를 같은 환경 변수로 직접 띄운 재현 | local 파일을 정상적으로 읽음 |

**근본 원인은 설정 캐시다.** `loadConfig()`는 `cachedConfig`를 프로세스가 끝날 때까지 들고 있다. 서버가 뜬 시점에는 local 파일이 없어서 parent(루트) 파일을 읽었고, 이후 local 파일이 생겼어도 재시작 전까지 반영되지 않았다.

혼란을 키운 요인:

1. `list_connections` 결과에 **어떤 파일을 읽었는지가 없다.** stderr의 `config loaded:` 로그는 Claude Code의 MCP 로그에도 남지 않았다
2. global fallback이 없다. 홈 디렉토리 밖(예: `C:\develop\...`)의 프로젝트에서는 위로 올라가도 홈에 닿지 않는다
3. connection pool이 env 이름으로 캐시된다. 설정이 바뀌어도 같은 env 이름의 기존 pool이 옛 서버를 계속 가리킬 수 있다

참고: 사용자 PC에 설치된 플러그인은 아직 **4.1.3**이다 (`~/.claude/plugins/installed_plugins.json`). cache에는 5.0.0도 있고 소스는 5.1.2지만, 탐색 로직은 세 버전 모두 같다. 수정 후 배포할 때 설치 버전 갱신을 함께 확인해야 한다.

## 3. 제안 설계 (사용자 승인 전)

사용자는 구현 편집을 중단시키고 handoff를 요청했다. 아래 설계는 **아직 승인받지 않았다.** 다음 세션에서 먼저 확인받을 것.

수정 파일은 `packages/db-first/mcp-db-fetcher/src/` 아래다.

**`connection-manager.ts`**

- `findConfigFile(startDir, homeDir = os.homedir())`를 export하고 `{ path, scope }`를 돌려준다. `scope`는 `"local" | "parent" | "global"`
  - 시작 디렉토리에서 찾으면 `local`, 위로 올라가다 찾으면 `parent`
  - 끝까지 없으면 `~/.db-fetcher.json`을 확인해 `global`
  - 위로 올라가다 만난 파일이 홈의 파일과 같은 경로면 `global`로 표시 (Windows는 대소문자 무시 비교)
- **먼저 발견된 파일 하나만 쓴다.** 여러 파일의 `connections`를 병합하지 않는다 (YAGNI — 필요해지면 그때 결정)
- `loadConfig()`는 호출마다 다시 탐색하고, 경로·`mtimeMs`·`size`가 캐시와 같을 때만 캐시를 쓴다. 비용은 `existsSync` 몇 번과 `statSync` 한 번
  - `size`까지 보는 이유: 복사한 파일은 옛 수정 시각을 유지한다 (이번 사례)
- 설정이 바뀌거나 사라지면 기존 pool을 모두 닫고 비운다
- JSON 파싱 실패 시 오류 메시지에 파일 경로를 포함한다
- `getConfigLocation()`, `getGlobalConfigPath()` export 추가

**`types.ts`** — `ConfigScope`, `ConfigLocation` 타입 추가

**`tools.ts`**

- `list_connections` 응답에 `config_path`, `config_scope` 추가
- `configGuard`의 "not found" 메시지에 탐색 순서와 global 경로 안내 추가

**결정이 필요한 항목**

| 항목 | 제안 | 대안 |
|---|---|---|
| global 위치 | `~/.db-fetcher.json` — 위로 올라가는 탐색의 자연스러운 끝점 | `~/.claude/.db-fetcher.json` |
| 여러 파일이 있을 때 | 첫 파일만 사용 | env 단위 병합 (local이 우선) |
| 명시적 override 환경 변수 (`DB_FETCHER_CONFIG` 등) | 넣지 않음 | 추가 |

## 4. 현재 작업 트리

```
ft-db-fetcher-global-config (dev에서 분기, 커밋 없음)
?? packages/db-first/mcp-db-fetcher/src/connection-manager.test.ts
?? docs/handoff-2026-09-18-db-fetcher-config-discovery.md   ← 이 문서
```

- `connection-manager.test.ts`: `node:test` 기반 테스트 8개. 임시 디렉토리에 home / parent / local 구조를 만들고, `CLAUDE_PROJECT_DIR`와 `USERPROFILE`·`HOME`을 바꿔 검증한다. DB 연결은 필요 없다
  - 탐색 순서 5개: local 우선, parent, global, 홈 아래 프로젝트의 global 표시, 없음
  - 재로딩 3개: 세션 도중 local 파일 생성(이번 사례), 같은 파일 수정, 읽던 파일 삭제 후 fallback
  - 실행: `npx tsx --test src/connection-manager.test.ts` (패키지 디렉토리에서)
  - **현재 실패한다** — `findConfigFile`, `getConfigLocation`이 아직 export되지 않아 import 단계에서 실패
- `connection-manager.ts` 편집은 **적용되지 않았다** (사용자가 거절). 소스는 `dev`와 동일하다
- 원래 있던 브랜치는 `ft-codex-spec-tools`였다 (`dev` + 커밋 1개, 작업 트리는 깨끗했음)

## 5. 남은 작업

1. 3절의 설계와 결정 항목을 사용자에게 확인받는다
2. `connection-manager.ts`, `types.ts`, `tools.ts` 구현 → 테스트 8개 통과 확인
3. `package.json`에 단위 테스트 스크립트 추가 여부 결정. 현재 `test`는 DB가 필요한 `test-client.ts`를 실행한다
4. `pnpm run lint` (tsc). 테스트 파일이 `src/**/*`에 포함되므로 타입 오류가 없어야 한다. esbuild 번들은 `src/index.ts` 기준이라 테스트 파일은 `dist`에 들어가지 않는다
5. 문서 갱신
   - `packages/db-first/README.md` — 설치 scope 설명과 "DB 연결 설정" 절에 탐색 순서·global 파일 안내
   - 루트 `CLAUDE.md`의 "DB 연결 설정" 절
   - `CHANGELOG.md` — 최상단 항목은 5.1.0인데 실제 버전은 5.1.2다. 5.1.1·5.1.2 항목이 비어 있는지 확인할 것
6. 버전 bump와 `dist/` 조립: `pnpm run version:bump db-first minor` (절차는 [scripts/VERSION-BUMP.md](../scripts/VERSION-BUMP.md)). `dist/`는 반드시 커밋 대상이다
7. 실제 확인: 빌드한 서버를 띄워 `list_connections`의 `config_path`·`config_scope`를 보고, 세션 도중 local 파일을 추가·삭제했을 때 재시작 없이 반영되는지 본다
8. PR: base `dev`, Squash merge (규칙은 루트 [CLAUDE.md](../CLAUDE.md)의 "Git 워크플로우")
9. 배포 후 사용자 PC의 설치 버전을 4.1.3에서 갱신하고, 다른 세션의 서버 프로세스도 재시작한다

## 6. 보류 중인 다른 작업 (이 repo 범위 밖)

이 조사는 BAW umbrella repo의 `database/dbo/SPs/mspGetPOScheduleItem.sql` 수정 작업 도중에 시작됐다. 그 작업은 멈춰 있다.

- 사용자 요청: `VPVSchedule` view를 참고해 SP를 손본다. PO에 남은 수량이 `bawsettings.POExportMinQty`보다 적으면 그 PO는 표시하지 않는다. `ProductId`가 실제로는 `PVId`인 점은 유지한다
- dev 데이터로 확인한 사실: 현재 SP는 이미 PO×PV 행 단위로 남은 수량이 기준 **이하**인 행을 지운다. 그래서 "무엇을 바꾸려는 것인지"(행 단위 유지 / PO 단위 숨김 / DLV 행까지 숨김 / 특정 사례)를 물었고 **답을 받지 못했다**
- 사용자는 "운영 기준으로 검사해 보라"고 했다. `database/` 폴더에서 연 세션은 이제 `prod` env가 `vanuatu` 운영 DB(readonly)를 가리키므로 검사할 수 있다
- 이 SP를 호출하는 곳은 BAWPosLink의 `DBService.POPVAsync()` → `BAWOnlinePOJob` 한 곳뿐이다. 결과 컬럼 이름·타입을 바꾸면 BAWPosLink도 고쳐야 한다

## 7. Suggested skills

- `superpowers:brainstorming` — 3절 설계를 사용자에게 승인받는 단계. bounded 경로로 충분하다
- `superpowers:test-driven-development` — 이미 작성된 실패 테스트에서 이어서 구현
- `superpowers:verification-before-completion` — 테스트·lint·실제 서버 동작을 확인한 뒤 완료 보고
- `superpowers:finishing-a-development-branch` — 구현 후 PR 정리
