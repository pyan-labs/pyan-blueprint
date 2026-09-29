# Git Workflow 3-Branch 전략으로 변경 계획

## Context

기존 2브랜치 전략(`main` + `ft-branch`)에서 3브랜치 전략(`main` / `dev` / `ft-branch`)으로 변경.
- `dev`: 팀 기본 작업 브랜치 (default branch), 팀원들이 항상 기준으로 삼는 브랜치
- `main`: 릴리스 전용 브랜치 — 프로덕션 배포 시에만 머지
- `ft-branch`: 개별 기능 작업 브랜치 → `dev`로 PR

모든 리포가 이 구조를 표준으로 채택.

## 수정 대상 파일

1. **[git-workflow-plugin-guide.md](git-workflow-plugin-guide.md)** — 주 가이드 문서 (전면 수정)
2. **[CLAUDE.md](CLAUDE.md)** — Git 워크플로우 섹션 업데이트

---

## 변경 상세

### git-workflow-plugin-guide.md

#### Section 3 (핵심 3가지)
- `main 직접 작업 금지` → `main/dev 직접 작업 금지`로 설명 강화
- `main은 pull만` → `main은 릴리스 전용, dev가 기본 base`로 변경
- 예시 코드: `git checkout main → 작업` → `git checkout dev → 작업` 으로 변경

#### Section 4 (Tom 작업 흐름 전체 단계)
| 단계 | 현재 | 변경 후 |
|------|------|---------|
| Step 2 | `git checkout main` | `git checkout dev` |
| Step 2 제목 | "main으로 이동" | "dev로 이동" |
| Step 3 | `git pull origin main` | `git pull origin dev` |
| Step 3 제목 | "main 최신 동기화" | "dev 최신 동기화" |
| Step 4 설명 | "ft-xxx는 main의 최신 상태" | "ft-xxx는 dev의 최신 상태" |
| Step 8 | `git rebase origin/main` | `git rebase origin/dev` |
| Step 10 PR | `base: main` | `base: dev` |
| Step 10 gh cli | `--base main` | `--base dev` |
| Jay Approve 후 | `git checkout main` + `git pull origin main` | `git checkout dev` + `git pull origin dev` |

#### Section 5 (핵심 명령어 개념 정리)
- `git rebase origin/main` 예시 다이어그램 → `origin/dev`로 변경
- 비교표에서 `git rebase main` vs `git rebase origin/main` → `dev` 기반으로 변경
- `git merge` vs `git rebase` 비교표 → `dev` 기반으로 변경

#### Section 6 (전체 흐름 한눈에)
```
// 기존
git checkout main
git pull origin main
git checkout -b ft-db-fetcher
...
git rebase origin/main
git push origin ft-db-fetcher → PR 생성 (base: main)
Squash merge → main
git checkout main
git pull origin main

// 변경 후
git checkout dev
git pull origin dev
git checkout -b ft-db-fetcher
...
git rebase origin/dev
git push origin ft-db-fetcher → PR 생성 (base: dev)
Squash merge → dev
git checkout dev
git pull origin dev
```

#### Section 7 (핵심 원칙 요약)
- "main은 읽기 전용으로 대하고" → "main은 릴리스 전용, dev가 팀 기준 브랜치"

### CLAUDE.md

Git 워크플로우 섹션:
```bash
# 기존
git checkout -b ft-xxx
git fetch origin && git rebase origin/main
git pull origin main && git branch -d ft-xxx
# main 직접 커밋 금지

# 변경 후
git checkout dev && git pull origin dev
git checkout -b ft-xxx
git fetch origin && git rebase origin/dev
# PR → base: dev → Jay 승인 → Squash merge
git checkout dev && git pull origin dev && git branch -d ft-xxx
# main은 릴리스 전용, dev/main 직접 커밋 금지
```

---

## Branch Protection 설정 (Section 3에 추가)

`dev`를 GitHub Default Branch로 설정하는 방법도 가이드에 추가:
```
Settings → General → Default branch → dev 로 변경
Settings → Branches → Branch protection rules
  → dev 보호 규칙 추가 (main과 동일하게)
```

---

## 검증 방법

1. 문서 내 모든 `origin/main`, `checkout main`, `base: main` 참조가 `dev`로 바뀌었는지 확인
2. `main`은 릴리스 전용 개념 설명에만 남아있어야 함
3. CLAUDE.md Git 워크플로우 섹션도 일관성 있게 업데이트 확인
