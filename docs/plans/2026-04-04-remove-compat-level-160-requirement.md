# Remove SQL Server Compat Level 160 Requirement — Implementation Plan

> **Status: Superseded — README-only change adopted (commit cb717de). See design doc Update section.**
>
> 이 플랜은 쿼리 재작성을 전제로 작성되었으나, 리뷰 과정에서 코드 변경 없이 README 문구만
> 완화하는 것으로 결정됨. Task 1/3/4는 더 이상 유효하지 않음. Task 2만 축약된 형태로 실행됨.
>
> 향후 실제 `STRING_AGG` 호환성 문제 발생 시 이 플랜의 Task 1(쿼리 재작성)을 참고.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** MCP db-fetcher의 `get_indexes` 쿼리가 `COMPATIBILITY_LEVEL = 160` 설정 없이 SQL Server 2012+ 모든 환경에서 동작하도록 수정한다.

**Architecture:** `STRING_AGG(...) WITHIN GROUP (ORDER BY ...)` 집계를 `STUFF + FOR XML PATH` 상관 서브쿼리 패턴으로 교체. 결과 스키마 동일, TypeScript 매핑 코드 변경 불필요. README 2곳의 compat 160 요구 문구 제거.

**Tech Stack:** TypeScript, Node.js, mssql, pnpm workspace, esbuild

**Design doc:** [docs/plans/2026-04-04-remove-compat-level-160-requirement-design.md](./2026-04-04-remove-compat-level-160-requirement-design.md)

---

## Task 1: `indexes.ts` 쿼리 재작성

**Files:**
- Modify: `packages/db-first/mcp-db-fetcher/src/queries/indexes.ts:15-39`

**Step 1: 쿼리 본문 교체**

`indexes.ts`의 `request.query(...)` 호출 내부 SQL을 아래로 교체:

```sql
SELECT
  i.name                AS index_name,
  t.name                AS table_name,
  i.is_unique           AS is_unique,
  i.is_primary_key      AS is_primary_key,
  STUFF((
    SELECT ', ' + c.name
    FROM sys.index_columns ic
    INNER JOIN sys.columns c
      ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE ic.object_id = i.object_id
      AND ic.index_id  = i.index_id
      AND ic.is_included_column = 0
    ORDER BY ic.key_ordinal
    FOR XML PATH(''), TYPE
  ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS columns,
  STUFF((
    SELECT ', ' + c.name
    FROM sys.index_columns ic
    INNER JOIN sys.columns c
      ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE ic.object_id = i.object_id
      AND ic.index_id  = i.index_id
      AND ic.is_included_column = 1
    FOR XML PATH(''), TYPE
  ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS included_columns
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
${whereClause}
  AND i.type > 0
ORDER BY t.name, i.name
```

주의사항:
- 외부 쿼리에서 `sys.index_columns ic` / `sys.columns c` JOIN 제거 (서브쿼리 내부로 이동)
- 외부 쿼리의 `GROUP BY` 제거 (집계 불필요)
- `${whereClause}`는 기존 그대로 유지 (`WHERE t.name = @table` 또는 `WHERE t.is_ms_shipped = 0`)

**Step 2: TypeScript 매핑 코드 확인**

`result.recordset.map(...)` 블록(lines 41-49)은 변경 불필요. 결과 컬럼 이름(`columns`, `included_columns`)이 동일하고 `.split(", ")` 로직도 그대로.

**Step 3: 빌드 검증**

Run:
```bash
pnpm --filter @pyanllc/mcp-db-fetcher build
```

Expected: 에러 없이 완료. `packages/db-first/mcp-db-fetcher/dist/index.js` 갱신.

**Step 4: 타입 체크**

Run:
```bash
pnpm run lint
```

Expected: 에러 없음.

**Step 5: Commit**

```bash
git add packages/db-first/mcp-db-fetcher/src/queries/indexes.ts
git commit -m "fix(db-fetcher): replace STRING_AGG with STUFF+FOR XML PATH in get_indexes

STRING_AGG WITHIN GROUP required compat level 160. Replaced with
correlated subqueries using STUFF + FOR XML PATH (TYPE) pattern,
supporting SQL Server 2012+ without COMPATIBILITY_LEVEL changes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: README 업데이트

**Files:**
- Modify: `packages/db-first/README.md:3-19`
- Modify: `dist/db-first/README.md:3-19`

**Step 1: `packages/db-first/README.md` 업데이트**

Lines 3-19 (Prerequisites 섹션 전체)를 다음으로 교체:

```markdown
## Prerequisites

### MS SQL Server 버전

SQL Server 2012 이상을 권장합니다. 기존 DB의 compatibility level 변경은 필요하지 않습니다.
```

**Step 2: `dist/db-first/README.md`도 동일하게 업데이트**

동일한 내용으로 `dist/db-first/README.md`의 해당 섹션 교체.

**Step 3: Commit**

```bash
git add packages/db-first/README.md dist/db-first/README.md
git commit -m "docs(db-first): remove compat level 160 requirement from README

get_indexes query no longer requires COMPATIBILITY_LEVEL = 160
after switching to STUFF + FOR XML PATH pattern.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 실DB 결과 검증

**Files:** (검증만, 코드 변경 없음)

**Step 1: MCP db-fetcher의 get_indexes 호출**

Claude Code에서 `mcp:db-fetcher`의 `get_indexes` tool을 실제 DB에 대해 호출. 다음 케이스 각각 결과 확인:

1. 단일 컬럼 인덱스 — `columns`에 컬럼 1개만 포함
2. 복합 인덱스 — `columns` 배열 순서가 `key_ordinal` 순서와 일치
3. Included columns 있는 인덱스 — `included_columns` 비어있지 않음
4. Included columns 없는 인덱스 — `included_columns`가 빈 배열 `[]`

**Step 2: Primary Key 인덱스 확인**

PK 인덱스가 결과에 포함되고 `is_primary_key: true`인지 확인.

**Step 3: 이슈 없으면 Task 완료**

검증 통과 시 다음 단계로. 문제 발생 시 해당 케이스를 설계 팀에 공유.

---

## Task 4: `dist/` 재조립 및 최종 커밋

**Files:**
- Regenerate: `dist/db-first/mcp-db-fetcher/dist/index.js`

**Step 1: dist 재조립**

Run:
```bash
pnpm run dist
```

Expected: `dist/db-first/mcp-db-fetcher/dist/index.js`가 최신 소스 기반으로 재생성됨.

**Step 2: Git 상태 확인**

Run:
```bash
git status
```

Expected: `dist/db-first/mcp-db-fetcher/dist/index.js`가 수정됨 목록에 있음.

**Step 3: Commit**

```bash
git add dist/db-first/mcp-db-fetcher/dist/index.js
git commit -m "chore: rebuild dist bundle for get_indexes query change

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] Task 1: `indexes.ts` 쿼리 재작성 + 빌드 통과
- [ ] Task 2: README 2곳 업데이트
- [ ] Task 3: 실DB에서 `get_indexes` 결과 검증 완료
- [ ] Task 4: `dist/` 재조립 및 커밋
- [ ] 모든 커밋이 `dev` 브랜치에 반영됨
