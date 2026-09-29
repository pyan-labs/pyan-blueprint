## Claude Code Plugin/Marketplace 실행 구조 완전 정리

> 팀 플러그인은 **Claude/Codex**에 배포한다. 이 문서는 Claude Code의 설치·활성화 구조를 설명하며, 아래 내부 설정 파일은 Codex 설정과 다르다. 양쪽의 최신 관리 명령은 [plugin-commands.md](plugin-commands.md)를 참조한다.

---

### 1. Marketplace란?

Plugin들을 담고 있는 **repository entry point**입니다. "이 marketplace에 있는 plugin들을 사용하겠다"는 선언이며, marketplace를 등록한다고 plugin이 설치되는 건 아닙니다. App Store를 등록하되 앱은 아직 다운로드 안 한 상태와 같습니다.

```bash
# Marketplace 등록 (1회)
claude plugin marketplace add pyan-labs/pyan-blueprint
```

---

### 2. Plugin 설치의 두 가지 scope

#### User Scope

```bash
claude plugin install db-first@pyan-blueprint --scope user
```

실행 모듈(MCP server 코드, Skills)을 `~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/`에 다운로드합니다. `installed_plugins.json`에 `scope: "user"`로 등록되며, **projectPath가 없으므로 모든 프로젝트에서 활성화 가능**합니다. 동시에 `~/.claude/settings.json`에 `enabledPlugins`가 **자동으로 추가**되어 install + enable이 한 번에 이루어집니다.

```json
// installed_plugins.json
{
  "db-first@pyan-blueprint": [
    {
      "scope": "user",
      "installPath": "~/.claude/plugins/cache/pyan-blueprint/db-first/v1.0.0",
      "version": "v1.0.0"
    }
  ]
}
```

#### Project Scope

```bash
claude plugin install db-first@pyan-blueprint --scope project
```

cache 위치는 동일합니다. 코드는 같은 곳에 1카피만 존재합니다. 차이는 `installed_plugins.json`에 `projectPath`가 기록되어 **해당 프로젝트에서만 활성화**된다는 점입니다. 해당 프로젝트의 `.claude/settings.json`에 `enabledPlugins`가 추가됩니다.

```json
{
  "db-first@pyan-blueprint": [
    {
      "scope": "project",
      "projectPath": "C:/Users/jongmin/projects/baw-api",
      "installPath": "~/.claude/plugins/cache/pyan-blueprint/db-first/v1.0.0",
      "version": "v1.0.0"
    }
  ]
}
```

다른 프로젝트에서도 쓰려면 **프로젝트마다 설치를 반복**해야 하고, entry가 배열로 추가됩니다.

#### 어떤 scope를 선택할 것인가

db-first처럼 "DB가 있는 모든 프로젝트"에서 범용으로 쓰는 도구는 **user scope**가 맞습니다. project scope는 "baw-api 전용 deployment skill"처럼 특정 프로젝트에서만 의미 있는 plugin에 적합합니다.

---

### 3. Install과 Enable은 별개 개념

Plugin 시스템은 2단계로 작동합니다.

**Install** → cache에 코드 다운로드 + `installed_plugins.json` 등록 (사용 가능 상태)

**Enable** → `enabledPlugins: true`로 활성화 (실제 동작 상태)

#### User scope 설치의 경우

User scope로 설치하면 `~/.claude/settings.json`에 enabledPlugins가 **자동으로** 추가됩니다. **별도 enable 작업 없이 모든 프로젝트에서 즉시 active**됩니다.

#### 프로젝트 `.claude/settings.json`에 enabledPlugins를 넣는 경우

User scope로 이미 설치했다면 기능적으로 중복이지만, 두 가지 용도로 사용합니다:

**선언적 문서화** — "이 프로젝트는 db-first을 사용한다"는 의도 표현. `package.json`의 `peerDependencies`와 비슷한 역할.

```json
// 프로젝트/.claude/settings.json
{
  "enabledPlugins": {
    "db-first@pyan-blueprint": true
  }
}
```

**특정 프로젝트에서 비활성화** — user scope로 전역 enable 되어 있지만 이 프로젝트에서만 끄고 싶을 때.

```json
{
  "enabledPlugins": {
    "db-first@pyan-blueprint": false
  }
}
```

3명 작은 팀에서 구두로 충분히 공유되고 있다면 프로젝트 settings에 넣지 않아도 됩니다.

---

### 4. extraKnownMarketplaces의 역할

```json
// 프로젝트/.claude/settings.json
{
  "extraKnownMarketplaces": {
    "pyan-blueprint": {
      "source": {
        "source": "github",
        "repo": "pyan-labs/pyan-blueprint"
      }
    }
  }
}
```

이건 **marketplace 자동 안내** 설정입니다. 새 팀원이 repo를 clone하고 Claude Code를 열면:

```
Claude Code 실행
→ .claude/settings.json에서 extraKnownMarketplaces 발견
→ "pyan-blueprint marketplace를 추가하시겠습니까?" 프롬프트 표시
→ Yes → marketplace 등록됨
→ enabledPlugins에 db-first이 있으면 "이 plugin을 설치하시겠습니까?" 안내
```

팀원이 `claude plugin marketplace add pyan-labs/pyan-blueprint` 명령을 직접 치지 않아도 repo 설정만으로 안내받는 겁니다. 다만 팀원이 적고 marketplace add 명령 한 줄 공유하면 끝이라면 필요 없습니다. 온보딩이 빈번한 큰 조직에서 유용한 설정입니다.

---

### 5. Plugin 내부의 .mcp.json vs Project root의 .mcp.json

이 둘은 **완전히 별개**입니다.

#### Plugin 내부 `.mcp.json` (MCP server definition)

```
~/.claude/plugins/cache/pyan-blueprint/db-first/v1.0.0/.mcp.json
```

```json
{
  "mcpServers": {
    "db-fetcher": {
      "command": "node",
      "args": ["./dist/index.js"]
    }
  }
}
```

이건 "db-fetcher MCP server를 node로 실행해라"라는 **실행 방법 선언**입니다. Plugin과 함께 제공되는 plugin-mcp 고유 설정 파일이며, Plugin 로더가 읽고 Claude Code가 자동 인식합니다.

#### Project root `.mcp.json` (프로젝트 MCP 설정)

Plugin 밖에서 별도 MCP server를 등록할 때 사용합니다. db-first을 user scope로 설치했으면 db-fetcher는 이미 Plugin 경로로 등록되어 있으므로 **프로젝트 `.mcp.json`에 중복 선언할 필요 없습니다.**

---

### 6. MCP Server의 Config 파일 탐색 (.db-fetcher.json)

Claude Code가 MCP server를 spawn할 때 **cwd를 현재 프로젝트 루트로 설정**합니다. 따라서 db-fetcher가 `process.cwd()`로 config를 찾으면, Plugin 설치 위치(user/project)와 무관하게 **프로젝트 루트의 `.db-fetcher.json`을 읽습니다.**

```
~/.claude/plugins/cache/.../db-fetcher/   ← Plugin 코드 (user-level)
~/projects/baw-api/.db-fetcher.json       ← Config (project-level)

사용자가 ~/projects/baw-api/에서 Claude Code 실행
→ MCP 서버 spawn 시 cwd = ~/projects/baw-api/
→ process.cwd() + '.db-fetcher.json' = 정상 로드
```

#### 계층적 탐색 구현 (권장)

자동으로 되는 게 아니라 db-fetcher 코드에서 구현해야 합니다:

```typescript
function resolveConfig(): DbFetcherConfig {
  const projectConfig = path.join(process.cwd(), ".db-fetcher.json");
  const userConfig = path.join(os.homedir(), ".db-fetcher.json");

  if (fs.existsSync(projectConfig))
    return JSON.parse(fs.readFileSync(projectConfig, "utf-8"));
  if (fs.existsSync(userConfig))
    return JSON.parse(fs.readFileSync(userConfig, "utf-8"));
  return { connections: [], _warning: "No config found" };
}
```

이 패턴은 `.npmrc`, `.gitconfig`, `.eslintrc`와 동일한 관례로, project > user 순으로 override합니다.

- **user home `~/.db-fetcher.json`** → 개인 기본값 (로컬 dev DB, sandbox)
- **project root `.db-fetcher.json`** → 팀 공유 설정 (공용 dev DB), 있으면 user 설정을 덮어씀

#### 주의: `process.cwd()` vs `__dirname`

db-fetcher 코드에서 config 경로를 반드시 `process.cwd()` 기준으로 찾아야 합니다. `__dirname`을 쓰면 Plugin cache 경로에서 찾게 되어 의도대로 동작하지 않습니다.

#### Config 부재 시 graceful degradation

`.db-fetcher.json`이 없는 프로젝트에서도 MCP server가 crash하지 않도록 처리해야 합니다:

```typescript
if (config._warning) {
  return {
    content: [
      {
        type: "text",
        text:
          "⚠️ .db-fetcher.json not found in project root.\n" +
          "Run: cp .db-fetcher.example.json .db-fetcher.json",
      },
    ],
  };
}
```

---

### 7. .mcp.json의 3가지 Scope (Claude Code 전체)

| Scope   | 저장 위치                                        | 용도                  |
| ------- | ------------------------------------------------ | --------------------- |
| project | `프로젝트루트/.mcp.json`                         | 팀 공유 (git tracked) |
| user    | `~/.claude.json` 내 `mcpServers`                 | 개인 전역             |
| local   | `~/.claude.json` 내 `projects.{path}.mcpServers` | 개인 + 특정 프로젝트  |

Plugin으로 MCP를 제공하면 이 `.mcp.json` scope와는 별개 경로로 관리되므로, 프로젝트 `.mcp.json`을 건드릴 필요가 없습니다.

---

### 8. 팀 배포 최종 구조

#### 최소 구조 (3명 소규모 팀)

```
baw-api/
├── .db-fetcher.json           ← DB connection strings (이것만 필수)
├── CLAUDE.md                  ← AI harness rules
└── src/
```

각 팀원 1회:

```bash
claude plugin marketplace add pyan-labs/pyan-blueprint
claude plugin install db-first@pyan-blueprint --scope user
```

#### 확장 구조 (온보딩 자동화가 필요한 팀)

```
baw-api/
├── .claude/
│   └── settings.json          ← enabledPlugins + extraKnownMarketplaces
├── .db-fetcher.json           ← DB connection strings
├── .db-fetcher.example.json   ← template (prod 정보는 .gitignore)
├── CLAUDE.md                  ← AI harness rules
└── src/
```

```json
// .claude/settings.json
{
  "enabledPlugins": {
    "db-first@pyan-blueprint": true
  },
  "extraKnownMarketplaces": {
    "pyan-blueprint": {
      "source": {
        "source": "github",
        "repo": "pyan-labs/pyan-blueprint"
      }
    }
  }
}
```

새 팀원 온보딩 흐름:

```
repo clone → Claude Code 실행
→ extraKnownMarketplaces 감지 → "marketplace 추가?" 프롬프트
→ Yes → plugin 설치 안내 → /reload-plugins
→ .db-fetcher.json이 이미 repo에 있으므로 바로 동작
```

---

### 9. CLAUDE.md를 통한 AI Harness

```markdown
# CLAUDE.md

## DB 작업 규칙

- DB 스키마를 절대 추측하지 마라
- 테이블 구조가 필요하면 반드시 mcp:db-fetcher의 get_table_schema를 먼저 호출하라
- FK 관계는 get_relationships로 확인하라
- 샘플 데이터가 필요하면 get_sample_data를 사용하라
```

이것이 AI Harness의 전형적인 패턴입니다:

**CLAUDE.md** → AI가 어떻게 행동해야 하는지 제약 (guardrail)

**MCP server** → AI가 실제 데이터에 접근하는 통로 (grounding)

**Skills** → AI의 출력을 일관된 패턴으로 유도 (template)

"추측하지 말고 실제 DB를 조회해라"는 한 줄이 hallucination을 제거하고, MCP가 실제 데이터를 공급하고, Skill이 그 데이터를 EF Core Entity나 REST API 같은 정해진 형태로 변환합니다.

"Data is reusable, application is disposable" 철학과 일맥상통합니다. DB schema가 truth이고, AI가 생성하는 코드는 그 truth에서 파생되는 disposable output입니다.

---
