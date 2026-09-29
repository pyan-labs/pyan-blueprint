# pyan-blueprint

우리 팀의 **Claude/Codex 플러그인 모음**입니다. 한 번 설치해 두면, 어떤 프로젝트를 열어도 아래 도구들을 사용할 수 있습니다.

| 플러그인 | 무엇을 하나 | 대표 명령 | 쓸 수 있는 곳 |
| --- | --- | --- | --- |
| **db-first** | MS SQL DB 스키마를 읽어 EF Core 모델 생성 | `db-to-efcore` | Claude/Codex |

Claude Code에서는 `/스킬명`, Codex에서는 `$스킬명`으로 호출합니다. 아래에 각 도구의 설치 명령을 구분해 안내합니다.

---

## 🚀 처음 시작하기 (팀원 전원 필수 · 최초 1회)

> **핵심 개념: "user scope"란?**
> Claude Code에서 플러그인을 설치하는 위치는 두 가지입니다.
> - **user scope (사용자 전역)** — 내 PC의 내 계정 전체에 설치. **모든 프로젝트에서 공통으로 사용**됩니다.
> - project scope (프로젝트 한정) — 특정 프로젝트에서만 사용.
>
> 우리 팀 도구는 **사용자 전역 설치를 권장**합니다. 프로젝트마다 다시 설치할 필요 없이 사용할 수 있으며, `db-first`의 `.db-fetcher.json`은 현재 프로젝트 기준으로 선택합니다.

아래 명령을 **Claude Code 안에서** 순서대로 입력하세요. (터미널이 아니라 Claude Code 대화창에 입력합니다.)

### 1단계 — 팀 마켓플레이스 등록

GitHub의 `pyan-labs/pyan-blueprint` 저장소를 내 Claude Code에 "플러그인 목록(마켓플레이스)"으로 등록합니다.

```
/plugin marketplace add pyan-labs/pyan-blueprint
```

- 한 번만 하면 됩니다. 이후에는 이 목록에서 플러그인을 골라 설치할 수 있습니다.
- 이 등록은 user scope(사용자 전역)로 저장됩니다.

### 2단계 — 플러그인 설치 (user scope 권장)

```
/plugin install db-first@pyan-blueprint
```

- 설치 위치(scope)를 물어보면 **user (전역)** 을 선택하는 것을 권장합니다.
- 설치가 끝나면 MCP 서버와 skill들이 자동으로 등록됩니다. 별도 설정 파일을 손으로 만들 필요가 **없습니다**.

### 3단계 — 설치 확인

```
/plugin
```

- 설치된 플러그인 목록에 `db-first`가 보이면 성공입니다.
- 이제 `/db-to-efcore` 명령을 입력하면 자동완성에 뜹니다.

여기까지 하면 **모든 프로젝트에서** 팀 도구를 쓸 준비가 끝났습니다.

---

## 🤖 Codex CLI에서 쓰기

Claude/Codex는 같은 저장소의 배포 파일을 사용하며, 마켓플레이스와 사용자 설정은 각각 관리합니다.

`db-first`가 등록되어 있습니다. `db-first`는 공용 스킬이 현재 프로젝트 경로를 MCP 호출에 전달하여 프로젝트별 `.db-fetcher.json`을 읽습니다. 자세한 설정은 [DB-First 안내](packages/db-first/README.md)를 참고하세요.

> Codex는 대화창이 아니라 **터미널**에서 명령을 실행합니다. 그리고 skill 호출 접두사가 `/`가 아니라 **`$`** 입니다.

```powershell
# 1단계 — 팀 마켓플레이스 등록 (최초 1회)
codex plugin marketplace add pyan-labs/pyan-blueprint

# 2단계 — 플러그인 설치
codex plugin add db-first@pyan-blueprint

# 3단계 — 설치 확인
codex plugin list
```

설치 후 Codex 세션에서 `$db-to-efcore`로 호출합니다. 사용 가능한 목록은 `/skills`로 볼 수 있습니다.

**명령 대응표**

| 하고 싶은 일 | Claude Code | Codex CLI |
| --- | --- | --- |
| 마켓플레이스 등록 | `/plugin marketplace add pyan-labs/pyan-blueprint` | `codex plugin marketplace add pyan-labs/pyan-blueprint` |
| 플러그인 설치 | `/plugin install db-first@pyan-blueprint` | `codex plugin add db-first@pyan-blueprint` |
| 설치 목록 확인 | `/plugin` | `codex plugin list` |
| 업데이트 | `/plugin marketplace update pyan-blueprint` 후 `/plugin update <이름>@pyan-blueprint` | `codex plugin marketplace upgrade pyan-blueprint` 후 `codex plugin add <이름>@pyan-blueprint` |
| 플러그인 제거 | `/plugin uninstall db-first@pyan-blueprint` | `codex plugin remove db-first@pyan-blueprint` |
| 마켓플레이스 해제 | `/plugin marketplace remove pyan-blueprint` | `codex plugin marketplace remove pyan-blueprint` |
| skill 호출 | `/db-to-efcore` | `$db-to-efcore` |

> **업데이트는 마켓플레이스 단위입니다.** `codex plugin marketplace upgrade pyan-blueprint`로 저장소 스냅샷을 갱신한 뒤, 새 버전이 보이면 `codex plugin add`로 다시 설치합니다.

---

## 📁 개별 프로젝트에서 사용하기

플러그인은 user scope로 이미 설치돼 있으므로, 프로젝트를 열면 **바로** slash command를 쓸 수 있습니다.
단, 플러그인마다 프로젝트별로 준비할 것이 조금 다릅니다.

### db-first — DB 연결 정보만 넣으면 끝

`db-first`는 실제 DB에 접속해야 하므로, **각 프로젝트 루트에 `.db-fetcher.json`** (DB 접속 정보)을 두어야 합니다.

```bash
# 프로젝트 루트에서, 예시 파일을 복사한 뒤 실제 값으로 수정
cp .db-fetcher.example.json .db-fetcher.json
```

- 예시 템플릿: [packages/db-first/.db-fetcher.example.json](packages/db-first/.db-fetcher.example.json)
- `.db-fetcher.json`에는 DB 비밀번호 등 **민감 정보가 들어가므로 반드시 `.gitignore`에 추가**해서 커밋되지 않게 하세요.

준비되면 이렇게 씁니다:

```
사용자: Orders 테이블로 EF Core entity 만들어줘

Claude: /db-to-efcore 실행
  → DB에서 Orders 테이블 스키마를 읽고
  → EF Core Entity + Fluent API + DbContext 생성
```

### ⚠️ 하지 말아야 할 것 — 루트에 `.mcp.json` 직접 만들기

플러그인을 user scope로 설치하면 MCP 서버가 **자동 등록**됩니다. 프로젝트 루트에 `.mcp.json`을 손으로 만들지 마세요.

특히 아래처럼 **절대 경로를 하드코딩하면 팀원마다 설치 경로가 달라 깨집니다**:

```json
// ❌ 잘못된 예 — 특정 사용자 PC 경로에 고정됨
{
  "mcpServers": {
    "db-fetcher": {
      "command": "node",
      "args": ["C:/Users/JongminLee/.claude/plugins/cache/pyan-blueprint/db-first/4.1.0/mcp-db-fetcher/dist/index.js"]
    }
  }
}
```

플러그인 내장 `.mcp.json`은 `${CLAUDE_PLUGIN_ROOT}` 변수를 써서 실행 시점에 각자의 설치 경로로 자동 확장되므로, 이런 문제가 생기지 않습니다.

---

## 🔄 플러그인 업데이트

플러그인이 새 버전으로 올라가면 팀 Slack에 CHANGELOG와 함께 공지됩니다.

```
/plugin marketplace update pyan-blueprint
/plugin update db-first@pyan-blueprint
```

Codex에서는 터미널에서:

```powershell
codex plugin marketplace upgrade pyan-blueprint   # 저장소 스냅샷 갱신
codex plugin add db-first@pyan-blueprint        # 새 버전 설치
```

> 갱신 후 새 세션에서 사용하세요. Claude Code는 `/reload-plugins`로 다시 로드할 수도 있습니다. MCP 재시작이 필요한 경우 진행 중인 DB 작업이 끝난 뒤 적용하세요.

---

## 🧯 문제 해결 — 초기화 후 깨끗하게 재설치

아래 같은 증상이면 **완전히 지우고 다시 설치**하는 게 가장 확실합니다.

- 실수로 **프로젝트 레벨(project scope)로 설치**해서 다른 프로젝트에선 명령이 안 뜬다
- `/db-to-efcore` 같은 명령이 자동완성에 **안 보이거나**, 실행하면 옛날 동작을 한다
- `/plugin update` 후에도 **예전 버전처럼 동작**한다 (캐시가 꼬임)
- MCP 서버(`db-fetcher`)가 **연결 실패/시작 안 됨**으로 뜬다

> 아래 절차는 **db-first만** 지웠다가 다시 까는 것이라 안전합니다. 다른 플러그인이나 프로젝트 코드는 건드리지 않습니다.

### 1단계 — 지금 어디에 설치돼 있는지 확인

```
/plugin
```

- 목록에서 `db-first`가 **어느 scope(user / project)** 로 잡혀 있는지 봅니다.
- **project로 잡혀 있으면** 그게 문제의 원인일 수 있습니다 (그 프로젝트에서만 동작).

### 2단계 — 기존 설치 제거

**(a) user scope 제거** — Claude Code 안에서:

```
/plugin uninstall db-first@pyan-blueprint
```

**(b) project scope 제거** — 프로젝트 `.claude/settings.json`(또는 `.claude/settings.local.json`)에 아래 항목이 있으면 **직접 지웁니다.** 프로젝트 레벨 설치는 이 파일에 기록됩니다.

```json
{
  "enabledPlugins": {
    "db-first@pyan-blueprint": true    // ← 이 줄 삭제
  }
}
```

> 프로젝트 루트에 예전에 손으로 만든 `.mcp.json`이 있다면 이것도 함께 지우세요 (자동 등록과 충돌합니다).

### 3단계 — 마켓플레이스 등록 해제 + 캐시 삭제 (캐시 문제일 때)

`/plugin update`로도 옛 버전이 계속 나오면 캐시가 꼬인 것입니다. 캐시까지 밀어냅니다.

**(a) 마켓플레이스 제거** — Claude Code 안에서:

```
/plugin marketplace remove pyan-blueprint
```

**(b) 캐시 폴더 삭제** — Claude Code를 **완전히 종료한 뒤**, 터미널(PowerShell)에서:

```powershell
# 팀 마켓플레이스 캐시만 삭제 (다른 플러그인 캐시는 그대로 둠)
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\plugins\cache\pyan-blueprint" -ErrorAction SilentlyContinue
```

- 캐시 위치: `C:\Users\<사용자>\.claude\plugins\cache\pyan-blueprint\`
- 이 폴더는 재설치하면 자동으로 다시 생성되므로 지워도 안전합니다.

Codex CLI라면 캐시 위치가 다릅니다 — `C:\Users\<사용자>\.codex\plugins\cache\pyan-blueprint\`. 다만 Codex는 `codex plugin remove db-first@pyan-blueprint` → `codex plugin marketplace remove pyan-blueprint`로 깨끗이 정리되므로 폴더를 직접 지울 일은 드뭅니다.

### 4단계 — Claude Code 재시작 후 처음부터 재설치

Claude Code를 다시 켜고, 맨 위 **"🚀 처음 시작하기"의 1~3단계를 그대로** 다시 실행합니다.

```
/plugin marketplace add pyan-labs/pyan-blueprint
/plugin install db-first@pyan-blueprint   # ← scope 물어보면 user 선택 권장
/plugin                          # 설치 확인 (user scope로 보이면 성공)
```

### 그래도 안 되면

- Claude Code를 최신 버전으로 업데이트한 뒤 다시 시도하세요.
- `db-first`의 MCP 서버만 문제라면, 해당 프로젝트 루트에 `.db-fetcher.json`이 올바르게 있는지부터 확인하세요 (DB 접속 정보 오류일 수 있음).
- 위를 다 해도 안 되면 캡처와 함께 팀 Slack에 문의하세요.

---

## 📚 플러그인 상세

### db-first

MCP 서버(`db-fetcher`)가 실제 DB를 읽고, Skill들이 그 스키마로 코드를 생성합니다.

**MCP Tools**

| Tool                    | 기능                                         |
| ----------------------- | -------------------------------------------- |
| `list_connections`      | 환경 목록 및 가용 상태 조회                  |
| `get_all_tables`        | 전체 테이블 + row count                      |
| `get_table_schema`      | 컬럼, 타입, PK, nullable, identity           |
| `get_relationships`     | FK 관계                                      |
| `get_indexes`           | 인덱스 정보                                  |
| `get_stored_procedures` | SP 목록 + 파라미터                           |
| `get_sample_data`       | 샘플 데이터 (prod: 10행, dev: 50행)          |
| `run_select_query`      | Ad-hoc SELECT (prod: readonly + 1000행 제한) |

**Skills**

| Skill             | 설명                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| `/db-to-efcore`   | DB schema → EF Core Entity + DbContext + Fluent API                               |
| `/db-to-rest-api` | DB schema → Clean Architecture REST API (Controller + Service + Repository + DTO) |
| `/db-to-frontend` | DB schema → WPF (MVVM) 또는 React (TypeScript + React Query) 화면                 |

**보안**

- Credential은 프로젝트 루트 `.db-fetcher.json`에 로컬 저장 (`.gitignore`로 보호)
- Prod는 항상 read-only 강제, `run_select_query`는 SELECT만 허용
- INSERT / UPDATE / DELETE / DROP / EXEC 등 차단, Prod 쿼리는 자동 TOP 1000 제한

---

## 🛠 개발자용 (플러그인을 수정·배포하는 사람)

이 저장소를 직접 고치는 경우에만 해당합니다. 단순 사용자는 위 "처음 시작하기"만 따라오면 됩니다.

- 개발 환경 설정 및 새 MCP/Skill 추가 절차 → [DEV-GUIDE.md](DEV-GUIDE.md)
- 버전 올리기 → [scripts/VERSION-BUMP.md](scripts/VERSION-BUMP.md)

```bash
pnpm install            # 최초 의존성 설치
pnpm run build          # 전체 빌드 (esbuild 번들링)
pnpm run dist           # 빌드 + dist/ 배포 디렉토리 조립
pnpm run lint           # 전체 타입 체크

# 버전 bump
pnpm run version:bump patch
pnpm run version:bump db-first minor
```

> `dist/`는 반드시 git에 커밋합니다 — 플러그인 설치 시 이 디렉토리가 사용자에게 배포됩니다.

---


