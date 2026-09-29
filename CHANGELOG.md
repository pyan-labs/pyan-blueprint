## [Unreleased]

### dev-kit

- 새 플러그인 `dev-kit` 추가 — pyan 개발 팀 공통 스킬 모음
- `commit` 스킬: 현재 변경 내용을 저장소 형식에 맞는 메시지로 커밋 (수동 호출 전용)
- `commit` 스킬이 Sonnet으로 실행되도록 전용 agent `committer` 추가 (`context: fork` + `agent: dev-kit:committer`). 스킬의 `model:`은 fork 시 무시돼 메인 모델로 실행되던 문제
- dist 조립이 플러그인의 `agents/` 폴더를 복사. 구조 설명은 `docs/skill-agent-fork.md`

## [1.0.0] - [Jay] - 2026-03-11

### Started

- marketplace designed
- `team-plugins`에서 `db-first`를 분리해 `pyan-labs/pyan-blueprint` 마켓플레이스로 옮김. 설치 명령은 `db-first@pyan-blueprint`

### db-first

- db-fetcher: 환경별 권한 강제. `readonly` 기본값이 `true`로 바뀜. 쓰기를 허용할 환경에는 `"readonly": false`를 명시해야 함
- db-fetcher: readonly 환경은 쓰기 권한이 없는 계정만 연결 허용 (sa·db_owner 거부)
- db-fetcher: `execute_sql` tool 추가. `"readonly": false` 환경에서 모든 T-SQL 실행
- db-fetcher: readonly 환경의 `run_select_query`는 항상 롤백되는 트랜잭션에서 실행. SELECT 검사 차단 키워드 확대
- db-fetcher: `get_sample_data`의 테이블 이름 SQL injection 수정
