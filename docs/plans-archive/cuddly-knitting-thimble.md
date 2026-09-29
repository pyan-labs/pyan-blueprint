# Plan: pyan-git-push-pr.prompt.md 생성

## Context
기존 `pyan-git-commit-push.prompt.md`를 두 단계로 분리하는 작업.
- Step 1 (commit): `pyan-git-commit.prompt.md` — 이미 완료
- **Step 2 (rebase → push → PR)**: `pyan-git-push-pr.prompt.md` — 이번에 생성

## 생성할 파일
`c:\Develop\team-plugins\.github\prompts\pyan-git-push-pr.prompt.md`

## 내용 설계

### Frontmatter
- 기존 prompt 패턴 따름 (agent, tools, model)
- description: rebase → push → PR 생성 자동화

### 핵심 절차 (3단계)
1. **Rebase** — `git fetch origin` → `git rebase origin/dev` (충돌 시 안내)
2. **Push** — 리모트 트래킹 여부 확인 → `git push -u origin <branch>` 또는 `git push`
3. **PR 생성** — `gh pr create --base dev` (제목: 커밋 메시지 기반, 본문: 변경사항 요약)

### 주요 고려사항
- 현재 브랜치가 `main`/`dev`인 경우 중단 및 경고
- rebase 충돌 시 사용자에게 해결 안내
- PR 제목은 커밋 히스토리 분석 기반 자동 생성
- `{input:language}` 파라미터로 한국어/영어 지원 (기존 패턴 유지)
- PR body에 변경사항 요약 + 테스트 섹션 포함

## Verification
- 파일 생성 후 frontmatter YAML 형식 확인
- 기존 prompt 파일들과 스타일 일관성 확인
