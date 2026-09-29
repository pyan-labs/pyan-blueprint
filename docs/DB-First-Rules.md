### Skills 동작 원칙

각 SKILL.md는 MCP tool 호출 순서를 명시한다. Skills는 항상 실제 DB를 조회 후 코드를 생성하며 스키마를 추측하지 않는다.

## DB-first AI 동작 규칙

NEVER assume, infer, guess, or hallucinate any of the following:

- Table names or column names
- Data types, lengths, or nullability
- FK relationships or cardinality
- Index definitions or constraints
- Actual data values, patterns, or code column meanings

**ALWAYS use `mcp:db-fetcher` before:**

- Writing any Entity class or EF Core configuration
- Writing any LINQ, SQL, or stored procedure
- Generating any DTO, ViewModel, or API response model
- Building any frontend component that binds to data
- Making any assumption about schema "from context"

### MCP: db-fetcher — Mandatory Usage Order

When starting any DB-related task, call tools in this order:

```
1. list_connections        → confirm open environment and available connections
2. get_all_tables          → understand full DB surface
3. get_table_schema        → columns, types, PK, nullable, identity
4. get_relationships       → FK, navigation property direction
5. get_indexes             → query optimization, unique constraints
6. get_stored_procedures   → check before replacing SP with EF Core
7. get_sample_data         → actual data patterns, code columns
```

Only call what's needed for the task — but never skip step 3.

### Environment Rules

| Rule             | Detail                                              |
| ---------------- | --------------------------------------------------- |
| **Default env**  | Use the `open` environment from `.db-fetcher.json` unless user explicitly specifies another |
| **Prod access**  | Only when user says "prod 확인해줘" or "check prod" |
| **Prod writes**  | NEVER. Prod is read-only. db-fetcher enforces this. |
| **Prod row cap** | db-fetcher auto-caps prod queries at 1000 rows      |

When user asks to check prod:

1. Confirm: "Prod DB를 조회합니다. 읽기 전용입니다. 계속할까요?"
2. Proceed only after confirmation
3. Never generate write code targeting prod

## 핵심 개발 규칙

- **DB-first**: 스키마는 반드시 `mcp:db-fetcher`로 확인 후 코드 생성. 추측 금지.
- **기본 환경은 `.db-fetcher.json`의 `open` 값** — prod는 명시적 요청 시에만, read-only 강제
- **EF Core**: DB-first만, Code-first migration 금지, Fluent API 사용
- **Clean Architecture 순서**: Entity → DTO → IRepository → Repository → IService → Service → Controller
- **네이밍**: DB `snake_case` → C# `PascalCase`, 테이블명 → 단수형 클래스명

### Tech Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Database | MS SQL Server                                |
| ORM      | Entity Framework Core — **DB-first only**    |
| Backend  | C# / .NET / Clean Architecture               |
| API      | REST API (Controller → Service → Repository) |
| Frontend | WPF (MVVM) **or** TypeScript + React + Vite  |

### Naming Conventions

| DB                    | C#                             |
| --------------------- | ------------------------------ |
| `snake_case` column   | `PascalCase` property          |
| `order_items` table   | `OrderItem` class (singular)   |
| `FK_Orders_Customers` | `Customer` navigation property |

Never rename or alias without explicit user request.

### Clean Architecture Layer Order

When generating code, always produce in this order:

```
1. Domain Entity       (from DB schema)
2. DTO                 (Request / Response separated)
3. IRepository         (interface)
4. Repository          (EF Core implementation)
5. IService            (interface)
6. Service             (business logic)
7. Controller          (thin — delegate to service)
```