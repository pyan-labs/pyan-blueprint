# 1️⃣ `dev` branch protection 설정

1. GitHub에서 **Repository**로 이동합니다.
2. 상단 메뉴에서 **Settings** 클릭
3. 왼쪽 메뉴에서 **Branches** 클릭
4. **Branch protection rules**에서
   **Add rule** 클릭

### Branch name pattern

```
dev
```

### 아래 옵션 체크

**Pull Request 관련**

✅ **Require a pull request before merging**

그 아래 Review 설정에서

- **Required number of approvals before merging**

```
1
```

추가 옵션

✅ **Dismiss stale pull request approvals when new commits are pushed**

### 저장

맨 아래

```
Create
또는
Save changes
```

---

# 2️⃣ `main` branch protection 설정

다시 **Add rule** 클릭

### Branch name pattern

```
main
```

### 옵션 체크

✅ **Require a pull request before merging**

Review 설정

```
Required number of approvals before merging = 1
```

(질문에 맞게 stale dismiss는 안 넣어도 됩니다)

### 저장

```
Create / Save changes
```

---

# 3️⃣ Merge 방식 제한 (Squash only)

이 설정은 **Branches가 아니라 General**에 있습니다.

1. **Settings**
2. 왼쪽 메뉴 **General**
3. 아래로 내려가서 **Pull Requests** 섹션 찾기

여기서 다음처럼 설정합니다.

```
Allow squash merging        ✅
Allow merge commits         ❌
Allow rebase merging        ❌
```

---

# 4️⃣ 최종 상태 (원하시는 정책)

### dev (trunk)

- direct push ❌
- PR merge만 가능
- approval **1명 누구라도 가능**
- 새 commit push 시 기존 approval reset

---

### main (release)

- PR merge만 가능
- approval **1명 누구라도 가능**
- squash merge만 가능

---

# 5️⃣ 실제 workflow

일반적으로 이렇게 됩니다.

```
feature branch
      ↓
PR → dev
      ↓
test 완료
      ↓
PR → main (release)
```

---

원하시면 제가 **이 구조에서 많이 쓰는 GitHub PR 전략 (commit message / branch naming / release tagging)**도 같이 정리해 드리겠습니다.
이 부분까지 맞추면 팀 workflow가 훨씬 깔끔해집니다.
