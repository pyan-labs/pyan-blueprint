# GitHub Branch Protection 설정 계획

## Context

`Pyanllc/team-plugins` 레포가 막 퍼블리시된 초기 상태다.
`git-workflow-plugin-guide.md`의 규약(master 직접 커밋 금지, PR + Jay 승인 필수, Squash merge only)을
GitHub 레포 설정에 강제 적용해야 한다.

기본 브랜치는 `master` (main이 아님). `.github/` 폴더 없음, branch protection 미설정 상태.

---

## 구현 계획

### Step 1 — Branch Protection Rule 적용 (gh CLI)

```bash
gh api repos/Pyanllc/team-plugins/branches/master/protection \
  --method PUT \
  --field required_status_checks=null \
  --field enforce_admins=true \
  --field "required_pull_request_reviews[required_approving_review_count]=1" \
  --field "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  --field "restrictions=null"
```

적용 내용:
- `required_pull_request_reviews` → PR 없이 merge 불가, 1명 승인 필수, stale approval 자동 해제
- `enforce_admins=true` → owner(Jay)도 룰 적용 대상
- `restrictions=null` → push 제한은 별도 없음 (브랜치 보호만)

### Step 2 — Squash Merge Only 설정 (gh CLI)

```bash
gh api repos/Pyanllc/team-plugins \
  --method PATCH \
  --field allow_merge_commit=false \
  --field allow_squash_merge=true \
  --field allow_rebase_merge=false
```

### Step 3 — PR 템플릿 추가 (선택, 권장)

파일: `.github/pull_request_template.md`

```markdown
## 무엇을 추가/수정했나
-

## 테스트
-

@jay-lee 확인 부탁드립니다
```

워크플로우 가이드의 PR 본문 형식을 표준화.

---

## 검증

```bash
# 보호 설정 확인
gh api repos/Pyanllc/team-plugins/branches/master/protection

# merge 설정 확인
gh api repos/Pyanllc/team-plugins --jq '{squash:.allow_squash_merge, merge:.allow_merge_commit, rebase:.allow_rebase_merge}'
```

master 브랜치에 직접 push 시도 → 거부되면 정상.
