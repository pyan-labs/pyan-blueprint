# TODO: 직접 SQL 접속 차단 hook

## 목표

db-first가 설치된 세션에서는 에이전트가 `sqlcmd` 같은 도구로 DB에 직접 접속하지 못하게 하고, DB 작업은 반드시 db-fetcher tool로만 하게 한다.

이유: db-fetcher를 거치지 않으면 환경별 권한(prod 조회 전용, readonly 트랜잭션, 행 수 제한)이 전부 무시된다. dev의 쓰기 작업은 `execute_sql`로 가능하므로 직접 접속을 막아도 할 수 있는 일은 줄지 않는다.

## 방식

플러그인에 `PreToolUse` hook을 넣는다. 플러그인을 설치하면 hook도 함께 등록되므로 프로젝트별 설정이 필요 없다.

```
packages/db-first/
  hooks/hooks.json            # hook 등록
  hooks/block-direct-sql.mjs  # 검사 스크립트 (node, 의존성 없음)
```

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/block-direct-sql.mjs\"" }]
      }
    ]
  }
}
```

스크립트는 stdin으로 받은 `tool_input.command`를 검사한다. 걸리면 거부하고, 에이전트에게 대신 쓸 db-fetcher tool을 알려준다. 예: "직접 DB 접속은 막혀 있습니다. 조회는 run_select_query, dev 쓰기는 execute_sql을 쓰세요."

차단 후보:

- CLI: `sqlcmd`, `osql`, `isql`, `bcp`, `mssql-cli`, `sqlpackage`
- PowerShell: `Invoke-Sqlcmd`, `Invoke-DbaQuery`(dbatools), `System.Data.SqlClient` / `Microsoft.Data.SqlClient` 직접 사용
- 인라인 스크립트: `node -e`, `python -c` 안의 `mssql`, `tedious`, `pyodbc`, `pymssql`

## 같이 막을 것: `.db-fetcher.json` 읽기

직접 접속하려면 접속 정보가 필요한데, 그 정보는 `.db-fetcher.json`에 있다. db-fetcher 서버는 이 파일을 스스로 읽으므로 에이전트가 읽을 이유가 없다. 따라서 에이전트의 읽기를 막는 것이 명령어 패턴 검사보다 효과가 크다.

- `Read`, `Grep`, `Edit`, `Write` 대상이 `.db-fetcher.json`이면 거부
- Bash/PowerShell 명령에 `.db-fetcher.json`이 나오면 거부 (`cat`, `Get-Content` 등)
- 예외: 사용자가 설정을 만들거나 고쳐 달라고 할 때가 문제다. 거부 메시지로 "사용자가 직접 편집"을 안내할지, 편집만 허용할지 정해야 한다

## 한계 (구현 전에 합의할 것)

- **패턴 검사는 우회할 수 있다.** 스크립트를 파일로 써서 실행하거나, 앱 코드를 `dotnet run`으로 돌려 접속할 수 있다. hook은 실수와 습관을 막는 장치이지 보안 경계가 아니다. 실제 경계는 여전히 prod의 조회 전용 계정이다.
- **`dotnet ef database update` 같은 정상 작업과 겹친다.** EF 마이그레이션은 앱 연결 문자열로 DB에 접속한다. 막을지, 허용할지, dev에서만 허용할지 정해야 한다.
- **오탐.** 문자열 안의 `sqlcmd`(문서 작성, grep 검색어 등)까지 막을 수 있다. 명령 위치의 토큰만 볼지 정해야 한다.
- **Codex.** Codex CLI가 플러그인 hook을 지원하는지, 형식이 같은지 확인되지 않았다. 지원하지 않으면 Codex에서는 스킬 문구와 `AGENTS.md` 안내로만 대신한다.

## 할 일

- [ ] Claude Code 플러그인 hook 형식과 `${CLAUDE_PLUGIN_ROOT}` 확장을 최신 문서로 확인
- [ ] Codex 플러그인 hook 지원 여부 확인
- [ ] 차단 목록과 `.db-fetcher.json` 편집 예외 정책 결정
- [ ] `dotnet ef` 처리 결정
- [ ] `block-direct-sql.mjs` 구현 + 단위 테스트 (차단/허용 명령 표)
- [ ] `scripts/assemble-dist.mjs`가 `hooks/`를 `dist/`에 복사하도록 수정, `plugin.test.ts`에서 hook 등록 확인
- [ ] README의 "환경별 권한" 섹션에 hook 설명 추가
