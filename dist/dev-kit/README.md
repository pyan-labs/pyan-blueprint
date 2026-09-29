# dev-kit

pyan 개발 팀이 공통으로 쓰는 스킬 모음입니다. MCP 서버 없이 스킬만 배포합니다.

## 설치

```
/plugin install dev-kit@pyan-blueprint          # Claude Code
codex plugin add dev-kit@pyan-blueprint         # Codex CLI
```

## Skills

| Skill    | 호출 (Claude / Codex)            | 설명 |
| -------- | -------------------------------- | ---- |
| `commit` | `/dev-kit:commit` / `$commit`   | 현재 변경 내용을 저장소 형식에 맞는 메시지로 커밋 (수동 호출 전용) |

## 스킬 추가

`skills/<name>/SKILL.md`를 추가하고 루트에서 `pnpm run dist`를 실행한 뒤 `dist/`와 함께 커밋합니다.

- 사용자가 직접 부를 때만 실행돼야 하는 스킬은 frontmatter에 `disable-model-invocation: true`(Claude)를, `agents/openai.yaml`에 `policy.allow_implicit_invocation: false`(Codex)를 함께 둡니다.
