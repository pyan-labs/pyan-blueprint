# Claude Code 플러그인 구조 완전 정리 (Junior Level)

> 팀 플러그인의 배포 대상은 **Claude/Codex**다. 이 문서의 설정 파일·설치 대장·scope 설명은 Claude Code의 내부 구조를 다룬다. Codex에 그대로 적용하지 말고 [공통 관리 명령](docs/plugin-commands.md)을 따른다.

> 플러그인이 어디서 오고, 어떻게 설치되고, 어느 파일이 무슨 역할을 하는지 — 그리고 왜 가끔 uninstall이 조용히 실패하는지.

---

## 1. 큰 그림 — 개념 4단계

플러그인은 아래 4가지가 **각각 따로** 관리된다. 헷갈리는 이유가 바로 이 분리 때문이다.

```
① 어디서 가져오나   →  marketplace (플러그인 카탈로그)
② 실제 파일은 어디  →  cache 폴더 (다운로드된 코드)
③ 설치됐다는 기록   →  installed_plugins.json (설치 대장)
④ 켜져 있나         →  settings.json 의 enabledPlugins (on/off 스위치)
```

---

## 2. 파일별 역할

### ⓐ `~/.claude/settings.json` — user(전역) 설정
> "내가 무엇을 켜뒀나 / 어떤 상점을 등록했나"

```jsonc
{
  "enabledPlugins": {               // ← 플러그인 on/off 스위치
    "db-first@pyan-blueprint": true,
    "superpowers@superpowers-marketplace": true
  },
  "extraKnownMarketplaces": {       // ← 등록된 상점 목록
    "pyan-blueprint": {
      "source": { "source": "github", "repo": "pyan-labs/pyan-blueprint" }
    }
  }
}
```

- 이 파일의 `enabledPlugins`에 항목이 있으면 → **user scope로 활성화**된 것.
- theme·permissions·hooks 같은 다른 설정도 여기 들어간다.

### ⓑ `<프로젝트>/.claude/settings.json` — project(공유) 설정
- 구조는 ⓐ와 동일. 단 **그 프로젝트에서만** 적용되고, git에 커밋되어 **팀원과 공유**된다.

### ⓒ `<프로젝트>/.claude/settings.local.json` — local(개인) 설정
- 구조 동일. 그 프로젝트 + **나만** 적용. gitignore되어 공유되지 않는다.

> **scope = 어느 settings 파일의 `enabledPlugins`에 있느냐**
> ⓐ = user · ⓑ = project · ⓒ = local

### ⓓ `~/.claude/plugins/installed_plugins.json` — 설치 대장
> "무엇이 실제로 깔렸고, 어느 버전·어느 경로·어느 scope인가"

```jsonc
"db-first@pyan-blueprint": [{
  "scope": "project",                                  // ← 설치 당시 scope
  "projectPath": "C:\\Develop\\FXPoCProjects",         // ← 묶인 프로젝트
  "installPath": "...\\cache\\pyan-blueprint\\db-first\\4.0.1",
  "version": "4.0.1",
  "gitCommitSha": "25c5b0..."
}]
```

- **uninstall 명령이 실제로 검증하는 파일이 바로 이것.** scope/projectPath가 여기 기록과 맞아야 지워진다.

### ⓔ `~/.claude.json` — CLI 앱 전역 상태/캐시 (설정 파일 아님)
> "앱이 스스로 관리하는 잡동사니 상태"

- startup 횟수, userID, machineID, 프로젝트별 mcpServers, UI 상태, 그리고 **`pluginUsage`**(플러그인 사용 통계).
- 여기 있는 플러그인 항목은 `pluginUsage` 아래의 **사용 횟수 통계**일 뿐이다:

  ```jsonc
  "pluginUsage": {
    "db-first@pyan-blueprint": { "usageCount": 0, "lastUsedAt": 1784821286425 }
  }
  ```

  → 설치·활성화와 **무관한 단순 텔레메트리**. 제거에 꼭 지울 필요 없다.

### ⓕ `~/.claude/plugins/cache/<상점>/<플러그인>/<버전>/` — 실제 파일
- 다운로드된 플러그인 코드/커맨드/스킬 본체. installed_plugins.json의 `installPath`가 여기를 가리킨다.

### ⓖ `~/.claude/plugins/marketplaces/<상점>/` — 상점 git 클론
- 상점(카탈로그) 저장소를 통째로 clone해 둔 것. 여기서 각 플러그인을 cache로 복사해 설치한다.

---

## 3. 요약 표

| 파일/폴더 | 역할 | scope 개념 | 지워도 되나 |
|---|---|---|---|
| `~/.claude/settings.json` | user 설정 (enabledPlugins·상점 등록) | **user** | 항목만 편집 |
| `<proj>/.claude/settings.json` | project 공유 설정 | **project** | 항목만 편집 |
| `<proj>/.claude/settings.local.json` | 개인 로컬 설정 | **local** | 항목만 편집 |
| `~/.claude/plugins/installed_plugins.json` | 설치 대장 (uninstall이 검증) | scope 기록됨 | 항목만 편집 (통째 삭제 위험) |
| `~/.claude.json` | CLI 전역 상태 + pluginUsage 통계 | — | 통계는 무해 |
| `~/.claude/plugins/cache/…` | 실제 플러그인 파일 | — | 공유 상점 주의 |
| `~/.claude/plugins/marketplaces/…` | 상점 git 클론 | — | 공유 상점 주의 |

---

## 4. 설치 생명주기 (어떻게 서로 연결되나)

```
1. 상점 등록   /plugin marketplace add pyan-labs/pyan-blueprint
   → settings.json.extraKnownMarketplaces 에 추가
   → marketplaces/pyan-blueprint/ 로 git clone

2. 설치        /plugin install db-first@pyan-blueprint --scope user
   → cache/pyan-blueprint/db-first/4.0.1/ 로 파일 복사        (ⓕ)
   → installed_plugins.json 에 레코드 추가 (scope=user)     (ⓓ)
   → 해당 scope의 settings.json.enabledPlugins = true        (ⓐ)

3. 사용        (커맨드/스킬 실행)
   → ~/.claude.json.pluginUsage 통계 증가                    (ⓔ)

4. 켜기/끄기   enabledPlugins 값 true/false 토글              (ⓐ)

5. 제거        installed_plugins.json 레코드 삭제 + enabledPlugins 삭제
```

---

## 5. 흔한 함정 — "uninstall이 조용히 실패한다"

**증상**: `/plugin uninstall <name>` 이 아무 출력 없이 실패하거나,
`"is not installed in project scope. Use --scope to specify the correct scope."` 에러.

**원인**: **활성화 기록(ⓐ)과 설치 기록(ⓓ)의 scope 불일치**.
예) `installed_plugins.json` 엔 `scope: project (FXPoCProjects)` 인데,
user `settings.json` 에선 `enabledPlugins = true` 로 켜져 있는 경우.

- `--scope user` → user 설치 레코드 없음 → 실패
- `--scope project` → 현재 프로젝트엔 없음 → 실패
- 어느 쪽도 매칭이 안 돼 조용히 끝난다. **명령으로는 못 푼다.**

### 확실한 수동 제거 (2곳만 편집)

1. `~/.claude/plugins/installed_plugins.json` → `"<name>": [ ... ]` 블록 삭제 (ⓓ)
2. `~/.claude/settings.json` → `enabledPlugins` 의 `"<name>": true` 삭제 (ⓐ)

- `~/.claude.json` 의 `pluginUsage` 통계는 남겨도 무해.
- `cache/…`, `marketplaces/…` 는 **같은 상점을 쓰는 다른 플러그인**(예: 같은 pyan-blueprint 상점의 다른 플러그인)이 있으면 **지우지 말 것.**
- 편집 전 백업 권장:
  ```bash
  cp ~/.claude/plugins/installed_plugins.json ~/.claude/plugins/installed_plugins.json.bak
  ```

### 재설치 (활성/설치 scope 일치시키기)

```bash
/plugin install db-first@pyan-blueprint --scope user
```

---

## 6. 왜 `installed_plugins.json` 을 통째로 지우면 안 되나

이 파일 하나에 **설치된 모든 플러그인**의 레코드가 들어있다.
통째로 지우면 `enabledPlugins`(ⓐ)엔 `true` 로 남는데 설치 위치 정보(ⓓ)만 사라져 **불일치 상태**가 되고,
멀쩡히 쓰던 플러그인(superpowers·spec-tools·codex 등)까지 로드 실패하거나 재resolve될 수 있다.
→ 항상 **해당 플러그인 블록만** 도려낸다.
