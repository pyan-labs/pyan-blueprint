# Remove SQL Server Compatibility Level 160 Requirement — Design

**Date**: 2026-04-04
**Status**: Superseded — README-only change was adopted instead (see commit cb717de)

## Update (2026-04-04)

초기 설계는 `STRING_AGG`를 `STUFF + FOR XML PATH`로 재작성하는 코드 변경 방안이었으나,
코드 리뷰에서 두 가지 우려가 제기됨:

1. **High**: 상관 서브쿼리가 set-based 집계를 per-row 반복으로 바꿔 성능 회귀 리스크
2. **Medium**: 외부 JOIN 제거로 반환되는 인덱스 cardinality가 변경될 수 있음

재검토 결과, `STRING_AGG`는 **SQL Server 2017 엔진부터 database compat level과 무관하게
동작**하는 것으로 확인됨. 원 README의 "compat 160 필요" 기술은 과도하게 보수적이었음.

따라서 **코드 변경 없이 README 문구만 완화**하는 것으로 결정:
- "compat 160 필요 + ALTER 실행 요구" → "SQL Server 2017+ 권장, ALTER 불필요"
- `STRING_AGG` 오류 발생 시에만 compat level 확인 안내

이 접근은 리뷰어의 High/Medium 우려를 모두 자연 해소하면서 최소 변경으로 사용자 요구
(`ALTER DATABASE ... = 160` 실행 불필요)를 충족함.

아래 원 설계 내용은 향후 실제로 `STRING_AGG` 호환성 문제가 발생할 경우 참고용으로 보존.

---

## Problem

현재 db-first 플러그인의 MCP db-fetcher는 `get_indexes` reverse engineering 쿼리에서
`STRING_AGG(...) WITHIN GROUP (ORDER BY ...)` 구문을 사용한다. 이 때문에 README에서
사용자에게 다음 명령 실행을 요구하고 있다.

```sql
ALTER DATABASE [YourDatabaseName] SET COMPATIBILITY_LEVEL = 160;
```

기존 운영 중인 DB의 compat level을 160으로 변경하면 쿼리 옵티마이저 동작 변화, 기존
애플리케이션의 실행 계획 변경 등 호환성 리스크가 발생한다. 기존 DB를 변경하지 않고도
MCP db-fetcher가 동작해야 한다.

## Root Cause

유일한 원인 위치: `packages/db-first/mcp-db-fetcher/src/queries/indexes.ts` (lines 21–28).

그 외 모든 쿼리(`tables.ts`, `relationships.ts`, `stored-procedures.ts`, `data.ts`)는
표준 `sys.*` 카탈로그 뷰만 사용하여 호환성 이슈가 없다.

## Solution

`STRING_AGG ... WITHIN GROUP` 집계를 `STUFF + FOR XML PATH` 상관 서브쿼리 패턴으로
재작성한다. 이 패턴은 SQL Server 2012+ (compat 110+) 전 버전에서 동일하게 동작한다.

### Rationale: 왜 STUFF + FOR XML PATH 인가

- 하한 호환성 최대화: compat 110+ 커버 (사용자 환경에 관계없이 안전)
- 기능·결과 동일: 컬럼 순서 (`key_ordinal`) 보존 가능
- 복잡도 증가 미미: 동일한 집계를 서브쿼리 2개로 분리하는 수준
- `TYPE` 지시자 + `.value('.', 'NVARCHAR(MAX)')` 조합으로 XML 엔티티 이스케이프 문제 회피

## Changes

### 1. `packages/db-first/mcp-db-fetcher/src/queries/indexes.ts`

`STRING_AGG` 기반 쿼리를 `STUFF + FOR XML PATH` 상관 서브쿼리로 치환.

**Before**:
```sql
SELECT
  i.name AS index_name, t.name AS table_name,
  i.is_unique, i.is_primary_key,
  STRING_AGG(CASE WHEN ic.is_included_column = 0 THEN c.name END, ', ')
    WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns,
  STRING_AGG(CASE WHEN ic.is_included_column = 1 THEN c.name END, ', ') AS included_columns
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
{whereClause} AND i.type > 0
GROUP BY i.name, t.name, i.is_unique, i.is_primary_key
ORDER BY t.name, i.name
```

**After**:
```sql
SELECT
  i.name AS index_name, t.name AS table_name,
  i.is_unique, i.is_primary_key,
  STUFF((
    SELECT ', ' + c.name
    FROM sys.index_columns ic
    INNER JOIN sys.columns c
      ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
      AND ic.is_included_column = 0
    ORDER BY ic.key_ordinal
    FOR XML PATH(''), TYPE
  ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS columns,
  STUFF((
    SELECT ', ' + c.name
    FROM sys.index_columns ic
    INNER JOIN sys.columns c
      ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
      AND ic.is_included_column = 1
    FOR XML PATH(''), TYPE
  ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS included_columns
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
{whereClause} AND i.type > 0
ORDER BY t.name, i.name
```

TypeScript 매핑 코드(record → IndexInfo)는 결과 스키마가 동일하므로 수정 불필요.

### 2. `packages/db-first/README.md` & `dist/db-first/README.md`

"MS SQL Server Compatibility Level" 섹션 (lines 5–19) 제거. 대체 문구:

```markdown
### MS SQL Server 버전

SQL Server 2012 이상을 권장합니다. Compatibility level 설정은 필요하지 않습니다.
```

## Verification

1. `pnpm --filter @pyanllc/mcp-db-fetcher build` 성공
2. `pnpm run dist` 로 dist 디렉토리 재조립
3. 실제 MSSQL 연결 후 `get_indexes` 호출:
   - 단일 컬럼 인덱스 결과 확인
   - 복합 인덱스의 컬럼 순서(key_ordinal) 보존 확인
   - included columns 포함 인덱스 결과 확인
4. 변경 전후 결과 동등성 비교

## Out of Scope

- 다른 쿼리 파일 변경 (표준 `sys.*` 뷰만 사용, 이슈 없음)
- EF Core scaffold 도구 (이 리포지토리에 없음)
- 버전 bump (별도 릴리스 프로세스)
