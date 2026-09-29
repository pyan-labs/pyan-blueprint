---
name: commit
description: Manual-only. Use ONLY when the user explicitly invokes this skill (Claude `/dev-kit:commit`, Codex `$commit`). Commits the current working-tree changes with a message in the repo's style.
disable-model-invocation: true
model: sonnet
effort: medium
context: fork
---

# commit — 현재 변경 내용 커밋

현재 작업 트리의 변경 내용을 하나의 커밋으로 남긴다. 인자(`$ARGUMENTS`)가 있으면 커밋 메시지의 힌트(주제·scope)로 쓴다.

## 절차

1. `git status --short`로 변경 범위를 본다. 변경이 없으면 "커밋할 변경 없음"만 보고하고 멈춘다.
2. `git add -A`로 스테이징한 뒤 `git diff --cached --stat`과 `git diff --cached`로 내용을 읽는다. 새 파일(untracked였던 파일)도 여기서 함께 확인한다.
3. 커밋하면 안 되는 파일(`.env`, 비밀키·토큰, 대용량 바이너리, 의도치 않은 빌드 산출물)이 보이면 `git reset`으로 스테이징을 되돌리고, 커밋하지 않은 채 해당 파일 목록을 보고하고 멈춘다.
4. `git log --oneline -10`으로 최근 메시지 형식을 확인하고 커밋한다. 메시지 규칙:
   - 제목: 저장소의 기존 형식을 따른다. 기존 형식이 없으면 `type(scope): 한글 요약` — type은 `feat`·`fix`·`docs`·`chore`·`refactor`·`test` 중 하나, scope는 변경된 영역. 무엇이 바뀌었는지보다 **왜/무엇을 하게 됐는지**가 읽히게 한 줄로.
   - 본문: 변경이 여러 갈래일 때만 `-` 목록으로 짧게.
   - 세션이 `Co-Authored-By` attribution 줄을 지정했으면 마지막 줄에 붙인다.
   - 여러 줄 메시지는 heredoc으로 넘긴다.
5. `git log --oneline -1`로 결과를 보고한다.

## 하지 않는 것

- push, amend, rebase, 브랜치 생성은 하지 않는다.
- `--no-verify`로 hook을 건너뛰지 않는다. hook이 실패하면 원인을 보고하고 멈춘다.
- 변경 내용을 고치거나 포맷하지 않는다 — 있는 그대로 커밋만 한다.
