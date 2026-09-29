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
