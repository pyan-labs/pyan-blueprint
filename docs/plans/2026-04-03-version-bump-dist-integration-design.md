# Version Bump + Dist 통합 설계

## 문제

`version-bump.mjs`가 이전 구조(`db-first/`)의 경로를 참조하고 있어 `packages/db-first/`로 이동한 새 구조에서 동작하지 않음. 또한 빌드만 수행하고 dist 조립을 하지 않아 배포 디렉토리가 갱신되지 않음.

## 변경 사항

### version-bump.mjs

1. 파일 경로를 `packages/db-first/...`로 수정
2. 빌드 명령을 `pnpm run build` → `pnpm run dist`로 변경 (build + assemble-dist)

### VERSION-BUMP.md

업데이트 대상 파일 경로를 새 구조에 맞게 수정, dist 조립 단계 추가.

## 동작 순서

```
pnpm run version:bump patch
  1. packages/db-first/.claude-plugin/plugin.json → 현재 버전 읽기
  2. semver bump 계산
  3. 4개 파일 버전 업데이트
  4. pnpm run dist → esbuild + assemble-dist (plugin.json, skills 자동 복사)
  5. 완료
```
