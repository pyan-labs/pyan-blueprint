# 스킬 실행 모델 고정하기 — skill + agent 구조

스킬을 특정 모델(예: Sonnet)로 실행하려면 스킬 frontmatter의 `model:`만으로는 부족합니다. 모델을 정하는 agent를 따로 두고 스킬과 연결합니다. `dev-kit`의 `commit` 스킬이 이 구조를 씁니다.

## 왜 필요한가

`context: fork` 스킬에 `model: sonnet`을 적어도 실제로는 메인 세션 모델(예: Opus)로 실행됩니다.

- `agent:` 필드가 없으면 fork는 기본 agent인 `general-purpose`로 뜹니다.
- `general-purpose`는 메인 모델을 그대로 따르고, 스킬의 `model:`은 무시됩니다.

> 공식 문서에는 "`context: fork`일 때 `model`이 fork된 subagent의 모델을 정한다"고 되어 있지만, 실제 동작은 달랐습니다(2026-09 확인).

## 구조

두 파일이 subagent **하나**의 설정을 나눠 가집니다. 스킬이 agent를 다시 호출하는 구조가 아닙니다.

| 파일 | 담당 | `commit`의 예 |
|---|---|---|
| `agents/<name>.md` | **누가** — 모델, 사용할 수 있는 도구, 기본 역할 | Sonnet, Bash·Read·Grep·Glob, "커밋 담당" |
| `skills/<name>/SKILL.md` | **무엇을** — 작업 지시(절차, 금지 사항) | 커밋 절차 1~5, 하지 않는 것 |

### frontmatter 두 필드가 실행 환경을 만든다

스킬의 `context: fork`와 `agent:`가 합쳐져 스킬 본문이 실행될 환경을 정합니다.

| 요소 | 정하는 것 |
|---|---|
| `context: fork` | **어디서** — 메인 대화가 아닌 분리된 새 컨텍스트에서 실행 |
| `agent: dev-kit:committer` | **어떤 환경** — 그 컨텍스트의 모델, 도구, 기본 역할 |
| SKILL.md 본문 | 그 환경에 전달되는 **작업 지시** |

두 필드는 서로 의존합니다.

- `context: fork`가 없으면 `agent:`는 무시됩니다. 스킬이 메인 대화 안에서 바로 실행되므로 따로 환경을 만들지 않습니다.
- `agent:` 없이 `context: fork`만 있으면 기본값 `general-purpose` 환경이 쓰입니다. 그래서 메인 모델로 실행됩니다.

### fork 환경은 메인 대화를 보지 못한다

fork된 환경이 받는 것은 스킬 본문과 호출 인자(`$ARGUMENTS`)뿐입니다. 메인 대화의 이전 내용은 전달되지 않습니다.

- `commit`처럼 필요한 정보를 git 명령 등으로 직접 확인하는 스킬에 맞습니다.
- "방금 대화한 내용을 바탕으로" 무언가를 하는 스킬에는 fork를 쓰지 않습니다.

## 실행 흐름

```
사용자: /dev-kit:commit
   │
   ▼
Claude Code 본체(하네스)가 frontmatter를 읽음
   ├─ context: fork              → "별도 subagent로 실행하자"
   └─ agent: dev-kit:committer   → "그 subagent의 설정은 committer.md를 쓰자"
   │
   ▼
subagent 1개 생성
   ├─ 모델·도구·역할 ← agents/committer.md
   └─ 작업 지시       ← skills/commit/SKILL.md 본문
   │
   ▼
Sonnet이 커밋을 수행하고 결과를 메인 대화에 보고
```

메인 모델(Opus)은 중간에 끼어들지 않습니다. Opus가 스킬을 읽고 "agent를 불러야겠다"고 판단하는 단계가 없고, 하네스가 frontmatter를 보고 바로 subagent를 띄웁니다.

## 설정 예

`packages/dev-kit/agents/committer.md`

```markdown
---
name: committer
description: dev-kit:commit 스킬 전용 실행 agent. 스킬을 통해서만 호출한다 — 직접 위임하지 않는다.
model: sonnet
effort: medium
tools: Bash, Read, Grep, Glob
---

현재 작업 트리의 변경 내용을 git 커밋으로 남기는 agent다. ...
```

`packages/dev-kit/skills/commit/SKILL.md`

```markdown
---
name: commit
description: ...
disable-model-invocation: true
context: fork
agent: dev-kit:committer
---

# commit — 현재 변경 내용 커밋
(절차 본문)
```

- 플러그인 안의 agent는 `<플러그인>:<agent 이름>` 형식으로 부릅니다.
- 절차는 SKILL.md에만 둡니다. agent 파일에는 역할만 짧게 적어 내용이 중복되지 않게 합니다.
- `scripts/assemble-dist.mjs`가 플러그인의 `agents/` 폴더를 통째로 `dist/`에 복사하므로, agent를 추가해도 스크립트를 고칠 필요가 없습니다(`dirs: ['agents']`).

## Codex에서는

Codex는 `context`와 `agent` 필드를 무시하고 스킬 본문을 그대로 실행합니다. 같은 스킬을 두 호스트에서 함께 쓸 수 있습니다. Codex의 모델은 Codex 쪽 설정을 따릅니다.

## 다른 방법과 비교

| 방법 | 흐름 | 비고 |
|---|---|---|
| **skill + agent (현재)** | 하네스가 agent 설정으로 subagent 1개를 띄움 | 중간 단계 없음 |
| 본문에서 위임 | 메인 모델이 스킬 본문을 읽고 Agent 도구로 agent 호출 | 2단계. 메인 모델이 토큰을 조금 씀. 위 방식이 안 될 때의 대안 |
| 스킬 `model:`만 지정 | fork 시 `general-purpose`로 떠서 메인 모델로 실행 | 모델 고정 안 됨 |

## 확인 방법

플러그인을 업데이트한 뒤 스킬을 실행하고, 실행 표시에 `committer · Sonnet`처럼 agent 이름과 모델이 나오는지 봅니다.

- agent를 찾지 못하면 `agent:` 값을 `committer`처럼 플러그인 이름 없이 써 봅니다.
- 여전히 메인 모델로 뜨면 "본문에서 위임" 방식으로 바꿉니다.
