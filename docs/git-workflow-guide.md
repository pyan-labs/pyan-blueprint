# Git Flow

```bash
### Step 1. 현재 상태 확인
git status
git branch

### Step 2. dev로 이동
git checkout dev

### Step 3. dev 최신 동기화
git pull origin dev

### Step 4. 새 브랜치 생성
git checkout -b ft-db-fetcher

### Step 5. 작업 (파일 추가/수정)
plugins/baw-tools/skills/db-fetcher.md  ← 새로 생성
plugins/baw-tools/plugin.json           ← 수정 (skill 등록)

### Step 6. 변경사항 확인
git status
git --no-pager diff

### Step 7. Staging & Commit
git add .
git commit -m "feat: BAW DB fetcher skill 추가"

### Step 8. Push 전 — dev 최신 반영 (중요)
git fetch origin
git rebase origin/dev

### Step 9. GitHub에 Push
git push -u origin ft-git-doc
git push

```

### Step 10. PR 생성

**Option A — GitHub 브라우저**

push 후 GitHub 상단 배너에서 "Compare & pull request" 클릭:

```
base: dev  ←  compare: ft-db-fetcher

제목: feat: BAW DB fetcher skill 추가

본문:
## 무엇을 추가했나
- DB 스키마 자동 조회 후 쿼리 생성 skill

## 테스트
- BAW MSSQL 2019 환경 로컬 테스트 완료

@jay-lee 확인 부탁드립니다
```

**Option B — GitHub CLI (터미널에서 바로)**

```bash
gh pr create \
  --base dev \
  --title "feat: BAW DB fetcher skill 추가" \
  --body "## 무엇을 추가했나
- DB 스키마 자동 조회 후 쿼리 생성 skill

## 테스트
- BAW MSSQL 2019 환경 로컬 테스트 완료

@jay-lee 확인 부탁드립니다"
```

> 터미널을 벗어나지 않고 PR까지 완료 가능. `gh` 설치 필요 (`winget install GitHub.cli`)

### Step 11. Jay Approve 후 마무리

```bash
git checkout dev
git pull origin dev

# 다 쓴 브랜치 삭제
git branch -d ft-db-fetcher
```

### 팀원들 업데이트 반영

```bash
/plugin update baw-tools
```

---

## 팀 Git 규약

### 브랜치 구조

| 브랜치 | 역할 | 설명 |
| ------ | ---- | ---- |
| `main` | 릴리스 전용 | 프로덕션 배포 시에만 `dev` → `main` 머지 |
| `dev` | 팀 기본 브랜치 | 팀원 모두의 작업 기준점, GitHub Default Branch |
| `ft-xxx` | 기능 브랜치 | 개별 작업 → `dev`로 PR |

### 핵심 3가지

| 규약                     | 내용                      |
| ------------------------ | ------------------------- |
| main/dev 직접 작업 금지  | 모든 작업은 ft-브랜치에서 |
| dev는 항상 pull 후 시작  | 최신 dev 기준으로 브랜치  |
| 작업은 항상 ft-브랜치    | 브랜치 생성 → 작업 → PR   |

```
❌ git checkout dev → 작업 → push
✅ git checkout -b ft-xxx → 작업 → PR (base: dev)
```

### GitHub Branch Protection 설정

[설정방법](./github-repo-protection.md)

```
Settings → General → Default branch → dev 로 변경

Settings → Branches → Branch protection rules
  [dev 보호 규칙]
  ✅ Require a pull request before merging
  ✅ Required approvals: 1 (Jay)
  ✅ Dismiss stale pull request approvals

  [main 보호 규칙 — 동일하게 추가]
  ✅ Require a pull request before merging
  ✅ Required approvals: 1 (Jay)

Settings → Merge button
  ✅ Allow squash merging only  ← 나머지 두 개 uncheck
```

---

## Advanced: Git 핵심 명령어 개념 정리

### `git fetch origin`

- GitHub(origin)의 **모든 브랜치 최신 스냅샷**을 `origin/브랜치명` 포인터에 저장
- **로컬 브랜치는 절대 건드리지 않음**
- "GitHub에 뭐가 있는지 정보만 가져오는 것"

```
fetch 후:
  origin/dev   →  A - B - C - D   ← 최신 스냅샷
  로컬 dev     →  A - B - C       ← 그대로
  ft-db-fetcher → A - B - C - [T1][T2]  ← 그대로
```

### `git rebase origin/dev`

- **rebase = re + base = 브랜치의 출발점(base)을 다시 설정**
- 현재 브랜치(ft-db-fetcher)의 base를 origin/dev 최신 끝으로 교체
- 내 작업 커밋들을 떼어냈다가 새 base 위에 재작성
- **GitHub 원본은 절대 건드리지 않음**

```
rebase 전:
  origin/dev:    A - B - C - D
  ft-db-fetcher: A - B - C - [T1][T2]  ← base = C

rebase 후:
  origin/dev:    A - B - C - D         ← 그대로
  ft-db-fetcher: A - B - C - D - [T1'][T2']  ← base = D
```

> T1' T2' = 내용은 같지만 Git 내부적으로 새 커밋으로 재생성됨

### `git rebase origin/dev` vs `git rebase dev`

|                         | 기준점                      | 신뢰도              |
| ----------------------- | --------------------------- | -------------------- |
| `git rebase dev`        | 로컬 dev (오래됐을 수 있음) | D를 모를 수 있음     |
| `git rebase origin/dev` | fetch로 가져온 최신 스냅샷  | 항상 정확             |

> 로컬 dev를 건드리지 않는 한 **`git rebase origin/dev`이 항상 정답**

### `git merge` vs `git rebase` 방향 비교

|        | 내가 있는 브랜치 | 명령                      | 결과                       |
| ------ | ---------------- | ------------------------- | -------------------------- |
| merge  | dev              | `git merge ft-db-fetcher` | dev이 ft-db-fetcher를 흡수 |
| rebase | ft-db-fetcher    | `git rebase origin/dev`   | ft-db-fetcher가 dev를 흡수 |

```
merge:  dev ← ft-db-fetcher 를 당겨옴 (merge 커밋 M 생성)
rebase: ft-db-fetcher → dev 위로 올라감 (선형 히스토리 유지)
```

---

## 전체 흐름 한눈에

```
Tom                              GitHub                    Jay
───                              ──────                    ───
git checkout dev
git pull origin dev
git checkout -b ft-db-fetcher
  ... 작업 ...
git add . / git commit
git fetch origin
git rebase origin/dev
git push origin ft-db-fetcher  → PR 생성 (base: dev)
                                                     Review & Approve
                               Squash merge → dev ←
git checkout dev
git pull origin dev
git branch -d ft-db-fetcher

                               (팀원 전체) /plugin update
```

---

## 핵심 원칙 요약

> **main은 릴리스 전용 — 프로덕션 배포 시에만 머지**
> **dev가 팀 기준 브랜치 — 모든 작업의 출발점**
> **모든 작업은 ft-브랜치에서**
>
> 이 구조가 지켜지면 main은 항상 안정적이고, dev는 팀 작업의 흐름을 반영한다.
