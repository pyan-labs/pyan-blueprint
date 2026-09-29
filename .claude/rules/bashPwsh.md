# Windows PowerShell Rules for Bash Tool

## Overview

이 프로젝트는 Windows 환경에서 실행됩니다. Claude Code의 Bash 도구는 실제로 PowerShell을 통해 실행되므로, **PowerShell 구문**을 사용해야 합니다.

## Core Rules

### 1. Multi-line Continuation

멀티라인 명령어 작성 시 `\` 대신 백틱(`` ` ``)을 사용합니다.

```powershell
# ❌ Wrong (Unix/Bash style)
az containerapp hostname add \
  --name new-app \
  --resource-group rgfxnproject \
  --hostname newapp.fxnproject.com

# ✅ Correct (PowerShell style)
az containerapp hostname add `
  --name new-app `
  --resource-group rgfxnproject `
  --hostname newapp.fxnproject.com
```

### 2. Environment Variables

환경 변수 접근 시 `$VAR` 대신 `$env:VAR`를 사용합니다.

```powershell
# ❌ Wrong (Unix/Bash style)
echo $HOME
echo $PATH
export MY_VAR="value"

# ✅ Correct (PowerShell style)
echo $env:USERPROFILE
echo $env:PATH
$env:MY_VAR = "value"
```

### 3. Command Chaining

명령어 연결 시 `&&` 대신 `;` 또는 PowerShell 연산자를 사용합니다.

```powershell
# ❌ Wrong (Unix/Bash style)
npm install && npm run build

# ✅ Correct (PowerShell style)
npm install; if ($?) { npm run build }
# 또는 간단한 경우
npm install; npm run build
```

### 4. Path Separators

경로 구분자는 백슬래시(`\`) 또는 슬래시(`/`) 모두 가능하나, 일관성 유지합니다.

```powershell
# ✅ Both work in PowerShell
cd C:\Develop\FXPoCProjects
cd C:/Develop/FXPoCProjects
```

### 5. Null Device

출력 무시 시 `/dev/null` 대신 `$null`을 사용합니다.

```powershell
# ❌ Wrong (Unix/Bash style)
command > /dev/null 2>&1

# ✅ Correct (PowerShell style)
command | Out-Null
# 또는
command > $null 2>&1
```

### 6. Command Differences

| Unix/Bash  | PowerShell                            | 설명                       |
| ---------- | ------------------------------------- | -------------------------- |
| `ls`       | `Get-ChildItem` 또는 `ls`             | 디렉토리 목록 (ls는 alias) |
| `cat`      | `Get-Content` 또는 `cat`              | 파일 내용 출력             |
| `rm -rf`   | `Remove-Item -Recurse -Force`         | 재귀 삭제                  |
| `mkdir -p` | `New-Item -ItemType Directory -Force` | 디렉토리 생성              |
| `cp -r`    | `Copy-Item -Recurse`                  | 재귀 복사                  |
| `which`    | `Get-Command`                         | 명령어 위치 찾기           |
| `grep`     | `Select-String`                       | 텍스트 검색                |

### 7. Here-Documents (Heredoc)

멀티라인 문자열은 Here-String을 사용합니다.

```powershell
# ❌ Wrong (Unix/Bash style)
cat << EOF
multi
line
text
EOF

# ✅ Correct (PowerShell style)
@"
multi
line
text
"@
```

## Common Patterns

### Git Commit with Multi-line Message

```powershell
git commit -m @"
feat: Add new feature

- Detail 1
- Detail 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
"@
```

### Azure CLI Commands

```powershell
az webapp create `
  --name myapp `
  --resource-group mygroup `
  --plan myplan `
  --runtime "NODE:18-lts"
```

### Docker Commands

```powershell
docker run `
  -d `
  -p 3000:3000 `
  -e "NODE_ENV=production" `
  --name mycontainer `
  myimage:latest
```

## Notes

- 대부분의 CLI 도구(npm, pnpm, git, az, docker 등)는 Windows에서도 동일하게 작동합니다
- 단, 셸 구문(변수, 연속 문자, 파이프 등)은 PowerShell 규칙을 따라야 합니다
- `&&` 연산자는 PowerShell 7+에서 지원되지만, 호환성을 위해 `;`와 `$?` 조합 권장
