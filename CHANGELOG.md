## [Unreleased]

### Repository split — pyan-blueprint

- `team-plugins`에서 `db-first`만 분리해 `pyan-labs/pyan-blueprint` 저장소로 옮긴다. 마켓플레이스 이름은 `pyan-blueprint`다. 설치 명령은 `db-first@team-plugins`에서 `db-first@pyan-blueprint`로 바뀐다.
- 아래 과거 항목의 spec-tools·spec-cycle 기록은 `team-plugins` 시절의 기록이다.

### Plugin management — Claude/Codex

- 세 플러그인(`db-first`, `spec-tools`, `spec-cycle`)을 Claude/Codex 마켓플레이스에 등록하고 설치 안내를 통일한다. 과거 릴리스의 지원 범위는 해당 시점의 기록이다.
- 배포 조립 실패 시 기존 `dist/`를 보존한다. 필수 스킬 폴더와 `SKILL.md`가 누락되면 실패 처리하고, 공용 보조 파일도 함께 배포한다.
- 같은 명시적 버전으로 다시 실행해도 메타데이터를 동기화하고 빌드를 재시도한다. 루트 개발 명령의 패키지 이름과 개발 가이드의 빌드 경로를 수정한다.

### Added

- spec-cycle: progress.md에 TDD 증거 줄 `슬라이스 N: RED <테스트 이름> — <실패 요지 한 줄>`과 `슬라이스 N: RED 없음 — <이유>`. inline 방식과 orchestrator 방식 모두 쓴다. spec-review 전체 리뷰는 이 줄이 없는 슬라이스를 Important로 올린다
- spec-cycle: progress.md 머리말에 `- 준비:`와 `- 기준 테스트:` 줄. 첫 슬라이스 전에 전체 테스트를 한 번 돌려 기록하고, spec-review는 기준 시점에 이미 실패하던 테스트를 finding으로 올리지 않고 findings.md `- 기존 실패:`에 적는다
- spec-cycle: 리뷰 지적 반박. 수정 모드의 `finding <ID>: 반박 — <근거>`와 수정 라운드의 `반박:` 줄을 재리뷰가 코드로 확인해 WITHDRAWN 또는 NOT ADDRESSED로 판정한다. WITHDRAWN은 Verdict의 남은 항목에서 빠진다
- spec-cycle: 승인 뒤 spec 개정. `/spec-design --amend <폴더>`가 같은 폴더에 `amendment-<N>.md`를 쓰고, 나머지 스킬은 spec.md에 amendment를 겹친 유효 spec(conventions.md `## 유효 spec`)을 읽는다. `slice-brief`는 amendment의 슬라이스 블록을 우선한다. 새 템플릿 `spec-design/amendment-template.md`
- spec-cycle: spec-review 재리뷰에서 범위 안에 amendment 커밋이 있으면 그 amendment가 바꾼 절을 diff와 대조해 `### 개정 대조` 소절에 새 finding으로 적는다
- spec-cycle: spec-design 승인 보고에서 인자가 todo 파일이었으면 다음 단계 줄 위에 todo 원문을 spec.md "원 요구"에 인용했으니 지워도 된다는 안내 줄을 쓴다. todo 파일은 커밋하지도 지우지도 않는다
- spec-cycle: spec 슬라이스의 선택 항목 `- 모델: <sonnet | opus | fable>`. orchestrator가 그 모델로 구현 subagent를 띄운다
- spec-cycle: README에 "superpowers와 함께 켜지 않는다" 절과 작업 폴더 흐름, 병합 뒤 정리 명령
- spec-cycle: orchestrator가 병렬 슬라이스용 `.worktrees/<stem>-slice-N`을 만들 때도 구현 subagent를 띄우기 전에 worktree 준비(복사 목록과 준비 명령)를 한다. progress.md 머리말 `- 준비:` 줄은 `복사: <경로 목록>; 명령: <명령>` 형식이다
- spec-cycle: spec-review 개정 재리뷰. 재리뷰 범위에 amendment 커밋이 있으면 절 제목을 `## 재리뷰 R (개정)`으로 쓰고, amendment가 추가하거나 바꾼 슬라이스에 전체 리뷰의 검사(요구사항 대조, RED, 품질)를 적용한다. 개정 재리뷰는 수정 라운드 수에 들어가지 않으므로 `Rounds: 2/2` 줄을 붙이지 않는다

### Changed

- spec-cycle: 네 스킬에 `disable-model-invocation: true`와 `argument-hint`. `/`로만 실행되고 description에서 자연어 트리거 문구를 뺐다
- spec-cycle: spec-review가 `context: fork`로 격리된 subagent에서 돈다. 인자는 `$ARGUMENTS`로 받는다
- spec-cycle: spec-design 승인 뒤 메인 체크아웃의 브랜치를 바꾸지 않는다. feature 브랜치와 `.worktrees/<stem>`을 만들고 그 안에서 spec.md를 커밋한다. spec-implement는 `.worktrees/<stem>`에서 구현한다. worktree가 없으면 spec.md를 가진 로컬 브랜치를 찾아 만든다. 새 worktree는 conventions.md "worktree 준비"대로 채운다. 프로젝트 지시 파일의 `spec-cycle worktree 복사:` 목록에 있는 gitignore된 파일(설정, 비밀 값)만 메인 체크아웃에서 복사하고, 의존성은 준비 명령으로 설치한다. 목록에 없는 파일 때문에 테스트가 실패하면 기존 실패로 넘기지 않고 멈춘다. stem 일련번호는 모든 worktree의 `docs/spec-cycle/`까지 찾는다
- spec-cycle: conventions.md "인자 해석"이 spec.md를 현재 체크아웃, `.worktrees/<stem>`, 로컬 브랜치 순서로 찾는다. 메인 체크아웃을 spec 브랜치로 전환하라는 안내를 뺐다. worktree를 만들지 않는 스킬(spec-review, spec-digest, `--amend`)은 찾은 브랜치 이름과 함께 `/spec-implement`를 먼저 부르라고 안내한다
- spec-cycle: spec-digest가 ready to merge 보고에 병합 뒤 정리 명령을 적고, digest.md `## 관련`에 `- amendment:` 줄을 둔다
- CLAUDE.md: "spec-cycle 워크플로우" 절에 amendment, `--amend`, `.worktrees/<stem>` 작업 흐름

---

## [5.4.1] - 2026-09-27

### Fixed

- spec-cycle: spec-review가 작업 위치를 확인하지 않아 spec 브랜치가 아닌 곳(예: `dev`)에서 부르면 `기준 커밋..HEAD`에 다른 작업의 커밋이 섞인 채 리뷰가 진행되던 문제. 이제 현재 브랜치 또는 `.worktrees/<stem>`이 spec의 브랜치일 때만 리뷰하고, 아니면 보고하고 끝낸다. spec-digest도 `.worktrees/<stem>`을 찾는다
- spec-cycle: inline 방식과 수정 모드에서 progress.md를 코드 커밋에 "함께 넣는다"고 해 커밋 sha를 미리 알 수 없던 모순. 모든 방식에서 progress.md만 따로 커밋한다. 수정 모드의 마지막 `finding` 줄이 커밋되지 않던 문제도 함께 해결
- spec-cycle: 스킬이 `../_shared/conventions.md`와 `<스킬 폴더>`를 가리키면서 그 경로를 얻는 방법이 없던 문제. Claude Code가 치환하는 `${CLAUDE_PLUGIN_ROOT}`와 `${CLAUDE_SKILL_DIR}`로 바꿨다
- spec-cycle: findings.md에 `Rounds: 2/2`가 있어도 spec-implement가 수정 모드로 들어가고 spec-review는 3회차를 거부해 사용자 판정 뒤 흐름이 막히던 문제. 사용자가 `Rounds:` 줄을 지우면 다음 라운드가 열린다. 구현이 끝난 폴더(`완료: head` 있음)로 spec-implement를 다시 부르면 마무리를 반복하던 문제도 "할 일 없음" 보고로 바꿈
- spec-cycle: 마무리의 `완료: head <sha>`에서 "2의 커밋"이 커밋할 변경이 없을 때 정의되지 않던 것을 "2가 끝난 시점의 HEAD"로 명확히

### Changed

- spec-cycle: 산출물 폴더를 `docs/specs/`에서 `docs/spec-cycle/`로 변경. spec-tools의 `docs/specs/`(superpowers spec 위치)와 이름이 겹치지 않는다. 이 repo의 `docs/specs/2026-09-27-01-spec-cycle/`도 `docs/spec-cycle/`로 이동
- spec-cycle: spec-design 승인 뒤 단계에서 현재 브랜치가 프로젝트 지시 파일의 기반 브랜치(예: `dev`)와 다르면 feature 브랜치를 만들지 않고 보고한다. 검토 요청 메시지에 현재 브랜치와 HEAD를 넣는다
- spec-cycle: conventions.md에 메인 체크아웃 루트를 얻는 명령(`git worktree list --porcelain | head -1`)과 "스킬 파일 경로" 절, index.md 병합 충돌 안내 추가
- spec-cycle: README의 "Codex가 리뷰해도 된다"를 Codex 등록은 실사용 뒤 결정한다는 문장으로 수정
- spec-cycle: 스크립트 세 개에 실행 비트 부여
- db-first, spec-tools: 변경 없음 (공통 버전 규칙에 따라 버전만 5.4.1)

---

## [5.4.0] - 2026-09-27

### Added

- spec-cycle: 새 플러그인. 코드 변경 한 건을 설계 → 구현 → 리뷰 → 기록 네 스킬로 진행한다. `spec-design`(todo → `docs/specs/<stem>/spec.md` + feature 브랜치), `spec-implement`(spec만 보고 슬라이스별 커밋, subagent 도구가 있고 독립 슬라이스가 둘 이상이면 병렬 orchestrator, 아니면 inline), `spec-review`(기준 커밋..HEAD diff를 spec의 수용 기준·리뷰 기준과 대조해 구현 요약과 findings.md), `spec-digest`(결과 중심 기록 digest.md와 `docs/specs/index.md`). spec 하나가 단계 사이의 계약서라 각 단계를 새 세션이나 다른 에이전트가 이어받을 수 있다
- spec-cycle: 네 스킬 공용 규약 `skills/_shared/conventions.md`(폴더 구조 · stem 규칙 · 정지 조건 넷 · gitignore 처리 · 문체 · 증거 규칙)
- spec-cycle: 구현 보조 스크립트 `workspace` · `slice-brief` · `review-package`(superpowers MIT 스크립트 이식). `slice-brief`는 마지막 슬라이스를 뽑을 때 뒤따르는 절을 포함하던 원본 결함을 고쳤다
- 이 repo에 `docs/specs/` 도입. 첫 spec은 `docs/specs/2026-09-27-01-spec-cycle/`(spec-cycle 자신의 설계)

### Changed

- db-first, spec-tools: 변경 없음 (공통 버전 규칙에 따라 버전만 5.4.0)
- CLAUDE.md: 전체 구조 트리와 "spec-cycle 워크플로우" 절 추가

---

## [5.2.0] - 2026-09-18

### Added

- db-first: `.db-fetcher.json` 탐색에 **global fallback** 추가. 순서는 local(세션을 연 디렉토리) → parent(상위 디렉토리들) → global(`~/.db-fetcher.json`)이고, 먼저 발견된 파일 하나만 쓴다 (병합하지 않음). 홈 밖(예: `C:\develop\...`)의 프로젝트도 홈의 설정을 쓸 수 있다
- db-first: `list_connections` 응답에 `config_path`·`config_scope`(`local` | `parent` | `global`) 추가. 어떤 파일을 읽었는지 바로 확인할 수 있다
- db-first: DB 없이 도는 단위 테스트 `test:unit` (`node:test`, 탐색 순서 5개 + 재로딩 3개)

### Fixed

- db-first: 설정을 프로세스가 끝날 때까지 캐시하던 문제. 서버가 뜬 뒤에 더 가까운 `.db-fetcher.json`을 만들어도 재시작 전까지 상위 폴더의 파일이 계속 쓰였고, 두 파일의 `prod`가 서로 다른 DB를 가리키면 엉뚱한 DB를 조회하게 됐다. 이제 tool 호출마다 다시 탐색하고 경로·수정 시각·크기가 같을 때만 캐시를 쓴다 (복사한 파일은 옛 수정 시각을 유지하므로 크기도 비교한다)
- db-first: 설정이 바뀌거나 사라지면 connection pool을 모두 버린다. 이전에는 같은 env 이름의 pool이 옛 서버를 계속 가리킬 수 있었다

### Changed

- db-first: "not found" 안내에 탐색 순서와 global 경로를 표시. JSON 파싱 오류 메시지에 파일 경로를 포함
- spec-tools: 변경 없음 (공통 버전 규칙에 따라 버전만 5.2.0)

---

## [5.1.0] - 2026-08-16

### Added

- **spec-tools: Codex CLI 지원.** 같은 저장소를 `codex plugin marketplace add Pyanllc/team-plugins`로 등록해 설치한다. Claude Code와 병행 설치해도 서로 간섭하지 않는다
  - `.agents/plugins/marketplace.json` — Codex용 마켓플레이스 매니페스트. `local` source로 `dist/`의 같은 번들을 가리킨다
  - `packages/spec-tools/.codex-plugin/plugin.json` — Codex 매니페스트. 버전은 `version:bump`가 Claude 쪽과 함께 갱신한다
  - skill 3종은 무수정 재사용된다. 단 호출 접두사가 `/`가 아니라 `$`다 (`$spec-wiki`)

### Notes

- **당시 db-first의 Codex 등록을 보류했다.** codex-cli 0.145.0의 MCP 서버에 프로젝트 경로가 자동 전달되지 않아 기존 탐색 방식으로는 설정 파일을 찾지 못했다. 현재 Claude/Codex 배포에서는 호출별 `project_dir` 전달로 해결한다(Unreleased 참조).

---

## [5.0.1] - 2026-08-02

### Changed

- spec-tools: 병렬 dispatch를 **한 번에 최대 5개**로 제한. 대상이 더 많으면 5개씩 웨이브를 순차로 돌며, 앞 웨이브의 산출 파일을 확인한 뒤 다음을 띄운다. 웨이브는 날짜 순으로 묶어 어디까지 끝났는지 알아볼 수 있게 한다 (spec-explainer · spec-flow-e2e · spec-wiki 공통)

---

## [5.0.0] - 2026-08-02

### Changed

- 두 플러그인의 버전을 **5.0.0으로 통일**. 기능 변경은 없고 버전 문자열만 바뀐다 (db-first 4.1.3 → 5.0.0, spec-tools 4.6.0 → 5.0.0)
- 이후 CHANGELOG의 버전 번호는 두 플러그인 공통이다. 어느 플러그인의 변경인지는 각 항목 앞에 표기한다

---

## [4.6.0] - 2026-08-02

> 아래 4.2.0~4.6.0은 spec-tools만의 버전이다 (db-first는 4.1.3에 머물러 있었다).

### Added

- spec-tools: 날짜 컷오프의 절대 형태 `yyyy-mm-dd`를 세 skill 모두에서 받는다. `-N`과 동작은 같고 범위를 상대(`-7`)로 잡느냐 절대(`2026-07-01`)로 잡느냐만 다르다
- spec-wiki: `yyyy-mm-dd` 단독 인자 거절 규칙 제거 — 이제 컷오프로 동작한다. 옛 `spec-dashboard`와 인자 형태가 같으므로 보고에 "원문 이동 없음"을 명시해 아카이브로 오인하는 것을 막는다

### Changed

- 세 skill 모두 날짜 인자와 stem의 구별 규칙을 명시: `yyyy-mm-dd` 단독은 컷오프, 뒤에 subject가 붙으면(`2026-07-29-01-download`) stem

---

## [4.5.0] - 2026-08-02

### Added

- spec-tools: 세 skill 공통 인자 `-N`(예: `-7`) — stem 날짜가 `오늘 − N일` 이하(경계 포함)인 대상을 일괄 처리
  - `spec-explainer -N` · `spec-flow-e2e -N`: 문서가 **아직 없는** 대상만 생성(backfill). 기존 문서는 건드리지 않는다
  - `spec-wiki -N`: 해당 stem의 위키 페이지 전부 강제 재생성. `yyyy-mm-dd` 단독 인자는 계속 거절한다
- spec-explainer §0-1 · spec-flow-e2e §0-1: 대상 4개 이상이면 대상당 subagent 병렬 dispatch. 문서 간 일관성 요소(용어, e2e 단계 번호 체계·기준 커밋, spec-flow-e2e의 plan 통합 판단)는 dispatch 전에 취합자가 확정해 모든 프롬프트에 같은 값으로 넣는다
- 세 skill 모두 `-N` 실행 시 컷오프 날짜·건너뛴 stem 목록을 보고에 포함. spec-wiki는 "원문 이동 없음"을 함께 명시한다

### Changed

- spec-tools README: 공통 인자 `-N` 절 추가, skill별 호출 예시에 `-7` 형태 반영

---

## [4.4.0] - 2026-08-02

### Breaking Changes

- spec-tools: `/spec-tools:code-flow-e2e` → `/spec-tools:spec-flow-e2e` 명령어 이름 변경 — 기존 명령어는 더 이상 동작하지 않는다
- spec-explainer: 해설 문서 출력 폴더 `designs/` → `explains/` 변경. spec-wiki도 `explains/`만 스캔하므로, 기존 프로젝트는 `designs/*-explained.md`를 `explains/`로 직접 옮겨야 해설 문서가 위키에 잡힌다

---

## [4.3.0] - 2026-08-02

### Breaking Changes

- spec-tools: `/spec-tools:spec-dashboard` → `/spec-tools:spec-wiki` 명령어 이름 변경 — 기존 명령어는 더 이상 동작하지 않는다
- spec-wiki: 아카이브 기능 제거 — spec/plan을 더 이상 `archive/`로 옮기지 않는다. 원문은 읽기 전용으로만 참조한다
- spec-wiki: 인자 변경 — 아카이브 컷오프용 `-N`·`yyyy-mm-dd` 제거, 대상 stem을 강제 재생성하는 `<stem>`과 전부 재생성하는 `--all` 추가

### Added

- spec-wiki: spec·plan·해설(`designs/*-explained.md`)·e2e(`e2e/*-e2e.md`) 4종을 합성한 위키 페이지(`wiki/<stem>-wiki.md`)를 생성하고 Obsidian `[[링크]]`로 연결
- spec-wiki: `wiki/index.md`(사람·Obsidian 진입점), `wiki/index.json`(기계용 메타 + 원문 해시) 생성
- spec-wiki: 원문 해시를 기록해 반복 실행 시 내용이 바뀐 stem만 다시 쓰는 증분 갱신

### Changed

- spec-wiki: `dashboard.html`은 유지되나 아카이브 목록 대신 커버리지·태그 중심 카드로 구성 변경

---

## [4.2.0] - 2026-08-02

### Added

- spec-tools: `code-flow-e2e` skill 추가 — 구현이 끝난 plan의 코드 흐름을 소스코드 정본으로 복원해 `<BASE>/e2e/<stem>-e2e.md`로 쓴다. spec/plan은 읽을 소스의 지도로만 쓰므로 **plan과 구현의 어긋남을 찾아내 보고**하는 것이 주 산출이다
- spec-tools README: 워크플로우 배치도(`brainstorming → write-plan → spec-explainer → subagent-driven-development → code-flow-e2e → spec-dashboard`)와 디렉터리별 정본·시점 표

---

## [4.1.3] - 2026-07-23

### Added

- spec-tools: `/spec-dashboard`에 `yyyy-mm-dd` 인자 추가 — 지정한 날짜 이하(그 날짜 포함) pair만 아카이브
- version:bump 스크립트 — 플러그인 이름 생략 시 모든 플러그인 일괄 bump

### Changed

- README 전면 개편 — user scope 설치 3단계 flow + 초기화 후 재설치(문제 해결) 절차 추가
- VERSION-BUMP.md — spec-tools 지원 및 전체 적용 동작 문서화

---

## [4.0.2] - [Jay] - 2026-07-11

### Fixed

- user-scope 설치 시 `.db-fetcher.json`을 찾지 못하는 문제 수정 — Claude Code가 주입하는 `CLAUDE_PROJECT_DIR` 환경변수를 우선 사용하고, 없으면 기존처럼 `cwd`에서 상위 탐색 (anthropics/claude-code#42687 fix 반영)

### Changed

- `.db-fetcher.json` 미발견 에러 메시지에서 "--scope project로 설치" workaround 안내 제거, 탐색 시작 경로를 실제 사용된 경로로 표시

---

## [3.0.3] - [Jay] - 2026-04-02

### Breaking Changes

- `.env` + `connections.json` → `.db-fetcher.json` 단일 설정 파일로 통합
- MCP tool 인터페이스에서 `project`/`env` 필수 파라미터 제거
- Plugin 이름 변경: `db-dev-toolkit` → `db-first`

### Added

- `.db-fetcher.json` — 워크스페이스 루트 통합 설정 파일
- `.db-fetcher.example.json` — 팀 공유 템플릿
- `docs/plugin-commands.md` — 플러그인 명령어 가이드
- CWD 상위 탐색으로 설정 파일 자동 발견
- `open` 필드로 활성 환경 결정
- Credential `$ENV_VAR` 참조 지원

### Removed

- `connections.json`, `.env`, `.env.example`
- `dotenv` 의존성
- `package-lock.json` (pnpm workspace이므로 불필요)

### Changed

- 모든 MCP tool에서 `env` 파라미터가 선택(optional)으로 변경, 기본값은 `open` 환경
- `isReadonly` 판단이 환경 이름 하드코딩 → config `readonly` 필드 기반으로 변경
- Azure 감지를 `type` 필드 → hostname 기반 (`.database.windows.net`)으로 변경
- 전체 문서 업데이트

---

## [1.0.0] - [Jay] - 2026-03-11

### Started

- marketplace designed
