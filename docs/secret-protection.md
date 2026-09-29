# 민감 정보 커밋·푸시 차단

API key, DB 비밀번호, 연결 문자열이 커밋되거나 GitHub에 푸시되지 않게 막는 설정과 남은 작업을 정리한다. 저장소가 **public**이므로 한 번 푸시된 비밀값은 이력을 지워도 이미 노출된 것으로 본다.

## 방어 계층

| 계층 | 시점 | 담당 | 상태 |
|------|------|------|------|
| 1. `.gitignore` | `git add` | 설정 파일 자체를 추적하지 않음 | 적용됨 |
| 2. pre-commit 훅 (gitleaks) | `git commit` | 스테이징된 변경을 로컬에서 검사 | **미적용** |
| 3. GitHub Push protection | `git push` | 알려진 provider 형식의 비밀값 푸시 거부 | 적용됨 |
| 4. GitHub Secret scanning | 푸시 이후 | 저장소 전체·이력 검사, 알림 | 적용됨 |
| 5. CI 검사 | PR | 훅을 건너뛴 커밋을 PR에서 검사 | **미적용** |

Push protection은 푸시 시점에 막으므로 비밀값은 이미 로컬 커밋에 들어가 있다. 그 커밋을 고치려면 이력을 다시 써야 한다. 커밋 전에 막는 2번 계층이 필요한 이유다.

## 현재 상태 (2026-09-29 확인)

`gh api repos/pyan-labs/pyan-blueprint`의 `security_and_analysis`:

| 항목 | 상태 |
|------|------|
| `secret_scanning` | enabled |
| `secret_scanning_push_protection` | enabled |
| `secret_scanning_non_provider_patterns` | **disabled** |
| `secret_scanning_validity_checks` | disabled |
| `dependabot_security_updates` | enabled |

로컬:

- `.gitignore`가 `.db-fetcher.json`, `.env`를 모든 경로에서 제외한다 (`packages/db-first/.db-fetcher.json` 포함 확인).
- `.db-fetcher.example.json`은 `<YOUR_PASSWORD>` 같은 placeholder만 담는다.
- gitleaks 미설치, `core.hooksPath` 미설정, `.github/workflows` 없음.
- 추적 중인 소스(`node_modules`·`dist` 제외)에서 평문 password/secret/token 할당은 발견되지 않았다.

## 이 저장소의 주요 위험

db-first는 MS SQL 접속 정보를 다룬다. 새기 쉬운 값은 다음과 같다.

- `.db-fetcher.json`의 `"password": "..."`
- ADO.NET 연결 문자열의 `Password=...;` / `Pwd=...;`
- 테스트용 `test-client.ts`나 문서 예시에 붙여 넣은 실제 서버 주소·계정

GitHub Push protection은 GitHub이 제휴한 provider의 토큰 형식(GitHub PAT, AWS key, Azure key 등)을 기준으로 막는다. **일반 비밀번호나 SQL Server 연결 문자열은 기본 차단 대상이 아니다.** 이 빈틈은 non-provider 패턴과 로컬 gitleaks 규칙으로 메운다.

## 할 일

### 1. GitHub: non-provider 패턴 켜기

Settings → Code security → Secret Protection → **Scan for non-provider patterns** 활성화. private key, 연결 문자열 형태의 generic 비밀값을 탐지한다. 탐지 결과는 알림으로만 오고 푸시를 막지 않는다.

선택: **Validity checks**를 켜면 탐지된 provider 토큰이 아직 유효한지 알림에 표시된다.

### 2. 로컬: gitleaks 설치

```powershell
winget install Gitleaks.Gitleaks   # 또는 scoop install gitleaks
gitleaks version
```

설치 후 기존 이력 전체를 한 번 검사한다.

```bash
gitleaks git --redact --verbose .
```

### 3. 저장소 규칙: `.gitleaks.toml`

기본 규칙에 db-first 전용 규칙을 더한다. `<`로 시작하는 placeholder는 제외한다.

```toml
[extend]
useDefault = true

[[rules]]
id = "db-fetcher-password"
description = "db-fetcher 설정의 평문 DB 비밀번호"
regex = '''(?i)"password"\s*:\s*"([^"<][^"]{3,})"'''
secretGroup = 1
keywords = ["password"]

[[rules]]
id = "adonet-connection-string-password"
description = "ADO.NET 연결 문자열의 Password/Pwd"
regex = '''(?i)\b(?:password|pwd)\s*=\s*([^;"'<\s][^;"']{3,})'''
secretGroup = 1
keywords = ["password", "pwd"]
```

오탐이 나오면 `[allowlist]`에 경로나 값을 추가한다. 추가할 때는 이유를 주석으로 남긴다.

### 4. pre-commit 훅을 저장소에 포함

`.githooks/pre-commit`:

```sh
#!/bin/sh
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks가 없습니다. docs/secret-protection.md 참고" >&2
  exit 1
fi
exec gitleaks git --pre-commit --staged --redact --verbose
```

clone한 사람마다 훅이 켜지도록 루트 `package.json`에 추가한다.

```json
"scripts": {
  "prepare": "git config core.hooksPath .githooks"
}
```

`pnpm install` 시 `prepare`가 실행된다. 훅을 건너뛰는 `git commit --no-verify`는 쓰지 않는다.

### 5. CI: PR에서 검사

`.github/workflows/secret-scan.yml`에서 gitleaks CLI를 실행한다. `gitleaks/gitleaks-action`은 organization 저장소에서 라이선스 키(`GITLEAKS_LICENSE`)를 요구하므로, `pyan-labs`에서는 CLI를 직접 받아 `gitleaks git --redact --verbose --log-opts="origin/main..HEAD"`로 PR 범위만 검사한다.

### 6. `.gitignore` 보강

현재 규칙에 흔한 비밀 파일 형식을 더한다.

```gitignore
.env.*
!.env.example
*.pem
*.pfx
*.key
```

### 7. `SECURITY.md` 정정

현재 `SECURITY.md`는 pyan-minipowers에서 복사한 그대로라 범위가 `minipowers`로 적혀 있다. db-first 기준으로 바꾸고, 비밀값 노출 시 대응(아래)을 짧게 연결한다.

### 8. 설치한 GitHub App 확인

설치했다는 앱이 무엇인지 문서에 기록한다. 비밀값 검사 앱이면(예: GitGuardian) PR 검사 결과가 CI와 겹치는지 보고 5번 범위를 조정한다. GitLens는 VS Code 이력 확인용 확장이라 비밀값 검사를 하지 않는다.

## Push protection에 막혔을 때

1. 푸시를 우회(bypass)하지 않는다. GitHub 화면의 "allow secret" 옵션은 실제 비밀값에 쓰지 않는다.
2. 푸시하지 않은 로컬 커밋에서 비밀값을 제거한다.
   - 마지막 커밋이면: 파일을 고치고 `git commit --amend`
   - 더 이전 커밋이면: `git rebase`로 해당 커밋을 수정
3. 비밀값을 환경변수나 `.db-fetcher.json`(ignore 대상)으로 옮긴다.
4. 다시 푸시한다.

오탐이면 `.gitleaks.toml` allowlist에 추가하고, GitHub에서는 "It's used in tests" 또는 "It's a false positive"로 사유를 남긴다.

## 비밀값이 이미 푸시됐을 때

public 저장소이므로 순서가 중요하다.

1. **먼저 폐기·교체한다.** DB 비밀번호 변경, API key 재발급. 이력 정리보다 우선이다.
2. 접근 로그를 확인한다. DB 로그인 기록, provider 사용 기록.
3. 이력에서 제거한다. `git filter-repo --replace-text`로 값을 치환하고 force push한다. fork·clone·캐시에는 남을 수 있으므로 1번을 대신하지 못한다.
4. GitHub Secret scanning 알림을 "Revoked"로 닫는다.
5. `CHANGELOG.md`나 내부 기록에 경위를 남긴다.

## 점검

- 분기마다 `gitleaks git --redact .`로 전체 이력을 다시 검사한다.
- Security 탭 → Secret scanning 알림이 0건인지 확인한다.
- 새 플러그인을 추가하면 그 플러그인의 설정 파일 형식을 `.gitignore`와 `.gitleaks.toml`에 반영한다.
